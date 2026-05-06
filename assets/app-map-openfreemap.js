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

  function featNid(feat) {
    if (!feat) return null;
    const p = feat.properties || {};
    let v = p.nid;
    if (v == null && feat.id != null) v = feat.id;
    if (v == null) return null;
    const n = +v;
    return Number.isFinite(n) ? n : null;
  }

  /** Prefer a selectable / live country in the hit stack (e.g. Vietnam under China). */
  function pickCountryId(map, e, selectableById, names) {
    if (!map.getLayer('countries-hit')) return null;
    const feats = map.queryRenderedFeatures(e.point, { layers: ['countries-hit'] });
    if (!feats.length) return null;
    for (let i = 0; i < feats.length; i++) {
      const nid = featNid(feats[i]);
      if (nid == null || names[nid] == null) continue;
      if (selectableById && selectableById[nid] != null) return nid;
    }
    const top = featNid(feats[0]);
    return names[top] != null ? top : null;
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

    let __appMapResizeRaf = null;
    function scheduleMapResize() {
      if (__appMapResizeRaf != null) return;
      __appMapResizeRaf = requestAnimationFrame(() => {
        __appMapResizeRaf = null;
        try {
          map.resize();
        } catch (_) {}
      });
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
          o.refreshHighlights(458, { syncSearchBar: false }).catch(() => {});
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
          o.refreshHighlights(360, { syncSearchBar: false }).catch(() => {});
          applySel();
          if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(360, true);
          return;
        }
      }
      if (nid === 702 && cur === 702) {
        o.refreshHighlights(702, { syncSearchBar: false }).catch(() => {});
        applySel();
        if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(702, true);
        return;
      }
      if (nid === 764 && cur === 764) {
        o.refreshHighlights(764, { syncSearchBar: false }).catch(() => {});
        applySel();
        if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(764, true);
        return;
      }
      if (nid === 608 && cur === 608) {
        o.refreshHighlights(608, { syncSearchBar: false }).catch(() => {});
        applySel();
        if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(608, true);
        return;
      }
      if (nid === 418) {
        try {
          localStorage.setItem('terminal_la_province', o.laosProvinceFromLngLat(lon, lat));
        } catch (_) {}
        if (cur === 418) {
          o.refreshHighlights(418, { syncSearchBar: false }).catch(() => {});
          applySel();
          if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(418, true);
          return;
        }
      }
      if (nid === 116 && cur === 116) {
        o.refreshHighlights(116, { syncSearchBar: false }).catch(() => {});
        applySel();
        if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(116, true);
        return;
      }
      if (nid === 104 && cur === 104) {
        o.refreshHighlights(104, { syncSearchBar: false }).catch(() => {});
        applySel();
        if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(104, true);
        return;
      }
      if (nid === 704 && cur === 704) {
        o.refreshHighlights(704, { syncSearchBar: false }).catch(() => {});
        applySel();
        if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(704, true);
        return;
      }

      o.setSelected(nid, { syncSearchBar: false });
      applySel();
    }

    map.on('load', () => {
      suppressOpenFreeMapTextLabels(map);
      includeOpenFreeMapMaritimeBoundaries(map);
      applyOpenFreeMapOrangeLand(map);

      // China flag marker (live country affordance on the map)
      try {
        if (COUNTRIES && COUNTRIES[156]) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'app-map-flag-marker';
          el.setAttribute('aria-label', 'China');
          const img = document.createElement('img');
          img.src = 'assets/vendor/flag-icons/flags/1x1/cn.svg';
          img.alt = '';
          img.decoding = 'async';
          img.loading = 'lazy';
          el.appendChild(img);
          el.addEventListener('click', function (ev) {
            try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
            try {
              o.setSelected(156, { syncSearchBar: true });
            } catch (_) {}
            try {
              if (typeof window.APP_ZOOM_TO === 'function') window.APP_ZOOM_TO(156, true);
            } catch (_) {}
          });
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([104.0, 35.0])
            .addTo(map);
        }
      } catch (_) {}

      Promise.all([
        fetch('./assets/countries-110m.json').then((r) => r.json()),
        fetch('./assets/singapore-geo.json').then((r) => r.json()).catch(() => null),
      ])
        .then(([world, sgFeat]) => {
          const countries = topojson.feature(world, world.objects.countries);
          const features = countries.features.map((f) => ({
            type: 'Feature',
            id: +f.id,
            properties: { ...(f.properties || {}), nid: +f.id },
            geometry: f.geometry,
          }));
          if (sgFeat && sgFeat.type === 'Feature' && sgFeat.geometry) {
            features.push({
              type: 'Feature',
              id: 702,
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
          });

          map.addLayer({
            id: 'countries-hit',
            type: 'fill',
            source: 'countries',
            layout: {
              'fill-sort-key': [
                'match',
                ['to-number', ['get', 'nid']],
                704, 1000,
                702, 900,
                458, 800,
                360, 700,
                104, 650,
                418, 600,
                116, 550,
                96, 500,
                764, 500,
                608, 500,
                0,
              ],
            },
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

          function readAppSheetHeightPx() {
            try {
              const raw = getComputedStyle(document.documentElement).getPropertyValue('--sheetH').trim();
              const m = /^(\d+(?:\.\d+)?)px$/.exec(raw);
              if (m) return Math.round(Number(m[1]));
            } catch (_) {}
            return 0;
          }

          /**
           * Bottom inset for SEA overview. Uses --sheetH (reliable) and optionally a measured band only
           * when the sheet rect looks sane — bad first-frame rects caused huge padding and a camera
           * over the Southern Ocean.
           */
          function appMapSeaOverviewPadding() {
            const h = Math.max(1, map.getContainer().clientHeight);
            const side = 72;
            const sheetH = readAppSheetHeightPx();
            let bottomReserve = sheetH > 0 ? sheetH + 22 : Math.round(h * 0.22);

            const sheetEl = document.getElementById('sheet');
            if (sheetEl && typeof sheetEl.getBoundingClientRect === 'function') {
              const r = sheetEl.getBoundingClientRect();
              const host = map.getContainer().getBoundingClientRect();
              if (
                r.height >= 64 &&
                r.top > 80 &&
                host.height > 200 &&
                r.top < host.bottom - 120
              ) {
                const measured = Math.round(host.bottom - r.top + 2);
                if (measured >= 120 && measured <= host.height * 0.52) {
                  bottomReserve = measured;
                }
              }
            }

            const innerMin = 260;
            const maxReserve = Math.max(140, h - side - innerMin);
            const reserved = Math.min(Math.max(bottomReserve, 120), maxReserve);

            return { top: side, right: side, bottom: side + reserved, left: side };
          }

          function seaBoundsLookSane(bb) {
            if (!bb || !bb[0] || !bb[1]) return false;
            const [w, s] = bb[0];
            const [e, n] = bb[1];
            const lonSpan = e - w;
            const latSpan = n - s;
            return (
              lonSpan > 2 &&
              lonSpan < 60 &&
              latSpan > 2 &&
              latSpan < 40 &&
              s > -14 &&
              n < 35 &&
              w > 80 &&
              e < 155
            );
          }

          /** Union of map feature bounds for SEA ids (first paint: whole region above the sheet). */
          function boundsForSeaIds() {
            const ids = Array.isArray(o.SEA_IDS) ? o.SEA_IDS : [];
            let west = Infinity;
            let south = Infinity;
            let east = -Infinity;
            let north = -Infinity;
            for (let i = 0; i < ids.length; i++) {
              const f = byNid[+ids[i]];
              if (!f || !f.geometry) continue;
              const bb = boundsFromGeometry(f.geometry);
              if (!bb) continue;
              west = Math.min(west, bb[0][0]);
              south = Math.min(south, bb[0][1]);
              east = Math.max(east, bb[1][0]);
              north = Math.max(north, bb[1][1]);
            }
            if (!(west < east && south < north)) return null;
            /* Clip extreme southern tails (e.g. deep IN outer isles) without hiding Timor (~-9.3). */
            const southClamp = -10.75;
            south = Math.max(south, southClamp);
            if (!(south < north)) return null;
            return [
              [west, south],
              [east, north],
            ];
          }

          function fitSeaOverview(animate) {
            const run = () => {
              try {
                map.resize();
              } catch (_) {}
              const dur = animate ? 520 : 0;
              const h = Math.max(1, map.getContainer().clientHeight);
              const off = [0, -Math.round(h * 0.22)];
              const seaBb = boundsForSeaIds();
              if (seaBb && seaBoundsLookSane(seaBb)) {
                map.fitBounds(seaBb, {
                  padding: appMapSeaOverviewPadding(),
                  duration: dur,
                  maxZoom: 6.45,
                });
                const z = map.getZoom();
                if (Number.isFinite(z)) {
                  map.setZoom(Math.min(z + 0.48, 6.45));
                }
                /* Nudge northwest: slightly higher latitude, slightly lower longitude. */
                const c = map.getCenter();
                map.setCenter([c.lng - 1.05, c.lat + 0.72]);
                return;
              }
              map.easeTo({ center: [113.9, 5.35], zoom: 4.75, duration: dur, offset: off });
            };
            if (animate) run();
            else requestAnimationFrame(() => requestAnimationFrame(run));
          }

          window.APP_ZOOM_TO = function zoomToCountry(countryId, animate) {
            try {
              map.stop();
            } catch (_) {}
            const id = +countryId;
            const dur = animate ? 480 : 0;
            const off = appMapFocusOffset();
            const f = byNid[id];
            /** After SEA overview (~6.4+) legacy preset zooms were lower, so easeTo zoomed *out*. */
            function zoomAtLeast(preset, cap) {
              const lim = cap == null ? 12 : cap;
              let cur = 5;
              try {
                cur = map.getZoom();
              } catch (_) {}
              if (!Number.isFinite(cur)) cur = 5;
              return Math.min(Math.max(preset, cur + 0.38), lim);
            }
            if (id === 360) {
              let city = 'Jakarta Pusat';
              try {
                city = localStorage.getItem('terminal_id_city') || 'Jakarta Pusat';
              } catch (_) {}
              const ll = o.ID_CITY_LONLAT[city];
              const c = ll && Number.isFinite(ll[0]) ? [ll[0], ll[1]] : [118, -2.5];
              map.easeTo({ center: c, zoom: zoomAtLeast(4.75), duration: dur, offset: off });
              return;
            }
            if (id === 458) {
              let region = 'Semenanjung';
              try {
                const k = localStorage.getItem('terminal_my_region') || 'Semenanjung';
                region = k === 'SabahSarawak' ? 'SabahSarawak' : 'Semenanjung';
              } catch (_) {}
              const c = region === 'SabahSarawak' ? [115, 4] : [102, 4];
              const z0 = region === 'SabahSarawak' ? 5.05 : 4.9;
              map.easeTo({ center: c, zoom: zoomAtLeast(z0), duration: dur, offset: off });
              return;
            }
            if (id === 702) {
              map.easeTo({ center: [103.82, 1.35], zoom: zoomAtLeast(10.2, 14), duration: dur, offset: off });
              return;
            }
            if (id === 96) {
              map.easeTo({ center: [114.65, 4.55], zoom: zoomAtLeast(7.25), duration: dur, offset: off });
              return;
            }
            if (id === 764) {
              map.easeTo({ center: [100.6, 13.8], zoom: zoomAtLeast(5.35), duration: dur, offset: off });
              return;
            }
            if (id === 608) {
              map.easeTo({ center: [122.5, 12.2], zoom: zoomAtLeast(5.45), duration: dur, offset: off });
              return;
            }
            if (id === 116) {
              map.easeTo({ center: [104.9, 12.55], zoom: zoomAtLeast(5.95), duration: dur, offset: off });
              return;
            }
            if (id === 104) {
              map.easeTo({ center: [96.0, 19.8], zoom: zoomAtLeast(5.05), duration: dur, offset: off });
              return;
            }
            if (id === 704) {
              map.easeTo({ center: [108.3, 14.2], zoom: zoomAtLeast(5.35), duration: dur, offset: off });
              return;
            }
            if (id === 418) {
              let prov = 'Vientiane Capital';
              try {
                prov = localStorage.getItem('terminal_la_province') || 'Vientiane Capital';
              } catch (_) {}
              const ll = (o.LA_PROVINCE_LONLAT && o.LA_PROVINCE_LONLAT[prov]) || [103.8, 18.2];
              const c = ll && Number.isFinite(ll[0]) ? [ll[0], ll[1]] : [103.8, 18.2];
              map.easeTo({ center: c, zoom: zoomAtLeast(6.05), duration: dur, offset: off });
              return;
            }
            if (f && f.geometry) {
              const bb = boundsFromGeometry(f.geometry);
              if (bb) {
                map.fitBounds(bb, {
                  padding: appMapFitBoundsPadding(),
                  duration: dur,
                  maxZoom: 11,
                  offset: off,
                });
              }
            }
          };

          map.on('mousemove', (e) => {
            const nid = pickCountryId(map, e, COUNTRIES, NAMES);
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

          let lastMapPickMs = 0;
          function onMapPick(e) {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
            if (now - lastMapPickMs < 380) return;
            lastMapPickMs = now;
            const nid = pickCountryId(map, e, COUNTRIES, NAMES);
            if (nid == null || COUNTRIES[nid] == null) return;
            handleCountryPick(nid, e.lngLat);
          }
          map.on('click', onMapPick);
          /* Touches do not always emit `click` on the canvas reliably across mobile WebKit builds. */
          map.on('touchend', (e) => {
            if (!e.originalEvent.changedTouches || e.originalEvent.changedTouches.length !== 1) return;
            onMapPick(e);
          });

          fitSeaOverview(false);
          applySel();
        })
        .catch((err) => {
          console.error('App OpenFreeMap data failed', err);
        });
    });

    const wrap = root.closest('.map') || root.parentElement;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        scheduleMapResize();
      });
      ro.observe(wrap);
    }
    window.addEventListener('resize', () => {
      scheduleMapResize();
    });
  };
})();
