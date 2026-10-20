/*
 * Algorithm test-suite (no dependencies).  Run with:  node tests/run-tests.js
 */
'use strict';
const path = require('path');

[
  'js/config.js',
  'js/core/puzzle.js',
  'js/core/heuristics.js',
  'js/core/priority-queue.js',
  'js/core/search-context.js',
  'js/algorithms/bfs.js',
  'js/algorithms/dfs.js',
  'js/algorithms/dls.js',
  'js/algorithms/best-first.js',
  'js/algorithms/gbfs.js',
  'js/algorithms/registry.js',
].forEach((f) => require(path.join(__dirname, '..', f)));

const EP = globalThis.EP;
const P = EP.puzzle;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

/** Checks the path starts at start, ends at goal, and every step is a legal move. */
function assertValidPath(result, start, goal) {
  const p = result.path;
  assert(p[0].state === start, 'path must begin at the start state');
  assert(p[p.length - 1].state === goal, 'path must end at the goal state');
  for (let i = 1; i < p.length; i++) {
    assert(P.applyAction(p[i - 1].state, p[i].action) === p[i].state, `illegal move at step ${i}`);
  }
  assert(result.moves === p.length - 1, 'moves must equal path length - 1');
}

// Deterministic RNG so failures are reproducible
function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const START = P.EXAMPLE_START; // 283164705
const GOAL = P.DEFAULT_GOAL; // 123804765

console.log('Puzzle model');
test('successors of the example have 3 moves (blank at bottom middle)', () => {
  const s = P.successors(START).map((x) => x.action).sort();
  assert(JSON.stringify(s) === JSON.stringify(['Left', 'Right', 'Up']), s.join());
});
test('parseState accepts several formats', () => {
  assert(P.parseState('2 8 3 1 6 4 7 _ 5').state === START);
  assert(P.parseState('283164705').state === START);
  assert(P.parseState('2,8,3/1,6,4/7,_,5').state === START);
  assert(!P.parseState('2 8 3 1 6 4 7 7 5').ok, 'duplicate tile must be rejected');
  assert(!P.parseState('1 2 3').ok, 'too few cells must be rejected');
});
test('solvability by inversion parity', () => {
  assert(P.isSolvable(START, GOAL));
  assert(!P.isSolvable('123456870', '123456780'), 'swapping two tiles makes it unsolvable');
});
test('random puzzles are always solvable', () => {
  const r = rng(7);
  for (const d of Object.keys(P.DIFFICULTIES)) {
    for (let i = 0; i < 50; i++) assert(P.isSolvable(P.randomPuzzle(GOAL, d, r), GOAL), d);
  }
});

console.log('Heuristics');
test('misplaced tiles of the example = 4', () => assert(EP.createHeuristic('misplaced', GOAL)(START) === 4));
test('manhattan distance of the example = 5', () => assert(EP.createHeuristic('manhattan', GOAL)(START) === 5));
test('both heuristics are 0 at the goal', () => {
  assert(EP.createHeuristic('misplaced', GOAL)(GOAL) === 0);
  assert(EP.createHeuristic('manhattan', GOAL)(GOAL) === 0);
});

console.log('Priority queue');
test('MinHeap pops in order and topK matches', () => {
  const h = new EP.MinHeap((a, b) => a - b);
  const r = rng(3);
  const vals = Array.from({ length: 200 }, () => Math.floor(r() * 1000));
  vals.forEach((v) => h.push(v));
  const top = h.topK(10);
  const sorted = vals.slice().sort((a, b) => a - b);
  assert(JSON.stringify(top) === JSON.stringify(sorted.slice(0, 10)), 'topK');
  const out = [];
  while (h.size) out.push(h.pop());
  assert(JSON.stringify(out) === JSON.stringify(sorted), 'pop order');
});

console.log('Algorithms on the assignment example (optimal = 5 moves)');
const base = { start: START, goal: GOAL };
for (const key of EP.ALGORITHM_ORDER) {
  for (const heuristic of EP.algorithms[key].informed ? ['manhattan', 'misplaced'] : [null]) {
    test(`${EP.algorithms[key].short}${heuristic ? ` (${heuristic})` : ''} finds a valid solution`, () => {
      const r = EP.solve(key, Object.assign({}, base, { heuristic, depthLimit: 10 }));
      assert(r.found, `status = ${r.status}`);
      assertValidPath(r, START, GOAL);
      if (['bfs', 'iddls', 'ucs', 'astar'].includes(key)) assert(r.moves === 5, `expected 5 moves, got ${r.moves}`);
    });
  }
}
test('DLS with limit 4 (< 5) reports cutoff', () => {
  const r = EP.solve('dls', Object.assign({}, base, { depthLimit: 4 }));
  assert(!r.found && r.status === 'cutoff', r.status);
  assert(r.maxDepth <= 4, `maxDepth ${r.maxDepth}`);
});
test('IDDLS reports the iteration count', () => {
  const r = EP.solve('iddls', base);
  assert(r.iterations === 6 && r.finalLimit === 5, `${r.iterations} / ${r.finalLimit}`);
});
test('GBFS trace: every expanded node is the frontier minimum by h', () => {
  const r = EP.solve('gbfs', Object.assign({}, base, { trace: true, heuristic: 'manhattan' }));
  for (let i = 1; i < r.steps.length; i++) {
    const prev = r.steps[i - 1];
    const minH = Math.min(...prev.frontier.map((n) => n.h));
    assert(r.steps[i].current.h === minH, `step ${i}: expanded h=${r.steps[i].current.h}, frontier min=${minH}`);
  }
  assert(r.steps[r.steps.length - 1].kind === 'goal');
});
test('Starting at the goal needs 0 moves', () => {
  for (const key of EP.ALGORITHM_ORDER) {
    const r = EP.solve(key, { start: GOAL, goal: GOAL, depthLimit: 3 });
    assert(r.found && r.moves === 0, key);
  }
});

console.log('Random puzzles: optimal algorithms agree, all paths valid');
test('BFS = UCS = IDDLS = A*(h1) = A*(h2) on 25 random puzzles; DFS/GBFS valid', () => {
  const r = rng(42);
  for (let i = 0; i < 25; i++) {
    const start = P.randomPuzzle(GOAL, i < 15 ? 'medium' : 'random', r);
    const opts = { start, goal: GOAL };
    const bfs = EP.solve('bfs', opts);
    assertValidPath(bfs, start, GOAL);
    for (const [key, h] of [['ucs'], ['iddls'], ['astar', 'manhattan'], ['astar', 'misplaced']]) {
      const x = EP.solve(key, Object.assign({ heuristic: h }, opts));
      assert(x.found && x.moves === bfs.moves, `${key}/${h} ${x.moves} vs BFS ${bfs.moves} for ${start}`);
      assertValidPath(x, start, GOAL);
    }
    for (const [key, h] of [['dfs'], ['gbfs', 'manhattan'], ['gbfs', 'misplaced']]) {
      const x = EP.solve(key, Object.assign({ heuristic: h }, opts));
      assert(x.found && x.moves >= bfs.moves, `${key} ${x.moves}`);
      assertValidPath(x, start, GOAL);
    }
  }
});

console.log('Boundary cases and invariants');
test('DLS finds a solution iff limit >= optimal depth (20 random puzzles)', () => {
  const r = rng(99);
  for (let i = 0; i < 20; i++) {
    const start = P.randomPuzzle(GOAL, 'easy', r);
    const d = EP.solve('bfs', { start, goal: GOAL }).moves;
    const at = EP.solve('dls', { start, goal: GOAL, depthLimit: d });
    const below = EP.solve('dls', { start, goal: GOAL, depthLimit: d - 1 });
    assert(at.found && at.moves <= d, `limit ${d} should find, got ${at.status}`);
    assertValidPath(at, start, GOAL);
    assert(!below.found && below.status === 'cutoff', `limit ${d - 1} should cut off, got ${below.status}`);
  }
});
test('IDDLS with maxDepth below the optimal depth reports cutoff', () => {
  const r = EP.solve('iddls', { start: START, goal: GOAL, maxDepth: 3 });
  assert(!r.found && r.status === 'cutoff' && r.finalLimit === 3, `${r.status} ${r.finalLimit}`);
});
test('Both heuristics are admissible (h <= optimal cost) on 40 random states', () => {
  const r = rng(5);
  const h1 = EP.createHeuristic('misplaced', GOAL);
  const h2 = EP.createHeuristic('manhattan', GOAL);
  for (let i = 0; i < 40; i++) {
    const s = P.randomPuzzle(GOAL, 'random', r);
    const opt = EP.solve('astar', { start: s, goal: GOAL, heuristic: 'manhattan' }).moves;
    assert(h1(s) <= h2(s) && h2(s) <= opt, `h1=${h1(s)} h2=${h2(s)} opt=${opt} for ${s}`);
  }
});
test('A* expands nodes in non-decreasing f order (consistent heuristic)', () => {
  const start = P.randomPuzzle(GOAL, 'random', rng(11));
  const res = EP.solve('astar', { start, goal: GOAL, heuristic: 'manhattan', trace: true });
  for (let i = 1; i < res.steps.length; i++) {
    assert(res.steps[i].current.f >= res.steps[i - 1].current.f, `f decreased at step ${i}`);
  }
});
test('Counters are consistent for every algorithm', () => {
  const start = P.randomPuzzle(GOAL, 'medium', rng(21));
  for (const key of EP.ALGORITHM_ORDER) {
    const x = EP.solve(key, { start, goal: GOAL, heuristic: 'manhattan', depthLimit: 12 });
    assert(x.generated >= x.expanded, `${key}: generated < expanded`);
    assert(x.peakNodes > 0 && x.memoryBytes === x.peakNodes * EP.BYTES_PER_NODE, `${key}: memory`);
    if (x.found) assert(x.cost === x.moves && x.maxDepth >= x.moves, `${key}: cost/depth`);
  }
});
test('Trace is capped but always ends with the final step; stats cover the full run', () => {
  const x = EP.solve('dfs', { start: START, goal: GOAL, trace: true, maxTraceSteps: 50 });
  assert(x.truncated && x.steps.length === 51, `steps ${x.steps.length}`);
  assert(x.steps[50].kind === 'goal' && x.expanded > 50, 'final step / full stats');
});
test('Untraced runs record no steps, and traced/untraced give identical results', () => {
  const start = P.randomPuzzle(GOAL, 'medium', rng(31));
  for (const key of EP.ALGORITHM_ORDER) {
    const a = EP.solve(key, { start, goal: GOAL, heuristic: 'misplaced', depthLimit: 20 });
    const b = EP.solve(key, { start, goal: GOAL, heuristic: 'misplaced', depthLimit: 20, trace: true });
    assert(a.steps.length === 0, `${key} untraced recorded steps`);
    assert(a.moves === b.moves && a.expanded === b.expanded && a.generated === b.generated, `${key} traced differs`);
  }
});
test('Input validation messages', () => {
  assert(/Missing|blank|more than once/.test(P.fromCells(['1', '2', '3', '4', '5', '6', '7', '', '']).error), 'two blanks');
  assert(/not allowed/.test(P.fromCells(['1', '2', '3', '4', '5', '6', '7', '9', '']).error), 'digit 9');
  assert(P.fromCells(['1', '2', '3', '8', '', '4', '7', '6', '5']).state === GOAL, 'empty cell = blank');
  assert(P.parseState('1 2 3 8 0 4 7 6 5').state === GOAL, '0 = blank');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
