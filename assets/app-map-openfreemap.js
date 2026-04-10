/**
 * App map: MapLibre GL + OpenFreeMap (same style/layers as terminal OpenFreeMap).
 * Requires: maplibregl, topojson, getOpenFreeMapStyleUrl / OPENFREEMAP_STYLE_URL.
 */
(function () {
  function expandBounds(b, coord) {
    const x = coord[0];
    const y = coord[1];
    b.minX = Math.min(b.minX, x);
    b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y);
    b.maxY = Math.max(b.maxY, y);
  }

  function boundsFromGeometry(geom) {
    if (!geom) return null;
    const b = { minX: 180, maxX: -180, minY: 90, maxY: -90 };
    function ring(r) {
      for (let i = 0; i < r.length; i++) expandBounds(b, r[i]);
    }
    if (geom.type === 'Polygon') {
      geom.coordinates.forEach(ring);
    } else if (geom.type === 'MultiPolygon') {
      for (let i = 0; i < geom.coordinates.length; i++) {
        const poly = geom.coordinates[i];
        if (poly[0]) ring(poly[0]);
      }
    } else {
      return null;
    }
    if (b.minX > b.maxX || b.minY > b.maxY) return null;
    return [
      [b.minX, b.minY],
      [b.maxX, b.maxY],
    ];
  }

  function pickCountryId(map, e) {
    if (!map.getLayer('countries-hit')) return null;
    const feats = map.queryRenderedFeatures(e.point, { layers: ['countries-hit'] });
    if (!feats.length) return null;
    return feats[0].properties.nid;
  }

  window.__renderAppMapOpenFreeMap = function (o) {
    const root = o.root;
    const COUNTRIES = o.COUNTRIES;
    const SEA_IDS = o.SEA_IDS;
    const NAMES = o.NAMES;

    root.innerHTML = '';
    root.classList.add('app-map-openfreemap-root');

    const styleUrl =
      typeof getOpenFreeMapStyleUrl === 'function'
        ? getOpenFreeMapStyleUrl()
        : typeof OPENFREEMAP_STYLE_URL === 'string'
          ? OPENFREEMAP_STYLE_URL
          : 'https://tiles.openfreemap.org/styles/positron';

    const map = new maplibregl.Map({
      container: root,
      style: styleUrl,
      center: [115, 3],
      zoom: 4.35,
      minZoom: 2.4,
      maxZoom: 14,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      cooperativeGestures: false,
      attributionControl: false,
    });

    if (map.keyboard && typeof map.keyboard.disable === 'function') {
      map.keyboard.disable();
    }
    if (map.touchZoomRotate && typeof map.touchZoomRotate.disableRotation === 'function') {
      map.touchZoomRotate.disableRotation();
    }

    window.__appOfmMap = map;

    function applySel() {}

    window.__appMapApplySelection = applySel;

    function handleCountryPick(nid, lngLat) {
      if (COUNTRIES[nid] == null) return;
      const lon = lngLat.lng;
      const lat = lngLat.lat;
      const cur = +o.getSelected();

      if (nid === 458) {
        try {
          localStorage.setItem('terminal_my_region', o.malaysiaRegionFromLngLat(lon, lat));
        } catch (_) {}
        if (cur === 458) {
          o.refreshHighlights(458).catch(() => {});
          applySel();
          if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(458, true);
          return;
        }
      }
      if (nid === 360) {
        try {
          localStorage.setItem('terminal_id_city', o.indonesiaCityFromLngLat(lon, lat));
        } catch (_) {}
        if (cur === 360) {
          o.refreshHighlights(360).catch(() => {});
          applySel();
          if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(360, true);
          return;
        }
      }
      if (nid === 702 && cur === 702) {
        o.refreshHighlights(702).catch(() => {});
        applySel();
        return;
      }

      o.setSelected(nid);
      applySel();
    }

    map.on('load', () => {
      suppressOpenFreeMapTextLabels(map);
      includeOpenFreeMapMaritimeBoundaries(map);
      applyOpenFreeMapOrangeLand(map);
      Promise.all([
        fetch('./assets/countries-110m.json').then((r) => r.json()),
        fetch('./assets/singapore-geo.json').then((r) => r.json()).catch(() => null),
      ])
        .then(([world, sgFeat]) => {
          const countries = topojson.feature(world, world.objects.countries);
          const features = countries.features.map((f) => ({
            type: 'Feature',
            properties: { ...(f.properties || {}), nid: +f.id },
            geometry: f.geometry,
          }));
          if (sgFeat && sgFeat.type === 'Feature' && sgFeat.geometry) {
            features.push({
              type: 'Feature',
              properties: { ...(sgFeat.properties || {}), nid: 702 },
              geometry: sgFeat.geometry,
            });
          }

          const byNid = {};
          features.forEach((f) => {
            const n = f.properties.nid;
            if (n != null) byNid[n] = f;
          });

          map.addSource('countries', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
            promoteId: 'nid',
          });

          map.addLayer({
            id: 'countries-hit',
            type: 'fill',
            source: 'countries',
            paint: { 'fill-opacity': 0 },
          });

          /** Shift camera target upward so framed area sits above the bottom sheet, not behind it. */
          function appMapFocusOffset() {
            const h = map.getContainer().clientHeight;
            if (!h) return [0, 0];
            return [0, -Math.round(h * 0.24)];
          }

          function appMapFitBoundsPadding() {
            const h = map.getContainer().clientHeight;
            const side = 72;
            const bottomExtra = h ? Math.round(h * 0.22) : 120;
            return { top: side, right: side, bottom: side + bottomExtra, left: side };
          }

          window.APP_ZOOM_TO = function zoomToCountry(countryId, animate) {
            const id = +countryId;
            const dur = animate ? 480 : 0;
            const off = appMapFocusOffset();
            const f = byNid[id];
            if (id === 360) {
              let city = 'Jakarta Pusat';
              try {
                city = localStorage.getItem('terminal_id_city') || 'Jakarta Pusat';
              } catch (_) {}
              const ll = o.ID_CITY_LONLAT[city];
              const c = ll && Number.isFinite(ll[0]) ? [ll[0], ll[1]] : [118, -2.5];
              map.easeTo({ center: c, zoom: 4.75, duration: dur, offset: off });
              return;
            }
            if (id === 458) {
              let region = 'Semenanjung';
              try {
                const k = localStorage.getItem('terminal_my_region') || 'Semenanjung';
                region = k === 'SabahSarawak' ? 'SabahSarawak' : 'Semenanjung';
              } catch (_) {}
              const c = region === 'SabahSarawak' ? [115, 4] : [102, 4];
              map.easeTo({ center: c, zoom: 4.9, duration: dur, offset: off });
              return;
            }
            if (id === 702) {
              map.easeTo({ center: [103.82, 1.35], zoom: 10.2, duration: dur, offset: off });
              return;
            }
            if (id === 96) {
              map.easeTo({ center: [114.65, 4.55], zoom: 7.25, duration: dur, offset: off });
              return;
            }
            if (f && f.geometry) {
              const bb = boundsFromGeometry(f.geometry);
              if (bb) {
                map.fitBounds(bb, { padding: appMapFitBoundsPadding(), duration: dur, maxZoom: 6.65 });
              }
            }
          };

          map.on('mousemove', (e) => {
            const nid = pickCountryId(map, e);
            const canvas = map.getCanvas();
            if (nid == null || NAMES[nid] == null) {
              canvas.style.cursor = '';
              return;
            }
            canvas.style.cursor = COUNTRIES[nid] || SEA_IDS.includes(nid) ? 'pointer' : '';
          });

          map.on('mouseout', () => {
            map.getCanvas().style.cursor = '';
          });

          map.on('click', (e) => {
            const nid = pickCountryId(map, e);
            if (nid == null || COUNTRIES[nid] == null) return;
            handleCountryPick(nid, e.lngLat);
          });

          const initialId = o.getSelected() ?? 458;
          window.APP_ZOOM_TO(initialId, false);
          applySel();
        })
        .catch((err) => {
          console.error('App OpenFreeMap data failed', err);
        });
    });

    const wrap = root.closest('.map') || root.parentElement;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        try {
          map.resize();
        } catch (_) {}
      });
      ro.observe(wrap);
    }
    window.addEventListener('resize', () => {
      try {
        map.resize();
      } catch (_) {}
    });
  };
})();
