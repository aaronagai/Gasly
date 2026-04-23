/**
 * Vercel serverless proxy: NSW OneGov OAuth + TFNSW FuelCheck “all prices” (NSW only, v1).
 *
 * **Environment (Vercel — do not commit secrets)**
 * - `NSW_FUEL_API_KEY` and `NSW_FUEL_API_SECRET` — from api.nsw.gov.au (Fuel API product)
 *   (aliases: `NSW_FUEL_KEY`, `NSW_FUEL_SECRET` — same as `scripts/nsw-fuel-try.mjs`)
 * - `NSW_FUEL_PRICES_PATH` (optional) — must start with `/`, default `/FuelPriceCheck/v1/fuel/prices` (NSW only; v2 includes TAS)
 * - `NSW_FUEL_API_ORIGIN` (optional) — default `https://api.onegov.nsw.gov.au`
 *
 * Response: compact JSON `{ ok, mins, stationCount, asOf, fetchedAt }` so the browser is not
 * required to download multi‑MB station dumps.
 */
'use strict';

const { Buffer } = require('buffer');

const DEFAULT_ORIGIN = 'https://api.onegov.nsw.gov.au';
const TOKEN_PATH = '/oauth/client_credential/accesstoken';
const DEFAULT_PRICES = '/FuelPriceCheck/v1/fuel/prices';

let _token = { accessToken: null, expMs: 0 };

function getEnv() {
  const id =
    (process.env.NSW_FUEL_API_KEY || process.env.NSW_FUEL_KEY || '').trim() || '';
  const sec =
    (process.env.NSW_FUEL_API_SECRET || process.env.NSW_FUEL_SECRET || '').trim() || '';
  let origin = String(process.env.NSW_FUEL_API_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, '');
  try {
    origin = new URL(origin).origin;
  } catch (_) {}
  const pathStr = String(process.env.NSW_FUEL_PRICES_PATH || DEFAULT_PRICES).trim();
  return { id, sec, origin, pathStr };
}

function audPerLFromRaw(n) {
  const x = typeof n === 'number' ? n : parseFloat(String(n).replace(/,/g, ''));
  if (!Number.isFinite(x) || x <= 0) return null;
  if (x >= 40 && x < 500) return x / 100;
  if (x < 35) return x;
  if (x >= 500) return null;
  return x / 100;
}

/**
 * Data.NSW / FuelCheck `FuelCode` (see e.g. price history CSV) → shared AU retail keys (same as VIC).
 * @param {*} raw
 * @returns {string|null}
 */
function mapNswFuelCodeToVicKey(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return null;
  const c = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!c) return null;
  const m = {
    U91: 'ulp',
    E10: 'e10',
    P95: 'p95',
    P98: 'p98',
    DL: 'diesel',
    PDL: 'diesel_premium',
    PDSL: 'diesel_premium',
    B20: 'diesel',
    B5: 'diesel',
    DSL: 'diesel',
    LPG: 'lpg',
    CNG: 'lpg',
    E85: 'e85',
    ADB: 'adblue',
    ADBLUE: 'adblue',
  };
  if (m[c]) return m[c];
  if (/^P9[58]$/.test(c)) return c === 'P95' ? 'p95' : 'p98';
  if (c === 'B20' || c === 'DL' || c === 'DSL' || c === 'B5') return 'diesel';
  if (c === 'PDL' || c === 'PDSL' || c === 'PD') return 'diesel_premium';
  if (c === 'U' || c === 'ULP' || c === 'RULP') return 'ulp';
  return null;
}

function minUpdate(mins, vkey, aud) {
  if (mins[vkey] == null || aud < mins[vkey]) mins[vkey] = aud;
}

/**
 * @param {Record<string, number|null>} mins
 * @param {*} typeLike
 * @param {*} priceRaw
 */
function consider(mins, typeLike, priceRaw) {
  const vkey = mapNswFuelCodeToVicKey(typeLike);
  if (!vkey) return;
  const aud = audPerLFromRaw(priceRaw);
  if (aud == null) return;
  minUpdate(mins, vkey, aud);
}

/**
 * @param {object} json
 * @returns {{ mins: Record<string, number>, stationCount: number, asOf: string }}
 */
function extractMinsAndStations(json) {
  const mins = Object.create(null);
  const seenStations = new Set();
  const asOfBuf = [];

  function rememberStation(id) {
    if (id == null) return;
    seenStations.add(String(id));
  }

  function tryPair(o) {
    if (o == null || typeof o !== 'object' || Array.isArray(o)) return;
    const typ =
      o.fuelCode != null
        ? o.fuelCode
        : o.FuelCode != null
          ? o.FuelCode
          : o.fuelType != null
            ? o.fuelType
            : o.FuelType != null
              ? o.FuelType
              : o.fuel != null
                ? o.fuel
                : o.Fuel;
    const pr = o.price != null ? o.price : o.Price != null ? o.Price : o.unitPrice;
    if (pr != null && typ != null) {
      consider(mins, typ, pr);
    }
  }

  function visit(o, depth) {
    if (depth > 20 || o == null) return;
    if (Array.isArray(o)) {
      for (const it of o) visit(it, depth + 1);
      return;
    }
    if (typeof o !== 'object') return;

    if (o.stationid != null) rememberStation(o.stationid);
    if (o.stationId != null) rememberStation(o.stationId);
    if (o.StationId != null) rememberStation(o.StationId);
    if (o.code != null && (o.brand != null || o.Brand != null || o.address)) rememberStation(o.code);
    if (o.asat != null) asOfBuf.push(String(o.asat));
    if (o.asAt != null) asOfBuf.push(String(o.asAt));
    if (o.lastUpdated != null) asOfBuf.push(String(o.lastUpdated));

    tryPair(o);

    for (const arr of ['fuelPrices', 'FuelPrices', 'prices', 'Prices', 'fuels', 'Fuels', 'items']) {
      if (!Array.isArray(o[arr])) continue;
      for (const row of o[arr]) {
        if (row == null) continue;
        if (typeof row === 'object') {
          const typ = row.fuelCode ?? row.FuelCode ?? row.fuelType ?? row.FuelType ?? row.fuel;
          const pr = row.price ?? row.Price;
          if (pr != null && typ != null) consider(mins, typ, pr);
        }
      }
    }

    for (const [k, v] of Object.entries(o)) {
      if (v == null) continue;
      if (
        (typeof v === 'number' || (typeof v === 'string' && /^\d/.test(String(v).trim()))) &&
        mapNswFuelCodeToVicKey(k)
      ) {
        consider(mins, k, v);
      }
    }

    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') visit(v, depth + 1);
    }
  }

  visit(json, 0);

  const asOf = asOfBuf.length ? asOfBuf[0] : '';
  return { mins, stationCount: seenStations.size, asOf };
}

async function postClientCredentialsToken(origin, id, sec) {
  const u = new URL(TOKEN_PATH, `${origin}/`);
  const body = 'grant_type=client_credentials';
  const auth = 'Basic ' + Buffer.from(`${id}:${sec}`, 'utf8').toString('base64');
  const res = await fetch(u, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });
  const text = await res.text();
  let j;
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    return { err: 'Token response is not JSON', status: res.status, text: text.slice(0, 200) };
  }
  if (!res.ok || !j.access_token) {
    return { err: j.error_description || j.error || j.message || 'No access_token', status: res.status, raw: j };
  }
  const expMs = j.expires_in
    ? Date.now() + Math.max(0, (Number(j.expires_in) - 90) * 1000)
    : Date.now() + 25 * 60 * 1000;
  return { accessToken: String(j.access_token), expMs: Math.min(expMs, Date.now() + 50 * 60 * 1000) };
}

async function getToken(origin, id, sec) {
  if (_token.accessToken && Date.now() < _token.expMs) return { token: _token.accessToken };
  const r = await postClientCredentialsToken(origin, id, sec);
  if (r.err) {
    return { err: r.err, status: r.status, raw: r.raw };
  }
  _token = { accessToken: r.accessToken, expMs: r.expMs };
  return { token: r.accessToken };
}

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

  const { id, sec, origin, pathStr } = getEnv();
  if (!id || !sec) {
    res.status(503);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'Set NSW_FUEL_API_KEY and NSW_FUEL_API_SECRET in Vercel (Fuel API from api.nsw).',
      }),
    );
    return;
  }
  if (!pathStr.startsWith('/') || pathStr.includes('..')) {
    res.status(503);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'Set NSW_FUEL_PRICES_PATH to a path that starts with / (default /FuelPriceCheck/v1/fuel/prices).',
      }),
    );
    return;
  }

  const t = await getToken(origin, id, sec);
  if (t.err) {
    res.status(502);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-PetrolPrice-Proxy', 'nsw-fuel');
    res.end(
      JSON.stringify({
        error: 'NSW OAuth token failed',
        message: t.err,
        source: 'petrolprice-proxy',
        upstreamStatus: t.status,
      }),
    );
    return;
  }

  const target = new URL(pathStr, `${origin}/`);
  const fetchedAt = Date.now();

  try {
    const ures = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + t.token,
        Accept: 'application/json, */*;q=0.8',
        'user-agent': String(process.env.NSW_FUEL_USER_AGENT || 'petrolprice.xyz/1.0').trim(),
      },
      cache: 'no-store',
    });
    const text = await ures.text();
    res.setHeader('X-PetrolPrice-Proxy', 'nsw-fuel');
    if (!ures.ok) {
      res.status(ures.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      let body = { error: 'Upstream', status: ures.status, body: String(text).slice(0, 400) };
      try {
        if (text && text.trim().charAt(0) === '{') {
          const j = JSON.parse(text);
          if (j && j.message) body = { ...body, message: j.message, details: j };
        }
      } catch (_) {}
      res.end(JSON.stringify({ ...body, resolvedUrl: target.toString() }));
      return;
    }
    let json;
    try {
      json = text && text.trim() ? JSON.parse(text) : null;
    } catch (e) {
      res.status(502);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({ error: 'NSW response was not valid JSON', message: e && e.message, source: 'petrolprice-proxy' }),
      );
      return;
    }
    const { mins, stationCount, asOf } = extractMinsAndStations(json || {});

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200);
    res.end(
      JSON.stringify({
        ok: true,
        mins,
        stationCount,
        asOf: String(asOf || ''),
        fetchedAt,
        resolvedUrl: target.toString(),
        hint: Object.keys(mins).length ? undefined : 'Parsed JSON but no known FuelCode/price rows — response shape may differ; check /api/nsw-fuel and NSW docs.',
        source: 'petrolprice-proxy',
      }),
    );
  } catch (err) {
    res.status(502);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-PetrolPrice-Proxy', 'nsw-fuel');
    res.end(
      JSON.stringify({
        error: 'NSW request failed',
        message: err && err.message ? String(err.message) : 'unknown',
      }),
    );
  }
};
