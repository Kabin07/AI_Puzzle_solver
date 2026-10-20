/*
 * Depth-First Search (graph search).
 * Frontier: LIFO stack. Always expands the deepest node. The explored set makes
 * it complete on the finite 8-puzzle space, but the solution it returns is
 * usually very long (far from optimal).
 * Successors are pushed in reverse so the first action (Up) is tried first.
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  function dfs(problem, ctx) {
    const { start, goal } = problem;

    const stack = [];
    const inFrontier = new Set();
    const explored = new Set();

    const snapshot = (kind, node, successors, note) =>
      ctx.record({
        kind,
        current: node,
        successors,
        note,
        frontier: stack.slice(-ctx.previewSize).reverse(), // top of stack first
        frontierSize: stack.length,
        exploredSize: explored.size,
      });

    stack.push(ctx.makeNode(start, null, null, 0, null, null));
    inFrontier.add(start);
    ctx.notePeak(1);

    while (stack.length > 0) {
      if (ctx.budgetExceeded) return ctx.finish('limit', null);

      const node = stack.pop();
      inFrontier.delete(node.state);

      if (node.state === goal) {
        if (ctx.canRecord(true)) snapshot('goal', node, [], `Goal reached at depth ${node.depth}`);
        return ctx.finish('found', node);
      }

      explored.add(node.state);
      ctx.markExplored(node.state);
      ctx.expanded++;

      const tracing = ctx.canRecord();
      const succ = tracing ? [] : null;
      const toPush = [];

      for (const s of EP.puzzle.successors(node.state)) {
        const child = ctx.makeNode(s.state, node, s.action, node.g + 1, null, null);
        let status;
        if (explored.has(s.state)) status = 'explored';
        else if (inFrontier.has(s.state)) status = 'in-frontier';
        else {
          toPush.push(child);
          inFrontier.add(s.state);
          status = 'added';
        }
        if (succ) succ.push(ctx.successorInfo(child, status, s.tile));
      }
      for (let i = toPush.length - 1; i >= 0; i--) stack.push(toPush[i]);

      ctx.notePeak(stack.length + explored.size);
      if (tracing) snapshot('expand', node, succ);
    }

    if (ctx.canRecord(true)) snapshot('fail', null, [], 'Frontier is empty: no solution');
    return ctx.finish('failure', null);
  }

  EP.search.dfs = dfs;
})(typeof window !== 'undefined' ? window : globalThis);
