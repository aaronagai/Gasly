/* ============================================================
   MY FUEL PRICE — app.js
   Malaysia live fuel prices from api.data.gov.my
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────
const API_URL    = 'https://api.data.gov.my/data-catalogue?id=fuelprice&sort=-date&limit=52';
const REFRESH_MS = 60_000;

// Fuel field keys matching actual API field names
// ron95 has a region toggle: 'ron95' (Peninsular) vs 'ron95_skps' (East MY)
const FUEL_KEYS = [
  { key: 'ron95',         icon: '🟢', accent: '#00ff64', regionToggle: true, altKey: 'ron95_skps' },
  { key: 'ron97',         icon: '🔵', accent: '#00d4ff' },
  { key: 'diesel',        icon: '🟠', accent: '#ffaa00' },
  { key: 'diesel_eastmsia', icon: '🟤', accent: '#c87941' },
  { key: 'ron95_budi95',  icon: '⭐', accent: '#b478ff' },
];

// ── i18n ─────────────────────────────────────────────────────────
const I18N = {
  en: {
    subtitle:    'Malaysia Live Fuel Prices',
    refresh:     'LIVE',
    lastUpdated: 'Last Updated',
    nextUpdate:  'Next Update',
    dataSource:  'Data source',
    unchanged:   'Unchanged',
    loading:     'Fetching live data…',
    error:       'Failed to load data. Retrying…',
    peninsular:  'Peninsular',
    eastMY:      'East MY',
    fuelNames: {
      ron95:           'RON95 Petrol',
      ron97:           'RON97 Petrol',
      diesel:          'Diesel (Peninsular)',
      diesel_eastmsia: 'Diesel (East Malaysia)',
      ron95_budi95:    'BUDI95 Subsidised',
    },
    fuelSubs: {
      ron95:           'Peninsular Malaysia',
      ron95_skps:      'East Malaysia (SKPS)',
      ron97:           'All regions',
      diesel:          'Semenanjung',
      diesel_eastmsia: 'Sarawak, Sabah & Labuan',
      ron95_budi95:    'Subsidised programme',
    },
    tagline:      'Built with open government data. Free & open source forever.',
    viewOnGithub: 'View on GitHub',
    openSource:   'Open Source',
    mitLicense:   'MIT License',
    creditLine:   'Data sourced from the Official Malaysia Open Data Portal — data.gov.my, provided by the Ministry of Finance (MOF) Malaysia',
  },
  bm: {
    subtitle:    'Harga Minyak Malaysia Terkini',
    refresh:     'LANGSUNG',
    lastUpdated: 'Kemaskini Terakhir',
    nextUpdate:  'Kemaskini Seterusnya',
    dataSource:  'Sumber data',
    unchanged:   'Harga tidak berubah',
    loading:     'Mendapatkan data terkini…',
    error:       'Gagal memuatkan data. Cuba semula…',
    peninsular:  'Semenanjung',
    eastMY:      'Malaysia Timur',
    fuelNames: {
      ron95:           'Petrol RON95',
      ron97:           'Petrol RON97',
      diesel:          'Diesel (Semenanjung)',
      diesel_eastmsia: 'Diesel (Malaysia Timur)',
      ron95_budi95:    'BUDI95 Bersubsidi',
    },
    fuelSubs: {
      ron95:           'Semenanjung Malaysia',
      ron95_skps:      'Malaysia Timur (SKPS)',
      ron97:           'Semua kawasan',
      diesel:          'Semenanjung',
      diesel_eastmsia: 'Sarawak, Sabah & Labuan',
      ron95_budi95:    'Program bersubsidi',
    },
    tagline:      'Dibina dengan data kerajaan terbuka. Percuma & sumber terbuka selama-lamanya.',
    viewOnGithub: 'Lihat di GitHub',
    openSource:   'Sumber Terbuka',
    mitLicense:   'Lesen MIT',
    creditLine:   'Data bersumber dari Portal Data Terbuka Rasmi Malaysia — data.gov.my, disediakan oleh Kementerian Kewangan (MOF) Malaysia',
  },
};

// ── State ────────────────────────────────────────────────────────
let currentLang   = localStorage.getItem('lang')       || 'en';
let ron95Region   = localStorage.getItem('ron95Region') || 'peninsular'; // 'peninsular' | 'east'
let rawData       = [];
let charts        = {};
let refreshTimer  = null;
let countdownTimer = null;

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyLang(currentLang);
  loadData();
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

// ── RON95 Region Toggle ───────────────────────────────────────────
window.setRon95Region = function(region) {
  ron95Region = region;
  localStorage.setItem('ron95Region', region);
  if (rawData.length) renderCards(rawData);
};

// ── Data Fetch ───────────────────────────────────────────────────
async function loadData(isRefresh = false) {
  const ring       = document.getElementById('refresh-ring');
  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  if (isRefresh) ring.classList.remove('paused');
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
  } finally {
    if (isRefresh) setTimeout(() => ring.classList.add('paused'), 800);
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

  FUEL_KEYS.forEach(({ key, icon, accent, regionToggle, altKey }) => {
    // For RON95 region toggle: pick active key
    const activeKey = (regionToggle && ron95Region === 'east') ? altKey : key;

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

    const badgeStyle = `color:${accent};border-color:${accent}40;background:${accent}12;`;

    // Region toggle HTML (only for RON95 card)
    const regionToggleHTML = regionToggle ? `
      <div class="region-toggle" role="group" aria-label="Region">
        <button
          class="region-btn ${ron95Region === 'peninsular' ? 'active' : ''}"
          style="--rbtn-accent:${accent}"
          onclick="setRon95Region('peninsular')"
        >${t.peninsular}</button>
        <button
          class="region-btn ${ron95Region === 'east' ? 'active' : ''}"
          style="--rbtn-accent:${accent}"
          onclick="setRon95Region('east')"
        >${t.eastMY}</button>
      </div>` : '';

    const displayName = t.fuelNames[key];
    const displaySub  = t.fuelSubs[activeKey] || t.fuelSubs[key];

    const card = document.createElement('div');
    card.className = 'fuel-card';
    card.style.setProperty('--card-accent', accent);

    card.innerHTML = `
      <div class="card-header">
        <span class="card-icon" style="filter:drop-shadow(0 0 8px ${accent})">${icon}</span>
        <div class="card-header-right">
          ${regionToggleHTML}
          <span class="card-type-badge" style="${badgeStyle}">${key.toUpperCase().replace(/_/g, ' ')}</span>
        </div>
      </div>
      <div>
        <div class="card-name">${displayName}</div>
        <div class="card-name-sub">${displaySub}</div>
      </div>
      <div class="card-price-row">
        <span class="card-currency">RM</span>
        <span class="card-price" style="color:${accent};text-shadow:0 0 20px ${accent}44">${current.toFixed(2)}</span>
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
    requestAnimationFrame(() => renderSparkline(key, series, accent));
  });
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
          backgroundColor: 'rgba(10,10,10,0.9)',
          borderColor: accent,
          borderWidth: 1,
          titleColor: accent,
          bodyColor: '#e0ffe8',
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
