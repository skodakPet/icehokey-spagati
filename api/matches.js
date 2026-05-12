import { sql, badRequest, serverError } from './_db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { season_id, opponent, match_date, match_time, phase } = req.body || {};
      if (!season_id || !opponent || !match_date) return badRequest(res, 'season_id, opponent, match_date jsou povinné');
      const rows = await sql`
        insert into matches (season_id, opponent, match_date, match_time, phase)
        values (${season_id}, ${opponent}, ${match_date}, ${match_time || '16:20'}, ${phase || 'Skupina'})
        returning *
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return badRequest(res, 'id chybí');
      await sql`delete from matches where id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const id = parseInt(req.query.id, 10);
      if (!id) return badRequest(res, 'id chybí');
      const { action, result_home, result_away } = req.body || {};
      if (action === 'finish') {
        if (result_home == null || result_away == null) return badRequest(res, 'result_home a result_away jsou povinné');
        const rows = await sql`
          update matches set status = 'finished', result_home = ${result_home}, result_away = ${result_away}
          where id = ${id} returning *
        `;
        return res.status(200).json(rows[0]);
      }
      if (action === 'reopen') {
        const rows = await sql`
          update matches set status = 'upcoming', result_home = null, result_away = null
          where id = ${id} returning *
        `;
        return res.status(200).json(rows[0]);
      }
      return badRequest(res, 'neznámá action (očekáváno: finish | reopen)');
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    serverError(res, e);
  }
}
