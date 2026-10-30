// Scene-building helpers shared by every chapter. All coordinates are in the 1000×720 stage viewBox.
(function () {
  'use strict';
  const { measure } = ENGINE;

  const C = {
    bg: '#121417', ink: '#f4f5f6', mute: '#9aa1a9', faint: '#5d646c', dim: '#353a41', node: '#262a30',
    hot: '#ff4a1c', cob: '#7d95ff', amb: '#ffc94a', ok: '#3ddc97',
  };

  // Base layout of the toy graph (A = 0..6 left, B = 9..14 right).
  const POS = [
    [115, 138], [191, 128], [252, 175], [68, 199], [165, 325], [83, 282], [256, 267], [143, 46],
    [310, 250], [360, 215], [405, 137], [495, 137], [540, 215], [495, 293], [405, 293], [593, 297],
  ];
  const VIEWS = {
    full: { s: 1.42, cx: 500, cy: 430 },
    hero: { s: 1.55, cx: 500, cy: 390 },
    left: { s: 1.05, cx: 300, cy: 450 },
    lefthi: { s: 1.0, cx: 300, cy: 340 },
    top: { s: 0.92, cx: 500, cy: 250 },
    small: { s: 0.62, cx: 200, cy: 210 },
    corner: { s: 0.62, cx: 200, cy: 590 },
  };
  const BASE_C = [330, 185];
  function P(i, v) {
    const V = typeof v === 'string' ? VIEWS[v] : v;
    return [(POS[i][0] - BASE_C[0]) * V.s + V.cx, (POS[i][1] - BASE_C[1]) * V.s + V.cy];
  }

  // graph({v, node:i=>style, edge:(a,b)=>style, labels, only:[nodes]})
  function graph(D, o = {}) {
    const v = o.v || 'full', out = [];
    const V = typeof v === 'string' ? VIEWS[v] : v;
    const r0 = o.r || 15 * Math.sqrt(V.s);
    const only = o.only ? new Set(o.only) : null;
    for (const [a, b] of D.EDGES) {
      if (only && !(only.has(a) && only.has(b))) continue;
      const st = Object.assign({ stroke: C.dim, sw: 1.6 }, o.edge ? o.edge(a, b) : {});
      if (st.hide) continue;
      const [x1, y1] = P(a, V), [x2, y2] = P(b, V);
      out.push(Object.assign({ id: `e:${a}-${b}`, t: 'line', x1, y1, x2, y2, z: 1, enter: 'draw' }, st));
    }
    for (let i = 0; i < D.N; i++) {
      if (only && !only.has(i)) continue;
      const st = Object.assign({ fill: C.node, stroke: C.bg, sw: 3, r: r0, lab: C.mute }, o.node ? o.node(i) : {});
      if (st.hide) continue;
      const [cx, cy] = st.at || P(i, V);
      out.push({ id: `n:${i}`, t: 'circle', cx, cy, r: st.r, fill: st.fill, stroke: st.stroke, sw: st.sw, o: st.o, z: 3, d: st.d, enter: 'grow' });
      if (o.labels !== false && !st.nolab)
        out.push({ id: `nl:${i}`, t: 'text', s: String(i), x: cx, y: cy + 4.6 * Math.min(1.25, st.r / 14), fs: Math.max(13, Math.min(16, st.r * .95)), a: 'middle', f: 'mono', wt: 600, fill: st.lab, o: st.o, z: 4, d: st.d });
    }
    return out;
  }

  const txt = (id, s, x, y, o = {}) => Object.assign({ id, t: 'text', s: String(s), x, y, fs: 20, f: 'sans', fill: C.ink, z: 6 }, o);

  // A horizontal run of text parts; ids on parts let them morph between scenes.
  function row(prefix, parts, x, y, o = {}) {
    const fs = o.fs || 22, f = o.f || 'math';
    const items = parts.map((p, i) => typeof p === 'string' ? { s: p } : p).map((p, i) => Object.assign({ id: `${prefix}#${i}` }, p));
    const ws = items.map(p => measure(p.s, p.f || f, p.fs || fs, p.wt, p.it));
    const W = ws.reduce((a, b) => a + b, 0);
    let cx = o.a === 'middle' ? x - W / 2 : o.a === 'end' ? x - W : x;
    const objs = [];
    items.forEach((p, i) => {
      if (p.s.trim() !== '' || p.keep)
        objs.push({ id: p.id, t: 'text', s: p.s, x: cx, y: y + (p.dy || 0), fs: p.fs || fs, f: p.f || f, it: p.it, wt: p.wt, fill: p.c || o.c || C.ink, o: p.o != null ? p.o : o.o, z: 6, d: p.d != null ? p.d : o.d, enter: p.enter || o.enter });
      cx += ws[i];
    });
    return { objs, w: W, x0: o.a === 'middle' ? x - W / 2 : o.a === 'end' ? x - W : x };
  }

  // Stacked fraction centred at x; baseline of the bar at y.
  function frac(id, top, bot, x, y, o = {}) {
    const fs = o.fs || 30;
    const T = row(id + ':n', top, x, y - fs * .34, Object.assign({}, o, { fs, a: 'middle' }));
    const B = row(id + ':d', bot, x, y + fs * .96, Object.assign({}, o, { fs, a: 'middle' }));
    const w = Math.max(T.w, B.w) + 14;
    return { objs: [...T.objs, ...B.objs, { id: id + ':bar', t: 'line', x1: x - w / 2, y1: y - fs * .02, x2: x + w / 2, y2: y - fs * .02, stroke: o.bar || C.ink, sw: 2, z: 6, d: o.d, enter: 'draw', cap: 'butt' }], w };
  }

  // A script line drawn on the stage, split into tokens: parts as in row(); mono font.
  function code(no, parts, y, o = {}) {
    const x = o.x != null ? o.x : 44;
    const fs = o.fs || 19;
    const ln = { id: `cl:${o.key || no}`, t: 'text', s: String(no), x, y, fs: fs * .85, f: 'mono', fill: C.faint, z: 6, d: o.d };
    const r = row(`c:${o.key || no}`, parts, x + fs * 2.6, y, { fs, f: 'mono', c: o.c || C.mute, d: o.d });
    return [ln, ...r.objs];
  }

  // Small drawings of 4-node graphlets, named by sorted degree sequence.
  const SHAPES = {
    '2211': [[0, 1], [1, 2], [2, 3]], '3111': [[0, 1], [0, 2], [0, 3]], '2222': [[0, 1], [1, 2], [2, 3], [3, 0]],
    '3221': [[0, 1], [1, 2], [2, 0], [2, 3]], '3322': [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]], '3333': [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]],
  };
  const SHAPE_NAME = { '2211': 'path', '3111': 'star', '2222': 'cycle', '3221': 'paw', '3322': 'diamond', '3333': 'K4' };
  function shape(id, canon, x, y, sz, o = {}) {
    const q = [[x - sz, y - sz], [x + sz, y - sz], [x + sz, y + sz], [x - sz, y + sz]];
    const col = o.c || C.ink, out = [];
    (SHAPES[canon] || []).forEach(([a, b], i) => out.push({ id: `${id}:e${i}`, t: 'line', x1: q[a][0], y1: q[a][1], x2: q[b][0], y2: q[b][1], stroke: col, sw: o.sw || 2.2, z: 5, o: o.o, d: o.d, enter: 'draw' }));
    q.forEach(([cx, cy], i) => out.push({ id: `${id}:n${i}`, t: 'circle', cx, cy, r: o.r || 4.5, fill: col, z: 6, o: o.o, d: o.d }));
    return out;
  }

  const rect = (id, x, y, w, h, o = {}) => Object.assign({ id, t: 'rect', x, y, w, h, fill: C.node, z: 2 }, o);
  const line = (id, x1, y1, x2, y2, o = {}) => Object.assign({ id, t: 'line', x1, y1, x2, y2, stroke: C.mute, sw: 2, z: 5 }, o);
  const dot = (id, cx, cy, r, o = {}) => Object.assign({ id, t: 'circle', cx, cy, r, fill: C.ink, z: 5 }, o);
  const fmt = (x, d = 3) => { const s = (+x).toFixed(d); return s.replace(/\.?0+$/, '') || '0'; };
  const pct = x => (Math.round(x * 1000) / 10) + '%';

  // HTML spans for narration, matching stage colors.
  const H = { s: t => `<b class="k-s">${t}</b>`, u: t => `<b class="k-u">${t}</b>`, n: t => `<b class="k-n">${t}</b>`, p: t => `<b class="k-p">${t}</b>`, ok: t => `<b class="k-ok">${t}</b>`, c: t => `<code>${t}</code>` };

  window.KIT = { C, POS, VIEWS, P, graph, txt, row, frac, code, shape, SHAPE_NAME, rect, line, dot, fmt, pct, H };
})();
