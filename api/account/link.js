import {
  body,
  createSession,
  method,
  normalizeRecoveryCode,
  publicAccount,
  rateLimit,
  sendError,
  supabase,
  verifySecret
} from '../_cloud.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!rateLimit(req, 'account-link', 6)) return res.status(429).json({ error: 'slow-down' });
  try {
    const code = normalizeRecoveryCode(body(req).recovery_code);
    if (code.length < 10) return res.status(401).json({ error: 'invalid-code' });

    const rows = await supabase('player_accounts?recovery_code_used_at=is.null&select=player_id,username,handle,account_kind,recovery_code_hash', {
      method: 'GET',
      headers: { Prefer: undefined }
    });
    let account = null;
    for (const row of rows) {
      if (await verifySecret(code, row.recovery_code_hash)) {
        account = row;
        break;
      }
    }
    if (!account) return res.status(401).json({ error: 'invalid-code' });

    await supabase(`player_accounts?player_id=eq.${account.player_id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        recovery_code_used_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      })
    });
    const session = await createSession(account.player_id);
    return res.status(200).json({ ok: true, account: publicAccount(account), session });
  } catch (error) {
    return sendError(res, error);
  }
}
