# Architecture

## Design goals

1. **Correct, readable search code.** Each algorithm lives in its own file, mirrors the textbook pseudocode, and has no DOM code mixed in.
2. **Faithful visualisation.** What is shown is exactly what the algorithm did, including discarded duplicates and the frontier order.
3. **Zero build step.** Plain `<script>` files that run on GitHub Pages, from `file://`, and in Node (for the tests).

## Layers

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Pages        js/pages/home.js · solver.js · compare.js · algorithms.js     │  DOM, events, playback
├───────────────────────────────────────────────────────────────────────────┤
│ UI widgets   js/ui/board.js (AnimatedBoard, miniBoard) · puzzle-input.js   │  reusable components
│              charts.js (SVG line/bar) · layout.js (theme, nav, bindings)   │
├───────────────────────────────────────────────────────────────────────────┤
│ Algorithms   gbfs.js ★ · bfs.js · dfs.js · dls.js (DLS, IDDLS)             │  pure functions
│              best-first.js (A*, UCS) · registry.js (EP.solve, timing)      │  (problem, ctx) → result
├───────────────────────────────────────────────────────────────────────────┤
│ Core         puzzle.js · heuristics.js · priority-queue.js · search-context│  no DOM, Node-testable
└───────────────────────────────────────────────────────────────────────────┘
```

Every file attaches to one global namespace, `EP`. There are no ES modules because they do not load from `file://`.

## State representation

A state is a 9-character string such as `"283164705"`, read row by row with `0` as the blank.
Strings are immutable and hashable, so `Set` and `Map` lookups for the explored set and frontier are O(1).
`puzzle.successors(state)` uses a precomputed neighbour table per blank position and returns `{ state, action, tile }`, where `action` is the direction the **blank** moves.

## Algorithm contract

```js
function algorithm(problem, ctx) → result
// problem: { start, goal, heuristic(state) → number, depthLimit, maxDepth }
// ctx:     SearchContext (counters, limits, trace recorder)
```

All algorithms:
- are graph searches with an explored set,
- do the goal test when a node is **selected for expansion**,
- create every child through `ctx.makeNode()`, so *nodes generated* counts all of them, including duplicates that are later discarded,
- call `ctx.record({...})` once per expansion. With tracing off, `canRecord()` is false and nothing is stored.

`ctx.finish(status, goalNode)` walks parent pointers back to the root to build the solution path. `status` is one of `found | cutoff | failure | limit`.

### Frontier data structures

| Algorithm | Frontier | Ordering / tie-break |
|---|---|---|
| BFS | array + head index (O(1) dequeue) | FIFO |
| DFS, DLS, IDDLS | array as stack | LIFO; successors pushed in reverse so *Up* is tried first |
| GBFS | `MinHeap` | h(n), then node id (FIFO) |
| A* | `MinHeap` + lazy deletion | f(n), then h(n), then id |
| UCS | `MinHeap` + lazy deletion | g(n), then id |

`MinHeap.topK(k)` returns the k best entries without popping them. It walks the heap with a small auxiliary heap in O(k log k), and the Open List panel uses it.

### DLS / IDDLS detail

Pure tree-search DLS revisits states along every path, which grows exponentially. This implementation keeps, per iteration, the **shallowest depth** at which each state was reached. A state is pushed again only if it is reached at a strictly smaller depth. That removes cycles and redundant paths without losing any goal within the limit, so IDDLS still returns a shortest solution.

## Trace and playback

```
EP.solveForVisualisation(key, options)
 ├─ traced run   → result.steps[]   (one snapshot per expansion, capped at 3,000 + final step)
 └─ untraced run → result.timeMs    (fast runs repeated ~30 ms and averaged)

solver.js frames = [ ...steps.map(search), ...path.map(solution) ]
```

A snapshot holds the current node (with parent id and state), the generated successors with their status (`added`, `explored`, `in-frontier`, `replaced`), the first 12 frontier entries in pop order, the 12 most recently explored states, sizes, counters and the depth limit.

The solver's controls only move an index through `frames`:

| Control | Effect |
|---|---|
| Run | Recompute from the current inputs and start playback at frame 0 |
| Pause / Resume | Stop / restart the `setTimeout` loop |
| Next / Previous | Pause and move the index by ±1 (exact, because frames are precomputed) |
| Skip | Jump to the start of the solution, then to the end |
| Reset | Clear the result and show the initial state |
| Speed | 1–10, mapped to 1400 ms … 12 ms per frame; the tile animation duration follows |

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

`node tests/run-tests.js` loads the same browser files in Node and checks the puzzle model, the heuristics (h₁ = 4, h₂ = 5 on the assignment example), the heap, path legality for every algorithm, optimal-length agreement (BFS = UCS = IDDLS = A*) on 25 random puzzles, DLS cutoff behaviour, and that GBFS always expands the minimum-h frontier node.
