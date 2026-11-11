# Region exploration in blant-clusters: design

Date: 2026-11-11. Branch: `blant-clusters/region-exploration`. Status: awaiting approval.

## Intent

`scripts/blant-clusters.sh` finds clusters that are smaller than they could be at a given edge density (ED).
CORE (https://github.com/pieterhv/CORE) finds larger ones at the same density, and its region exploration step
is the main reason. Bring that step into the community builder so clusters overall get larger, without making
the script slower.

## Goals

- Larger clusters overall at the same ED, on most benchmark cells (network, k, ED).
- Every reported cluster still has density >= ED.
- End-to-end wall time no worse than today.

## Non-goals

- Changing BLANT sampling, its defaults, or the pre-sort and de-duplication stages.
- Porting CORE's swap local search, tabu lists, or fixed-size mode.
- Changing the output format.

## Anti-goals

- Larger clusters bought by dipping below ED.
- A change that alters results when the feature is switched off.

## What was measured first

Seed 1, default options. BLANT sampling is about 97% of wall time; the builder is the rest.

| Network | k | ED | Wall | Builder | Clusters | Biggest |
|---|---|---|---|---|---|---|
| CElegans | 4 | 0.6 | 11.6s | <1s | 52 | 10 |
| CElegans | 6 | 0.6 | 18.0s | <1s | 54 | 8 |
| HI-union | 4 | 0.6 | 432s | ~9s | 1132 | 53 |

So the builder has room for extra work, and no builder change can produce a large end-to-end speedup.

## Approaches considered

1. **Region rounds inside the builder, when a seed's search stalls. Chosen by Jeremy.** Larger clusters also
   suppress more later seeds through the existing `started` marking.
2. **Separate refinement pass over the final clusters.** Touches fewer clusters and is easier to isolate, but
   grown clusters overlap again, so de-duplication would have to run twice, and seed suppression gains nothing.
3. **Approach 1 plus less sampling.** The only route to a large speedup, since sampling dominates. Not adopted
   as a default because it changes every result; its premise gets benchmarked (see Benchmark).

## Design

All changes are in the second `hawk` program (the community builder) and the option parser.

### Where it runs

Per seed, after the existing BFS, the low-degree post-processing, and the trim back to ED, and before the
size / edge-mean check that prints the cluster. At that point S is a valid cluster with density >= ED.

### Growth phase (new)

Candidates come from the real edge list (`edge[][]`), not from BLANT's graphlet neighbors. The maintained
`edgesIntoS` / `wgtIntoS` arrays (CORE's `degree_to_S`) drive every choice, via the existing `IntoS` and
`RemoveFromS`.

1. **Fill.** While the best outside node (highest `edgesIntoS`) can be added with density staying >= ED, add
   it. This is CORE's "valid quasi-clique, so add a node" step; region exploration alone keeps size fixed in
   CORE, so growth needs it. (Claude's call.)
2. **Region round.**
   - Start node: a random node outside S that has at least one edge into S. CORE picks from the whole graph;
     on sparse networks that almost always lands somewhere unrelated. (Claude's call.)
   - Grow the region to its target size by repeatedly adding the outside neighbor of the region with the most
     edges into S plus region, ties broken at random.
   - Add the whole region to S.
   - Trim: remove the lowest in-cluster-degree node until density >= ED.
   - Run Fill again.
   - Keep the result only if S is larger than before the round; otherwise restore the previous S.
3. Repeat region rounds until a set number in a row fail to enlarge S.

Sizing and budget:

- At most N region rounds per community, N from `-X` (Jeremy's decision; default 20).
- Stop early after 5 consecutive failed rounds, as the reference implementation does. Internal constant.
- Region size: random between 2 and max(2, |S|/2), capped at 200 (CORE's cap). Claude's call, to be tuned on
  the benchmark; the reference uses 2 to about 9.
- A round counts as a success if S is larger, or the same size with more edges (as in the reference).
- `-M` (largest cluster size) is respected throughout.

### Reference implementation and why it is slow

Jeremy supplied a working version for reference: commit `a9ce3c3` in `github.com/nimyensuda/BLANT`
("implemented region exploration from CORE"). It gives better results than today's script but a worse runtime.
It is written against a different revision of the script, so it is a reference for behavior, not a patch to
apply. Its result quality is the bar to match or beat; its runtime is what this design must avoid.

Where its time goes, per seed and per round:

- `coreGrow` scans every key of `edgesIntoS` (the whole boundary, plus stale zero entries) for each node added.
- `coreWorst` scans all of S for each node dropped.
- The member list is rebuilt from S at the start of every round.
- A random-order sort of a member's whole graphlet-neighbor list is done to pick one outside neighbor.
- Every seed is refined, including the many seeds that produce a cluster already seen.

What this design does instead:

- Keep outside nodes and members in buckets keyed by edges-into-S, built once when refinement of a seed starts
  and updated as nodes move, so "best outside node" and "worst member" are found without full scans.
- Keep a member array with swap-delete, so picking a random member is constant time.
- Pick random neighbors by index rather than by sorting.
- Skip refinement when the pre-refinement cluster is identical to one already refined in this run, and reuse
  that result.
- No bookkeeping is added to the main BFS loop, so `-X 0` costs nothing.

### Things that stay consistent

- Weighted networks: `wgtEdgeCount` is maintained by the same add/remove paths; the `-emt` check is unchanged.
- `Sorder`: nodes kept from an accepted round are appended, so the `started` marking covers grown clusters.
- Randomness: uses awk `rand()`, so `-r SEED` still makes runs repeatable.
- Edge prediction (`-P`) is untouched.

### Option

`-X N`: CORE refinement: up to N region-exploration rounds per community (default 20; 0 = off). Accepts
`-X N` and `-XN`. (Jeremy's decision, same as the reference.) `-X 0` disables the whole growth phase and must
give output identical to today's script for the same seed. (Claude's call.)

## Benchmark

Networks: `networks/{AThaliana,CElegans,DMelanogaster,HI-union,HSapiens}.el` and
`/extra/wayne2/src/bionets/BLANT/networks/FlyWire-Max-Clique-Challenge.el`.
EDs: 0.5, 0.25, 0.125, 0.0625 (plus 0.6 as a spot check). k: 4 and 6 (4 only for FlyWire). Seed 1.

BLANT samples are generated once per (network, k) and kept in `/home/jeremyz4/Development/blant-bench/samples/`
(outside the repo), then reused through `-D` for every ED and for both old and new builder. Baseline results
are in `/home/jeremyz4/Development/blant-bench/results/base/`; the driver is `run-baseline.sh` in that folder.

Reported per cell, old vs new: number of clusters, biggest cluster, median size of the ten biggest, distinct
nodes covered, minimum density, builder time and memory.

Pass criteria:

- Biggest cluster and median-of-top-ten are >= baseline in most cells, and never smaller by more than noise.
- No cluster below ED.
- `-X 0` output is byte-identical to the baseline.
- Cluster sizes match or beat the reference implementation's on the same samples, if Jeremy runs it or allows
  it to be run (it was not run while writing this design).
- Builder time added is small against sampling time for that (network, k), so end-to-end time is unchanged
  within run-to-run noise.

Also reported, without changing any default: the same cells with reduced sampling (`-n`/`-p`) and region
exploration on, to show whether approach 3's speedup is available.

## Left to the builder

- Exact data structure for finding the best outside node cheaply on large clusters (FlyWire at low ED).
- Tuning region size and the failed-round limit from benchmark results.
- Whether to compare the biggest cluster against a CORE run on one or two networks as a reference.

## Known oddity, not addressed

FlyWire node IDs are 18-digit integers; the script's numeric node comparisons and numeric member sort already
lose precision on them. Existing behavior, out of scope here.
