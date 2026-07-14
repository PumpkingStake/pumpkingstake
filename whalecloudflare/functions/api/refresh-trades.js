// POST /api/refresh-trades (o GET, según prefieras)
import { fetchTradesForPool, normalizeTrade, TOKENS, POOL_ADDRESSES, GT_HEADERS, CALL_SPACING_MS } from './_shared.js';

const TRADES_BLOB_PATH = 'trades-cache.json';
const MAX_TRADES = 60;

export async function onRequest(context) {
  const { env } = context;
  const KV = env.WHALECOIN_KV;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Leer cache anterior
  let previous = await KV.get(TRADES_BLOB_PATH, 'json');
  if (!previous) previous = { trades: [] };
  const previousBySymbol = {};
  for (const t of previous.trades || []) {
    (previousBySymbol[t.symbol] ||= []).push(t);
  }

  const tokensWithPool = TOKENS.filter(t => POOL_ADDRESSES[t.id]);
  const resultsBySymbol = { ...previousBySymbol };
  const failedSymbols = [];
  const refreshedSymbols = [];

  for (let i = 0; i < tokensWithPool.length; i++) {
    const t = tokensWithPool[i];
    const trades = await fetchTradesForPool(t, POOL_ADDRESSES[t.id]);
    if (trades === null) {
      failedSymbols.push(t.symbol);
    } else if (trades.length > 0) {
      resultsBySymbol[t.symbol] = trades;
      refreshedSymbols.push(t.symbol);
    } else {
      refreshedSymbols.push(t.symbol);
    }
    if (i < tokensWithPool.length - 1) {
      await new Promise(r => setTimeout(r, CALL_SPACING_MS));
    }
  }

  const allTrades = Object.values(resultsBySymbol).flat();
  allTrades.sort((a, b) => b.timestamp - a.timestamp);
  const trades = allTrades.slice(0, MAX_TRADES);

  const result = { trades, updatedAt: Date.now() };
  if (failedSymbols.length > 0) result._staleSymbols = failedSymbols;

  await KV.put(TRADES_BLOB_PATH, JSON.stringify(result));

  const response = {
    status: 'ok',
    totalTrades: allTrades.length,
    batch: tokensWithPool.map(t => t.symbol),
    refreshedSymbols,
    failedSymbols,
    message: failedSymbols.length > 0
      ? `${refreshedSymbols.join(', ') || 'ninguno'} actualizado, ${failedSymbols.join(', ')} usó cache anterior.`
      : `Todos los tokens actualizados correctamente.`,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}