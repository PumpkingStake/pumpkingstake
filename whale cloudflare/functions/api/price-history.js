// POST /api/price-history  y GET /api/price-history
const KEY = 'price-history.json';
const MIN_GAP_MS = 20 * 60 * 1000;
const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function sanitizePrices(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const [id, value] of Object.entries(raw)) {
    const num = Number(value);
    if (isFinite(num) && num > 0) clean[id] = num;
  }
  return clean;
}

export async function onRequest(context) {
  const { request, env } = context;
  const KV = env.WHALECOIN_KV;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let history = [];
  const stored = await KV.get(KEY, 'json');
  if (stored) history = stored;

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const prices = sanitizePrices(body.prices);
    if (Object.keys(prices).length > 0) {
      const now = Date.now();
      const last = history[history.length - 1];
      if (!last || now - last.t > MIN_GAP_MS) {
        history.push({ t: now, prices });
      } else {
        last.prices = { ...last.prices, ...prices };
      }
      const cutoff = now - RETENTION_MS;
      history = history.filter(p => p.t >= cutoff);
      await KV.put(KEY, JSON.stringify(history));
    }
  }

  return new Response(JSON.stringify({ history }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}