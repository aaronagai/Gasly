/* Shared constants — loaded by index.html, terminal.html, app.html */

const SHEET_ID   = '1kvbA3aTL_4VvjSjsx7n0kcOLbjrXvDRnru8NEF1pDCE';
const MY_API_URL = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&sort=-date&limit=30';
const SG_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Singapore`;
const BN_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Brunei`;
const ID_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Indonesia`;

/**
 * If set to a non-negative integer, use that CSV line as the header row.
 * Otherwise the parser auto-detects the header (handles preamble rows).
 */
const SHEET_CSV_HEADER_ROW_INDEX = null;

/** ISO numeric IDs of Southeast Asian countries shown on the map. */
const SEA = new Set([96, 104, 116, 360, 418, 458, 608, 626, 702, 704, 764]);

/** Live countries — the four with real price feeds. */
const COUNTRIES = {
  458: { name: 'Malaysia' },
  702: { name: 'Singapore' },
  96:  { name: 'Brunei' },
  360: { name: 'Indonesia' },
};

/** USD conversion rates (multiply local price to get USD). */
const USD_RATES = { MYR: 0.22, SGD: 0.74, BND: 0.74, IDR: 0.000061 };

const CHART_COLORS = ['#ff6a00', '#2563eb', '#16a34a', '#a855f7', '#ef4444', '#0ea5e9'];

const ID_FUELS = [
  { key: 'pertalite',      label: 'Pertalite' },
  { key: 'pertamax',       label: 'Pertamax' },
  { key: 'pertamax_turbo', label: 'Pertamax Turbo' },
  { key: 'dexlite',        label: 'Dexlite' },
  { key: 'pertamina_dex',  label: 'Pertamina Dex' },
];

/** Malaysia pricing regions. */
const MY_REGIONS = [
  { key: 'Semenanjung', label: 'Semenanjung' },
  { key: 'SabahSarawak', label: 'East Malaysia' },
];

/**
 * Oil industry context and key metrics per country.
 * Shared by app.html (overview card) and terminal.html (left panel).
 */
const COUNTRY_OVERVIEW = {
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
      [['Refinery Intake', '1,626,878'], null],
      [['Export Value', 'US$13.07bil'], ['Import Value', 'US$32.77bil']],
      [['Status', 'Net Importer'],       null],
    ],
  },
  702: {
    oilContext:
      'Global refining and trading hub with no domestic oil production; imports massive volumes of crude for refining into high-value petroleum products, most of which are re-exported.',
    metricRows: [
      [['BOPD', '0'],                                          ['1P Reserves', '0 Barrels']],
      [['Refinery Intake', '~1,100,000'],                       null],
      [['Export Value', 'Not specified in available data'],    ['Import Value', 'Not specified in available data']],
      [['Status', 'Net Importer (refining hub)'],               null],
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
