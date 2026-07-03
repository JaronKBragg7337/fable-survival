import { body, method, requireSession, sendError, supabase, validateSaveBlob } from './_cloud.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'GET/PUT only' });
  try {
    const player_id = await requireSession(req);
    if (req.method === 'GET') {
      const rows = await supabase(`player_saves?player_id=eq.${player_id}&select=save_blob,save_version,client_version,device_label,updated_at`, {
        method: 'GET',
        headers: { Prefer: undefined }
      });
      return res.status(200).json({ ok: true, save: rows?.[0] || null });
    }

    if (!method(req, res, 'PUT')) return;
    const b = body(req);
    if (!validateSaveBlob(b.save_blob)) return res.status(400).json({ error: 'bad-save' });
    const rows = await supabase('player_saves?on_conflict=player_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        player_id,
        save_blob: b.save_blob,
        save_version: Number.isInteger(b.save_version) ? b.save_version : 1,
        client_version: String(b.client_version || '').slice(0, 24) || null,
        device_label: String(b.device_label || '').slice(0, 48) || null
      })
    });
    return res.status(200).json({ ok: true, save: rows?.[0] || null });
  } catch (error) {
    return sendError(res, error);
  }
}
