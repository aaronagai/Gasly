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
    const LIVE_IDS = Object.keys(COUNTRIES).map(Number);
    const LIVE_IDS_UNDER_SG = LIVE_IDS.filter((id) => id !== 702);
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
      attributionControl: true,
    });

    if (map.keyboard && typeof map.keyboard.disable === 'function') {
      map.keyboard.disable();
    }

    window.__appOfmMap = map;

    let hoveredNid = null;
    function clearHover() {
      if (hoveredNid != null) {
        try {
          map.setFeatureState({ source: 'countries', id: hoveredNid }, { hover: false });
        } catch (_) {}
        hoveredNid = null;
      }
    }

    function applySel() {
      const sel = +o.getSelected();
      LIVE_IDS.forEach((id) => {
        try {
          map.setFeatureState({ source: 'countries', id }, { selected: id === sel });
        } catch (_) {}
      });
    }

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

          map.addLayer({
            id: 'countries-hover-nonlive',
            type: 'fill',
            source: 'countries',
            filter: ['!', ['in', ['get', 'nid'], ['literal', LIVE_IDS]]],
            paint: {
              'fill-color': '#303030',
              'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.1, 0],
            },
          });

          const liveFillPaint = {
            'fill-color': 'rgba(255,106,0,1)',
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              0.4,
              ['case', ['boolean', ['feature-state', 'hover'], false], 0.34, 0.22],
            ],
          };

          map.addLayer({
            id: 'countries-live-fill',
            type: 'fill',
            source: 'countries',
            filter: ['in', ['get', 'nid'], ['literal', LIVE_IDS_UNDER_SG]],
            paint: liveFillPaint,
          });

          map.addLayer({
            id: 'countries-live-fill-singapore',
            type: 'fill',
            source: 'countries',
            filter: ['==', ['get', 'nid'], 702],
            paint: liveFillPaint,
          });

          map.addLayer({
            id: 'countries-outline',
            type: 'line',
            source: 'countries',
            filter: ['!=', ['get', 'nid'], 702],
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                'rgba(255,106,0,0.95)',
                ['in', ['get', 'nid'], ['literal', LIVE_IDS]],
                'rgba(255,106,0,0.75)',
                ['in', ['get', 'nid'], ['literal', SEA_IDS]],
                'rgba(120,120,120,0.35)',
                'rgba(100,100,100,0.28)',
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                2,
                ['in', ['get', 'nid'], ['literal', LIVE_IDS]],
                1.35,
                0.55,
              ],
            },
          });

          map.addLayer({
            id: 'countries-outline-singapore',
            type: 'line',
            source: 'countries',
            filter: ['==', ['get', 'nid'], 702],
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                'rgba(255,106,0,0.95)',
                'rgba(255,106,0,0.75)',
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                2,
                1.35,
              ],
            },
          });

          window.APP_ZOOM_TO = function zoomToCountry(countryId, animate) {
            const id = +countryId;
            const dur = animate ? 480 : 0;
            const f = byNid[id];
            if (id === 360) {
              let city = 'Jakarta Pusat';
              try {
                city = localStorage.getItem('terminal_id_city') || 'Jakarta Pusat';
              } catch (_) {}
              const ll = o.ID_CITY_LONLAT[city];
              const c = ll && Number.isFinite(ll[0]) ? [ll[0], ll[1]] : [118, -2.5];
              map.easeTo({ center: c, zoom: 5.15, duration: dur });
              return;
            }
            if (id === 458) {
              let region = 'Semenanjung';
              try {
                const k = localStorage.getItem('terminal_my_region') || 'Semenanjung';
                region = k === 'SabahSarawak' ? 'SabahSarawak' : 'Semenanjung';
              } catch (_) {}
              const c = region === 'SabahSarawak' ? [115, 4] : [102, 4];
              map.easeTo({ center: c, zoom: 5.5, duration: dur });
              return;
            }
            if (id === 702) {
              map.easeTo({ center: [103.82, 1.35], zoom: 10.8, duration: dur });
              return;
            }
            if (id === 96) {
              map.easeTo({ center: [114.65, 4.55], zoom: 7.8, duration: dur });
              return;
            }
            if (f && f.geometry) {
              const bb = boundsFromGeometry(f.geometry);
              if (bb) {
                map.fitBounds(bb, { padding: 52, duration: dur, maxZoom: 7.2 });
              }
            }
          };

          map.on('mousemove', (e) => {
            const nid = pickCountryId(map, e);
            const canvas = map.getCanvas();
            if (nid == null || NAMES[nid] == null) {
              clearHover();
              canvas.style.cursor = '';
              return;
            }
            if (hoveredNid !== nid) {
              clearHover();
              hoveredNid = nid;
              try {
                map.setFeatureState({ source: 'countries', id: hoveredNid }, { hover: true });
              } catch (_) {}
            }
            canvas.style.cursor = COUNTRIES[nid] || SEA_IDS.includes(nid) ? 'pointer' : '';
          });

          map.on('mouseout', () => {
            clearHover();
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
