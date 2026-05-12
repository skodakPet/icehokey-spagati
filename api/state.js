import { sql, serverError } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const seasons = await sql`select * from seasons order by year desc`;
    const settingsRows = await sql`select * from app_settings where id = 1`;
    const settings = settingsRows[0] || null;

    const requested = req.query.seasonId ? parseInt(req.query.seasonId, 10) : null;
    const activeId = requested || settings?.active_season_id || seasons[0]?.id || null;
    const activeSeason = seasons.find(s => s.id === activeId) || seasons[0] || null;

    let members = [], matches = [], tips = [];
    if (activeSeason) {
      members = await sql`select * from members where season_id = ${activeSeason.id} order by id`;
      matches = await sql`select * from matches where season_id = ${activeSeason.id} order by match_date`;
      const matchIds = matches.map(m => m.id);
      tips = matchIds.length
        ? await sql`select * from tips where match_id = any(${matchIds})`
        : [];
    }

    res.status(200).json({ settings, seasons, activeSeason, members, matches, tips });
  } catch (e) {
    serverError(res, e);
  }
}
