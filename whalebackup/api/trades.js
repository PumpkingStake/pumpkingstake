// api/trades.js
import { get } from '@vercel/blob';

const TRADES_BLOB_PATH = 'whalecoin/trades-cache.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const result = await get(TRADES_BLOB_PATH, { access: 'public' });
    if (!result) return res.status(200).json({ trades: [], updatedAt: Date.now() });
    const text = await new Response(result.stream).text();
    return res.status(200).json(JSON.parse(text));
  } catch (_) {
    return res.status(200).json({ trades: [], updatedAt: Date.now() });
  }
}