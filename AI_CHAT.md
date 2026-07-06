# AI_CHAT.md — In-game AI chat that can act on live state

The 🤖 button in the menubar opens a chat with Claude. Unlike 💬 feedback
(one-way, goes to a GitHub issue), this is a live conversation: the assistant
can call a fixed set of tools that immediately change the running game for
whoever is chatting (give items, heal/restore hunger-thirst, give coins, skip
the clock, teleport to the safe zone).

## Why it's gated

Feedback text is safe because it only ever becomes a GitHub issue for a human
to read. This endpoint can mutate live gameplay, so unlike `/api/feedback` it
is **fully gated behind a shared passphrase** (`AI_CHAT_KEY`). Without the
correct code, `/api/aichat` does nothing — it never even calls Anthropic — so
random players/testers get a "wrong dev code" message and no cost/blast radius
is possible. This is meant as the owner's personal dev tool, not a public
feature (the icebox item "Ask the Dev Team v2" is a *different*, lower-stakes
idea — a chat-only Q&A — and is still unbuilt).

## Required Vercel environment variables

Set these on the `fable-survival` Vercel project (Project Settings →
Environment Variables), then redeploy:

```bash
ANTHROPIC_API_KEY=sk-ant-...        # from https://console.anthropic.com
AI_CHAT_KEY=choose-a-private-code   # shared secret typed into the in-game "Dev code" field
ANTHROPIC_MODEL=claude-3-5-haiku-20241022   # optional override; server has this as the default
```

Never commit real values for these — `.env.example` only has placeholders.
If `ANTHROPIC_API_KEY` or `AI_CHAT_KEY` is missing, the endpoint returns
`not-configured` and the panel says so; the game itself is unaffected either
way.

## What it can actually do (fixed tool list, server + client both validate)

- `give_item` — add 1-10 of a whitelisted item id to the player's inventory
- `heal` — restore health/hunger/thirst (1-100 each, only the fields given)
- `give_coins` — add 1-500 coins
- `set_time` — jump the in-game clock to any hour 0-24 (e.g. skip to night)
- `teleport_safezone` — send the player back to the fenced safe zone

Every action is re-validated and clamped client-side in
`UI._applyAiAction()` even though the server already constrains the tool
schema — defense in depth. The assistant cannot do anything outside this
list: no arbitrary code execution, no reaching into other systems.

## Architecture

- `src/ui.js` — `openAiChat()` / `_renderAiChat()` / `_sendAiChat()` /
  `_applyAiAction()`. Chat history is in-memory only (component state, capped
  at 20 turns), never written to localStorage/save data — nothing sent to the
  assistant is retained after a page reload.
- `api/aichat.js` — Vercel serverless function. Validates the passphrase and
  rate limit (reuses `rateLimit()` from `api/_cloud.js`), then calls the
  Anthropic Messages API with the tool schema above and returns
  `{ reply, actions }` for the client to display/execute.

## Cost/model notes

Defaults to `claude-3-5-haiku-20241022` for low per-message cost; override
with `ANTHROPIC_MODEL` if a different model is preferred. `max_tokens: 400`
and history is capped to the last 8 turns / 400 chars each, so a runaway
conversation can't blow up token usage. Rate limit is 20 requests/minute per
IP (in-memory, resets on cold start — friction, not a hard wall, same
trade-off as the existing cloud-save endpoints).
