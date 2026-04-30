/**
 * Helper to keep the embedded dashboard in sync with app selection.
 * This does NOT change the app's selection; it only adjusts the dashboard filter + label.
 */
(function () {
  function setDashboardCountry(countryId) {
    const id = countryId == null || countryId === '' ? null : +countryId;
    const wrap = document.getElementById('app-dashboard-country');
    const labelEl = wrap && wrap.querySelector('.app-dashboard-country-trigger-label');
    try {
      if (id == null) localStorage.removeItem('app_dashboard_country');
      else localStorage.setItem('app_dashboard_country', String(id));
    } catch (_) {}
    if (wrap) wrap.setAttribute('data-country', id == null ? '' : String(id));
    if (labelEl && typeof COUNTRIES !== 'undefined') {
      labelEl.textContent = id == null || !COUNTRIES[id] ? 'All countries' : COUNTRIES[id].name;
    }
    try {
      if (typeof renderAppDashboardTbody === 'function') renderAppDashboardTbody();
    } catch (_) {}
  }

  window.appDashboardSetCountry = setDashboardCountry;
})();

