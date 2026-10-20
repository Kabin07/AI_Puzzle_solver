/*
 * Best-first graph search with path-cost updates, used by
 *   A* Search            : f(n) = g(n) + h(n)
 *   Uniform-Cost Search  : f(n) = g(n)
 *
 * Unlike GBFS, the priority depends on g(n), so when a cheaper path to a state
 * already in the frontier is found the frontier entry is replaced. Old heap
 * entries are left in place and skipped when popped ("lazy deletion").
 * The goal test is done on expansion, which is what makes A* / UCS optimal.
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  function bestFirstSearch(problem, ctx, evaluate, useHeuristic) {
    const { start, goal } = problem;
    const h = useHeuristic ? problem.heuristic : () => null;

    // lower f first, then lower h (closer to goal), then FIFO
    const frontier = new EP.MinHeap((a, b) => a.f - b.f || (a.h || 0) - (b.h || 0) || a.id - b.id);
    const inFrontier = new Map(); // state -> best node waiting in the frontier
    const explored = new Set();

    const isLive = (n) => inFrontier.get(n.state) === n;
    const snapshot = (kind, node, successors, note) =>
      ctx.record({
        kind,
        current: node,
        successors,
        note,
        frontier: frontier.topK(ctx.previewSize * 3).filter(isLive).slice(0, ctx.previewSize),
        frontierSize: inFrontier.size,
        exploredSize: explored.size,
      });

    const hr = h(start);
    const root = ctx.makeNode(start, null, null, 0, hr, evaluate(0, hr));
    frontier.push(root);
    inFrontier.set(start, root);
    ctx.notePeak(1);

    while (frontier.size > 0) {
      if (ctx.budgetExceeded) return ctx.finish('limit', null);

      const node = frontier.pop();
      if (!isLive(node)) continue; // superseded by a cheaper path
      inFrontier.delete(node.state);

      if (node.state === goal) {
        if (ctx.canRecord(true)) snapshot('goal', node, [], `Goal reached: g(n) = ${node.g}`);
        return ctx.finish('found', node);
      }

      explored.add(node.state);
      ctx.markExplored(node.state);
      ctx.expanded++;

      const tracing = ctx.canRecord();
      const succ = tracing ? [] : null;

      for (const s of EP.puzzle.successors(node.state)) {
        const g = node.g + 1;
        const hc = h(s.state);
        const child = ctx.makeNode(s.state, node, s.action, g, hc, evaluate(g, hc));
        let status;
        const existing = inFrontier.get(s.state);
        if (explored.has(s.state)) {
          status = 'explored';
        } else if (existing) {
          if (child.g < existing.g) {
            frontier.push(child);
            inFrontier.set(s.state, child);
            status = 'replaced';
          } else {
            status = 'in-frontier';
          }
        } else {
          frontier.push(child);
          inFrontier.set(s.state, child);
          status = 'added';
        }
        if (succ) succ.push(ctx.successorInfo(child, status, s.tile));
      }

      ctx.notePeak(inFrontier.size + explored.size);
      if (tracing) snapshot('expand', node, succ);
    }

    if (ctx.canRecord(true)) snapshot('fail', null, [], 'Frontier is empty: no solution');
    return ctx.finish('failure', null);
  }

  EP.search.astar = (problem, ctx) => bestFirstSearch(problem, ctx, (g, h) => g + h, true);
  EP.search.ucs = (problem, ctx) => bestFirstSearch(problem, ctx, (g) => g, false);
})(typeof window !== 'undefined' ? window : globalThis);
