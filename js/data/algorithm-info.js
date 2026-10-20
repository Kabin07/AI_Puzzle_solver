/*
 * Algorithm documentation shown on the Algorithms page and in the Solver.
 * Notation: b = branching factor, d = depth of the shallowest solution,
 * m = maximum depth of the state space, ℓ = depth limit,
 * C* = optimal solution cost, ε = minimum step cost.
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  EP.algorithmInfo = {
    bfs: {
      summary: 'Expands nodes level by level using a FIFO queue. Finds the shortest solution, but stores every node of each level.',
      description:
        'Breadth-First Search is an uninformed strategy that expands the shallowest unexpanded node first. Every node at depth k is expanded before any node at depth k + 1, so the search spreads out from the initial state in uniform "rings".',
      principle: [
        'Put the initial node in a FIFO queue (the frontier).',
        'Remove the node at the front of the queue. If it is the goal, return its path.',
        'Otherwise add its state to the explored set and generate all successors.',
        'Append every successor that is not already explored or in the frontier to the back of the queue.',
        'Repeat until the goal is found or the queue is empty.',
      ],
      evaluation: 'Order of insertion (FIFO): shallowest first',
      advantages: [
        'Complete: always finds a solution if one exists (finite branching factor).',
        'Optimal for unit step costs, so it returns the minimum number of moves.',
        'Simple to implement and easy to reason about.',
      ],
      limitations: [
        'Memory grows exponentially because the whole frontier at depth d is stored.',
        'Explores many irrelevant states because it has no notion of direction towards the goal.',
        'Slow on deep solutions: the hardest 8-puzzles force it to explore almost the whole space.',
      ],
      time: 'O(b^d)',
      space: 'O(b^d)',
      complete: 'Yes',
      completeNote: 'if b is finite',
      optimal: 'Yes',
      optimalNote: 'when all step costs are equal (true for the 8-puzzle)',
    },
    dfs: {
      summary: 'Always expands the deepest node using a LIFO stack. Low memory in its tree-search form, but solutions are usually very long.',
      description:
        'Depth-First Search follows one branch of the search tree as deep as possible before backtracking to try the next alternative. The frontier is a LIFO stack, so the most recently generated node is expanded first.',
      principle: [
        'Push the initial node on a stack.',
        'Pop the top node. If it is the goal, return its path.',
        'Otherwise mark it explored and push its unexplored successors (first action on top).',
        'Continue from the newest node; when a branch is exhausted the search backtracks automatically.',
      ],
      evaluation: 'Order of insertion (LIFO): deepest first',
      advantages: [
        'Tree-search DFS needs only O(bm) memory: the current path plus unexpanded siblings.',
        'Can find a solution quickly if it happens to lie on an early branch.',
        'Simple recursive or stack-based implementation.',
      ],
      limitations: [
        'Not optimal: on the 8-puzzle it typically returns solutions tens of thousands of moves long.',
        'Tree-search DFS can loop forever. A graph-search version (used here) needs an explored set, which costs O(|S|) memory.',
        'Its performance depends heavily on the order in which actions are tried.',
      ],
      time: 'O(b^m)',
      space: 'O(bm) tree search · O(|S|) graph search',
      complete: 'Yes*',
      completeNote: 'graph search on a finite state space (as implemented); tree search is not complete',
      optimal: 'No',
      optimalNote: 'returns the first solution found, not the shortest',
    },
    dls: {
      summary: 'DFS that does not expand nodes beyond a fixed depth limit ℓ. This prevents infinite descent, but no solution is found if ℓ < d.',
      description:
        'Depth-Limited Search is depth-first search with a predetermined depth limit ℓ. Nodes at depth ℓ are treated as if they had no successors. This solves the infinite-path problem of DFS, but adds incompleteness when ℓ is smaller than the depth of the shallowest goal.',
      principle: [
        'Run DFS from the initial node.',
        'When a node at depth ℓ is popped, do not expand it; record that a cutoff occurred.',
        'Return the solution if the goal is reached within ℓ moves.',
        'Otherwise report cutoff (some nodes were cut off) or failure (the whole space was searched).',
      ],
      evaluation: 'LIFO order, restricted to depth ≤ ℓ',
      advantages: [
        'Never descends forever; the cost of each run is bounded by ℓ.',
        'Memory O(bℓ) in tree-search form.',
        'Useful when a bound on the solution depth is known (8-puzzle: at most 31 moves).',
      ],
      limitations: [
        'Incomplete when ℓ < d: the solution is simply not found.',
        'Not optimal when ℓ > d: it may return a longer path that lies on an earlier branch.',
        'Choosing a good ℓ requires knowledge of the problem.',
      ],
      time: 'O(b^ℓ)',
      space: 'O(bℓ)',
      complete: 'No',
      completeNote: 'only when ℓ ≥ d',
      optimal: 'No',
      optimalNote: 'not in general',
      implementationNote:
        'This implementation remembers the shallowest depth at which each state was reached and only revisits a state when it is reached at a smaller depth. That removes cycles while keeping every goal within ℓ reachable.',
    },
    iddls: {
      summary: 'Runs DLS with ℓ = 0, 1, 2, … until a solution appears. Optimal like BFS, with low memory like DFS.',
      description:
        'Iterative Deepening Depth-Limited Search (iterative deepening DFS) repeatedly runs depth-limited search with increasing limits. The first limit at which the goal is found equals the depth of the shallowest solution, so it combines the optimality and completeness of BFS with the modest memory needs of DFS.',
      principle: [
        'Set ℓ = 0.',
        'Run Depth-Limited Search with limit ℓ.',
        'If it returns a solution, stop. That solution is a shortest one.',
        'If it returns cutoff, increase ℓ by 1 and repeat. If it returns failure, no solution exists.',
      ],
      evaluation: 'LIFO order within each iteration; iterations by increasing ℓ',
      advantages: [
        'Complete and optimal for unit step costs, like BFS.',
        'Memory O(bd) in tree-search form, like DFS.',
        'Re-expanding shallow levels is cheap because most nodes are in the deepest level.',
      ],
      limitations: [
        'Re-generates the upper levels of the tree in every iteration, so it expands more nodes than BFS.',
        'Does not use any heuristic information.',
        'Slower than BFS in wall-clock time on small spaces such as the 8-puzzle.',
      ],
      time: 'O(b^d)',
      space: 'O(bd)',
      complete: 'Yes',
      completeNote: 'if b is finite',
      optimal: 'Yes',
      optimalNote: 'for unit step costs',
    },
    ucs: {
      summary: 'Expands the node with the lowest path cost g(n). With unit move costs it behaves like BFS.',
      description:
        'Uniform-Cost Search orders the frontier by the path cost g(n) of each node and always expands the cheapest one. It is the uninformed counterpart of A* (A* with h(n) = 0) and is optimal for any non-negative step costs.',
      principle: [
        'Insert the initial node into a priority queue keyed by g(n).',
        'Pop the node with the smallest g(n). If it is the goal, return it (goal test on expansion).',
        'Expand it and insert each successor. If a cheaper path to a state already in the frontier is found, replace that entry.',
        'Repeat until the goal is popped.',
      ],
      evaluation: 'f(n) = g(n)',
      advantages: ['Optimal for any step costs ≥ ε > 0.', 'Complete.', 'Generalises BFS to weighted problems.'],
      limitations: [
        'Uninformed: explores in all directions equally.',
        'Memory grows exponentially, like BFS.',
        'Priority-queue overhead makes it slower than BFS when all costs are equal.',
      ],
      time: 'O(b^(1+⌊C*/ε⌋))',
      space: 'O(b^(1+⌊C*/ε⌋))',
      complete: 'Yes',
      completeNote: 'if every step cost ≥ ε > 0',
      optimal: 'Yes',
      optimalNote: '',
    },
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
    astar: {
      summary: 'Expands the node with the lowest f(n) = g(n) + h(n). Optimal with an admissible, consistent heuristic.',
      description:
        'A* Search evaluates nodes by combining g(n), the cost to reach the node, and h(n), the estimated cost from the node to the goal. f(n) = g(n) + h(n) estimates the cost of the cheapest solution through n. With an admissible and consistent heuristic, A* is complete, optimal and optimally efficient among such algorithms.',
      principle: [
        'Insert the initial node with f = h(start) into a priority queue.',
        'Pop the node with the smallest f(n). If it is the goal, return it (goal test on expansion).',
        'Expand it. For each successor compute g = g(parent) + 1, h, and f = g + h.',
        'Insert new successors. If a cheaper path to a state already in the frontier is found, replace it.',
        'Repeat until the goal is popped.',
      ],
      evaluation: 'f(n) = g(n) + h(n)',
      advantages: [
        'Optimal and complete with an admissible (tree search) or consistent (graph search) heuristic.',
        'Optimally efficient: no other optimal algorithm using the same heuristic expands fewer nodes.',
        'Expands far fewer nodes than BFS/UCS with a good heuristic.',
      ],
      limitations: [
        'Keeps every generated node in memory, so space is its bottleneck on large problems.',
        'Running time still grows exponentially with the error of the heuristic.',
        'Needs a good admissible heuristic, which is not always easy to design.',
      ],
      time: 'O(b^d) worst case (depends on heuristic error)',
      space: 'O(b^d)',
      complete: 'Yes',
      completeNote: 'with finite b and step costs ≥ ε > 0',
      optimal: 'Yes',
      optimalNote: 'with an admissible / consistent heuristic (both heuristics here are)',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
