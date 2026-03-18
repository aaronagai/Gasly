/* ============================================================
   MY FUEL PRICE — app.js
   Malaysia live fuel prices from api.data.gov.my
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────
const API_URL    = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&sort=-date&limit=104';
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


// ── i18n ─────────────────────────────────────────────────────────
const I18N = {
  en: {
    subtitle:    'Malaysia Live Fuel Prices',
    lastUpdated: 'Last Updated',
    nextUpdate:  'Next Update',
    dataSource:  'Data source',
    unchanged:   'Unchanged',
    thisWeek:    'Weekly Change',
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
    thisWeek:    'Perubahan Mingguan',
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
let evChargeType  = localStorage.getItem('evCharge') || 'ac';

// ── Theme ─────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

const ICON_SUN  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Zm11.394-5.834a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75Zm-3.916 5.834a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18Zm-4.242-.697a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12Zm.697-4.243a.75.75 0 0 0 1.06-1.06L6.166 5.106a.75.75 0 0 0-1.06 1.06l1.59 1.591Z"/></svg>`;
const ICON_MOON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clip-rule="evenodd"/></svg>`;

function updateThemeBtn() {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = currentTheme === 'dark' ? ICON_SUN : ICON_MOON;
}

window.toggleTheme = function() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', currentTheme);
  applyTheme(currentTheme);
  updateThemeBtn();
  if (rawData.length) renderCards(rawData);
};

// Follow system preference only if user hasn't manually chosen
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  if (localStorage.getItem('theme')) return;
  currentTheme = e.matches ? 'light' : 'dark';
  applyTheme(currentTheme);
  updateThemeBtn();
  if (rawData.length) renderCards(rawData);
});

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  updateThemeBtn();
  applyLang(currentLang);
  document.getElementById('lang-current').textContent = currentLang.toUpperCase();
  document.getElementById('rbtn-peninsular').classList.toggle('active', selectedRegion === 'peninsular');
  document.getElementById('rbtn-east').classList.toggle('active', selectedRegion === 'east');
  loadData();
  startCountdown();
  // Auto-refresh disabled — prices only update Wednesdays, no need to poll
  // refreshTimer = setInterval(() => loadData(true), REFRESH_MS);
});

// ── Language ─────────────────────────────────────────────────────
window.setLang = function(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.getElementById('lang-current').textContent = lang.toUpperCase();
  closeLangDropdown();
  applyLang(lang);
  if (rawData.length) renderCards(rawData);
};

window.toggleLangDropdown = function() {
  const menu = document.getElementById('lang-dropdown-menu');
  const btn  = document.getElementById('lang-dropdown-btn');
  const open = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', open);
};

function closeLangDropdown() {
  const menu = document.getElementById('lang-dropdown-menu');
  const btn  = document.getElementById('lang-dropdown-btn');
  if (menu) { menu.classList.remove('open'); btn?.setAttribute('aria-expanded', 'false'); }
}

// Close dropdown when clicking outside
document.addEventListener('click', e => {
  if (!document.getElementById('lang-dropdown')?.contains(e.target)) closeLangDropdown();
});

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
      .slice(0, 5)
      .reverse();

    const current = series[series.length - 1];
    const prev    = series[series.length - 2];
    if (current === undefined) return;

    const diff        = prev !== undefined ? +(current - prev).toFixed(3) : 0;
    const changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrow       = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
    const changeLabel = diff === 0
      ? t.unchanged
      : `${diff > 0 ? '+' : '-'}RM${Math.abs(diff).toFixed(2)}`;

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
        <span>${changeLabel}</span><span class="change-week">${t.thisWeek}</span>
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
