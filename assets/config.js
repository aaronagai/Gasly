/* Shared constants — loaded by index.html, terminal.html, app.html */

const SHEET_ID   = '1kvbA3aTL_4VvjSjsx7n0kcOLbjrXvDRnru8NEF1pDCE';
const MY_API_URL = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&sort=-date&limit=30';
const SG_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Singapore`;
const BN_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Brunei`;
const ID_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Indonesia`;

const SEA = new Set([96, 104, 116, 360, 418, 458, 608, 626, 702, 704, 764]);

const USD_RATES = { MYR: 0.22, SGD: 0.74, BND: 0.74, IDR: 0.000061 };

const CHART_COLORS = ['#ff6a00', '#2563eb', '#16a34a', '#a855f7', '#ef4444', '#0ea5e9'];

const ID_FUELS = [
  { key: 'pertalite',      label: 'Pertalite' },
  { key: 'pertamax',       label: 'Pertamax' },
  { key: 'pertamax_turbo', label: 'Pertamax Turbo' },
  { key: 'dexlite',        label: 'Dexlite' },
  { key: 'pertamina_dex',  label: 'Pertamina Dex' },
];
