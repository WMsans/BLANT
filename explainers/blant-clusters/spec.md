# Spec · blant-clusters.sh visual explainer

## What it is
A single-page HTML/CSS/JS explainer of `scripts/blant-clusters.sh`. Part 1 covers the concept and philosophy of the algorithm.
Part 2 is a detailed, line-by-line, animated walk-through in the style of 3Blue1Brown: continuous morphs, math that
emerges from the geometry, and objects that persist from one step to the next instead of cutting between slides.

## Audience
BLANT developers and network-science students. They read bash/awk, but need the *why* behind each heuristic.

## Core messages
1. Philosophy: dense communities give themselves away statistically. Random k-graphlet samples that are *dense*
   pile up on the nodes inside communities. So: sample, count, sort, then grow from the most "graphlet-popular" seeds.
2. Pipeline: BLANT -mcg (parallel per k) → awk#1 filter dense graphlets & aggregate per node → sort -gr →
   awk#2 greedy BFS growth with density check → sort → awk#3 exact-duplicate removal → merge across k×ED with overlap filter.
3. awk#2 details: minClus p-value heuristic; neighbor admission (visited / later in sorted order / highRelClusCount);
   density test with 0.95 leeway; misses budget; post-prune (mean−3σ, mode/3); strip-until-dense; acceptance
   (size, edge mean); "started" marking of the first (1−OVERLAP) of Sorder.
4. Final merge: discard a new cluster if > OVERLAP of it lies in any ONE earlier cluster.

## Format (shared by all directions)
Web page, desktop-first at 1440×900, readable down to phones. Section 2 is step-driven (keyboard/scroll/scrubber);
every animated state is a pure function of step+t, so it can be scrubbed.

## Assumptions (user not asked; marked)
- A: the audience reads code, so real script lines are quoted verbatim with line numbers.
- A: a hand-built toy graph (14 nodes, two communities, one bridge) carries the whole explainer.
- A: no audio, no video export. It's an interactive page, not a film.
