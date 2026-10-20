/*
 * Test-suite for the 8-puzzle model, heuristics, priority queue and Greedy Best-First Search.
 * No dependencies. Run with:  node tests/run-tests.js
 *
 * A tiny breadth-first search is defined below as a TEST ORACLE only (to know the
 * true shortest solution length). It is not part of the application.
 */
'use strict';
const path = require('path');

[
  'js/config.js',
  'js/core/puzzle.js',
  'js/core/heuristics.js',
  'js/core/priority-queue.js',
  'js/core/search-context.js',
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
    assert(p[i].g === i, `g(n) must equal the number of moves at step ${i}`);
  }
  assert(result.moves === p.length - 1, 'moves must equal path length - 1');
}

/** Test oracle: length of the shortest solution (plain BFS). */
function optimalMoves(start, goal) {
  if (start === goal) return 0;
  const seen = new Set([start]);
  let layer = [start];
  for (let d = 1; layer.length; d++) {
    const next = [];
    for (const s of layer) {
      for (const n of P.successors(s)) {
        if (n.state === goal) return d;
        if (!seen.has(n.state)) {
          seen.add(n.state);
          next.push(n.state);
        }
      }
    }
    layer = next;
  }
  return null;
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
test('input validation messages', () => {
  assert(/Missing|blank|more than once/.test(P.fromCells(['1', '2', '3', '4', '5', '6', '7', '', '']).error), 'two blanks');
  assert(/not allowed/.test(P.fromCells(['1', '2', '3', '4', '5', '6', '7', '9', '']).error), 'digit 9');
  assert(P.fromCells(['1', '2', '3', '8', '', '4', '7', '6', '5']).state === GOAL, 'empty cell = blank');
  assert(P.parseState('1 2 3 8 0 4 7 6 5').state === GOAL, '0 = blank');
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
test('both heuristics are admissible and h1 <= h2 (40 random states)', () => {
  const r = rng(5);
  const h1 = EP.createHeuristic('misplaced', GOAL);
  const h2 = EP.createHeuristic('manhattan', GOAL);
  for (let i = 0; i < 40; i++) {
    const s = P.randomPuzzle(GOAL, 'random', r);
    const opt = optimalMoves(s, GOAL);
    assert(h1(s) <= h2(s) && h2(s) <= opt, `h1=${h1(s)} h2=${h2(s)} opt=${opt} for ${s}`);
  }
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

console.log('Greedy Best-First Search');
for (const heuristic of ['manhattan', 'misplaced']) {
  test(`GBFS (${heuristic}) solves the assignment example with a valid path`, () => {
    const r = EP.solve('gbfs', { start: START, goal: GOAL, heuristic });
    assert(r.found, `status = ${r.status}`);
    assertValidPath(r, START, GOAL);
    assert(r.moves >= 5, 'cannot beat the optimal 5 moves');
  });
}
test('GBFS + Manhattan on the example: 5 moves, 5 expansions, 16 generated', () => {
  const r = EP.solve('gbfs', { start: START, goal: GOAL, heuristic: 'manhattan' });
  assert(r.moves === 5 && r.expanded === 5 && r.generated === 16, `${r.moves}/${r.expanded}/${r.generated}`);
});
test('Every expanded node is the frontier minimum by h (both heuristics)', () => {
  for (const heuristic of ['manhattan', 'misplaced']) {
    const start = P.randomPuzzle(GOAL, 'random', rng(17));
    const r = EP.solve('gbfs', { start, goal: GOAL, heuristic, trace: true });
    for (let i = 1; i < r.steps.length; i++) {
      const prev = r.steps[i - 1];
      const minH = Math.min(...prev.frontier.map((n) => n.h));
      assert(r.steps[i].current.h === minH, `${heuristic} step ${i}: expanded h=${r.steps[i].current.h}, frontier min=${minH}`);
    }
    assert(r.steps[r.steps.length - 1].kind === 'goal');
  }
});
test('f(n) = h(n) for every recorded node', () => {
  const r = EP.solve('gbfs', { start: P.randomPuzzle(GOAL, 'medium', rng(23)), goal: GOAL, trace: true });
  for (const s of r.steps) {
    assert(s.current.f === s.current.h, 'current');
    s.successors.forEach((x) => assert(x.f === x.h, 'successor'));
    s.frontier.forEach((x) => assert(x.f === x.h, 'frontier'));
  }
});
test('Starting at the goal needs 0 moves', () => {
  const r = EP.solve('gbfs', { start: GOAL, goal: GOAL });
  assert(r.found && r.moves === 0 && r.expanded === 0, `${r.moves} / ${r.expanded}`);
});
test('Complete: solves 40 random puzzles with valid paths, never shorter than optimal', () => {
  const r = rng(42);
  let longer = 0;
  for (let i = 0; i < 40; i++) {
    const start = P.randomPuzzle(GOAL, i < 15 ? 'medium' : 'random', r);
    const opt = optimalMoves(start, GOAL);
    for (const heuristic of ['manhattan', 'misplaced']) {
      const x = EP.solve('gbfs', { start, goal: GOAL, heuristic });
      assert(x.found, `${heuristic} failed on ${start}`);
      assertValidPath(x, start, GOAL);
      assert(x.moves >= opt, `${heuristic}: ${x.moves} < optimal ${opt}`);
      if (x.moves > opt) longer++;
    }
  }
  assert(longer > 0, 'GBFS should be non-optimal on at least one random puzzle');
});
test('Known non-optimal case: 702645381 → GBFS (Manhattan) 63 moves, optimal 23', () => {
  const r = EP.solve('gbfs', { start: '702645381', goal: GOAL, heuristic: 'manhattan' });
  assert(r.moves === 63 && optimalMoves('702645381', GOAL) === 23, `${r.moves}`);
});
test('Counters are consistent', () => {
  const x = EP.solve('gbfs', { start: P.randomPuzzle(GOAL, 'random', rng(21)), goal: GOAL });
  assert(x.generated >= x.expanded, 'generated < expanded');
  assert(x.peakNodes > 0 && x.memoryBytes === x.peakNodes * EP.BYTES_PER_NODE, 'memory');
  assert(x.cost === x.moves && x.maxDepth >= x.moves, 'cost/depth');
});
test('Trace is capped but always ends with the final step; stats cover the full run', () => {
  const x = EP.solve('gbfs', { start: '702645381', goal: GOAL, heuristic: 'misplaced', trace: true, maxTraceSteps: 50 });
  assert(x.truncated && x.steps.length === 51, `steps ${x.steps.length}`);
  assert(x.steps[50].kind === 'goal' && x.expanded > 50, 'final step / full stats');
});
test('Untraced runs record no steps, and traced/untraced give identical results', () => {
  const start = P.randomPuzzle(GOAL, 'random', rng(31));
  for (const heuristic of ['manhattan', 'misplaced']) {
    const a = EP.solve('gbfs', { start, goal: GOAL, heuristic });
    const b = EP.solve('gbfs', { start, goal: GOAL, heuristic, trace: true });
    assert(a.steps.length === 0, 'untraced recorded steps');
    assert(a.moves === b.moves && a.expanded === b.expanded && a.generated === b.generated, 'traced differs');
  }
});
test('Unknown algorithm is rejected', () => {
  let threw = false;
  try {
    EP.solve('bfs', { start: START, goal: GOAL });
  } catch (e) {
    threw = true;
  }
  assert(threw && EP.ALGORITHM_ORDER.length === 1 && EP.ALGORITHM_ORDER[0] === 'gbfs');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
