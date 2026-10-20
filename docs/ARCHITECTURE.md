# Architecture

## Design goals

1. **Correct, readable search code.** Greedy Best-First Search lives in its own file, mirrors the textbook pseudocode, and has no DOM code mixed in.
2. **Faithful visualisation.** What is shown is exactly what the algorithm did, including discarded duplicates and the frontier order.
3. **Zero build step.** Plain `<script>` files that run on GitHub Pages, from `file://`, and in Node (for the tests).

## Layers

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Pages        js/pages/home.js · solver.js · compare.js · algorithms.js     │  DOM, events, playback
├───────────────────────────────────────────────────────────────────────────┤
│ UI widgets   js/ui/board.js (AnimatedBoard, miniBoard) · puzzle-input.js   │  reusable components
│              charts.js (SVG bars/line) · layout.js (navigation, theme)     │
├───────────────────────────────────────────────────────────────────────────┤
│ Algorithm    gbfs.js ★ Greedy Best-First Search                            │  pure function
│              registry.js (EP.solve, timing)                                │  (problem, ctx) → result
├───────────────────────────────────────────────────────────────────────────┤
│ Core         puzzle.js · heuristics.js · priority-queue.js · search-context│  no DOM, Node-testable
└───────────────────────────────────────────────────────────────────────────┘
```

Every file attaches to one global namespace, `EP`. There are no ES modules because they do not load from `file://`.

## State representation

A state is a 9-character string such as `"283164705"`, read row by row with `0` as the blank.
Strings are immutable and hashable, so `Set` and `Map` lookups for the explored set and frontier are O(1).
`puzzle.successors(state)` uses a precomputed neighbour table per blank position and returns `{ state, action, tile }`, where `action` is the direction the **blank** moves.

## Greedy Best-First Search (`js/algorithms/gbfs.js`)

```js
function gbfs(problem, ctx) → result
// problem: { start, goal, heuristic(state) → number }
// ctx:     SearchContext (counters, limits, trace recorder)
```

- **Frontier:** `MinHeap` ordered by h(n), ties broken by node id (first in, first out), plus a `Map` state → node for O(1) "already in frontier" checks.
- **Explored:** a `Set` of expanded states (graph search).
- **Goal test:** when a node is popped (selected for expansion).
- **Successors:** a child already explored or already in the frontier is discarded. Because h depends only on the state, a duplicate in the frontier has the same priority, so there is nothing to update.
- **Evaluation:** every node stores g (moves so far), h, and f = h.
- Every child is created through `ctx.makeNode()`, so *nodes generated* counts all of them, including discarded duplicates. `ctx.record({...})` stores one snapshot per expansion when tracing is on.

`ctx.finish(status, goalNode)` walks parent pointers back to the root to build the solution path. `status` is `found`, `failure` or `limit` (an expansion safety cap).

`MinHeap.topK(k)` returns the k best frontier entries without popping them. It walks the heap with a small auxiliary heap in O(k log k), and the Open List panel uses it.

## Trace and playback

```
EP.solveForVisualisation('gbfs', options)
 ├─ traced run   → result.steps[]   (one snapshot per expansion, capped at 3,000 + final step)
 └─ untraced run → result.timeMs    (fast runs repeated ~30 ms and averaged)

solver.js frames = [ ...steps.map(search), ...path.map(solution) ]
```

A snapshot holds the current node (with parent id and state), the generated successors with their status (`added`, `explored`, `in-frontier`), the first 12 frontier entries in pop order, the 12 most recently explored states, sizes and counters.

The solver's controls only move an index through `frames`:

| Control | Effect |
|---|---|
| Run | Recompute from the current inputs and start playback at frame 0 |
| Pause / Resume | Stop / restart the `setTimeout` loop |
| Next / Previous | Pause and move the index by ±1 (exact, because frames are precomputed) |
| Skip | Jump to the start of the solution, then to the end |
| Reset | Clear the result and show the initial state |
| Speed | 1–10, mapped to 1400 ms … 12 ms per frame; the tile animation duration follows |

## Heuristic comparison (`js/pages/compare.js`)

GBFS runs with Manhattan Distance and with Misplaced Tiles on the same puzzle (table and charts), then on a batch of fully random solvable puzzles. The batch reports averages, maxima and how often each heuristic needed fewer expansions. The work is split into small chunks so the page stays responsive.

## Animation

`AnimatedBoard` creates one DOM element per tile, plus one for the blank, once. Showing a state only changes each tile's `transform: translate(col·100%, row·100%)`, so CSS transitions slide the moved tile and the blank swaps places smoothly. Tiles already in their goal position turn green, and the tile that just moved gets an outline.

## Metrics

| Metric | Definition |
|---|---|
| Nodes generated | every node created, root included |
| Nodes expanded | nodes whose successors were generated |
| Max search depth | deepest generated node |
| Execution time | untraced run measured with `performance.now()` |
| Memory (approx.) | peak (frontier + explored) nodes × 120 bytes (node object, 9-char string, hash entry). Low < 1,000 nodes, Medium < 20,000, High above |

## Testing

`node tests/run-tests.js` loads the same browser files in Node. It checks the puzzle model and input validation, the heuristics (h₁ = 4, h₂ = 5 on the assignment example; admissible; h₁ ≤ h₂), the heap, and GBFS itself:
- every expansion pops the minimum-h frontier node,
- f(n) = h(n),
- legal paths on 40 random puzzles,
- never shorter than the true optimum,
- the known 63-vs-23-move non-optimal case,
- counters, trace capping, and identical results whether tracing is on or off.

A small BFS inside the test file serves only as a reference for optimal path lengths.
