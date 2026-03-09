/* ============================================================
   MY FUEL PRICE — app.js
   Malaysia live fuel prices from api.data.gov.my
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────
const API_URL    = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&sort=-date&limit=52';
const REFRESH_MS = 60_000;

// regionAlt: field to use when region = 'east'. undefined = same price both regions.
const FUEL_KEYS = [
  { key: 'ron95_budi95', icon: '⭐', accent: '#b478ff', lightAccent: '#9333ea', label: 'BUDI95' },
  { key: 'ron95',        icon: '🟢', accent: '#00ff64', lightAccent: '#16a34a' },
  { key: 'ron97',        icon: '🔵', accent: '#00d4ff', lightAccent: '#0ea5e9' },
  { key: 'diesel',       icon: '🟠', accent: '#ffaa00', lightAccent: '#ea580c', regionAlt: 'diesel_eastmsia' },
];

// ── EV Charging Data ─────────────────────────────────────────────
// Peninsular: ChargEV (TNB) — update manually if rates change
// East MY: Gentari × SEB — DC only (no AC rate published). Source: SoyaCincau
const EV_RATES = {
  peninsular: {
    ac: { rate: 0.90, label: 'AC Slow', labelBM: 'AC Perlahan' },
    dc: { rate: 1.40, label: 'DC Fast', labelBM: 'DC Pantas'   },
    provider: 'ChargEV (TNB)',
  },
  east: {
    dc: { rate: 1.40, label: 'DC Fast', labelBM: 'DC Pantas' },
    provider: 'Gentari × SEB',
  },
};
const EV_KM_PER_KWH = 6; // avg efficiency for Malaysia conditions

// ── International Price Data ──────────────────────────────────────
// UPDATE WEEKLY each Wednesday — native currency per litre
// Starts Sep 2025 (when BUDI95 launched) — add new row each Wed, drop oldest
const INTL_WEEKS = [
  '2025-10-01', '2025-10-08', '2025-10-15', '2025-10-22', '2025-10-29',
  '2025-11-05', '2025-11-12', '2025-11-19', '2025-11-26',
  '2025-12-03', '2025-12-10', '2025-12-17', '2025-12-24', '2025-12-31',
  '2026-01-07', '2026-01-14', '2026-01-21', '2026-01-28',
  '2026-02-04', '2026-02-11', '2026-02-18', '2026-02-25',
  '2026-03-04',
];

const INTL_PRICES = {
  // GBP/litre (UK unleaded)
  uk: [
    1.47, 1.47, 1.46, 1.45, 1.44,
    1.45, 1.46, 1.47, 1.48,
    1.48, 1.49, 1.50, 1.50, 1.49,
    1.48, 1.47, 1.46, 1.45,
    1.44, 1.46, 1.48, 1.47,
    1.45,
  ],
  // AUD/litre (Australia regular unleaded)
  au: [
    1.92, 1.95, 1.90, 1.86, 1.83,
    1.88, 1.93, 1.97, 1.94,
    1.91, 1.89, 1.86, 1.88, 1.91,
    1.95, 1.88, 1.85, 1.87,
    1.90, 1.93, 1.91, 1.88,
    1.90,
  ],
  // SGD/litre (Singapore RON 95)
  sg: [
    2.70, 2.68, 2.66, 2.64, 2.63,
    2.65, 2.67, 2.68, 2.70,
    2.71, 2.69, 2.67, 2.65, 2.63,
    2.65, 2.68, 2.71, 2.69,
    2.65, 2.63, 2.66, 2.70,
    2.72,
  ],
};

// Per-series chart config (en/bm labels + light/dark colors)
const INTL_SERIES = [
  { key: 'budi95', en: 'BUDI95 (Malaysia)',  bm: 'BUDI95 (Malaysia)',  color: '#b478ff', lightColor: '#9333ea', width: 3 },
  { key: 'sg',     en: 'Singapore',           bm: 'Singapura',          color: '#ff4466', lightColor: '#ef4444', width: 2 },
  { key: 'au',     en: 'Australia',           bm: 'Australia',          color: '#00ff64', lightColor: '#16a34a', width: 2 },
  { key: 'uk',     en: 'United Kingdom',      bm: 'United Kingdom',     color: '#00d4ff', lightColor: '#0ea5e9', width: 2 },
];

// ── i18n ─────────────────────────────────────────────────────────
const I18N = {
  en: {
    subtitle:    'Malaysia Live Fuel Prices',
    lastUpdated: 'Last Updated',
    nextUpdate:  'Next Update',
    dataSource:  'Data source',
    unchanged:   'Unchanged',
    loading:     'Fetching live data…',
    error:       'Failed to load data. Retrying…',
    peninsular:  'SEMENANJUNG',
    eastMY:      'SABAH/SARAWAK',
    fuelNames: {
      ron95:           'RON95 Petrol',
      ron97:           'RON97 Petrol',
      diesel:          'Diesel',
      diesel_eastmsia: 'Diesel (East Malaysia)',
      ron95_budi95:    'BUDI95 Subsidised',
    },
    fuelSubs: {
      ron95:           'Malaysia-Wide',
      ron95_skps:      'East Malaysia (SKPS)',
      ron97:           'Malaysia-Wide',
      diesel:          'Semenanjung',
      diesel_eastmsia: 'Sarawak, Sabah & Labuan',
      ron95_budi95:    'Malaysia-Wide',
    },
    myRegion:     'My Region',
    regionHint:   'Affects RON95, RON97 & Diesel',
    tagline:      'Built with open government data. Free & open source forever.',
    viewOnGithub: 'View on GitHub',
    openSource:   'Open Source',
    mitLicense:   'MIT License',
    creditLine:     'Data sourced from the Official Malaysia Open Data Portal — data.gov.my, provided by the Ministry of Finance (MOF) Malaysia',
    intlTitle:      'Global Price Comparison (RM/L)',
    intlDisclaimer: 'International prices updated weekly. Source: GlobalPetrolPrices.com',
    intlRateNote:   'Live exchange rates via exchangerate-api.com',
    evName:         'EV Charging',
    evSub:          'ChargEV (TNB)',
    evAC:           'AC SLOW',
    evDC:           'DC FAST',
    evNote:         'Indicative · rate varies by provider & location',
    evCompareSub:   'per 100km · EV @ 6km/kWh · Petrol @ 10L/100km',
  },
  bm: {
    subtitle:    'Harga Minyak Malaysia Terkini',
    lastUpdated: 'Kemaskini Terakhir',
    nextUpdate:  'Kemaskini Seterusnya',
    dataSource:  'Sumber data',
    unchanged:   'Harga tidak berubah',
    loading:     'Mendapatkan data terkini…',
    error:       'Gagal memuatkan data. Cuba semula…',
    peninsular:  'SEMENANJUNG',
    eastMY:      'SABAH/SARAWAK',
    fuelNames: {
      ron95:           'Petrol RON95',
      ron97:           'Petrol RON97',
      diesel:          'Diesel',
      diesel_eastmsia: 'Diesel (Malaysia Timur)',
      ron95_budi95:    'BUDI95 Bersubsidi',
    },
    fuelSubs: {
      ron95:           'Seluruh Malaysia',
      ron95_skps:      'Malaysia Timur (SKPS)',
      ron97:           'Seluruh Malaysia',
      diesel:          'Semenanjung',
      diesel_eastmsia: 'Sarawak, Sabah & Labuan',
      ron95_budi95:    'Seluruh Malaysia',
    },
    myRegion:     'Kawasan Saya',
    regionHint:   'Mempengaruhi RON95, RON97 & Diesel',
    tagline:      'Dibina dengan data kerajaan terbuka. Percuma & sumber terbuka selama-lamanya.',
    viewOnGithub: 'Lihat di GitHub',
    openSource:   'Sumber Terbuka',
    mitLicense:   'Lesen MIT',
    creditLine:     'Data bersumber dari Portal Data Terbuka Rasmi Malaysia — data.gov.my, disediakan oleh Kementerian Kewangan (MOF) Malaysia',
    intlTitle:      'Perbandingan Harga Antarabangsa (RM/L)',
    intlDisclaimer: 'Harga antarabangsa dikemaskini setiap minggu. Sumber: GlobalPetrolPrices.com',
    intlRateNote:   'Kadar tukaran langsung melalui exchangerate-api.com',
    evName:         'Cas EV',
    evSub:          'ChargEV (TNB)',
    evAC:           'AC PERLAHAN',
    evDC:           'DC PANTAS',
    evNote:         'Anggaran · kadar berbeza mengikut pembekal & lokasi',
    evCompareSub:   'per 100km · EV @ 6km/kWh · Minyak @ 10L/100km',
  },
};

// ── State ────────────────────────────────────────────────────────
let currentLang    = localStorage.getItem('lang')      || 'en';
let selectedRegion = localStorage.getItem('region')    || 'peninsular';
let currentTheme   = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
let rawData        = [];
let charts        = {};
let refreshTimer  = null;
let countdownTimer = null;
let exchangeRates = null;
let intlChart     = null;
let evChargeType  = localStorage.getItem('evCharge') || 'ac';

// ── Theme ─────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function updateThemeBtn() {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = currentTheme === 'light' ? '☀️' : '🌙';
}

window.toggleTheme = function() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', currentTheme);
  applyTheme(currentTheme);
  updateThemeBtn();
  if (rawData.length) renderCards(rawData);
  renderIntlChart();
};

// Follow system preference only if user hasn't manually chosen
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  if (localStorage.getItem('theme')) return;
  currentTheme = e.matches ? 'light' : 'dark';
  applyTheme(currentTheme);
  updateThemeBtn();
  if (rawData.length) renderCards(rawData);
  renderIntlChart();
});

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  updateThemeBtn();
  applyLang(currentLang);
  document.getElementById('btn-en').classList.toggle('active', currentLang === 'en');
  document.getElementById('btn-bm').classList.toggle('active', currentLang === 'bm');
  document.getElementById('rbtn-peninsular').classList.toggle('active', selectedRegion === 'peninsular');
  document.getElementById('rbtn-east').classList.toggle('active', selectedRegion === 'east');
  loadData();
  loadExchangeRates();
  startCountdown();
  refreshTimer = setInterval(() => loadData(true), REFRESH_MS);
});

// ── Language ─────────────────────────────────────────────────────
window.setLang = function(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  document.getElementById('btn-bm').classList.toggle('active', lang === 'bm');
  applyLang(lang);
  if (rawData.length) renderCards(rawData);
  renderIntlChart();
};

function applyLang(lang) {
  const t = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });
  const map = {
    'footer-tagline':    'tagline',
    'footer-credit':     'creditLine',
    'github-btn-label':  'viewOnGithub',
    'open-source-label': 'openSource',
    'mit-label':         'mitLicense',
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t[key];
  });
}

// ── Region Toggle ─────────────────────────────────────────────────
window.setRegion = function(region) {
  const prevRegion = selectedRegion;
  selectedRegion   = region;
  localStorage.setItem('region', region);
  document.getElementById('rbtn-peninsular').classList.toggle('active', region === 'peninsular');
  document.getElementById('rbtn-east').classList.toggle('active', region === 'east');
  if (rawData.length) renderFuelCards(rawData, true); // fuel cards only — EV handled separately
  animateEVRegionChange(prevRegion, region);
};

// ── EV Charge Type Toggle ─────────────────────────────────────────
window.setEvCharge = function(type) {
  const regionRates = EV_RATES[selectedRegion];
  const oldRate     = regionRates[evChargeType].rate;

  evChargeType = type;
  localStorage.setItem('evCharge', type);

  // Update button active states
  document.getElementById('ev-btn-ac')?.classList.toggle('active', type === 'ac');
  document.getElementById('ev-btn-dc')?.classList.toggle('active', type === 'dc');

  const rateData    = regionRates[type];
  const newRate     = rateData.rate;
  const chargeLabel = currentLang === 'bm' ? rateData.labelBM : rateData.label;
  const accent      = currentTheme === 'light' ? '#14b8a6' : '#00ffcc';

  // Animate the rate number
  const priceEl = document.getElementById('ev-rate-value');
  if (priceEl) animateNumber(priceEl, oldRate, newRate, 2);

  // Update sub-label
  const labelEl = document.getElementById('ev-charge-label');
  if (labelEl) labelEl.textContent = `${regionRates.provider} · ${chargeLabel}`;

  // Animate cost comparison
  const ron95Price = rawData.length ? rawData[0].ron95 : null;
  const oldCost    = oldRate / EV_KM_PER_KWH * 100;
  const newCost    = newRate / EV_KM_PER_KWH * 100;
  const petrolCost = ron95Price ? ron95Price * 10 : null;
  const newPct     = petrolCost ? Math.round(newCost / petrolCost * 100) : 50;

  const barEl = document.getElementById('ev-bar-fill');
  if (barEl) barEl.style.width = `${newPct}%`;

  const costEl = document.getElementById('ev-cost-amount');
  if (costEl) animateNumber(costEl, oldCost, newCost, 2);
};

// ── Number Counter Animation ──────────────────────────────────────
function animateNumber(el, from, to, decimals, duration = 380) {
  const start = performance.now();
  function step(now) {
    const t      = Math.min((now - start) / duration, 1);
    const eased  = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out quad
    el.textContent = (from + (to - from) * eased).toFixed(decimals);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── EV Card Region Animation ──────────────────────────────────────
function animateEVRegionChange(prevRegion, newRegion) {
  const evCard = document.getElementById('ev-card');
  if (!evCard) { renderEVCard(); return; }

  const prevRates  = EV_RATES[prevRegion];
  const newRates   = EV_RATES[newRegion];
  const isEast     = newRegion === 'east';
  const prevType   = prevRegion === 'east' ? 'dc' : evChargeType;
  const newType    = isEast ? 'dc' : evChargeType;
  const oldRate    = prevRates[prevType].rate;
  const newRate    = newRates[newType].rate;
  const rateData   = newRates[newType];
  const chargeLabel = currentLang === 'bm' ? rateData.labelBM : rateData.label;
  const accent      = currentTheme === 'light' ? '#14b8a6' : '#00ffcc';

  // Sub-label (provider + charge type)
  const labelEl = document.getElementById('ev-charge-label');
  if (labelEl) labelEl.textContent = `${newRates.provider} · ${chargeLabel}`;

  // Animate rate number
  const priceEl = document.getElementById('ev-rate-value');
  if (priceEl) animateNumber(priceEl, oldRate, newRate, 2);

  // Animate cost comparison
  const ron95Price = rawData.length ? rawData[0].ron95 : null;
  const oldCost    = oldRate / EV_KM_PER_KWH * 100;
  const newCost    = newRate / EV_KM_PER_KWH * 100;
  const petrolCost = ron95Price ? ron95Price * 10 : null;
  const newPct     = petrolCost ? Math.round(newCost / petrolCost * 100) : 50;

  const barEl = document.getElementById('ev-bar-fill');
  if (barEl) barEl.style.width = `${newPct}%`;

  const costEl = document.getElementById('ev-cost-amount');
  if (costEl) animateNumber(costEl, oldCost, newCost, 2);

  // Slide AC/DC toggle in or out
  const toggleEl = evCard.querySelector('.ev-toggle');
  if (toggleEl) toggleEl.classList.toggle('ev-toggle--hidden', isEast);

  // Update AC/DC button active state (in case evChargeType changed while on east)
  document.getElementById('ev-btn-ac')?.classList.toggle('active', evChargeType === 'ac');
  document.getElementById('ev-btn-dc')?.classList.toggle('active', evChargeType === 'dc');
}

// ── Data Fetch ───────────────────────────────────────────────────
async function loadData(isRefresh = false) {
  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  statusText.textContent = I18N[currentLang].loading;
  statusDot.classList.remove('error');

  try {
    const res  = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Keep only actual price rows, not weekly-change rows
    rawData = json.filter(row => row.series_type === 'level');

    renderCards(rawData);
    setMeta(rawData);
    renderIntlChart();
    statusDot.classList.remove('error');
    statusText.textContent = 'Connected';
  } catch (err) {
    console.error('Fetch error:', err);
    statusDot.classList.add('error');
    statusText.textContent = I18N[currentLang].error;
    if (!rawData.length) {
      document.getElementById('cards-grid').innerHTML =
        `<p class="error-msg">${I18N[currentLang].error}</p>`;
    }
  }
}

// ── Meta bar ─────────────────────────────────────────────────────
function setMeta(data) {
  if (!data.length) return;
  const d    = new Date(data[0].date);
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  document.getElementById('last-updated').textContent =
    d.toLocaleDateString(currentLang === 'bm' ? 'ms-MY' : 'en-MY', opts);
}

// ── Next-update Countdown ─────────────────────────────────────────
function startCountdown() {
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const myt      = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  const day      = myt.getDay();
  const daysToWed = (3 - day + 7) % 7 || 7;
  const nextWed  = new Date(myt);
  nextWed.setDate(myt.getDate() + daysToWed);
  nextWed.setHours(0, 0, 0, 0);

  const diffMs = nextWed - myt;
  const hh = Math.floor(diffMs / 3_600_000);
  const mm = Math.floor((diffMs % 3_600_000) / 60_000);
  const ss = Math.floor((diffMs % 60_000) / 1000);
  const pad = n => String(n).padStart(2, '0');

  document.getElementById('next-update-countdown').textContent =
    `${hh}h ${pad(mm)}m ${pad(ss)}s`;
}

// ── Render Cards ─────────────────────────────────────────────────
function renderCards(data) {
  renderFuelCards(data);
  renderEVCard();
}

// Renders only the fuel price cards, preserving the EV card across re-renders
function renderFuelCards(data, skipAnimation = false) {
  const t      = I18N[currentLang];
  const grid   = document.getElementById('cards-grid');
  const evCard = document.getElementById('ev-card');

  // Capture old diesel price before clearing so we can animate it after re-render
  const oldDieselEl    = document.getElementById('price-diesel');
  const oldDieselPrice = oldDieselEl ? parseFloat(oldDieselEl.textContent) : null;

  // Remove only fuel cards — leave EV card untouched so it never re-animates
  Array.from(grid.children).forEach(child => {
    if (child.id !== 'ev-card') child.remove();
  });

  FUEL_KEYS.forEach(({ key, icon, accent, lightAccent, regionAlt, label }) => {
    const activeAccent = (currentTheme === 'light' && lightAccent) ? lightAccent : accent;
    const activeKey = (regionAlt && selectedRegion === 'east') ? regionAlt : key;

    const series = data
      .map(row => row[activeKey])
      .filter(v => v !== null && v !== undefined && v > 0)
      .slice(0, 8)
      .reverse();

    const current = series[series.length - 1];
    const prev    = series[series.length - 2];
    if (current === undefined) return;

    const diff        = prev !== undefined ? +(current - prev).toFixed(3) : 0;
    const changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrow       = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
    const changeLabel = diff === 0
      ? t.unchanged
      : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} RM`;

    const badgeStyle  = `color:${activeAccent};border-color:${activeAccent}40;background:${activeAccent}12;`;
    const displayName = t.fuelNames[key];
    const displaySub  = t.fuelSubs[activeKey] || t.fuelSubs[key];

    const card = document.createElement('div');
    card.className = 'fuel-card';
    if (skipAnimation) card.style.animation = 'none';
    card.style.setProperty('--card-accent', activeAccent);

    card.innerHTML = `
      <div class="card-header">
        <div>
          <div class="card-name">${displayName}</div>
          <div class="card-name-sub">${displaySub}</div>
        </div>
        <div class="card-header-right">
          <span class="card-type-badge" style="${badgeStyle}">${label || key.toUpperCase().replace(/_/g, ' ')}</span>
        </div>
      </div>
      <div class="card-price-row">
        <span class="card-currency">RM</span>
        <span class="card-price" style="color:${activeAccent}" ${key === 'diesel' ? 'id="price-diesel"' : ''}>${current.toFixed(2)}</span>
        <span class="card-currency">/L</span>
      </div>
      <div class="card-change ${changeClass}">
        <span class="change-arrow">${arrow}</span>
        <span>${changeLabel}</span>
      </div>
      <div class="card-chart-wrap">
        <canvas id="chart-${key}" height="64"></canvas>
      </div>
    `;

    // Insert before EV card so it stays last; insertBefore(x, null) = appendChild
    grid.insertBefore(card, evCard || null);
    requestAnimationFrame(() => renderSparkline(key, series, activeAccent));
  });

  // Animate diesel price if it changed (region switch)
  if (skipAnimation && oldDieselPrice !== null) {
    const newDieselEl = document.getElementById('price-diesel');
    if (newDieselEl) {
      const newDieselPrice = parseFloat(newDieselEl.textContent);
      if (oldDieselPrice !== newDieselPrice)
        animateNumber(newDieselEl, oldDieselPrice, newDieselPrice, 2);
    }
  }
}

// ── EV Card ───────────────────────────────────────────────────────
function renderEVCard() {
  const t      = I18N[currentLang];
  const grid   = document.getElementById('cards-grid');
  const accent = currentTheme === 'light' ? '#14b8a6' : '#00ffcc';

  const existing = document.getElementById('ev-card');
  if (existing) existing.remove();

  const regionRates = EV_RATES[selectedRegion];
  const isEast      = selectedRegion === 'east';
  // East MY only has DC; Peninsular has AC/DC toggle
  const activeType  = isEast ? 'dc' : evChargeType;
  const rateData    = regionRates[activeType];
  const rate        = rateData.rate;
  const chargeLabel = currentLang === 'bm' ? rateData.labelBM : rateData.label;
  const provider    = regionRates.provider;
  const badgeStyle  = `color:${accent};border-color:${accent}40;background:${accent}12;`;

  // Cost comparison bars
  const ron95Price  = rawData.length ? rawData[0].ron95 : null;
  const evCost      = rate / EV_KM_PER_KWH * 100;
  const petrolCost  = ron95Price ? ron95Price * 10 : null;
  const evPct       = petrolCost ? Math.round(evCost / petrolCost * 100) : 50;
  const refBarColor = currentTheme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
  const compareHTML = `
    <div class="ev-compare">
      <div class="ev-compare-row">
        <span class="ev-compare-label">EV</span>
        <div class="ev-compare-track">
          <div class="ev-compare-fill" id="ev-bar-fill" style="width:${evPct}%;background:${accent}"></div>
        </div>
        <span class="ev-compare-cost" id="ev-cost-amount" style="color:${accent}">RM ${evCost.toFixed(2)}</span>
      </div>
      <div class="ev-compare-row">
        <span class="ev-compare-label">RON95</span>
        <div class="ev-compare-track">
          <div class="ev-compare-fill" style="width:100%;background:${refBarColor}"></div>
        </div>
        <span class="ev-compare-cost">${petrolCost ? `RM ${petrolCost.toFixed(2)}` : '—'}</span>
      </div>
      <div class="ev-compare-note">${t.evCompareSub}</div>
    </div>`;

  // Always render toggle; hidden for East MY so it can animate in/out
  const toggleHTML = `
    <div class="ev-toggle${isEast ? ' ev-toggle--hidden' : ''}">
      <button id="ev-btn-ac" class="ev-btn${evChargeType === 'ac' ? ' active' : ''}" onclick="setEvCharge('ac')">${t.evAC}</button>
      <button id="ev-btn-dc" class="ev-btn${evChargeType === 'dc' ? ' active' : ''}" onclick="setEvCharge('dc')">${t.evDC}</button>
    </div>`;

  const card = document.createElement('div');
  card.className = 'fuel-card ev-card';
  card.id = 'ev-card';
  card.style.setProperty('--card-accent', accent);

  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-name">${t.evName}</div>
        <div class="card-name-sub" id="ev-charge-label">${provider} · ${chargeLabel}</div>
      </div>
      <div class="card-header-right">
        <span class="card-type-badge" style="${badgeStyle}">EV</span>
      </div>
    </div>
    <div class="card-price-row">
      <span class="card-currency">RM</span>
      <span class="card-price" id="ev-rate-value" style="color:${accent}">${rate.toFixed(2)}</span>
      <span class="card-currency">/kWh</span>
    </div>
    ${compareHTML}
    ${toggleHTML}
    <div class="ev-note">${t.evNote}</div>
  `;

  grid.appendChild(card);
}

// ── Exchange Rates ────────────────────────────────────────────────
async function loadExchangeRates() {
  try {
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/MYR');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    exchangeRates = json.rates;
    renderIntlChart();
  } catch (err) {
    console.error('Exchange rate fetch error:', err);
    const badge = document.getElementById('intl-rate-status');
    if (badge) badge.textContent = 'Rate fetch failed';
  }
}

// ── International Comparison Chart ───────────────────────────────
function renderIntlChart() {
  if (!exchangeRates || !rawData.length) return;

  const isDark    = currentTheme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const tickColor = isDark ? '#888888' : '#666666';
  const tooltipBg = isDark ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.97)';
  const tooltipTx = isDark ? '#f0f0f0' : '#1a1a1a';
  const legendTx  = isDark ? '#f0f0f0' : '#1a1a1a';

  // Convert to RM/L (rates are: 1 MYR = N foreign, so 1 foreign = 1/rate MYR)
  const toRMperL = {
    uk: INTL_PRICES.uk.map(p => +(p / exchangeRates.GBP).toFixed(3)),
    au: INTL_PRICES.au.map(p => +(p / exchangeRates.AUD).toFixed(3)),
    sg: INTL_PRICES.sg.map(p => +(p / exchangeRates.SGD).toFixed(3)),
  };

  // BUDI95 from rawData aligned with INTL_WEEKS (oldest → newest, nulls kept for gaps)
  const budi95 = rawData
    .slice(0, INTL_WEEKS.length)
    .map(r => r.ron95_budi95 || null)
    .reverse();

  const labels = INTL_WEEKS.map(d =>
    new Date(d).toLocaleDateString(
      currentLang === 'bm' ? 'ms-MY' : 'en-MY',
      { month: 'short', day: 'numeric' }
    )
  );

  const datasets = INTL_SERIES.map((s, i) => {
    const color = (isDark || !s.lightColor) ? s.color : s.lightColor;
    const data  = s.key === 'budi95' ? budi95 : toRMperL[s.key];
    // Country lines fill towards BUDI95 (index 0) to show the subsidy gap
    const fill  = i === 0 ? false : { target: 0, above: color + '28', below: color + '28' };
    return {
      label:                ' ' + s[currentLang],
      data,
      borderColor:          color,
      borderWidth:          s.width,
      pointRadius:          0,
      pointHoverRadius:     4,
      pointBackgroundColor: color,
      fill,
      tension:              0.6,
      spanGaps:             true,
    };
  });

  if (intlChart) { intlChart.destroy(); intlChart = null; }
  const canvas = document.getElementById('intl-chart');
  if (!canvas) return;

  intlChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color:         legendTx,
            font:          { family: 'JetBrains Mono', size: 11 },
            usePointStyle: true,
            pointStyle:    'circle',
            boxWidth:      8,
            boxHeight:     8,
            padding:       16,
          },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor:     isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
          borderWidth:     1,
          titleColor:      isDark ? '#aaaaaa' : '#555555',
          bodyColor:       tooltipTx,
          titleFont:       { family: 'JetBrains Mono', size: 11 },
          bodyFont:        { family: 'JetBrains Mono', size: 12 },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: RM ${ctx.parsed.y.toFixed(2)}/L`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: gridColor },
          ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
        },
        y: {
          grid:  { color: gridColor },
          ticks: {
            color: tickColor,
            font:  { family: 'JetBrains Mono', size: 10 },
            maxTicksLimit: 5,
            callback: v => `RM ${v.toFixed(2)}`,
          },
        },
      },
    },
  });

  const badge = document.getElementById('intl-rate-status');
  if (badge) {
    const ts = new Date().toLocaleTimeString(
      currentLang === 'bm' ? 'ms-MY' : 'en-MY',
      { hour: '2-digit', minute: '2-digit' }
    );
    badge.textContent = `Live rates · ${ts}`;
  }
}

// ── Sparkline Charts ──────────────────────────────────────────────
function renderSparkline(key, series, accent) {
  const canvas = document.getElementById(`chart-${key}`);
  if (!canvas) return;

  if (charts[key]) { charts[key].destroy(); delete charts[key]; }

  const ctx  = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, accent + '55');
  grad.addColorStop(1, accent + '00');

  charts[key] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: series.map((_, i) => `W${i + 1}`),
      datasets: [{
        data: series,
        borderColor: accent,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: accent,
        fill: true,
        backgroundColor: grad,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: currentTheme === 'light' ? 'rgba(255,255,255,0.97)' : 'rgba(10,10,10,0.9)',
          borderColor: accent,
          borderWidth: 1,
          titleColor: accent,
          bodyColor: currentTheme === 'light' ? '#1a1a1a' : '#f0f0f0',
          titleFont: { family: 'JetBrains Mono' },
          bodyFont:  { family: 'JetBrains Mono' },
          callbacks: { label: ctx => ` RM ${ctx.parsed.y.toFixed(2)}/L` },
        },
      },
      scales: {
        x: { display: false },
        y: { display: false, grace: '10%' },
      },
    },
  });
}
