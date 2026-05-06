/**
 * Apple MapKit JS map for terminal.html — loaded only after mapkit.core.js + JWT.
 * Expects window.mapkit. Falls back to OpenFreeMap if this throws (caller catches).
 */
(function () {
  function detectLiveCountryAt(lat, lon) {
    if (lat >= 1.12 && lat <= 1.58 && lon >= 103.5 && lon <= 104.25) return 702;
    if (lat >= 3.95 && lat <= 5.55 && lon >= 113.85 && lon <= 115.45) return 96;
    if (lat >= 9.2 && lat <= 14.75 && lon >= 102.0 && lon <= 107.95) return 116;
    if (lat >= 14.1 && lat <= 22.85 && lon >= 100.05 && lon <= 107.95) return 418;
    if (lat >= 9 && lat <= 28.5 && lon >= 92 && lon <= 96.5) return 104;
    if (lat >= 9 && lat <= 15 && lon > 96.5 && lon <= 101.5) return 104;
    /* Thailand before Malaysia so Bangkok resolves ahead of the broad peninsular MY bbox. */
    if (lat >= 5.5 && lat <= 21.0 && lon >= 97.0 && lon <= 106.0) return 764;
    if (lat >= 0.75 && lat <= 7.85 && lon >= 99.0 && lon <= 119.85) return 458;
    /* After Malaysia so Sabah/Sarawak wins over the Philippines bbox; Luzon/Visayas/Mindanao (excl. Borneo overlap). */
    if (lat >= 4.5 && lat <= 21.5 && lon >= 117.0 && lon <= 127.5) return 608;
    if (lat >= -11.2 && lat <= 6.6 && lon >= 94.8 && lon <= 141.2) return 360;
    /* Eastern Vietnam (after mainland neighbours to reduce bbox clashes). */
    if (lat >= 10 && lat <= 23.5 && lon > 106.5 && lon <= 110.5) return 704;
    return null;
  }

  window.__renderTerminalMapMapKit = function (o) {
    const mk = o.mapkit;
    const root = o.root;
    const LIVE = o.LIVE;

    root.innerHTML = '';
    root.classList.add('terminal-mapkit-root');

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const map = new mk.Map(root, {
      colorScheme: prefersDark ? mk.Map.ColorSchemes.Dark : mk.Map.ColorSchemes.Light,
      showsMapTypeControl: false,
      showsCompass: mk.FeatureVisibility.Hidden,
    });

    window.__terminalMkMap = map;

    const seaCenter = new mk.Coordinate(4.5, 115);
    const seaSpanWide = new mk.CoordinateSpan(36, 42);
    map.region = new mk.CoordinateRegion(seaCenter, seaSpanWide);

    const LIVE_CENTER = {
      458: new mk.Coordinate(4.2, 108),
      702: new mk.Coordinate(1.35, 103.82),
      96: new mk.Coordinate(4.55, 114.65),
      360: new mk.Coordinate(-2.5, 118),
      764: new mk.Coordinate(13.8, 100.6),
      608: new mk.Coordinate(12.2, 122.5),
      116: new mk.Coordinate(12.55, 104.9),
      104: new mk.Coordinate(19.8, 96.0),
      704: new mk.Coordinate(14.2, 108.3),
      418: new mk.Coordinate(18.2, 103.8),
    };

    const annotations = [];

    function applyMkSel() {
      const sel = +window.__terminalSelectedCountryId;
      annotations.forEach((ann) => {
        const id = ann._terminalCountryId;
        try {
          ann.color = id === sel ? '#e53512' : '#ff6a00';
        } catch (_) {}
      });
    }

    window.__terminalMapKitApplySelection = applyMkSel;

    Object.keys(LIVE).forEach((idStr) => {
      const id = +idStr;
      const c = LIVE_CENTER[id];
      if (!c) return;
      const ann = new mk.MarkerAnnotation(c, {
        title: LIVE[id].name,
        subtitle: 'Live prices',
        color: '#ff6a00',
      });
      ann._terminalCountryId = id;
      annotations.push(ann);
      map.addAnnotation(ann);
    });

    map.addEventListener('select', (evt) => {
      const ann = evt.annotation;
      if (!ann || ann._terminalCountryId == null) return;
      o.setLeftOverview(ann._terminalCountryId);
      applyMkSel();
    });

    map.addEventListener('single-tap', (evt) => {
      let coord = evt.coordinate;
      if (!coord && evt.pointOnPage != null && typeof map.convertPointOnPageToCoordinate === 'function') {
        coord = map.convertPointOnPageToCoordinate(evt.pointOnPage);
      }
      if (!coord || typeof coord.latitude !== 'number') return;
      const lat = coord.latitude;
      const lon = coord.longitude;
      const id = detectLiveCountryAt(lat, lon);
      if (id == null) return;
      if (id === 458) o.setMalaysiaRegion(o.malaysiaRegionFromLngLat(lon, lat));
      if (id === 360) {
        try {
          localStorage.setItem('terminal_id_city', o.indonesiaCityFromLngLat(lon, lat));
        } catch (_) {}
      }
      if (id === 418) {
        try {
          localStorage.setItem('terminal_la_province', o.laosProvinceFromLngLat(lon, lat));
        } catch (_) {}
      }
      const intraRegionPick =
        id === 458 ||
        id === 360 ||
        id === 702 ||
        id === 96 ||
        id === 764 ||
        id === 608 ||
        id === 116 ||
        id === 104 ||
        id === 704 ||
        id === 418;
      if (+window.__terminalSelectedCountryId === id && intraRegionPick) {
        o.updateRightPanelForCountry(id).catch(() => {});
        applyMkSel();
        if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(id, true);
        return;
      }
      o.setLeftOverview(id);
      applyMkSel();
    });

    function regionForCountry(countryId) {
      const id = +countryId;
      let center;
      let span = new mk.CoordinateSpan(8, 8);
      if (id === 360) {
        const city = o.getIndonesiaCity();
        const ll = o.ID_CITY_LONLAT[city];
        center = ll && Number.isFinite(ll[0])
          ? new mk.Coordinate(ll[1], ll[0])
          : LIVE_CENTER[360];
        span = new mk.CoordinateSpan(5, 5);
      } else if (id === 458) {
        const r = o.getMalaysiaRegion();
        center = r === 'SabahSarawak' ? new mk.Coordinate(5.5, 116) : new mk.Coordinate(3.2, 102);
        span = new mk.CoordinateSpan(6.5, 6.5);
      } else if (id === 702) {
        center = LIVE_CENTER[702];
        span = new mk.CoordinateSpan(0.45, 0.45);
      } else if (id === 96) {
        center = LIVE_CENTER[96];
        span = new mk.CoordinateSpan(2.2, 2.2);
      } else if (id === 764) {
        center = LIVE_CENTER[764];
        span = new mk.CoordinateSpan(9, 9);
      } else if (id === 608) {
        center = LIVE_CENTER[608];
        span = new mk.CoordinateSpan(10, 10);
      } else if (id === 116) {
        center = LIVE_CENTER[116];
        span = new mk.CoordinateSpan(5.5, 5.5);
      } else if (id === 104) {
        center = LIVE_CENTER[104];
        span = new mk.CoordinateSpan(11, 9);
      } else if (id === 704) {
        center = LIVE_CENTER[704];
        span = new mk.CoordinateSpan(12, 10);
      } else if (id === 418) {
        const prov = o.getLaosProvince();
        const ll = o.LA_PROVINCE_LONLAT[prov];
        center = ll && Number.isFinite(ll[0])
          ? new mk.Coordinate(ll[1], ll[0])
          : LIVE_CENTER[418];
        span = new mk.CoordinateSpan(5.2, 5.2);
      } else {
        return null;
      }
      return new mk.CoordinateRegion(center, span);
    }

    window.__terminalZoomToCountry = function zoomToCountry(countryId, animate) {
      const reg = regionForCountry(countryId);
      if (!reg) return;
      const doAnim = animate !== false;
      if (!doAnim) {
        map.region = reg;
        return;
      }
      if (typeof map.setRegionAnimated === 'function') {
        map.setRegionAnimated(reg);
      } else {
        map.region = reg;
      }
    };

    function mkZoomBy(factor) {
      const r = map.region;
      if (!r || !r.center || !r.span) return;
      const lat = Math.max(0.35, Math.min(55, r.span.latitudeSpan * factor));
      const lng = Math.max(0.35, Math.min(55, r.span.longitudeSpan * factor));
      const next = new mk.CoordinateRegion(r.center, new mk.CoordinateSpan(lat, lng));
      if (typeof map.setRegionAnimated === 'function') {
        map.setRegionAnimated(next);
      } else {
        map.region = next;
      }
    }

    const zIn = document.getElementById('zoom-in');
    const zOut = document.getElementById('zoom-out');
    if (zIn) {
      zIn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        mkZoomBy(0.82);
      };
    }
    if (zOut) {
      zOut.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        mkZoomBy(1.2);
      };
    }

    const initialId = window.__terminalSelectedCountryId ?? 458;
    if (window.__terminalMapDeepLinkCountry) {
      window.__terminalZoomToCountry(initialId, false);
    }
    applyMkSel();
  };
})();
