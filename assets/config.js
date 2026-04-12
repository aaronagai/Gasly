/* Shared constants — loaded by index.html, terminal.html, app.html */

/**
 * Apple MapKit JS JWT (see https://developer.apple.com/documentation/mapkitjs/creating-a-maps-token).
 * Tokens expire (often ~30 minutes). For production, mint JWTs on your server and/or set
 * window.__MAPKIT_JWT at runtime. Leave empty to use OpenFreeMap (MapLibre) in terminal.html.
 */
const MAPKIT_JWT = '';

function getMapKitJwt() {
  try {
    if (typeof window !== 'undefined' && window.__MAPKIT_JWT) {
      const w = String(window.__MAPKIT_JWT).trim();
      if (w) return w;
    }
  } catch (_) {}
  return typeof MAPKIT_JWT === 'string' ? MAPKIT_JWT.trim() : '';
}

/** OpenFreeMap style for MapLibre GL (https://openfreemap.org/). Light: Positron. */
const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * Dark / night basemap when `prefers-color-scheme: dark` (terminal, app, index maps).
 * Fork of OpenFreeMap `dark` with dark water and lighter land (see assets/openfreemap-dark-landwater.json).
 */
const OPENFREEMAP_STYLE_URL_DARK = 'assets/openfreemap-dark-landwater.json';

function getOpenFreeMapStyleUrl() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      const d = typeof OPENFREEMAP_STYLE_URL_DARK === 'string' ? OPENFREEMAP_STYLE_URL_DARK.trim() : '';
      if (d) return d;
    }
  } catch (_) {}
  return typeof OPENFREEMAP_STYLE_URL === 'string' ? OPENFREEMAP_STYLE_URL : 'https://tiles.openfreemap.org/styles/positron';
}

const SHEET_ID   = '1kvbA3aTL_4VvjSjsx7n0kcOLbjrXvDRnru8NEF1pDCE';
const MY_API_URL = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&sort=-date&limit=120';

/** Petrol price history charts: rows from this many days before the latest observation (~3 months). */
const CHART_HISTORY_LOOKBACK_DAYS = 90;
const SG_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Singapore`;
const BN_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Brunei`;
const TH_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Thailand`;
const PH_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Philippines`;
const KH_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Cambodia`;
const LA_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Laos`;
const MM_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Myanmar`;
const ID_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Indonesia`;

/**
 * Country overview copy + metrics (same workbook). Tab name must match `sheet=`.
 * Create a tab named **Overviews** with row 1 = headers (no preamble rows), then one data row per `country_id`.
 *
 * Required / optional columns (snake_case; spaces in Sheet headers become underscores in CSV keys):
 * - `country_id` — ISO numeric (458, 96, 360, …)
 * - `oil_context` — paragraph for the overview card
 * - `row1_left_k`, `row1_left_v`, `row1_right_k`, `row1_right_v` … through **row4_*** — metric grid (leave both k+v empty to omit a cell)
 */
const OVERVIEW_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Overviews`;

/**
 * If set to a non-negative integer, use that CSV line as the header row.
 * Otherwise the parser auto-detects the header (handles preamble rows).
 */
const SHEET_CSV_HEADER_ROW_INDEX = null;

/** ISO numeric IDs of Southeast Asian countries shown on the map. */
const SEA = new Set([96, 104, 116, 360, 418, 458, 608, 626, 702, 704, 764]);

/** Live countries — sheet- or API-backed price feeds. */
const COUNTRIES = {
  458: { name: 'Malaysia' },
  702: { name: 'Singapore' },
  96:  { name: 'Brunei' },
  360: { name: 'Indonesia' },
  764: { name: 'Thailand' },
  608: { name: 'Philippines' },
  116: { name: 'Cambodia' },
  418: { name: 'Laos' },
  104: { name: 'Myanmar' },
};

/** USD conversion rates (multiply local price to get USD). */
const USD_RATES = {
  MYR: 0.22,
  SGD: 0.74,
  BND: 0.74,
  IDR: 0.000061,
  THB: 0.029,
  PHP: 0.018,
  KHR: 0.00025,
  LAK: 0.000048,
  MMK: 0.00048,
};

const CHART_COLORS = ['#ff6a00', '#2563eb', '#16a34a', '#a855f7', '#ef4444', '#0ea5e9'];

const ID_FUELS = [
  { key: 'pertalite',      label: 'Pertalite' },
  { key: 'pertamax',       label: 'Pertamax' },
  { key: 'pertamax_turbo', label: 'Pertamax Turbo' },
  { key: 'dexlite',        label: 'Dexlite' },
  { key: 'pertamina_dex',  label: 'Pertamina Dex' },
];

/** Thailand retail fuels — keys match the `Thailand` sheet tab columns. */
const TH_FUELS = [
  { key: 'gasohol_91', label: 'Gasohol 91' },
  { key: 'gasohol_95', label: 'Gasohol 95' },
  { key: 'e20', label: 'E20' },
  { key: 'e85', label: 'E85' },
  { key: 'diesel', label: 'Diesel' },
];

/** Philippines retail fuels — keys match the `Philippines` sheet tab columns. */
const PH_FUELS = [
  { key: 'ron91', label: 'RON 91' },
  { key: 'ron95', label: 'RON 95' },
  { key: 'diesel', label: 'Diesel' },
  { key: 'kerosene', label: 'Kerosene' },
];

/** Cambodia — national sheet (`date`, `ron92`, `diesel`). Prices in KHR/L. */
const KH_FUELS = [
  { key: 'ron92', label: 'RON 92' },
  { key: 'diesel', label: 'Diesel' },
];

/** Myanmar — national sheet (`date`, `ron92`, `ron95`, `diesel`). Prices in MMK/L. */
const MM_FUELS = [
  { key: 'ron92', label: 'RON 92' },
  { key: 'ron95', label: 'RON 95' },
  { key: 'diesel', label: 'Diesel' },
];

/** Laos — per `province` (`date`, `province`, `gasoline`, `gasoline_95`, `diesel`). Prices in LAK/L. */
const LA_FUELS = [
  { key: 'gasoline', label: 'Gasoline' },
  { key: 'gasoline_95', label: 'Gasoline 95' },
  { key: 'diesel', label: 'Diesel' },
];

/** Malaysia pricing regions. */
const MY_REGIONS = [
  { key: 'Semenanjung', label: 'Semenanjung' },
  { key: 'SabahSarawak', label: 'East Malaysia' },
];

/**
 * Fallback when the `Overviews` sheet is missing, empty, or fetch fails.
 * Live copy is merged from the sheet via `getCountryOverview` in utils.js.
 */
const COUNTRY_OVERVIEW_FALLBACK = {
  458: {
    oilContext:
      'Mid-sized upstream producer with an economy shaped by oil & gas; exports some crude and petroleum products, while still importing certain grades/volumes to meet refinery and fuel demand.',
    metricRows: [
      [['BOPD', '570,000'],          ['1P Reserves', '2.7B Barrels']],
      [['Refinery Intake', '747,000'], null],
      [['Export Value', 'RM6.2bil'],  ['Import Value', 'RM13.6bil']],
      [['Status', 'Net Importer'],    null],
    ],
  },
  96: {
    oilContext:
      'Small, wealthy upstream producer with an economy almost entirely dependent on oil & gas; exports the vast majority of its crude and refined products, with domestic consumption representing only a tiny fraction of production.',
    metricRows: [
      [['BOPD', '102,677'],               ['1P Reserves', '1.1B Barrels']],
      [['Refinery Intake', '16,338'],       null],
      [['Export Value', 'BND 13.45bil'],   ['Import Value', 'BND 8.62bil']],
      [['Status', 'Net Exporter'],          null],
    ],
  },
  360: {
    oilContext:
      "Southeast Asia's largest economy and a former OPEC member; production has declined significantly from its peak, forcing the country to rely heavily on imported refined products despite still being a notable crude oil producer.",
    metricRows: [
      [['BOPD', '608,100'],             ['1P Reserves', '2.41B Barrels']],
      [['Refinery Capacity', '~1.22M bpd'], null],
      [['Export Value', 'US$13.07bil'], ['Import Value', 'US$32.77bil']],
      [['Status', 'Net Importer'],       null],
    ],
  },
  702: {
    oilContext:
      'Global refining and trading hub with no domestic oil production; imports massive volumes of crude for refining into high-value petroleum products, most of which are re-exported.',
    metricRows: [
      [['BOPD', '-'],                          ['1P Reserves', '- barrels']],
      [['Refinery Intake', '~1,100,000 bpd'],  null],
      [['Export Value', '~US$465B/year'],     ['Import Value', '~US$515B/year']],
      [['Status', 'Net Importer (refining hub)'], null],
    ],
  },
  764: {
    oilContext:
      "Southeast Asia's second-largest oil consumer with very limited domestic reserves; heavily reliant on imports to meet its massive refining and industrial demand despite being a modest producer.",
    metricRows: [
      [['BOPD', '417,959'],            ['1P Reserves', '0.24B Barrels']],
      [['Refinery Intake', '1,372,480'], null],
      [['Export Value', 'Unavailable'], ['Import Value', 'Unavailable']],
      [['Status', 'Net Importer'],     null],
    ],
  },
  608: {
    oilContext:
      'Very small upstream producer with limited reserves; almost entirely dependent on imported oil to fuel its growing economy, with domestic production covering only a tiny fraction of demand.',
    metricRows: [
      [['BOPD', '14,345'],              ['1P Reserves', '0.14B Barrels']],
      [['Refinery Intake', '473,464'],  null],
      [['Export Value', 'Not specified in available data'], ['Import Value', 'Not specified in available data']],
      [['Status', 'Net Importer'],      null],
    ],
  },
  116: {
    oilContext:
      'Modest domestic production with no significant refining depth; transport and power demand are met overwhelmingly by imported fuels as the economy and vehicle fleet grow.',
    metricRows: [
      [['BOPD', '—'], ['1P Reserves', '—']],
      [['Refinery Intake', '—'], null],
      [['Export Value', '—'], ['Import Value', '—']],
      [['Status', 'Net Importer'], null],
    ],
  },
  418: {
    oilContext:
      'Landlocked with no coastal refining; entirely dependent on imported refined products via neighbours and river corridors, with demand rising from transport and hydropower-related logistics.',
    metricRows: [
      [['BOPD', '—'], ['1P Reserves', '—']],
      [['Refinery Intake', '—'], null],
      [['Export Value', '—'], ['Import Value', '—']],
      [['Status', 'Net Importer'], null],
    ],
  },
  104: {
    oilContext:
      'Long-standing producer with uneven sanctions-era trade; domestic crude is modest relative to demand, so transport and industry still lean heavily on fuel imports and informal cross-border flows.',
    metricRows: [
      [['BOPD', '—'], ['1P Reserves', '—']],
      [['Refinery Intake', '—'], null],
      [['Export Value', '—'], ['Import Value', '—']],
      [['Status', 'Net Importer'], null],
    ],
  },
};

/**
 * [lon, lat] centroids for Indonesia cities (matched to `city` column in the Google Sheet).
 * Shared by app.html and terminal.html.
 */
const ID_CITY_LONLAT = {
  'Jakarta Pusat':    [106.8456, -6.2088],
  'Jakarta Selatan':  [106.81,   -6.26],
  'Jakarta Barat':    [106.74,   -6.15],
  'Jakarta Timur':    [106.9,    -6.22],
  'Jakarta Utara':    [106.88,   -6.13],
  Bekasi:             [106.99,   -6.24],
  Bogor:              [106.8,    -6.6],
  Depok:              [106.82,   -6.4],
  Tangerang:          [106.63,   -6.18],
  'Tangerang Selatan':[106.71,   -6.29],
  Bandung:            [107.62,   -6.92],
  Semarang:           [110.42,   -6.99],
  Surabaya:           [112.75,   -7.26],
  Surakarta:          [110.82,   -7.57],
  Yogyakarta:         [110.36,   -7.8],
  Medan:              [98.67,     3.59],
  Palembang:          [104.75,   -2.98],
  Pekanbaru:          [101.45,    0.51],
  Denpasar:           [115.22,   -8.65],
  Makassar:           [119.43,   -5.15],
};

/**
 * [lon, lat] centroids for Lao provinces (matched to `province` in the Google Sheet).
 * Shared by app.html and terminal.html.
 */
const LA_PROVINCE_LONLAT = {
  Attapeu: [107.2, 14.8],
  Bokeo: [100.6, 20.27],
  Bolikhamxai: [104.8, 18.4],
  Champasak: [105.87, 14.88],
  Houaphan: [104.04, 20.42],
  Khammouan: [104.9, 17.4],
  Louangnamtha: [101.4, 20.95],
  Luangprabang: [102.14, 19.88],
  Oudomxai: [101.9, 20.69],
  Phongsaly: [102.1, 21.68],
  Salavan: [106.42, 15.72],
  Savannakhet: [104.77, 16.56],
  'Vientiane Capital': [102.63, 17.96],
  Vientiane: [102.42, 18.25],
  Xaisomboun: [103.1, 18.9],
  Xayyabouly: [101.75, 19.25],
  Xekong: [106.72, 15.32],
  Xiengkhouang: [103.36, 19.58],
};
