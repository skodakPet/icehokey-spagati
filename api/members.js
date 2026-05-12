import { sql, badRequest, serverError } from './_db.js';
import { del } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { season_id, name } = req.body || {};
      if (!season_id || !name) return badRequest(res, 'season_id a name jsou povinné');
      const rows = await sql`
        insert into members (season_id, name) values (${season_id}, ${name}) returning *
      `;
      return res.status(201).json(rows[0]);
    }

    if (req.method === 'DELETE') {
      const id = parseInt(req.query.id, 10);
      if (!id) return badRequest(res, 'id chybí');
      const existing = await sql`select photo_url from members where id = ${id}`;
      const url = existing[0]?.photo_url;
      if (url && url.includes('blob.vercel-storage.com') && process.env.BLOB_READ_WRITE_TOKEN) {
        try { await del(url); } catch (e) { console.warn('Blob delete failed:', e.message); }
      }
      await sql`delete from members where id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PATCH') {
      const id = parseInt(req.query.id, 10);
      if (!id) return badRequest(res, 'id chybí');
      const { photo_url } = req.body || {};
      if (photo_url === null) {
        const existing = await sql`select photo_url from members where id = ${id}`;
        const old = existing[0]?.photo_url;
        if (old && old.includes('blob.vercel-storage.com') && process.env.BLOB_READ_WRITE_TOKEN) {
          try { await del(old); } catch (e) { console.warn('Blob delete failed:', e.message); }
        }
      }
      const rows = await sql`
        update members set photo_url = ${photo_url} where id = ${id} returning *
      `;
      return res.status(200).json(rows[0]);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    serverError(res, e);
  }
}
