/* ============================================================
   MY FUEL PRICE — app.js
   Malaysia live fuel prices from api.data.gov.my
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────
const API_URL    = 'https://api.data.gov.my/data-catalogue?id=fuelprice&sort=-date&limit=52';
const REFRESH_MS = 60_000;

// regionAlt: field to use when region = 'east'. undefined = same price both regions.
const FUEL_KEYS = [
  { key: 'ron95_budi95', icon: '⭐', accent: '#b478ff', lightAccent: '#6d28d9', label: 'BUDI95' },
  { key: 'ron95',        icon: '🟢', accent: '#00ff64', lightAccent: '#0F9D58' },
  { key: 'ron97',        icon: '🔵', accent: '#00d4ff', lightAccent: '#0369a1' },
  { key: 'diesel',       icon: '🟠', accent: '#ffaa00', lightAccent: '#b45309', regionAlt: 'diesel_eastmsia' },
];

// ── International Price Data ──────────────────────────────────────
// UPDATE WEEKLY each Wednesday — native currency per litre (US: USD/gallon)
const INTL_WEEKS = [
  '2026-01-14', '2026-01-21', '2026-01-28',
  '2026-02-04', '2026-02-11', '2026-02-18',
  '2026-02-25', '2026-03-04',
];

const INTL_PRICES = {
  us: [3.09, 3.07, 3.12, 3.15, 3.11, 3.08, 3.05, 3.03], // USD/gallon
  uk: [1.46, 1.47, 1.45, 1.44, 1.46, 1.48, 1.47, 1.45], // GBP/litre
  au: [1.92, 1.95, 1.88, 1.85, 1.87, 1.90, 1.93, 1.91], // AUD/litre
  sg: [2.68, 2.71, 2.69, 2.65, 2.63, 2.66, 2.70, 2.72], // SGD/litre (RON 95)
};

// Per-series chart config (en/bm labels + light/dark colors)
const INTL_SERIES = [
  { key: 'budi95', en: 'BUDI95 (Malaysia)',  bm: 'BUDI95 (Malaysia)',  color: '#b478ff', lightColor: '#6d28d9', width: 3 },
  { key: 'sg',     en: 'Singapore',           bm: 'Singapura',          color: '#ffaa00', lightColor: '#b45309', width: 2 },
  { key: 'au',     en: 'Australia',           bm: 'Australia',          color: '#00ff64', lightColor: '#0F9D58', width: 2 },
  { key: 'uk',     en: 'United Kingdom',      bm: 'United Kingdom',     color: '#00d4ff', lightColor: '#0369a1', width: 2 },
  { key: 'us',     en: 'United States',       bm: 'Amerika Syarikat',   color: '#ff4466', lightColor: '#dc2626', width: 2 },
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
    intlTitle:      'Price Comparison (RM/L)',
    intlDisclaimer: 'International prices updated weekly. Source: GlobalPetrolPrices.com',
    intlRateNote:   'Live exchange rates via exchangerate-api.com',
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
    intlTitle:      'Perbandingan Harga (RM/L)',
    intlDisclaimer: 'Harga antarabangsa dikemaskini setiap minggu. Sumber: GlobalPetrolPrices.com',
    intlRateNote:   'Kadar tukaran langsung melalui exchangerate-api.com',
  },
};

// ── State ────────────────────────────────────────────────────────
let currentLang    = localStorage.getItem('lang')      || 'en';
let selectedRegion = localStorage.getItem('region')    || 'peninsular';
let currentTheme   = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; // 'peninsular' | 'east'
let rawData        = [];
let charts        = {};
let refreshTimer  = null;
let countdownTimer = null;
let exchangeRates = null;
let intlChart     = null;

// ── Theme ─────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Auto-update if system preference changes
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  currentTheme = e.matches ? 'light' : 'dark';
  applyTheme(currentTheme);
  if (rawData.length) renderCards(rawData);
  renderIntlChart();
});

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(currentTheme);
  applyLang(currentLang);
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
  selectedRegion = region;
  localStorage.setItem('region', region);
  document.getElementById('rbtn-peninsular').classList.toggle('active', region === 'peninsular');
  document.getElementById('rbtn-east').classList.toggle('active', region === 'east');
  if (rawData.length) renderCards(rawData);
};

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
  const t    = I18N[currentLang];
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';

  FUEL_KEYS.forEach(({ key, icon, accent, lightAccent, regionAlt, label }) => {
    const activeAccent = (currentTheme === 'light' && lightAccent) ? lightAccent : accent;
    // Use the regional alternate field when East MY is selected and one exists
    const activeKey = (regionAlt && selectedRegion === 'east') ? regionAlt : key;

    const series = data
      .map(row => row[activeKey])
      .filter(v => v !== null && v !== undefined && v > 0)
      .slice(0, 8)
      .reverse(); // oldest → newest for chart

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
        <span class="card-price" style="color:${activeAccent}">${current.toFixed(2)}</span>
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

    grid.appendChild(card);
    requestAnimationFrame(() => renderSparkline(key, series, activeAccent));
  });
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
    us: INTL_PRICES.us.map(p => +((p / 3.78541) / exchangeRates.USD).toFixed(3)),
    uk: INTL_PRICES.uk.map(p => +(p / exchangeRates.GBP).toFixed(3)),
    au: INTL_PRICES.au.map(p => +(p / exchangeRates.AUD).toFixed(3)),
    sg: INTL_PRICES.sg.map(p => +(p / exchangeRates.SGD).toFixed(3)),
  };

  // BUDI95 from rawData, oldest → newest
  const budi95 = rawData
    .map(r => r.ron95_budi95)
    .filter(v => v != null && v > 0)
    .slice(0, 8)
    .reverse();

  const labels = INTL_WEEKS.map(d =>
    new Date(d).toLocaleDateString(
      currentLang === 'bm' ? 'ms-MY' : 'en-MY',
      { month: 'short', day: 'numeric' }
    )
  );

  const datasets = INTL_SERIES.map(s => {
    const color = (isDark || !s.lightColor) ? s.color : s.lightColor;
    const data  = s.key === 'budi95' ? budi95 : toRMperL[s.key];
    return {
      label:                s[currentLang],
      data,
      borderColor:          color,
      borderWidth:          s.width,
      pointRadius:          s.width === 3 ? 3 : 2,
      pointHoverRadius:     s.width === 3 ? 6 : 5,
      pointBackgroundColor: color,
      fill:                 false,
      tension:              0.4,
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
            color:    legendTx,
            font:     { family: 'JetBrains Mono', size: 11 },
            boxWidth: 20,
            padding:  14,
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
          ticks: { color: tickColor, font: { family: 'JetBrains Mono', size: 10 }, maxRotation: 0 },
        },
        y: {
          grid:  { color: gridColor },
          ticks: {
            color: tickColor,
            font:  { family: 'JetBrains Mono', size: 10 },
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
