// Small SVG charts, drawn from the <table> inside each <figure class="chart">.
// The table is the source of truth: without JavaScript it is simply shown,
// with JavaScript it moves into a "View data as table" panel under the chart.
//
// <figure class="chart" data-chart="dumbbell|bars|columns" ...options>
//   <figcaption>...</figcaption>
//   <div class="table-wrap"><table>...</table></div>
// </figure>
//
// Sizes are written for a 16px root font and multiplied by K, so charts scale
// with the rest of the page on large screens.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const figures = [...document.querySelectorAll('figure.chart[data-chart]')];
  if (!figures.length) return;

  let K = 1;
  const rootScale = () => (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
  const u = (n) => n * K;

  // ---- helpers ------------------------------------------------------------------
  const svg = (name, attrs = {}, parent) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  };
  const text = (parent, x, y, content, cls = 'viz-text', attrs = {}) => {
    const t = svg('text', { x, y, class: cls, ...attrs }, parent);
    t.textContent = content;
    return t;
  };
  const html = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = content;
    return node;
  };
  const parseNum = (s) => parseFloat(String(s).replace(/−/g, '-').replace(/[^0-9.+-]/g, ''));
  const token = (name) => `var(--${name.trim()})`;
  const titleOf = (fig) => fig.querySelector('.chart-title')?.textContent || '';

  const canvas = document.createElement('canvas').getContext('2d');
  // body text in charts is 13px (0.8125rem), mono ticks 12px (0.75rem), both times K
  const measure = (s, size = 13, family = '"IBM Plex Sans", system-ui, sans-serif') => {
    canvas.font = `400 ${size * K}px ${family}`;
    return canvas.measureText(s).width;
  };

  const fmt = (v, o, { signed = false, decimals } = {}) => {
    const dec = decimals ?? (o.decimals != null ? +o.decimals : 0);
    const body = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const sign = v < 0 && +body.replace(/,/g, '') !== 0 ? '−' : (signed && v > 0 ? '+' : '');
    return `${sign}${o.prefix || ''}${body}${o.unit || ''}`;
  };

  const niceTicks = (min, max, count = 5) => {
    const span = max - min || 1;
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const err = raw / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  };

  // rounded on the data end only, square on the baseline
  const hBarPath = (x0, x1, y, h, r = u(4)) => {
    const len = Math.abs(x1 - x0);
    r = Math.min(r, len, h / 2);
    if (len < 0.5) return '';
    if (x1 >= x0) {
      return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
    }
    return `M${x0},${y}H${x1 + r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 + r},${y + h}H${x0}Z`;
  };
  const vBarPath = (x, w, yBase, yTop, r = u(4)) => {
    const len = yBase - yTop;
    r = Math.min(r, len, w / 2);
    if (len < 0.5) return '';
    return `M${x},${yBase}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBase}Z`;
  };

  // ---- tooltip ------------------------------------------------------------------
  const tip = html('div', 'viz-tip');
  tip.hidden = true;
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);

  const fillTip = ({ title, rows, foot }) => {
    tip.replaceChildren();
    tip.appendChild(html('div', 'viz-tip-title', title));
    rows.forEach((r) => {
      const row = html('div', 'viz-tip-row');
      const key = html('span', 'viz-tip-key');
      key.style.background = r.color;
      row.append(key, html('span', 'viz-tip-val', r.value), html('span', 'viz-tip-name', r.name));
      tip.appendChild(row);
    });
    if (foot) tip.appendChild(html('div', 'viz-tip-foot', foot));
  };
  const placeTip = (x, y) => {
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14;
    let top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  };
  const hideTip = () => { tip.hidden = true; };
  const bindTip = (node, content) => {
    const atPointer = (e) => { fillTip(content); placeTip(e.clientX, e.clientY); };
    node.addEventListener('pointermove', atPointer);
    node.addEventListener('pointerdown', atPointer);
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('focus', () => {
      fillTip(content);
      const r = node.getBoundingClientRect();
      placeTip(r.left + r.width * 0.6, r.top + r.height / 2);
    });
    node.addEventListener('blur', hideTip);
  };
  window.addEventListener('scroll', hideTip, { passive: true });

  // ---- data -----------------------------------------------------------------------
  const readTable = (table) => {
    const series = [...table.tHead.rows[0].cells].slice(1).map((c) => c.textContent.trim());
    const rows = [...table.tBodies[0].rows].map((tr) => {
      const cells = [...tr.cells];
      return {
        label: cells[0].textContent.trim(),
        short: cells[0].dataset.short || cells[0].textContent.trim(),
        values: cells.slice(1).map((c) => parseNum(c.dataset.value ?? c.textContent)),
        text: cells.slice(1).map((c) => c.textContent.trim()),
      };
    });
    return { series, rows };
  };

  const legend = (items, shape = 'dot') => {
    const ul = html('ul', 'legend');
    items.forEach(({ name, color }) => {
      const li = html('li');
      const sw = html('span', shape === 'bar' ? 'swatch swatch--bar' : 'swatch');
      sw.style.background = color;
      li.append(sw, document.createTextNode(name));
      ul.appendChild(li);
    });
    return ul;
  };

  const ariaRow = (label, series, texts) =>
    `${label}: ${series.map((s, i) => `${s} ${texts[i]}`).join(', ')}`;

  // ---- dumbbell: two values per row (before → after, or metric A vs metric B) ----------
  const dumbbell = (fig, plot, data, W) => {
    const o = fig.dataset;
    const [cA, cB] = (o.colors || 'series-muted,series-1').split(',').map(token);
    const labelBoth = o.label !== 'b';
    const narrow = W < u(520);
    const labelW = narrow ? 0 : Math.min(Math.max(...data.rows.map((r) => measure(r.label))) + u(20), W * 0.34);
    const padL = narrow ? u(6) : labelW;
    const padR = u(56);
    const rowH = narrow ? u(54) : u(o.rowH ? +o.rowH : 42);
    const top = o.ref ? u(32) : u(6);
    const axisH = u(28);
    const n = data.rows.length;
    const H = top + rowH * n + axisH;
    const min = +o.min;
    const max = +o.max;
    const x = (v) => padL + ((v - min) / (max - min)) * (W - padL - padR);

    plot.appendChild(legend([{ name: data.series[0], color: cA }, { name: data.series[1], color: cB }]));
    const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': titleOf(fig) }, plot);

    const ticks = o.ticks ? o.ticks.split(',').map(Number) : niceTicks(min, max, narrow ? 4 : 6);
    const tickO = { ...o, decimals: o.tickDecimals ?? o.decimals };
    ticks.forEach((t) => {
      svg('line', { x1: x(t), x2: x(t), y1: top, y2: top + rowH * n, class: 'viz-grid' }, s);
      text(s, x(t), H - u(6), fmt(t, tickO), 'viz-text viz-text--muted viz-mono', { 'text-anchor': 'middle' });
    });

    if (o.ref) {
      const rx = x(+o.ref);
      svg('line', { x1: rx, x2: rx, y1: top - u(8), y2: top + rowH * n, class: 'viz-ref' }, s);
      const label = o.refLabel || fmt(+o.ref, o);
      const w = measure(label, 12);
      const anchorEnd = rx + w > W - 4;
      text(s, anchorEnd ? rx - u(5) : rx + u(5), top - u(14), label, 'viz-text viz-text--muted', { 'text-anchor': anchorEnd ? 'end' : 'start' });
    }

    data.rows.forEach((r, i) => {
      const [a, b] = r.values;
      const g = svg('g', { class: 'viz-row' }, s);
      const y0 = top + i * rowH;
      const yMid = narrow ? y0 + u(36) : y0 + rowH / 2;
      svg('rect', { x: 0, y: y0 + 2, width: W, height: rowH - 4, rx: u(6), class: 'viz-hl' }, g);

      if (narrow) text(g, padL, y0 + u(16), r.label, 'viz-text viz-text--strong');
      else text(g, padL - u(14), yMid, r.label, 'viz-text', { 'text-anchor': 'end', 'dominant-baseline': 'middle' });

      svg('line', { x1: x(a), x2: x(b), y1: yMid, y2: yMid, stroke: 'var(--line-strong)', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      svg('circle', { cx: x(a), cy: yMid, r: u(5), fill: cA, stroke: 'var(--surface)', 'stroke-width': 2 }, g);
      svg('circle', { cx: x(b), cy: yMid, r: u(6.5), fill: cB, stroke: 'var(--surface)', 'stroke-width': 2 }, g);

      const up = b >= a;
      text(g, x(b) + (up ? u(12) : -u(12)), yMid, r.text[1], 'viz-text viz-text--strong', { 'text-anchor': up ? 'start' : 'end', 'dominant-baseline': 'middle' });
      if (labelBoth) {
        const lx = x(a) + (up ? -u(11) : u(11));
        const w = measure(r.text[0]);
        const fits = up ? lx - w > padL + 2 : lx + w < W - 2;
        if (fits) text(g, lx, yMid, r.text[0], 'viz-text viz-text--muted', { 'text-anchor': up ? 'end' : 'start', 'dominant-baseline': 'middle' });
      }

      const hit = svg('rect', { x: 0, y: y0, width: W, height: rowH, class: 'viz-hit', tabindex: 0, role: 'img', 'aria-label': ariaRow(r.label, data.series, r.text) }, g);
      bindTip(hit, {
        title: r.label,
        rows: [
          { name: data.series[0], value: r.text[0], color: cA },
          { name: data.series[1], value: r.text[1], color: cB },
        ],
        foot: o.deltaUnit != null ? `Difference ${fmt(b - a, { decimals: o.deltaDecimals ?? o.decimals, unit: o.deltaUnit }, { signed: true })}` : null,
      });
    });
  };

  // ---- bars: horizontal, one value per row; supports negatives and emphasis ---------------
  const bars = (fig, plot, data, W) => {
    const o = fig.dataset;
    const rowColors = o.colors ? o.colors.split(',').map(token) : null;
    const highlight = o.highlight ? o.highlight.split('|') : null;
    const narrow = W < u(520) || o.labels === 'above';
    const values = data.rows.map((r) => r.values[0]);
    const fixedTicks = o.ticks ? o.ticks.split(',').map(Number) : null;
    const min = o.min != null ? +o.min : Math.min(0, ...values, ...(fixedTicks || []));
    const max = o.max != null ? +o.max : Math.max(0, ...values, ...(fixedTicks || []));
    const labelW = narrow ? 0 : Math.min(Math.max(...data.rows.map((r) => measure(r.label))) + u(20), W * 0.36);
    const negRoom = min < 0 ? u(56) : 0;
    const padL = (narrow ? u(4) : labelW) + negRoom;
    const padR = u(64);
    const rowH = narrow ? u(54) : u(38);
    const barH = Math.min(u(20), narrow ? u(18) : rowH - u(14));
    const showAxis = o.axis !== 'none';
    const axisH = showAxis ? u(26) : u(4);
    const n = data.rows.length;
    const H = rowH * n + axisH;
    const x = (v) => padL + ((v - min) / (max - min || 1)) * (W - padL - padR);

    const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': titleOf(fig) }, plot);

    if (showAxis) {
      const ticks = fixedTicks || niceTicks(min, max, narrow ? 3 : 5);
      const tickO = { ...o, decimals: o.tickDecimals ?? 0 };
      ticks.forEach((t) => {
        svg('line', { x1: x(t), x2: x(t), y1: 0, y2: rowH * n, class: 'viz-grid' }, s);
        text(s, x(t), H - u(6), fmt(t, tickO, { signed: o.signed != null && t !== 0 }), 'viz-text viz-text--muted viz-mono', { 'text-anchor': 'middle' });
      });
    }
    svg('line', { x1: x(0), x2: x(0), y1: 0, y2: rowH * n, class: 'viz-axis' }, s);

    data.rows.forEach((r, i) => {
      const v = r.values[0];
      const g = svg('g', { class: 'viz-row' }, s);
      const y0 = i * rowH;
      const yBar = narrow ? y0 + u(26) : y0 + (rowH - barH) / 2;
      let color = rowColors ? rowColors[i % rowColors.length] : token('series-1');
      if (o.diverging != null) color = v < 0 ? token('series-neg') : token('series-1');
      if (highlight) color = highlight.includes(r.label) ? token('series-1') : token('series-muted');

      svg('rect', { x: 0, y: y0 + 2, width: W, height: rowH - 4, rx: u(6), class: 'viz-hl' }, g);
      if (narrow) text(g, u(4), y0 + u(16), r.label, 'viz-text viz-text--strong');
      else text(g, padL - negRoom - u(14), yBar + barH / 2, r.label, 'viz-text', { 'text-anchor': 'end', 'dominant-baseline': 'middle' });

      const d = hBarPath(x(0), x(v), yBar, barH);
      if (d) svg('path', { d, fill: color }, g);

      const label = o.signed != null ? fmt(v, o, { signed: true }) : r.text[0];
      const right = v >= 0;
      text(g, x(v) + (right ? u(8) : -u(8)), yBar + barH / 2, label, 'viz-text viz-text--strong', { 'text-anchor': right ? 'start' : 'end', 'dominant-baseline': 'middle' });

      const hit = svg('rect', { x: 0, y: y0, width: W, height: rowH, class: 'viz-hit', tabindex: 0, role: 'img', 'aria-label': `${r.label}: ${r.text[0]}` }, g);
      bindTip(hit, { title: titleOf(fig), rows: [{ name: r.label, value: r.text[0], color }] });
    });
  };

  // ---- columns: vertical, one value per category, emphasis + an annotation row -----------
  const columns = (fig, plot, data, W) => {
    const o = fig.dataset;
    const highlight = o.highlight ? o.highlight.split('|') : [];
    const annotate = o.annotate != null ? +o.annotate : null;
    const values = data.rows.map((r) => r.values[0]);
    const ticks = o.ticks ? o.ticks.split(',').map(Number) : niceTicks(0, Math.max(...values), 4);
    const yMax = Math.max(ticks[ticks.length - 1], ...values);
    const yTickLabel = (t) => fmt(t, { ...o, decimals: 0 });
    const padL = Math.max(...ticks.map((t) => measure(yTickLabel(t), 12, '"IBM Plex Mono", monospace'))) + u(14);
    const padR = u(8);
    const top = u(26);
    const plotH = u(200);
    const xLabH = u(28);
    const annH = annotate != null ? u(26) : 0;
    const H = top + plotH + xLabH + annH;
    const n = data.rows.length;
    const band = (W - padL - padR) / n;
    const colW = Math.min(u(26), band * 0.5);
    const y = (v) => top + plotH - (v / yMax) * plotH;
    const maxIdx = values.indexOf(Math.max(...values));

    const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': titleOf(fig) }, plot);

    ticks.forEach((t) => {
      svg('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: t === 0 ? 'viz-axis' : 'viz-grid' }, s);
      text(s, padL - u(8), y(t), yTickLabel(t), 'viz-text viz-text--muted viz-mono', { 'text-anchor': 'end', 'dominant-baseline': 'middle' });
    });

    if (annotate != null) {
      text(s, padL - u(8), top + plotH + xLabH + u(15), data.series[annotate], 'viz-text viz-text--muted viz-mono', { 'text-anchor': 'end' });
    }

    data.rows.forEach((r, i) => {
      const v = r.values[0];
      const cx = padL + band * i + band / 2;
      const on = highlight.includes(r.label);
      const color = highlight.length ? (on ? token('series-1') : token('series-muted')) : token('series-1');
      const g = svg('g', { class: 'viz-row' }, s);
      svg('rect', { x: cx - band / 2 + 2, y: top - u(22), width: band - 4, height: plotH + u(22) + xLabH + annH, rx: u(6), class: 'viz-hl' }, g);

      const d = vBarPath(cx - colW / 2, colW, y(0), y(v));
      if (d) svg('path', { d, fill: color }, g);

      if (on || i === maxIdx) text(g, cx, y(v) - u(9), r.text[0], 'viz-text viz-text--strong', { 'text-anchor': 'middle' });
      text(g, cx, top + plotH + u(18), r.short, on ? 'viz-text viz-text--strong' : 'viz-text', { 'text-anchor': 'middle' });
      if (annotate != null) {
        text(g, cx, top + plotH + xLabH + u(15), r.text[annotate], 'viz-text viz-text--muted viz-mono', { 'text-anchor': 'middle' });
      }

      const hit = svg('rect', { x: cx - band / 2, y: 0, width: band, height: H, class: 'viz-hit', tabindex: 0, role: 'img', 'aria-label': ariaRow(r.label, data.series, r.text) }, g);
      bindTip(hit, {
        title: r.label,
        rows: data.series.map((name, k) => ({ name, value: r.text[k], color: k === 0 ? color : 'var(--ink-3)' })),
        foot: on && o.highlightNote ? o.highlightNote : null,
      });
    });
  };

  const renderers = { dumbbell, bars, columns };

  // ---- mount ------------------------------------------------------------------------
  const charts = figures.map((fig) => {
    const table = fig.querySelector('table');
    const wrap = table.closest('.table-wrap') || table;
    const plot = html('div', 'chart-plot');
    wrap.before(plot);

    const details = html('details', 'chart-data');
    details.appendChild(html('summary', null, 'View data as table'));
    wrap.before(details);
    details.appendChild(wrap);

    return { fig, plot, data: readTable(table), width: 0, k: 0 };
  });

  const draw = (c) => {
    K = rootScale();
    const W = Math.floor(c.plot.clientWidth);
    if (!W || (W === c.width && K === c.k)) return;
    c.width = W;
    c.k = K;
    c.plot.replaceChildren();
    const render = renderers[c.fig.dataset.chart];
    if (render) render(c.fig, c.plot, c.data, W);
  };
  const drawAll = () => charts.forEach((c) => draw(c));

  drawAll();

  let frame;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(drawAll);
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(schedule);
    charts.forEach((c) => ro.observe(c.plot));
  }
  window.addEventListener('resize', schedule);

  // label widths depend on the web font, so redraw once it has loaded
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      charts.forEach((c) => { c.width = 0; });
      drawAll();
    });
  }
})();
