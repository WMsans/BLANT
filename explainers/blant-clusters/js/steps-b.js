// Chapter 5: awk #2, where communities are grown. Growth runs are generated from the simulation trace.
window.STEPS_B = function (D) {
  'use strict';
  const { C, P, graph, txt, row, frac, code, rect, line, dot, fmt, H } = KIT;
  const P4 = D.perK[4], W = P4.awk2, cnt = W.count, SR = P4.sorted, ED = D.opt.ED;
  const choose = D.choose;
  const steps = [], S = o => steps.push(o);
  const lit = { fill: C.ink, lab: C.bg };
  const thr = ED * W.leeway;
  const f2 = x => (Math.round(x * 100) / 100).toFixed(2);

  // ---- minClus ------------------------------------------------------------------------
  const b = W.begin;
  const chartE = (on) => { const out = [], base = 620, sc = 70, x0 = 70;
    out.push(line('ce:base', x0 - 10, base, x0 + 10 * 42, base, { stroke: C.faint, sw: 1.5 }));
    const pv = -Math.log10(b.pVal);
    for (let e = 1; e <= 10; e++) { const h = -Math.log10(Math.pow(b.eps, e)) * sc, hit = Math.pow(b.eps, e) < b.pVal;
      out.push(rect(`ce:${e}`, x0 + (e - 1) * 42, base - h, 30, h, { fill: hit ? C.hot : C.amb, o: on ? 1 : 0, d: e / 10 * .6 }));
      out.push(txt(`cel:${e}`, e, x0 + (e - 1) * 42 + 15, base + 26, { a: 'middle', f: 'math', fs: 18, fill: hit && e === b.e ? C.hot : C.mute, o: on ? 1 : 0, d: e / 10 * .6 })); }
    out.push(line('ce:pv', x0 - 10, base - pv * sc, x0 + 10 * 42, base - pv * sc, { stroke: C.cob, sw: 2, dash: '6 6', o: on ? 1 : 0 }));
    out.push(txt('ce:pvl', '1 / C(n,2)²', x0 - 6, base - pv * sc - 12, { a: 'start', f: 'math', fs: 18, fill: C.cob, o: on ? 1 : 0 }));
    out.push(txt('ce:t', 'how unlikely: −log₁₀ ε^e', x0, 250, { f: 'math', fs: 18, it: 1, fill: C.mute, o: on ? 1 : 0 }));
    return out; };
  const chartS = (on) => { const out = [], base = 620, sc = 14, x0 = 560;
    out.push(line('cs:base', x0 - 10, base, x0 + 7 * 56, base, { stroke: C.faint, sw: 1.5 }));
    for (let s = 2; s <= 8; s++) { const v = ED * choose(s, 2), h = v * sc, hit = s === b.minClus;
      out.push(rect(`cs:${s}`, x0 + (s - 2) * 56, base - h, 40, h, { fill: hit ? C.hot : v >= b.e ? C.amb : C.faint, o: on ? 1 : 0, d: (s - 2) / 7 * .6 }));
      out.push(txt(`csl:${s}`, s, x0 + (s - 2) * 56 + 20, base + 26, { a: 'middle', f: 'math', fs: 18, fill: hit ? C.hot : C.mute, o: on ? 1 : 0, d: (s - 2) / 7 * .6 })); }
    out.push(line('cs:e', x0 - 10, base - b.e * sc, x0 + 7 * 56, base - b.e * sc, { stroke: C.cob, sw: 2, dash: '6 6', o: on ? 1 : 0 }));
    out.push(txt('cs:el', `e = ${b.e} edges`, x0 - 6, base - b.e * sc - 12, { a: 'start', f: 'math', fs: 18, fill: C.cob, o: on ? 1 : 0 }));
    out.push(txt('cs:t', 'edges at density ED: 0.8 · C(s,2)', x0, 250, { f: 'math', fs: 18, it: 1, fill: C.mute, o: on ? 1 : 0 }));
    return out; };
  const minEq = () => [...row('mc1', [{ s: 'ε', it: 1 }, ' = m / C(n,2) = 39 / 120 = ', { s: fmt(b.eps), c: C.amb }], 70, 110, { fs: 30 }).objs,
    ...row('mc2', [{ s: 'pVal', it: 1 }, ' = 1 / C(n,2)² = 1 / 14400 ≈ ', { s: '6.9 × 10⁻⁵', c: C.cob }], 70, 165, { fs: 30 }).objs];
  S({ ch: 5, sub: 'minClus', title: 'How big must a community be?', lines: [[229, 240]], focus: 235,
    text: `Without ${H.c('-m')}, the script asks how unlikely a set with e edges would be in a random graph this dense: about ε^e. It takes the smallest e with ε^e below 1/C(n,2)², which is e = ${b.e}, then the smallest size whose ED-dense version has that many edges. 0.8 × C(6,2) = 12 ≥ 9, so ${H.p('minClus = ' + b.minClus)}.`,
    phases: [() => [...minEq(), ...chartE(false), ...chartS(false)], () => [...minEq(), ...chartE(true), ...chartS(false)],
      () => [...minEq(), ...chartE(true), ...chartS(true), txt('mc:res', `minClus = ${b.minClus}`, 950, 140, { a: 'end', f: 'math', fs: 34, fill: C.hot })]], durs: [1200, 1600, 1800] });

  // ---- inputs -------------------------------------------------------------------------
  S({ ch: 5, sub: 'inputs', title: 'Load the edges', lines: [[241, 244]], focus: 243,
    text: `The first input is the edge list. A two-column line has weight 1. The script stores ${H.c('edge[u][v]')} both ways and adds the weight to each endpoint's ${H.c('degree')}, shown above each node.`,
    scene: () => [...graph(D, { v: 'full' }), ...[...Array(D.N).keys()].map(i => { const [x, y] = P(i, 'full'); return txt(`deg:${i}`, D.adj[i].size, x, y - 26, { a: 'middle', f: 'mono', fs: 15, fill: C.amb, d: i / 16 * .5 }); })] });

  const r0 = SR.map((r, i) => [r, i + 1]).filter(([r]) => r.node === 0);
  S({ ch: 5, sub: 'inputs', title: 'Read the ranked lines', lines: [[245, 246]], focus: 246,
    text: `Each ranked line adds its tally to ${H.n('count[node]')}, and records ${H.c('node[FNR]')} (whose seed is on this line) and ${H.c('line[node] = FNR')}. Because line[] is overwritten every time, it ends up as the node's <i>last</i>, lowest-tally line.`,
    phases: [
      () => r0.flatMap(([r, l], i) => row(`rl:${i}`, [{ s: `line ${l}:`, c: C.faint, fs: 20 }, '  ', { s: String(r.count), id: `rl:c${i}`, c: C.amb }, '  0  ', { s: KIT.SHAPE_NAME[r.item], c: C.mute }], 80, 180 + i * 56, { f: 'mono', fs: 24 }).objs),
      () => [...r0.flatMap(([r, l], i) => row(`rl:${i}`, [{ s: `line ${l}:`, c: C.faint, fs: 20 }, '  ', { s: String(r.count), id: `rl:c${i}x`, c: C.amb, o: .35 }, '  0  ', { s: KIT.SHAPE_NAME[r.item], c: C.mute }], 80, 180 + i * 56, { f: 'mono', fs: 24, o: .5 }).objs),
        ...row('rs', [{ s: 'count[0]', it: 1 }, ' = ', ...r0.flatMap(([r], i) => [{ s: String(r.count), id: `rl:c${i}`, c: C.amb }, i < r0.length - 1 ? ' + ' : '']), ' = ', { s: String(cnt[0]), c: C.amb }], 80, 420, { fs: 34 }).objs,
        ...row('rl', [{ s: 'line[0]', it: 1 }, ' = ', { s: String(W.line[0]), c: C.hot }, { s: '    node[1] = 0', c: C.mute }], 80, 500, { fs: 34 }).objs],
    ], durs: [900, 1700] });

  const co0 = new Set(); P4.awk1.out.filter(r => r.node === 0).forEach(r => r.nbrs.forEach(v => co0.add(v)));
  const notAdj = [...co0].filter(v => !D.adj[0].has(v));
  S({ ch: 5, sub: 'inputs', title: 'Graphlet neighbors must be real neighbors', lines: [[247, 248]], focus: 247,
    text: `Every co-member on a line becomes a ${H.c('graphletNeighbor')}, but only if the two nodes share an actual edge heavier than minEdgeMean/2 = 0.25. ${notAdj.length ? `Node ${notAdj.join(', ')} shared a graphlet with node 0 but isn't adjacent to it, so that link is dropped.` : ''} These links are the paths the search walks along.`,
    phases: [
      () => graph(D, { v: 'full', node: i => i === 0 ? { fill: C.hot, lab: C.bg } : co0.has(i) ? { stroke: C.amb, sw: 3 } : {} }),
      () => graph(D, { v: 'full', node: i => i === 0 ? { fill: C.hot, lab: C.bg } : co0.has(i) && D.adj[0].has(i) ? { fill: C.amb, lab: C.bg } : co0.has(i) ? { stroke: C.hot, sw: 3, o: .6 } : {},
        edge: (a, c) => (a === 0 && co0.has(c)) || (c === 0 && co0.has(a)) ? { stroke: C.amb, sw: 3.5 } : {} }),
    ], durs: [1100, 1500] });

  // ---- helper functions ---------------------------------------------------------------
  const Sx = [0, 1, 2, 3], vX = 5;
  const hitsX = Sx.filter(u => D.adj[vX].has(u));
  S({ ch: 5, sub: 'helpers', title: 'EdgesIntoS(v): edges from v into S', lines: [[251, 266]], focus: 253,
    text: `${H.c('EdgesIntoS(v)')} counts the edges from ${H.u('v')} into the current set ${H.s('S')}, skipping v itself. ${H.c('WgtEdgesIntoS')} adds up their weights instead. The search keeps a running ${H.c('edgeCount')}, so each candidate costs just this one count, never a full recount.`,
    scene: () => [...graph(D, { v: 'left', node: i => Sx.includes(i) ? lit : i === vX ? { fill: C.hot, lab: C.bg } : {},
      edge: (a, c) => (Sx.includes(a) && Sx.includes(c)) ? { stroke: C.ink, sw: 3 } : ((a === vX && hitsX.includes(c)) || (c === vX && hitsX.includes(a))) ? { stroke: C.hot, sw: 4.5, d: .3 + hitsX.indexOf(a === vX ? c : a) * .2, span: .25 } : {} }),
      ...row('ei', ['EdgesIntoS(', { s: '5', c: C.hot }, ') = '], 620, 380, { fs: 34 }).objs,
      { id: 'ei:n', t: 'text', num: hitsX.length, x: 880, y: 380, fs: 44, f: 'math', fill: C.hot, z: 6, from: { num: 0 } },
      txt('ei:s', 'S = {0, 1, 2, 3}', 620, 450, { f: 'math', fs: 26, fill: C.mute })] });

  const uR = 3, vOk = 5, vNo = 6, thrR = W.thrRel;
  const ratioBars = () => [[uR, C.ink], [vOk, C.ok], [vNo, C.hot]].flatMap(([v, col], i) => { const h = cnt[v] / 1100 * 330, x = 130 + i * 150;
    return [rect(`rb:${v}`, x, 600 - h, 70, h, { fill: i === 0 ? C.amb : C.amb, o: i === 0 ? 1 : .85 }), txt(`rbl:${v}`, i === 0 ? `u = ${v}` : `v = ${v}`, x + 35, 640, { a: 'middle', f: 'math', fs: 22, fill: col }),
      txt(`rbn:${v}`, cnt[v], x + 35, 590 - h, { a: 'middle', f: 'mono', fs: 18, fill: C.amb })]; });
  S({ ch: 5, sub: 'helpers', title: 'highRelClusCount: similar tallies only', lines: [[267, 272]], focus: 270,
    text: `A neighbor ${H.u('v')} only joins if its tally is close to that of the node ${H.s('u')} that found it: count[v] / count[u] ≥ 0.9·√ED = ${f2(thrR)}. That keeps the search among similarly popular nodes. A v with no tally is never admitted, and a u with no tally admits anyone.`,
    phases: [
      () => [...ratioBars(), ...code(270, ["return count[v]/count[u]>=sqrt('$edgeDensity')*0.9;"], 60, { c: C.ink })],
      () => [...ratioBars(), ...code(270, ["return count[v]/count[u]>=sqrt('$edgeDensity')*0.9;"], 60),
        ...row('rr0', ['0.9 · √0.8 = ', { s: f2(thrR), c: C.cob }], 600, 200, { fs: 30 }).objs,
        ...row('rr1', [`${cnt[vOk]} / ${cnt[uR]} = `, { s: f2(cnt[vOk] / cnt[uR]), c: C.ok }, '  ≥ ', { s: f2(thrR), c: C.cob }], 600, 330, { fs: 30 }).objs,
        ...row('rr2', [`${cnt[vNo]} / ${cnt[uR]} = `, { s: f2(cnt[vNo] / cnt[uR]), c: C.hot }, '  < ', { s: f2(thrR), c: C.cob }], 600, 420, { fs: 30 }).objs],
    ], durs: [800, 1600] });

  const gates = ['not queued yet', 'ranked after the seed', 'similar tally'];
  S({ ch: 5, sub: 'helpers', title: 'AppendNeighbors: three gates', lines: [[273, 291]], focus: 284,
    text: `${H.c('AppendNeighbors(u, origin)')} walks u's graphlet neighbors in <i>random</i> order (${H.c('randsort')}) and queues each ${H.u('v')} that passes three gates: it isn't already queued, it appears later in the ranking than the seed (${H.c('line[v] > line[origin]')}), and its tally is similar to u's. The commented-out lines are a tried-and-dropped ordering by edges into S.`,
    scene: () => gates.flatMap((g, i) => [rect(`gt:${i}`, 70 + i * 290, 250, 260, 150, { fill: 'none', stroke: C.cob, sw: 2.5, rx: 6, d: i * .2 }),
      txt(`gtn:${i}`, `${i + 1}`, 200 + i * 290, 320, { a: 'middle', f: 'math', fs: 40, fill: C.cob, d: i * .2 }),
      txt(`gtl:${i}`, g, 200 + i * 290, 370, { a: 'middle', f: 'math', fs: 22, it: 1, fill: C.mute, d: i * .2 })]).concat([
      txt('gt:q', 'all three pass → QueueAdd("Q", v)', 70, 470, { a: 'start', f: 'math', fs: 24, fill: C.ok })]) });

  // ---- outer loop -----------------------------------------------------------------------
  const stripX = i => 60 + i * 16.6;
  const strip = (col, op) => SR.flatMap((r, i) => { const h = r.count / 600 * 280; return [rect(`st:${i}`, stripX(i), 640 - h, 12, h, { fill: col(r, i), o: op ? op(r, i) : 1 })]; });
  S({ ch: 5, sub: 'outer loop', title: 'Try seeds from the top of the ranking', lines: [[292, 311]], focus: 300,
    text: `${H.c('density_leeway')} is 0.95 (exactly 1 when ED = 1). The outer loop tries the top 80% of ranked lines as seeds: int(${W.FNR} × 0.8) = ${W.lastStart}. A seed already marked ${H.c('started')} is skipped. Otherwise ${H.s('S')} and the visited set are emptied and the queue starts with the seed alone. Line 1 belongs to node ${W.node[1]}.`,
    phases: [
      () => [...strip((r, i) => i < W.lastStart ? C.amb : C.faint), txt('ol:l', `lines 1 … ${W.lastStart}`, stripX(0), 300, { f: 'math', fs: 22, fill: C.amb }), line('ol:cut', stripX(W.lastStart) - 2, 320, stripX(W.lastStart) - 2, 660, { stroke: C.cob, sw: 2, dash: '5 5' }),
        txt('ol:cl', 'int(FNR × ED)', stripX(W.lastStart) + 6, 335, { f: 'math', fs: 18, it: 1, fill: C.cob })],
      () => [...strip((r, i) => i === 0 ? C.hot : i < W.lastStart ? C.amb : C.faint, (r, i) => i === 0 ? 1 : .4), line('ol:cut', stripX(W.lastStart) - 2, 320, stripX(W.lastStart) - 2, 660, { stroke: C.cob, sw: 2, dash: '5 5' }),
        txt('ol:l', `start = 1   origin = node[1] = ${W.node[1]}`, stripX(0), 300, { f: 'math', fs: 26, fill: C.hot }),
        ...row('ol:q', [{ s: 'S = { }     Q = [ ' }, { s: String(W.node[1]), c: C.hot }, ' ]'], stripX(0), 200, { fs: 30 }).objs],
    ], durs: [1300, 1400] });

  // ---- BFS trace scenes ---------------------------------------------------------------
  const chip = (v, x, y, col, o = {}) => [dot(`ch:${v}`, x, y, 15, Object.assign({ fill: col, z: 7, enter: 'grow' }, o)),
    txt(`chl:${v}`, v, x, y + 5, Object.assign({ a: 'middle', f: 'mono', fs: 14, wt: 600, fill: col === C.ink || col === C.amb || col === C.hot || col === C.ok ? C.bg : C.ink, z: 8 }, o))];
  function bfsBase(run, ev, ph, extra = {}) {
    const Sb = ev.S.filter(x => x !== ev.u);
    const done = ph === 'done', acc = ev.kind === 'accept' || ev.kind === 'seed';
    const Sv = done && acc ? [...Sb, ev.u] : Sb;
    const Q = done ? ev.queueAfter || [] : ev.queueBefore.slice(1);
    const rejected = new Set(extra.rejected || []);
    if (done && !acc) rejected.add(ev.u);
    const out = graph(D, { v: 'left', node: i => Sv.includes(i) ? lit : (i === ev.u && !done) ? { fill: C.hot, lab: C.bg } : Q.includes(i) ? { fill: '#28325e', lab: C.cob, stroke: C.cob, sw: 2.5 } : rejected.has(i) ? { stroke: C.hot, sw: 2, o: .6 } : {},
      edge: (a, c) => {
        if (Sv.includes(a) && Sv.includes(c)) return { stroke: C.ink, sw: 3 };
        const touch = (a === ev.u && Sb.includes(c)) || (c === ev.u && Sb.includes(a));
        if (touch && !done && ph !== 'pop') return { stroke: C.hot, sw: 4.5 };
        return {};
      } });
    out.push(txt('bq:l', 'Q', 44, 135, { f: 'math', fs: 24, it: 1, fill: C.cob }), txt('bs:l', 'S', 44, 190, { f: 'math', fs: 24, it: 1, fill: C.mute }));
    Q.forEach((v, j) => out.push(...chip(v, 95 + j * 38, 128, '#28325e', { stroke: C.cob, sw: 2 })));
    Sv.forEach((v, j) => out.push(...chip(v, 95 + j * 38, 183, C.ink)));
    if (!done) out.push(...chip(ev.u, 95 + Sb.length * 38, 183, C.hot));
    out.push(txt('bt:run', `seed ${run.origin} · line ${run.start}`, 950, 135, { a: 'end', f: 'math', fs: 20, it: 1, fill: C.faint }));
    return out;
  }
  const testTokens = (dim) => [{ s: 'if(' }, { s: 'edgeCount', id: dim ? 'k:ec0' : 'k:ec', c: dim ? undefined : C.amb }, { s: '/' }, { s: 'maxEdges', id: dim ? 'k:me0' : 'k:me', c: dim ? undefined : C.amb },
    { s: ' < ', id: dim ? 'k:lt0' : 'k:lt', c: dim ? undefined : C.ink }, { s: "'$edgeDensity'", id: dim ? 'k:ed0' : 'k:ed', c: dim ? undefined : C.cob }, { s: ' * ' }, { s: 'density_leeway', id: dim ? 'k:lw0' : 'k:lw', c: dim ? undefined : C.cob }, { s: ') {' }];
  function mathCount(ev, o = 1) {
    const old = ev.edgeCount - ev.hits;
    return [...row('mh', [{ s: 'newEdgeHits = ', c: C.mute }, { s: String(ev.hits), id: 'mh:v', c: C.hot }], 620, 250, { fs: 26, o }).objs,
      ...row('me', [{ s: 'edgeCount = ', c: C.mute }, `${old} + `, { s: String(ev.hits), c: C.hot }, ' = ', { s: String(ev.edgeCount), id: 'me:v', c: C.amb }], 620, 295, { fs: 26, o }).objs];
  }
  function mathTest(ev) {
    const ok = ev.density >= ev.thr;
    return [...frac('kt', [{ s: String(ev.edgeCount), id: 'k:ec', c: C.amb }], [{ s: String(ev.maxEdges), id: 'k:me', c: C.amb }], 680, 405, { fs: 44 }).objs,
      ...row('kt2', ['= ', { s: f2(ev.density), c: ok ? C.ok : C.hot }], 680 + frac('x', [String(ev.edgeCount)], [String(ev.maxEdges)], 0, 0, { fs: 44 }).w / 2 + 14, 419, { fs: 40 }).objs,
      txt('kt:mx', `maxEdges = C(${ev.Slen}, 2)`, 620, 345, { f: 'math', fs: 18, it: 1, fill: C.faint }),
      ...row('kt3', [{ s: ok ? '≥ ' : '< ', id: 'k:lt', c: ok ? C.ok : C.hot }, { s: '0.8', id: 'k:ed', c: C.cob }, ' × ', { s: '0.95', id: 'k:lw', c: C.cob }, ' = ', { s: f2(ev.thr), c: C.cob }], 640, 510, { fs: 34 }).objs];
  }
  function popCode(ev) { return code(313, ['u = QueueNext("Q");'], 55, { c: C.ink }); }
  function eventStep(run, ei, o = {}) {
    const ev = run.events[ei], ok = ev.kind === 'accept';
    const extra = { rejected: run.events.slice(0, ei).filter(e => e.kind === 'reject').map(e => e.u) };
    const queued = ok ? (ev.appended || []).filter(g => g.ok).map(g => g.v) : [];
    const appendNote = ok ? (queued.length ? `AppendNeighbors(${ev.u}) queues ${queued.join(', ')}` : `AppendNeighbors(${ev.u}) finds nobody new`) : '';
    const verdict = ok ? `keep ${ev.u}   misses = 0` : `evict ${ev.u}   misses = ${ev.misses}`;
    const doneCode = ok ? code(347, ['misses=0; AppendNeighbors(u, origin);'], 55, { c: C.ink }) :
      [...code(332, ['delete S[u];  …  edgeCount -= newEdgeHits;'], 55, { c: C.ink }), ...code(344, ['if(++misses > MAX(Slen, n/100)) break;'], 85, { c: C.ink })];
    S({ ch: 5, sub: 'grow', title: o.title || (ok ? `Try node ${ev.u}: it stays` : `Try node ${ev.u}: too sparse`), lines: [[312, 351]], focus: [313, 315, 331, ok ? 347 : 332],
      text: o.text || (ok ? `Pop ${H.u(ev.u)} off the queue. It has ${ev.hits} edge${ev.hits === 1 ? '' : 's'} into ${H.s('S')}, so edgeCount becomes ${ev.edgeCount}. With |S| = ${ev.Slen}, the density is ${ev.edgeCount}/${ev.maxEdges} = ${f2(ev.density)}, at least 0.95 × ED = ${f2(ev.thr)}, so ${ev.u} stays. ${appendNote}.`
        : `Pop ${H.u(ev.u)}. It has only ${ev.hits} edge${ev.hits === 1 ? '' : 's'} into ${H.s('S')}: ${ev.edgeCount}/${ev.maxEdges} = ${f2(ev.density)}, below ${f2(ev.thr)}. ${ev.u} is deleted from S, its edges are subtracted again, and ${H.c('misses')} goes up to ${ev.misses} (the budget is MAX(Slen, n/100) = ${fmt(ev.budget)}).`),
      phases: [
        () => [...bfsBase(run, ev, 'pop', extra), ...popCode(ev)],
        () => [...bfsBase(run, ev, 'count', extra), ...code(315, ['newEdgeHits = EdgesIntoS(u);'], 55, { c: C.ink }), ...code(317, ['edgeCount += newEdgeHits;'], 85, { c: C.ink }), ...mathCount(ev)],
        () => [...bfsBase(run, ev, 'test', extra), ...code(331, testTokens(false), 55), ...mathCount(ev, .45)],
        () => [...bfsBase(run, ev, 'test', extra), ...code(331, testTokens(true), 55, { c: C.faint }), ...mathCount(ev, .45), ...mathTest(ev)],
        () => [...bfsBase(run, ev, 'done', extra), ...doneCode, ...mathCount(ev, .25), ...mathTest(ev),
          txt('vd', verdict, 620, 590, { f: 'math', fs: 28, fill: ok ? C.ok : C.hot }), txt('vd2', appendNote, 620, 630, { f: 'math', fs: 18, it: 1, fill: C.mute })],
      ], durs: o.durs || [700, 1100, 800, 1400, 1100] });
  }

  const run1 = W.runs.find(r => r.start === 1);
  const seedEv = run1.events[0];
  const gateRows = (gs, origin) => gs.flatMap((g, i) => { const y = 270 + i * 44;
    const c1 = g.later ? C.ok : C.hot, c2 = g.rel ? C.ok : C.hot;
    return [txt(`gr:v${g.v}`, g.v, 640, y, { f: 'mono', fs: 22, a: 'middle', d: i * .08, fill: g.ok ? C.ok : C.ink }),
      txt(`gr:l${g.v}`, `${W.line[g.v]} ${g.later ? '>' : '<'} ${W.line[origin]}`, 720, y, { f: 'mono', fs: 19, fill: c1, d: i * .08 }),
      txt(`gr:r${g.v}`, f2(g.ratio), 860, y, { f: 'mono', fs: 19, fill: c2, d: i * .08 }),
      txt(`gr:o${g.v}`, g.ok ? 'queue' : '—', 965, y, { f: 'math', fs: 19, a: 'end', fill: g.ok ? C.ok : C.faint, d: i * .08 })]; });
  const gateHead = () => [['v', 640, 'middle'], ['line[v] > line[0]', 720], ['ratio ≥ .80', 860]].map(([s, x, a], i) => txt(`gh:${i}`, s, x, 225, { f: 'math', fs: 17, it: 1, fill: C.faint, a: a || 'start' }));
  const queued0 = seedEv.appended.filter(g => g.ok).map(g => g.v);
  S({ ch: 5, sub: 'grow', title: `Seed ${run1.origin}: who may follow?`, lines: [[312, 329], [273, 291]], focus: [313, 327, 328],
    text: `Pop the seed ${H.u(run1.origin)}. With |S| = 1 there's no density to test, so AppendNeighbors runs right away. ${seedEv.appended.filter(g => !g.later).map(g => g.v).join(' and ')} fail gate 2: their last line comes before line ${W.line[run1.origin]}. ${seedEv.appended.filter(g => g.later && !g.rel).map(g => g.v).join(' and ')} fail on tally ratio. ${queued0.join(', ')} go into the queue, in random order.`,
    phases: [
      () => [...bfsBase(run1, seedEv, 'pop'), ...popCode(seedEv)],
      () => [...bfsBase(run1, seedEv, 'done'), ...code(328, ['AppendNeighbors(u, origin);'], 55, { c: C.ink }), ...gateHead(), ...gateRows(seedEv.appended, run1.origin)],
    ], durs: [900, 2200] });
  run1.events.forEach((ev, i) => { if (i > 0) eventStep(run1, i, i > 2 ? { durs: [500, 800, 600, 1100, 900] } : {}); });

  const missing = D.A.filter(v => !run1.grown.includes(v));
  S({ ch: 5, sub: 'grow', title: 'The queue is empty. Where is node 4?', lines: [[284, 284], [246, 246]], focus: 284,
    text: `${H.s('S')} = {${run1.grown.join(', ')}}. Node ${missing.join(', ')} is densely tied to all of them, but it never passed gate 2: its last ranked line is ${W.line[4]}, before the seed's last line ${W.line[run1.origin]}, so it counts as "earlier than the seed" even though its tally is high. The script relies on another seed to find the full set (it does, from line 5).`,
    scene: () => [...graph(D, { v: 'left', node: i => run1.grown.includes(i) ? lit : missing.includes(i) ? { fill: C.hot, lab: C.bg } : {}, edge: (a, c) => run1.grown.includes(a) && run1.grown.includes(c) ? { stroke: C.ink, sw: 3 } : (missing.includes(a) && run1.grown.includes(c)) || (missing.includes(c) && run1.grown.includes(a)) ? { stroke: C.hot, sw: 2, dash: '4 7' } : {} }),
      ...row('w4', [{ s: 'line[4]', it: 1 }, ' = ', { s: String(W.line[4]), c: C.hot }, '  <  ', { s: 'line[0]', it: 1 }, ' = ', { s: String(W.line[0]), c: C.amb }], 620, 300, { fs: 30 }).objs,
      txt('w4:c', 'gate 2 compares last lines, not first ones', 620, 350, { f: 'math', fs: 19, it: 1, fill: C.mute })] });

  // ---- post-processing --------------------------------------------------------------------
  const pr = run1.prune;
  const histo = (pr, o) => { const out = [], x0 = 620, base = 560, sc = 50, vals = Object.keys(pr.freq).map(Number);
    const lo = Math.min(...vals, Math.floor(pr.lo2)) - 1, hi = Math.max(...vals) + 1;
    const X = d => x0 + (d - Math.max(0, lo)) * 62;
    for (let d = Math.max(0, lo); d <= hi; d++) { const f = pr.freq[d] || 0;
      out.push(rect(`hg:${d}`, X(d) - 18, base - f * sc, 36, f * sc, { fill: d === pr.mode ? C.amb : '#8a7a4a' }));
      out.push(txt(`hgl:${d}`, d, X(d), base + 26, { a: 'middle', f: 'math', fs: 18, fill: C.mute })); }
    for (const [k, v, lab] of [['lo1', pr.lo1, 'mean − 3σ'], ['lo2', pr.lo2, 'mode / 3']]) {
      const x = X(v); out.push(line(`hgt:${k}`, x, base + 4, x, 300, { stroke: C.cob, sw: 2, dash: '5 5', o: o ? 1 : 0 }));
      out.push(txt(`hgtl:${k}`, `${lab} = ${f2(v)}`, x, k === 'lo1' ? 290 : 255, { a: k === 'lo1' ? 'start' : 'end', f: 'math', fs: 19, fill: C.cob, o: o ? 1 : 0 })); }
    out.push(txt('hg:t', 'in-cluster degree', x0, 610, { f: 'math', fs: 17, it: 1, fill: C.faint }));
    return out; };
  const degLabels = (deg, view) => Object.entries(deg).map(([v, d]) => { const [x, y] = P(+v, view); return txt(`dg:${v}`, d, x, y - 26, { a: 'middle', f: 'mono', fs: 16, fill: C.amb }); });
  S({ ch: 5, sub: 'clean up', title: 'Prune members with too few ties inside', lines: [[353, 382]], focus: 374,
    text: `When the queue runs dry, ${H.c('InducedEdges')} computes each member's degree inside S. A member is pruned if its in-degree is more than 3σ below the mean, or below a third of the most common in-degree (the smallest mode wins ties). Here mean = ${f2(pr.mean)}, σ = ${f2(pr.sd)}, mode = ${pr.mode}. Every member clears both bars, so nobody is pruned.`,
    phases: [() => [...graph(D, { v: 'left', node: i => run1.grown.includes(i) ? lit : {}, edge: (a, c) => run1.grown.includes(a) && run1.grown.includes(c) ? { stroke: C.ink, sw: 3 } : {} }), ...degLabels(pr.deg, 'left'), ...histo(pr, false)],
      () => [...graph(D, { v: 'left', node: i => run1.grown.includes(i) ? lit : {}, edge: (a, c) => run1.grown.includes(a) && run1.grown.includes(c) ? { stroke: C.ink, sw: 3 } : {} }), ...degLabels(pr.deg, 'left'), ...histo(pr, true)]], durs: [1200, 1500] });

  const run21 = W.runs.find(r => r.strip && r.strip.length);
  const st = run21.strip[0];
  S({ ch: 5, sub: 'clean up', title: 'Strip until the set is truly dense', lines: [[383, 399]], focus: 388,
    text: `The 0.95 leeway can let a set end slightly below ED. So members are removed from the lowest in-degree up until density reaches ED. For seed 0 above, 12/15 = 0.80 already qualifies. The seed on line ${run21.start} (node ${run21.origin}) grew to {${run21.grown.join(', ')}}: 22/28 = ${f2(st.before)} &lt; 0.8, so node ${st.v} (in-degree ${run21.prune.deg[st.v]}, tied with node 7 and first in order) is stripped, leaving ${f2(st.after)}.`,
    phases: [
      () => [...graph(D, { v: 'left', node: i => run21.grown.includes(i) ? lit : {}, edge: (a, c) => run21.grown.includes(a) && run21.grown.includes(c) ? { stroke: C.ink, sw: 3 } : {} }), ...degLabels(run21.prune.deg, 'left'),
        ...row('sp', ['22 / 28 = ', { s: f2(st.before), c: C.hot }, '  <  ', { s: '0.8', c: C.cob }], 620, 330, { fs: 34 }).objs],
      () => [...graph(D, { v: 'left', node: i => run21.final.includes(i) ? lit : i === st.v ? { stroke: C.hot, sw: 3, o: .7 } : {}, edge: (a, c) => run21.final.includes(a) && run21.final.includes(c) ? { stroke: C.ink, sw: 3 } : {} }),
        ...row('sp', ['18 / 21 = ', { s: f2(st.after), c: C.ok }, '  ≥  ', { s: '0.8', c: C.cob }], 620, 330, { fs: 34 }).objs,
        txt('sp:c', `delete S[${st.v}]`, 620, 390, { f: 'mono', fs: 20, fill: C.hot })],
    ], durs: [1400, 1600] });

  const outLine = `${run1.final.length} ${run1.finalEdges} ${run1.finalEdges} ${run1.final.join(' ')}`;
  S({ ch: 5, sub: 'accept', title: 'Keep it if it is big and strong enough', lines: [[400, 410]], focus: 401,
    text: `Two final checks: |S| ≥ minClus (${run1.final.length} ≥ ${b.minClus}) and the mean edge weight ≥ minEdgeMean (unweighted, so ${run1.finalEdges}/${run1.finalEdges} = 1 ≥ 0.5). Both pass, so the cluster is printed as size, edges, weight sum, and members.`,
    phases: [
      () => [...graph(D, { v: 'lefthi', node: i => run1.final.includes(i) ? lit : {}, edge: (a, c) => run1.final.includes(a) && run1.final.includes(c) ? { stroke: C.ink, sw: 3 } : {} }),
        ...row('ac1', ['|S| = 6  ≥  ', { s: 'minClus = 6', c: C.cob }, { s: '   ✓', c: C.ok }], 620, 280, { fs: 30 }).objs,
        ...row('ac2', ['12 / 12 = 1  ≥  ', { s: '0.5', c: C.cob }, { s: '   ✓', c: C.ok }], 620, 340, { fs: 30, d: .4 }).objs],
      () => [...graph(D, { v: 'lefthi', node: i => run1.final.includes(i) ? lit : {}, edge: (a, c) => run1.final.includes(a) && run1.final.includes(c) ? { stroke: C.ink, sw: 3 } : {} }),
        ...row('ac1', ['|S| = 6  ≥  ', { s: 'minClus = 6', c: C.cob }, { s: '   ✓', c: C.ok }], 620, 280, { fs: 30, o: .5 }).objs,
        ...row('ac2', ['12 / 12 = 1  ≥  ', { s: '0.5', c: C.cob }, { s: '   ✓', c: C.ok }], 620, 340, { fs: 30, o: .5 }).objs,
        txt('ac:out', outLine, 70, 620, { f: 'mono', fs: 26, fill: C.amb, enter: 'up' })],
    ], durs: [1500, 1200] });

  const so = run1.Sorder, lim = run1.final.length * (1 - D.opt.overlap);
  S({ ch: 5, sub: 'accept', title: 'Mark the first members as used seeds', lines: [[411, 417]], focus: 416,
    text: `${H.c('Sorder')} remembers the order members joined: ${so.join(', ')}. Members ${H.c('i < |S| × (1 − OVERLAP)')} = ${fmt(lim)} (here ${run1.marked.join(' and ')}) are marked ${H.c('started')} and will never seed again. The closer OVERLAP is to 1, the fewer seeds get blocked. At 1, none are.`,
    scene: () => [...so.flatMap((v, j) => [...chip(v, 140 + j * 70, 300, j < run1.marked.length ? C.amb : C.ink),
      txt(`so:i${j}`, `i=${j + 1}`, 140 + j * 70, 350, { a: 'middle', f: 'mono', fs: 15, fill: C.faint })]),
      line('so:cut', 140 + (run1.marked.length - .5) * 70, 260, 140 + (run1.marked.length - .5) * 70, 370, { stroke: C.cob, sw: 2, dash: '5 5' }),
      txt('so:l', `i < 6 × (1 − 0.5) = 3`, 140, 230, { f: 'math', fs: 26, fill: C.cob }),
      txt('so:m', 'started[0] = started[1] = 1', 140, 440, { f: 'mono', fs: 22, fill: C.amb })] });

  // ---- a run with misses -------------------------------------------------------------------
  const runR = W.runs.find(r => !r.skipped && r.events.filter(e => e.kind === 'reject').length >= 2);
  const rIdx = runR.events.findIndex(e => e.kind === 'reject');
  eventStep(runR, rIdx, { title: `Seed ${runR.origin}: a candidate that fails` });
  const lastRej = runR.events[runR.events.length - 1];
  S({ ch: 5, sub: 'grow', title: 'Misses pile up, then the seed gives up', lines: [[331, 345]], focus: 344,
    text: `Seed ${runR.origin} keeps finding candidates that would drop the density, and each one adds to ${H.c('misses')}: ${runR.events.filter(e => e.kind === 'reject').map(e => e.u).join(', ')} all fail. A big enough streak (more than MAX(Slen, n/100)) ends the search early. Here the queue empties first. ${H.s('S')} = {${runR.final.join(', ')}} is far below minClus, so nothing is printed.`,
    scene: () => [...bfsBase(runR, lastRej, 'done', { rejected: runR.events.filter(e => e.kind === 'reject').map(e => e.u) }), ...code(344, ['if(++misses > MAX(Slen, n/100)) break;'], 55, { c: C.ink }),
      ...row('ms', [{ s: 'misses = ', c: C.mute }, { s: String(lastRej.misses), c: C.hot }], 620, 300, { fs: 28 }).objs,
      ...row('ms2', [{ s: 'budget = ', c: C.mute }, { s: `MAX(${lastRej.Slen}, 16/100) = ${fmt(lastRej.budget)}`, c: C.cob }], 620, 345, { fs: 26 }).objs,
      txt('ms:r', `|S| = ${runR.final.length} < ${b.minClus}: rejected`, 620, 400, { f: 'math', fs: 26, fill: C.hot })] });

  S({ ch: 5, sub: 'grow', title: 'A branch that does nothing: -P prediction', lines: [[333, 341]], focus: 338,
    text: `With ${H.c('-P N')}, a candidate that misses by at most N edges should have its missing edges reported as predictions on stderr. But the ${H.c('printf')} on line 338 is commented out, so the ${H.c('for')} loop's body is now the ${H.c('WARN')} on line 339, and ${H.c('numPredict')} never moves. As written, nothing gets predicted.`,
    scene: () => [...code(337, ['for(uu in S)if(!(u in edge[uu]))'], 140, { c: C.ink }), ...code(338, ['#printf "predictEdge-%d\\t%s\\t%s\\n",++numPredict, u,uu > "/dev/stderr"'], 180, { c: C.faint }),
      line('pp:x', 90, 174, 920, 174, { stroke: C.hot, sw: 2.5, enter: 'draw' }), ...code(339, ['WARN(numPredict<=edgePredict, …);'], 220, { c: C.amb }),
      txt('pp:c', 'this line is now the loop body', 560, 220, { f: 'math', fs: 20, it: 1, fill: C.amb })] });

  // ---- all seeds ------------------------------------------------------------------------------
  const runs = W.runs, acc = runs.filter(r => r.accepted);
  const status = i => { const r = runs.find(x => x.start === i + 1); if (!r) return 'out'; if (r.skipped) return 'skip'; return r.accepted ? 'acc' : 'small'; };
  const scol = { acc: C.ok, small: C.mute, skip: C.faint, out: C.dim };
  S({ ch: 5, sub: 'all seeds', title: `All ${W.lastStart} seeds for k = 4`, lines: [[300, 419]], focus: 300,
    text: `Most lines are skipped because their node was already marked started. ${runs.filter(r => !r.skipped && !r.accepted).length} seeds grow sets that are too small. ${acc.length} grow clusters that pass: from lines ${acc.map(r => r.start).join(', ')}. Some are nearly the same set, which the next two stages deal with.`,
    scene: () => [...strip((r, i) => scol[status(i)]), ...[['acc', 'kept'], ['small', 'too small'], ['skip', 'skipped: started']].map(([k, l], i) => txt(`lg:${k}`, l, 60 + i * 220, 300, { f: 'math', fs: 20, fill: scol[k] })),
      ...acc.map((r, i) => row(`acr:${i}`, [{ s: `line ${r.start}:`, c: C.faint }, `  {${r.final.join(', ')}}`], 60, 120 + i * 40, { f: 'mono', fs: 19, c: C.ok, d: i * .15 }).objs).flat()] });

  return steps;
};
