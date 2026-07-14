// GET /api/address-info?addresses=addr1...,addr2...
const BLOCKFROST_ENDPOINT = 'https://cardano-mainnet.blockfrost.io/api/v0/addresses/';
const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const addresses = url.searchParams.get('addresses')?.split(',') || [];

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!addresses.length) {
    return new Response(JSON.stringify({ error: 'Falta parámetro addresses' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  const errors = [];

  for (const addr of addresses) {
    try {
      const res = await fetch(BLOCKFROST_ENDPOINT + addr, {
        headers: {
          'project_id': BLOCKFROST_PROJECT_ID || '',
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Blockfrost ${res.status}: ${errText}`);
      }
      const data = await res.json();
      const lovelace = data.amount?.find(a => a.unit === 'lovelace')?.quantity || '0';
      const assetList = (data.amount || [])
        .filter(item => item.unit !== 'lovelace')
        .map(item => ({
          policy_id: item.unit.slice(0, 56),
          asset_name: item.unit.slice(56),
          quantity: item.quantity,
        }));
      results.push({
        address: addr,
        balance: lovelace,
        utxo_set: [{ asset_list: assetList }],
      });
    } catch (err) {
      errors.push({ address: addr, error: err.message });
    }
  }

  return new Response(JSON.stringify({ results, errors }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}