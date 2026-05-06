/**
 * Vercel serverless proxy: Malaysia fuel prices from data.gov.my.
 *
 * Browser fetches to api.data.gov.my may fail due to CORS / origin policy changes.
 * This proxy keeps the request same-origin and returns the upstream JSON.
 *
 * Optional query params (forwarded): id, sort, limit
 */
'use strict';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const incoming = new URL(req.url, 'http://local');
  const upstream = new URL('https://api.data.gov.my/data-catalogue/');
  // Default to the current dataset query used in config.js
  upstream.searchParams.set('id', incoming.searchParams.get('id') || 'fuelprice');
  upstream.searchParams.set('sort', incoming.searchParams.get('sort') || '-date');
  upstream.searchParams.set('limit', incoming.searchParams.get('limit') || '120');

  try {
    const ures = await fetch(upstream.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/json, */*;q=0.8',
        'user-agent': 'petrolprice.xyz/1.0',
      },
    });

    const text = await ures.text();
    res.status(ures.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Cache briefly; the dataset changes weekly.
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=86400');
    res.end(text);
  } catch (e) {
    res.status(502);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Upstream fetch failed', detail: String(e && e.message ? e.message : e) }));
  }
};

