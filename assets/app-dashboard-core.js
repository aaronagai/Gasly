/**
 * Region list for search, USD helpers for highlights, and the all-regions prices table.
 * Loaded after config.js + utils.js by app.html and dashboard.html.
 */
var _appCurrencyMult = null;

function labelVietnamArea(areaKey) {
  const a = normalizeSheetString(areaKey).toLowerCase();
  const m = /^area[_-]?(\d+)$/.exec(a);
  if (m) return `Area ${m[1]}`;
  return normalizeSheetString(areaKey) || 'Area 1';
}

/** Search suggestions: MY regions, BN/TH/PH/KH national, VN areas + MM stations from sheets, SG providers, LA provinces, ID cities (matches terminal; list refetched when search opens). */
async function buildSearchRegionsList() {
  const rows = [];
  const vnName = (COUNTRIES[704] && COUNTRIES[704].name) || 'Vietnam';
  MY_REGIONS.forEach((r) => {
    rows.push({
      countryId: 458,
      label: `${COUNTRIES[458].name} - ${r.label}`,
      myRegion: r.key,
    });
  });
  rows.push({ countryId: 96, label: `${COUNTRIES[96].name} - National` });
  rows.push({ countryId: 764, label: `${COUNTRIES[764].name} - National` });
  rows.push({ countryId: 608, label: `${COUNTRIES[608].name} - National` });
  let vnRows = [];
  try {
    vnRows = await ensureSheetRows(VN_SHEET_URL);
  } catch (_) {
    vnRows = [];
  }
  const vnAreas = [...new Set(vnRows.map((r) => canonVietnamAreaKey(r.area)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (vnAreas.length) {
    vnAreas.forEach((ar) => {
      rows.push({
        countryId: 704,
        label: `${vnName} - ${labelVietnamArea(ar)}`,
        vnArea: ar,
      });
    });
  } else {
    rows.push({ countryId: 704, label: `${vnName} - National`, vnArea: '' });
  }
  rows.push({ countryId: 116, label: `${COUNTRIES[116].name} - National` });
  let mmRows = [];
  try {
    mmRows = await ensureSheetRows(MM_SHEET_URL);
  } catch (_) {
    mmRows = [];
  }
  const mmRegs = [...new Set(mmRows.map((r) => normalizeSheetString(r.region)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (mmRegs.length) {
    mmRegs.forEach((reg) => {
      rows.push({ countryId: 104, label: `${COUNTRIES[104].name} - ${reg}`, mmRegion: reg });
    });
  } else {
    rows.push({ countryId: 104, label: `${COUNTRIES[104].name} - National`, mmRegion: '' });
  }

  let sgRows = [];
  try {
    sgRows = await ensureSheetRows(SG_SHEET_URL);
  } catch (_) {
    sgRows = [];
  }
  const sgProvs = sortedSingaporeProviders(sgRows);
  if (sgProvs.length) {
    sgProvs.forEach((p) => {
      rows.push({ countryId: 702, label: `${COUNTRIES[702].name} - ${p}`, sgProvider: p });
    });
  } else {
    rows.push({ countryId: 702, label: `${COUNTRIES[702].name} - National` });
  }

  Object.keys(LA_PROVINCE_LONLAT)
    .sort((a, b) => a.localeCompare(b))
    .forEach((prov) => {
      rows.push({ countryId: 418, label: `${COUNTRIES[418].name} - ${prov}`, laProvince: prov });
    });
  Object.keys(ID_CITY_LONLAT)
    .sort((a, b) => a.localeCompare(b))
    .forEach((city) => {
      rows.push({ countryId: 360, label: `${COUNTRIES[360].name} - ${city}`, idCity: city });
    });
  if (!rows.some((x) => +x.countryId === 704)) {
    const ins = rows.findIndex((x) => +x.countryId === 116);
    const entry = { countryId: 704, label: `${vnName} - National`, vnArea: '' };
    if (ins === -1) rows.push(entry);
    else rows.splice(ins, 0, entry);
  }
  return rows;
}

function appHighlightUsdOn() {
  try {
    return localStorage.getItem('app_highlight_usd') === '1';
  } catch (_) {
    return false;
  }
}

function getAppUsdMultiplier(sym) {
  const code = String(sym || '')
    .trim()
    .toUpperCase();
  /* Always prefer merged `USD_RATES` from the Currency sheet; `_appCurrencyMult` is only a fallback layout. */
  if (typeof USD_RATES !== 'undefined' && USD_RATES[code] != null) {
    const x = Number(USD_RATES[code]);
    if (Number.isFinite(x) && x > 0) return x;
  }
  if (_appCurrencyMult && Number.isFinite(_appCurrencyMult[code]) && _appCurrencyMult[code] > 0) {
    return _appCurrencyMult[code];
  }
  return null;
}

/**
 * Currency tab: columns `currency` (or `code`) + `to_usd` (multiply price/L in that currency to get USD/L).
 * Optional `local_per_usd` (e.g. IDR per $1) — multiplier = 1 / value.
 */
function buildCurrencyMapFromRows(rows) {
  const m = Object.create(null);
  for (const r of rows || []) {
    if (!r || typeof r !== 'object') continue;
    let code = '';
    for (const k of Object.keys(r)) {
      const kl = String(k || '')
        .toLowerCase()
        .replace(/_/g, '');
      if (kl === 'currency' || kl === 'code' || kl === 'ccy' || kl === 'symbol') {
        const raw = normalizeSheetString(r[k]).toUpperCase().replace(/[^A-Z]/g, '');
        if (raw.length >= 3) {
          code = raw.slice(0, 3);
          break;
        }
      }
    }
    if (!code) continue;
    let mult = typeof asNumSheetCell === 'function' ? asNumSheetCell(r.to_usd) : asNum(r.to_usd);
    if (mult == null) {
      for (const k of Object.keys(r)) {
        const kl = String(k || '')
          .toLowerCase()
          .replace(/_/g, '');
        if (
          kl === 'multiply' ||
          kl === 'rate' ||
          kl === 'usd' ||
          (kl.includes('usd') && (kl.includes('per') || kl.includes('to')))
        ) {
          const v = typeof asNumSheetCell === 'function' ? asNumSheetCell(r[k]) : asNum(r[k]);
          if (v != null && v > 0 && !String(k).toLowerCase().includes('local')) {
            mult = v;
            break;
          }
        }
      }
    }
    if (mult == null) {
      const inv = typeof asNumSheetCell === 'function'
        ? asNumSheetCell(r.local_per_usd ?? r.idr_per_usd ?? r.localperusd)
        : asNum(r.local_per_usd ?? r.idr_per_usd ?? r.localperusd);
      if (inv != null && inv > 0) mult = 1 / inv;
    }
    if (mult != null && mult > 0) {
      const adj =
        typeof normalizeCurrencySheetMultiplier === 'function'
          ? normalizeCurrencySheetMultiplier(code, mult)
          : mult;
      if (adj != null && Number.isFinite(adj) && adj > 0) m[code] = adj;
    }
  }
  return m;
}

async function loadAppCurrencyRates() {
  const url = typeof CURRENCY_SHEET_URL === 'string' ? CURRENCY_SHEET_URL.trim() : '';
  if (!url) return;
  try {
    let rows;
    if (typeof ensureSheetRows === 'function') {
      rows = await ensureSheetRows(url);
    } else {
      const text = await (await fetch(url, { cache: 'no-store' })).text();
      const rawLines = text.trim().split(/\r?\n/).filter((ln) => ln.length > 0);
      const lineArrays = rawLines.map((ln) => splitCSVLine(ln));
      const hi =
        typeof detectCurrencyHeaderRowIndex === 'function' ? detectCurrencyHeaderRowIndex(lineArrays) : 0;
      rows = parseCSV(text, { headerRowIndex: hi });
    }
    /**
     * Mutate shared `USD_RATES` (same as terminal). Fallback `_appCurrencyMult` only if the sheet
     * uses the alternate `currency` + `to_usd` layout instead of `country_name` + `fx_rate`.
     */
    let n = 0;
    if (typeof mergeCurrencySheetRowsIntoUsdRates === 'function' && typeof USD_RATES !== 'undefined') {
      n = mergeCurrencySheetRowsIntoUsdRates(rows, USD_RATES);
    }
    if (n > 0) {
      _appCurrencyMult = null;
    } else {
      _appCurrencyMult = buildCurrencyMapFromRows(rows);
      if (!_appCurrencyMult || !Object.keys(_appCurrencyMult).length) _appCurrencyMult = null;
    }
  } catch (e) {
    console.warn('Currency sheet load failed', e);
    _appCurrencyMult = null;
  }
}

const MS_PER_DAY = 86400000;

var _dashboardDataCache = null;
var _dashboardPeriodBound = false;
var _dashboardFuelBound = false;
var _dashboardCountryBound = false;
var _dashboardSortBound = false;
var _dashboardColumnHeadersBound = false;
const DASHBOARD_FUEL_STATUS_LABELS = {
  all: 'All types',
  entry: 'Entry (90-91)',
  mid: 'Mid-grade (92-95)',
  premium: 'Premium (97+)',
  diesel: 'Diesel',
};

/** Full labels for fuel trigger + bottom sheet. */
const DASHBOARD_FUEL_DISPLAY_LABELS = {
  all: 'All types',
  entry: 'Entry (90-91)',
  mid: 'Mid-grade (92-95)',
  premium: 'Premium (97+)',
  diesel: 'Diesel',
};

/** Petrol tiers expanded when fuel = `all` (order matches sheet option list below `all`).
 * `premium_diesel` is an internal-only preset for countries with a second diesel tier
 * (e.g. Brunei V-Power Diesel); rows without a matching column get filtered by the spot check. */
const DASHBOARD_FUEL_PRESETS_ALL = Object.freeze(['entry', 'mid', 'premium', 'diesel', 'premium_diesel']);

const DASHBOARD_FUEL_KEYS = new Set(['all', 'entry', 'mid', 'premium', 'diesel']);

function dashboardSheetsSyncBodyScroll() {
  try {
    const sortS = document.getElementById('app-dashboard-sort-sheet');
    const fuelS = document.getElementById('app-dashboard-fuel-sheet');
    const countryS = document.getElementById('app-dashboard-country-sheet');
    const periodS = document.getElementById('app-dashboard-period-sheet');
    const anyOpen =
      (sortS && !sortS.hidden) ||
      (fuelS && !fuelS.hidden) ||
      (countryS && !countryS.hidden) ||
      (periodS && !periodS.hidden);
    document.body.style.overflow = anyOpen ? 'hidden' : '';
  } catch (_) {}
}

function dashboardCloseSortSheetIfOpen() {
  const sortS = document.getElementById('app-dashboard-sort-sheet');
  const sortT = document.getElementById('app-dashboard-sort-trigger');
  if (sortS && !sortS.hidden) {
    sortS.hidden = true;
    sortS.setAttribute('aria-hidden', 'true');
    if (sortT) sortT.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }
}

function dashboardCloseFuelSheetIfOpen() {
  const fuelS = document.getElementById('app-dashboard-fuel-sheet');
  const fuelT = document.getElementById('app-dashboard-fuel-trigger');
  if (fuelS && !fuelS.hidden) {
    fuelS.hidden = true;
    fuelS.setAttribute('aria-hidden', 'true');
    if (fuelT) fuelT.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }
}

function dashboardClosePeriodSheetIfOpen() {
  const periodS = document.getElementById('app-dashboard-period-sheet');
  const periodT = document.getElementById('app-dashboard-period-trigger');
  if (periodS && !periodS.hidden) {
    periodS.hidden = true;
    periodS.setAttribute('aria-hidden', 'true');
    if (periodT) periodT.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }
}

function dashboardCloseCountrySheetIfOpen() {
  const countryS = document.getElementById('app-dashboard-country-sheet');
  const countryT = document.getElementById('app-dashboard-country-trigger');
  if (countryS && !countryS.hidden) {
    countryS.hidden = true;
    countryS.setAttribute('aria-hidden', 'true');
    if (countryT) countryT.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }
}

const DASHBOARD_SORT_STATUS_LABELS = {
  default: 'default order',
  region_az: 'A–Z',
  region_za: 'Z–A',
  price_low: 'price ↑',
  price_high: 'price ↓',
  change_high: 'change % ↓',
  change_low: 'change % ↑',
};

const DASHBOARD_SORT_MODES = new Set([
  'default',
  'region_az',
  'region_za',
  'price_low',
  'price_high',
  'change_high',
  'change_low',
]);

/** ISO 3166-1 alpha-2 for flag-icons (`fi fi-xx`), keyed by `COUNTRIES` id. */
const DASHBOARD_COUNTRY_FLAG_ISO2 = {
  458: 'my',
  702: 'sg',
  96: 'bn',
  360: 'id',
  764: 'th',
  608: 'ph',
  704: 'vn',
  116: 'kh',
  418: 'la',
  104: 'mm',
};

function dashboardFlagIso2ForCountryId(countryId) {
  const id = +countryId;
  return DASHBOARD_COUNTRY_FLAG_ISO2[id] || null;
}

const DASHBOARD_SORT_DISPLAY_LABELS = {
  default: 'Default order',
  region_az: 'Region A–Z',
  region_za: 'Region Z–A',
  price_low: 'Price: low to high',
  price_high: 'Price: high to low',
  change_high: 'Change %: highest first',
  change_low: 'Change %: lowest first',
};

function dashboardSortUsesIcon(mode) {
  return mode === 'change_high' || mode === 'change_low';
}

function readStoredDashboardPeriod() {
  try {
    const s = localStorage.getItem('app_dashboard_period');
    if (s === 'w' || s === 'm' || s === '3m' || s === 'ytd' || s === 'y') return s;
  } catch (_) {}
  return 'm';
}

function persistDashboardPeriod(key) {
  try {
    if (key === 'w' || key === 'm' || key === '3m' || key === 'ytd' || key === 'y') {
      localStorage.setItem('app_dashboard_period', key);
    }
  } catch (_) {}
}

function getDashboardPeriodRootEl() {
  return document.getElementById('app-dashboard-period');
}

function dashboardPeriodLabel(key) {
  if (key === 'm') return '1M %';
  if (key === '3m') return '3M %';
  if (key === 'ytd') return 'YTD %';
  if (key === 'y') return '1Y %';
  return '1W %';
}

/** Read period key from the dropdown root (avoid `data-value` + `dataset.value` — unreliable in some browsers). */
function getDashboardPeriodFromDom(wrap) {
  if (!wrap) return null;
  let v = wrap.getAttribute('data-period');
  if (v == null || v === '') v = wrap.getAttribute('data-value');
  if (v == null || v === '') return null;
  v = String(v).trim();
  if (v === 'w' || v === 'm' || v === '3m' || v === 'ytd' || v === 'y') return v;
  return null;
}

/** Active dashboard change window: 1W / 1M / 3M / 1Y / YTD */
function getDashboardPeriodKey() {
  const wrap = getDashboardPeriodRootEl();
  const fromDom = getDashboardPeriodFromDom(wrap);
  if (fromDom) return fromDom;
  return readStoredDashboardPeriod();
}

function dashboardPctForPeriod(st, key) {
  if (key === 'm') return st.m;
  if (key === '3m') return st.mo3;
  if (key === 'ytd') return st.ytd;
  if (key === 'y') return st.y;
  return st.w;
}

function syncDashboardPeriodSheetSelection(k) {
  const menu = document.getElementById('app-dashboard-period-menu');
  if (!menu) return;
  menu.querySelectorAll('.app-dashboard-period-option').forEach(function (btn) {
    const v = btn.getAttribute('data-period');
    btn.setAttribute('aria-selected', v === k ? 'true' : 'false');
  });
}

function wireAppDashboardPeriodSelect() {
  const wrap = getDashboardPeriodRootEl();
  const trigger = document.getElementById('app-dashboard-period-trigger');
  const menu = document.getElementById('app-dashboard-period-menu');
  const sheet = document.getElementById('app-dashboard-period-sheet');
  const backdrop = document.getElementById('app-dashboard-period-backdrop');
  const handle = document.getElementById('app-dashboard-period-sheet-handle');
  if (!wrap || !trigger || !menu || !sheet || !backdrop || _dashboardPeriodBound) return;
  _dashboardPeriodBound = true;

  /**
   * @param {string} k period key
   * @param {boolean} [fromSheet] when true (user picked in the sheet), sort by change % for that period
   */
  function applyPeriod(k, fromSheet) {
    wrap.setAttribute('data-period', k);
    try {
      wrap.removeAttribute('data-value');
    } catch (_) {}
    trigger.textContent = dashboardPeriodLabel(k);
    persistDashboardPeriod(k);
    syncDashboardPeriodSheetSelection(k);
    if (fromSheet) {
      const cur = getDashboardSortMode();
      const mode = cur === 'change_low' ? 'change_low' : 'change_high';
      applyDashboardSort(mode);
    } else if (_dashboardDataCache) {
      renderAppDashboardTbody();
    }
  }

  function syncFromStorage() {
    applyPeriod(readStoredDashboardPeriod(), false);
  }

  function openMenu() {
    dashboardCloseSortSheetIfOpen();
    dashboardCloseFuelSheetIfOpen();
    dashboardCloseCountrySheetIfOpen();
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    dashboardSheetsSyncBodyScroll();
  }

  function closeMenu() {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }

  function toggleMenu() {
    if (sheet.hidden) openMenu();
    else closeMenu();
  }

  syncFromStorage();

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  backdrop.addEventListener('click', function () {
    closeMenu();
  });

  if (handle) {
    handle.addEventListener('click', function () {
      closeMenu();
    });
  }

  menu.querySelectorAll('.app-dashboard-period-option').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const raw = btn.getAttribute('data-period') || btn.getAttribute('data-value');
      const v = raw != null ? String(raw).trim() : '';
      if (v !== 'w' && v !== 'm' && v !== '3m' && v !== 'ytd' && v !== 'y') return;
      applyPeriod(v, true);
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && sheet && !sheet.hidden) {
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    }
  });
}

function wireAppDashboardColumnHeaders() {
  const regionBtn = document.getElementById('app-dashboard-th-region');
  const priceBtn = document.getElementById('app-dashboard-th-price');
  if (!regionBtn || !priceBtn || _dashboardColumnHeadersBound) return;
  _dashboardColumnHeadersBound = true;

  regionBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dashboardCloseSortSheetIfOpen();
    dashboardCloseFuelSheetIfOpen();
    dashboardClosePeriodSheetIfOpen();
    dashboardCloseCountrySheetIfOpen();
    const cur = getDashboardSortMode();
    const next = cur === 'region_az' ? 'region_za' : 'region_az';
    applyDashboardSort(next);
  });

  priceBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    dashboardCloseSortSheetIfOpen();
    dashboardCloseFuelSheetIfOpen();
    dashboardClosePeriodSheetIfOpen();
    dashboardCloseCountrySheetIfOpen();
    const cur = getDashboardSortMode();
    const next = cur === 'price_high' ? 'price_low' : 'price_high';
    applyDashboardSort(next);
  });
}

function readStoredDashboardCountryId() {
  try {
    const s = localStorage.getItem('app_dashboard_country');
    if (s == null || s === '') return null;
    const id = +s;
    if (Number.isFinite(id) && typeof COUNTRIES !== 'undefined' && COUNTRIES[id]) return id;
  } catch (_) {}
  return null;
}

function persistDashboardCountryId(id) {
  try {
    if (id == null) localStorage.removeItem('app_dashboard_country');
    else localStorage.setItem('app_dashboard_country', String(id));
  } catch (_) {}
}

function getDashboardCountryFilterId() {
  const wrap = document.getElementById('app-dashboard-country');
  if (wrap) {
    const v = wrap.getAttribute('data-country');
    if (v == null || String(v).trim() === '') return null;
    const id = +v;
    if (Number.isFinite(id) && typeof COUNTRIES !== 'undefined' && COUNTRIES[id]) return id;
  }
  return readStoredDashboardCountryId();
}

function syncDashboardCountrySheetSelection(selectedId) {
  const menu = document.getElementById('app-dashboard-country-menu');
  if (!menu) return;
  const want = selectedId == null ? '' : String(selectedId);
  menu.querySelectorAll('.app-dashboard-country-option').forEach(function (btn) {
    const raw = btn.getAttribute('data-country');
    const v = raw != null ? String(raw).trim() : '';
    btn.setAttribute('aria-selected', v === want ? 'true' : 'false');
  });
}

function wireAppDashboardCountryFilter() {
  const wrap = document.getElementById('app-dashboard-country');
  const trigger = document.getElementById('app-dashboard-country-trigger');
  const menu = document.getElementById('app-dashboard-country-menu');
  const sheet = document.getElementById('app-dashboard-country-sheet');
  const backdrop = document.getElementById('app-dashboard-country-backdrop');
  const handle = document.getElementById('app-dashboard-country-sheet-handle');
  const labelEl = wrap && wrap.querySelector('.app-dashboard-country-trigger-label');
  if (!wrap || !trigger || !menu || !sheet || !backdrop || !labelEl || _dashboardCountryBound) return;
  _dashboardCountryBound = true;

  if (!menu.querySelector('.app-dashboard-country-option')) {
    const frag = document.createDocumentFragment();
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.setAttribute('role', 'option');
    allBtn.className = 'app-dashboard-country-option';
    allBtn.setAttribute('data-country', '');
    allBtn.textContent = 'All countries';
    frag.appendChild(allBtn);
    if (typeof COUNTRIES !== 'undefined') {
      Object.keys(COUNTRIES)
        .map((k) => +k)
        .filter((id) => Number.isFinite(id) && COUNTRIES[id])
        .sort((a, b) => String(COUNTRIES[a].name).localeCompare(String(COUNTRIES[b].name)))
        .forEach(function (id) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('role', 'option');
          btn.className = 'app-dashboard-country-option';
          btn.setAttribute('data-country', String(id));
          btn.textContent = COUNTRIES[id].name;
          frag.appendChild(btn);
        });
    }
    menu.appendChild(frag);
  }

  function applyCountry(countryId) {
    const id =
      countryId == null || countryId === '' || countryId === 'all'
        ? null
        : +countryId;
    if (
      id != null &&
      (!Number.isFinite(id) || typeof COUNTRIES === 'undefined' || !COUNTRIES[id])
    )
      return;
    if (id == null) {
      wrap.setAttribute('data-country', '');
    } else {
      wrap.setAttribute('data-country', String(id));
    }
    labelEl.textContent = id == null ? 'All countries' : COUNTRIES[id].name;
    persistDashboardCountryId(id);
    syncDashboardCountrySheetSelection(id);
    if (_dashboardDataCache) renderAppDashboardTbody();
  }

  function syncFromStorage() {
    const stored = readStoredDashboardCountryId();
    applyCountry(stored == null ? null : stored);
  }

  function openMenu() {
    dashboardCloseSortSheetIfOpen();
    dashboardCloseFuelSheetIfOpen();
    dashboardClosePeriodSheetIfOpen();
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    dashboardSheetsSyncBodyScroll();
  }

  function closeMenu() {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }

  function toggleMenu() {
    if (sheet.hidden) openMenu();
    else closeMenu();
  }

  syncFromStorage();

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  backdrop.addEventListener('click', function () {
    closeMenu();
  });

  if (handle) {
    handle.addEventListener('click', function () {
      closeMenu();
    });
  }

  menu.querySelectorAll('.app-dashboard-country-option').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const raw = btn.getAttribute('data-country');
      const v = raw != null ? String(raw).trim() : '';
      applyCountry(v === '' ? null : v);
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && sheet && !sheet.hidden) {
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    }
  });
}

function readStoredDashboardFuel() {
  try {
    const s = localStorage.getItem('app_dashboard_fuel');
    if (s === 'default') return 'mid';
    if (s === 'all' || s === 'mid' || s === 'premium' || s === 'entry' || s === 'diesel') return s;
  } catch (_) {}
  return 'mid';
}

function persistDashboardFuel(key) {
  try {
    if (key === 'all' || key === 'mid' || key === 'premium' || key === 'entry' || key === 'diesel') {
      localStorage.setItem('app_dashboard_fuel', key);
    }
  } catch (_) {}
}

function getDashboardFuelSelectEl() {
  return document.getElementById('app-dashboard-fuel');
}

function getDashboardFuelPreset() {
  const wrap = getDashboardFuelSelectEl();
  if (wrap) {
    const v = wrap.getAttribute('data-fuel');
    if (v && DASHBOARD_FUEL_KEYS.has(v)) return v;
  }
  return readStoredDashboardFuel();
}

function wireAppDashboardFuelSelect() {
  const wrap = getDashboardFuelSelectEl();
  const trigger = document.getElementById('app-dashboard-fuel-trigger');
  const sheet = document.getElementById('app-dashboard-fuel-sheet');
  const backdrop = document.getElementById('app-dashboard-fuel-backdrop');
  const handle = document.getElementById('app-dashboard-fuel-sheet-handle');
  const menu = document.getElementById('app-dashboard-fuel-menu');
  const labelEl = wrap && wrap.querySelector('.app-dashboard-fuel-trigger-label');
  if (!wrap || !trigger || !sheet || !backdrop || !menu || !labelEl || _dashboardFuelBound) return;
  _dashboardFuelBound = true;

  function applyFuel(mode) {
    if (!DASHBOARD_FUEL_KEYS.has(mode)) return;
    wrap.setAttribute('data-fuel', mode);
    labelEl.textContent = DASHBOARD_FUEL_DISPLAY_LABELS[mode] || mode;
    persistDashboardFuel(mode);
    if (_dashboardDataCache) renderAppDashboardTbody();
  }

  function syncFromStorage() {
    applyFuel(readStoredDashboardFuel());
  }

  function openMenu() {
    dashboardCloseSortSheetIfOpen();
    dashboardCloseCountrySheetIfOpen();
    dashboardClosePeriodSheetIfOpen();
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    dashboardSheetsSyncBodyScroll();
  }

  function closeMenu() {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }

  function toggleMenu() {
    if (sheet.hidden) openMenu();
    else closeMenu();
  }

  syncFromStorage();

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  backdrop.addEventListener('click', function () {
    closeMenu();
  });

  if (handle) {
    handle.addEventListener('click', function () {
      closeMenu();
    });
  }

  menu.querySelectorAll('.app-dashboard-fuel-option').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const raw = btn.getAttribute('data-fuel');
      const v = raw != null ? String(raw).trim() : '';
      if (!DASHBOARD_FUEL_KEYS.has(v)) return;
      applyFuel(v);
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !sheet.hidden) {
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    }
  });
}

function readStoredDashboardSort() {
  try {
    const s = localStorage.getItem('app_dashboard_sort');
    if (s && DASHBOARD_SORT_MODES.has(s)) return s;
  } catch (_) {}
  return 'price_low';
}

function persistDashboardSort(key) {
  try {
    if (key && DASHBOARD_SORT_MODES.has(key)) localStorage.setItem('app_dashboard_sort', key);
  } catch (_) {}
}

function getDashboardSortSelectEl() {
  return document.getElementById('app-dashboard-sort');
}

function getDashboardSortMode() {
  const wrap = getDashboardSortSelectEl();
  if (wrap) {
    const v = wrap.getAttribute('data-sort');
    if (v && DASHBOARD_SORT_MODES.has(v)) return v;
  }
  return readStoredDashboardSort();
}

function syncDashboardSortSheetSelection(mode) {
  const menu = document.getElementById('app-dashboard-sort-menu');
  if (!menu) return;
  menu.querySelectorAll('.app-dashboard-sort-option').forEach(function (btn) {
    const v = btn.getAttribute('data-sort');
    btn.setAttribute('aria-selected', v === mode ? 'true' : 'false');
  });
}

function syncDashboardColumnHeaderSortState(mode) {
  const thRegion = document.getElementById('app-dashboard-th-region-col');
  const thPrice = document.getElementById('app-dashboard-th-price-col');
  const thPeriod = document.getElementById('app-dashboard-th-period-col');
  const regionBtn = document.getElementById('app-dashboard-th-region');
  const priceBtn = document.getElementById('app-dashboard-th-price');
  const periodTrigger = document.getElementById('app-dashboard-period-trigger');
  [thRegion, thPrice, thPeriod].forEach(function (th) {
    if (th) th.removeAttribute('aria-sort');
  });
  if (regionBtn) regionBtn.classList.remove('app-dashboard-col-head-btn--active');
  if (priceBtn) priceBtn.classList.remove('app-dashboard-col-head-btn--active');
  if (periodTrigger) periodTrigger.classList.remove('app-dashboard-period-btn--active');
  if (mode === 'region_az' || mode === 'region_za') {
    if (regionBtn) regionBtn.classList.add('app-dashboard-col-head-btn--active');
  } else if (mode === 'price_low' || mode === 'price_high') {
    if (priceBtn) priceBtn.classList.add('app-dashboard-col-head-btn--active');
  } else if (mode === 'change_high' || mode === 'change_low') {
    if (periodTrigger) periodTrigger.classList.add('app-dashboard-period-btn--active');
  }
  if (mode === 'region_az' && thRegion) thRegion.setAttribute('aria-sort', 'ascending');
  else if (mode === 'region_za' && thRegion) thRegion.setAttribute('aria-sort', 'descending');
  else if (mode === 'price_low' && thPrice) thPrice.setAttribute('aria-sort', 'ascending');
  else if (mode === 'price_high' && thPrice) thPrice.setAttribute('aria-sort', 'descending');
  else if (mode === 'change_low' && thPeriod) thPeriod.setAttribute('aria-sort', 'ascending');
  else if (mode === 'change_high' && thPeriod) thPeriod.setAttribute('aria-sort', 'descending');
}

function applyDashboardSort(mode) {
  if (!DASHBOARD_SORT_MODES.has(mode)) return;
  const wrap = getDashboardSortSelectEl();
  if (!wrap) return;
  const labelEl = wrap.querySelector('.app-dashboard-sort-trigger-label');
  const iconWrap = wrap.querySelector('.app-dashboard-sort-trigger-icon');
  if (!labelEl || !iconWrap) return;
  wrap.setAttribute('data-sort', mode);
  labelEl.textContent = DASHBOARD_SORT_DISPLAY_LABELS[mode] || mode;
  iconWrap.hidden = !dashboardSortUsesIcon(mode);
  persistDashboardSort(mode);
  syncDashboardSortSheetSelection(mode);
  syncDashboardColumnHeaderSortState(mode);
  if (_dashboardDataCache) renderAppDashboardTbody();
}

function wireAppDashboardSortSelect() {
  const wrap = getDashboardSortSelectEl();
  const trigger = document.getElementById('app-dashboard-sort-trigger');
  const sheet = document.getElementById('app-dashboard-sort-sheet');
  const backdrop = document.getElementById('app-dashboard-sort-backdrop');
  const handle = document.getElementById('app-dashboard-sort-sheet-handle');
  const menu = document.getElementById('app-dashboard-sort-menu');
  const labelEl = wrap && wrap.querySelector('.app-dashboard-sort-trigger-label');
  const iconWrap = wrap && wrap.querySelector('.app-dashboard-sort-trigger-icon');
  if (!wrap || !trigger || !sheet || !backdrop || !menu || !labelEl || !iconWrap || _dashboardSortBound) return;
  _dashboardSortBound = true;

  function syncFromStorage() {
    applyDashboardSort(readStoredDashboardSort());
  }

  function openMenu() {
    dashboardCloseFuelSheetIfOpen();
    dashboardCloseCountrySheetIfOpen();
    dashboardClosePeriodSheetIfOpen();
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    dashboardSheetsSyncBodyScroll();
  }

  function closeMenu() {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    dashboardSheetsSyncBodyScroll();
  }

  function toggleMenu() {
    if (sheet.hidden) openMenu();
    else closeMenu();
  }

  syncFromStorage();

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  backdrop.addEventListener('click', function () {
    closeMenu();
  });

  if (handle) {
    handle.addEventListener('click', function () {
      closeMenu();
    });
  }

  menu.querySelectorAll('.app-dashboard-sort-option').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const raw = btn.getAttribute('data-sort');
      const v = raw != null ? String(raw).trim() : '';
      if (!DASHBOARD_SORT_MODES.has(v)) return;
      applyDashboardSort(v);
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    });
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !sheet.hidden) {
      closeMenu();
      try {
        trigger.focus();
      } catch (_) {}
    }
  });
}

function dashboardCountryName(cid) {
  const c = typeof COUNTRIES !== 'undefined' && COUNTRIES[+cid];
  return (c && c.name) || `Country ${cid}`;
}

/** Latest spot in USD/L for sorting (matches dashboard spot column). */
function dashboardLatestUsdForSort(seriesAsc, priceKey, sym) {
  if (!seriesAsc || !seriesAsc.length) return null;
  let latestVal = null;
  for (let i = seriesAsc.length - 1; i >= 0; i--) {
    const v = asNum(seriesAsc[i][priceKey]);
    if (v != null && Number.isFinite(v)) {
      latestVal = v;
      break;
    }
  }
  if (latestVal == null) return null;
  const m = getAppUsdMultiplier(sym);
  if (m == null || !Number.isFinite(m)) return null;
  return latestVal * m;
}

function compareDashboardSortRows(a, b, mode) {
  const tie = a.originalIndex - b.originalIndex;
  if (mode === 'default') return tie;
  const la = String(a.displayLabel != null ? a.displayLabel : a.row.label || '');
  const lb = String(b.displayLabel != null ? b.displayLabel : b.row.label || '');
  if (mode === 'region_az') return la.localeCompare(lb, undefined, { sensitivity: 'base' }) || tie;
  if (mode === 'region_za') return lb.localeCompare(la, undefined, { sensitivity: 'base' }) || tie;
  if (mode === 'price_low') {
    const av = a.usdSort;
    const bv = b.usdSort;
    if (av == null && bv == null) return tie;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv || tie;
  }
  if (mode === 'price_high') {
    const av = a.usdSort;
    const bv = b.usdSort;
    if (av == null && bv == null) return tie;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || tie;
  }
  if (mode === 'change_high') {
    const av = a.pctSort;
    const bv = b.pctSort;
    if (av == null && bv == null) return tie;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || tie;
  }
  if (mode === 'change_low') {
    const av = a.pctSort;
    const bv = b.pctSort;
    if (av == null && bv == null) return tie;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv || tie;
  }
  return tie;
}

function renderAppDashboardTbody() {
  const tbody = document.getElementById('app-dashboard-tbody');
  const statusEl = document.getElementById('app-dashboard-status');
  if (!tbody || !_dashboardDataCache) return;
  const { list: fullList, caches } = _dashboardDataCache;
  let list = fullList;
  const countryFilterId = getDashboardCountryFilterId();
  if (countryFilterId != null) {
    list = list.filter((r) => +r.countryId === +countryFilterId);
  }
  const period = getDashboardPeriodKey();
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();
  const fuelPreset = getDashboardFuelPreset();
  const fuelLabel = DASHBOARD_FUEL_STATUS_LABELS[fuelPreset] || '';
  const sortMode = getDashboardSortMode();
  const sortLabel = DASHBOARD_SORT_STATUS_LABELS[sortMode] || '';
  const countryStatus =
    countryFilterId == null ? 'all countries' : `${dashboardCountryName(countryFilterId)} only`;

  const rowJobs =
    fuelPreset === 'all'
      ? list.flatMap((row) => DASHBOARD_FUEL_PRESETS_ALL.map((p) => ({ row, preset: p })))
      : list.map((row) => ({ row, preset: fuelPreset }));

  let enriched = rowJobs.map((job, originalIndex) => {
    const { row, preset } = job;
    const meta = dashboardFuelMetaForRow(row, preset);
    const displayLabel = dashboardRowDisplayLabel(row, preset);
    const series = dashboardFilterSeries(row, caches);
    const st = dashboardRowStats(series, meta.key, meta.sym, meta.dec);
    const usdSort = dashboardLatestUsdForSort(series, meta.key, meta.sym);
    const pctSort = dashboardPctForPeriod(st, period);
    return { row, originalIndex, st, usdSort, pctSort, displayLabel, priceKey: meta.key };
  });
  enriched = enriched.filter((e) => dashboardRowHasUsdSpot(e.st));
  if (fuelPreset === 'all') {
    const seen = new Set();
    enriched = enriched.filter((e) => {
      const key = `${e.row.countryId}|${e.row.myRegion || ''}|${e.row.sgProvider || ''}|${e.row.idCity || ''}|${e.row.province || ''}|${e.priceKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  enriched.sort((a, b) => compareDashboardSortRows(a, b, sortMode));

  enriched.forEach((item, displayIdx) => {
    const { row, st, displayLabel } = item;
    const tr = document.createElement('tr');
    const tdRank = document.createElement('td');
    tdRank.className = 'app-dashboard-td app-dashboard-td--rank';
    tdRank.textContent = String(displayIdx + 1);
    const tdName = document.createElement('td');
    tdName.className = 'app-dashboard-td app-dashboard-td--name';
    const regionWrap = document.createElement('div');
    regionWrap.className = 'app-dashboard-region-cell';
    const flagEl = document.createElement('span');
    flagEl.setAttribute('aria-hidden', 'true');
    const iso2 = dashboardFlagIso2ForCountryId(row.countryId);
    if (iso2) {
      flagEl.className = `app-dashboard-flag fi fi-${iso2}`;
    } else {
      flagEl.className = 'app-dashboard-flag app-dashboard-flag--placeholder';
      flagEl.dataset.countryId = String(row.countryId != null ? row.countryId : '');
    }
    const regionLabel = document.createElement('span');
    regionLabel.className = 'app-dashboard-region-label';
    regionLabel.textContent = String(displayLabel != null ? displayLabel : row.label || '');
    regionWrap.appendChild(flagEl);
    regionWrap.appendChild(regionLabel);
    tdName.appendChild(regionWrap);
    const tdPrice = document.createElement('td');
    tdPrice.className = 'app-dashboard-td app-dashboard-td--price';
    tdPrice.textContent = st.spot;
    const tdChg = document.createElement('td');
    tdChg.className = 'app-dashboard-td app-dashboard-td--chg';
    tdChg.innerHTML = dashboardPctCellHtml(dashboardPctForPeriod(st, period));
    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdChg);
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  if (statusEl) {
    const shown = enriched.length;
    statusEl.textContent = `${shown} regions · ${countryStatus} · ${fuelLabel} · sort: ${sortLabel} · prices USD/L · sheet/API columns vary by market`;
  }
}

function dashboardFindValueAtOrBefore(sortedAsc, priceKey, targetMs) {
  for (let i = sortedAsc.length - 1; i >= 0; i--) {
    const t = parseRowDateMs(sortedAsc[i].date);
    if (!Number.isFinite(t) || t > targetMs) continue;
    const v = asNum(sortedAsc[i][priceKey]);
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

/** UTC midnight 1 Jan of the calendar year containing `ms` (matches {@link parseRowDateMs}). */
function dashboardYearStartUtcMs(ms) {
  if (!Number.isFinite(ms)) return NaN;
  const y = new Date(ms).getUTCFullYear();
  return Date.UTC(y, 0, 1);
}

function dashboardPctChange(latest, past) {
  if (!Number.isFinite(latest) || !Number.isFinite(past) || past === 0) return null;
  return ((latest - past) / past) * 100;
}

function dashboardPctCellHtml(p) {
  if (p == null || !Number.isFinite(p)) return '<span class="app-dsh-pct app-dsh-pct--na">—</span>';
  const up = p > 0.0001;
  const down = p < -0.0001;
  const arrow = up ? '▲' : down ? '▼' : '';
  const cls = up ? 'app-dsh-pct app-dsh-pct--up' : down ? 'app-dsh-pct app-dsh-pct--down' : 'app-dsh-pct app-dsh-pct--flat';
  const s = `${Math.abs(p).toFixed(1)}%`;
  return `<span class="${cls}">${arrow} ${s}</span>`;
}

function dashboardPriceMetaForRow(row) {
  const cid = +row.countryId;
  if (cid === 458) {
    return row.myRegion === 'SabahSarawak'
      ? { key: 'diesel_eastmsia', sym: 'MYR', dec: 2 }
      : { key: 'ron95', sym: 'MYR', dec: 2 };
  }
  if (cid === 702) return { key: 'ron95', sym: 'SGD', dec: 2 };
  if (cid === 96) return { key: 'gasoline', sym: 'BND', dec: 2 };
  if (cid === 764) return { key: 'gasohol_95', sym: 'THB', dec: 2 };
  if (cid === 608) return { key: 'ron95', sym: 'PHP', dec: 2 };
  if (cid === 360) return { key: 'pertalite', sym: 'IDR', dec: 0 };
  if (cid === 116) return { key: 'ron92', sym: 'KHR', dec: 0 };
  if (cid === 104) return { key: 'ron92', sym: 'MMK', dec: 0 };
  if (cid === 704) return { key: 'ron95_v', sym: 'VND', dec: 0 };
  if (cid === 418) return { key: 'gasoline', sym: 'LAK', dec: 0 };
  return { key: 'ron95', sym: 'MYR', dec: 2 };
}

/**
 * Maps a dashboard fuel preset to sheet/API column keys (see app highlights + config fuel lists).
 * Unknown presets fall back to mid-grade.
 */
function dashboardFuelMetaForRow(row, preset) {
  const p = ['mid', 'premium', 'entry', 'diesel', 'premium_diesel'].includes(preset) ? preset : 'mid';
  const cid = +row.countryId;
  const myEast = cid === 458 && row.myRegion === 'SabahSarawak';

  if (p === 'premium_diesel') {
    if (cid === 96) return { key: 'vpower_diesel', sym: 'BND', dec: 2 };
    if (cid === 360) return { key: 'pertamina_dex', sym: 'IDR', dec: 0 };
    return { key: '__none__', sym: 'USD', dec: 2 };
  }

  if (cid === 458) {
    if (p === 'diesel') return { key: myEast ? 'diesel_eastmsia' : 'diesel', sym: 'MYR', dec: 2 };
    if (p === 'mid') return { key: 'ron95', sym: 'MYR', dec: 2 };
    if (p === 'premium') return { key: 'ron97', sym: 'MYR', dec: 2 };
    if (p === 'entry') return { key: 'ron95_budi95', sym: 'MYR', dec: 2 };
    return { key: 'ron95', sym: 'MYR', dec: 2 };
  }
  if (cid === 702) {
    if (p === 'diesel') return { key: 'diesel', sym: 'SGD', dec: 2 };
    if (p === 'mid') return { key: 'ron95', sym: 'SGD', dec: 2 };
    if (p === 'premium') return { key: 'ron98', sym: 'SGD', dec: 2 };
    if (p === 'entry') return { key: 'ron92', sym: 'SGD', dec: 2 };
    return { key: 'ron95', sym: 'SGD', dec: 2 };
  }
  if (cid === 96) {
    if (p === 'diesel') return { key: 'diesel', sym: 'BND', dec: 2 };
    if (p === 'entry') return { key: 'gasoline', sym: 'BND', dec: 2 };
    if (p === 'mid') return { key: 'gasoline_premium', sym: 'BND', dec: 2 };
    if (p === 'premium') return { key: 'vpower_gasoline', sym: 'BND', dec: 2 };
    return { key: 'gasoline', sym: 'BND', dec: 2 };
  }
  if (cid === 764) {
    if (p === 'diesel') return { key: 'diesel', sym: 'THB', dec: 2 };
    if (p === 'mid') return { key: 'gasohol_95', sym: 'THB', dec: 2 };
    if (p === 'premium') return { key: 'e85', sym: 'THB', dec: 2 };
    if (p === 'entry') return { key: 'gasohol_91', sym: 'THB', dec: 2 };
    return { key: 'gasohol_95', sym: 'THB', dec: 2 };
  }
  if (cid === 608) {
    if (p === 'diesel') return { key: 'diesel', sym: 'PHP', dec: 2 };
    if (p === 'mid') return { key: 'ron95', sym: 'PHP', dec: 2 };
    if (p === 'premium') return { key: 'ron95', sym: 'PHP', dec: 2 };
    if (p === 'entry') return { key: 'ron91', sym: 'PHP', dec: 2 };
    return { key: 'ron95', sym: 'PHP', dec: 2 };
  }
  if (cid === 360) {
    if (p === 'diesel') return { key: 'dexlite', sym: 'IDR', dec: 0 };
    if (p === 'entry') return { key: 'pertalite', sym: 'IDR', dec: 0 };
    if (p === 'mid') return { key: 'pertamax', sym: 'IDR', dec: 0 };
    if (p === 'premium') return { key: 'pertamax_turbo', sym: 'IDR', dec: 0 };
    return { key: 'pertalite', sym: 'IDR', dec: 0 };
  }
  if (cid === 116) {
    if (p === 'diesel') return { key: 'diesel', sym: 'KHR', dec: 0 };
    if (p === 'mid' || p === 'premium' || p === 'entry') return { key: 'ron92', sym: 'KHR', dec: 0 };
    return { key: 'ron92', sym: 'KHR', dec: 0 };
  }
  if (cid === 104) {
    if (p === 'diesel') return { key: 'diesel', sym: 'MMK', dec: 0 };
    if (p === 'mid') return { key: 'ron95', sym: 'MMK', dec: 0 };
    if (p === 'premium') return { key: 'ron95', sym: 'MMK', dec: 0 };
    if (p === 'entry') return { key: 'ron92', sym: 'MMK', dec: 0 };
    return { key: 'ron95', sym: 'MMK', dec: 0 };
  }
  if (cid === 704) {
    if (p === 'diesel') return { key: 'diesel_euro5', sym: 'VND', dec: 0 };
    if (p === 'mid') return { key: 'ron95_v', sym: 'VND', dec: 0 };
    if (p === 'premium') return { key: 'ron95_iii', sym: 'VND', dec: 0 };
    if (p === 'entry') return { key: 'ron92_ii', sym: 'VND', dec: 0 };
    return { key: 'ron95_v', sym: 'VND', dec: 0 };
  }
  if (cid === 418) {
    if (p === 'diesel') return { key: 'diesel', sym: 'LAK', dec: 0 };
    if (p === 'mid') return { key: 'gasoline_95', sym: 'LAK', dec: 0 };
    if (p === 'premium') return { key: 'gasoline_95', sym: 'LAK', dec: 0 };
    if (p === 'entry') return { key: 'gasoline', sym: 'LAK', dec: 0 };
    return { key: 'gasoline_95', sym: 'LAK', dec: 0 };
  }
  return { key: 'ron95', sym: 'MYR', dec: 2 };
}

/** Short fuel name for the Region column: `Country - Place (this)`. Keys match {@link dashboardFuelMetaForRow}. */
var DASHBOARD_FUEL_TYPE_LABELS = {
  diesel: 'Diesel',
  diesel_eastmsia: 'Diesel',
  diesel_euro5: 'Diesel Euro 5',
  diesel_euro2: 'Diesel Euro 2',
  ron95: 'RON95',
  ron97: 'RON97',
  /** data.gov.my `ron95_budi95` — subsidised BUDI tier, not standard pump RON95 */
  ron95_budi95: 'BUDI95',
  ron92: 'RON92',
  ron91: 'RON91',
  ron98: 'RON98',
  gasoline: 'Gasoline',
  gasoline_premium: 'Premium (RON 95)',
  vpower_gasoline: 'V-Power (RON 97)',
  gasohol_95: 'Gasohol 95',
  gasohol_91: 'Gasohol 91',
  e85: 'E85',
  pertalite: 'Pertalite 90',
  pertamax: 'Pertamax 92',
  pertamax_turbo: 'Pertamax Turbo 98',
  dexlite: 'Dexlite',
  pertamina_dex: 'Pertamina Dex',
  ron95_v: 'RON95 (V)',
  ron95_iii: 'RON95 (III)',
  ron92_ii: 'RON92 (II)',
  gasoline_95: 'Gasoline 95',
};

function dashboardFuelTypeShortLabel(priceKey, countryId) {
  const k = String(priceKey || '');
  const cid = countryId != null ? +countryId : NaN;
  if (cid === 96) {
    const bn = {
      gasoline: 'Regular (RON 91)',
      gasoline_premium: 'Premium (RON 95)',
      vpower_gasoline: 'V-Power (RON 97)',
      diesel: 'Diesel',
      vpower_diesel: 'V-Power Diesel',
    };
    if (Object.prototype.hasOwnProperty.call(bn, k)) return bn[k];
  }
  const lab = DASHBOARD_FUEL_TYPE_LABELS[k];
  if (lab) return lab;
  return k ? k.replace(/_/g, ' ') : '—';
}

/**
 * Region / provider / city segment between country and fuel type — from row fields (not `row.label`).
 */
function dashboardRegionOrProviderPart(row) {
  const cid = +row.countryId;
  if (cid === 458) {
    const hit = typeof MY_REGIONS !== 'undefined' && MY_REGIONS.find((r) => r.key === row.myRegion);
    return hit ? hit.label : 'National';
  }
  if (cid === 702) {
    const p = row.sgProvider != null && String(row.sgProvider).trim();
    return p || 'National';
  }
  if (cid === 360) {
    const c = row.idCity != null && String(row.idCity).trim();
    return c || 'National';
  }
  if (cid === 104) {
    const r = normalizeSheetString(row.mmRegion || '');
    return r || 'National';
  }
  if (cid === 704) {
    const a = row.vnArea;
    if (a == null || a === '') return 'National';
    const s = typeof a === 'string' ? a.trim() : a;
    if (s === '') return 'National';
    return labelVietnamArea(a);
  }
  if (cid === 418) {
    const p = row.laProvince != null && String(row.laProvince).trim();
    return p || 'National';
  }
  if (cid === 96 || cid === 764 || cid === 608 || cid === 116) return 'National';
  return 'National';
}

/** `Malaysia - Semenanjung (RON95)` — reflects chosen petrol type (entry / mid / premium / diesel). */
function dashboardRowDisplayLabel(row, fuelPreset) {
  const country = dashboardCountryName(+row.countryId);
  const place = dashboardRegionOrProviderPart(row);
  const meta = dashboardFuelMetaForRow(row, fuelPreset);
  const ft = dashboardFuelTypeShortLabel(meta.key, row.countryId);
  return `${country} - ${place} (${ft})`;
}

/** Dashboard table always shows spot prices in USD/L (Currency sheet / USD_RATES); `decimals` unused but kept for callers. */
function dashboardFormatSpot(sym, value, decimals) {
  const x = parseFloat(String(value == null ? '' : value).replace(/,/g, '').trim());
  if (!Number.isFinite(x)) return '—';
  const m = getAppUsdMultiplier(sym);
  if (m == null) return '—';
  return `$${formatNumberCommas(x * m, 2, 2)}/L`;
}

function dashboardFilterSeries(row, c) {
  const cid = +row.countryId;
  if (cid === 458) return sortRowsByDate(c.myRows || []);
  if (cid === 702) {
    let r = c.sgRows || [];
    if (row.sgProvider) {
      const want = normalizeSheetString(row.sgProvider);
      r = r.filter((x) => normalizeSheetString(x.provider) === want);
    }
    return sortRowsByDate(r);
  }
  if (cid === 96) return sortRowsByDate(c.bnRows || []);
  if (cid === 764) return sortRowsByDate(c.thRows || []);
  if (cid === 608) return sortRowsByDate(c.phRows || []);
  if (cid === 360) {
    const city = normalizeSheetString(row.idCity || '');
    const r = (c.idRows || []).filter((x) => normalizeSheetString(x.city) === city);
    return sortRowsByDate(r);
  }
  if (cid === 116) return sortRowsByDate(c.khRows || []);
  if (cid === 104) {
    const reg = normalizeSheetString(row.mmRegion || '');
    const r = reg ? (c.mmRows || []).filter((x) => normalizeSheetString(x.region) === reg) : c.mmRows || [];
    return sortRowsByDate(r);
  }
  if (cid === 704) {
    let r = c.vnRows || [];
    if (row.vnArea) {
      const want = canonVietnamAreaKey(row.vnArea);
      r = r.filter((x) => canonVietnamAreaKey(x.area) === want);
    }
    return sortRowsByDate(r);
  }
  if (cid === 418) {
    const pn = normalizeSheetString(row.laProvince || '');
    const r = (c.laRows || []).filter((x) => normalizeSheetString(x.province) === pn);
    return sortRowsByDate(r);
  }
  return [];
}

function dashboardRowStats(seriesAsc, priceKey, sym, dec) {
  if (!seriesAsc.length) {
    return { spot: '—', w: null, m: null, mo3: null, ytd: null, y: null };
  }
  let latestVal = null;
  let latestMs = NaN;
  for (let i = seriesAsc.length - 1; i >= 0; i--) {
    const v = asNum(seriesAsc[i][priceKey]);
    if (v == null || !Number.isFinite(v)) continue;
    latestVal = v;
    latestMs = parseRowDateMs(seriesAsc[i].date);
    break;
  }
  if (!Number.isFinite(latestMs) || latestVal == null) {
    return { spot: '—', w: null, m: null, mo3: null, ytd: null, y: null };
  }
  const wPast = dashboardFindValueAtOrBefore(seriesAsc, priceKey, latestMs - 7 * MS_PER_DAY);
  const mPast = dashboardFindValueAtOrBefore(seriesAsc, priceKey, latestMs - 30 * MS_PER_DAY);
  const mo3Past = dashboardFindValueAtOrBefore(seriesAsc, priceKey, latestMs - 90 * MS_PER_DAY);
  const ytdPast = dashboardFindValueAtOrBefore(seriesAsc, priceKey, dashboardYearStartUtcMs(latestMs));
  const yPast = dashboardFindValueAtOrBefore(seriesAsc, priceKey, latestMs - 365 * MS_PER_DAY);
  return {
    spot: dashboardFormatSpot(sym, latestVal, dec),
    w: dashboardPctChange(latestVal, wPast),
    m: dashboardPctChange(latestVal, mPast),
    mo3: dashboardPctChange(latestVal, mo3Past),
    ytd: dashboardPctChange(latestVal, ytdPast),
    y: dashboardPctChange(latestVal, yPast),
  };
}

/** Rows with no sheet price or no USD conversion show em dash — omit them from the table. */
function dashboardRowHasUsdSpot(st) {
  const s = st && st.spot;
  if (s == null) return false;
  const t = String(s).trim();
  if (t === '' || t === '\u2014' || t === '-') return false;
  return true;
}

async function preloadDashboardCaches() {
  const [
    myRows,
    sgRows,
    bnRows,
    thRows,
    phRows,
    idRows,
    khRows,
    laRows,
    mmRows,
    vnRows,
  ] = await Promise.all([
    ensureMalaysiaRows().catch(() => []),
    ensureSheetRows(SG_SHEET_URL).catch(() => []),
    ensureSheetRows(BN_SHEET_URL).catch(() => []),
    ensureSheetRows(TH_SHEET_URL).catch(() => []),
    ensureSheetRows(PH_SHEET_URL).catch(() => []),
    ensureSheetRows(ID_SHEET_URL).catch(() => []),
    ensureSheetRows(KH_SHEET_URL).catch(() => []),
    ensureSheetRows(LA_SHEET_URL).catch(() => []),
    ensureSheetRows(MM_SHEET_URL).catch(() => []),
    ensureSheetRows(VN_SHEET_URL).catch(() => []),
  ]);
  return { myRows, sgRows, bnRows, thRows, phRows, idRows, khRows, laRows, mmRows, vnRows };
}

async function loadAndRenderAppDashboard() {
  const tbody = document.getElementById('app-dashboard-tbody');
  const statusEl = document.getElementById('app-dashboard-status');
  if (!tbody) return;
  wireAppDashboardFuelSelect();
  wireAppDashboardCountryFilter();
  wireAppDashboardPeriodSelect();
  wireAppDashboardSortSelect();
  wireAppDashboardColumnHeaders();
  tbody.innerHTML = '';
  if (statusEl) statusEl.textContent = 'Loading…';
  try {
    const list = await buildSearchRegionsList();
    const caches = await preloadDashboardCaches();
    _dashboardDataCache = { list, caches };
    renderAppDashboardTbody();
  } catch (e) {
    console.error(e);
    _dashboardDataCache = null;
    tbody.innerHTML =
      '<tr><td colspan="4" class="app-dashboard-td app-dashboard-td--err">Could not load prices. Check connection and try again.</td></tr>';
    if (statusEl) statusEl.textContent = '';
  }
}
