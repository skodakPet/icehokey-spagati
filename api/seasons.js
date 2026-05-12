import { sql, badRequest, serverError } from './_db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { year, copyMembersFromSeasonId } = req.body || {};
      const y = parseInt(year, 10);
      if (!y || y < 2000 || y > 2200) return badRequest(res, 'rok mimo rozsah');
      const inserted = await sql`
        insert into seasons (year, name) values (${y}, ${'MS Hokej ' + y}) returning *
      `;
      const newSeason = inserted[0];

      if (copyMembersFromSeasonId) {
        const src = await sql`select name from members where season_id = ${copyMembersFromSeasonId}`;
        if (src.length > 0) {
          const names = src.map(m => m.name);
          const ids = src.map(() => newSeason.id);
          await sql`
            insert into members (season_id, name)
            select * from unnest(${ids}::int[], ${names}::text[])
          `;
        }
      }

      await sql`update app_settings set active_season_id = ${newSeason.id} where id = 1`;
      return res.status(201).json(newSeason);
    }

    if (req.method === 'PATCH') {
      const { active_season_id } = req.body || {};
      if (!active_season_id) return badRequest(res, 'active_season_id chybí');
      await sql`update app_settings set active_season_id = ${active_season_id} where id = 1`;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    serverError(res, e);
  }
}
