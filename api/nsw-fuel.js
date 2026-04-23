/**
 * Vercel serverless proxy: NSW OneGov OAuth + TFNSW FuelCheck “all prices” (NSW only, v1).
 *
 * **Environment (Vercel — do not commit secrets)**
 * - `NSW_FUEL_API_KEY` and `NSW_FUEL_API_SECRET` — from api.nsw.gov.au (Fuel API product)
 *   (aliases: `NSW_FUEL_KEY`, `NSW_FUEL_SECRET` — same as `scripts/nsw-fuel-try.mjs`)
 * - `NSW_FUEL_PRICES_PATH` (optional) — must start with `/`, default `/FuelPriceCheck/v1/fuel/prices` (NSW only; v2 includes TAS)
 * - `NSW_FUEL_API_ORIGIN` (optional) — default `https://api.onegov.nsw.gov.au`
 * - `NSW_SKIP_FUEL_LOV` (optional) — if `1`, skip the reference-data `fuel/lovs` fetch (numeric `fuelType` → code mapping)
 *
 * Response: compact JSON `{ ok, mins, stationCount, asOf, fetchedAt }` so the browser is not
 * required to download multi‑MB station dumps.
 */
'use strict';

const { Buffer } = require('buffer');

const DEFAULT_ORIGIN = 'https://api.onegov.nsw.gov.au';
const TOKEN_PATH = '/oauth/client_credential/accesstoken';
const DEFAULT_PRICES = '/FuelPriceCheck/v1/fuel/prices';
const LOV_PATH = '/FuelCheckRefData/v1/fuel/lovs';

let _token = { accessToken: null, expMs: 0 };
let _lovIdToCode = { t: 0, map: null };
const LOV_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

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
 * Recursively find fuelTypeId (or id) + fuelCode pairs in LOV JSON (2MB+; structure varies by version).
 * @param {*} node
 * @param {Record<number, string>} out
 * @returns {Record<number, string>}
 */
function buildFuelTypeIdToCodeMap(node, out) {
  const acc = out || Object.create(null);
  if (node == null) return acc;
  if (Array.isArray(node)) {
    for (const it of node) buildFuelTypeIdToCodeMap(it, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  const id =
    node.fuelTypeId != null
      ? node.fuelTypeId
      : node.FuelTypeId != null
        ? node.FuelTypeId
        : node.fuelTypeID != null
          ? node.fuelTypeID
          : null;
  const code =
    node.fuelCode != null
      ? node.fuelCode
      : node.FuelCode != null
        ? node.FuelCode
        : node.fuelTypeCode != null
          ? node.fuelTypeCode
          : null;
  if (id != null && code != null) {
    const n = typeof id === 'string' && /^\d+$/.test(id) ? +id : typeof id === 'number' && Number.isFinite(id) ? id : NaN;
    if (Number.isFinite(n)) {
      const s = String(code)
        .trim()
        .replace(/\s+/g, '');
      if (s) acc[n] = s;
    }
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') buildFuelTypeIdToCodeMap(v, acc);
  }
  return acc;
}

/**
 * NSW payloads often use numeric fuelType IDs; map via LOV or skip.
 * @param {*} typeLike
 * @param {Record<number, string>|null|undefined} idToCode
 * @returns {string|null} VIC key
 */
function resolveNswFuelToVicKey(typeLike, idToCode) {
  if (typeLike == null) return null;
  if (typeof typeLike === 'number' && Number.isFinite(typeLike) && idToCode && idToCode[typeLike]) {
    return mapNswFuelCodeToVicKey(idToCode[typeLike]);
  }
  if (typeof typeLike === 'number' && Number.isFinite(typeLike)) {
    return null;
  }
  return mapNswFuelCodeToVicKey(typeLike);
}

/**
 * @param {Record<string, number|null>} mins
 * @param {*} typeLike
 * @param {*} priceRaw
 * @param {Record<number, string>|null} [idToCode]
 */
function consider(mins, typeLike, priceRaw, idToCode) {
  const vkey = resolveNswFuelToVicKey(typeLike, idToCode);
  if (!vkey) return;
  const aud = audPerLFromRaw(priceRaw);
  if (aud == null) return;
  minUpdate(mins, vkey, aud);
}

/**
 * @param {string} text
 * @param {Record<string, number>} mins
 * @param {Record<number, string>|null|undefined} idToCode
 */
function mergeMinsFromNswResponseText(text, mins, idToCode) {
  if (!text || text.length < 20) return;
  const re1 =
    /"(?:fuelCode|FuelCode)"\s*:\s*"([A-Z0-9][A-Z0-9]*)"[\s\S]{0,500}?"[Pp]rice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi;
  let m;
  while ((m = re1.exec(text)) !== null) {
    consider(mins, m[1], m[2], idToCode);
  }
  const re2 =
    /"fuelType"\s*:\s*([0-9]+)[\s\S]{0,500}?"[Pp]rice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi;
  while ((m = re2.exec(text)) !== null) {
    const id = +m[1];
    if (Number.isFinite(id)) consider(mins, id, m[2], idToCode);
  }
}

/**
 * @param {object} json
 * @param {Record<number, string>|null|undefined} [idToCode] — from `FuelCheckRefData/.../lovs` (numeric `fuelType` → `U91`, …)
 * @returns {{ mins: Record<string, number>, stationCount: number, asOf: string }}
 */
function extractMinsAndStations(json, idToCode) {
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
              : o.fuelTypeName != null
                ? o.fuelTypeName
                : o.FuelTypeName != null
                  ? o.FuelTypeName
                  : o.productCode != null
                    ? o.productCode
                    : o.fuel != null
                      ? o.fuel
                      : o.Fuel;
    const pr = o.price != null ? o.price : o.Price != null ? o.Price : o.unitPrice;
    if (pr != null && typ != null) {
      consider(mins, typ, pr, idToCode);
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
          if (pr != null && typ != null) consider(mins, typ, pr, idToCode);
        }
      }
    }

    for (const [k, v] of Object.entries(o)) {
      if (v == null) continue;
      if (
        (typeof v === 'number' || (typeof v === 'string' && /^\d/.test(String(v).trim()))) &&
        mapNswFuelCodeToVicKey(k)
      ) {
        consider(mins, k, v, idToCode);
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

/**
 * OneGov may accept `application/x-www-form-urlencoded` or `application/json` (see `scripts/nsw-fuel-try.mjs`).
 */
async function postClientCredentialsToken(origin, id, sec) {
  const u = new URL(TOKEN_PATH, `${origin}/`);
  const auth = 'Basic ' + Buffer.from(`${id}:${sec}`, 'utf8').toString('base64');
  const attempts = [
    {
      label: 'form',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    },
    {
      label: 'json',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    },
  ];

  let last = /** @type {{ err?: string, status?: number, text?: string, raw?: any }} | null} */ (null);
  for (const a of attempts) {
    const res = await fetch(u, {
      method: 'POST',
      headers: a.headers,
      body: a.body,
      cache: 'no-store',
    });
    const text = await res.text();
    let j;
    try {
      j = text ? JSON.parse(text) : {};
    } catch {
      last = { err: `${a.label}: token not JSON (HTTP ${res.status})`, status: res.status, text: text.slice(0, 200) };
      continue;
    }
    if (res.ok && j.access_token) {
      const expMs = j.expires_in
        ? Date.now() + Math.max(0, (Number(j.expires_in) - 90) * 1000)
        : Date.now() + 25 * 60 * 1000;
      return { accessToken: String(j.access_token), expMs: Math.min(expMs, Date.now() + 50 * 60 * 1000) };
    }
    last = {
      err: j.error_description || j.error || j.message || 'No access_token',
      status: res.status,
      raw: j,
    };
  }
  return { err: last && last.err ? last.err : 'No access_token', status: last && last.status, raw: last && last.raw };
}

/**
 * @param {string} origin
 * @param {string} token
 * @returns {Promise<Record<number, string>>}
 */
async function fetchLovIdToCodeMap(origin, token) {
  if (String(process.env.NSW_SKIP_FUEL_LOV || '').trim() === '1') {
    return _lovIdToCode && _lovIdToCode.map ? _lovIdToCode.map : Object.create(null);
  }
  const now = Date.now();
  if (_lovIdToCode.map && now - _lovIdToCode.t < LOV_CACHE_TTL_MS) {
    return _lovIdToCode.map;
  }
  try {
    const u = new URL(LOV_PATH, `${origin}/`);
    const lr = await fetch(u.toString(), {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!lr.ok) return Object.create(null);
    const lj = await lr.json();
    const map = buildFuelTypeIdToCodeMap(lj);
    _lovIdToCode = { t: now, map };
    return map;
  } catch (_) {
    return Object.create(null);
  }
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
  const idToCodeP = fetchLovIdToCodeMap(origin, t.token);

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
    const idToCode = await idToCodeP;
    let { mins, stationCount, asOf } = extractMinsAndStations(json || {}, idToCode);
    if (Object.keys(mins).length === 0 && text) {
      mergeMinsFromNswResponseText(text, mins, idToCode);
    }

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
        hint: Object.keys(mins).length
          ? undefined
          : 'Parsed JSON but no known FuelCode/price rows — response shape may differ; check /api/nsw-fuel and NSW docs.',
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
