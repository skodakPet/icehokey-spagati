import { put } from '@vercel/blob';
import { badRequest, serverError } from './_db.js';

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN není nastavený. Vytvoř Blob store ve Vercel Storage.' });
  }
  try {
    const { filename, dataUrl } = req.body || {};
    if (!filename || !dataUrl) return badRequest(res, 'filename a dataUrl jsou povinné');

    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return badRequest(res, 'dataUrl není ve formátu data:*;base64,…');
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    const blob = await put(`avatars/${Date.now()}-${filename}`, buffer, {
      access: 'public',
      contentType,
    });

    res.status(200).json({ url: blob.url });
  } catch (e) {
    serverError(res, e);
  }
}
