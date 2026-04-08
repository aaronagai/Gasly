/* Shared utility functions — loaded by index.html, terminal.html, app.html */

function parseCSV(text) {
  const rows = text.trim().split('\n').map(r =>
    r.split(',').map(c => c.replace(/^"|"$/g, '').trim())
  );
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });
}

/** Parse a date cell to UTC milliseconds. Handles ISO YYYY-MM-DD, D/M/Y, and Date.parse fallback. */
function parseRowDateMs(v) {
  if (v == null || v === '') return NaN;
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s|$)/);
  if (dmy) {
    const d = +dmy[1]; const m = +dmy[2]; const y = +dmy[3];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return Date.UTC(y, m - 1, d);
  }
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function sortRowsByDate(rows) {
  return (rows || []).slice().filter(r => r?.date).sort((a, b) => {
    const ta = parseRowDateMs(a.date);
    const tb = parseRowDateMs(b.date);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    if (Number.isFinite(ta)) return -1;
    if (Number.isFinite(tb)) return 1;
    return String(a.date).localeCompare(String(b.date));
  });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtPerL(sym, n, decimals = 2) {
  const x = parseFloat(n);
  if (!Number.isFinite(x)) return '—';
  return `${sym} ${x.toFixed(decimals)}/L`;
}
