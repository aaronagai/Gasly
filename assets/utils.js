/* Shared utility functions — loaded by index.html, terminal.html, app.html */

/** Parse a CSV string into an array of row objects keyed by header. */
function parseCSV(text) {
  const rows = text.trim().split('\n').map(r =>
    r.split(',').map(c => c.replace(/^"|"$/g, '').trim())
  );
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });
}

/** Parse a date cell to UTC milliseconds. Handles ISO YYYY-MM-DD, D/M/Y, and Date.parse fallback. */
function parseRowDateMs(v) {
  if (v == null || v === '') return NaN;
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s|$)/);
  if (dmy) {
    const d = +dmy[1], m = +dmy[2], y = +dmy[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return Date.UTC(y, m - 1, d);
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function sortRowsByDate(rows) {
  return (rows || []).slice().filter(r => r?.date).sort((a, b) => {
    const ta = parseRowDateMs(a.date);
    const tb = parseRowDateMs(b.date);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    if (Number.isFinite(ta)) return -1;
    if (Number.isFinite(tb)) return 1;
    return String(a.date).localeCompare(String(b.date));
  });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPerL(sym, n, decimals = 2) {
  const x = parseFloat(n);
  if (!Number.isFinite(x)) return '—';
  return `${sym} ${x.toFixed(decimals)}/L`;
}

// ── Geography helpers ────────────────────────────────────────────────────────

/**
 * Returns 'Semenanjung' or 'SabahSarawak' based on click coordinates.
 * Uses rough bounding boxes; good enough for map-click UX.
 */
function malaysiaRegionFromLngLat(lon, lat) {
  const PEN  = { minLon: 99.5,  maxLon: 104.95, minLat: 0.75, maxLat: 6.95 };
  const EAST = { minLon: 108.8, maxLon: 119.6,  minLat: 0.45, maxLat: 7.55 };
  const inPen  = lon >= PEN.minLon  && lon <= PEN.maxLon  && lat >= PEN.minLat  && lat <= PEN.maxLat;
  const inEast = lon >= EAST.minLon && lon <= EAST.maxLon && lat >= EAST.minLat && lat <= EAST.maxLat;
  if (inEast && !inPen) return 'SabahSarawak';
  if (inPen && !inEast) return 'Semenanjung';
  // Overlap or neither: use longitude as tiebreaker
  return lon >= 106.5 ? 'SabahSarawak' : 'Semenanjung';
}

/**
 * Returns the nearest Indonesian city name to given coordinates.
 * Falls back to 'Jakarta Pusat'. Requires ID_CITY_LONLAT from config.js.
 */
function indonesiaCityFromLngLat(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'Jakarta Pusat';
  let best = 'Jakarta Pusat';
  let bestD = Infinity;
  for (const [city, ll] of Object.entries(ID_CITY_LONLAT)) {
    const dx = lon - ll[0];
    const dy = lat - ll[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = city; }
  }
  return best;
}

// ── CSS helpers ──────────────────────────────────────────────────────────────

/** Read a CSS custom property value from :root, with a fallback. */
function cssVar(name, fallback = '') {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (_) {
    return fallback;
  }
}

// ── Color helpers ────────────────────────────────────────────────────────────

/**
 * Returns a color string with its alpha replaced by `a` (0–1).
 * Accepts #RGB, #RRGGBB, rgb(), rgba().
 */
function withAlpha(color, a) {
  if (!color) return color;
  const s = String(color).trim();
  if (/^rgba?\(/i.test(s)) {
    return s.replace(/^rgba?\(([^)]+)\)/i, (_, inner) => {
      const parts = inner.split(',').map(p => p.trim());
      if (parts.length < 3) return s;
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`;
    });
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    const hex = s.slice(1);
    const full = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  return s;
}

// ── Array helpers ────────────────────────────────────────────────────────────

/** Return the last `n` elements of `arr`. */
function takeLastN(arr, n) {
  return arr.slice(Math.max(0, arr.length - n));
}

/** Parse a value as a finite number, or return null. */
function asNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// ── Chart helpers ────────────────────────────────────────────────────────────

/**
 * Build chart dataset descriptors from sorted, labelled rows.
 * @param {object[]} rows      - Rows with a `__label` string field.
 * @param {{key:string, label:string, color?:string}[]} keys
 * @param {string[]} labels    - Ordered label strings (matches row.__label).
 * @param {number}   [colorOffset=0] - Starting index into CHART_COLORS.
 */
function buildChartSeries(rows, keys, labels, colorOffset = 0) {
  return keys.map((k, i) => ({
    label: k.label,
    color: k.color || CHART_COLORS[(colorOffset + i) % CHART_COLORS.length],
    data: labels.map(lab => {
      const r = rows.find(x => x.__label === lab);
      return r ? asNum(r[k.key]) : null;
    }),
  }));
}

// ── Data fetching ────────────────────────────────────────────────────────────

let _myRows = null;

/** Fetch and cache Malaysia fuel price rows from the official API. */
async function ensureMalaysiaRows() {
  if (_myRows) return _myRows;
  const res = await fetch(MY_API_URL);
  if (!res.ok) throw new Error(`Malaysia API ${res.status}`);
  const json = await res.json();
  _myRows = (json || []).filter(r => r.series_type === 'level');
  return _myRows;
}

const _sheetCache = new Map();

/** Fetch and cache a CSV Google Sheet by URL. */
async function ensureSheetRows(url) {
  if (_sheetCache.has(url)) return _sheetCache.get(url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet fetch ${res.status}`);
  const rows = parseCSV(await res.text());
  _sheetCache.set(url, rows);
  return rows;
}
