// Chapters 6 and 7: exact-duplicate removal, the cross-k/ED merge with the overlap filter, and the report.
window.STEPS_C = function (D) {
  'use strict';
  const { C, P, graph, txt, row, code, rect, line, dot, fmt, H } = KIT;
  const steps = [], S = o => steps.push(o);
  const A3 = D.perK[4].awk3, MG = D.merge, choose = D.choose;
  const lit = { fill: C.ink, lab: C.bg };
  const f2 = x => (Math.round(x * 100) / 100).toFixed(2);

  // A cluster drawn as a row of node chips; chip ids are per cluster row so rows can slide.
  const clRow = (key, c, x, y, o = {}) => {
    const out = [];
    c.nodes.forEach((v, j) => {
      const col = o.col ? o.col(v) : C.ink;
      out.push(dot(`${key}:n${v}`, x + j * 34, y, 13, { fill: col, o: o.o, z: 7, d: o.d }));
      out.push(txt(`${key}:l${v}`, v, x + j * 34, y + 5, { a: 'middle', f: 'mono', fs: 13, wt: 600, fill: C.bg, o: o.o, z: 8, d: o.d }));
    });
    out.push(txt(`${key}:m`, o.meta || `${c.size} nodes · ${c.edges} edges${c.k ? ' · k' + c.k : ''}`, x + c.nodes.length * 34 + 10, y + 6, { f: 'math', fs: 19, fill: o.metaCol || C.mute, o: o.o, d: o.d }));
    return out;
  };

  // ======================= 6 · sort -nr | awk #3 ============================================
  S({ ch: 6, title: 'Drop exact duplicates', lines: [[420, 442]], focus: 436,
    text: `${H.c('sort -nr')} puts the biggest clusters first. For each new cluster, ${H.c('same')} counts how many of an earlier cluster's nodes it contains. It's dropped only if that equals the earlier cluster's full size. Earlier clusters are at least as big, so only identical sets go. All ${A3.sorted.length} clusters for k = 4 survive, near-twins included.`,
    phases: [
      () => A3.sorted.flatMap((c, i) => clRow(`d${c.nodes.join('_')}`, c, 90, 180 + i * 80, { d: i * .12 })),
      () => [...A3.sorted.flatMap((c, i) => clRow(`d${c.nodes.join('_')}`, c, 90, 180 + i * 80, { metaCol: C.ok, meta: `${c.size} nodes · ${c.edges} edges   kept` })),
        txt('dd:r', 'same == length(cluster[i])  never true here', 90, 560, { f: 'mono', fs: 19, fill: C.mute })],
    ], durs: [1300, 1200] });

  const sub5 = D.perK[5].awk3.out, sub4 = A3.out;
  const fileCol = (key, list, x, title) => [txt(`${key}:t`, title, x, 140, { f: 'mono', fs: 19, fill: C.cob }),
    ...list.flatMap((c, i) => row(`${key}:${i}`, [{ s: `${c.size} ${c.edges} ${c.wgt} `, c: C.amb }, { s: `${c.k} `, c: C.cob }, c.nodes.join(' ')], x, 195 + i * 44, { f: 'mono', fs: 18, c: C.ink }).objs)];
  S({ ch: 6, title: 'One sorted file per k and ED', lines: [[443, 457]], focus: 452,
    text: `Each survivor is printed with its k added and sorted by size, then by first node (${H.c('-k 1nr -k 5n')}), into ${H.c('subfinal$k$edgeDensity.out')}. The whole chain runs in the background per k, the inner ${H.c('wait')} lets every k finish, and the outer loop repeats it all for the next ED.`,
    scene: () => [...fileCol('f5', sub5, 60, 'subfinal50.8.out'), ...fileCol('f4', sub4, 520, 'subfinal40.8.out')] });

  // ======================= 7 · MERGE ========================================================
  const all = MG.all;
  S({ ch: 7, title: 'Merge every file into one ranked list', lines: [[459, 460]], focus: 460,
    text: `The files are already sorted the same way, so ${H.c('sort --merge')} just zips them together: biggest first, ties broken by first node and then the whole line. Across both k values there are ${all.length} candidate clusters.`,
    phases: [
      () => [...fileCol('f5', sub5, 60, 'subfinal50.8.out'), ...fileCol('f4', sub4, 520, 'subfinal40.8.out')],
      () => all.flatMap((c, i) => { const key = c.k === 5 ? `f5:${sub5.indexOf(c)}` : `f4:${sub4.indexOf(c)}`;
        return row(key, [{ s: `${c.size} ${c.edges} ${c.wgt} `, c: C.amb }, { s: `${c.k} `, c: C.cob }, c.nodes.join(' ')], 260, 195 + i * 50, { f: 'mono', fs: 20, c: C.ink }).objs; }),
    ], durs: [400, 1800] });

  const kept = [];
  MG.log.forEach((L, i) => {
    const c = L.c, vsC = L.vs >= 0 ? kept[L.vs] : null;
    const before = kept.slice();
    if (L.add) kept.push(c);
    const keptNow = kept.slice();
    S({ ch: 7, sub: 'overlap', title: L.add ? `Candidate ${i + 1}: new, so keep it` : `Candidate ${i + 1}: mostly seen, so drop it`, lines: [[461, 492]], focus: 474,
      text: L.add ? `{${c.nodes.join(', ')}} (k = ${c.k}) shares at most half its nodes with every cluster kept so far${before.length ? '' : ' (there are none yet)'}, so it's kept.`
        : `{${c.nodes.join(', ')}} shares ${L.same} nodes with the kept cluster {${vsC.nodes.join(', ')}}. That's more than ${H.c('|S| × OVERLAP')} = ${fmt(L.limit)}, so it's dropped. Only overlap with <i>one</i> earlier cluster counts. A new set may spread across several.`,
      phases: [() => {
        const out = graph(D, { v: 'corner', node: v => before.some(k => k.nodes.includes(v)) ? lit : {} });
        before.forEach((k, j) => out.push(...clRow(`k${k.nodes.join('_')}`, k, 90, 120 + j * 60, { meta: 'kept', metaCol: C.ok })));
        out.push(...clRow(`c${c.nodes.join('_')}`, c, 90, 120 + before.length * 60 + 70, { col: () => C.amb }));
        return out;
      }, () => {
        const out = graph(D, { v: 'corner', node: v => c.nodes.includes(v) ? { fill: L.add ? C.ok : C.hot, lab: C.bg } : before.some(k => k.nodes.includes(v)) ? lit : {}, edge: (a, b) => c.nodes.includes(a) && c.nodes.includes(b) ? { stroke: L.add ? C.ok : C.hot, sw: 2.5 } : {} });
        before.forEach((k, j) => out.push(...clRow(`k${k.nodes.join('_')}`, k, 90, 120 + j * 60, { meta: 'kept', metaCol: C.ok, col: v => vsC === k && c.nodes.includes(v) ? C.hot : C.ink })));
        out.push(...clRow(`c${c.nodes.join('_')}`, c, 90, 120 + before.length * 60 + 70, { col: v => vsC ? (vsC.nodes.includes(v) ? C.hot : C.amb) : C.ok, meta: L.add ? 'keep' : 'drop', metaCol: L.add ? C.ok : C.hot }));
        out.push(txt('ov:eq', L.add ? `overlap ≤ ${fmt(c.nodes.length * D.opt.overlap)} with every kept cluster` : `same = ${L.same}  >  ${c.nodes.length} × 0.5 = ${fmt(L.limit)}`, 90, 120 + before.length * 60 + 125, { f: 'math', fs: 26, fill: L.add ? C.ok : C.hot }));
        return out;
      }], durs: [900, 1500] });
  });

  const twin = all.find(c => c.size === 7 && c.nodes.includes(7));
  S({ ch: 7, title: 'An alternate that got dropped', lines: [[479, 487]], focus: 482,
    text: `${twin ? `{${twin.nodes.join(', ')}} has exactly the same size and edge count as the kept {0, …, 6}. Swapping nodes 6 and 7 gives a cluster of equal quality, and only the tie-break decided which one survived.` : ''} The comment on lines 479–486 describes this case and proposes printing such nodes as alternates ("6#7") one day.`,
    live: t => { const sw = Math.floor(t / 1.4) % 2, out = [];
      const inS = v => [0, 1, 2, 3, 4, 5].includes(v) || v === (sw ? 7 : 6);
      for (const [a, b] of D.EDGES) if (inS(a) && inS(b)) { const [x1, y1] = P(a, 'full'), [x2, y2] = P(b, 'full'); out.push({ t: 'line', x1, y1, x2, y2, stroke: C.ink, sw: 3.2 }); }
      [6, 7].forEach(v => { const [cx, cy] = P(v, 'full'); out.push({ t: 'circle', cx, cy, r: 24, fill: 'none', stroke: inS(v) ? C.amb : C.faint, sw: 3 }); });
      out.push({ t: 'text', s: sw ? '{0,1,2,3,4,5,7}  18 / 21' : '{0,1,2,3,4,5,6}  18 / 21', x: 940, y: 90, a: 'end', f: 'math', fs: 28, fill: C.amb });
      return out; },
    scene: () => [...graph(D, { v: 'full', node: v => [0, 1, 2, 3, 4, 5].includes(v) ? lit : {} }), txt('alt:l', '6 # 7', 500, 660, { a: 'middle', f: 'math', fs: 34, fill: C.amb })] });

  const finalLines = MG.kept.flatMap(c => [`${c.size} nodes, ${c.edges}/${choose(c.size, 2)} edges, ${+(100 * c.edges / choose(c.size, 2)).toPrecision(6)}% density from k${MG.lastK},`, `    nodeSet { ${c.nodes.join(' ')} }`]);
  S({ ch: 7, title: 'The report', lines: [[493, 513]], focus: 500,
    text: `Each kept cluster is printed as nodes, edges, density, k and members, then sorted by size and edge count. Two quirks: the k printed is the last line's k, not the cluster's own (${H.c('kk[i]')} holds that, and only ${H.c('-v')} shows it), and the third sort key ${H.c('-k 9n')} lands on the word "nodeSet", so it's always zero. The comment says "edge density, number of nodes, value of k". Exit status is the sum of BLANT's.`,
    scene: () => [...graph(D, { v: { s: .8, cx: 500, cy: 300 }, node: v => D.A.includes(v) ? lit : D.B.includes(v) ? { fill: C.cob, lab: C.bg } : {}, edge: (a, b) => D.A.includes(a) && D.A.includes(b) ? { stroke: C.ink, sw: 3 } : D.B.includes(a) && D.B.includes(b) ? { stroke: C.cob, sw: 3 } : {} }),
      ...finalLines.map((s, i) => txt(`fl:${i}`, s, 40, 520 + i * 36 + (i > 1 ? 18 : 0), { f: 'mono', fs: 20, fill: i < 2 ? C.ink : C.cob, enter: 'up', d: i * .12 }))] });

  S({ ch: 7, title: 'The whole pipe, in one breath', lines: [[1, 513]], focus: 194,
    text: `Sample graphlets for each k → keep the dense ones and tally them per node → rank → grow from the top seeds while the density holds → prune and strip → keep big, strong sets → drop exact repeats → merge across k and ED, dropping anything mostly seen before. Two communities, found by counting small pictures.`,
    scene: () => [...graph(D, { v: 'hero', node: v => D.A.includes(v) ? lit : D.B.includes(v) ? { fill: C.cob, lab: C.bg } : {}, edge: (a, b) => D.A.includes(a) && D.A.includes(b) ? { stroke: C.ink, sw: 3.4 } : D.B.includes(a) && D.B.includes(b) ? { stroke: C.cob, sw: 3.4 } : {} })] });

  return steps;
};
