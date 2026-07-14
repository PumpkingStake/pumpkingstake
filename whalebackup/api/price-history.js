// api/price-history.js
import { put, get } from '@vercel/blob';

const BLOB_PATH = 'whalecoin/price-history.json';
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

function sanitizePrices(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [id, value] of Object.entries(raw)) {
    const num = Number(value);
    if (isFinite(num) && num > 0) clean[id] = num;
  }
  return clean;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  let history = await readHistory();

  if (req.method === 'POST') {
    try {
      const prices = sanitizePrices(req.body?.prices);
      if (Object.keys(prices).length > 0) {
        const now = Date.now();
        const last = history[history.length - 1];
        if (!last || now - last.t > MIN_GAP_MS) {
          history.push({ t: now, prices });
        } else {
          last.prices = { ...last.prices, ...prices };
        }
        const cutoff = now - RETENTION_MS;
        history = history.filter((p) => p.t >= cutoff);
        await writeHistory(history);
      }
    } catch (_) {}
  }

  return res.status(200).json({ history });
}