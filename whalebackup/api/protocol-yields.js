// api/protocol-yields.js
import { put, get } from '@vercel/blob';

const BLOB_PATH = 'whalecoin/protocol-yields.json';
const CACHE_TTL_MS = 15 * 60 * 1000;

async function readCache() {
  try {
    const result = await get(BLOB_PATH, { access: 'public' });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function writeCache(data) {
  await put(BLOB_PATH, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

async function fetchStrikeApr() {
  const res = await fetch('https://api.strikefinance.org/v2/liquid-staking/summary', {
    headers: { ...BROWSER_HEADERS, Referer: 'https://app.strikefinance.org/staking' },
  });
  if (!res.ok) throw new Error('Strike API ' + res.status);
  const data = await res.json();
  const aprDecimal = Number(data.apr_30d);
  if (!isFinite(aprDecimal)) throw new Error('Strike: apr_30d ausente o inválido');
  return {
    apr: aprDecimal * 100,
    aprWindowDays: data.apr_window_days ?? 30,
    uniqueStakers: data.active_staked_count ?? null,
    source: 'api.strikefinance.org (v2 liquid staking)',
  };
}

async function fetchSurfApy() {
  const res = await fetch('https://surflending.org/api/staking/getAPY', {
    headers: { ...BROWSER_HEADERS, Referer: 'https://surflending.org/en/staking' },
  });
  if (!res.ok) throw new Error('Surf API ' + res.status);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error('Surf: respuesta no es JSON (posible bloqueo/HTML) -> ' + text.slice(0, 120));
  }
  const apy = Number(data.aggregatedApy);
  if (!isFinite(apy)) {
    throw new Error('Surf: aggregatedApy ausente o inválido. Respuesta: ' + JSON.stringify(data).slice(0, 300));
  }
  return {
    apy,
    periodApy: Number(data.periodApy) || null,
    source: 'surflending.org (SURF staking, aggregated APY)',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const cached = await readCache();
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return res.status(200).json(cached);
  }

  const result = { strike: null, surf: null, updatedAt: Date.now() };
  const [strikeRes, surfRes] = await Promise.allSettled([fetchStrikeApr(), fetchSurfApy()]);

  if (strikeRes.status === 'fulfilled') {
    result.strike = strikeRes.value;
  } else {
    console.warn('Strike yield fetch failed:', strikeRes.reason?.message);
    if (cached?.strike) result.strike = cached.strike;
  }

  if (surfRes.status === 'fulfilled') {
    result.surf = surfRes.value;
  } else {
    console.warn('Surf yield fetch failed:', surfRes.reason?.message);
    if (cached?.surf) result.surf = cached.surf;
  }

  try {
    await writeCache(result);
  } catch (e) {
    console.warn('No se pudo cachear en Blob (se sirve igual):', e.message);
  }

  return res.status(200).json(result);
}