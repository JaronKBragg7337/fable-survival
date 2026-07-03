import {
  body,
  cleanUsername,
  createSession,
  method,
  publicAccount,
  rateLimit,
  sendError,
  supabase,
  validPassword,
  validUsername,
  verifySecret
} from '../_cloud.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!rateLimit(req, 'account-login', 8)) return res.status(429).json({ error: 'slow-down' });
  try {
    const b = body(req);
    const username = cleanUsername(b.username);
    if (!validUsername(username) || !validPassword(b.password)) return res.status(401).json({ error: 'invalid-login' });

    const rows = await supabase(`player_accounts?username_normalized=eq.${encodeURIComponent(username)}&select=player_id,username,handle,account_kind,password_hash`, {
      method: 'GET',
      headers: { Prefer: undefined }
    });
    const account = rows?.[0];
    if (!account || account.account_kind !== 'password') return res.status(401).json({ error: 'invalid-login' });
    if (!await verifySecret(String(b.password), account.password_hash)) return res.status(401).json({ error: 'invalid-login' });

    await supabase(`player_accounts?player_id=eq.${account.player_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_seen_at: new Date().toISOString() })
    });
    const session = await createSession(account.player_id);
    return res.status(200).json({ ok: true, account: publicAccount(account), session });
  } catch (error) {
    return sendError(res, error);
  }
}
