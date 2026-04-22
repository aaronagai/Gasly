/**
 * Vercel serverless proxy for the Victorian Fair Fuel Open Data API
 * (Fair Fuel Open Data API Documentation — Service Victoria, Oct 2025).
 *
 * Set in the project’s environment (never commit secrets):
 * - `SERVO_SAVER_CONSUMER_ID` (or `SERVO_SAVER_API_KEY`) — API Consumer ID (header `x-consumer-id`)
 * - `SERVO_SAVER_PATH` (optional) — must start with `/`, default `/open-data/v1/fuel/prices`
 * - `SERVO_SAVER_BASE` (optional) — origin only, default `https://api.fuel.service.vic.gov.au`
 * - `SERVO_SAVER_USER_AGENT` (optional) — default `petrolprice.xyz/1.0` (header `User-Agent` is required by the API)
 *
 * The Open Data API also requires a unique `x-transactionid` (UUID) per request; the proxy generates one
 * for each call.
 */
const { randomUUID } = require('crypto');

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

  const key = process.env.SERVO_SAVER_CONSUMER_ID || process.env.SERVO_SAVER_API_KEY;
  let base = String(
    process.env.SERVO_SAVER_BASE || 'https://api.fuel.service.vic.gov.au',
  ).replace(/\/+$/, '');
  try {
    const u = new URL(base);
    base = u.origin;
  } catch (_) {
    /* use base string as before */
  }
  const pathStr = String(process.env.SERVO_SAVER_PATH || '/open-data/v1/fuel/prices').trim();
  const userAgent = String(
    process.env.SERVO_SAVER_USER_AGENT || 'petrolprice.xyz/1.0',
  ).trim();

  if (!key) {
    res.status(503);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'Server missing SERVO_SAVER_CONSUMER_ID. Add it in Vercel project environment variables.',
      }),
    );
    return;
  }

  if (!pathStr.startsWith('/') || pathStr.includes('..')) {
    res.status(503);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error:
          'Set SERVO_SAVER_PATH to a path from the Fair Fuel Open Data API PDF. It must start with / (e.g. /open-data/v1/fuel/prices).',
      }),
    );
    return;
  }

  const incoming = new URL(req.url, 'http://local');
  const target = new URL(pathStr, `${base}/`);
  for (const [k, v] of incoming.searchParams) {
    if (k === 'path' || k === 'url') continue;
    if (Array.isArray(v)) v.forEach((x) => target.searchParams.append(k, x));
    else target.searchParams.set(k, v);
  }

  const upstream = target.toString();

  try {
    const ures = await fetch(upstream, {
      method: 'GET',
      headers: {
        'user-agent': userAgent,
        'x-consumer-id': String(key).trim(),
        'x-transactionid': randomUUID(),
        accept: 'application/json, */*;q=0.8',
      },
      cache: 'no-store',
    });

    const text = await ures.text();
    res.status(ures.status);
    const ct = ures.headers.get('content-type') || 'application/json; charset=utf-8';
    res.setHeader('Content-Type', ct);
    if (ures.status === 204) {
      res.end();
      return;
    }
    res.end(text);
  } catch (err) {
    res.status(502);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'Upstream request failed',
        message: err && err.message ? String(err.message) : 'unknown',
      }),
    );
  }
};
