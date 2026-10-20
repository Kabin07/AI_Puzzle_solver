/*
 * Depth-Limited Search (DLS) and Iterative Deepening DLS (IDDLS).
 *
 * DLS is DFS that never expands a node at depth == limit. This implementation
 * remembers the shallowest depth at which each state was reached during the
 * current iteration, and only revisits a state when it is reached at a
 * strictly smaller depth. That removes cycles and redundant paths without
 * missing any goal within the limit, and keeps each iteration bounded by
 * the size of the state space.
 *
 * Result status:
 *   'found'   – goal reached within the limit
 *   'cutoff'  – no goal found, but some nodes were cut off by the limit
 *   'failure' – no goal and nothing was cut off (the whole space was searched)
 *
 * IDDLS runs DLS with limit = 0, 1, 2, … until a solution is found. The first
 * solution found is a shortest one, so it is optimal for unit step costs.
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  function depthLimited(problem, ctx, limit, iterationLabel) {
    const { start, goal } = problem;

    const stack = [];
    const openDepth = new Map(); // state -> depth of its live frontier entry
    const closed = new Map(); // state -> shallowest depth at which it was expanded
    let cutoff = false;

    const isLive = (n) => openDepth.get(n.state) === n.depth;
    const snapshot = (kind, node, successors, note) =>
      ctx.record({
        kind,
        current: node,
        successors,
        note,
        limit,
        frontier: stack
          .slice(-ctx.previewSize * 3)
          .reverse()
          .filter(isLive)
          .slice(0, ctx.previewSize),
        frontierSize: openDepth.size,
        exploredSize: closed.size,
      });

    const rootNode = ctx.makeNode(start, null, null, 0, null, null);
    stack.push(rootNode);
    openDepth.set(start, 0);
    ctx.notePeak(1);
    if (iterationLabel && ctx.canRecord()) {
      snapshot('iteration', rootNode, [], iterationLabel);
    }

    while (stack.length > 0) {
      if (ctx.budgetExceeded) return { status: 'limit', node: null };

      const node = stack.pop();
      if (!isLive(node)) continue; // a shallower copy of this state superseded it
      openDepth.delete(node.state);

      if (node.state === goal) {
        if (ctx.canRecord(true)) snapshot('goal', node, [], `Goal reached at depth ${node.depth} (limit ${limit})`);
        return { status: 'found', node };
      }

      if (node.depth >= limit) {
        cutoff = true;
        if (ctx.canRecord()) snapshot('cutoff', node, [], `Depth limit ${limit} reached: node not expanded`);
        continue;
      }

      closed.set(node.state, node.depth);
      ctx.markExplored(node.state);
      ctx.expanded++;

      const tracing = ctx.canRecord();
      const succ = tracing ? [] : null;
      const toPush = [];
      const d = node.depth + 1;

      for (const s of EP.puzzle.successors(node.state)) {
        const child = ctx.makeNode(s.state, node, s.action, node.g + 1, null, null);
        const c = closed.get(s.state);
        const o = openDepth.get(s.state);
        let status;
        if (c !== undefined && c <= d) status = 'explored';
        else if (o !== undefined && o <= d) status = 'in-frontier';
        else {
          status = c !== undefined || o !== undefined ? 'replaced' : 'added';
          toPush.push(child);
          openDepth.set(s.state, d);
        }
        if (succ) succ.push(ctx.successorInfo(child, status, s.tile));
      }
      for (let i = toPush.length - 1; i >= 0; i--) stack.push(toPush[i]);

      ctx.notePeak(stack.length + closed.size);
      if (tracing) snapshot('expand', node, succ);
    }

    return { status: cutoff ? 'cutoff' : 'failure', node: null };
  }

  function dls(problem, ctx) {
    const limit = Math.max(0, problem.depthLimit | 0);
    const res = depthLimited(problem, ctx, limit, null);
    if (res.status !== 'found' && ctx.canRecord(true)) {
      ctx.record({
        kind: 'fail',
        limit,
        note:
          res.status === 'cutoff'
            ? `No solution within depth limit ${limit}`
            : res.status === 'limit'
              ? 'Expansion limit reached'
              : 'Search space exhausted: no solution',
      });
    }
    return ctx.finish(res.status, res.node, { depthLimit: limit });
  }

  function iddls(problem, ctx) {
    const maxDepth = Math.max(0, problem.maxDepth == null ? 31 : problem.maxDepth | 0);
    for (let limit = 0; limit <= maxDepth; limit++) {
      ctx.clearRecentExplored();
      const res = depthLimited(problem, ctx, limit, `Iteration ${limit + 1}: depth limit = ${limit}`);
      if (res.status === 'found') return ctx.finish('found', res.node, { iterations: limit + 1, finalLimit: limit });
      if (res.status === 'limit' || res.status === 'failure') {
        if (ctx.canRecord(true)) ctx.record({ kind: 'fail', limit, note: res.status === 'limit' ? 'Expansion limit reached' : 'Search space exhausted: no solution' });
        return ctx.finish(res.status, null, { iterations: limit + 1, finalLimit: limit });
      }
    }
    if (ctx.canRecord(true)) ctx.record({ kind: 'fail', limit: maxDepth, note: `No solution up to maximum depth ${maxDepth}` });
    return ctx.finish('cutoff', null, { iterations: maxDepth + 1, finalLimit: maxDepth });
  }

  EP.search.dls = dls;
  EP.search.iddls = iddls;
})(typeof window !== 'undefined' ? window : globalThis);
