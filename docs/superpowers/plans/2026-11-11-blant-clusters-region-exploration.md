# blant-clusters Region Exploration (-X) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORE-style region-exploration refinement (`-X N`) to the community builder in `scripts/blant-clusters.sh` so clusters get larger at the same edge density without slowing the script down.

**Architecture:** After each seed's existing BFS, post-processing and trim-to-ED, a new refinement phase runs inside the same `hawk` program: fill (add best outside node while density holds), then up to N region rounds (add a connected region over real edges, trim worst members back to ED, fill, keep only if better). Best-outside and worst-member lookups use lazy bucket stacks built once per seed, so nothing is scanned repeatedly and the main BFS loop is untouched.

**Tech Stack:** bash, gawk 5.1 via libwayne's `hawk` wrapper (`MakeEmptySet`, `MIN`, `MAX`, `choose`, `ASSERT`, `WARN`, `randsort`), BLANT binary `./blant`.

**Spec:** `docs/superpowers/specs/2026-11-11-blant-clusters-region-exploration-design.md`

## Global Constraints

- Option text, verbatim: `-X N: CORE refinement: up to N region-exploration rounds per community (default 20; 0 = off)`. Accept `-X N` and `-XN`.
- `-X 0` output must be byte-identical to the pre-change script for the same seed and samples.
- Every reported cluster has density >= ED.
- Stop a seed's refinement after 5 consecutive failed rounds (internal constant `CORE_STALL=5`).
- Region size: random integer in [2, max(2, int(|S|/2))], capped at 200.
- A round succeeds if S is larger, or the same size with more edges; otherwise S is restored exactly.
- `-M` (maxClus) is never exceeded.
- No statements added inside the main BFS `while(QueueLength("Q")>0)` loop, and `IntoS`/`RemoveFromS` keep their current bodies.
- All changes to the script are in the usage text, the option parser, and the second `hawk` program (the community builder). Sampling, pre-sort and de-duplication stages are not touched.
- Node names are strings. FlyWire IDs are 18 digits: never compare or index node names numerically in new code.
- Tests and benchmarks run from the repo root (the script reads `canon_maps/` relative to cwd).
- Benchmark data lives outside the repo in `/home/jeremyz4/Development/blant-bench/` (`samples/<net>/blant<k>.out`, `results/base/`, `run-baseline.sh`). Nothing from it is committed except the one small sample file Task 1 copies.
- Do not download or run the reference script from the `nimyensuda/BLANT` fork. Its diff is quoted in the spec's reasoning only.

## Review Focus

1. Weighted network (`-w`, `.elw`): `wgtEdgeCount` must stay equal to the sum of in-cluster edge weights through adds, drops and undo. Test in Task 3.
2. `-M` reached mid-region or mid-fill: cluster size must stop at exactly the cap. Test in Task 3.
3. A rejected round must restore S, `edgeCount` and `wgtEdgeCount` exactly; a cluster must never come out smaller or sparser than it went in. Test in Task 3 (invariant check mode).
4. Tiny or isolated clusters (2 members, no outside neighbors): refinement must terminate with no error and leave S unchanged. Test in Task 3.
5. Long numeric node IDs (18 digits differing only in the last digits): members must stay distinct. Test in Task 3.

## File Structure

- Modify `scripts/blant-clusters.sh`: usage line, defaults, option parsing, new awk functions and one call site in the community builder.
- Create `regression-tests/blant-clusters-core/test.sh`: regression test, run by `./regression-test-all.sh` from the repo root, exits 0 on success.
- Create `regression-tests/blant-clusters-core/samples/blant4.out`: saved BLANT samples for `networks/CElegans.el`, k=4, seed 1 (about 72 KB), so the test needs no sampling.
- Create `regression-tests/blant-clusters-core/golden-X0-ed0.5.out` and `golden-X0-ed0.125.out`: pre-change outputs.
- Create `/home/jeremyz4/Development/blant-bench/compare.sh` (outside the repo): old-vs-new table.

---

### Task 1: Golden outputs and the `-X` option (no behavior yet)

**Files:**
- Create: `regression-tests/blant-clusters-core/samples/blant4.out`, `golden-X0-ed0.5.out`, `golden-X0-ed0.125.out`, `test.sh`
- Modify: `scripts/blant-clusters.sh` (usage block near line 30, defaults near line 85, option `case` near line 113)

**Interfaces:**
- Produces: shell variables `CORE_ITERS` (default 20) and `CORE_STALL=5`; test helper functions in `test.sh` used by later tasks: `run_clusters OPTS ED` (prints cluster lines to stdout, using `-D $TEST_DIR/samples -r 1 ./blant 4 ED networks/CElegans.el`, stderr discarded, temp dir via `-T` under `mktemp -d`), and `fail MSG` (prints and sets `exitCode=1`).

- [ ] **Step 1: Create the samples and goldens from the unmodified script**

```bash
mkdir -p regression-tests/blant-clusters-core/samples
cp /home/jeremyz4/Development/blant-bench/samples/CElegans/blant4.out regression-tests/blant-clusters-core/samples/
T=`mktemp -d`
for ed in 0.5 0.125; do
  ./scripts/blant-clusters.sh -T $T -D regression-tests/blant-clusters-core/samples -r 1 ./blant 4 $ed networks/CElegans.el \
    > regression-tests/blant-clusters-core/golden-X0-ed$ed.out 2>/dev/null
done
wc -l regression-tests/blant-clusters-core/golden-X0-ed*.out
```

Expected: 120 lines for ed0.5 and 14 for ed0.125 (matches `blant-bench/results/base/CElegans-k4-*`). Run it a second time into a temp file and `cmp` to confirm the output is repeatable; if it is not, stop and report.

- [ ] **Step 2: Write `test.sh` with the off-switch test (failing)**

Follow `regression-tests/CompressedFiles/*.sh` for shape (`TEST_DIR=`pwd`/regression-tests/blant-clusters-core`, die if missing). Tests in this step:

```bash
# test_X0_identical: -X 0 and -X0 reproduce the pre-change output byte for byte
for ed in 0.5 0.125; do
  run_clusters "-X 0" $ed | cmp -s - $TEST_DIR/golden-X0-ed$ed.out || fail "-X 0 differs from golden at ED $ed"
  run_clusters "-X0"  $ed | cmp -s - $TEST_DIR/golden-X0-ed$ed.out || fail "-X0 differs from golden at ED $ed"
done
```

- [ ] **Step 3: Run it; verify it fails**

Run: `bash regression-tests/blant-clusters-core/test.sh; echo exit=$?`
Expected: `exit=1`, because the script dies with `unknown option '-X'` and produces no output.

- [ ] **Step 4: Add the option**

In `scripts/blant-clusters.sh`: add the usage line (verbatim from Global Constraints) after the `-M largest` line; add `CORE_ITERS=20` and `CORE_STALL=5` next to the other defaults; add `-X) CORE_ITERS="$2"; shift 2;;` and `-X[0-9]*) CORE_ITERS=...; shift 1;;` in the same style as `-M`. After the option loop, `die` unless `CORE_ITERS` is a non-negative integer.

- [ ] **Step 5: Run the test; verify it passes**

Run: `bash regression-tests/blant-clusters-core/test.sh; echo exit=$?`
Expected: `exit=0`. Also `./scripts/blant-clusters.sh -X abc ./blant 4 0.5 networks/CElegans.el` must exit non-zero with a message naming `-X`.

- [ ] **Step 6: Commit**

```bash
chmod 755 regression-tests/blant-clusters-core/test.sh
git add regression-tests/blant-clusters-core scripts/blant-clusters.sh
git commit -m "blant-clusters: add -X option and regression goldens (no behavior change)"
```

---

### Task 2: Fill step with bucket stacks

**Files:**
- Modify: `scripts/blant-clusters.sh` (community-builder `hawk`: `BEGIN` block, new functions placed after `RemoveFromS`, call site between the `WARN(ed >= ...)` block and `Slen=length(S);` near line 398)
- Test: `regression-tests/blant-clusters-core/test.sh`

**Interfaces:**
- Consumes: `CORE_ITERS`, `CORE_STALL` from Task 1; existing globals `S`, `edge`, `edgesIntoS`, `wgtIntoS`, `edgeCount`, `wgtEdgeCount`, `Sorder`.
- Produces (awk, all state global and reset per seed by `CoreInit`):
  - `BEGIN` variables: `ED`, `maxClus`, `coreIters`, `coreStall`.
  - `CoreInit()`: sets `PROCINFO["sorted_in"]=""`; `cN=length(S)`; builds `mem[1..cN]`, `memPos[v]`; pushes every member onto the in-stacks and every non-member key of `edgesIntoS` with value > 0 onto the out-stacks; sets `maxOut`, `minIn`; `nLog=0; logging=0`.
  - `CoreAdd(u)`: adds u to S with the same accounting as the BFS (`edgeCount += edgesIntoS[u]`, `wgtEdgeCount += wgtIntoS[u]`), appends to `mem`, calls `CoreInto(u,1)`, pushes u on the in-stack, logs `(u,+1)` if `logging`.
  - `CoreDrop(v)`: inverse; swap-deletes from `mem`; calls `CoreInto(v,-1)`; pushes v on the out-stack if `edgesIntoS[v]>0`; logs `(v,-1)` if `logging`.
  - `CoreInto(u,d)`: like `IntoS` but, for each neighbor w, also pushes w onto the stack matching its new value (in-stack if `w in S`, else out-stack) and updates `maxOut`/`minIn`.
  - `CoreBestOut()`: returns the outside node with the highest `edgesIntoS`, or `""`.
  - `CoreWorstIn()`: returns the member with the lowest `edgesIntoS`.
  - `CoreValid()`: `cN<2 || edgeCount/(cN*(cN-1)/2) >= ED`.
  - `CoreFill()`: while `cN<maxClus`, take `b=CoreBestOut()`; stop if `b==""` or `(edgeCount+edgesIntoS[b])/((cN+1)*cN/2) < ED`; else `CoreAdd(b)`.
  - `CoreRefine()`: in this task = `CoreInit(); CoreFill();` then restore `PROCINFO["sorted_in"]` to its value on entry.

**Bucket stacks (the one algorithm the signatures do not determine):** `outStk[d][i]` / `outTop[d]` and `inStk[d][i]` / `inTop[d]` are append-only stacks of node names per degree d. An entry is *stale* if the node's current `edgesIntoS` is not d or its membership no longer matches the stack. `CoreBestOut` walks `maxOut` downward, popping stale tops, and returns the first valid top without popping it. `CoreWorstIn` does the same upward from `minIn`. Any push at a higher (out) or lower (in) degree moves the pointer back. Never use `for(x in bucket)` to pick one element: gawk materializes the whole key list first.

- [ ] **Step 1: Write the failing tests**

Add to `test.sh` helpers: `stats FILE` printing `count biggest top10sum minDensity` from output lines of the form `N nodes, e/m edges, D% density ...` (density recomputed as `e/m`, not parsed from the rounded percent).

```bash
# test_density_floor: no cluster below ED with refinement on
# test_not_smaller: biggest cluster and top-10 size sum are >= golden
# test_repeatable: same seed twice gives identical output
for ed in 0.5 0.125; do
  run_clusters "" $ed > $TMP/new-$ed.out
  read c big top minD <<< "`stats $TMP/new-$ed.out`"
  read gc gbig gtop gminD <<< "`stats $TEST_DIR/golden-X0-ed$ed.out`"
  awk "BEGIN{exit !($minD >= $ed)}"        || fail "cluster below ED $ed: $minD"
  [ $big -ge $gbig ] && [ $top -ge $gtop ] || fail "ED $ed: biggest $big (golden $gbig), top10 $top (golden $gtop)"
  [ $top -gt $gtop ]                       || fail "ED $ed: refinement enlarged nothing"
  run_clusters "" $ed | cmp -s - $TMP/new-$ed.out || fail "ED $ed: not repeatable with -r 1"
done
```

- [ ] **Step 2: Run; verify the new tests fail**

Expected: `refinement enlarged nothing` for both EDs (the option exists but does nothing); `-X 0` tests still pass.

- [ ] **Step 3: Implement the functions and the call site**

Call site, immediately before `Slen=length(S);` near line 398:

```awk
if(coreIters>0 && length(S)>=2 && length(S)<maxClus && edgeCount/choose(length(S),2)>=ED) CoreRefine();
```

Before the call, record `sorderN` = the cluster size at the end of the BFS `while` loop (one assignment placed after the loop, not inside it). After `CoreRefine()`, append to `Sorder[++sorderN]` every member that was not in S before refinement, so the existing `started` marking covers grown clusters.

- [ ] **Step 4: Run; verify all tests pass**

Run: `bash regression-tests/blant-clusters-core/test.sh; echo exit=$?`
Expected: `exit=0`. If the only failure is `refinement enlarged nothing` at one ED (baseline clusters there
already sit at the threshold, so fill alone has no room), confirm that by temporarily printing
pre/post sizes per seed to stderr, keep the strict check for the other ED, and
re-enable it for both in Task 3. A `not_smaller` or density failure is a real bug: fix it.

- [ ] **Step 5: Commit**

```bash
git add scripts/blant-clusters.sh regression-tests/blant-clusters-core/test.sh
git commit -m "blant-clusters: -X fill step, add best outside node while density holds"
```

---

### Task 3: Region rounds, undo, and the edge-case tests

**Files:**
- Modify: `scripts/blant-clusters.sh` (community-builder `hawk`)
- Test: `regression-tests/blant-clusters-core/test.sh` (plus small generated networks written to the test's temp dir)

**Interfaces:**
- Consumes: everything Task 2 produces.
- Produces:
  - `CoreUndo()`: replays the log backwards (`+1` entries dropped, `-1` entries re-added) with `logging=0`, then `nLog=0`.
  - `CoreStart()`: returns a random outside node adjacent to S, or `""`. Pick a random member `mem[1+int(rand()*cN)]`, reservoir-sample uniformly among its neighbors not in S; try up to 3 members.
  - `CoreNext()`: returns the next region node, or `""`. Sample up to 3 nodes from the region built so far; among their neighbors not in S, return the one with the highest `edgesIntoS`, ties by reservoir sampling. (Region nodes are already in S when this runs, so `edgesIntoS` counts S plus region.)
  - `CoreRound()`: returns 1 on success, 0 on failure. Sets `before=cN; eBefore=edgeCount; nLog=0; logging=1`; `x=CoreStart()`, fail if `""`; target `R=2+int(rand()*(MIN(200,MAX(2,int(cN/2)))-1))`; `CoreAdd` x then `CoreNext()` nodes until R reached, `""` returned, or `cN==maxClus`; `while(cN>1 && !CoreValid()) CoreDrop(CoreWorstIn())`; `CoreFill()`; success if `cN>before || (cN==before && edgeCount>eBefore)`, else `CoreUndo()`; `logging=0`.
  - `CoreRefine()` becomes: `CoreInit(); CoreFill(); no=0; for(it=1; it<=coreIters && no<coreStall; it++) if(CoreRound()) no=0; else ++no;` then restore `sorted_in`.
  - Check mode: when the environment variable `BLANT_CLUSTERS_CHECK` is non-empty (read once in `BEGIN` via `ENVIRON`), after `CoreRefine()` assert with `ASSERT` that `edgeCount==InducedEdges(edge,S)`, that `wgtEdgeCount` equals the summed weights of in-cluster edges, that density >= ED, that `length(S)<=maxClus`, and that size and `edgeCount` are each >= their pre-refinement values (size strictly, or equal size with edges >=).

- [ ] **Step 1: Write the failing tests**

Add a generator to `test.sh` for CORE's two-core example, written to `$TMP/twocore.el`: a 12-clique `a1..a12`; a 6-clique `b1..b6`; each `bi` joined to `a1` only; 12 satellites `s1..s12`, each joined to exactly three of `a1..a12`. Generate its samples once in the test with `./blant -p0.9L -q -r 1 -k4 -sEBE -mcg $TMP/twocore.el > $TMP/tc/blant4.out`.

```bash
# test_two_core: with region rounds the best cluster at ED 0.5 has more nodes than with -X 0
big0=`run_on twocore "-X 0" 0.5 | stats - | cut -d' ' -f2`
bigX=`run_on twocore ""     0.5 | stats - | cut -d' ' -f2`
[ $bigX -gt $big0 ] || fail "two-core: -X did not enlarge the best cluster ($bigX vs $big0)"

# test_invariants (Review Focus 3): check mode passes on CElegans at both EDs and on twocore
BLANT_CLUSTERS_CHECK=1 run_clusters "" 0.5   >/dev/null || fail "invariant check failed at 0.5"
BLANT_CLUSTERS_CHECK=1 run_clusters "" 0.125 >/dev/null || fail "invariant check failed at 0.125"

# test_max_size (Review Focus 2): -M 15 caps every cluster at 15
[ `run_clusters "-M 15" 0.125 | stats - | cut -d' ' -f2` -le 15 ] || fail "-M 15 exceeded"

# test_weighted (Review Focus 1): CElegans with a third column of weights in {0.6,0.8,1.0} (weight chosen by
# line number mod 3), as $TMP/cw.elw with -w; samples generated in the test; check mode must pass
BLANT_CLUSTERS_CHECK=1 run_on cw "-w" 0.5 >/dev/null || fail "weighted invariant check failed"

# test_tiny (Review Focus 4): a network of two disjoint triangles and one isolated edge runs with -m 2,
# exits 0, and every reported cluster is one of the triangles or the edge
# test_long_ids (Review Focus 5): twocore with every node renamed to 72057594062128797N-style 18-digit IDs
# (same 15-digit prefix, distinct suffix) gives the same cluster sizes as twocore
```

`run_on NAME OPTS ED` is `run_clusters` generalized to a network and samples directory under `$TMP`. `run_clusters` must return the script's exit status so a failed `ASSERT` fails the test.

- [ ] **Step 2: Run; verify the new tests fail**

Expected: at least `test_two_core` fails (fill alone cannot cross from one core to the other), and check mode is not yet implemented.

- [ ] **Step 3: Implement `CoreUndo`, `CoreStart`, `CoreNext`, `CoreRound`, the loop in `CoreRefine`, and check mode**

- [ ] **Step 4: Run; verify all tests pass**

Run: `bash regression-tests/blant-clusters-core/test.sh; echo exit=$?`
Expected: `exit=0`. If `test_two_core` still fails, do not weaken it: print the clusters found with `-v` and work out whether the region never reaches the second core (start/next selection) or reaches it and is trimmed away (trim order).

- [ ] **Step 5: Commit**

```bash
git add scripts/blant-clusters.sh regression-tests/blant-clusters-core/test.sh
git commit -m "blant-clusters: -X region-exploration rounds with undo and invariant check mode"
```

---

### Task 4: Skip refinement of clusters already refined

**Files:**
- Modify: `scripts/blant-clusters.sh` (call site and `CoreRefine` wrapper only)
- Test: `regression-tests/blant-clusters-core/test.sh`

**Interfaces:**
- Consumes: `CoreRefine()`.
- Produces: `CoreKey()` returning the members of S joined in `@ind_str_asc` order; arrays `coreSeenMembers[key]` (space-joined result members), `coreSeenEdges[key]`, `coreSeenWgt[key]`; counters `coreHits`, `coreRuns`, printed to stderr at `END` when `-v` is given, as `CORE refinement: R runs, H cache hits`.

Behavior: before refining, compute the key of the pre-refinement S. On a hit, replace S with the cached members and set `edgeCount`/`wgtEdgeCount` from the cache, without calling `CoreRefine`. On a miss, refine and store the result. The `Sorder` append from Task 2 applies in both cases.

- [ ] **Step 1: Write the failing test**

```bash
# test_cache_reported: verbose run reports the counters, and hits + runs > 0
run_clusters_stderr "-v" 0.125 | grep -q "CORE refinement: [0-9]* runs, [0-9]* cache hits" || fail "no cache counters with -v"
# test_cache_keeps_invariants: check mode still passes (cached results are valid clusters)
BLANT_CLUSTERS_CHECK=1 run_clusters "" 0.125 >/dev/null || fail "invariant check failed with cache"
```

Check mode on a cache hit verifies the same invariants against the cached S.

- [ ] **Step 2: Run; verify it fails** (no counters line yet)

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run all tests; verify they pass, including `-X 0` identity**

- [ ] **Step 5: Record the hit rate and decide**

Run with `-v` on `HI-union` k=4 at ED 0.25 from saved samples and note runs, hits and builder seconds with and without the cache (temporarily bypass it with an environment variable `BLANT_CLUSTERS_NOCACHE=1`, kept in the script as a debugging switch). If hits are under 5% of seeds on this network, keep the code but say so in the commit message; do not remove it without asking Jeremy.

- [ ] **Step 6: Commit**

```bash
git add scripts/blant-clusters.sh regression-tests/blant-clusters-core/test.sh
git commit -m "blant-clusters: reuse -X refinement for identical starting clusters"
```

---

### Task 5: Benchmark, tune, report

**Files:**
- Modify: `/home/jeremyz4/Development/blant-bench/run-baseline.sh` (outside repo)
- Create: `/home/jeremyz4/Development/blant-bench/compare.sh`, `/home/jeremyz4/Development/blant-bench/REPORT.md` (outside repo)
- Modify: `scripts/blant-clusters.sh` only if tuning changes a constant
- Modify: `docs/superpowers/specs/2026-11-11-blant-clusters-region-exploration-design.md` (append a "Results" section)

**Interfaces:**
- Consumes: saved samples in `blant-bench/samples/`, baselines in `blant-bench/results/base/` (cells: AThaliana, CElegans, DMelanogaster, HI-union at k=4 and k=6; HSapiens k=4 and k=6 and FlyWire k=4 when their sampling has finished; EDs 0.5, 0.25, 0.125, 0.0625).
- Produces: `results/X20/` with the same file naming; `compare.sh A B` printing one row per cell: clusters, biggest, median of ten biggest, distinct nodes covered, minimum density (from `e/m`), builder seconds, peak KB, for label A and label B side by side.

- [ ] **Step 1: Make the driver take extra options**

`run-baseline.sh` passes the contents of the environment variable `EXTRA` to `blant-clusters.sh` before `./blant`. Confirm `EXTRA="-X 0" run-baseline.sh X0 "4" networks/CElegans.el` reproduces `results/base/CElegans-k4-*.out` byte for byte (`cmp`).

- [ ] **Step 2: Run the new builder on every finished baseline cell**

Run with label `X20` (default options). Run at most 6 cells at a time; the machine is shared. Record which cells were skipped because their baseline sampling had not finished.

- [ ] **Step 3: Write `compare.sh` and produce the table**

Run: `/home/jeremyz4/Development/blant-bench/compare.sh base X20`

- [ ] **Step 4: Check the pass criteria**

- Minimum density >= ED in every X20 cell.
- Biggest and median-of-top-ten >= baseline in most cells; list every cell where either is smaller.
- Builder seconds: X20 vs base per cell. Compute end-to-end change as (X20 builder − base builder) / (sampling seconds from `samples/<net>/blant<k>.seconds`, or 432 s for HI-union k=4 and 805 s for HI-union k=6 total wall, measured earlier) and list every cell above 2%.

- [ ] **Step 5: Tune if a criterion fails, within these bounds**

Allowed knobs, in this order: region size cap (200 down to 50 or 20), region size upper fraction (|S|/2 down to |S|/4), number of members sampled in `CoreNext` (3). Do not change `-X`'s default of 20 or `CORE_STALL=5`. Re-run only the failing cells plus CElegans and AThaliana k=4 as a control, then the full set once. If speed still fails after tuning, stop and report the table to Jeremy with the options; do not cut quality to pass.

- [ ] **Step 6: Reduced-sampling experiment (report only, no default change)**

For CElegans, AThaliana and DMelanogaster at k=6, generate samples with `./blant -p0.5L -q -r 1 -k6 -sEBE -mcg` into `samples-p0.5/<net>/`, timing each. Run the new builder on them at the four EDs (label `X20-p0.5`) and compare against `base`: sampling seconds saved, and biggest / median-of-top-ten relative to baseline.

- [ ] **Step 7: Write the report and append results to the spec**

`REPORT.md`: the full compare table, the list of regressing cells, time deltas, the cache hit rate from Task 4, the reduced-sampling numbers, any constants changed and why, and cells not run. Append a short "Results" section to the spec with the headline numbers and a pointer to `REPORT.md`.

- [ ] **Step 8: Run the regression test one last time and commit**

```bash
bash regression-tests/blant-clusters-core/test.sh; echo exit=$?   # expect exit=0
git add scripts/blant-clusters.sh regression-tests/blant-clusters-core docs/superpowers
git commit -m "blant-clusters: tune -X region exploration from benchmark; record results"
```
