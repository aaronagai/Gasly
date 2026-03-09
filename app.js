/* ============================================================
   MY FUEL PRICE — app.js
   Malaysia live fuel prices from api.data.gov.my
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────
const API_URL   = 'https://api.data.gov.my/data-catalogue?id=fuelprice&sort=-date&limit=52';
const REFRESH_MS = 60_000; // 60 seconds

// Fuel field keys as returned by API
const FUEL_KEYS = [
  { key: 'ron95',        icon: '🟢', accent: '#00ff64' },
  { key: 'ron97',        icon: '🔵', accent: '#00d4ff' },
  { key: 'diesel',       icon: '🟠', accent: '#ffaa00' },
  { key: 'diesel_eastmy', icon: '🟤', accent: '#c87941' },
  { key: 'budi95',       icon: '⭐', accent: '#b478ff' },
];

// ── i18n strings ─────────────────────────────────────────────────
const I18N = {
  en: {
    subtitle:       'Malaysia Live Fuel Prices',
    refresh:        'LIVE',
    lastUpdated:    'Last Updated',
    nextUpdate:     'Next Update',
    dataSource:     'Data source',
    unchanged:      'Unchanged',
    loading:        'Fetching live data…',
    error:          'Failed to load data. Retrying…',
    fuelNames: {
      ron95:         'RON95 Petrol',
      ron97:         'RON97 Petrol',
      diesel:        'Diesel (Peninsular)',
      diesel_eastmy: 'Diesel (East Malaysia)',
      budi95:        'BUDI95 Subsidised',
    },
    fuelSubs: {
      ron95:         'Peninsular Malaysia',
      ron97:         'All regions',
      diesel:        'Semenanjung',
      diesel_eastmy: 'Sarawak, Sabah & Labuan',
      budi95:        'Subsidised programme',
    },
    tagline:        'Built with open government data. Free & open source forever.',
    viewOnGithub:   'View on GitHub',
    openSource:     'Open Source',
    mitLicense:     'MIT License',
    creditLine:     'Data sourced from the Official Malaysia Open Data Portal — data.gov.my, provided by the Ministry of Finance (MOF) Malaysia',
  },
  bm: {
    subtitle:       'Harga Minyak Malaysia Terkini',
    refresh:        'LANGSUNG',
    lastUpdated:    'Kemaskini Terakhir',
    nextUpdate:     'Kemaskini Seterusnya',
    dataSource:     'Sumber data',
    unchanged:      'Harga tidak berubah',
    loading:        'Mendapatkan data terkini…',
    error:          'Gagal memuatkan data. Cuba semula…',
    fuelNames: {
      ron95:         'Petrol RON95',
      ron97:         'Petrol RON97',
      diesel:        'Diesel (Semenanjung)',
      diesel_eastmy: 'Diesel (Malaysia Timur)',
      budi95:        'BUDI95 Bersubsidi',
    },
    fuelSubs: {
      ron95:         'Semenanjung Malaysia',
      ron97:         'Semua kawasan',
      diesel:        'Semenanjung',
      diesel_eastmy: 'Sarawak, Sabah & Labuan',
      budi95:        'Program bersubsidi',
    },
    tagline:        'Dibina dengan data kerajaan terbuka. Percuma & sumber terbuka selama-lamanya.',
    viewOnGithub:   'Lihat di GitHub',
    openSource:     'Sumber Terbuka',
    mitLicense:     'Lesen MIT',
    creditLine:     'Data bersumber dari Portal Data Terbuka Rasmi Malaysia — data.gov.my, disediakan oleh Kementerian Kewangan (MOF) Malaysia',
  },
};

// ── State ────────────────────────────────────────────────────────
let currentLang = localStorage.getItem('lang') || 'en';
let rawData      = [];
let charts       = {};
let refreshTimer = null;
let countdownTimer = null;

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyLang(currentLang);
  loadData();
  startCountdown();

  refreshTimer = setInterval(() => {
    loadData(true);
  }, REFRESH_MS);
});

// ── Language ─────────────────────────────────────────────────────
window.setLang = function(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');
  document.getElementById('btn-bm').classList.toggle('active', lang === 'bm');
  applyLang(lang);

  // Re-render if data loaded
  if (rawData.length) renderCards(rawData);
};

function applyLang(lang) {
  const t = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key]) el.textContent = t[key];
  });
  // Update tagline
  const taglineEl = document.getElementById('footer-tagline');
  if (taglineEl) taglineEl.textContent = t.tagline;
  const creditEl = document.getElementById('footer-credit');
  if (creditEl) creditEl.textContent = t.creditLine;
  const ghBtn = document.getElementById('github-btn-label');
  if (ghBtn) ghBtn.textContent = t.viewOnGithub;
  const osLabel = document.getElementById('open-source-label');
  if (osLabel) osLabel.textContent = t.openSource;
  const mitLabel = document.getElementById('mit-label');
  if (mitLabel) mitLabel.textContent = t.mitLicense;
}

// ── Data Fetch ───────────────────────────────────────────────────
async function loadData(isRefresh = false) {
  const ring = document.getElementById('refresh-ring');
  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  if (isRefresh) {
    ring.classList.remove('paused');
  }

  statusText.textContent = I18N[currentLang].loading;
  statusDot.classList.remove('error');

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    rawData = json;
    renderCards(rawData);
    setMeta(rawData);
    statusDot.classList.remove('error');
    statusText.textContent = I18N[currentLang].loading.replace('Fetching', 'Live').replace('Mendapatkan', 'Langsung');
    statusText.textContent = 'Connected';
  } catch (err) {
    console.error('Fetch error:', err);
    statusDot.classList.add('error');
    statusText.textContent = I18N[currentLang].error;
    const grid = document.getElementById('cards-grid');
    if (!rawData.length) {
      grid.innerHTML = `<p class="error-msg">${I18N[currentLang].error}</p>`;
    }
  } finally {
    if (isRefresh) {
      setTimeout(() => ring.classList.add('paused'), 800);
    }
  }
}

// ── Meta bar ─────────────────────────────────────────────────────
function setMeta(data) {
  if (!data.length) return;
  const latest = data[0];
  const d = new Date(latest.date);
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
  const now = new Date();
  // Next Wednesday midnight Malaysia time (UTC+8)
  const myt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  const day  = myt.getDay(); // 0=Sun, 3=Wed
  const daysToWed = (3 - day + 7) % 7 || 7;

  const nextWed = new Date(myt);
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

  FUEL_KEYS.forEach(({ key, icon, accent }, idx) => {
    // Build per-fuel series (latest first from API, so data[0] = newest)
    const series = data
      .map(row => row[key])
      .filter(v => v !== null && v !== undefined)
      .slice(0, 8)
      .reverse(); // oldest → newest for chart

    const current = series[series.length - 1];
    const prev    = series[series.length - 2];

    if (current === undefined) return;

    const diff = (prev !== undefined) ? +(current - prev).toFixed(3) : 0;
    const changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrow       = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
    const changeLabel = diff === 0
      ? t.unchanged
      : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} RM`;

    const card = document.createElement('div');
    card.className = 'fuel-card';
    card.style.setProperty('--card-accent', accent);

    // Type badge colour mapping
    const badgeStyle = `color: ${accent}; border-color: ${accent}40; background: ${accent}12;`;

    card.innerHTML = `
      <div class="card-header">
        <span class="card-icon" style="filter: drop-shadow(0 0 8px ${accent})">${icon}</span>
        <span class="card-type-badge" style="${badgeStyle}">${key.toUpperCase().replace('_', ' ')}</span>
      </div>
      <div>
        <div class="card-name">${t.fuelNames[key]}</div>
        <div class="card-name-sub">${t.fuelSubs[key]}</div>
      </div>
      <div class="card-price-row">
        <span class="card-currency">RM</span>
        <span class="card-price" style="color: ${accent}; text-shadow: 0 0 20px ${accent}44">${current.toFixed(2)}</span>
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

    // Render sparkline
    requestAnimationFrame(() => {
      renderSparkline(key, series, accent);
    });
  });
}

// ── Sparkline Charts ──────────────────────────────────────────────
function renderSparkline(key, series, accent) {
  const canvasId = `chart-${key}`;
  const canvas   = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy existing
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }

  const ctx = canvas.getContext('2d');

  // Gradient fill
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
      animation: { duration: 600 },
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
          bodyFont: { family: 'JetBrains Mono' },
          callbacks: {
            label: ctx => ` RM ${ctx.parsed.y.toFixed(2)}/L`,
          },
        },
      },
      scales: {
        x: { display: false },
        y: {
          display: false,
          grace: '10%',
        },
      },
    },
  });
}
