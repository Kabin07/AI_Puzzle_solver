/*
 * Algorithm registry and the single entry point EP.solve().
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  EP.algorithms = {
    bfs: { key: 'bfs', name: 'Breadth-First Search', short: 'BFS', type: 'Uninformed', informed: false, run: EP.search.bfs, frontierKind: 'FIFO queue' },
    dfs: { key: 'dfs', name: 'Depth-First Search', short: 'DFS', type: 'Uninformed', informed: false, run: EP.search.dfs, frontierKind: 'LIFO stack' },
    dls: { key: 'dls', name: 'Depth-Limited Search', short: 'DLS', type: 'Uninformed', informed: false, run: EP.search.dls, frontierKind: 'LIFO stack', params: ['depthLimit'] },
    iddls: { key: 'iddls', name: 'Iterative Deepening DLS', short: 'IDDLS', type: 'Uninformed', informed: false, run: EP.search.iddls, frontierKind: 'LIFO stack', params: ['maxDepth'] },
    ucs: { key: 'ucs', name: 'Uniform-Cost Search', short: 'UCS', type: 'Uninformed', informed: false, run: EP.search.ucs, frontierKind: 'Priority queue on g(n)', usesCost: true },
    gbfs: { key: 'gbfs', name: 'Greedy Best-First Search', short: 'GBFS', type: 'Informed', informed: true, run: EP.search.gbfs, frontierKind: 'Priority queue on h(n)' },
    astar: { key: 'astar', name: 'A* Search', short: 'A*', type: 'Informed', informed: true, run: EP.search.astar, frontierKind: 'Priority queue on f(n) = g(n) + h(n)' },
  };
  EP.ALGORITHM_ORDER = ['bfs', 'dfs', 'dls', 'iddls', 'ucs', 'gbfs', 'astar'];

  /**
   * Run one algorithm.
   * options: { start, goal, heuristic: 'manhattan'|'misplaced', depthLimit, maxDepth, trace, maxExpansions }
   */
  EP.solve = function solve(key, options) {
    const algo = EP.algorithms[key];
    if (!algo) throw new Error(`Unknown algorithm: ${key}`);
    const heuristicKey = options.heuristic || 'manhattan';
    const problem = {
      start: options.start,
      goal: options.goal,
      heuristicKey,
      heuristic: algo.informed ? EP.createHeuristic(heuristicKey, options.goal) : null,
      depthLimit: options.depthLimit == null ? 10 : options.depthLimit,
      maxDepth: options.maxDepth == null ? 31 : options.maxDepth,
    };
    const ctx = new EP.SearchContext({
      trace: !!options.trace,
      maxExpansions: options.maxExpansions,
      maxTraceSteps: options.maxTraceSteps,
      previewSize: options.previewSize,
    });
    const t0 = now();
    const result = algo.run(problem, ctx);
    result.timeMs = now() - t0;
    result.algorithm = key;
    result.heuristic = algo.informed ? heuristicKey : null;
    result.problem = { start: problem.start, goal: problem.goal, depthLimit: problem.depthLimit, maxDepth: problem.maxDepth };
    return result;
  };

  /**
   * Traced run for visualisation + an untraced run for an honest execution time.
   */
  EP.solveForVisualisation = function solveForVisualisation(key, options) {
    const traced = EP.solve(key, Object.assign({}, options, { trace: true }));
    const timed = EP.timedRun(key, options);
    traced.timeMs = timed.timeMs;
    traced.timingRuns = timed.timingRuns;
    return traced;
  };

  /**
   * Untraced run with timing. Browsers round performance.now() (often to 0.1 ms),
   * so searches faster than 20 ms are repeated for ~30 ms and the average is reported.
   */
  EP.timedRun = function timedRun(key, options) {
    const opts = Object.assign({}, options, { trace: false });
    const result = EP.solve(key, opts);
    result.timingRuns = 1;
    if (result.timeMs >= 20) return result;
    let runs = 0;
    const t0 = now();
    while (now() - t0 < 30 && runs < 500) {
      EP.solve(key, opts);
      runs++;
    }
    result.timeMs = (now() - t0) / runs;
    result.timingRuns = runs;
    return result;
  };

  EP.formatTime = function formatTime(ms) {
    if (ms < 1) return `${ms.toFixed(3)} ms`;
    if (ms < 10) return `${ms.toFixed(2)} ms`;
    if (ms < 1000) return `${ms.toFixed(1)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  EP.describeStatus = function describeStatus(result) {
    switch (result.status) {
      case 'found':
        return 'Solution found';
      case 'cutoff':
        return result.algorithm === 'dls'
          ? `Not found within depth limit ${result.depthLimit}`
          : `Not found up to depth ${result.finalLimit}`;
      case 'limit':
        return 'Not found (expansion limit reached)';
      default:
        return 'Not found (search space exhausted)';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
