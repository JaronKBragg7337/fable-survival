import {
  body,
  cleanHandle,
  cleanUsername,
  createSession,
  hashSecret,
  makeRecoveryCode,
  method,
  publicAccount,
  randomId,
  rateLimit,
  sendError,
  supabase,
  validPassword,
  validUsername
} from './_cloud.js';

export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!rateLimit(req, 'account-create', 5)) return res.status(429).json({ error: 'slow-down' });
  try {
    const b = body(req);
    const handle = cleanHandle(b.handle);
    const wantsPassword = b.username || b.password;
    const username = wantsPassword
      ? cleanUsername(b.username)
      : `player_${randomId(8)}`;

    if (!validUsername(username)) return res.status(400).json({ error: 'bad-username' });
    if (wantsPassword && !validPassword(b.password)) return res.status(400).json({ error: 'bad-password' });

    const recovery_code = makeRecoveryCode();
    const password = wantsPassword ? String(b.password) : randomId(16) + randomId(16);
    const rows = await supabase('player_accounts', {
      method: 'POST',
      body: JSON.stringify({
        username,
        handle,
        account_kind: wantsPassword ? 'password' : 'player_code',
        password_hash: await hashSecret(password),
        password_salt: 'bcryptjs',
        password_iterations: 210000,
        recovery_code_hash: await hashSecret(recovery_code.replace(/[^A-Z0-9]/g, '')),
        recovery_code_salt: 'bcryptjs'
      })
    });
    const account = rows[0];
    const session = await createSession(account.player_id);
    return res.status(200).json({
      ok: true,
      account: publicAccount(account),
      recovery_code,
      session
    });
  } catch (error) {
    if (error?.status === 409 || error?.data?.code === '23505') return res.status(409).json({ error: 'username-taken' });
    return sendError(res, error);
  }
}
