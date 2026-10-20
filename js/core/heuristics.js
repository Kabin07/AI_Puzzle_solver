/*
 * Heuristic functions h(n) for the 8-puzzle.
 * Both are admissible (never overestimate) and consistent, and the blank is never counted.
 * Each `create(goal)` precomputes goal positions and returns a fast h(state) function.
 */
(function (root) {
  'use strict';
  const EP = (root.EP = root.EP || {});
  const SIZE = 3;

  /** goalPos[tile] = index of that tile in the goal state */
  function goalPositions(goal) {
    const pos = new Array(9);
    for (let i = 0; i < 9; i++) pos[goal.charCodeAt(i) - 48] = i;
    return pos;
  }

  const HEURISTICS = {
    manhattan: {
      key: 'manhattan',
      name: 'Manhattan Distance',
      formula: 'h₂(n) = Σ over tiles t ( |row(t) − row_goal(t)| + |col(t) − col_goal(t)| )',
      description:
        'Sum of horizontal and vertical distances of every tile from its goal square. Each move shifts one tile by one square, so it never overestimates. It dominates Misplaced Tiles (h₂ ≥ h₁).',
      create(goal) {
        const pos = goalPositions(goal);
        return function manhattan(state) {
          let d = 0;
          for (let i = 0; i < 9; i++) {
            const t = state.charCodeAt(i) - 48;
            if (t === 0) continue;
            const g = pos[t];
            d += Math.abs(((i / SIZE) | 0) - ((g / SIZE) | 0)) + Math.abs((i % SIZE) - (g % SIZE));
          }
          return d;
        };
      },
    },
    misplaced: {
      key: 'misplaced',
      name: 'Misplaced Tiles',
      formula: 'h₁(n) = number of tiles (excluding the blank) not in their goal position',
      description:
        'Counts the tiles that are out of place. Every misplaced tile needs at least one move, so it is admissible, but it is less informed than Manhattan Distance.',
      create(goal) {
        return function misplaced(state) {
          let d = 0;
          for (let i = 0; i < 9; i++) {
            if (state[i] !== '0' && state[i] !== goal[i]) d++;
          }
          return d;
        };
      },
    },
  };

  EP.heuristics = HEURISTICS;
  EP.createHeuristic = function createHeuristic(key, goal) {
    const h = HEURISTICS[key];
    if (!h) throw new Error(`Unknown heuristic: ${key}`);
    return h.create(goal);
  };
})(typeof window !== 'undefined' ? window : globalThis);
