/*
 * Puzzle input panel (shared by the Solver and Comparison pages).
 *   Method 1: type the initial and goal states (3x3 grid or one line of text)
 *   Method 2: generate a random solvable puzzle
 * The last valid puzzle is saved in localStorage so both pages use the same instance.
 */
(function (root) {
  'use strict';
  const EP = root.EP;
  const P = EP.puzzle;
  const ui = (EP.ui = EP.ui || {});
  const STORAGE_KEY = 'ep.puzzle';

  function loadSaved() {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (v && P.isValidState(v.start) && P.isValidState(v.goal)) return v;
    } catch (e) {
      /* storage unavailable: fall back to the example */
    }
    return null;
  }

  function save(start, goal) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ start, goal }));
    } catch (e) {
      /* ignore */
    }
  }

  /** 3x3 grid of single-character inputs with arrow-key navigation. */
  class GridEditor {
    constructor(el, onInput) {
      this.el = el;
      this.inputs = [];
      el.classList.add('grid-editor');
      for (let i = 0; i < 9; i++) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.maxLength = 2;
        inp.autocomplete = 'off';
        inp.className = 'form-control';
        inp.setAttribute('aria-label', `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1} (blank: leave empty or type _)`);
        inp.addEventListener('input', () => {
          inp.value = inp.value.slice(-1).replace(/[^0-8_]/g, '');
          if (inp.value === '0') inp.value = '_';
          if (inp.value && i < 8) this.inputs[i + 1].focus();
          onInput();
        });
        inp.addEventListener('focus', () => inp.select());
        inp.addEventListener('keydown', (e) => {
          const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
          if (moves[e.key] !== undefined) {
            const j = i + moves[e.key];
            if (j >= 0 && j < 9) {
              e.preventDefault();
              this.inputs[j].focus();
            }
          }
        });
        el.appendChild(inp);
        this.inputs.push(inp);
      }
    }

    cells() {
      return this.inputs.map((i) => i.value);
    }

    setState(state) {
      this.inputs.forEach((inp, i) => {
        inp.value = state[i] === '0' ? '_' : state[i];
      });
      this.mark(new Set());
    }

    mark(badIndexes) {
      this.inputs.forEach((inp, i) => {
        inp.classList.toggle('is-invalid', badIndexes.has(i));
        inp.classList.toggle('is-blank', inp.value === '' || inp.value === '_');
      });
    }
  }

  class PuzzleSetup {
    /** opts: { onChange(puzzle) } called whenever the puzzle becomes valid or changes */
    constructor(container, opts = {}) {
      this.onChange = opts.onChange || (() => {});
      container.innerHTML = `
        <div class="card-title-sm mb-2">Method 1: Enter states</div>
        <div class="row g-3">
          <div class="col-6">
            <label class="form-label small fw-semibold mb-1">Initial state</label>
            <div data-editor="start"></div>
            <input class="form-control form-control-sm font-monospace mt-2 state-text" data-text="start" placeholder="2 8 3 1 6 4 7 _ 5" aria-label="Initial state as text">
          </div>
          <div class="col-6">
            <label class="form-label small fw-semibold mb-1">Goal state</label>
            <div data-editor="goal"></div>
            <input class="form-control form-control-sm font-monospace mt-2 state-text" data-text="goal" placeholder="1 2 3 8 _ 4 7 6 5" aria-label="Goal state as text">
          </div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="example" title="Load the example from the assignment"><i class="bi bi-journal-text"></i> Example</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="swap" title="Swap initial and goal"><i class="bi bi-arrow-left-right"></i> Swap</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" data-action="ordered-goal" title="Use 1 2 3 4 5 6 7 8 _ as the goal"><i class="bi bi-sort-numeric-down"></i> 1–8 goal</button>
        </div>
        <hr class="my-3">
        <div class="card-title-sm mb-2">Method 2: Random solvable puzzle</div>
        <select class="form-select form-select-sm mb-2" data-difficulty aria-label="Random puzzle difficulty">
          ${Object.entries(P.DIFFICULTIES)
            .map(([k, d]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${d.label}</option>`)
            .join('')}
        </select>
        <button type="button" class="btn btn-accent btn-sm w-100" data-action="random"><i class="bi bi-shuffle"></i> Generate Random Puzzle</button>
        <div class="small mt-3" data-status role="status" aria-live="polite"></div>`;

      this.status = container.querySelector('[data-status]');
      this.difficulty = container.querySelector('[data-difficulty]');
      this.text = {
        start: container.querySelector('[data-text="start"]'),
        goal: container.querySelector('[data-text="goal"]'),
      };
      this.editors = {
        start: new GridEditor(container.querySelector('[data-editor="start"]'), () => this.fromGrid('start')),
        goal: new GridEditor(container.querySelector('[data-editor="goal"]'), () => this.fromGrid('goal')),
      };
      for (const which of ['start', 'goal']) {
        this.text[which].addEventListener('input', () => this.fromText(which));
      }
      container.querySelector('[data-action="example"]').addEventListener('click', () => this.set(P.EXAMPLE_START, P.DEFAULT_GOAL));
      container.querySelector('[data-action="swap"]').addEventListener('click', () => {
        const p = this.read();
        if (p.startState && p.goalState) this.set(p.goalState, p.startState);
      });
      container.querySelector('[data-action="ordered-goal"]').addEventListener('click', () => {
        const goal = '123456780';
        const cur = this.read();
        const start = cur.startState && P.isSolvable(cur.startState, goal) ? cur.startState : P.randomPuzzle(goal, this.difficulty.value);
        this.set(start, goal);
      });
      container.querySelector('[data-action="random"]').addEventListener('click', () => {
        const cur = this.read();
        const goal = cur.goalState || P.DEFAULT_GOAL;
        this.set(P.randomPuzzle(goal, this.difficulty.value), goal);
      });

      const saved = loadSaved();
      this.set(saved ? saved.start : P.EXAMPLE_START, saved ? saved.goal : P.DEFAULT_GOAL, { silent: true });
    }

    set(start, goal, { silent = false } = {}) {
      this.editors.start.setState(start);
      this.editors.goal.setState(goal);
      this.text.start.value = P.format(start, ' ');
      this.text.goal.value = P.format(goal, ' ');
      this.validate(silent);
    }

    fromGrid(which) {
      const r = P.fromCells(this.editors[which].cells());
      if (r.ok) this.text[which].value = P.format(r.state, ' ');
      this.validate();
    }

    fromText(which) {
      const r = P.parseState(this.text[which].value);
      if (r.ok) this.editors[which].setState(r.state);
      this.validate();
    }

    /** Current puzzle: { ok, start, goal, error, startState, goalState } */
    read() {
      const s = P.fromCells(this.editors.start.cells());
      const g = P.fromCells(this.editors.goal.cells());
      const out = { ok: false, start: null, goal: null, error: null, startState: s.state, goalState: g.state, s, g };
      if (!s.ok) out.error = `Initial state: ${s.error}`;
      else if (!g.ok) out.error = `Goal state: ${g.error}`;
      else if (!P.isSolvable(s.state, g.state)) {
        out.error = `Unsolvable: the initial state has ${P.inversions(s.state)} inversions and the goal has ${P.inversions(g.state)}. Their parity must match (both even or both odd).`;
      } else {
        Object.assign(out, { ok: true, start: s.state, goal: g.state });
      }
      return out;
    }

    validate(silent = false) {
      const p = this.read();
      this.editors.start.mark(p.s.duplicates);
      this.editors.goal.mark(p.g.duplicates);
      if (p.ok) {
        const h1 = EP.createHeuristic('misplaced', p.goal)(p.start);
        const h2 = EP.createHeuristic('manhattan', p.goal)(p.start);
        this.status.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill"></i> Valid and solvable</span>
          <span class="text-body-secondary d-block mt-1">Misplaced tiles h₁ = <b>${h1}</b> · Manhattan h₂ = <b>${h2}</b> · inversions = ${P.inversions(p.start)}</span>`;
        save(p.start, p.goal);
      } else {
        this.status.innerHTML = `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill"></i> ${ui.esc(p.error)}</span>`;
      }
      if (!silent) this.onChange(p);
      return p;
    }
  }

  ui.PuzzleSetup = PuzzleSetup;
})(typeof window !== 'undefined' ? window : globalThis);
