/*
 * Breadth-First Search (graph search).
 * Frontier: FIFO queue. Expands the shallowest node first, so the first solution
 * found has the fewest moves. Goal test on expansion (same as every algorithm here,
 * so node counts are comparable).
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  function bfs(problem, ctx) {
    const { start, goal } = problem;

    const queue = [];
    let head = 0; // index of the queue front (avoids O(n) Array.shift)
    const inFrontier = new Set();
    const explored = new Set();

    const snapshot = (kind, node, successors, note) =>
      ctx.record({
        kind,
        current: node,
        successors,
        note,
        frontier: queue.slice(head, head + ctx.previewSize),
        frontierSize: queue.length - head,
        exploredSize: explored.size,
      });

    queue.push(ctx.makeNode(start, null, null, 0, null, null));
    inFrontier.add(start);
    ctx.notePeak(1);

    while (head < queue.length) {
      if (ctx.budgetExceeded) return ctx.finish('limit', null);

      const node = queue[head];
      queue[head++] = undefined; // release the reference
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

      for (const s of EP.puzzle.successors(node.state)) {
        const child = ctx.makeNode(s.state, node, s.action, node.g + 1, null, null);
        let status;
        if (explored.has(s.state)) status = 'explored';
        else if (inFrontier.has(s.state)) status = 'in-frontier';
        else {
          queue.push(child);
          inFrontier.add(s.state);
          status = 'added';
        }
        if (succ) succ.push(ctx.successorInfo(child, status, s.tile));
      }

      ctx.notePeak(queue.length - head + explored.size);
      if (tracing) snapshot('expand', node, succ);
    }

    if (ctx.canRecord(true)) snapshot('fail', null, [], 'Frontier is empty: no solution');
    return ctx.finish('failure', null);
  }

  EP.search.bfs = bfs;
})(typeof window !== 'undefined' ? window : globalThis);
