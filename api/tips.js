import { sql, badRequest, serverError } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { match_id, member_name, home_score, away_score } = req.body || {};
    if (!match_id || !member_name || home_score == null || away_score == null) {
      return badRequest(res, 'match_id, member_name, home_score, away_score jsou povinné');
    }
    const rows = await sql`
      insert into tips (match_id, member_name, home_score, away_score, updated_at)
      values (${match_id}, ${member_name}, ${home_score}, ${away_score}, now())
      on conflict (match_id, member_name)
      do update set home_score = excluded.home_score, away_score = excluded.away_score, updated_at = now()
      returning *
    `;
    res.status(200).json(rows[0]);
  } catch (e) {
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'Tento výsledek už někdo tipoval', code: '23505' });
    }
    serverError(res, e);
  }
}
