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
  if (/country varies|changes date|\bdate\b/i.test(raw) && !/update/i.test(raw)) return 'date';
  if (/indonesia.*city|region.*city/i.test(raw)) return 'city';
  if (/provider$/i.test(raw) || /daily provider/i.test(raw)) return 'provider';
  if (/brunei.*seasonally gasoline/i.test(raw) && !/premium/i.test(raw)) return 'gasoline';
  const slug = low.replace(/\s+/g, '_');
  const known = new Set([
    'ron92', 'ron95', 'ron98', 'diesel', 'gasoline', 'premium', 'gasoline_premium',
    'vpower_gasoline', 'vpower_diesel',
    'pertalite', 'pertamax', 'pertamax_turbo', 'dexlite', 'pertamina_dex',
    'gasohol_91', 'gasohol_95', 'e20', 'e85',
  ]);
  if (known.has(slug)) return slug;
  if (low === 'premium') return 'premium';
  return slug.replace(/[^a-z0-9_]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || slug;
}

/** Canonical column keys that hold numeric fuel prices (not date/city/provider). */
const FUEL_PRICE_HEADER_KEYS = new Set([
  'ron92', 'ron95', 'ron98', 'diesel', 'gasoline', 'premium', 'gasoline_premium',
  'vpower_gasoline', 'vpower_diesel',
  'pertalite', 'pertamax', 'pertamax_turbo', 'dexlite', 'pertamina_dex',
  'gasohol_91', 'gasohol_95', 'e20', 'e85',
]);

/**
 * Find header row when the sheet has title rows above the real columns.
 * Indonesia tabs often omit the word "diesel" (Dexlite / Pertamina Dex only), so we
 * score rows by canonical fuel columns instead of requiring a diesel substring match.
 */
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
    const d = r.date != null ? String(r.date).trim() : '';
    if (d) curDate = d;
    const p = r.provider != null ? String(r.provider).trim() : '';
    if (p) curProvider = p;
    return { ...r, date: curDate, provider: curProvider };
  });
  return filled.filter((r) => normalizeSheetString(r.date) && normalizeSheetString(r.provider));
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
/** In-memory sheet cache TTL so highlights can pick up newer Google Sheet rows without a full reload. */
const SHEET_CACHE_TTL_MS = 30 * 1000;

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

/** Fetch and cache a CSV Google Sheet by URL. */
async function ensureSheetRows(url) {
  const now = Date.now();
  const hit = _sheetCache.get(url);
  if (hit && now - hit.t < SHEET_CACHE_TTL_MS) return hit.rows;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Sheet fetch ${res.status}`);
  const headerIdx =
    typeof SHEET_CSV_HEADER_ROW_INDEX === 'number' && SHEET_CSV_HEADER_ROW_INDEX >= 0
      ? SHEET_CSV_HEADER_ROW_INDEX
      : undefined;
  let rows = parseCSV(await res.text(), { headerRowIndex: headerIdx });
  if (url.includes('sheet=Singapore')) {
    const norm = normalizeSingaporeSheetRows(rows);
    rows = sortedSingaporeProviders(norm).length ? norm : aggregateSingaporeProviderRows(rows);
  }
  _sheetCache.set(url, { rows, t: now });
  return rows;
}
