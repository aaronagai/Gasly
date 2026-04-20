/**
 * Press and drag horizontally across the liquid tab bar to select a tab on release.
 * Short taps keep normal link/button behaviour.
 *
 * We avoid setPointerCapture on pointerdown: on WebKit (Safari / iOS) that often
 * suppresses the subsequent click on in-pill links. While a press is active we
 * listen on document (capture) for move/up so we still see events if the finger
 * leaves the pill before drag mode starts.
 */
(function () {
  'use strict';

  var MOVE_PX = 10;
  /** Require a few px of movement before treating cross-tab hover as drag (avoids killing the click). */
  var CROSS_TAB_MIN_PX = 8;
  var SUPPRESS_MS = 120;

  function init() {
    var pill = document.querySelector('.app-liquid-nav__pill');
    if (!pill) return;
    var items = Array.prototype.slice.call(pill.querySelectorAll(':scope > .app-liquid-nav__item'));
    if (items.length < 2) return;

    var down = null;
    var dragMode = false;
    var suppressClick = false;
    var tracking = false;

    function indexAt(clientX, clientY) {
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return i;
      }
      var pr = pill.getBoundingClientRect();
      if (!(clientX >= pr.left && clientX <= pr.right && clientY >= pr.top && clientY <= pr.bottom)) return null;
      var best = 0;
      var bestD = Infinity;
      for (var j = 0; j < items.length; j++) {
        var r2 = items[j].getBoundingClientRect();
        var cx = (r2.left + r2.right) / 2;
        var d = Math.abs(clientX - cx);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      return best;
    }

    function clearPreview() {
      pill.classList.remove('app-liquid-nav__pill--dragging');
      for (var i = 0; i < items.length; i++) items[i].classList.remove('app-liquid-nav__item--sliding-hover');
    }

    function setPreview(i) {
      for (var k = 0; k < items.length; k++) {
        items[k].classList.toggle('app-liquid-nav__item--sliding-hover', k === i);
      }
    }

    function stopTracking() {
      if (!tracking) return;
      tracking = false;
      document.removeEventListener('pointermove', onDocPointerMove, true);
      document.removeEventListener('pointerup', onDocPointerFinish, true);
      document.removeEventListener('pointercancel', onDocPointerFinish, true);
    }

    function onDocPointerMove(e) {
      if (!down || e.pointerId !== down.id) return;
      var hi = indexAt(e.clientX, e.clientY);
      var dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (!dragMode) {
        var crossTab = hi !== null && hi !== down.i && dist > CROSS_TAB_MIN_PX;
        if (dist > MOVE_PX || crossTab) {
          dragMode = true;
          pill.classList.add('app-liquid-nav__pill--dragging');
        } else {
          return;
        }
      }
      if (hi !== null) setPreview(hi);
      else setPreview(down.i);
    }

    function onDocPointerFinish(e) {
      if (!down || e.pointerId !== down.id) return;
      stopTracking();

      var cancelled = e.type === 'pointercancel';
      var endI = indexAt(e.clientX, e.clientY);
      var wasDrag = dragMode;
      clearPreview();
      var startI = down.i;
      down = null;
      dragMode = false;

      if (cancelled || !wasDrag || endI === null || endI === startI) return;

      var el = items[endI];
      if (el.tagName === 'A' && el.getAttribute('href')) {
        try {
          var next = new URL(el.getAttribute('href'), window.location.href).href;
          if (next === window.location.href) return;
        } catch (_) {}
        suppressClick = true;
        window.setTimeout(function () {
          suppressClick = false;
        }, SUPPRESS_MS);
        window.location.assign(el.href);
        return;
      }
      if (el.tagName === 'BUTTON') {
        suppressClick = true;
        window.setTimeout(function () {
          suppressClick = false;
        }, SUPPRESS_MS);
        el.click();
      }
    }

    pill.addEventListener(
      'click',
      function (e) {
        if (suppressClick && pill.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      },
      true
    );

    pill.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      if (down) return;
      if (!pill.contains(e.target)) return;
      var i = indexAt(e.clientX, e.clientY);
      if (i === null) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, i: i };
      dragMode = false;
      tracking = true;
      document.addEventListener('pointermove', onDocPointerMove, true);
      document.addEventListener('pointerup', onDocPointerFinish, true);
      document.addEventListener('pointercancel', onDocPointerFinish, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
