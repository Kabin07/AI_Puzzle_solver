/*
 * Algorithm registry and the single entry point EP.solve().
 * This project implements the assigned algorithm only: Greedy Best-First Search.
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  EP.algorithms = {
    gbfs: {
      key: 'gbfs',
      name: 'Greedy Best-First Search',
      short: 'GBFS',
      type: 'Informed',
      informed: true,
      run: EP.search.gbfs,
      frontierKind: 'Priority queue on h(n)',
    },
  };
  EP.ALGORITHM_ORDER = ['gbfs'];

  /**
   * Run GBFS.
   * options: { start, goal, heuristic: 'manhattan'|'misplaced', trace, maxExpansions, maxTraceSteps, previewSize }
   */
  EP.solve = function solve(key, options) {
    const algo = EP.algorithms[key];
    if (!algo) throw new Error(`Unknown algorithm: ${key}`);
    const heuristicKey = options.heuristic || 'manhattan';
    const problem = {
      start: options.start,
      goal: options.goal,
      heuristicKey,
      heuristic: EP.createHeuristic(heuristicKey, options.goal),
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
    result.heuristic = heuristicKey;
    result.problem = { start: problem.start, goal: problem.goal };
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
      case 'limit':
        return 'Not found (expansion limit reached)';
      default:
        return 'Not found (search space exhausted)';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
