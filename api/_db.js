import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL není nastavená. Přidej ji ve Vercel → Settings → Environment Variables.');
}

export const sql = neon(process.env.DATABASE_URL);

export function badRequest(res, msg) {
  res.status(400).json({ error: msg });
}

export function serverError(res, e) {
  console.error(e);
  res.status(500).json({ error: e?.message || 'Server error' });
}
