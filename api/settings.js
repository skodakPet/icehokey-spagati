import { sql, badRequest, serverError } from './_db.js';

const ALLOWED = new Set(['app_name', 'wa_group_name', 'admin_password', 'api_key', 'active_season_id']);

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const entries = Object.entries(body).filter(([k]) => ALLOWED.has(k));
    if (entries.length === 0) return badRequest(res, 'žádné povolené pole');

    for (const [k, v] of entries) {
      if (k === 'app_name') await sql`update app_settings set app_name = ${v} where id = 1`;
      else if (k === 'wa_group_name') await sql`update app_settings set wa_group_name = ${v} where id = 1`;
      else if (k === 'admin_password') await sql`update app_settings set admin_password = ${v} where id = 1`;
      else if (k === 'api_key') await sql`update app_settings set api_key = ${v} where id = 1`;
      else if (k === 'active_season_id') await sql`update app_settings set active_season_id = ${v} where id = 1`;
    }

    const rows = await sql`select * from app_settings where id = 1`;
    res.status(200).json(rows[0]);
  } catch (e) {
    serverError(res, e);
  }
}
