// A faithful, small-scale re-enactment of blant-clusters.sh on a toy graph.
// Every number the explainer shows comes from here, not from hand-written captions.
(function (root) {
  'use strict';

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const choose = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  const shuffle = (a, R) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---- the toy network -------------------------------------------------------------
  // A = 0..6 (dense), B = 9..14 (dense), 7 hangs on A, 8 bridges A-B, 15 hangs on B.
  const N = 16;
  const EDGES = [];
  const add = (a, b) => EDGES.push([Math.min(a, b), Math.max(a, b)]);
  const A = [0, 1, 2, 3, 4, 5, 6], B = [9, 10, 11, 12, 13, 14];
  const missA = ['1-5', '2-6', '3-6'], missB = ['9-13', '11-14'];
  for (const grp of [[A, missA], [B, missB]])
    for (let i = 0; i < grp[0].length; i++) for (let j = i + 1; j < grp[0].length; j++) {
      const a = grp[0][i], b = grp[0][j];
      if (!grp[1].includes(a + '-' + b)) add(a, b);
    }
  [[7, 0], [7, 1], [7, 2], [7, 3], [8, 6], [8, 9], [15, 12], [15, 13]].forEach(([a, b]) => add(a, b));

  const adj = Array.from({ length: N }, () => new Set());
  EDGES.forEach(([a, b]) => { adj[a].add(b); adj[b].add(a); });
  const hasEdge = (a, b) => adj[a].has(b);
  const inducedEdges = (set) => { let m = 0; const s = [...set]; for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) if (hasEdge(s[i], s[j])) m++; return m; };
  const degSeq = (set) => [...set].map(v => [...set].filter(u => u !== v && hasEdge(u, v)).length).sort((a, b) => b - a).join('');

  // Graphlet "canon" ids: we name each induced type by its sorted degree sequence (unique for k<=5 connected here).
  const K4_NAMES = { '1111': null, '2211': 'path', '3111': 'star', '2222': 'cycle', '3221': 'paw', '3322': 'diamond', '3333': 'K4' };

  // ---- BLANT -mcg emulation (edge-based expansion sampling) -------------------------
  function blant(k, samples, seed) {
    const R = rng(seed);
    const Kc = {};   // Kc[node][canon] = count
    const nbr = {};  // nbr[node][canon] = Set of co-members
    const shown = []; // first few samples for the animation
    for (let s = 0; s < samples; s++) {
      const e = EDGES[Math.floor(R() * EDGES.length)];
      const S = new Set(e);
      while (S.size < k) {
        const bd = [];
        for (const u of S) for (const v of adj[u]) if (!S.has(v)) bd.push(v);
        S.add(bd[Math.floor(R() * bd.length)]);
      }
      const canon = degSeq(S), edges = inducedEdges(S);
      if (shown.length < 24) shown.push({ nodes: [...S], canon, edges });
      for (const u of S) {
        (Kc[u] = Kc[u] || {})[canon] = (Kc[u][canon] || 0) + 1;
        const nb = ((nbr[u] = nbr[u] || {})[canon] = nbr[u][canon] || new Set());
        for (const v of S) if (v !== u) nb.add(v);
      }
    }
    const rows = []; // BLANT output rows: node canon count nbrs...
    for (const u in Kc) for (const c in Kc[u]) rows.push({ node: +u, canon: c, count: Kc[u][c], nbrs: [...nbr[u][c]].sort((a, b) => a - b), edges: edgesOfCanon(c) });
    return { rows, shown };
  }
  const edgesOfCanon = (c) => c.split('').reduce((s, d) => s + +d, 0) / 2;

  // ---- awk #1: filter dense graphlets, aggregate per (node,item) --------------------
  function awk1(blantRows, k, ED) {
    const edC = ED * choose(k, 2);
    let rounded = Math.floor(edC); const exact = rounded === edC; if (exact) --rounded;
    const minEdges = Math.max(rounded, k - 1);
    const Kc = {}, T = {}, gN = {}, kept = [], dropped = [];
    for (const r of blantRows) {
      if (!(r.count > 0)) continue;
      if (r.edges < minEdges) { dropped.push(r); continue; }
      kept.push(r);
      const u = r.node, item = r.canon;
      (Kc[u] = Kc[u] || {})[item] = (Kc[u][item] || 0) + r.count;
      T[u] = (T[u] || 0) + r.count;
      const g = ((gN[u] = gN[u] || {})[item] = gN[u][item] || new Set());
      r.nbrs.forEach(v => g.add(v));
    }
    const out = [];
    for (const u in Kc) for (const item in Kc[u]) out.push({ count: Kc[u][item], node: +u, item, nbrs: [...gN[u][item]].sort((a, b) => a - b) });
    return { edC, rounded, exact, minEdges, out, kept, dropped };
  }

  // sort -gr : numeric on field 1 descending; ties fall back to a reversed whole-line comparison
  const lineOf = r => [r.count, r.node, r.item, ...r.nbrs].join(' ');
  function sortGr(rows) {
    return rows.slice().sort((a, b) => (b.count - a.count) || (lineOf(b) < lineOf(a) ? -1 : lineOf(b) > lineOf(a) ? 1 : 0));
  }

  // ---- awk #2: grow communities ------------------------------------------------------
  function awk2(sorted, ED, opts) {
    const R = rng(opts.seed);
    const n = N, m = EDGES.length;
    // BEGIN: minClus heuristic
    const eps = m / choose(n, 2), pVal = 1 / Math.pow(choose(n, 2), 2);
    let e; for (e = 1; e < m; e++) if (Math.pow(eps, e) < pVal) break;
    let minClus; for (minClus = 2; minClus < n; minClus++) if (ED * choose(minClus, 2) >= e) break;
    const begin = { eps, pVal, e, minClus, epsE: Math.pow(eps, e) };

    // ARGIND==2
    const count = {}, node = [], line = {}, gN = {};
    sorted.forEach((r, i) => {
      const FNR = i + 1;
      count[r.node] = (count[r.node] || 0) + r.count; node[FNR] = r.node; line[r.node] = FNR;
      for (const v of r.nbrs) if (hasEdge(r.node, v)) { (gN[r.node] = gN[r.node] || new Set()).add(v); (gN[v] = gN[v] || new Set()).add(r.node); }
    });
    const FNR = sorted.length;
    const thrRel = Math.sqrt(ED) * 0.9;
    const highRel = (u, v) => {
      if (!(u in count) || count[u] === 0) return true;
      if (!(v in count) || count[v] === 0) return false;
      return count[v] / count[u] >= thrRel;
    };
    const leeway = ED === 1 ? 1 : 0.95;
    const started = {}; const runs = []; const accepted = [];
    const lastStart = Math.floor(FNR * ED);

    for (let start = 1; start <= lastStart; start++) {
      const origin = node[start];
      const run = { start, origin, events: [] };
      runs.push(run);
      if (started[origin]) { run.skipped = true; continue; }
      started[origin] = true;
      const S = new Set(), visited = new Set(), Q = [], Sorder = [];
      let misses = 0, edgeCount = 0;
      Q.push(origin); visited.add(origin);
      const append = (u) => {
        const considered = [];
        if (gN[u]) for (const v of shuffle([...gN[u]].sort((a, b) => a - b), R)) {
          const g = { v, visited: visited.has(v), later: !(v in line) || line[v] > line[origin], ratio: (count[v] || 0) / (count[u] || 1), rel: highRel(u, v) };
          g.ok = !g.visited && g.later && g.rel;
          if (g.ok) { Q.push(v); visited.add(v); }
          considered.push(g);
        }
        return considered;
      };
      while (Q.length) {
        const u = Q.shift();
        const hits = [...S].filter(x => hasEdge(x, u)).length;
        edgeCount += hits; S.add(u);
        const Slen = S.size; Sorder[Slen] = u;
        const ev = { u, hits, edgeCount, Slen, queueBefore: [u, ...Q], S: [...S] };
        if (Slen >= opts.maxClus) { ev.kind = 'max'; run.events.push(ev); break; }
        if (Slen === 1) { ev.kind = 'seed'; ev.appended = append(u); ev.queueAfter = [...Q]; run.events.push(ev); continue; }
        const maxEdges = choose(Slen, 2); ev.maxEdges = maxEdges; ev.density = edgeCount / maxEdges; ev.thr = ED * leeway;
        if (edgeCount / maxEdges < ED * leeway) {
          S.delete(u); edgeCount -= hits; ev.kind = 'reject'; ev.misses = ++misses; ev.budget = Math.max(Slen, n / 100);
          ev.queueAfter = [...Q]; run.events.push(ev);
          if (misses > Math.max(Slen, n / 100)) { ev.broke = true; break; }
        } else {
          misses = 0; ev.kind = 'accept'; ev.appended = append(u); ev.queueAfter = [...Q]; run.events.push(ev);
        }
      }
      run.grown = [...S]; run.Sorder = Sorder.slice(1); run.edgeCount = edgeCount;
      // post-process prune
      const degIn = (set) => { const d = {}; for (const v of set) d[v] = [...set].filter(x => x !== v && hasEdge(x, v)).length; return d; };
      if (Q.length === 0 && S.size > 1) {
        const d = degIn(S), vals = Object.values(d);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1)) : 0;
        const freq = {}; vals.forEach(x => freq[x] = (freq[x] || 0) + 1);
        let maxFreq = 0, mode = 0;
        for (let x = Math.max(...vals); x >= Math.min(...vals); x--) if (freq[x] && freq[x] >= maxFreq) { maxFreq = freq[x]; mode = x; }
        const pruned = [];
        for (const v of Object.keys(d).sort((a, b) => d[a] - d[b] || a - b)) {
          if (d[v] < mean - 3 * sd || d[v] < mode / 3) { S.delete(+v); edgeCount -= [...S].filter(x => hasEdge(x, +v)).length; pruned.push(+v); }
        }
        run.prune = { deg: d, mean, sd, mode, freq, lo1: mean - 3 * sd, lo2: mode / 3, pruned };
      }
      // strip until dense
      const strip = [];
      let d0 = degIn(S);
      const order = Object.keys(d0).sort((a, b) => d0[a] - d0[b] || a - b).map(Number);
      for (const v of order) {
        if (S.size < 2) break;
        const ed = edgeCount / choose(S.size, 2);
        if (ed >= ED) break;
        S.delete(v); edgeCount -= [...S].filter(x => hasEdge(x, v)).length;
        strip.push({ v, before: ed, after: S.size > 1 ? edgeCount / choose(S.size, 2) : 1 });
      }
      run.strip = strip;
      run.final = [...S].sort((a, b) => a - b); run.finalEdges = edgeCount;
      const Slen = S.size;
      run.accepted = Slen >= minClus && edgeCount > 0 && (edgeCount / edgeCount) >= opts.minEdgeMean;
      if (run.accepted) {
        accepted.push({ size: Slen, edges: edgeCount, wgt: edgeCount, nodes: run.final, start });
        run.marked = [];
        for (let i = 1; i < Slen * (1 - opts.overlap); i++) { started[run.Sorder[i - 1]] = true; run.marked.push(run.Sorder[i - 1]); }
      }
    }
    return { begin, count, line, node, gN, FNR, lastStart, thrRel, leeway, runs, accepted };
  }

  // ---- sort -nr | awk #3: drop exact duplicates ------------------------------------
  function awk3(accepted, k) {
    // sort -nr: numeric field 1 descending, ties by reversed whole-line comparison
    const L = c => [c.size, c.edges, c.wgt, ...c.nodes].join(' ');
    const sorted = accepted.slice().sort((a, b) => (b.size - a.size) || (L(b) < L(a) ? -1 : L(b) > L(a) ? 1 : 0));
    const clusters = [], log = [];
    for (const c of sorted) {
      let add = true, dupOf = -1;
      clusters.forEach((old, i) => { if (add && old.nodes.every(u => c.nodes.includes(u))) { add = false; dupOf = i; } });
      log.push({ c, add, dupOf });
      if (add) clusters.push(c);
    }
    const out = clusters.map(c => ({ ...c, k })).sort(subfinalSort);
    return { sorted, log, out };
  }

  // SUBFINAL_SORT="-k 1nr -k 5n": size descending, first node ascending, then whole line ascending (last resort)
  const subLine = c => [c.size, c.edges, c.wgt, c.k, ...c.nodes].join(' ');
  function subfinalSort(a, b) { return (b.size - a.size) || (a.nodes[0] - b.nodes[0]) || (subLine(a) < subLine(b) ? -1 : subLine(a) > subLine(b) ? 1 : 0); }

  // ---- final merge: overlap filter ---------------------------------------------------
  function merge(subfinals, overlap) {
    const all = [].concat(...subfinals).sort(subfinalSort);
    const kept = [], log = [];
    for (const c of all) {
      let add = true, vs = -1, same = 0;
      for (let i = 0; i < kept.length && add; i++) {
        same = c.nodes.filter(u => kept[i].nodes.includes(u)).length;
        if (same > c.nodes.length * overlap) { add = false; vs = i; }
      }
      log.push({ c, add, vs, same, limit: c.nodes.length * overlap });
      if (add) kept.push(c);
    }
    const lastK = all.length ? all[all.length - 1].k : 0;
    return { all, kept, log, lastK };
  }

  function run(opt) {
    opt = Object.assign({ Ks: [5, 4], ED: 0.8, samples: 3000, seed: 7, overlap: 0.5, minEdgeMean: 0.5, maxClus: 2147483647 }, opt || {});
    const Ks = opt.Ks.slice().sort((a, b) => b - a);
    const perK = {};
    for (const k of Ks) {
      const b = blant(k, opt.samples, opt.seed * 31 + k);
      const a1 = awk1(b.rows, k, opt.ED);
      const sorted = sortGr(a1.out);
      const a2 = awk2(sorted, opt.ED, { seed: opt.seed * 17 + k, overlap: opt.overlap, minEdgeMean: opt.minEdgeMean, maxClus: opt.maxClus });
      const a3 = awk3(a2.accepted, k);
      perK[k] = { blant: b, awk1: a1, sorted, awk2: a2, awk3: a3 };
    }
    const mg = merge(Ks.map(k => perK[k].awk3.out), opt.overlap);
    const m = EDGES.length;
    return { opt, Ks, N, EDGES, adj, A, B, n: N, m, meanED: m / choose(N, 2), perK, merge: mg, choose, K4_NAMES, inducedEdges };
  }

  const api = { run, choose, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SIM = api;
})(typeof window !== 'undefined' ? window : globalThis);
