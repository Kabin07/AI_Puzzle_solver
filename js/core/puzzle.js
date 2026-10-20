/*
 * 8-Puzzle state-space model.
 *
 * A state is a 9-character string read row by row, with '0' as the blank,
 * e.g. "283164705" is
 *     2 8 3
 *     1 6 4
 *     7 _ 5
 * Strings are immutable and hashable, so they work directly as Set/Map keys.
 *
 * Actions are named after the direction the BLANK moves (Up, Down, Left, Right).
 * Every action costs 1, so path cost g(n) = number of moves.
 */
(function (root) {
  'use strict';
  const EP = (root.EP = root.EP || {});

  const SIZE = 3;
  const N = SIZE * SIZE;
  const BLANK = '0';
  const DEFAULT_GOAL = '123804765'; // goal used in the assignment example
  const EXAMPLE_START = '283164705'; // initial state used in the assignment example
  const BLANK_TOKENS = new Set(['0', '_', '-', 'b', 'x', '*', '.']);

  const ACTIONS = {
    Up: { dr: -1, dc: 0, arrow: '↑', opposite: 'Down' },
    Down: { dr: 1, dc: 0, arrow: '↓', opposite: 'Up' },
    Left: { dr: 0, dc: -1, arrow: '←', opposite: 'Right' },
    Right: { dr: 0, dc: 1, arrow: '→', opposite: 'Left' },
  };
  const ACTION_ORDER = ['Up', 'Down', 'Left', 'Right'];

  // NEIGHBORS[i] lists the legal moves when the blank sits at index i.
  const NEIGHBORS = Array.from({ length: N }, (_, i) => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    return ACTION_ORDER.filter((name) => {
      const { dr, dc } = ACTIONS[name];
      return r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE;
    }).map((name) => ({ action: name, to: (r + ACTIONS[name].dr) * SIZE + (c + ACTIONS[name].dc) }));
  });

  function swap(state, i, j) {
    const a = state.split('');
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
    return a.join('');
  }

  /** Transition model: all states reachable in one move, with the action and the tile that slid. */
  function successors(state) {
    const b = state.indexOf(BLANK);
    return NEIGHBORS[b].map(({ action, to }) => ({
      state: swap(state, b, to),
      action,
      tile: state[to],
    }));
  }

  /** Apply one named action; returns null if the move is illegal. */
  function applyAction(state, action) {
    const b = state.indexOf(BLANK);
    const move = NEIGHBORS[b].find((m) => m.action === action);
    return move ? swap(state, b, move.to) : null;
  }

  function isValidState(state) {
    return typeof state === 'string' && state.length === N && state.split('').sort().join('') === '012345678';
  }

  /** Number of tile pairs (ignoring the blank) that appear in the wrong order. */
  function inversions(state) {
    const tiles = state.split('').filter((ch) => ch !== BLANK);
    let count = 0;
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i] > tiles[j]) count++;
      }
    }
    return count;
  }

  /**
   * On a 3x3 board every move changes the inversion count by an even number,
   * so start can reach goal iff both have the same inversion parity.
   */
  function isSolvable(start, goal) {
    return inversions(start) % 2 === inversions(goal) % 2;
  }

  /**
   * Validate 9 cell values (strings). Empty / '_' / '0' are treated as the blank.
   * Returns { ok, state, error, duplicates: Set<index> }.
   */
  function fromCells(cells) {
    const values = cells.map((v) => {
      const t = String(v == null ? '' : v).trim().toLowerCase();
      return t === '' || BLANK_TOKENS.has(t) ? BLANK : t;
    });
    const duplicates = new Set();
    const seen = new Map();
    let error = null;
    values.forEach((v, i) => {
      if (!/^[0-8]$/.test(v)) {
        error = error || `"${cells[i]}" is not allowed. Use digits 1-8 and one blank (_ or 0).`;
        duplicates.add(i);
        return;
      }
      if (seen.has(v)) {
        duplicates.add(i);
        duplicates.add(seen.get(v));
        error = error || (v === BLANK ? 'There must be exactly one blank cell.' : `Tile ${v} appears more than once.`);
      } else {
        seen.set(v, i);
      }
    });
    if (!error && values.length !== N) error = `Expected 9 cells, got ${values.length}.`;
    if (!error) {
      const missing = '12345678'.split('').filter((d) => !seen.has(d));
      if (missing.length) error = `Missing tile(s): ${missing.join(', ')}.`;
    }
    return { ok: !error, state: error ? null : values.join(''), error, duplicates };
  }

  /** Parse free text such as "2 8 3 1 6 4 7 _ 5", "283164705" or "2,8,3/1,6,4/7,_,5". */
  function parseState(text) {
    let tokens = String(text).trim().split(/[\s,;|/]+/).filter(Boolean);
    if (tokens.length === 1 && tokens[0].length === N) tokens = tokens[0].split('');
    if (tokens.length !== N) {
      return { ok: false, state: null, error: `Expected 9 cells (8 tiles + 1 blank), got ${tokens.length}.`, duplicates: new Set() };
    }
    return fromCells(tokens);
  }

  function label(ch) {
    return ch === BLANK ? '_' : ch;
  }

  /** "2 8 3\n1 6 4\n7 _ 5" (or any row separator). */
  function format(state, rowSep = '\n') {
    const rows = [];
    for (let r = 0; r < SIZE; r++) {
      rows.push(state.slice(r * SIZE, r * SIZE + SIZE).split('').map(label).join(' '));
    }
    return rows.join(rowSep);
  }

  function describeMove(action, tile) {
    if (!action) return 'Initial state';
    const a = ACTIONS[action];
    return `Blank ${a.arrow} ${action} (tile ${tile} slides ${ACTIONS[a.opposite].arrow})`;
  }

  // ---------- Random puzzle generation ----------

  /** Random walk of `moves` steps from the goal (never undoing the previous move). Always solvable. */
  function scramble(goal, moves, rng = Math.random) {
    let state = goal;
    let last = null;
    for (let k = 0; k < moves; k++) {
      const options = successors(state).filter((s) => !last || s.action !== ACTIONS[last].opposite);
      const pick = options[Math.floor(rng() * options.length)];
      state = pick.state;
      last = pick.action;
    }
    return state === goal ? scramble(goal, Math.max(moves, 2), rng) : state;
  }

  /** Uniformly random permutation, re-drawn until it is solvable with respect to the goal. */
  function shuffleSolvable(goal, rng = Math.random) {
    for (;;) {
      const a = '012345678'.split('');
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      const s = a.join('');
      if (s !== goal && isSolvable(s, goal)) return s;
    }
  }

  const DIFFICULTIES = {
    easy: { label: 'Easy (8-move scramble)', make: (goal, rng) => scramble(goal, 8, rng) },
    medium: { label: 'Medium (16-move scramble)', make: (goal, rng) => scramble(goal, 16, rng) },
    hard: { label: 'Hard (30-move scramble)', make: (goal, rng) => scramble(goal, 30, rng) },
    random: { label: 'Fully random (any solvable state)', make: (goal, rng) => shuffleSolvable(goal, rng) },
  };

  function randomPuzzle(goal = DEFAULT_GOAL, difficulty = 'medium', rng = Math.random) {
    return (DIFFICULTIES[difficulty] || DIFFICULTIES.medium).make(goal, rng);
  }

  EP.puzzle = {
    SIZE,
    N,
    BLANK,
    DEFAULT_GOAL,
    EXAMPLE_START,
    ACTIONS,
    DIFFICULTIES,
    successors,
    applyAction,
    isValidState,
    inversions,
    isSolvable,
    fromCells,
    parseState,
    label,
    format,
    describeMove,
    scramble,
    shuffleSolvable,
    randomPuzzle,
  };
})(typeof window !== 'undefined' ? window : globalThis);
