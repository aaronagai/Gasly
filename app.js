/* ============================================================
   PetrolPrice — app.js
   World live fuel prices
   ============================================================ */

'use strict';

// ── Config ──────────────────────────────────────────────────────
const API_URL    = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&sort=-date&limit=30';
const REFRESH_MS = 60_000;

// regionAlt: field to use when region = 'east'. undefined = same price both regions.
const FUEL_KEYS = [
  { key: 'ron95_budi95', icon: '⭐', accent: '#b478ff', lightAccent: '#9333ea', label: 'BUDI95' },
  { key: 'ron95',        icon: '🟢', accent: '#00ff64', lightAccent: '#16a34a' },
  { key: 'ron97',        icon: '🔵', accent: '#00d4ff', lightAccent: '#0ea5e9' },
  { key: 'diesel',       icon: '🟠', accent: '#ffaa00', lightAccent: '#ea580c', regionAlt: 'diesel_eastmsia' },
];


// ── i18n ─────────────────────────────────────────────────────────
const I18N = {
  en: {
    subtitle:    'World Live Fuel Prices',
    lastUpdated: 'Last Updated',
    nextUpdate:  'Next Update',
    dataSource:  'Data source',
    unchanged:   'Unchanged',
    loading:     'Fetching live data…',
    error:       'Failed to load data. Retrying…',
    peninsular:  'PENINSULAR',
    eastMY:      'SABAH / SARAWAK',
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
    tagline:      'Global fuel prices, free & open source forever.',
    viewOnGithub: 'View on GitHub',
    openSource:   'Open Source',
    mitLicense:   'MIT License',
    creditLine:     'Data sourced from open government data portals worldwide',
    intlTitle:      'Global Price Comparison (RM/L)',
    intlDisclaimer: 'International prices updated weekly. Source: GlobalPetrolPrices.com',
    intlRateNote:   'Live exchange rates via exchangerate-api.com',
    historyTitle:   '3-Month Price History',
  },
};

// ── State ────────────────────────────────────────────────────────
let currentLang    = 'en';
let selectedRegion = localStorage.getItem('region')    || 'peninsular';
let currentTheme    = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
let currentCurrency = localStorage.getItem('currency') || 'local';
const MYR_TO_USD    = 0.22;
let rawData        = [];
let charts        = {};
let refreshTimer  = null;
let countdownTimer = null;

// ── Currency ──────────────────────────────────────────────────────
function updateCurrencyBtns() {
  document.querySelectorAll('.curr-opt').forEach(b => b.classList.toggle('active', b.dataset.curr === currentCurrency));
}
window.setCurrency = function(c) {
  currentCurrency = c;
  localStorage.setItem('currency', c);
  updateCurrencyBtns();
  if (rawData.length) renderCards(rawData);
};

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
  updateCurrencyBtns();
  applyLang(currentLang);
  const langEl = document.getElementById('lang-current');
  if (langEl) langEl.textContent = currentLang.toUpperCase();
  document.getElementById('rbtn-peninsular')?.classList.toggle('active', selectedRegion === 'peninsular');
  document.getElementById('rbtn-east')?.classList.toggle('active', selectedRegion === 'east');
  loadData();
  startCountdown();
  // Auto-refresh disabled — prices only update Wednesdays, no need to poll
  // refreshTimer = setInterval(() => loadData(true), REFRESH_MS);
});


function applyLang(lang) {
  const t = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });
  const el = document.getElementById('footer-tagline');
  if (el) el.textContent = t.tagline;
}

// ── Region Toggle ─────────────────────────────────────────────────
window.setRegion = function(region) {
  selectedRegion = region;
  localStorage.setItem('region', region);
  document.getElementById('rbtn-peninsular')?.classList.toggle('active', region === 'peninsular');
  document.getElementById('rbtn-east')?.classList.toggle('active', region === 'east');
  if (rawData.length) renderFuelCards(rawData, true);
  if (rawData.length) renderHistoryChart();
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

// ── Data Fetch ───────────────────────────────────────────────────
const CACHE_KEY = 'petrolprice_my_data';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours (prices update weekly)

async function loadData(isRefresh = false) {
  const statusDot  = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // ── Serve cache instantly ──────────────────────────────────────
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      rawData = cached.data;
      renderCards(rawData);
      setMeta(rawData);
      statusText.textContent = 'Cached';
    }
  } catch (_) {}

  // ── Fetch fresh data in background ────────────────────────────
  statusDot.classList.remove('error');
  try {
    const res  = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    rawData = json.filter(row => row.series_type === 'level');

    // Persist to cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: rawData }));

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
  renderHistoryChart();
}

function renderFuelCards(data, skipAnimation = false) {
  const t    = I18N[currentLang];
  const grid = document.getElementById('cards-grid');

  // Capture old diesel price before clearing so we can animate it after re-render
  const oldDieselEl    = document.getElementById('price-diesel');
  const oldDieselPrice = oldDieselEl ? parseFloat(oldDieselEl.textContent) : null;

  grid.innerHTML = '';

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

    const isUSD = currentCurrency === 'usd';
    const rate  = isUSD ? MYR_TO_USD : 1;
    const sym   = isUSD ? 'USD' : 'RM';
    const disp  = current * rate;
    const dispP = prev !== undefined ? prev * rate : undefined;

    const diff        = dispP !== undefined ? +(disp - dispP).toFixed(3) : 0;
    const changeClass = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrow       = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
    const changeLabel = diff === 0
      ? t.unchanged
      : `${diff > 0 ? '+' : '-'}${sym} ${Math.abs(diff).toFixed(2)}`;

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
          <button class="card-export-btn" onclick="showExportModal('${key}','${activeKey}')" aria-label="Share as Instagram Story" style="color:${activeAccent}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13"/><polyline points="8 7 12 3 16 7"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
          </button>
        </div>
      </div>
      <div class="card-price-row">
        <span class="card-currency">${sym}</span>
        <span class="card-price" style="color:${activeAccent}" ${key === 'diesel' ? 'id="price-diesel"' : ''}>${disp.toFixed(2)}</span>
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

// ── 3-Month History Chart ──────────────────────────────────────────
function renderHistoryChart() {
  const canvas = document.getElementById('history-chart');
  if (!canvas || !rawData.length) return;

  if (charts['history']) { charts['history'].destroy(); delete charts['history']; }

  const WEEKS = 13; // ~3 months of weekly data
  const dieselKey = selectedRegion === 'east' ? 'diesel_eastmsia' : 'diesel';

  const slice = rawData.slice(0, WEEKS).reverse();
  const labels = slice.map(row => {
    const d = new Date(row.date);
    return d.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
  });

  const isLight   = currentTheme === 'light';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const tickColor = isLight ? '#888888'           : '#666666';

  const ron95Color  = isLight ? '#16a34a' : '#00ff64';
  const ron97Color  = isLight ? '#0ea5e9' : '#00d4ff';
  const dieselColor = isLight ? '#ea580c' : '#ffaa00';

  const ctx = canvas.getContext('2d');

  const makeDataset = (label, dataKey, color) => ({
    label,
    data: slice.map(r => r[dataKey] ?? null),
    borderColor: color,
    backgroundColor: color + '18',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    pointBackgroundColor: color,
    fill: false,
    tension: 0.4,
  });

  charts['history'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        makeDataset('RON95',  'ron95',   ron95Color),
        makeDataset('RON97',  'ron97',   ron97Color),
        makeDataset('Diesel', dieselKey, dieselColor),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 500 },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: tickColor,
            font: { family: 'JetBrains Mono', size: 11 },
            boxWidth: 24,
            padding: 16,
            usePointStyle: true,
            pointStyle: 'line',
          },
        },
        tooltip: {
          backgroundColor: isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,10,10,0.92)',
          borderColor:     isLight ? 'rgba(0,0,0,0.1)'        : 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: isLight ? '#1a1a1a' : '#f0f0f0',
          bodyColor:  isLight ? '#555555' : '#aaaaaa',
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont:  { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: c => ` ${c.dataset.label}: RM ${c.parsed.y.toFixed(2)}/L`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { family: 'JetBrains Mono', size: 10 },
            maxRotation: 0,
          },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { family: 'JetBrains Mono', size: 10 },
            callback: v => `RM ${v.toFixed(2)}`,
          },
          grace: '5%',
        },
      },
    },
  });
}

// ── Export / Instagram Story ──────────────────────────────────────
let _exportURL  = null;
let _exportKey  = '';

window.showExportModal = async function(key, activeKey) {
  const modal   = document.getElementById('export-modal');
  const preview = document.getElementById('export-preview');
  const spinner = document.getElementById('export-spinner');
  const hint    = document.getElementById('export-hint');
  const saveBtn = document.getElementById('export-save-btn');

  _exportURL = null;
  _exportKey = key;
  modal.classList.add('open');
  preview.removeAttribute('src');
  preview.style.opacity = '0';
  spinner.style.display = 'flex';
  hint.textContent = 'Generating…';
  saveBtn.disabled = true;

  await document.fonts.ready;

  const canvas = generateStoryCanvas(key, activeKey);
  _exportURL   = canvas.toDataURL('image/png');

  preview.onload = () => { preview.style.opacity = '1'; };
  preview.src    = _exportURL;
  spinner.style.display = 'none';

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  hint.textContent = isIOS
    ? 'Tap & hold the image → Save to Photos'
    : 'Tap the button below to save or share';
  saveBtn.disabled = false;
};

window.closeExportModal = function() {
  document.getElementById('export-modal').classList.remove('open');
};

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeExportModal();
});

window.saveStoryImage = async function() {
  if (!_exportURL) return;
  const blob = await (await fetch(_exportURL)).blob();
  const file = new File([blob], `myfuelprice-${_exportKey}.png`, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'PetrolPrice — World Fuel Prices' }); return; }
    catch (_) { /* cancelled — fall through */ }
  }
  const a   = document.createElement('a');
  a.href    = _exportURL;
  a.download = `myfuelprice-${_exportKey}.png`;
  a.click();
};

function generateStoryCanvas(key, activeKey) {
  const W = 1080, H = 1920;
  const cv  = document.createElement('canvas');
  cv.width  = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  const fuelDef = FUEL_KEYS.find(f => f.key === key);
  const accent  = fuelDef.accent;               // always dark-theme accent
  const t       = I18N[currentLang];

  const series = rawData
    .map(r => r[activeKey])
    .filter(v => v != null && v > 0)
    .slice(0, 5)
    .reverse();
  const current = series[series.length - 1];
  const prev    = series[series.length - 2];
  const diff    = prev !== undefined ? +(current - prev).toFixed(3) : 0;

  // ── Background ────────────────────────────────────────────────────
  ctx.fillStyle = '#090909';
  ctx.fillRect(0, 0, W, H);

  // Accent radial glow
  const glow = ctx.createRadialGradient(W / 2, H * 0.46, 0, W / 2, H * 0.46, 700);
  glow.addColorStop(0, accent + '22');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.055)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y + 2, W, 2);

  const PAD = 84;

  // ── Branding ──────────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 52px "DM Mono", monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText('PetrolPrice', PAD, 146);

  ctx.font = '400 28px "DM Mono", monospace';
  ctx.fillStyle = '#555555';
  ctx.fillText('petrolprice.xyz — live fuel prices', PAD, 198);

  // Top divider
  ctx.strokeStyle = accent + '38';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 226); ctx.lineTo(W - PAD, 226); ctx.stroke();

  // ── Fuel badge + name ─────────────────────────────────────────────
  const badgeLabel = fuelDef.label || key.toUpperCase().replace(/_/g, ' ');
  ctx.font = '700 34px "DM Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const bTW = ctx.measureText(badgeLabel).width;
  const bW = bTW + 56, bH = 60, bR = 13;
  const bX = W / 2 - bW / 2, bY = 640;

  storyRoundRect(ctx, bX, bY, bW, bH, bR);
  ctx.fillStyle = accent + '1C'; ctx.fill();
  ctx.strokeStyle = accent + '55'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillText(badgeLabel, W / 2, bY + bH / 2);

  ctx.font = '500 54px "DM Mono", monospace';
  ctx.fillStyle = '#cccccc';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t.fuelNames[key] || key, W / 2, 790);

  // ── Price ─────────────────────────────────────────────────────────
  const priceText = current.toFixed(2);
  ctx.font = '700 230px "DM Mono", monospace';
  const priceW = ctx.measureText(priceText).width;
  const priceX = W / 2, priceY = 1060;

  // Glow
  ctx.shadowColor = accent; ctx.shadowBlur = 52;
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(priceText, priceX, priceY);
  ctx.shadowBlur = 0;

  // RM (left of price) + /L (right of price) — aligned to price baseline
  ctx.font = '400 70px "DM Mono", monospace';
  ctx.fillStyle = '#4a4a4a';
  ctx.textAlign = 'right';
  ctx.fillText('RM', priceX - priceW / 2 - 14, priceY);
  ctx.textAlign = 'left';
  ctx.fillText('/L', priceX + priceW / 2 + 14, priceY);

  // ── Change badge ──────────────────────────────────────────────────
  const changeColor = diff > 0 ? '#ff4466' : diff < 0 ? '#00e676' : '#606060';
  const arrow       = diff > 0 ? '▲' : diff < 0 ? '▼' : '─';
  const changeLabel = diff === 0
    ? `─  ${t.unchanged}`
    : `${arrow}  ${diff > 0 ? '+' : '−'}RM${Math.abs(diff).toFixed(2)}`;

  ctx.font = '600 40px "DM Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cTW = ctx.measureText(changeLabel).width;
  const cW = cTW + 52, cH = 68, cR = 12;
  const cX = W / 2 - cW / 2, cY = 1140;

  storyRoundRect(ctx, cX, cY, cW, cH, cR);
  ctx.fillStyle = changeColor + '1A'; ctx.fill();
  ctx.strokeStyle = changeColor + '48'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = changeColor;
  ctx.fillText(changeLabel, W / 2, cY + cH / 2);

  // Region
  ctx.font = '400 30px "DM Mono", monospace';
  ctx.fillStyle = '#484848';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(selectedRegion === 'east' ? t.eastMY : t.peninsular, W / 2, 1270);

  // ── History sparkline ─────────────────────────────────────────────
  ctx.font = '400 24px "DM Mono", monospace';
  ctx.fillStyle = '#363636';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('── 3-MONTH HISTORY ──', W / 2, 1316);
  drawStoryChart(ctx, activeKey, PAD, 1330, W - 2 * PAD, 220, accent);

  // ── Footer ────────────────────────────────────────────────────────
  ctx.strokeStyle = accent + '28';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 1596); ctx.lineTo(W - PAD, 1596); ctx.stroke();

  const d = rawData.length ? new Date(rawData[0].date) : new Date();
  const dateStr = d.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = '400 28px "DM Mono", monospace';
  ctx.fillStyle = '#3e3e3e';
  ctx.fillText(`Updated ${dateStr}`, W / 2, 1664);

  ctx.font = '400 25px "DM Mono", monospace';
  ctx.fillStyle = '#343434';
  ctx.fillText('petrolprice.xyz — open source fuel tracker', W / 2, 1726);

  ctx.font = '500 28px "DM Mono", monospace';
  ctx.fillStyle = accent + '72';
  ctx.fillText('github.com/aaronagai/PetrolPrice.xyz', W / 2, 1796);

  return cv;
}

// Single-fuel sparkline drawn on story canvas
function drawStoryChart(ctx, activeKey, x, y, w, h, accent) {
  ctx.save();
  const WEEKS  = 13;
  const rows   = rawData.filter(r => r[activeKey] != null && r[activeKey] > 0).slice(0, WEEKS).reverse();
  if (rows.length < 2) return;

  const vals   = rows.map(r => r[activeKey]);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range  = maxVal - minVal || 0.05;

  const padT = 10, padB = 44, padLR = 8;
  const cw   = w - padLR * 2;
  const ch   = h - padT - padB;

  const pts = vals.map((v, i) => ({
    x: x + padLR + (i / (vals.length - 1)) * cw,
    y: y + padT  + (1 - (v - minVal) / range) * ch,
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, y + padT, 0, y + padT + ch);
  grad.addColorStop(0, accent + '44');
  grad.addColorStop(1, accent + '00');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length - 1].x, y + padT + ch);
  ctx.lineTo(pts[0].x, y + padT + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth   = 4;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Endpoint glow dots
  ctx.shadowColor = accent; ctx.shadowBlur = 16;
  ctx.fillStyle   = accent;
  [pts[0], pts[pts.length - 1]].forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
  });
  ctx.shadowBlur = 0;

  // Date labels
  ctx.font          = '400 22px "DM Mono", monospace';
  ctx.fillStyle     = '#424242';
  ctx.textBaseline  = 'alphabetic';
  const lo = new Date(rows[0].date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
  const hi = new Date(rows[rows.length - 1].date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
  ctx.textAlign = 'left';  ctx.fillText(lo, pts[0].x, y + h - 6);
  ctx.textAlign = 'right'; ctx.fillText(hi, pts[pts.length - 1].x, y + h - 6);
  ctx.restore();
}

// 3-line chart for history story canvas
function drawStoryMultilineChart(ctx, x, y, w, h) {
  ctx.save();
  const WEEKS     = 13;
  const dieselKey = selectedRegion === 'east' ? 'diesel_eastmsia' : 'diesel';
  const fuels     = [
    { key: 'ron95',   label: 'RON95',  color: '#00ff64' },
    { key: 'ron97',   label: 'RON97',  color: '#00d4ff' },
    { key: dieselKey, label: 'Diesel', color: '#ffaa00' },
  ];

  const rows = rawData
    .filter(r => r.ron95 != null && r.ron97 != null && r[dieselKey] != null)
    .slice(0, WEEKS)
    .reverse();
  if (rows.length < 2) return;

  const allVals = rows.flatMap(r => [r.ron95, r.ron97, r[dieselKey]]);
  const minVal  = Math.min(...allVals);
  const maxVal  = Math.max(...allVals);
  const range   = maxVal - minVal || 0.05;

  const legendH = 80, padT = legendH + 24, padB = 64, padLR = 48;
  const cw = w - padLR * 2;
  const ch = h - padT - padB;

  // Subtle grid lines + y-axis labels
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const gy  = y + padT + (i / gridCount) * ch;
    const val = maxVal - (i / gridCount) * range;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    ctx.font         = '400 22px "DM Mono", monospace';
    ctx.fillStyle    = '#383838';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`RM ${val.toFixed(2)}`, x, gy);
  }

  // Draw each line
  fuels.forEach(({ key, color }) => {
    const vals = rows.map(r => r[key]);
    const pts  = vals.map((v, i) => ({
      x: x + padLR + (i / (vals.length - 1)) * cw,
      y: y + padT  + (1 - (v - minVal) / range) * ch,
    }));

    const grad = ctx.createLinearGradient(0, y + padT, 0, y + padT + ch);
    grad.addColorStop(0, color + '28');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, y + padT + ch);
    ctx.lineTo(pts[0].x, y + padT + ch);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(cpx, pts[i - 1].y, cpx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillStyle   = color;
    [pts[0], pts[pts.length - 1]].forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
  });

  // Date labels
  const lo = new Date(rows[0].date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
  const hi = new Date(rows[rows.length - 1].date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' });
  const dateY = y + padT + ch + 44;
  ctx.font = '400 24px "DM Mono", monospace';
  ctx.fillStyle = '#424242'; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';  ctx.fillText(lo, x + padLR, dateY);
  ctx.textAlign = 'right'; ctx.fillText(hi, x + padLR + cw, dateY);

  // Legend (top of chart area)
  ctx.font = '600 28px "DM Mono", monospace';
  ctx.textBaseline = 'middle';
  const legY = y + legendH / 2;
  const itemWidths = fuels.map(f => ctx.measureText(f.label).width + 36 + 32);
  const totalW = itemWidths.reduce((a, b) => a + b, 0) - 32;
  let lx = x + w / 2 - totalW / 2;
  fuels.forEach(({ label, color }, i) => {
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(lx + 10, legY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#aaaaaa'; ctx.textAlign = 'left';
    ctx.fillText(label, lx + 26, legY);
    lx += itemWidths[i];
  });
  ctx.restore();
}

// History story (3-line) canvas
function generateHistoryStoryCanvas() {
  const W = 1080, H = 1920;
  const cv  = document.createElement('canvas');
  cv.width  = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const t   = I18N[currentLang];
  const PAD = 84;
  const bgAccent = '#00d4ff';

  ctx.fillStyle = '#090909';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, 700);
  glow.addColorStop(0, bgAccent + '14'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(0,0,0,0.055)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y + 2, W, 2);

  // Branding
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 52px "DM Mono", monospace';
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
  ctx.fillText('PetrolPrice', PAD, 146);
  ctx.font = '400 28px "DM Mono", monospace';
  ctx.fillStyle = '#555555';
  ctx.fillText('petrolprice.xyz — live fuel prices', PAD, 198);
  ctx.strokeStyle = bgAccent + '38'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 226); ctx.lineTo(W - PAD, 226); ctx.stroke();

  // Title
  ctx.font = '700 42px "DM Mono", monospace';
  ctx.fillStyle = '#cccccc'; ctx.textAlign = 'center';
  ctx.fillText(t.historyTitle || '3-Month Price History', W / 2, 316);
  ctx.font = '400 28px "DM Mono", monospace';
  ctx.fillStyle = '#464646';
  ctx.fillText(selectedRegion === 'east' ? t.eastMY : t.peninsular, W / 2, 368);

  // Chart
  drawStoryMultilineChart(ctx, PAD, 414, W - 2 * PAD, 1130);

  // Footer
  ctx.strokeStyle = bgAccent + '28'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(PAD, 1590); ctx.lineTo(W - PAD, 1590); ctx.stroke();

  const d = rawData.length ? new Date(rawData[0].date) : new Date();
  const dateStr = d.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.font = '400 28px "DM Mono", monospace';
  ctx.fillStyle = '#3e3e3e'; ctx.textAlign = 'center';
  ctx.fillText(`Updated ${dateStr}`, W / 2, 1660);
  ctx.font = '400 25px "DM Mono", monospace';
  ctx.fillStyle = '#343434';
  ctx.fillText('petrolprice.xyz — open source fuel tracker', W / 2, 1722);
  ctx.font = '500 28px "DM Mono", monospace';
  ctx.fillStyle = bgAccent + '72';
  ctx.fillText('github.com/aaronagai/PetrolPrice.xyz', W / 2, 1793);

  return cv;
}

window.showHistoryExportModal = async function() {
  const modal   = document.getElementById('export-modal');
  const preview = document.getElementById('export-preview');
  const spinner = document.getElementById('export-spinner');
  const hint    = document.getElementById('export-hint');
  const saveBtn = document.getElementById('export-save-btn');

  _exportURL = null; _exportKey = 'history';
  modal.classList.add('open');
  preview.removeAttribute('src'); preview.style.opacity = '0';
  spinner.style.display = 'flex';
  hint.textContent = 'Generating…'; saveBtn.disabled = true;

  await document.fonts.ready;

  const canvas = generateHistoryStoryCanvas();
  _exportURL   = canvas.toDataURL('image/png');
  preview.onload = () => { preview.style.opacity = '1'; };
  preview.src    = _exportURL;
  spinner.style.display = 'none';
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  hint.textContent = isIOS ? 'Tap & hold the image → Save to Photos' : 'Tap the button below to save or share';
  saveBtn.disabled = false;
};

function storyRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h,     x, y + h - r,     r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,         x + r, y,         r);
  ctx.closePath();
}
