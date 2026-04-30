/**
 * Homepage: make the dashboard behave like a pull-up card over the map.
 * Keeps logic small and self-contained; dashboard rendering is handled by app-dashboard-core.js.
 */
(function () {
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function px(n) {
    return Math.round(n) + 'px';
  }

  function safeTouchActionNone(el) {
    try {
      el.style.touchAction = 'none';
    } catch (_) {}
  }

  window.initHomeDashboardSheet = function initHomeDashboardSheet() {
    const sheet = document.getElementById('home-dashboard-sheet');
    const handle = document.getElementById('home-dashboard-handle');
    if (!sheet || !handle) return;

    const vh = () => Math.max(360, Math.round(window.innerHeight || 0));
    const minH = () => Math.round(clamp(vh() * 0.22, 160, 260));
    const midH = () => Math.round(clamp(vh() * 0.58, 420, 680));
    const maxH = () => Math.round(clamp(vh() * 0.88, 520, vh() - 12));

    let cur = midH();
    let dragging = false;
    let startY = 0;
    let startH = 0;

    function setHeight(h, animate) {
      const next = clamp(h, minH(), maxH());
      cur = next;
      if (!prefersReducedMotion() && animate) sheet.classList.add('home-dashboard-sheet--anim');
      else sheet.classList.remove('home-dashboard-sheet--anim');
      sheet.style.height = px(next);
    }

    function snapToNearest() {
      const a = minH();
      const b = midH();
      const c = maxH();
      const dA = Math.abs(cur - a);
      const dB = Math.abs(cur - b);
      const dC = Math.abs(cur - c);
      const target = dA <= dB && dA <= dC ? a : dB <= dC ? b : c;
      setHeight(target, true);
    }

    function onDown(clientY) {
      dragging = true;
      startY = clientY;
      startH = cur || midH();
      sheet.classList.remove('home-dashboard-sheet--anim');
      document.body.classList.add('home-sheet-dragging');
    }

    function onMove(clientY) {
      if (!dragging) return;
      const dy = startY - clientY;
      setHeight(startH + dy, false);
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('home-sheet-dragging');
      snapToNearest();
    }

    // Initial size.
    setHeight(cur, false);

    // Expose small integration points for the map click handler.
    window.__homeDashboardSetHeight = function (h, animate) {
      setHeight(h, !!animate);
    };
    window.homeDashboardSetCountry = function (countryId) {
      const id = countryId == null || countryId === '' ? null : +countryId;
      const wrap = document.getElementById('app-dashboard-country');
      const labelEl = wrap && wrap.querySelector('.app-dashboard-country-trigger-label');
      try {
        if (id == null) localStorage.removeItem('app_dashboard_country');
        else localStorage.setItem('app_dashboard_country', String(id));
      } catch (_) {}
      if (wrap) {
        wrap.setAttribute('data-country', id == null ? '' : String(id));
      }
      if (labelEl && typeof COUNTRIES !== 'undefined') {
        labelEl.textContent = id == null || !COUNTRIES[id] ? 'All countries' : COUNTRIES[id].name;
      }
      try {
        const sheetEl = document.getElementById('app-dashboard-country-sheet');
        const trigger = document.getElementById('app-dashboard-country-trigger');
        if (sheetEl && !sheetEl.hidden) {
          sheetEl.hidden = true;
          sheetEl.setAttribute('aria-hidden', 'true');
          trigger && trigger.setAttribute('aria-expanded', 'false');
        }
      } catch (_) {}
      try {
        if (typeof renderAppDashboardTbody === 'function') renderAppDashboardTbody();
      } catch (_) {}
    };

    // Resize: keep within bounds, keep relative position roughly stable.
    window.addEventListener(
      'resize',
      () => {
        setHeight(cur, false);
      },
      { passive: true },
    );

    // Pointer events (preferred).
    if (window.PointerEvent) {
      safeTouchActionNone(handle);
      handle.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button !== 0) return;
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (_) {}
        onDown(e.clientY);
        e.preventDefault();
      });
      handle.addEventListener('pointermove', (e) => {
        onMove(e.clientY);
      });
      handle.addEventListener('pointerup', () => onUp());
      handle.addEventListener('pointercancel', () => onUp());
    } else {
      // Touch fallback.
      safeTouchActionNone(handle);
      handle.addEventListener(
        'touchstart',
        (e) => {
          const t = e.touches && e.touches[0];
          if (!t) return;
          onDown(t.clientY);
          e.preventDefault();
        },
        { passive: false },
      );
      window.addEventListener(
        'touchmove',
        (e) => {
          const t = e.touches && e.touches[0];
          if (!t) return;
          onMove(t.clientY);
        },
        { passive: true },
      );
      window.addEventListener('touchend', () => onUp(), { passive: true });

      // Mouse fallback.
      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        onDown(e.clientY);
        e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => onMove(e.clientY), { passive: true });
      window.addEventListener('mouseup', () => onUp(), { passive: true });
    }

    // Quick toggle: double-click to max/medium.
    handle.addEventListener('dblclick', () => {
      const nearMax = Math.abs(cur - maxH()) < 18;
      setHeight(nearMax ? midH() : maxH(), true);
    });
  };
})();

