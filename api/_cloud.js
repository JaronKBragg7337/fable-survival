// Shared helpers for cloud-save Vercel functions.
// Holds the Supabase secret key server-side only; never import this from src/.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const MAX_SAVE_BYTES = 16 * 1024;
const SESSION_HOURS = 24;
const RECOVERY_PREFIX = 'FABLE';
const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function method(req, res, expected) {
  if (req.method !== expected) {
    res.status(405).json({ error: `${expected} only` });
    return false;
  }
  return true;
}

export function body(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export function cleanHandle(value) {
  return String(value ?? '').trim().slice(0, 24).replace(/[<>@]/g, '') || 'Survivor';
}

export function cleanUsername(value) {
  return String(value ?? '').trim().slice(0, 24).replace(/[<>@]/g, '').toLowerCase();
}

export function validUsername(username) {
  return /^[a-z0-9_-]{3,24}$/.test(username);
}

export function validPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 96;
}

export function makeRecoveryCode() {
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += RECOVERY_CHARS[bytes[i] % RECOVERY_CHARS.length];
  return `${RECOVERY_PREFIX}-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
}

export function normalizeRecoveryCode(code) {
  return String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function hashSecret(value) {
  return bcrypt.hash(value, 12);
}

export async function verifySecret(value, hash) {
  if (!value || !hash) return false;
  try { return await bcrypt.compare(value, hash); }
  catch { return false; }
}

export function makeSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function randomId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
}

export function publicAccount(row) {
  return {
    player_id: row.player_id,
    username: row.username,
    handle: row.handle,
    account_kind: row.account_kind
  };
}

export function getBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

export function validateSaveBlob(save_blob) {
  const bytes = Buffer.byteLength(JSON.stringify(save_blob ?? null), 'utf8');
  return save_blob && typeof save_blob === 'object' && !Array.isArray(save_blob) && bytes <= MAX_SAVE_BYTES;
}

export async function supabase(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    const err = new Error('not-configured');
    err.status = 503;
    throw err;
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(options.headers || {})
  };
  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];

  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...options,
    headers
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const err = new Error(data?.message || data?.hint || 'supabase-error');
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function createSession(player_id) {
  const token = makeSessionToken();
  const rows = await supabase('player_sessions', {
    method: 'POST',
    body: JSON.stringify({
      player_id,
      token_hash: hashToken(token),
      expires_at: sessionExpiry()
    })
  });
  return { token, expires_at: rows?.[0]?.expires_at };
}

export async function requireSession(req) {
  const token = getBearer(req);
  if (!token) {
    const err = new Error('missing-session');
    err.status = 401;
    throw err;
  }
  const rows = await supabase(`player_sessions?token_hash=eq.${hashToken(token)}&select=player_id,expires_at`, {
    method: 'GET',
    headers: { Prefer: undefined }
  });
  const session = rows?.[0];
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    const err = new Error('invalid-session');
    err.status = 401;
    throw err;
  }
  await supabase(`player_sessions?token_hash=eq.${hashToken(token)}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_seen_at: new Date().toISOString() })
  });
  return session.player_id;
}

export function sendError(res, error) {
  if (error?.message === 'not-configured') return res.status(503).json({ error: 'not-configured' });
  const status = error?.status && error.status >= 400 && error.status < 600 ? error.status : 500;
  return res.status(status).json({ error: status >= 500 ? 'server-error' : error.message });
}

const buckets = new Map();

export function rateLimit(req, key, limit = 12, windowMs = 60_000) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const bucketKey = `${key}:${String(ip).split(',')[0].trim()}`;
  const now = Date.now();
  const bucket = buckets.get(bucketKey) || { start: now, count: 0 };
  if (now - bucket.start > windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count++;
  buckets.set(bucketKey, bucket);
  return bucket.count <= limit;
}
