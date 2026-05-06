/**
 * Shared Settings bottom-sheet controller.
 * Used by both map (`app.html`) and dashboard (`dashboard.html`).
 *
 * Expects markup with these ids:
 *   #app-settings-sheet             — the pull-up sheet wrapper (uses [hidden])
 *   #app-settings-backdrop          — backdrop <button> that closes on click
 *   #app-settings-sheet-handle      — top drag-handle strip that closes on click
 *   #app-settings-close             — explicit × close button
 *   #app-settings-usd               — checkbox for "Highlight prices in USD"
 *   #app-open-settings              — optional; map topbar circular control that opens the sheet
 *
 * @param {{ onUsdToggle?: () => void }} [opts]
 * @returns {{ open: () => void, close: () => void } | null}
 */
function initAppSettingsSheet(opts) {
  const sheet = document.getElementById('app-settings-sheet');
  const backdrop = document.getElementById('app-settings-backdrop');
  const handle = document.getElementById('app-settings-sheet-handle');
  const closeBtn = document.getElementById('app-settings-close');
  const chk = document.getElementById('app-settings-usd');
  const trigger = document.getElementById('app-open-settings');
  const onUsdToggle = opts && typeof opts.onUsdToggle === 'function' ? opts.onUsdToggle : null;
  if (!sheet || !chk) return null;

  function syncBodyScroll() {
    try {
      document.body.style.overflow = sheet.hidden ? '' : 'hidden';
    } catch (_) {}
  }

  function syncToggle() {
    try {
      chk.checked = localStorage.getItem('app_highlight_usd') === '1';
    } catch (_) {
      chk.checked = false;
    }
  }

  function open() {
    /* Close any dashboard sheets that might already be open to avoid overlap. */
    try {
      if (typeof window.dashboardCloseSortSheetIfOpen === 'function') window.dashboardCloseSortSheetIfOpen();
      if (typeof window.dashboardCloseFuelSheetIfOpen === 'function') window.dashboardCloseFuelSheetIfOpen();
      if (typeof window.dashboardCloseCountrySheetIfOpen === 'function') window.dashboardCloseCountrySheetIfOpen();
      if (typeof window.dashboardClosePeriodSheetIfOpen === 'function') window.dashboardClosePeriodSheetIfOpen();
      if (typeof window.dashboardCloseDetailSheetIfOpen === 'function') window.dashboardCloseDetailSheetIfOpen();
    } catch (_) {}
    syncToggle();
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    syncBodyScroll();
  }

  function close() {
    sheet.hidden = true;
    sheet.setAttribute('aria-hidden', 'true');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    syncBodyScroll();
    try {
      trigger?.focus();
    } catch (_) {}
  }

  if (trigger) {
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sheet.hidden) open();
      else close();
    });
  }
  if (backdrop) backdrop.addEventListener('click', close);
  if (handle) handle.addEventListener('click', close);
  if (closeBtn) closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !sheet.hidden) close();
  });

  chk.addEventListener('change', function () {
    try {
      localStorage.setItem('app_highlight_usd', chk.checked ? '1' : '0');
    } catch (_) {}
    if (onUsdToggle) {
      try {
        onUsdToggle();
      } catch (_) {}
    }
  });

  syncToggle();

  /** Deep-link: `?settings=1` opens the sheet and strips the param. */
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('settings') === '1') {
      open();
      params.delete('settings');
      const q = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (q ? '?' + q : '') + window.location.hash,
      );
    }
  } catch (_) {}

  window.__appOpenSettingsSheet = open;
  window.__appCloseSettingsSheet = close;

  return { open: open, close: close };
}
