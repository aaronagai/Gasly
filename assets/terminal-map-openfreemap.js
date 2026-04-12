/**
 * Terminal map: MapLibre GL + OpenFreeMap tiles (replaces D3 globe when no MapKit JWT).
 * Requires: maplibregl, topojson (global), config OPENFREEMAP_STYLE_URL (+ optional _DARK).
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

  window.__renderTerminalMapOpenFreeMap = function (o) {
    const root = o.root;
    const LIVE = o.LIVE;
    const SEA_IDS = o.SEA_IDS;
    const NAMES = o.NAMES;

    root.innerHTML = '';
    root.classList.remove('terminal-mapkit-root');
    root.classList.add('terminal-map-openfreemap-root');

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

    window.__terminalOfmMap = map;

    function applySel() {}

    window.__terminalMapKitApplySelection = applySel;

    function handleCountryPick(nid, lngLat) {
      if (nid == null || NAMES[nid] == null) return;
      const lon = lngLat.lng;
      const lat = lngLat.lat;

      if (nid === 458) {
        o.setMalaysiaRegion(o.malaysiaRegionFromLngLat(lon, lat));
        if (+window.__terminalSelectedCountryId === 458) {
          o.updateRightPanelForCountry(458).catch(() => {});
          applySel();
          if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(458, true);
          return;
        }
      }
      if (nid === 360) {
        try {
          localStorage.setItem('terminal_id_city', o.indonesiaCityFromLngLat(lon, lat));
        } catch (_) {}
        if (+window.__terminalSelectedCountryId === 360) {
          o.updateRightPanelForCountry(360).catch(() => {});
          applySel();
          if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(360, true);
          return;
        }
      }
      if (nid === 702 && +window.__terminalSelectedCountryId === 702) {
        o.updateRightPanelForCountry(702).catch(() => {});
        applySel();
        return;
      }
      if (nid === 764 && +window.__terminalSelectedCountryId === 764) {
        o.updateRightPanelForCountry(764).catch(() => {});
        applySel();
        if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(764, true);
        return;
      }
      if (nid === 608 && +window.__terminalSelectedCountryId === 608) {
        o.updateRightPanelForCountry(608).catch(() => {});
        applySel();
        if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(608, true);
        return;
      }
      if (nid === 418) {
        try {
          localStorage.setItem('terminal_la_province', o.laosProvinceFromLngLat(lon, lat));
        } catch (_) {}
        if (+window.__terminalSelectedCountryId === 418) {
          o.updateRightPanelForCountry(418).catch(() => {});
          applySel();
          if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(418, true);
          return;
        }
      }
      if (nid === 116 && +window.__terminalSelectedCountryId === 116) {
        o.updateRightPanelForCountry(116).catch(() => {});
        applySel();
        if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(116, true);
        return;
      }
      if (nid === 104 && +window.__terminalSelectedCountryId === 104) {
        o.updateRightPanelForCountry(104).catch(() => {});
        applySel();
        if (typeof window.__terminalZoomToCountry === 'function') window.__terminalZoomToCountry(104, true);
        return;
      }

      o.setLeftOverview(nid);
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

        window.__terminalZoomToCountry = function zoomToCountry(countryId, animate) {
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
          if (id === 764) {
            map.easeTo({ center: [100.6, 13.8], zoom: 5.55, duration: dur });
            return;
          }
          if (id === 608) {
            map.easeTo({ center: [122.5, 12.2], zoom: 5.65, duration: dur });
            return;
          }
          if (id === 116) {
            map.easeTo({ center: [104.9, 12.55], zoom: 6.15, duration: dur });
            return;
          }
          if (id === 104) {
            map.easeTo({ center: [96.0, 19.8], zoom: 5.25, duration: dur });
            return;
          }
          if (id === 418) {
            let prov = 'Vientiane Capital';
            try {
              prov = localStorage.getItem('terminal_la_province') || 'Vientiane Capital';
            } catch (_) {}
            const ll = (o.LA_PROVINCE_LONLAT && o.LA_PROVINCE_LONLAT[prov]) || [103.8, 18.2];
            const c = ll && Number.isFinite(ll[0]) ? [ll[0], ll[1]] : [103.8, 18.2];
            map.easeTo({ center: c, zoom: 6.35, duration: dur });
            return;
          }
          if (f && f.geometry) {
            const bb = boundsFromGeometry(f.geometry);
            if (bb) {
              map.fitBounds(bb, { padding: 52, duration: dur, maxZoom: 7.2 });
              return;
            }
          }
        };

        const zIn = document.getElementById('zoom-in');
        const zOut = document.getElementById('zoom-out');
        if (zIn) {
          zIn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            map.easeTo({ zoom: Math.min(map.getZoom() + 0.72, 14), duration: 180 });
          };
        }
        if (zOut) {
          zOut.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            map.easeTo({ zoom: Math.max(map.getZoom() - 0.72, 2.4), duration: 180 });
          };
        }

        map.on('mousemove', (e) => {
          const nid = pickCountryId(map, e);
          const canvas = map.getCanvas();
          if (nid == null || NAMES[nid] == null) {
            o.hideTip();
            canvas.style.cursor = '';
            return;
          }
          canvas.style.cursor = LIVE[nid] || SEA_IDS.includes(nid) ? 'pointer' : '';
          o.showTip(e.originalEvent, nid);
        });

        map.on('mouseout', () => {
          o.hideTip();
          map.getCanvas().style.cursor = '';
        });

        map.on('click', (e) => {
          const nid = pickCountryId(map, e);
          if (nid == null || NAMES[nid] == null) return;
          handleCountryPick(nid, e.lngLat);
        });

        map.on('touchstart', (e) => {
          if (!e.originalEvent.touches || !e.originalEvent.touches.length) return;
          const nid = pickCountryId(map, e);
          if (nid == null || NAMES[nid] == null) {
            o.hideTip();
            return;
          }
          const t = e.originalEvent.touches[0];
          o.showTip(t, nid);
        });

          const initialId = window.__terminalSelectedCountryId ?? 458;
          window.__terminalZoomToCountry(initialId, false);
          applySel();
        })
        .catch((err) => {
          console.error('Terminal OpenFreeMap data failed', err);
        });
    });

    const wrap = root.closest('.terminal-map-wrap') || root.parentElement;
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

