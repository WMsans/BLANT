// Scene engine: every step is a list of phases; every phase is a pure function returning objects keyed by id.
// Between phases, objects that share an id morph (position, size, color, text); new ones fade or draw in,
// missing ones fade out. Rendering is a pure function of (from-snapshot, to-scene, progress), so it can be
// interrupted at any moment and restarted from wherever the picture currently is.
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const FONTS = {
    mono: '"JetBrains Mono", monospace',
    math: '"STIX Two Text", serif',
    head: 'Archivo, sans-serif',
    sans: 'Archivo, sans-serif',
  };
  const SPEED = /[?&]fast\b/.test(location.search) ? 0.06 : 1; // ?fast: for screenshots and checks
  const NUM = ['cx', 'cy', 'r', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'w', 'h', 'rx', 'o', 'sw', 'fs', 'draw', 'num'];
  const COL = ['fill', 'stroke'];

  // ---- text measurement ---------------------------------------------------------------
  const mctx = document.createElement('canvas').getContext('2d');
  function measure(s, f, fs, wt, it) {
    mctx.font = `${it ? 'italic ' : ''}${wt || 400} ${fs}px ${FONTS[f || 'mono']}`;
    return mctx.measureText(String(s)).width;
  }

  // ---- interpolation ------------------------------------------------------------------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = t => t * t * (3 - 2 * t);
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const hex = c => { if (!c || c === 'none' || c[0] !== '#') return null; const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function lerpCol(a, b, t) {
    const A = hex(a), B = hex(b);
    if (!A || !B) return t < .5 ? a : b;
    return toHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  const keyOf = o => o.t === 'text' ? `${o.s}|${o.f || 'mono'}|${o.it ? 1 : 0}|${o.wt || 400}` : '';

  function enterFrom(o) {
    const f = Object.assign({}, o, { o: 0 });
    if (o.enter === 'grow') { if (o.t === 'circle') f.r = 0; if (o.t === 'rect') { f.y = o.y + o.h; f.h = 0; } if (o.t === 'text') f.fs = o.fs * .4; }
    if (o.enter === 'draw' && (o.t === 'line' || o.t === 'path')) { f.draw = 0; f.o = o.o == null ? 1 : o.o; }
    if (o.enter === 'up') f.y = (o.y || 0) + 18;
    if (o.from) Object.assign(f, o.from);
    return f;
  }
  function interp(a, b, t) {
    const r = Object.assign({}, b);
    for (const k of NUM) if (a[k] != null || b[k] != null) {
      const x = a[k] != null ? a[k] : (k === 'o' || k === 'draw' ? 1 : b[k]);
      const y = b[k] != null ? b[k] : (k === 'o' || k === 'draw' ? 1 : a[k]);
      r[k] = x + (y - x) * t;
    }
    for (const k of COL) if (a[k] || b[k]) r[k] = lerpCol(a[k] || b[k], b[k] || a[k], t);
    return r;
  }

  // ---- DOM sync -------------------------------------------------------------------------
  function Renderer(svg) {
    const main = document.createElementNS(NS, 'g'), over = document.createElementNS(NS, 'g');
    svg.appendChild(main); svg.appendChild(over);
    const els = new Map();
    function el(id, t) {
      let e = els.get(id);
      if (!e || e.tagName !== t) { if (e) e.remove(); e = document.createElementNS(NS, t); els.set(id, e); }
      return e;
    }
    function apply(e, o) {
      const op = o.o == null ? 1 : clamp(o.o);
      e.setAttribute('opacity', op.toFixed(3));
      const set = (k, v) => v == null ? e.removeAttribute(k) : e.setAttribute(k, v);
      switch (o.t) {
        case 'circle': set('cx', o.cx); set('cy', o.cy); set('r', Math.max(0, o.r)); break;
        case 'line': set('x1', o.x1); set('y1', o.y1); set('x2', o.x2); set('y2', o.y2); set('stroke-linecap', o.cap || 'round'); break;
        case 'rect': set('x', o.x); set('y', o.y); set('width', Math.max(0, o.w)); set('height', Math.max(0, o.h)); set('rx', o.rx || 0); break;
        case 'path': set('d', o.d); set('stroke-linejoin', 'round'); set('stroke-linecap', 'round'); break;
        case 'text': {
          set('x', o.x); set('y', o.y); set('font-size', o.fs); set('font-family', FONTS[o.f || 'mono']);
          set('font-weight', o.wt || null); set('font-style', o.it ? 'italic' : null); set('text-anchor', o.a || 'start');
          e.style.whiteSpace = 'pre';
          if (o.f === 'head') e.style.fontStretch = o.stretch || '78%';
          const s = o.num != null ? (o.fmt ? o.fmt(o.num) : Math.round(o.num)) : o.s;
          if (e.textContent !== String(s)) e.textContent = s;
          break;
        }
      }
      if (o.t !== 'text' || o.fill) set('fill', o.fill || (o.t === 'line' ? null : 'none'));
      if (o.t === 'text' && !o.fill) set('fill', '#f4f5f6');
      set('stroke', o.stroke || null); set('stroke-width', o.sw != null ? o.sw : null);
      if ((o.t === 'line' || o.t === 'path') && o.draw != null && o.draw < .999) {
        set('pathLength', 1); set('stroke-dasharray', '1 1'); set('stroke-dashoffset', 1 - clamp(o.draw));
      } else { set('pathLength', null); set('stroke-dasharray', o.dash || null); set('stroke-dashoffset', null); }
    }
    function draw(list) {
      const seen = new Set();
      list.sort((a, b) => (a.z || 0) - (b.z || 0));
      let i = 0;
      for (const o of list) {
        const e = el(o._key, o.t); seen.add(o._key); apply(e, o);
        if (main.childNodes[i] !== e) main.insertBefore(e, main.childNodes[i] || null);
        i++;
      }
      for (const [id, e] of els) if (!seen.has(id)) { e.remove(); els.delete(id); }
    }
    function overlay(list) {
      over.textContent = '';
      for (const o of list || []) { const e = document.createElementNS(NS, o.t); apply(e, o); over.appendChild(e); }
    }
    return { draw, overlay };
  }

  // Interpolate two scenes (maps id -> object) at progress p, returning drawable objects.
  function blend(from, to, p) {
    const out = [];
    const ids = new Set([...Object.keys(from), ...Object.keys(to)]);
    for (const id of ids) {
      const a = from[id], b = to[id];
      const d = (b && b.d) || 0, span = (b && b.span) || 1 - d;
      const t = ease(clamp((p - d) / Math.max(span, 1e-6)));
      if (a && b) {
        if (keyOf(a) !== keyOf(b)) { // text changed: move both, cross-fade
          const m = interp(a, b, t);
          out.push(Object.assign({}, m, { s: a.s, f: a.f, it: a.it, wt: a.wt, o: (a.o == null ? 1 : a.o) * (1 - t), _key: id + '~', num: a.num, fmt: a.fmt }));
          out.push(Object.assign({}, m, { o: (b.o == null ? 1 : b.o) * t, _key: id, num: b.num }));
        } else out.push(Object.assign(interp(a, b, t), { _key: id }));
      } else if (b) out.push(Object.assign(interp(enterFrom(b), b, t), { _key: id }));
      else if (a) {
        const t2 = ease(clamp(p / .6));
        out.push(Object.assign(interp(a, Object.assign({}, a, { o: 0 }), t2), { _key: id }));
      }
    }
    return out;
  }
  // The picture as it currently stands, so a new transition can start from it.
  function snapshot(list) {
    const m = {};
    for (const o of list) if (!o._key.endsWith('~')) { const c = Object.assign({}, o); delete c._key; delete c.d; delete c.span; delete c.enter; delete c.from; m[o._key] = c; }
    return m;
  }
  const toMap = arr => { const m = {}; for (const o of arr) { if (!o) continue; if (m[o.id]) console.warn('duplicate id', o.id); m[o.id] = o; } return m; };

  // ---- Player ---------------------------------------------------------------------------
  function Player(svg, steps, hooks) {
    const R = Renderer(svg);
    let cur = {}, target = {}, from = {}, t0 = 0, dur = 1, si = 0, pi = 0, playing = false, holdUntil = 0, raf = 0, phaseStart = 0;
    let lastList = [];
    const now = () => performance.now();
    const phasesOf = s => s.phases || [s.scene];
    function build(i, j) { return toMap(phasesOf(steps[i])[j]()); }
    function startPhase(i, j, instant) {
      si = i; pi = j;
      from = snapshot(lastList.length ? lastList : []);
      target = build(i, j);
      const ph = steps[i];
      dur = instant ? 1 : ((ph.durs && ph.durs[j]) || ph.dur || 1300) * SPEED;
      t0 = now(); phaseStart = t0;
      if (j === 0) hooks.onStep(i);
      loop();
    }
    function frame() {
      raf = 0;
      const p = clamp((now() - t0) / dur);
      lastList = blend(from, target, p);
      R.draw(lastList);
      const st = steps[si];
      const live = st.lives ? st.lives[pi] : (pi === phasesOf(st).length - 1 ? st.live : null);
      R.overlay(live ? live((now() - phaseStart) / 1000) : null);
      if (p >= 1) {
        const n = phasesOf(st).length;
        if (pi < n - 1) { startPhase(si, pi + 1); return; }
        if (playing) {
          if (!holdUntil) holdUntil = now() + (st.hold || readTime(st));
          if (now() >= holdUntil) { holdUntil = 0; if (si < steps.length - 1) { go(si + 1); return; } else setPlaying(false); }
        }
        if (!live && !playing) return; // idle: nothing moves
      }
      loop();
    }
    function readTime(st) { return 2200 + (st.textLen || 160) * 28; }
    function loop() { if (!raf) raf = requestAnimationFrame(frame); }
    function go(i) {
      i = clamp(i, 0, steps.length - 1) | 0; holdUntil = 0;
      startPhase(i, 0);
    }
    function setPlaying(v) { playing = v; holdUntil = 0; hooks.onPlay(v); loop(); }
    function replay() { go(si); }
    return { go, next: () => go(si + 1), prev: () => go(si - 1), toggle: () => setPlaying(!playing), setPlaying, replay, get index() { return si; }, refresh: () => { target = build(si, pi); from = snapshot(lastList); t0 = now() - dur; loop(); } };
  }

  window.ENGINE = { Player, measure, FONTS, smooth, ease, clamp };
})();
