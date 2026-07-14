const KEY = 'protocol-yields.json';
const CACHE_TTL_MS = 15 * 60 * 1000;
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
  if (!isFinite(aprDecimal)) throw new Error('Strike: apr_30d inválido');
  return {
    apr: aprDecimal * 100,
    aprWindowDays: data.apr_window_days ?? 30,
    uniqueStakers: data.active_staked_count ?? null,
    source: 'api.strikefinance.org (v2)',
  };
}

async function fetchSurfApy() {
  const res = await fetch('https://surflending.org/api/staking/getAPY', {
    headers: { ...BROWSER_HEADERS, Referer: 'https://surflending.org/en/staking' },
  });
  if (!res.ok) throw new Error('Surf API ' + res.status);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error('Surf: respuesta no JSON'); }
  const apy = Number(data.aggregatedApy);
  if (!isFinite(apy)) throw new Error('Surf: aggregatedApy inválido');
  return {
    apy,
    periodApy: Number(data.periodApy) || null,
    source: 'surflending.org (SURF staking)',
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const KV = env.WHALECOIN_KV;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const cached = await KV.get(KEY, 'json');
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const result = { strike: null, surf: null, updatedAt: Date.now() };
  const [strikeRes, surfRes] = await Promise.allSettled([fetchStrikeApr(), fetchSurfApy()]);

  if (strikeRes.status === 'fulfilled') result.strike = strikeRes.value;
  else if (cached?.strike) result.strike = cached.strike;

  if (surfRes.status === 'fulfilled') result.surf = surfRes.value;
  else if (cached?.surf) result.surf = cached.surf;

  await KV.put(KEY, JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}