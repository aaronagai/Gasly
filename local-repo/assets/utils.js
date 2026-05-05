/* Shared utility functions — loaded by index.html, terminal.html, app.html */

/** Split one CSV line respecting quoted fields and "" escapes. */
function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQ = false;
        continue;
      }
      cur += c;
      continue;
    }
    if (c === '"') {
      inQ = true;
      continue;
    }
    if (c === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((c) => c.replace(/^"|"$/g, '').trim());
}

/** Map Google Sheet column titles to stable keys used by the app. */
function canonicalFuelHeader(h) {
  const raw = String(h).replace(/^\ufeff/g, '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase();
  if (/^area$/i.test(raw)) return 'area';
  if (/pricing\s*area/i.test(raw)) return 'area';
  if (/country varies|changes date|\bdate\b/i.test(raw) && !/update/i.test(raw)) return 'date';
  if (/indonesia.*city|region.*city/i.test(raw)) return 'city';
  if (/^province$/i.test(raw)) return 'province';
  if (/provider$/i.test(raw) || /daily provider/i.test(raw)) return 'provider';
  if (/brunei.*seasonally gasoline/i.test(raw) && !/premium/i.test(raw)) return 'gasoline';
  /* Indonesia: headers may include RON (e.g. "Pertalite 90") — map to stable row keys. */
  if (/^pertamax\s+turbo\b/i.test(raw)) return 'pertamax_turbo';
  if (/^pertamax\b/i.test(raw)) return 'pertamax';
  if (/^pertalite\b/i.test(raw)) return 'pertalite';
  if (/^dexlite\b/i.test(raw)) return 'dexlite';
  if (/^pertamina\s*dex\b/i.test(raw)) return 'pertamina_dex';
  const slug = low.replace(/\s+/g, '_');
  const known = new Set([
    'ron91', 'ron92', 'ron95', 'ron98', 'diesel', 'gasoline', 'premium', 'gasoline_premium',
    'vpower_gasoline', 'vpower_diesel',
    'pertalite', 'pertamax', 'pertamax_turbo', 'dexlite', 'pertamina_dex',
    'gasohol_91', 'gasohol_95', 'e20', 'e85',
    'kerosene',
    'gasoline_91', 'gasoline_95',
  ]);
  if (known.has(slug)) return slug;
  if (low === 'premium') return 'premium';
  return slug.replace(/[^a-z0-9_]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || slug;
}

/** Canonical column keys that hold numeric fuel prices (not date/city/provider). */
const FUEL_PRICE_HEADER_KEYS = new Set([
  'ron91', 'ron92', 'ron95', 'ron98', 'diesel', 'gasoline', 'premium', 'gasoline_premium',
  'vpower_gasoline', 'vpower_diesel',
  'pertalite', 'pertamax', 'pertamax_turbo', 'dexlite', 'pertamina_dex',
  'gasohol_91', 'gasohol_95', 'e20', 'e85',
  'kerosene',
  'gasoline_91', 'gasoline_95',
  'ron95_v', 'ron95_iii', 'ron92_ii', 'diesel_euro5', 'diesel_euro2', 'premium_diesel',
]);

/**
 * Find header row when the sheet has title rows above the real columns.
 * Indonesia tabs often omit the word "diesel" (Dexlite / Pertamina Dex only), so we
 * score rows by canonical fuel columns instead of requiring a diesel substring match.
 */
/**
 * Currency tab may have a title row above the real header. Prefer a row that has `country_name` + `fx_rate`.
 */
function detectCurrencyHeaderRowIndex(lineArrays) {
  for (let i = 0; i < Math.min(20, lineArrays.length); i++) {
    const cells = lineArrays[i];
    if (!cells || cells.length < 2) continue;
    const canon = cells.map(canonicalFuelHeader);
    const hasCountry = canon.some((k) => k === 'country_name' || k === 'country');
    const hasRate = canon.some(
      (k) =>
        k === 'fx_rate' ||
        k === 'to_usd' ||
        (k && (/^fx_?rate$/i.test(k) || /^rate$/i.test(k))),
    );
    if (hasCountry && hasRate) return i;
  }
  return 0;
}

function detectHeaderRowIndex(lineArrays) {
  let bestIdx = 0;
  let bestFuelCols = -1;
  for (let i = 0; i < Math.min(25, lineArrays.length); i++) {
    const cells = lineArrays[i];
    if (!cells || cells.length < 4) continue;
    const canon = cells.map(canonicalFuelHeader);
    const hasDate = canon.includes('date');
    let fuelCols = 0;
    for (const k of canon) {
      if (k && FUEL_PRICE_HEADER_KEYS.has(k)) fuelCols++;
    }
    if (hasDate && fuelCols >= 2 && fuelCols > bestFuelCols) {
      bestFuelCols = fuelCols;
      bestIdx = i;
    }
  }
  if (bestFuelCols >= 0) return bestIdx;
  return 0;
}

/** Normalize sheet text for comparisons (BOM, NBSP, repeated spaces). */
function normalizeSheetString(s) {
  return String(s == null ? '' : s)
    .replace(/^\ufeff/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Singapore sheet: one date row then provider rows with blank date (and sometimes blank provider).
 * Forward-fill date and provider so each row is keyed for filtering by provider.
 */
function normalizeSingaporeSheetRows(rows) {
  if (!rows || !rows.length) return [];
  let curDate = '';
  let curProvider = '';
  const filled = rows.map((r) => {
    /* Singapore (and HK) sheets sometimes export with a blank header in column A.
       In that case `parseCSV` will name it `col_0` even though it holds the date. */
    const rawDate =
      r.date != null
        ? r.date
        : r.col_0 != null
          ? r.col_0
          : r.p != null
            ? r.p
            : '';
    const d = rawDate != null ? String(rawDate).trim() : '';
    if (d) curDate = d;
    const p = r.provider != null ? String(r.provider).trim() : '';
    if (p) curProvider = p;
    return { ...r, date: curDate, provider: curProvider };
  });
  return filled.filter((r) => normalizeSheetString(r.date) && normalizeSheetString(r.provider));
}

/**
 * Myanmar sheet: one `date` cell per update block, then many `region` rows with a blank date.
 * Forward-fill `date` so rows can be filtered by region and sorted for charts / pager.
 */
function normalizeMyanmarSheetRows(rows) {
  if (!rows || !rows.length) return [];
  let curDate = '';
  const filled = rows.map((r) => {
    /* Sheet header may be `p` or `date` depending on how the tab was last edited. */
    const raw = r.date != null ? r.date : r.p;
    const d = raw != null ? String(raw).trim() : '';
    if (d) curDate = d;
    return { ...r, date: curDate };
  });
  return filled.filter((r) => normalizeSheetString(r.date) && normalizeSheetString(r.region));
}

/** Area / subnational key from a Vietnam sheet row (header aliases + `area_2` duplicate keys). */
function rowVietnamAreaKey(row) {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row).sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    if (!/^(area(_[0-9]+)?|pricing_area|zone|location)$/i.test(k)) continue;
    const s = normalizeSheetString(row[k]);
    if (s) return s;
  }
  return '';
}

/**
 * Canonical sheet key for Vietnam `area` (e.g. `Area 1`, `AREA-2`, `area_1` → `area_1`).
 * Non-matching names (custom region labels) pass through `normalizeSheetString`.
 */
function canonVietnamAreaKey(raw) {
  const s = normalizeSheetString(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m = /^area\s*[_-]?\s*(\d+)$/.exec(s);
  if (m) return `area_${m[1]}`;
  return normalizeSheetString(raw);
}

/** Copy rows with a single stable `area` field for filtering, charts, and search. */
function normalizeVietnamSheetRows(rows) {
  if (!rows || !rows.length) return [];
  return rows.map((r) => {
    const merged = rowVietnamAreaKey(r) || normalizeSheetString(r.area);
    const canon = canonVietnamAreaKey(merged);
    const a = canon || merged;
    return { ...r, area: a };
  });
}

/** Unique provider names from normalized Singapore rows, sorted for stable cycling. */
function sortedSingaporeProviders(rows) {
  const set = new Set();
  for (const r of rows || []) {
    const p = normalizeSheetString(r.provider);
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Pick stored provider from localStorage if it exists in the sheet; else first sorted name. */
function resolveSingaporeProviderSelection(rows) {
  const list = sortedSingaporeProviders(rows);
  if (!list.length) return '';
  let stored = '';
  try {
    stored = typeof localStorage !== 'undefined' ? (localStorage.getItem('terminal_sg_provider') || '') : '';
  } catch (_) {
    stored = '';
  }
  const w = normalizeSheetString(stored);
  const hit = list.find((p) => normalizeSheetString(p) === w);
  return hit || list[0];
}

/** Hong Kong sheet uses the same `provider` column pattern as Singapore; storage key is separate. */
function resolveHongKongProviderSelection(rows) {
  const list = sortedSingaporeProviders(rows);
  if (!list.length) return '';
  let stored = '';
  try {
    stored = typeof localStorage !== 'undefined' ? (localStorage.getItem('terminal_hk_provider') || '') : '';
  } catch (_) {
    stored = '';
  }
  const w = normalizeSheetString(stored);
  const hit = list.find((p) => normalizeSheetString(p) === w);
  return hit || list[0];
}

/**
 * Legacy: one row per date with mean prices across providers (when the sheet has no provider column).
 */
function aggregateSingaporeProviderRows(rows) {
  if (!rows || !rows.length) return [];
  let curDate = '';
  const filled = rows.map((r) => {
    const cell = r.date != null ? String(r.date).trim() : '';
    if (cell) curDate = cell;
    return { ...r, date: curDate };
  });
  const byDate = new Map();
  for (const r of filled) {
    const d = r.date && String(r.date).trim();
    if (!d) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  }
  function avg(group, key) {
    const nums = group.map((x) => parseFloat(x[key])).filter((n) => Number.isFinite(n));
    if (!nums.length) return '';
    const v = nums.reduce((a, b) => a + b, 0) / nums.length;
    return (Math.round(v * 1000) / 1000).toString();
  }
  const keys = ['ron92', 'ron95', 'ron98', 'diesel'];
  const out = [];
  for (const [date, group] of byDate) {
    const row = { date };
    for (const k of keys) row[k] = avg(group, k);
    out.push(row);
  }
  out.sort((a, b) => parseRowDateMs(a.date) - parseRowDateMs(b.date));
  return out;
}

/**
 * Parse a CSV string into an array of row objects keyed by canonical header names.
 * @param {string} text
 * @param {{ headerRowIndex?: number }} [options] - optional fixed header line index; omit to auto-detect.
 */
function parseCSV(text, options = {}) {
  const rawLines = text.trim().split(/\r?\n/).filter((ln) => ln.length > 0);
  const lineArrays = rawLines.map(splitCSVLine);
  if (!lineArrays.length) return [];

  let headerRowIndex = options.headerRowIndex;
  if (!Number.isInteger(headerRowIndex) || headerRowIndex < 0) {
    headerRowIndex = detectHeaderRowIndex(lineArrays);
  }
  if (lineArrays.length <= headerRowIndex) return [];

  const rawHeaders = lineArrays[headerRowIndex];
  const headers = rawHeaders.map(canonicalFuelHeader);
  const used = Object.create(null);
  const uniqueHeaders = headers.map((h, i) => {
    let key = h || `col_${i}`;
    if (used[key]) {
      let n = 2;
      while (used[`${key}_${n}`]) n++;
      key = `${key}_${n}`;
    }
    used[key] = true;
    return key;
  });

  return lineArrays.slice(headerRowIndex + 1)
    .map((cells) => {
      const obj = {};
      uniqueHeaders.forEach((key, i) => {
        if (!key) return;
        obj[key] = cells[i];
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v != null && String(v).trim() !== ''));
}

/** Parse a date cell to UTC milliseconds. Handles ISO YYYY-MM-DD, D/M/Y, Sheets serial days, and Date.parse fallback. */
function parseRowDateMs(v) {
  if (v == null || v === '') return NaN;
  const s = String(v).trim();
  // Google Sheets CSV often exports dates as serial day counts from 1899-12-30 (UTC).
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    if (n >= 35000 && n <= 65000) {
      return Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000;
    }
  }
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

/**
 * Pick the highlight row with the latest parseable date (tie: last in array).
 * Prev is the nearest row with a strictly older date for week-on-week deltas.
 */
function selectLatestHighlightRow(sortedAsc) {
  const rows = sortedAsc || [];
  if (!rows.length) return { row: {}, prev: null };

  let bestMs = -Infinity;
  let bestI = -1;
  for (let i = 0; i < rows.length; i++) {
    const t = parseRowDateMs(rows[i].date);
    if (Number.isFinite(t) && t >= bestMs) {
      bestMs = t;
      bestI = i;
    }
  }
  if (bestI < 0) {
    const row = rows[rows.length - 1] || {};
    return { row, prev: rows.length >= 2 ? rows[rows.length - 2] : null };
  }

  const row = rows[bestI];
  let prev = null;
  for (let j = bestI - 1; j >= 0; j--) {
    const t = parseRowDateMs(rows[j].date);
    if (Number.isFinite(t) && t < bestMs) {
      prev = rows[j];
      break;
    }
  }
  return { row, prev };
}

/** Format a row's date for UI; uses parsed instant so Sheets serials match the sheet. */
function fmtDateFromRow(r) {
  if (!r || r.date == null || String(r.date).trim() === '') return '—';
  const t = parseRowDateMs(r.date);
  if (Number.isFinite(t)) {
    return new Date(t).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return fmtDate(r.date);
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * en-US style with comma thousands (e.g. 1,234,567.89).
 * Sanitizes fraction-digit args: NaN would reach toLocaleString and throw RangeError.
 * @param {number} n
 * @param {number} [minFractionDigits=0]
 * @param {number} [maxFractionDigits] defaults to minFractionDigits
 */
function formatNumberCommas(n, minFractionDigits = 0, maxFractionDigits) {
  try {
    if (!Number.isFinite(n)) return '';
    let min = Number(minFractionDigits);
    let max = maxFractionDigits != null ? Number(maxFractionDigits) : min;
    if (!Number.isFinite(min) || min < 0) min = 0;
    if (!Number.isFinite(max) || max < 0) max = 0;
    if (min > max) max = min;
    min = Math.min(20, Math.floor(min));
    max = Math.min(20, Math.floor(max));
    /* Omit useGrouping — en-US still groups thousands; avoids rare engine issues. */
    return n.toLocaleString('en-US', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
  } catch (_) {
    try {
      const x = Number(n);
      if (!Number.isFinite(x)) return '';
      return String(x);
    } catch (__) {
      return '';
    }
  }
}

function fmtPerL(sym, n, decimals = 2) {
  const x = parseFloat(String(n == null ? '' : n).replace(/,/g, '').trim());
  if (!Number.isFinite(x)) return '—';
  const dec =
    Number.isFinite(decimals) && decimals >= 0 ? Math.min(20, Math.floor(decimals)) : 2;
  return `${sym} ${formatNumberCommas(x, dec, dec)}/L`;
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

/**
 * Nearest Lao province name for map clicks. Requires LA_PROVINCE_LONLAT from config.js.
 */
function laosProvinceFromLngLat(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'Vientiane Capital';
  let best = 'Vientiane Capital';
  let bestD = Infinity;
  for (const [prov, ll] of Object.entries(LA_PROVINCE_LONLAT)) {
    const dx = lon - ll[0];
    const dy = lat - ll[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = prov;
    }
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

/**
 * From date-sorted ascending rows, keep rows whose date falls within the lookback window
 * ending at the newest row (see CHART_HISTORY_LOOKBACK_DAYS in config.js, default 90 days).
 */
function rowsForPriceChart(sortedAsc) {
  const rows = sortedAsc || [];
  if (!rows.length) return [];
  const days =
    typeof CHART_HISTORY_LOOKBACK_DAYS === 'number' && CHART_HISTORY_LOOKBACK_DAYS > 0
      ? CHART_HISTORY_LOOKBACK_DAYS
      : 90;
  let endMs = NaN;
  for (let i = rows.length - 1; i >= 0; i--) {
    const t = parseRowDateMs(rows[i].date);
    if (Number.isFinite(t)) {
      endMs = t;
      break;
    }
  }
  if (!Number.isFinite(endMs)) return rows;
  const startMs = endMs - days * 86400000;
  return rows.filter((r) => {
    const t = parseRowDateMs(r.date);
    return Number.isFinite(t) && t >= startMs;
  });
}

/** Parse a value as a finite number, or return null. */
function asNum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse sheet/CSV numbers that may include commas, NBSP, or a leading currency symbol.
 */
function asNumSheetCell(v) {
  if (v == null || v === '') return null;
  let s = String(v)
    .replace(/^\ufeff/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/,/g, '')
    .trim();
  s = s
    .replace(/^\s*RM\s*/i, '')
    .replace(/^\s*S\$\s*/i, '')
    .replace(/^\s*[$€£¥]\s*/, '')
    .replace(/\s*USD\s*$/i, '')
    .trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Currency tab `fx_rate` must be the **multiplier** such that: `local_price_per_L × rate = USD_per_L`
 * (i.e. **USD per 1 unit of local currency**).
 *
 * People often paste **local currency per 1 USD** (e.g. 4.2 MYR/$, 1.35 SGD/$, 17000 IDR/$). For every
 * SEA currency we support, the correct multiplier is **strictly below 1** (IDR/VND/etc. are tiny positives).
 * So any value **≥ 1** is treated as “per USD” and inverted. (Avoids missing 1.2–1.5 SGD/USD with the old `> 1.6` rule.)
 */
function normalizeCurrencySheetMultiplier(ccy, v) {
  if (v == null || !Number.isFinite(v) || v <= 0) return v;
  const sea = new Set(['MYR', 'SGD', 'BND', 'IDR', 'THB', 'PHP', 'KHR', 'LAK', 'MMK', 'VND']);
  if (!sea.has(ccy)) return v;
  if (v >= 1) return 1 / v;
  return v;
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

/**
 * Chart.js y-axis tick for price/L series. Matches highlight conventions: `$` + 2dp in USD highlight mode;
 * `ISO value` in local mode for BND/MYR/SGD/etc.; compact `IDR …k` / `IDR …M` for Indonesia.
 *
 * @param {unknown} tickValue
 * @param {{ usdMode?: boolean, countryId?: number|null, isoCurrency?: string|null }} [opts]
 * @returns {string|unknown}
 */
function formatPriceChartYTick(tickValue, opts) {
  const n = Number(tickValue);
  if (!Number.isFinite(n)) return tickValue;

  const usdMode = !!opts?.usdMode;
  const countryId = opts?.countryId ?? null;
  const rawIso = opts?.isoCurrency;
  const iso =
    rawIso != null && String(rawIso).trim() ? String(rawIso).trim().toUpperCase() : null;

  if (usdMode) {
    return `$${formatNumberCommas(n, 2, 2)}`;
  }

  if (countryId === 360) {
    if (n >= 1e6) return `IDR ${formatNumberCommas(n / 1e6, 1, 1)}M`;
    return `IDR ${formatNumberCommas(Math.round(n / 1000), 0, 0)}k`;
  }

  if (countryId === 116 || countryId === 418 || countryId === 104 || countryId === 704) {
    let core;
    if (Math.abs(n) >= 1e6) core = `${formatNumberCommas(n / 1e6, 1, 1)}M`;
    else if (Math.abs(n) >= 1000) core = `${formatNumberCommas(Math.round(n / 1000), 0, 0)}k`;
    else core = formatNumberCommas(Math.round(n), 0, 0);
    return iso ? `${iso} ${core}` : core;
  }

  if (countryId === 344 || countryId === 801 || countryId === 802) {
    const core = formatNumberCommas(parseFloat(n.toFixed(2)), 2, 2);
    return iso ? `${iso} ${core}` : core;
  }

  if (countryId == null) {
    return formatNumberCommas(parseFloat(n.toFixed(2)), 2, 2);
  }

  const core = formatNumberCommas(parseFloat(n.toFixed(2)), 2, 2);
  return iso ? `${iso} ${core}` : core;
}

// ── Data fetching ────────────────────────────────────────────────────────────

let _myRows = null;

/**
 * Fetch Malaysia fuel price rows from data.gov.my (`series_type` === level).
 * Does not cache an empty array — `[]` is truthy in JS and would otherwise block retries forever.
 */
async function ensureMalaysiaRows() {
  if (_myRows && _myRows.length) return _myRows;
  const res = await fetch(MY_API_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Malaysia API ${res.status}`);
  const json = await res.json();
  const raw = Array.isArray(json)
    ? json
    : json && Array.isArray(json.data)
      ? json.data
      : json && Array.isArray(json.results)
        ? json.results
        : [];
  const rows = raw.filter(
    (r) => r && String(r.series_type || '').toLowerCase() === 'level',
  );
  if (rows.length) _myRows = rows;
  return rows;
}

const _sheetCache = new Map();
/** In-memory sheet cache TTL so highlights can pick up newer Google Sheet rows without a full reload. */
const SHEET_CACHE_TTL_MS = 30 * 1000;
/** FX tab should refresh quickly after you edit rates in the sheet. */
const CURRENCY_SHEET_CACHE_TTL_MS = 5 * 1000;

let _overviewByIdCache = null;
let _overviewByIdCacheT = 0;

function overviewCell(row, key) {
  if (!row || !key) return '';
  const v = row[key];
  if (v == null) return '';
  return String(v).replace(/^\ufeff/g, '').trim();
}

function overviewPairFromRow(row, kKey, vKey) {
  const k = overviewCell(row, kKey);
  const v = overviewCell(row, vKey);
  if (!k && !v) return null;
  return [k || '—', v || '—'];
}

/**
 * Resolve numeric `COUNTRIES` id from an Overviews row: `country_id` if set, else match `country_name` / `country`.
 */
function resolveOverviewCountryId(row) {
  const rawId = overviewCell(row, 'country_id') || overviewCell(row, 'id');
  if (rawId) {
    const id = parseInt(rawId, 10);
    if (Number.isFinite(id) && id > 0 && typeof COUNTRIES !== 'undefined' && COUNTRIES[id]) return id;
  }
  const nameRaw =
    overviewCell(row, 'country_name') ||
    overviewCell(row, 'country') ||
    overviewCell(row, 'name');
  if (!nameRaw || typeof COUNTRIES === 'undefined') return null;
  const want = normalizeSheetString(nameRaw).toLowerCase();
  for (const [idStr, meta] of Object.entries(COUNTRIES)) {
    const id = +idStr;
    if (!Number.isFinite(id) || !meta?.name || meta.searchGroupOnly) continue;
    if (normalizeSheetString(meta.name).toLowerCase() === want) return id;
  }
  return null;
}

/** True when the row uses the flat `bopd` / `1p_reserves` / … sheet shape (vs legacy `row1_left_k`). */
function hasFlatOverviewShape(row) {
  const keys = ['bopd', '1p_reserves', 'ref_intake', 'export_value', 'import_value', 'status'];
  return keys.some((k) => !!overviewCell(row, k));
}

/**
 * Map flat sheet columns to the same `metricRows` grid as `COUNTRY_OVERVIEW_FALLBACK` (two columns × up to four bands).
 */
function metricRowsFromFlatOverviewRow(row) {
  const pair = (keys, label) => {
    for (let i = 0; i < keys.length; i++) {
      const v = overviewCell(row, keys[i]);
      if (v) return [label, v];
    }
    return null;
  };

  const refineryMiddle = () => {
    const cap = overviewCell(row, 'refinery_capacity');
    if (cap) return ['Refinery Capacity', cap];
    const v =
      overviewCell(row, 'ref_intake') ||
      overviewCell(row, 'refinery_intake');
    if (v) return ['Refinery Intake', v];
    return null;
  };

  const out = [];
  // Match the Overviews sheet convention (ASCII hyphen) when padding an empty BOPD / 1P cell.
  const emptyMetric = '-';
  let r1l = pair(['bopd'], 'BOPD');
  let r1r = pair(['1p_reserves'], '1P Reserves');
  // Stable two-up grid: blank sheet cell → same placeholder editors use in the sheet.
  if (r1r && !r1l) r1l = ['BOPD', emptyMetric];
  if (r1l && !r1r) r1r = ['1P Reserves', emptyMetric];
  if (r1l || r1r) out.push([r1l, r1r]);

  const r2l = refineryMiddle();
  if (r2l) out.push([r2l, null]);

  const r3l = pair(['export_value'], 'Export Value');
  const r3r = pair(['import_value'], 'Import Value');
  if (r3l || r3r) out.push([r3l, r3r]);

  const r4l = pair(['status'], 'Status');
  if (r4l) out.push([r4l, null]);

  return out;
}

/**
 * Build `Map<countryId, { oilContext, metricRows }>` from `Overviews` tab rows (see OVERVIEW_SHEET_URL in config).
 * Supports flat columns (`bopd`, …) or legacy `row1_left_k` / `row1_left_v` / …
 */
function parseCountryOverviewSheetRows(rows) {
  const byId = new Map();
  for (const r of rows || []) {
    const id = resolveOverviewCountryId(r);
    if (id == null) continue;
    const oilContext = overviewCell(r, 'oil_context');
    let metricRows;
    if (hasFlatOverviewShape(r)) {
      metricRows = metricRowsFromFlatOverviewRow(r);
    } else {
      metricRows = [];
      for (let i = 1; i <= 4; i++) {
        const left = overviewPairFromRow(r, `row${i}_left_k`, `row${i}_left_v`);
        const right = overviewPairFromRow(r, `row${i}_right_k`, `row${i}_right_v`);
        if (!left && !right) continue;
        metricRows.push([left, right]);
      }
    }
    byId.set(id, { oilContext, metricRows });
  }
  return byId;
}

function mergeCountryOverview(fallback, sheet) {
  const fb = fallback || { oilContext: '—', metricRows: [] };
  if (!sheet) return fb;
  const oilFromSheet = sheet.oilContext != null && String(sheet.oilContext).trim() !== ''
    ? String(sheet.oilContext).trim()
    : '';
  const oilContext = oilFromSheet || fb.oilContext;
  const sheetRows = Array.isArray(sheet.metricRows) ? sheet.metricRows : [];
  const hasAnyMetric = sheetRows.some((row) => {
    if (!Array.isArray(row)) return false;
    const hasCell = (cell) => {
      if (!cell) return false;
      const a = cell[0] != null && String(cell[0]).trim() !== '';
      const b = cell[1] != null && String(cell[1]).trim() !== '';
      return a || b;
    };
    return hasCell(row[0]) || hasCell(row[1]);
  });
  const metricRows = hasAnyMetric ? sheetRows : (fb.metricRows || []);
  return { oilContext, metricRows };
}

/** Fetch + parse the `Overviews` sheet; row 0 must be headers. Cached with same TTL as price sheets. */
async function ensureCountryOverviewMapFromSheet() {
  const now = Date.now();
  if (_overviewByIdCache && now - _overviewByIdCacheT < SHEET_CACHE_TTL_MS) {
    return _overviewByIdCache;
  }
  const url = typeof OVERVIEW_SHEET_URL === 'string' ? OVERVIEW_SHEET_URL.trim() : '';
  if (!url) {
    _overviewByIdCache = new Map();
    _overviewByIdCacheT = now;
    return _overviewByIdCache;
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Overview sheet ${res.status}`);
  const rows = parseCSV(await res.text(), { headerRowIndex: 0 });
  const map = parseCountryOverviewSheetRows(rows);
  _overviewByIdCache = map;
  _overviewByIdCacheT = now;
  return map;
}

/**
 * Overview for one country: merges sheet + `COUNTRY_OVERVIEW_FALLBACK` when the sheet has data;
 * if the sheet loads but the row has no copy/metrics, falls back to `COUNTRY_OVERVIEW_FALLBACK` when defined.
 * `COUNTRY_OVERVIEW_UNAVAILABLE` only when the sheet cannot be fetched or there is no in-code fallback.
 */
async function getCountryOverview(countryId) {
  const id = +countryId;
  const unav =
    typeof COUNTRY_OVERVIEW_UNAVAILABLE !== 'undefined'
      ? COUNTRY_OVERVIEW_UNAVAILABLE
      : { oilContext: 'Unavailable', metricRows: [[['Metrics', 'Unavailable'], null]] };

  function sheetHasUsableContent(sheet) {
    if (!sheet) return false;
    const hasOil = sheet.oilContext != null && String(sheet.oilContext).trim() !== '';
    const rows = sheet.metricRows;
    const hasMetrics =
      Array.isArray(rows) &&
      rows.some((row) => {
        if (!Array.isArray(row)) return false;
        const hasCell = (cell) => {
          if (!cell) return false;
          const a = cell[0] != null && String(cell[0]).trim() !== '';
          const b = cell[1] != null && String(cell[1]).trim() !== '';
          return a || b;
        };
        return hasCell(row[0]) || hasCell(row[1]);
      });
    return hasOil || hasMetrics;
  }

  try {
    const m = await ensureCountryOverviewMapFromSheet();
    const sheet = m.get(id);
    const fallbackEntry =
      typeof COUNTRY_OVERVIEW_FALLBACK !== 'undefined' ? COUNTRY_OVERVIEW_FALLBACK[id] : undefined;
    const fb = fallbackEntry || { oilContext: '—', metricRows: [] };
    if (sheetHasUsableContent(sheet)) return mergeCountryOverview(fb, sheet);
    if (fallbackEntry) return fallbackEntry;
    return unav;
  } catch (_) {
    return unav;
  }
}

/**
 * Country / state (region) label layers to keep visible when suppressing other map text.
 * Positron (remote): label_country_*, label_state. Dark fork: place_country_*, place_state.
 */
function openFreeMapKeepCountryRegionLabelLayer(layerId) {
  if (!layerId || typeof layerId !== 'string') return false;
  if (/^label_country_[123]$/.test(layerId)) return true;
  if (layerId === 'label_state') return true;
  if (layerId === 'place_state') return true;
  if (/^place_country_/.test(layerId)) return true;
  return false;
}

/**
 * Turn off basemap text (roads, water labels, cities, route shields).
 * By default keeps country + admin-region names; set `hideCountryRegionLabels: true` to hide those too
 * (e.g. index hero map).
 * Symbol layers without text-field (e.g. one-way arrows) stay visible.
 * Works with OpenFreeMap Positron, Dark fork, and similar OpenMapTiles styles.
 */
function suppressOpenFreeMapTextLabels(map, options) {
  if (!map || typeof map.getStyle !== 'function') return;
  const hideCountryRegion =
    options && typeof options === 'object' && options.hideCountryRegionLabels === true;
  let layers;
  try {
    layers = map.getStyle().layers;
  } catch (_) {
    return;
  }
  if (!layers || !layers.length) return;
  for (let i = 0; i < layers.length; i++) {
    const def = layers[i];
    if (!def || def.type !== 'symbol') continue;
    const tf = def.layout && def.layout['text-field'];
    if (tf == null || tf === '') continue;
    if (!hideCountryRegion && openFreeMapKeepCountryRegionLabelLayer(def.id)) continue;
    try {
      if (map.getLayer(def.id)) map.setLayoutProperty(def.id, 'visibility', 'none');
    } catch (_) {}
  }
}

/**
 * OpenFreeMap Positron filters out maritime boundary segments (`maritime == 1`), so shelf/EEZ-style
 * lines in the ocean only appear in styles that omit that filter (e.g. our dark fork). Relax the
 * filter on Positron’s boundary layers so light mode matches.
 */
function includeOpenFreeMapMaritimeBoundaries(map) {
  if (!map || typeof map.getLayer !== 'function' || typeof map.setFilter !== 'function') return;
  const patches = [
    {
      id: 'boundary_2',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'disputed'], 1], ['!', ['has', 'claimed_by']]],
    },
    {
      id: 'boundary_3',
      filter: [
        'all',
        ['>=', ['get', 'admin_level'], 3],
        ['<=', ['get', 'admin_level'], 6],
        ['!=', ['get', 'disputed'], 1],
        ['!', ['has', 'claimed_by']],
      ],
    },
    {
      id: 'boundary_disputed',
      filter: ['==', ['get', 'disputed'], 1],
    },
  ];
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    try {
      if (!map.getLayer(p.id)) continue;
      map.setFilter(p.id, p.filter);
    } catch (_) {}
  }
}

/**
 * Warm orange-tinted land for OpenFreeMap Positron / dark fork (OpenMapTiles).
 * Skips water fills and layers that use fill-pattern (e.g. wood). Safe to call after style load.
 */
function applyOpenFreeMapOrangeLand(map) {
  if (!map || typeof map.getStyle !== 'function') return;
  let layers;
  try {
    layers = map.getStyle().layers;
  } catch (_) {
    return;
  }
  if (!layers || !layers.length) return;

  let dark = false;
  try {
    dark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_) {}

  const C = dark
    ? {
        bg: '#5c280e',
        land: '#d47a1a',
        building: '#9a5010',
        pier: '#5c280e',
        ice: '#6a5248',
        outlineBuilding: '#ff9f40',
      }
    : {
        /* Red-orange (hue ~14–20°), not golden/yellow (~40°) */
        bg: '#f47e4f',
        land: '#e66321',
        building: '#e8662e',
        pier: '#f47e4f',
        ice: '#fff0ea',
        outlineBuilding: '#c24100',
      };

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!layer || !layer.id) continue;
    try {
      if (!map.getLayer(layer.id)) continue;
    } catch (_) {
      continue;
    }

    if (layer.type === 'background') {
      try {
        map.setPaintProperty(layer.id, 'background-color', C.bg);
      } catch (_) {}
      continue;
    }

    if (layer.type === 'raster' && layer.id === 'ne2_shaded') {
      try {
        map.setPaintProperty(layer.id, 'raster-hue-rotate', dark ? 42 : 28);
        map.setPaintProperty(layer.id, 'raster-saturation', dark ? 0 : 0.02);
      } catch (_) {}
      continue;
    }

    if (layer.type !== 'fill') continue;

    const sl = layer['source-layer'];
    if (sl === 'water') continue;

    const paint = layer.paint || {};
    if (paint['fill-pattern']) continue;

    let color = C.land;
    const id = layer.id;
    if (id === 'landcover_ice_shelf' || id === 'landcover_glacier') color = C.ice;
    else if (sl === 'building') color = C.building;
    else if (id === 'road_area_pier' || (typeof id === 'string' && id.indexOf('pier') !== -1)) color = C.pier;

    try {
      map.setPaintProperty(layer.id, 'fill-color', color);
    } catch (_) {}

    if (sl === 'building') {
      try {
        map.setPaintProperty(layer.id, 'fill-outline-color', C.outlineBuilding);
      } catch (_) {}
    }
  }

  /* Admin boundaries: higher contrast on orange-tinted land (line layers, not affected by label suppression). */
  const boundaryLineColor = dark ? 'rgba(255, 212, 180, 0.78)' : '#6b6b6b';
  for (let j = 0; j < layers.length; j++) {
    const layer = layers[j];
    if (!layer || layer.type !== 'line' || !layer.id) continue;
    if (typeof layer.id !== 'string' || layer.id.indexOf('boundary') === -1) continue;
    try {
      if (!map.getLayer(layer.id)) continue;
      map.setPaintProperty(layer.id, 'line-color', boundaryLineColor);
    } catch (_) {}
  }
}

/**
 * Apply FX multipliers from the `Currency` sheet into `USD_RATES` (mutates in place).
 * Supported layout: rows with `country_name` (or `country` / `name`) and `fx_rate` (local × rate → USD).
 * Also accepts a wide row whose column headers are ISO codes (MYR, SGD, …).
 * @returns {number} number of currency codes updated
 */
function mergeCurrencySheetRowsIntoUsdRates(rows, usdRates) {
  if (!usdRates || typeof usdRates !== 'object') return 0;
  const NAME_TO_CCY = new Map([
    ['malaysia', 'MYR'],
    ['singapore', 'SGD'],
    ['brunei', 'BND'],
    ['indonesia', 'IDR'],
    ['thailand', 'THB'],
    ['philippines', 'PHP'],
    ['vietnam', 'VND'],
    ['myanmar', 'MMK'],
    ['cambodia', 'KHR'],
    ['laos', 'LAK'],
    ['victoria', 'AUD'],
    ['australia', 'AUD'],
    ['newsouthwales', 'AUD'],
    ['hongkong', 'HKD'],
  ]);
  const CCY_CODES = ['MYR', 'SGD', 'HKD', 'BND', 'IDR', 'THB', 'PHP', 'KHR', 'LAK', 'MMK', 'VND', 'AUD'];

  function normName(s) {
    return normalizeSheetString(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  /** Labels like "Peninsular Malaysia" → `peninsularmalaysia`; still map to MYR. */
  function resolveCcyFromCountryName(nk) {
    if (!nk) return null;
    let c = NAME_TO_CCY.get(nk);
    if (c) return c;
    if (nk === 'my' || nk.endsWith('malaysia')) return 'MYR';
    if (nk === 'sg' || nk.endsWith('singapore')) return 'SGD';
    if (nk.endsWith('brunei')) return 'BND';
    if (nk.endsWith('indonesia')) return 'IDR';
    if (nk.endsWith('thailand')) return 'THB';
    if (nk.endsWith('philippines')) return 'PHP';
    if (nk.endsWith('vietnam')) return 'VND';
    if (nk.endsWith('myanmar')) return 'MMK';
    if (nk.endsWith('cambodia')) return 'KHR';
    if (nk.endsWith('laos')) return 'LAK';
    if (nk === 'au' || nk.endsWith('australia') || nk === 'victoria' || nk.endsWith('victoriaau')) {
      return 'AUD';
    }
    if (nk === 'nsw' || nk.includes('newsouthwales')) {
      return 'AUD';
    }
    if (nk === 'hk' || nk.includes('hongkong')) {
      return 'HKD';
    }
    return null;
  }
  function rateFromRow(r) {
    if (!r || typeof r !== 'object') return null;
    /* Prefer real FX columns; avoid generic `usd` / `usd_per_l` (easy to confuse with other sheet data). */
    const keys = ['fx_rate', 'rate', 'to_usd'];
    for (const k of keys) {
      if (r[k] != null) {
        const v = asNumSheetCell(r[k]);
        if (v != null && v > 0) return v;
      }
    }
    for (const key of Object.keys(r)) {
      const kl = key.toLowerCase();
      if (/^(fx_)?rate$|^to_usd$/i.test(kl)) {
        const v = asNumSheetCell(r[key]);
        if (v != null && v > 0) return v;
      }
    }
    return null;
  }

  /**
   * Prefer a primary row (`malaysia`, `singapore`, …) over regional labels (`peninsularmalaysia`, …)
   * so a second row with MYR/USD quoted as ~4.5 does not overwrite USD-per-MYR ~0.25 from the main row.
   */
  const byCcy = new Map();
  for (const r of rows || []) {
    const nameRaw = r.country_name ?? r.country ?? r.name;
    const nk = normName(nameRaw);
    const ccy = resolveCcyFromCountryName(nk);
    if (!ccy) continue;
    const rateRaw = rateFromRow(r);
    if (rateRaw == null || rateRaw <= 0 || rateRaw >= 1e9) continue;
    const v = normalizeCurrencySheetMultiplier(ccy, rateRaw);
    if (v == null || !Number.isFinite(v) || v <= 0 || v >= 1e9) continue;
    const tier = NAME_TO_CCY.has(nk) ? 0 : 1;
    const prev = byCcy.get(ccy);
    if (prev) {
      if (tier > prev.tier) continue;
      if (tier < prev.tier) {
        byCcy.set(ccy, { v, tier });
        continue;
      }
    }
    byCcy.set(ccy, { v, tier });
  }
  let n = 0;
  if (byCcy.size) {
    for (const [ccy, ent] of byCcy) {
      usdRates[ccy] = ent.v;
      n++;
    }
    return n;
  }

  for (const r of rows || []) {
    if (!r || typeof r !== 'object') continue;
    let hit = 0;
    for (const code of CCY_CODES) {
      let cell = r[code];
      if (cell == null) {
        const lk = Object.keys(r).find((k) => k.toUpperCase() === code);
        if (lk) cell = r[lk];
      }
      const raw = asNumSheetCell(cell);
      if (raw == null || raw <= 0 || raw >= 1e9) continue;
      const v = normalizeCurrencySheetMultiplier(code, raw);
      if (v != null && Number.isFinite(v) && v > 0 && v < 1e9) {
        usdRates[code] = v;
        hit++;
      }
    }
    if (hit >= 3) return hit;
  }
  return 0;
}

/** Fetch and cache a CSV Google Sheet by URL. */
async function ensureSheetRows(url) {
  const now = Date.now();
  const hit = _sheetCache.get(url);
  const ttl = url.includes('sheet=Currency') ? CURRENCY_SHEET_CACHE_TTL_MS : SHEET_CACHE_TTL_MS;
  if (hit && now - hit.t < ttl) return hit.rows;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet fetch ${res.status}`);
  const text = await res.text();
  const headerIdx =
    typeof SHEET_CSV_HEADER_ROW_INDEX === 'number' && SHEET_CSV_HEADER_ROW_INDEX >= 0
      ? SHEET_CSV_HEADER_ROW_INDEX
      : undefined;

  /** Vietnam tab: prefer CSV line 0 as header; if that yields no usable rows, fall back to auto-detect. */
  let rows = [];
  try {
    if (url.includes('sheet=Currency')) {
      const rawLines = text.trim().split(/\r?\n/).filter((ln) => ln.length > 0);
      const lineArrays = rawLines.map(splitCSVLine);
      const hi = detectCurrencyHeaderRowIndex(lineArrays);
      rows = parseCSV(text, { headerRowIndex: hi });
    } else if (url.includes('sheet=Vietnam')) {
      const vnHeader = typeof headerIdx === 'number' ? headerIdx : 0;
      rows = normalizeVietnamSheetRows(parseCSV(text, { headerRowIndex: vnHeader }));
      function vnRowHasPrices(r) {
        if (!r) return false;
        const keys = ['ron95_v', 'ron95_iii', 'ron92_ii', 'diesel_euro5', 'diesel_euro2', 'kerosene'];
        return keys.some((k) => asNum(r[k]) != null);
      }
      const vnOk = (list) =>
        (list || []).some((r) => normalizeSheetString(r.area) && vnRowHasPrices(r));
      if (typeof headerIdx !== 'number' && (!rows.length || !vnOk(rows))) {
        const alt = normalizeVietnamSheetRows(parseCSV(text, {}));
        if (alt.length && vnOk(alt)) rows = alt;
      }
    } else {
      rows = parseCSV(text, { headerRowIndex: headerIdx });
    }

    if (url.includes('sheet=Singapore') || url.includes('Hong%20Kong')) {
      const norm = normalizeSingaporeSheetRows(rows);
      rows = sortedSingaporeProviders(norm).length ? norm : aggregateSingaporeProviderRows(rows);
    }
    if (url.includes('sheet=Myanmar')) {
      rows = normalizeMyanmarSheetRows(rows);
    }
  } catch (err) {
    console.error('ensureSheetRows parse failed', url, err);
    rows = [];
  }

  _sheetCache.set(url, { rows, t: now });
  return rows;
}

// ── Victoria (Servo Saver) snapshot ───────────────────────────────────────────

let _vicServoCache = { t: 0, data: null };
const VIC_SERVO_CACHE_TTL_MS = 30 * 1000;

/**
 * Heuristic: API may return AUD/L (1.x) or c/L (50–300).
 * @param {number} n
 * @returns {number|null}
 */
function audPerLFromRaw(n) {
  const x = typeof n === 'number' ? n : parseFloat(String(n).replace(/,/g, ''));
  if (!Number.isFinite(x) || x <= 0) return null;
  if (x >= 40 && x < 500) return x / 100;
  if (x < 35) return x;
  if (x >= 500) return null;
  return x / 100;
}

/**
 * Map free-text or API fuel labels to `VIC_FUELS` keys in config.
 * @param {string} s
 * @returns {string|null}
 */
function mapVicFuelNameToKey(s) {
  const t = String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  if (/\blpg\b|liquefied petroleum/.test(t)) return 'lpg';
  if (/\bad\s*blue|adblue|\bdef\b|diesel exhaust|aqueous urea/i.test(t)) return 'adblue';
  if (/\b(ultimate|speedway\s*)?98|ron\s*98|p98|e\s*98|premium\s*98|ultra\s*98\b/.test(t) && !/\b95\b/.test(t))
    return 'p98';
  if (/\b(95|e\s*95|p95|ron\s*95|premium(\s*unleaded)?\s*95)\b/.test(t) && !/\b98\b/.test(t)) return 'p95';
  if (/\b(e\s*10|e10|ulp|u91|unleaded\s*91|91\s*ron|regular|standard\s*unleaded|standard)\b/.test(t))
    return 'ulp';
  if (/\b(85|e\s*85)\b/.test(t)) return 'e85';
  if (/\bdiesel\b/.test(t) && /premium|ultimate|ultimate\s*diesel|v\s*power/i.test(t) && !/adblue|blue/i.test(t))
    return 'diesel_premium';
  if (/\bdiesel\b/.test(t) && !/adblue|blue|exhaust/i.test(t)) return 'diesel';
  return null;
}

/**
 * Infer VIC key from a plain object key (camelCase or snake) and value.
 * @param {string} k
 * @param {*} v
 * @returns {string|null}
 */
function mapVicFuelObjectKeyToPriceKey(k, v) {
  if (v != null && typeof v === 'object') return null;
  const n = audPerLFromRaw(v);
  if (n == null) return null;
  const l = String(k).toLowerCase();
  if (/unleaded|ulp|e10|ron91|ron\s*91|u91|gasoline_91|petrol_91/.test(l) && !/95|98|premium\s*9[58]/.test(l))
    return 'ulp';
  if (/p95|ron95|ron_95|premium_95|unleaded_95|95/.test(l) && !/98|92/.test(l)) return 'p95';
  if (/p98|ron98|ron_98|premium_98|98/.test(l)) return 'p98';
  if (/diesel|gas.?oil|d\.\s*oil/.test(l) && /premium|ultimate|vpower|v\s*-?power|hi\s*ft/i.test(l))
    return 'diesel_premium';
  if (/diesel|distillate|gasoil/.test(l) && !/adblue|blue|exhaust|water/i.test(l)) return 'diesel';
  if (/e85|flex|ethanol\s*85/.test(l)) return 'e85';
  if (/lpg|autogas|propane/.test(l)) return 'lpg';
  if (/adblue|ad\s*blue|urea|def\b/.test(l)) return 'adblue';
  return null;
}

/**
 * Map Fair Fuel Open Data `fuelType` codes (see API doc §7.7) to `VIC_FUELS` keys.
 * @param {string} code
 * @returns {string|null}
 */
function mapFairFuelOpenDataTypeCodeToVicKey(code) {
  const c = String(code || '').toUpperCase().trim();
  const m = {
    U91: 'ulp',
    E10: 'e10',
    P95: 'p95',
    P98: 'p98',
    DSL: 'diesel',
    PDSL: 'diesel_premium',
    E85: 'e85',
    B20: 'diesel',
    LPG: 'lpg',
    LNG: 'lpg',
    CNG: 'lpg',
  };
  return m[c] || null;
}

/**
 * Extract minimum AUD/L from API JSON (Fair Fuel Open Data `fuelPriceDetails`, or legacy heuristics).
 * @param {*} json
 * @returns {{ mins: Record<string, number>, stationCount: number, asOf: string, hint?: string }}
 */
function extractVicMinPricesFromServoJson(json) {
  const mins = Object.create(null);

  if (json && Array.isArray(json.fuelPriceDetails) && json.fuelPriceDetails.length) {
    let nAvail = 0;
    for (const row of json.fuelPriceDetails) {
      const prices = row.fuelPrices;
      if (!Array.isArray(prices)) continue;
      for (const fp of prices) {
        if (fp == null) continue;
        if (fp.isAvailable === false) continue;
        const vkey = mapFairFuelOpenDataTypeCodeToVicKey(fp.fuelType);
        if (!vkey) continue;
        const cpl = fp.price;
        const aud = audPerLFromRaw(cpl);
        if (aud == null) continue;
        nAvail += 1;
        if (mins[vkey] == null || aud < mins[vkey]) mins[vkey] = aud;
      }
    }
    const asOf = json.asAt || json.asOf || json.lastUpdated || '';
    if (nAvail) {
      return {
        mins,
        stationCount: json.fuelPriceDetails.length,
        asOf: String(asOf || ''),
        hint: undefined,
      };
    }
  }

  const consider = (key, rawPrice) => {
    const k = mapVicFuelNameToKey(key) || mapVicFuelObjectKeyToPriceKey(key, rawPrice);
    if (!k) return;
    const p = audPerLFromRaw(rawPrice);
    if (p == null) return;
    if (mins[k] == null || p < mins[k]) mins[k] = p;
  };

  const stationTally = { n: 0, seen: new Set() };
  const rememberStation = (id) => {
    if (id == null) return;
    const s = String(id);
    if (stationTally.seen.has(s)) return;
    stationTally.seen.add(s);
    stationTally.n += 1;
  };

  function visitFuelEntry(typeField, priceField) {
    const t = typeField;
    const p = priceField;
    if (t == null) return;
    if (p == null) return;
    if (typeof t === 'object' && t != null) {
      consider(t.name || t.label || t.fuelName || t.type || t, p);
    } else {
      consider(t, p);
    }
  }

  function visitRecord(o, depth) {
    if (depth > 10 || o == null) return;
    if (Array.isArray(o)) {
      for (const it of o) visitRecord(it, depth + 1);
      return;
    }
    if (typeof o !== 'object') return;

    if (o.siteId != null) rememberStation(o.siteId);
    if (o.stationId != null) rememberStation(o.stationId);
    if (o.id != null && (o.name != null || o.brandName != null || o.address)) rememberStation(o.id);

    for (const [k, v] of Object.entries(o)) {
      const keyL = k.toLowerCase();
      if (
        (keyL.includes('price') && !keyL.includes('cap')) ||
        /amount|unitprice|perlitre|per_litre|dollarsper|aud/i.test(k)
      ) {
        if (v != null && (typeof v === 'number' || (typeof v === 'string' && asNum(v) != null))) {
          consider(k, v);
        }
        const mapped = mapVicFuelObjectKeyToPriceKey(k, v);
          if (mapped) {
            const p2 = audPerLFromRaw(v);
            if (p2 != null) {
              if (mins[mapped] == null || p2 < mins[mapped]) mins[mapped] = p2;
            }
          }
      }
    }

    for (const arrKey of [
      'fuels',
      'fuelPrices',
      'fuel_prices',
      'prices',
      'productPrices',
      'products',
      'availableFuels',
    ]) {
      const a = o[arrKey];
      if (!Array.isArray(a)) continue;
      for (const row of a) {
        if (row == null) continue;
        if (typeof row === 'object') {
          const price =
            row.price ??
            row.unitPrice ??
            row.amount ??
            row.value ??
            row.cpl ??
            row.centsPerLitre ??
            row.centsPerLiter;
          const typ =
            row.fuelName ??
            row.fuelType ??
            row.fuelTypeName ??
            row.fuelTypeDescription ??
            row.name ??
            row.type ??
            row.label ??
            row.code ??
            row.grade;
          if (typ != null || price != null) visitFuelEntry(typ, price);
        }
      }
    }
    for (const sub of Object.values(o)) {
      if (Array.isArray(sub) && sub.length && typeof sub[0] === 'object') {
        for (const it of sub) visitRecord(it, depth + 1);
      } else if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
        visitRecord(sub, depth + 1);
      }
    }
  }

  for (const top of [
    json,
    json && json.data,
    json && json.result,
    json && json.items,
  ]) {
    if (Array.isArray(top) && top.length) {
      for (const row of top) visitRecord(row, 0);
      break;
    }
  }
  for (const k of [
    'stations',
    'fuelStations',
    'data',
    'results',
    'items',
    'records',
    'value',
  ]) {
    if (json && k in json && Array.isArray(json[k]) && json[k].length) {
      for (const row of json[k]) visitRecord(row, 0);
    }
  }
  if (!Object.keys(mins).length) {
    visitRecord(json, 0);
  }

  let asOf = '';
  try {
    asOf = String(
      (json && (json.asAt || json.asat || json.asOf || json.lastUpdated || json.published)) || '',
    );
  } catch (_) {}

  const hint =
    !Object.keys(mins).length && !stationTally.n
      ? 'Could not read fuel prices from the API JSON — check SERVO_SAVER_PATH and compare with the PDF schema.'
      : !Object.keys(mins).length
        ? 'Received JSON but no pump prices were parsed; the response shape may differ from what the app expects. Compare with the PDF.'
        : undefined;

  return { mins, stationCount: stationTally.n, asOf, hint };
}

/**
 * Cached `GET /api/servo-saver` (same-origin proxy on Vercel) + parse.
 * @returns {Promise<{ json: object, mins: object, stationCount: number, asOf: string, hint?: string, fetchedAt: number }>}
 */
async function ensureVicServoSnapshot() {
  if (_vicServoCache.data && Date.now() - _vicServoCache.t < VIC_SERVO_CACHE_TTL_MS) {
    return _vicServoCache.data;
  }
  const res = await fetch('/api/servo-saver', { cache: 'no-store' });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    const e = new Error(
      `Invalid JSON from Servo Saver proxy (HTTP ${res.status}): ${String(text).replace(/\s+/g, ' ').slice(0, 200)}`,
    );
    e.status = res.status;
    e.body = String(text).slice(0, 400);
    throw e;
  }
  if (!res.ok) {
    const parts = [`HTTP ${res.status}`];
    if (json && typeof json === 'object') {
      if (json.error) parts.push(String(json.error));
      if (json.message && String(json.message) !== String(json.error)) parts.push(String(json.message));
      if (json.resolvedUrl) parts.push(`URL: ${json.resolvedUrl}`);
    } else if (text) {
      parts.push(String(text).replace(/\s+/g, ' ').slice(0, 180));
    }
    const e = new Error(`Servo Saver: ${parts.join(' — ')}`);
    e.status = res.status;
    e.body = json;
    throw e;
  }
  const toParse = Array.isArray(json) ? json : json;
  const parsed = extractVicMinPricesFromServoJson(toParse);
  const out = {
    json: Array.isArray(json) ? { items: json } : json || {},
    ...parsed,
    fetchedAt: Date.now(),
  };
  _vicServoCache = { t: Date.now(), data: out };
  return out;
}

// ── New South Wales (FuelCheck via api.nsw) snapshot ─────────────────────────

let _nswFuelCache = { t: 0, data: null };
const NSW_FUEL_CACHE_TTL_MS = 30 * 1000;

/**
 * Cached `GET /api/nsw-fuel` — server returns `{ ok, mins, stationCount, asOf, hint? }` (no multi‑MB dump to the client).
 * @returns {Promise<{ mins: object, stationCount: number, asOf: string, hint?: string, fetchedAt: number }>}
 */
async function ensureNswFuelSnapshot() {
  if (_nswFuelCache.data && Date.now() - _nswFuelCache.t < NSW_FUEL_CACHE_TTL_MS) {
    return _nswFuelCache.data;
  }
  const res = await fetch('/api/nsw-fuel', { cache: 'no-store' });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    const e = new Error(
      `Invalid JSON from NSW Fuel proxy (HTTP ${res.status}): ${String(text).replace(/\s+/g, ' ').slice(0, 200)}`,
    );
    e.status = res.status;
    e.body = String(text).slice(0, 400);
    throw e;
  }
  if (!res.ok || !json || json.ok !== true) {
    const parts = [`HTTP ${res.status}`];
    if (json && typeof json === 'object') {
      if (json.error) parts.push(String(json.error));
      if (json.message && String(json.message) !== String(json.error)) parts.push(String(json.message));
      if (json.resolvedUrl) parts.push(`URL: ${json.resolvedUrl}`);
    } else if (text) {
      parts.push(String(text).replace(/\s+/g, ' ').slice(0, 180));
    }
    const e = new Error(`NSW Fuel: ${parts.join(' — ')}`);
    e.status = res.status;
    e.body = json;
    throw e;
  }
  const mins = json.mins && typeof json.mins === 'object' ? json.mins : {};
  const out = {
    mins,
    stationCount: +json.stationCount || 0,
    asOf: String(json.asOf || ''),
    hint: json.hint,
    fetchedAt: json.fetchedAt != null ? +json.fetchedAt : Date.now(),
  };
  _nswFuelCache = { t: Date.now(), data: out };
  return out;
}
