// api/tvl-history.js
import { put, get } from '@vercel/blob';

const BLOB_PATH = 'whalecoin/tvl-history.json';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_GAP_MS = 20 * 60 * 1000;
const RETENTION_MS = 2 * DAY_MS;

async function readHistory() {
  try {
    const result = await get(BLOB_PATH, { access: 'public' });
    if (!result) return [];
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (_) {
    return [];
  }
}

async function writeHistory(history) {
  await put(BLOB_PATH, JSON.stringify(history), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  let history = await readHistory();

  if (req.method === 'POST') {
    try {
      const value = Number(req.body?.value);
      if (value && value > 0) {
        const now = Date.now();
        const last = history[history.length - 1];
        if (!last || now - last.t > MIN_GAP_MS) {
          history.push({ t: now, v: value });
        } else {
          last.v = value;
        }
        const cutoff = now - RETENTION_MS;
        history = history.filter((p) => p.t >= cutoff);
        await writeHistory(history);
      }
    } catch (_) {}
  }

  return res.status(200).json({ history });
}