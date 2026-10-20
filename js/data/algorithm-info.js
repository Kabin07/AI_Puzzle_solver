/*
 * Algorithm documentation shown on the Algorithm Description page and in the Solver.
 * Only Greedy Best-First Search (the assigned algorithm) is implemented; the other
 * entries hold just the textbook properties shown in the theory overview table.
 * Notation: b = branching factor, d = depth of the shallowest solution,
 * m = maximum depth of the state space, ℓ = depth limit,
 * C* = optimal solution cost, ε = minimum step cost.
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  EP.algorithmInfo = {
    gbfs: {
      summary: 'Expands the node that looks closest to the goal by h(n). Very fast and memory-light in practice, but not optimal.',
      description:
        'Greedy Best-First Search is an informed search strategy that tries to expand the node that appears closest to the goal, on the grounds that this is likely to lead to a solution quickly. It evaluates nodes using only the heuristic function, f(n) = h(n), and ignores the cost g(n) already spent to reach the node.',
      principle: [
        'Compute h(start) and insert the initial node into a priority queue ordered by h(n).',
        'Pop the node with the smallest h(n) (ties broken first-in-first-out). If it is the goal, return its path.',
        'Add the state to the explored set and generate every successor, computing h for each.',
        'Insert successors that are neither explored nor already in the frontier.',
        'Repeat. The search is "greedy" because each choice depends only on the estimated distance to the goal.',
      ],
      evaluation: 'f(n) = h(n)',
      advantages: [
        'Usually reaches the goal after very few expansions with a good heuristic (Manhattan distance).',
        'Much less time and memory than uninformed search on typical instances.',
        'Simple: only one priority queue and one explored set are needed.',
      ],
      limitations: [
        'Not optimal: by ignoring g(n) it can follow a misleading path and return a longer solution than necessary.',
        'Tree-search GBFS is incomplete (it can loop); the graph-search version used here is complete on the finite 8-puzzle.',
        'Worst-case time and space are still exponential, O(b^m), when the heuristic is misleading.',
        'Its quality depends heavily on the heuristic: Misplaced Tiles is much weaker than Manhattan Distance.',
      ],
      time: 'O(b^m) worst case',
      space: 'O(b^m) worst case',
      complete: 'Yes*',
      completeNote: 'graph search in a finite state space (as implemented); tree search is not complete',
      optimal: 'No',
      optimalNote: 'ignores the path cost g(n)',
      assigned: true,
    },

    // ---- Theory only (not implemented in this project) ----
    bfs: { evaluation: 'FIFO queue: shallowest first', time: 'O(b^d)', space: 'O(b^d)', complete: 'Yes', optimal: 'Yes' },
    dfs: { evaluation: 'LIFO stack: deepest first', time: 'O(b^m)', space: 'O(bm)', complete: 'No', optimal: 'No' },
    dls: { evaluation: 'LIFO stack, depth ≤ ℓ', time: 'O(b^ℓ)', space: 'O(bℓ)', complete: 'No', optimal: 'No' },
    iddls: { evaluation: 'DLS with ℓ = 0, 1, 2, …', time: 'O(b^d)', space: 'O(bd)', complete: 'Yes', optimal: 'Yes' },
    ucs: { evaluation: 'f(n) = g(n)', time: 'O(b^(1+⌊C*/ε⌋))', space: 'O(b^(1+⌊C*/ε⌋))', complete: 'Yes', optimal: 'Yes' },
    astar: { evaluation: 'f(n) = g(n) + h(n)', time: 'O(b^d) worst case', space: 'O(b^d)', complete: 'Yes', optimal: 'Yes' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
