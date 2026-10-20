/*
 * Minimal SVG charts (no external library).
 *  lineChart : value per expansion step (e.g. h(n) of the node being expanded)
 *  barChart  : one bar per algorithm on the comparison page (optional log scale)
 */
(function (root) {
  'use strict';
  const EP = root.EP;
  const ui = (EP.ui = EP.ui || {});
  const esc = (s) => ui.esc(s);

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /**
   * values: number[] (null entries are skipped), upto: index of the current point
   */
  function lineChart(el, values, { upto = values.length - 1, yLabel = '', xLabel = 'Expansion step' } = {}) {
    const W = 640;
    const H = 200;
    const m = { l: 40, r: 12, t: 12, b: 30 };
    const pts = [];
    const n = Math.min(values.length, upto + 1);
    const total = Math.max(values.length - 1, 1);
    let maxV = 0;
    for (let i = 0; i < values.length; i++) if (values[i] != null && values[i] > maxV) maxV = values[i];
    const yMax = niceMax(maxV);
    const step = Math.max(1, Math.floor(n / 600)); // downsample long runs
    for (let i = 0; i < n; i += step) if (values[i] != null) pts.push([i, values[i]]);
    if (n > 0 && values[n - 1] != null && (pts.length === 0 || pts[pts.length - 1][0] !== n - 1)) pts.push([n - 1, values[n - 1]]);

    const x = (i) => m.l + (i / total) * (W - m.l - m.r);
    const y = (v) => H - m.b - (v / yMax) * (H - m.t - m.b);

    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = (yMax / 4) * k;
      grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(1)}</text>`;
    }
    const line = pts.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = pts.length ? `${x(pts[0][0])},${y(0)} ${line} ${x(pts[pts.length - 1][0])},${y(0)}` : '';
    const last = pts[pts.length - 1];
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)} per ${esc(xLabel)}">
      <g class="grid">${grid}</g>
      <text x="${W - m.r}" y="${H - 8}" text-anchor="end">${esc(xLabel)} (0–${total})</text>
      <text x="${m.l}" y="${H - 8}">${esc(yLabel)}</text>
      ${pts.length > 1 ? `<polygon class="area" points="${area}"/><polyline class="line" points="${line}"/>` : ''}
      ${last ? `<circle class="dot" cx="${x(last[0])}" cy="${y(last[1])}" r="5"/>` : ''}
    </svg>`;
  }

  /**
   * rows: [{ label, value, highlight, display }]
   */
  function barChart(el, rows, { log = false, unit = '' } = {}) {
    const W = 640;
    const rowH = 34;
    const m = { l: 140, r: 100, t: 6, b: 6 };
    const H = m.t + m.b + rows.length * rowH;
    const tf = (v) => (log ? Math.log10(Math.max(v, 0) + 1) : Math.max(v, 0));
    const maxV = Math.max(...rows.map((r) => tf(r.value || 0)), 1e-9);
    const bw = W - m.l - m.r;
    const bars = rows
      .map((r, i) => {
        const yy = m.t + i * rowH;
        const w = r.value == null ? 0 : Math.max(2, (tf(r.value) / maxV) * bw);
        const shown = r.display != null ? r.display : r.value == null ? '—' : `${r.value}${unit}`;
        return `<text x="${m.l - 8}" y="${yy + rowH / 2 + 4}" text-anchor="end">${esc(r.label)}</text>
          <rect class="bar${r.highlight ? ' assigned' : ''}" x="${m.l}" y="${yy + 5}" width="${w}" height="${rowH - 10}" rx="4"/>
          <text class="bar-value" x="${m.l + w + 6}" y="${yy + rowH / 2 + 4}">${esc(shown)}</text>`;
      })
      .join('');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img">${bars}</svg>`;
  }

  ui.lineChart = lineChart;
  ui.barChart = barChart;
})(typeof window !== 'undefined' ? window : globalThis);
