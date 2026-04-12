/**
 * Homepage hero map — loaded after first paint so MapLibre + tiles are not render-blocking.
 * Requires: assets/config.js, assets/utils.js (defer, listed before this script in index.html).
 */
(function () {
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.target.closest('#index-hero-map') || e.target.closest('#tooltip')) return;
      document.getElementById('tooltip')?.classList.remove('show');
    },
    { passive: true },
  );

  const containerId = 'index-hero-map';

  function injectStylesheet(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  function bootMap() {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.mapInit === '1') return;
    container.dataset.mapInit = '1';
    container.classList.add('index-hero-map--loading');

    injectStylesheet('https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css');

    const LIVE = {
      458: { name: 'Malaysia', url: '/terminal?country=458&my_region=peninsular' },
      702: { name: 'Singapore', url: '/terminal?country=702' },
      96: { name: 'Brunei', url: '/terminal?country=96' },
      360: { name: 'Indonesia', url: '/terminal?country=360' },
      764: { name: 'Thailand', url: '/terminal?country=764' },
      608: { name: 'Philippines', url: '/terminal?country=608' },
      116: { name: 'Cambodia', url: '/terminal?country=116' },
      418: { name: 'Laos', url: '/terminal?country=418' },
      104: { name: 'Myanmar', url: '/terminal?country=104' },
    };

    const NAMES = {
      36: 'Australia', 50: 'Bangladesh', 96: 'Brunei', 104: 'Myanmar',
      116: 'Cambodia', 144: 'Sri Lanka', 156: 'China', 158: 'Taiwan',
      356: 'India', 360: 'Indonesia', 392: 'Japan', 410: 'South Korea',
      418: 'Laos', 458: 'Malaysia', 598: 'Papua New Guinea', 608: 'Philippines',
      626: 'Timor-Leste', 702: 'Singapore', 704: 'Vietnam', 764: 'Thailand',
    };

    const SEA_IDS = Array.from(typeof SEA !== 'undefined' ? SEA : []);
    const mobile = window.matchMedia('(max-width: 640px)').matches;

    const tooltip = document.getElementById('tooltip');
    const ttCountry = document.getElementById('tt-country');
    const ttStatus = document.getElementById('tt-status');

    function showTip(clientX, clientY, id) {
      if (!tooltip || !ttCountry || !ttStatus) return;
      const name = NAMES[id];
      if (!name) return;
      const live = !!LIVE[id];
      ttCountry.textContent = name;
      ttStatus.textContent = live ? '● Live data' : '○ Coming soon';
      ttStatus.className = 'tt-status ' + (live ? 'live' : 'soon');
      tooltip.classList.add('show');
      moveTip(clientX, clientY);
    }

    function moveTip(cx, cy) {
      if (!tooltip) return;
      let x = cx + 14;
      let y = cy - 46;
      if (x + 170 > window.innerWidth) x = cx - 170;
      if (y < 8) y = cy + 14;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }

    function hideTip() {
      tooltip?.classList.remove('show');
    }

    const styleUrl =
      typeof getOpenFreeMapStyleUrl === 'function'
        ? getOpenFreeMapStyleUrl()
        : typeof OPENFREEMAP_STYLE_URL === 'string'
          ? OPENFREEMAP_STYLE_URL
          : 'https://tiles.openfreemap.org/styles/positron';

    loadScript('https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js'))
      .then(() => {
        if (!window.maplibregl || !window.topojson) {
          throw new Error('MapLibre or TopoJSON global missing');
        }
        return Promise.all([
          fetch('./assets/countries-110m.json').then((r) => r.json()),
          fetch('./assets/singapore-geo.json').then((r) => r.json()).catch(() => null),
        ]);
      })
      .then(([world, sgFeat]) => {
        const countries = window.topojson.feature(world, world.objects.countries);
        const features = countries.features.map((f) => ({
          type: 'Feature',
          id: f.id,
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

        const map = new maplibregl.Map({
          container: containerId,
          style: styleUrl,
          center: [115, mobile ? 6 : 9],
          zoom: mobile ? 3.35 : 3.65,
          minZoom: 2.6,
          maxZoom: 14,
          maxPitch: 0,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          cooperativeGestures: true,
          attributionControl: false,
        });

        function pickCountryId(e) {
          if (!map.getLayer('countries-hit')) return null;
          const feats = map.queryRenderedFeatures(e.point, { layers: ['countries-hit'] });
          if (!feats.length) return null;
          const nid = feats[0].properties.nid;
          return NAMES[nid] != null ? nid : null;
        }

        map.on('load', () => {
          container.classList.remove('index-hero-map--loading');
          suppressOpenFreeMapTextLabels(map, { hideCountryRegionLabels: true });
          includeOpenFreeMapMaritimeBoundaries(map);
          applyOpenFreeMapOrangeLand(map);
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
        });

        map.on('mousemove', (e) => {
          const nid = pickCountryId(e);
          const canvas = map.getCanvas();
          if (nid == null) {
            hideTip();
            canvas.style.cursor = '';
            return;
          }
          canvas.style.cursor = LIVE[nid] || SEA_IDS.includes(nid) ? 'pointer' : '';
          showTip(e.originalEvent.clientX, e.originalEvent.clientY, nid);
        });

        map.on('mouseout', () => {
          hideTip();
          map.getCanvas().style.cursor = '';
        });

        map.on('click', (e) => {
          const nid = pickCountryId(e);
          if (nid == null) return;
          const c = LIVE[nid];
          if (c) window.location.href = c.url;
        });

        map.on('touchstart', (e) => {
          if (!e.originalEvent.touches || !e.originalEvent.touches.length) return;
          const nid = pickCountryId(e);
          if (nid == null) {
            hideTip();
            return;
          }
          const t = e.originalEvent.touches[0];
          showTip(t.clientX, t.clientY, nid);
        });

        const sgHit = document.createElement('button');
        sgHit.type = 'button';
        sgHit.className = 'index-map-sg-hit';
        sgHit.setAttribute('aria-label', 'Singapore — live prices');
        new maplibregl.Marker({ element: sgHit, anchor: 'center' })
          .setLngLat([103.82, 1.35])
          .addTo(map);

        sgHit.addEventListener('mousemove', (ev) => showTip(ev.clientX, ev.clientY, 702));
        sgHit.addEventListener('mouseleave', hideTip);
        sgHit.addEventListener('click', () => {
          window.location.href = LIVE[702].url;
        });
        sgHit.addEventListener(
          'touchstart',
          (ev) => {
            ev.stopPropagation();
            const t = ev.touches[0];
            showTip(t.clientX, t.clientY, 702);
          },
          { passive: true },
        );
        sgHit.addEventListener('touchend', (ev) => {
          ev.preventDefault();
          window.location.href = LIVE[702].url;
        });

        const wrap = document.getElementById('map-wrap');
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
      })
      .catch((err) => {
        console.error('Index map failed to load', err);
        container.classList.remove('index-hero-map--loading');
      });
  }

  function scheduleBoot() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => bootMap(), { timeout: 1400 });
        } else {
          setTimeout(bootMap, 120);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleBoot);
  } else {
    scheduleBoot();
  }
})();
