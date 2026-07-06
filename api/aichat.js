// ============================================================
// AI CHAT API - Vercel serverless function.
// Lets the owner talk to Claude from inside the game and have it
// take real, bounded actions on the live game state (give items,
// heal, skip time, teleport to the safe zone) by returning tool
// calls that the client executes locally.
//
// Requires env vars (set in the Vercel project, never commit real
// values):
//   ANTHROPIC_API_KEY - Anthropic API key
//   AI_CHAT_KEY       - shared passphrase gating this endpoint
//   ANTHROPIC_MODEL   - optional, defaults to claude-3-5-haiku-20241022
//
// SECURITY: this endpoint is gated by AI_CHAT_KEY specifically
// because, unlike /api/feedback, a successful call can mutate live
// game state. Without the correct key it does nothing and never
// calls Anthropic (keeps cost + blast radius at zero for randoms).
// The chat message itself is normal conversational input, not
// untrusted "data" the way feedback text is - but the assistant is
// still limited server-side to the fixed tool list below; it cannot
// run arbitrary code or reach anything outside those five actions.
// ============================================================
import { method, body, rateLimit } from './_cloud.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
const ITEM_IDS = ['wood', 'stone', 'scrap', 'can', 'water', 'bandage', 'axe', 'pickaxe', 'fuel', 'battery', 'wheel'];

const TOOLS = [
  {
    name: 'give_item',
    description: "Give the player an item in their inventory.",
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', enum: ITEM_IDS },
        count: { type: 'integer', minimum: 1, maximum: 10 }
      },
      required: ['item', 'count']
    }
  },
  {
    name: 'heal',
    description: "Restore the player's health, hunger, and/or thirst. Omit any you don't want to change.",
    input_schema: {
      type: 'object',
      properties: {
        health: { type: 'integer', minimum: 1, maximum: 100 },
        hunger: { type: 'integer', minimum: 1, maximum: 100 },
        thirst: { type: 'integer', minimum: 1, maximum: 100 }
      }
    }
  },
  {
    name: 'give_coins',
    description: 'Give the player coins to spend at the trader.',
    input_schema: {
      type: 'object',
      properties: { amount: { type: 'integer', minimum: 1, maximum: 500 } },
      required: ['amount']
    }
  },
  {
    name: 'set_time',
    description: 'Skip the in-game clock to a given hour of the day (0-24), e.g. jump to night or morning.',
    input_schema: {
      type: 'object',
      properties: { hour: { type: 'number', minimum: 0, maximum: 24 } },
      required: ['hour']
    }
  },
  {
    name: 'teleport_safezone',
    description: 'Teleport the player back to the fenced safe zone (also exits any vehicle).',
    input_schema: { type: 'object', properties: {} }
  }
];

const SYSTEM = `You are the dev companion for Fable Survival, a small mobile browser survival
game (Three.js). You are talking directly to the developer/owner inside the
running game. You can actually change the live game state by calling the tools
provided - when the owner asks for something a tool can do (heal them, give
supplies, skip to night, send them to the safe zone), call the matching tool
rather than just describing it in text. If they ask for something no tool
supports, say so plainly and suggest what you *can* do instead. Keep replies
short (1-3 sentences) - this renders in a small mobile chat bubble. You may
receive a short JSON snapshot of current player state (health/hunger/thirst/
coins/day-time/position) for context; use it, don't recite it back verbatim.`;

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!rateLimit(req, 'aichat', 20, 60_000)) {
    return res.status(429).json({ error: 'slow-down' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const gateKey = process.env.AI_CHAT_KEY;
  if (!apiKey || !gateKey) return res.status(503).json({ error: 'not-configured' });

  const { key = '', message = '', history = [], state = {} } = body(req);
  if (key !== gateKey) return res.status(401).json({ error: 'bad-key' });

  const msg = String(message).trim().slice(0, 400);
  if (msg.length < 1) return res.status(400).json({ error: 'empty-message' });

  // bounded, sanitized history - text only, capped length/count
  const cleanHistory = Array.isArray(history)
    ? history.slice(-8).map(h => ({
        role: h?.role === 'assistant' ? 'assistant' : 'user',
        content: String(h?.content ?? '').slice(0, 400)
      })).filter(h => h.content.length > 0)
    : [];

  const stateLine = safeStateLine(state);
  const messages = [
    ...cleanHistory,
    { role: 'user', content: stateLine ? `${msg}\n\n[state: ${stateLine}]` : msg }
  ];

  let anthropicRes;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        tools: TOOLS,
        messages
      })
    });
  } catch {
    return res.status(502).json({ error: 'upstream-error' });
  }

  if (!anthropicRes.ok) {
    return res.status(502).json({ error: 'upstream-error' });
  }

  const data = await anthropicRes.json().catch(() => null);
  const content = Array.isArray(data?.content) ? data.content : [];
  const reply = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  const actions = content
    .filter(b => b.type === 'tool_use' && TOOLS.some(t => t.name === b.name))
    .map(b => ({ type: b.name, input: b.input || {} }));

  return res.status(200).json({ reply: reply || '(no reply)', actions });
}

// Build a short, bounded context line from client-reported state. Never
// trust this for anything privileged - it is just conversational context.
function safeStateLine(state) {
  if (!state || typeof state !== 'object') return '';
  const n = v => (Number.isFinite(v) ? Math.round(v) : null);
  const parts = [];
  if (Number.isFinite(state.health)) parts.push(`hp=${n(state.health)}`);
  if (Number.isFinite(state.hunger)) parts.push(`hunger=${n(state.hunger)}`);
  if (Number.isFinite(state.thirst)) parts.push(`thirst=${n(state.thirst)}`);
  if (Number.isFinite(state.coins)) parts.push(`coins=${n(state.coins)}`);
  if (typeof state.clock === 'string') parts.push(`time=${state.clock.slice(0, 24)}`);
  if (typeof state.driving === 'string') parts.push(`driving=${state.driving.slice(0, 8)}`);
  return parts.slice(0, 8).join(' ');
}
