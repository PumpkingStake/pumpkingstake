const KEY = 'tvl-history.json';
const MIN_GAP_MS = 20 * 60 * 1000;
const RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

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
    const value = Number(body.value);
    if (value > 0) {
      const now = Date.now();
      const last = history[history.length - 1];
      if (!last || now - last.t > MIN_GAP_MS) {
        history.push({ t: now, v: value });
      } else {
        last.v = value;
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