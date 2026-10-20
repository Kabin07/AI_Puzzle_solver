/*
 * ★ Greedy Best-First Search (GBFS)  — assigned algorithm (No. 6)
 *
 * Evaluation function:  f(n) = h(n)
 * The frontier is a min-priority queue ordered by h(n); ties are broken
 * first-in-first-out (smaller node id first) so runs are deterministic.
 *
 * Graph-search version (AIMA, Russell & Norvig):
 *
 *   frontier ← priority queue containing root,  explored ← ∅
 *   loop
 *     if frontier is empty → return failure
 *     n ← POP(frontier)                         // node with the lowest h(n)
 *     if GOAL-TEST(n.state) → return SOLUTION(n)
 *     add n.state to explored
 *     for each action a in ACTIONS(n.state)
 *       child ← CHILD-NODE(n, a)               // g = n.g + 1, h = h(child.state)
 *       if child.state ∉ explored and ∉ frontier → INSERT(child, frontier)
 *
 * Because h depends only on the state, a duplicate already in the frontier has
 * exactly the same priority, so it is simply discarded. The goal test happens
 * when a node is popped (selected for expansion).
 *
 * Complete on the finite 8-puzzle state space (graph search), NOT optimal:
 * it chases whatever looks closest to the goal and ignores the cost so far g(n).
 */
(function (root) {
  'use strict';
  const EP = root.EP;

  function gbfs(problem, ctx) {
    const { start, goal, heuristic: h } = problem;

    const frontier = new EP.MinHeap((a, b) => a.h - b.h || a.id - b.id);
    const inFrontier = new Map(); // state -> node currently waiting in the frontier
    const explored = new Set(); // closed list

    const snapshot = (kind, node, successors, note) =>
      ctx.record({
        kind,
        current: node,
        successors,
        note,
        frontier: frontier.topK(ctx.previewSize),
        frontierSize: frontier.size,
        exploredSize: explored.size,
      });

    const hRoot = h(start);
    const root = ctx.makeNode(start, null, null, 0, hRoot, hRoot);
    frontier.push(root);
    inFrontier.set(start, root);
    ctx.notePeak(1);

    while (frontier.size > 0) {
      if (ctx.budgetExceeded) return ctx.finish('limit', null);

      const node = frontier.pop(); // lowest h(n)
      inFrontier.delete(node.state);

      if (node.state === goal) {
        if (ctx.canRecord(true)) snapshot('goal', node, [], `Goal reached: h(n) = ${node.h}`);
        return ctx.finish('found', node);
      }

      explored.add(node.state);
      ctx.markExplored(node.state);
      ctx.expanded++;

      const tracing = ctx.canRecord();
      const succ = tracing ? [] : null;

      for (const s of EP.puzzle.successors(node.state)) {
        const hc = h(s.state);
        const child = ctx.makeNode(s.state, node, s.action, node.g + 1, hc, hc); // f(n) = h(n)
        let status;
        if (explored.has(s.state)) {
          status = 'explored';
        } else if (inFrontier.has(s.state)) {
          status = 'in-frontier';
        } else {
          frontier.push(child);
          inFrontier.set(s.state, child);
          status = 'added';
        }
        if (succ) succ.push(ctx.successorInfo(child, status, s.tile));
      }

      ctx.notePeak(frontier.size + explored.size);
      if (tracing) snapshot('expand', node, succ);
    }

    if (ctx.canRecord(true)) snapshot('fail', null, [], 'Frontier is empty: no solution');
    return ctx.finish('failure', null);
  }

  EP.search.gbfs = gbfs;
})(typeof window !== 'undefined' ? window : globalThis);
