// Part I (the idea) and the first stages of the pipe: bash setup, BLANT, awk #1, sort -gr.
window.STEPS_A = function (D) {
  'use strict';
  const { C, P, graph, txt, row, frac, code, shape, SHAPE_NAME, rect, line, dot, fmt, H } = KIT;
  const P4 = D.perK[4], cnt = P4.awk2.count;
  const A = new Set(D.A), B = new Set(D.B);
  const inA = (a, b) => A.has(a) && A.has(b), inB = (a, b) => B.has(a) && B.has(b);
  const lit = { fill: C.ink, lab: C.bg };
  const ED = D.opt.ED;
  const steps = [];
  const S = o => steps.push(o);
  const nodesByCount = [...Array(D.N).keys()].sort((a, b) => cnt[b] - cnt[a] || a - b);
  const nE = D.EDGES.length;

  // ======================= PART I · THE IDEA =================================================
  S({ ch: 0, title: 'A network with communities hiding in it', lines: [[6, 7]],
    text: `Here's a small network with 16 nodes and 39 edges. Two groups in it are much denser than the rest, but nothing in the file says where they are. Finding them is the job of <code>blant-clusters.sh</code>.`,
    dur: 2600,
    scene: () => graph(D, { v: 'hero', edge: (a, b) => ({ stroke: '#4a5058', sw: 2, d: D.EDGES.findIndex(e => e[0] === a && e[1] === b) / nE * .7, span: .3 }), node: i => ({ d: i / D.N * .5 }) }) });

  S({ ch: 0, title: 'A community is a set that is dense enough', lines: [[6, 7], [27, 29]],
    text: `Pick a set ${H.s('S')}. Its edge density is the number of edges inside it divided by how many there could be, |S| choose 2. The script calls ${H.s('S')} a community when the density reaches the threshold ${H.p('ED')} (0.8 here) and ${H.s('S')} is too big to be dense by chance.`,
    phases: [
      () => [...graph(D, { v: 'left', node: i => A.has(i) ? lit : {}, edge: (a, b) => inA(a, b) ? { stroke: C.ink, sw: 3 } : {} }),
        ...frac('dens', [{ s: 'edges inside S', id: 'd:t' }], [{ s: '|S| choose 2', id: 'd:b' }], 790, 330, { fs: 30 }).objs,
        ...row('dl', [{ s: 'density(S) =', id: 'd:lhs' }], 600, 330, { fs: 30, a: 'end', c: C.mute }).objs],
      () => [...graph(D, { v: 'left', node: i => A.has(i) ? lit : {}, edge: (a, b) => inA(a, b) ? { stroke: C.ink, sw: 3 } : {} }),
        ...frac('dens', [{ s: '18', id: 'd:t' }], [{ s: '21', id: 'd:b' }], 680, 330, { fs: 40 }).objs,
        ...row('dl', [{ s: '= ', id: 'd:eq' }, { s: '0.857', id: 'd:v' }], 680 + frac('x', ['18'], ['21'], 0, 0, { fs: 40 }).w / 2 + 14, 344, { fs: 40 }).objs,
        ...row('dr', [{ s: '≥ ', id: 'd:ge' }, { s: 'ED = 0.8', id: 'd:ed', c: C.cob }], 640, 450, { fs: 34 }).objs,
        txt('d:cap', 'the 7 nodes on the left, 18 of 21 possible edges', 640, 520, { fs: 17, f: 'math', it: 1, fill: C.mute })],
    ] });

  S({ ch: 0, title: 'Checking every subset is hopeless', lines: [[6, 7]],
    text: `With 16 nodes there are already 65,536 subsets. A real network can have a million nodes, and then 2ⁿ has 301,030 digits. So the script never searches subsets. It looks at small random samples and lets the statistics say where to look.`,
    scene: () => [...graph(D, { v: 'small', node: i => A.has(i) ? lit : {} }),
      ...row('pw', [{ s: '2', id: 'pw:2' }, { s: '16', id: 'pw:n', fs: 30, dy: -30 }, { s: '  =  ', id: 'pw:eq' }], 380, 330, { fs: 56 }).objs,
      { id: 'pw:v', t: 'text', num: 65536, fmt: x => Math.round(x).toLocaleString('en-US'), x: 560, y: 330, fs: 56, f: 'math', fill: C.amb, z: 6, from: { num: 0 } },
      ...row('pw2', [{ s: 'n = 1,000,000  →  2ⁿ has 301,030 digits' }], 380, 420, { fs: 26, c: C.mute }).objs] });

  const shown = P4.blant.shown;
  S({ ch: 0, title: 'So sample tiny subgraphs instead', lines: [[7, 7], [10, 10]],
    text: `BLANT draws random connected subgraphs of k nodes, called graphlets (k = 4 here). A 4-node graphlet is ${H.n('dense')} when it has at least 4 of its 6 possible edges. Dense graphlets mostly land inside communities, because that's where the edges are.`,
    scene: () => [...graph(D, { v: 'full' }), txt('sm:k', 'k = 4', 60, 80, { f: 'math', fs: 30, it: 1, fill: C.mute })],
    live: t => {
      const per = 1.15, i = Math.floor(t / per) % shown.length, f = (t % per) / per, g = shown[i];
      const dense = g.edges >= 4, col = dense ? C.amb : C.mute, a = Math.min(1, f * 5) * Math.min(1, (1 - f) * 6);
      const out = [];
      for (const [x, y] of D.EDGES) if (g.nodes.includes(x) && g.nodes.includes(y)) {
        const [x1, y1] = P(x, 'full'), [x2, y2] = P(y, 'full');
        out.push({ t: 'line', x1, y1, x2, y2, stroke: col, sw: 5, o: a });
      }
      for (const v of g.nodes) { const [cx, cy] = P(v, 'full'); out.push({ t: 'circle', cx, cy, r: 24, stroke: col, sw: 3, fill: 'none', o: a }); }
      out.push({ t: 'text', s: `${g.edges} of 6 edges`, x: 940, y: 80, a: 'end', fs: 26, f: 'math', fill: col, o: a });
      out.push({ t: 'text', s: dense ? 'dense' : 'not dense', x: 940, y: 115, a: 'end', fs: 20, f: 'math', it: 1, fill: col, o: a });
      return out;
    } });

  const barAt = (i, s) => { const [x, y] = P(i, 'full'); const h = cnt[i] / 1100 * 80; return rect(`bar:${i}`, x + 19, y - h + 10, 9, h, { fill: C.amb, z: 2, enter: 'grow', d: s }); };
  S({ ch: 0, title: 'Dense graphlets leave a tally on their members', lines: [[7, 7]],
    text: `For every node, count how many ${H.n('dense graphlets')} it was part of. Nodes inside a community pile up big tallies (node 0 has ${cnt[0].toLocaleString()}), while the bridge node 8 gets only ${cnt[8]}.`,
    scene: () => [...graph(D, { v: 'full' }), ...[...Array(D.N).keys()].map(i => barAt(i, i / D.N * .5)),
      ...[0, 8].map(i => { const [x, y] = P(i, 'full'); return txt(`bt:${i}`, cnt[i], x + 34, y - cnt[i] / 1100 * 80 + 16, { fs: 16, f: 'mono', fill: C.amb }); })] });

  const rankX = r => 80 + r * 56.5;
  S({ ch: 0, title: 'Sort by tally, and that is the seed order', lines: [[7, 7]],
    text: `Sort nodes by tally. The top of the list is where communities most likely sit, so that's the order the script tries seeds in.`,
    scene: () => {
      const out = graph(D, { v: 'full', edge: () => ({ o: 0 }), node: i => ({ at: [rankX(nodesByCount.indexOf(i)), 600], fill: A.has(i) || B.has(i) ? C.node : C.node }) });
      nodesByCount.forEach((i, r) => {
        const h = cnt[i] / 1100 * 380;
        out.push(rect(`bar:${i}`, rankX(r) - 13, 575 - h, 26, h, { fill: C.amb, d: r / 16 * .4 }));
        out.push(txt(`bv:${i}`, cnt[i], rankX(r), 565 - h, { fs: 14, f: 'mono', a: 'middle', fill: C.amb, d: r / 16 * .4 }));
      });
      out.push(txt('rk:l', 'most dense graphlets', 80, 660, { fs: 17, f: 'math', it: 1, fill: C.mute }));
      out.push(txt('rk:r', 'fewest', 930, 660, { fs: 17, f: 'math', it: 1, fill: C.mute, a: 'end' }));
      return out;
    } });

  S({ ch: 0, title: 'Grow greedily from a seed', lines: [[7, 7]],
    text: `From a seed, keep adding neighbors as long as ${H.s('S')} stays about ${H.p('ED')}-dense. When no one else fits, tidy ${H.s('S')} up and keep it if it's big enough.`,
    phases: [
      () => graph(D, { v: 'full', node: i => i === 4 ? { fill: C.hot, lab: C.bg } : {} }),
      () => [...graph(D, { v: 'full', node: i => A.has(i) ? Object.assign({ d: [4, 3, 5, 1, 2, 0, 6].indexOf(i) / 7 * .7 }, lit) : {}, edge: (a, b) => inA(a, b) ? { stroke: C.ink, sw: 3.2 } : {} }),
        txt('g:r', '18 / 21 = 0.857', 940, 90, { a: 'end', f: 'math', fs: 34 })],
    ], durs: [900, 2400] });

  S({ ch: 0, title: 'Repeat for many seeds, then merge', lines: [[10, 11], [32, 34]],
    text: `Do this for many seeds, several graphlet sizes k and several thresholds ED, then throw away any cluster that mostly repeats one found earlier. What's left is the output. The rest of this page walks through the script itself, one stage of the pipeline at a time.`,
    scene: () => [...graph(D, { v: 'full', node: i => A.has(i) ? lit : B.has(i) ? { fill: C.cob, lab: C.bg } : {}, edge: (a, b) => inA(a, b) ? { stroke: C.ink, sw: 3.2 } : inB(a, b) ? { stroke: C.cob, sw: 3.2 } : {} }),
      txt('fin:a', '7 nodes, 18/21 edges', 230, 170, { f: 'math', fs: 22, a: 'middle' }),
      txt('fin:b', '6 nodes, 13/15 edges', 760, 170, { f: 'math', fs: 22, a: 'middle', fill: C.cob })] });

  // ======================= 1 · BASH SETUP ===================================================
  const VARS = [['minClusArg', '0'], ['maxClus', '2147483647'], ['minEdgeMean', '0.5'], ['OVERLAP', '0.5'], ['DENSITY_LEEWAY', '0.95'], ['SAMPLE_METHOD', '-sEBE'],
    ['PRECISION', '-p0.9L'], ['COMMUNITY_MODE', 'g'], ['EDGE_PREDICT', '0'], ['RANDOM_SEED', "''"], ['VERBOSE', '0'], ['QUIET', '-q']];
  const varPos = i => [i < 6 ? 70 : 530, 140 + (i % 6) * 50];
  function vars(over = {}, hi = []) {
    const out = [];
    VARS.forEach(([k, v], i) => {
      const [x, y] = varPos(i);
      out.push(txt(`var:${k}`, k, x, y, { f: 'mono', fs: 19, fill: hi.includes(k) ? C.ink : C.mute }));
      out.push(txt(`veq:${k}`, '=', x + 205, y, { f: 'mono', fs: 19, fill: C.faint }));
      out.push(txt(`val:${k}`, over[k] != null ? over[k] : v, x + 232, y, { f: 'mono', fs: 19, fill: hi.includes(k) ? C.hot : C.amb }));
    });
    return out;
  }
  const ARGS = ['-r', '7', '-v', './blant', '"4 5"', '0.8', 'toy.el'];
  function args(list, y = 560) { return row('args', list.map(a => ({ s: a + '  ', id: `arg:${a}` })), 70, y, { f: 'mono', fs: 22, c: C.ink }).objs.map(o => (o.s = o.s.trim(), o)); }

  S({ ch: 1, title: 'Defaults first', lines: [[58, 85]], focus: 70,
    text: `Before reading any options, the script sets its defaults. Four of them shape the result most: ${H.c('OVERLAP')} 0.5, ${H.c('DENSITY_LEEWAY')} 0.95, ${H.c('minEdgeMean')} 0.5, and ${H.c('minClusArg')} 0, which means "work out the minimum size myself".`,
    scene: () => vars({}, ['OVERLAP', 'DENSITY_LEEWAY', 'minEdgeMean', 'minClusArg']).map((o, i) => (o.d = (i * 7 % 12) / 30, o)) });

  S({ ch: 1, title: 'Options come off the front, one at a time', lines: [[87, 116]], focus: 87,
    text: `While the first argument starts with a dash, the case statement handles it and ${H.c('shift')}s it away. ${H.c('-r 7')} takes two words (shift 2), and ${H.c('-v')} takes one. Most options also accept the glued form, like ${H.c('-r7')}.`,
    phases: [
      () => [...vars(), ...args(ARGS), txt('a:lab', 'command line', 70, 520, { f: 'math', it: 1, fs: 18, fill: C.mute })],
      () => { const [x, y] = varPos(9); return [...vars({ RANDOM_SEED: '-r 7' }, ['RANDOM_SEED']), ...args(ARGS.slice(2)),
        txt('arg:-r', '-r', x + 232, y, { f: 'mono', fs: 19, fill: C.hot, o: 0 }), txt('arg:7', '7', x + 270, y, { f: 'mono', fs: 19, fill: C.hot, o: 0 }),
        txt('a:lab', 'shift 2', 70, 520, { f: 'math', it: 1, fs: 18, fill: C.mute })]; },
      () => { const [x, y] = varPos(10); return [...vars({ RANDOM_SEED: '-r 7', VERBOSE: '1', QUIET: "''" }, ['VERBOSE', 'QUIET']), ...args(ARGS.slice(3)),
        txt('arg:-v', '-v', x + 232, y, { f: 'mono', fs: 19, fill: C.hot, o: 0 }),
        txt('a:lab', 'shift 1', 70, 520, { f: 'math', it: 1, fs: 18, fill: C.mute })]; },
      () => [...vars({ RANDOM_SEED: '-r 7', VERBOSE: '1', QUIET: "''" }), ...args(ARGS.slice(3)),
        txt('a:lab', 'no leading dash, so the loop ends. $# = 4  ✓', 70, 520, { f: 'math', it: 1, fs: 18, fill: C.ok })],
    ], durs: [900, 1200, 1200, 1000] });

  S({ ch: 1, title: 'Four required arguments', lines: [[118, 133]], focus: 130,
    text: `The four words left become the BLANT command (with precision and quiet flags added), the list of graphlet sizes ${H.c('Ks')}, the list of thresholds ${H.c('EDs')}, and the network. ${H.c('Ks')} is sorted high to low so the slowest, largest-k runs start first.`,
    phases: [
      () => [...args(ARGS.slice(3), 160), ...row('ks', [{ s: 'Ks = (', id: 'ks:l' }, { s: '4', id: 'ks:4' }, { s: '  ' }, { s: '5', id: 'ks:5' }, { s: ')', id: 'ks:r' }], 70, 300, { f: 'mono', fs: 26, c: C.ink }).objs],
      () => [txt('arg:./blant', 'BLANT_CMD = "./blant -p0.9L -q"', 70, 160, { f: 'mono', fs: 22 }),
        ...row('ks', [{ s: 'Ks = (', id: 'ks:l' }, { s: '5', id: 'ks:5', c: C.amb }, { s: '  ' }, { s: '4', id: 'ks:4', c: C.amb }, { s: ')', id: 'ks:r' }], 70, 300, { f: 'mono', fs: 26, c: C.ink }).objs,
        txt('ks:c', 'echo $2 | newlines | sort -nr', 420, 300, { f: 'mono', fs: 17, fill: C.mute }),
        txt('arg:0.8', 'EDs = (0.8)', 70, 400, { f: 'mono', fs: 22, fill: C.ink }), txt('arg:toy.el', 'net = toy.el', 70, 480, { f: 'mono', fs: 22 })],
    ], durs: [900, 1600] });

  const NON = []; for (let a = 0; a < D.N; a++) for (let b = a + 1; b < D.N; b++) if (!D.adj[a].has(b)) NON.push([a, b]);
  const nonEdges = (o) => NON.map(([a, b], i) => { const [x1, y1] = P(a, 'full'), [x2, y2] = P(b, 'full'); return line(`ne:${a}-${b}`, x1, y1, x2, y2, Object.assign({ stroke: C.cob, sw: 1.2, z: 1, enter: 'draw', d: i / NON.length * .5 }, o)); });
  S({ ch: 1, title: 'Optional: work on the complement', lines: [[135, 149]], focus: 135,
    text: `With ${H.c('-C')}, the awk on lines 137–146 writes every <i>missing</i> edge instead: ${NON.length} of them here. Dense sets in the complement are sets with almost no edges in the original. Without ${H.c('-C')}, the file is just copied (line 148).`,
    phases: [
      () => graph(D, { v: 'full' }),
      () => [...graph(D, { v: 'full', edge: () => ({ o: 0 }) }), ...nonEdges(), txt('cm:l', `${NON.length} edges`, 940, 80, { a: 'end', f: 'math', fs: 30, fill: C.cob })],
      () => [...graph(D, { v: 'full' }), txt('cm:l', 'cp -p $net …/net4awk.el', 940, 80, { a: 'end', f: 'mono', fs: 18, fill: C.mute })],
    ], durs: [500, 2200, 1400] });

  S({ ch: 1, title: 'Three numbers about the network', lines: [[150, 153]], focus: 150,
    text: `One awk pass counts the distinct nodes ${H.n('n')}, the edges ${H.n('m')} (one per line), and the network's overall density m / C(n,2). The density comes back later as ε, the chance that a random pair of nodes is connected.`,
    phases: [
      () => [...graph(D, { v: 'lefthi' }), ...code(150, [{ s: 'n=length(seen)', id: 'nc:n' }, '; ', { s: 'm=NR', id: 'nc:m' }, '; ', { s: 'm/choose(n,2)', id: 'nc:d' }], 60, { c: C.ink })],
      () => [...graph(D, { v: 'lefthi' }), ...code(150, [{ s: 'n=length(seen)', id: 'nc:n0', o: .35 }, '; ', { s: 'm=NR', id: 'nc:m0', o: .35 }, '; ', { s: 'm/choose(n,2)', id: 'nc:d0', o: .35 }], 60),
        txt('nc:n', 'n = 16', 620, 220, { f: 'math', fs: 38, fill: C.amb }), txt('nc:m', 'm = 39', 620, 300, { f: 'math', fs: 38, fill: C.amb }),
        txt('nc:d', '39 / 120 = 0.325', 620, 380, { f: 'math', fs: 38 })],
    ], durs: [900, 1500] });

  S({ ch: 1, title: 'Sanity checks', lines: [[155, 169]], focus: 157,
    text: `The script stops if BLANT isn't executable, any k is outside 3–8, the file is missing, or the .el/.elw extension doesn't match ${H.c('-w')}. Then it prints a reminder to stderr, an idea for later: let the density threshold jitter at random while a cluster grows.`,
    scene: () => ['blant is executable', 'every k is between 3 and 8', 'toy.el exists', '.el file and no -w'].flatMap((s, i) => [
      txt(`ck:${i}`, '✓', 80, 180 + i * 70, { fs: 34, fill: C.ok, d: i * .18, enter: 'grow', f: 'math' }), txt(`ckt:${i}`, s, 130, 180 + i * 70, { fs: 26, f: 'math', d: i * .18 })]) });

  // ======================= 2 · BLANT × k ====================================================
  const CMD = [['$BLANT_CMD', './blant -p0.9L -q'], ['$WEIGHTED', ''], ['$ABSOLUTE_CLIQUE_COUNT', ''], ['$COMPLEMENT', ''], ['$RANDOM_SEED', '-r 7'], ['-k$k', '-k5'], ['$SAMPLE_METHOD', '-sEBE'], ['-mc$COMMUNITY_MODE', '-mcg'], ['$net', 'toy.el']];
  const cmdRow = (expanded, y) => row('cmd', CMD.flatMap(([a, b], i) => { const s = expanded ? b : a; return s ? [{ s, id: `cmd:${i}`, c: expanded ? C.amb : C.ink }, { s: ' ', id: `cmd:sp${i}` }] : []; }), 50, y, { f: 'mono', fs: 17 }).objs;
  S({ ch: 2, title: 'One BLANT run per k, all in parallel', lines: [[171, 186]], focus: 183,
    text: `For each k, the script builds a BLANT command and starts it in the background with ${H.c('&')}. Options you didn't set expand to nothing. ${H.c('-mcg')} asks for per-node, per-graphlet "community" output. A k with no ${H.c('canon_maps')} file is skipped.`,
    phases: [
      () => [...code(183, [{ s: 'CMD="$CMD $BLANT_CMD $WEIGHTED … -k$k $SAMPLE_METHOD -mc$COMMUNITY_MODE $net"' }], 60), ...cmdRow(false, 200)],
      () => [...code(183, [{ s: 'CMD="$CMD $BLANT_CMD $WEIGHTED … -k$k $SAMPLE_METHOD -mc$COMMUNITY_MODE $net"' }], 60), ...cmdRow(true, 200)],
      () => [...code(184, [{ s: 'eval $CMD > $TMPDIR/blant$k.out &' }], 60), ...cmdRow(true, 200),
        ...[5, 4].flatMap((k, i) => [txt(`ln:${k}`, `k = ${k}`, 50, 330 + i * 110, { f: 'math', fs: 26, it: 1 }),
          rect(`lb:${k}`, 160, 308 + i * 110, 600, 30, { fill: C.node }), rect(`lp:${k}`, 160, 308 + i * 110, 600, 30, { fill: k === 5 ? C.cob : C.amb, from: { w: 0 }, d: .1 * i }),
          txt(`lf:${k}`, `blant${k}.out`, 780, 330 + i * 110, { f: 'mono', fs: 18, fill: C.mute })])],
    ], durs: [900, 1500, 2200] });

  const samp = shown.slice(0, 10);
  S({ ch: 2, title: 'How BLANT picks a graphlet', lines: [[176, 178], [70, 70]],
    text: `With ${H.c('-sEBE')} (edge-based expansion), BLANT picks a random edge, then keeps adding a random neighbor of the growing set until it has k nodes. The edges among those k nodes decide the graphlet's type. It does this thousands of times.`,
    scene: () => graph(D, { v: 'full' }),
    live: t => {
      const per = 1.8, g = samp[Math.floor(t / per) % samp.length], f = (t % per) / per, out = [];
      const shownN = f < .15 ? 2 : f < .3 ? 3 : 4, fade = Math.min(1, (1 - f) * 7);
      const ns = g.nodes.slice(0, shownN);
      for (const [x, y] of D.EDGES) if (ns.includes(x) && ns.includes(y)) {
        const [x1, y1] = P(x, 'full'), [x2, y2] = P(y, 'full');
        out.push({ t: 'line', x1, y1, x2, y2, stroke: f > .45 ? (g.edges >= 4 ? C.amb : C.mute) : C.hot, sw: 5, o: fade });
      }
      ns.forEach((v, j) => { const [cx, cy] = P(v, 'full'); out.push({ t: 'circle', cx, cy, r: 23, stroke: j < 2 ? C.hot : C.ink, sw: 3, fill: 'none', o: fade }); });
      if (f > .45) out.push({ t: 'text', s: `${KIT.SHAPE_NAME[g.canon]} · ${g.edges} edges`, x: 940, y: 80, a: 'end', fs: 26, f: 'math', fill: g.edges >= 4 ? C.amb : C.mute, o: fade });
      return out;
    } });

  const b0 = P4.blant.rows.filter(r => r.node === 0).sort((a, b) => a.count - b.count);
  const rowsTable = (rows, o = {}) => rows.flatMap((r, i) => {
    const y = (o.y || 200) + i * (o.gap || 82), dead = o.dead && o.dead(r), oo = dead ? .28 : 1;
    const out = [txt(`bt:n${r.canon}`, '0', 60, y, { f: 'mono', fs: 22, o: oo }), ...shape(`bt:s${r.canon}`, r.canon, 140, y - 8, 15, { c: dead ? C.faint : C.ink, o: oo }),
      txt(`bt:t${r.canon}`, SHAPE_NAME[r.canon], 180, y, { f: 'math', fs: 22, it: 1, fill: C.mute, o: oo }),
      txt(`bt:c${r.canon}`, r.count, 360, y, { f: 'mono', fs: 22, fill: C.amb, a: 'end', o: oo }),
      txt(`bt:m${r.canon}`, r.nbrs.join(' '), 400, y, { f: 'mono', fs: 20, fill: C.mute, o: oo })];
    if (dead) out.push(line(`bt:x${r.canon}`, 50, y - 7, 640, y - 7, { stroke: C.hot, sw: 2.5, enter: 'draw' }));
    return out;
  });
  const tableHead = (y = 130) => ['node', 'graphlet type', 'count', 'co-members'].map((s, i) => txt(`th:${i}`, s, [60, 130, 360, 400][i], y, { f: 'math', fs: 17, it: 1, fill: C.faint, a: i === 2 ? 'end' : 'start' }));
  S({ ch: 2, title: 'What -mcg writes', lines: [[183, 184]],
    text: `${H.c('-mcg')} writes one line per node per graphlet type: the node, the type's canonical id, how many sampled graphlets of that type contained it, and every node that shared one with it. These are node 0's lines for k = 4. (The type names are ours. BLANT prints numeric ids.)`,
    scene: () => [...tableHead(), ...rowsTable(b0)] });

  S({ ch: 2, title: 'Wait for every run', lines: [[188, 192]], focus: 191,
    text: `${H.c('wait')} is called once per k, and each run's exit code is added to ${H.c('BLANT_EXIT_CODE')}, which becomes the script's own exit status. ${H.c('RANDOM_SEED')} loses its ${H.c('-r')} so the awk below can use the bare number.`,
    scene: () => [5, 4].flatMap((k, i) => [txt(`ln:${k}`, `k = ${k}`, 50, 330 + i * 110, { f: 'math', fs: 26, it: 1 }),
      rect(`lb:${k}`, 160, 308 + i * 110, 600, 30, { fill: C.node }), rect(`lp:${k}`, 160, 308 + i * 110, 600, 30, { fill: k === 5 ? C.cob : C.amb }),
      txt(`lf:${k}`, `exit 0  ✓`, 780, 330 + i * 110, { f: 'mono', fs: 18, fill: C.ok })]).concat([txt('ex:s', 'BLANT_EXIT_CODE = 0', 160, 580, { f: 'mono', fs: 22, fill: C.amb })]) });

  // ======================= 3 · AWK #1 ======================================================
  const a1 = P4.awk1;
  S({ ch: 3, title: 'How dense must a graphlet be?', lines: [[194, 202]], focus: 197,
    text: `For each threshold ED and each k, the next stages run once. ${H.n('edC')} is how many edges a k-graphlet needs to reach density ED: 0.8 × C(4,2) = 4.8. It's rounded down to 4. If edC is already a whole number, one more is subtracted (for k = 5, 8 becomes 7). It never goes below k−1, the minimum for a connected graphlet.`,
    phases: [
      () => code(197, [{ s: 'edC', id: 'm:edc' }, '=', { s: "'$edgeDensity'", id: 'm:ed' }, '*', { s: "choose('$k',2)", id: 'm:ch' }, ';'], 70, { c: C.ink }),
      () => [...code(197, [{ s: 'edC', id: 'm:edc0', o: .3 }, "='$edgeDensity'*choose('$k',2);"], 70),
        ...row('m', [{ s: 'edC', id: 'm:edc', it: 1 }, ' = ', { s: '0.8', id: 'm:ed', c: C.cob }, ' × ', { s: 'C(4, 2)', id: 'm:ch' }, ' = ', { s: '4.8', id: 'm:v', c: C.amb }], 120, 220, { fs: 40 }).objs],
      () => [...code(200, ['rounded_edC=int(edC); if(rounded_edC == edC) --rounded_edC;'], 70),
        ...row('m', [{ s: 'edC', id: 'm:edc', it: 1 }, ' = ', { s: '0.8', id: 'm:ed', c: C.cob }, ' × ', { s: 'C(4, 2)', id: 'm:ch' }, ' = ', { s: '4.8', id: 'm:v', c: C.amb }], 120, 220, { fs: 40 }).objs,
        ...row('m2', ['int(4.8) = ', { s: '4', id: 'm:r', c: C.amb }, '     ', { s: '(k = 5:  int(8) = 8 = edC, so 7)', id: 'm:k5', c: C.mute, fs: 26 }], 120, 320, { fs: 40 }).objs],
      () => [...code(201, ["minEdges=MAX(rounded_edC, ('$k')-1)"], 70),
        ...row('m', [{ s: 'edC', id: 'm:edc', it: 1 }, ' = ', { s: '0.8', id: 'm:ed', c: C.cob }, ' × ', { s: 'C(4, 2)', id: 'm:ch' }, ' = ', { s: '4.8', id: 'm:v', c: C.amb }], 120, 220, { fs: 40 }).objs,
        ...row('m2', ['int(4.8) = ', { s: '4', id: 'm:r', c: C.amb }, '     ', { s: '(k = 5:  int(8) = 8 = edC, so 7)', id: 'm:k5', c: C.mute, fs: 26 }], 120, 320, { fs: 40 }).objs,
        ...row('m3', [{ s: 'minEdges', it: 1 }, ' = max(4, 3) = ', { s: String(a1.minEdges), id: 'm:me', c: C.hot }], 120, 440, { fs: 48 }).objs],
    ], durs: [800, 1400, 1400, 1400] });

  const CANONS = ['2211', '3111', '2222', '3221', '3322', '3333'];
  const shapesRow = (hi) => CANONS.flatMap((c, i) => { const x = 110 + i * 150, ok = KIT.SHAPE_NAME && (c.split('').reduce((s, d) => s + +d, 0) / 2) >= a1.minEdges, e = c.split('').reduce((s, d) => s + +d, 0) / 2;
    const o = hi && !ok ? .3 : 1;
    const out = [...shape(`sh:${c}`, c, x, 300, 32, { c: hi ? (ok ? C.amb : C.faint) : C.ink, sw: 3, r: 7, o }),
      txt(`shn:${c}`, SHAPE_NAME[c], x, 380, { a: 'middle', f: 'math', it: 1, fs: 22, fill: C.mute, o }),
      txt(`she:${c}`, `${e} edges`, x, 415, { a: 'middle', f: 'math', fs: 22, fill: hi ? (ok ? C.amb : C.faint) : C.ink, o })];
    if (hi && !ok) out.push(line(`shx:${c}`, x - 45, 345, x + 45, 255, { stroke: C.hot, sw: 3, enter: 'draw' }));
    return out; });
  S({ ch: 3, title: 'Which graphlet types count as dense?', lines: [[203, 204]],
    text: `The first two input files are BLANT's tables: ${H.c('canon_list')} gives each canonical graphlet's edge count, and ${H.c('orbit_map')} maps orbits to graphlets (only used in orbit mode). With minEdges = ${a1.minEdges}, the cycle, paw, diamond and K4 count as dense. The path and the star don't.`,
    phases: [() => [...shapesRow(false), txt('sh:me', `minEdges = ${a1.minEdges}`, 500, 160, { a: 'middle', f: 'math', fs: 32, fill: C.hot })],
      () => [...shapesRow(true), txt('sh:me', `minEdges = ${a1.minEdges}`, 500, 160, { a: 'middle', f: 'math', fs: 32, fill: C.hot })]], durs: [1000, 1400] });

  S({ ch: 3, title: 'Throw away sparse graphlet lines', lines: [[205, 212]], focus: 210,
    text: `Each BLANT line has its type's edge count looked up. Below minEdges, ${H.c('next')} skips it. Node 0's path line goes, and across all nodes, ${a1.dropped.length} of ${a1.dropped.length + a1.kept.length} lines for k = 4 are dropped.`,
    phases: [() => [...tableHead(), ...rowsTable(b0)], () => [...tableHead(), ...rowsTable(b0, { dead: r => r.edges < a1.minEdges })]], durs: [400, 1400] });

  const k0 = b0.filter(r => r.edges >= a1.minEdges);
  S({ ch: 3, title: 'Add up the tally per node and type', lines: [[213, 218]], focus: 214,
    text: `${H.n('Kc[u][item]')} adds up counts per node and graphlet type, ${H.n('T[u]')} keeps the node's total, and ${H.c('graphletNeighbors[u][item]')} collects every co-member. With ${H.c('-h')}, every type shares item 0, so types are pooled.`,
    phases: [() => [...tableHead(), ...rowsTable(k0)],
      () => { let y = 600; const out = [];
        k0.forEach((r, i) => { const h = r.count / 1100 * 440; y -= h;
          out.push(rect(`stk:${r.canon}`, 720, y, 70, h - 3, { fill: [C.amb, '#e0a92e', '#b8862a'][i % 3], from: { x: 340, w: 0 } }));
          out.push(txt(`bt:c${r.canon}`, r.count, 705, y + h / 2 + 7, { a: 'end', f: 'mono', fs: 20, fill: C.amb }));
          out.push(txt(`bt:t${r.canon}`, SHAPE_NAME[r.canon], 805, y + h / 2 + 7, { f: 'math', it: 1, fs: 20, fill: C.mute })); });
        out.push(txt('stk:T', `T[0] = ${cnt[0]}`, 755, y - 20, { a: 'middle', f: 'math', fs: 30 }));
        out.push(...tableHead().map(o => (o.o = 0, o)));
        out.push(...k0.flatMap((r, i) => [txt(`bt:n${r.canon}`, '0', 60, 200 + i * 82, { f: 'mono', fs: 22, o: .35 }), ...shape(`bt:s${r.canon}`, r.canon, 140, 192 + i * 82, 15, { o: .35 }), txt(`bt:m${r.canon}`, r.nbrs.join(' '), 400, 200 + i * 82, { f: 'mono', fs: 20, fill: C.mute, o: .35 })]));
        return out; }], durs: [400, 1700] });

  const out0 = P4.awk1.out.filter(r => r.node === 0).sort((a, b) => b.count - a.count);
  S({ ch: 3, title: 'One output line per node and type', lines: [[219, 227]], focus: 223,
    text: `At the end, awk prints each (node, type) pair on its own line: the tally first so ${H.c('sort')} can rank it, then the node, the type, and its graphlet neighbors. With ${H.c('-S')}, the tally is squared and divided by ${H.n('T[u]')} instead.`,
    scene: () => out0.flatMap((r, i) => row(`ol:${i}`, [{ s: String(r.count), c: C.amb }, '  ', { s: '0' }, '  ', { s: SHAPE_NAME[r.item], c: C.mute }, '  ', { s: r.nbrs.join(' '), c: C.mute }], 80, 260 + i * 60, { f: 'mono', fs: 24, d: i * .15 }).objs) });

  // ======================= 4 · SORT -gr =====================================================
  const SR = P4.sorted, top = SR.slice(0, 14);
  const unsorted = P4.awk1.out.filter(r => top.includes(r));
  const rowKey = r => `rw:${r.node}:${r.item}`;
  const rowLine = (r, i, y0 = 110) => [txt(rowKey(r) + 'c', r.count, 150, y0 + i * 38, { f: 'mono', fs: 19, fill: C.amb, a: 'end', d: i * .02 }),
    txt(rowKey(r) + 'n', r.node, 200, y0 + i * 38, { f: 'mono', fs: 19, d: i * .02 }), txt(rowKey(r) + 't', SHAPE_NAME[r.item], 250, y0 + i * 38, { f: 'math', it: 1, fs: 19, fill: C.mute, d: i * .02 }),
    txt(rowKey(r) + 'm', r.nbrs.join(' '), 360, y0 + i * 38, { f: 'mono', fs: 17, fill: C.faint, d: i * .02 })];
  S({ ch: 4, title: 'Rank every line, biggest tally first', lines: [[228, 228]],
    text: `${H.c('sort -gr')} ranks all ${SR.length} lines by their first field. Fourteen of them are shown here. A line's position, its line number in the next awk, becomes part of its identity.`,
    phases: [() => unsorted.flatMap((r, i) => rowLine(r, i)),
      () => top.flatMap((r, i) => [...rowLine(r, i), txt(`ln#${i}`, i + 1, 70, 110 + i * 38, { f: 'mono', fs: 15, fill: C.faint, a: 'end', d: .5 + i * .02 })])], durs: [600, 2000] });

  const stripX = i => 60 + i * 16.6;
  const strip = (hiNode, o = {}) => SR.flatMap((r, i) => { const h = r.count / 600 * 330, on = hiNode != null && r.node === hiNode;
    const col = o.col ? o.col(r, i) : on ? C.hot : C.amb;
    return [rect(`st:${i}`, stripX(i), (o.base || 600) - h, 12, h, { fill: col, o: o.op ? o.op(r, i) : (hiNode != null && !on ? .35 : 1), d: o.d ? i / SR.length * .5 : 0 })]; });
  const lines0 = SR.map((r, i) => r.node === 0 ? i + 1 : 0).filter(Boolean);
  S({ ch: 4, title: 'A node can sit on several lines', lines: [[228, 228], [246, 246]],
    text: `Here are all ${SR.length} lines as bars. Node 0 shows up on lines ${lines0.join(', ')}. The next stage adds up node 0's total tally, but its ${H.c('line[]')} entry keeps only the <i>last</i> line it saw: ${H.c('line[0] = ' + P4.awk2.line[0])}. That detail decides who can join a seed's community later.`,
    phases: [() => strip(null, { d: true }), () => [...strip(0), ...lines0.map(l => txt(`stl:${l}`, `line ${l}`, stripX(l - 1) + 6, 600 - SR[l - 1].count / 600 * 330 - 14, { a: 'middle', f: 'mono', fs: 16, fill: C.hot }))]], durs: [1400, 1400] });

  return steps;
};
