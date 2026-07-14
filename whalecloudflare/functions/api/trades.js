// GET /api/trades
export async function onRequest(context) {
  const { env } = context;
  const KV = env.WHALECOIN_KV;
  const key = 'trades-cache.json';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const data = await KV.get(key, 'json');
    if (!data) {
      return new Response(JSON.stringify({ trades: [], updatedAt: Date.now() }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (_) {
    return new Response(JSON.stringify({ trades: [], updatedAt: Date.now() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}