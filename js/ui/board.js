/*
 * Board rendering.
 *  AnimatedBoard : one persistent DOM element per tile (and one for the blank),
 *                  positioned with CSS transforms so moves slide smoothly.
 *  miniBoard()   : small static HTML board for lists, successors and the path.
 */
(function (root) {
  'use strict';
  const EP = root.EP;
  const ui = (EP.ui = EP.ui || {});

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  ui.esc = esc;

  class AnimatedBoard {
    constructor(el, opts = {}) {
      this.el = el;
      this.goal = opts.goal || null;
      this.state = null;
      el.classList.add('puzzle-board');
      el.setAttribute('role', 'img');
      el.innerHTML = '';
      this.tiles = {};
      for (let t = 0; t <= 8; t++) {
        const d = document.createElement('div');
        d.className = t === 0 ? 'tile tile-blank' : 'tile';
        d.innerHTML = `<span>${t === 0 ? '' : t}</span>`;
        el.appendChild(d);
        this.tiles[t] = d;
      }
    }

    setGoal(goal) {
      this.goal = goal;
      if (this.state) this.setState(this.state, { animate: false });
    }

    setDuration(ms) {
      this.el.style.setProperty('--tile-ms', `${Math.max(0, Math.round(ms))}ms`);
    }

    /** Show a state. If it differs from the previous one by a single move, that tile is outlined. */
    setState(state, { animate = true } = {}) {
      if (!state) return;
      const prev = this.state;
      if (!animate) this.el.classList.add('no-anim');

      let moved = null;
      if (prev && prev !== state) {
        const diff = [];
        for (let i = 0; i < 9; i++) if (prev[i] !== state[i]) diff.push(i);
        if (diff.length === 2) moved = prev[diff[0]] === '0' ? prev[diff[1]] : prev[diff[0]];
      }

      for (let i = 0; i < 9; i++) {
        const t = state[i];
        const tile = this.tiles[t];
        const r = (i / 3) | 0;
        const c = i % 3;
        tile.style.transform = `translate(${c * 100}%, ${r * 100}%)`;
        tile.classList.toggle('in-place', !!this.goal && t !== '0' && this.goal[i] === t);
        tile.classList.toggle('just-moved', t === moved);
      }
      this.el.classList.toggle('is-goal', !!this.goal && state === this.goal);
      this.el.setAttribute('aria-label', `Puzzle board: ${EP.puzzle.format(state, ' / ')}`);

      if (!animate) {
        void this.el.offsetWidth; // flush styles so the jump is not animated
        this.el.classList.remove('no-anim');
      }
      this.state = state;
    }
  }

  /**
   * Small static board.
   * opts: { goal, parent (highlights the tile that moved), size: 'sm' | 'lg', title }
   */
  function miniBoard(state, opts = {}) {
    if (!state) return '';
    let movedIdx = -1;
    if (opts.parent) {
      const pb = opts.parent.indexOf('0');
      movedIdx = state[pb] !== '0' ? pb : -1; // the tile now sits where the blank was
    }
    let cells = '';
    for (let i = 0; i < 9; i++) {
      const t = state[i];
      let cls = '';
      if (t === '0') cls = 'blank';
      else if (i === movedIdx) cls = 'moved';
      else if (opts.goal && opts.goal[i] === t) cls = 'ok';
      cells += `<div class="${cls}">${t === '0' ? '' : t}</div>`;
    }
    const size = opts.size ? ` mini-${opts.size}` : '';
    const title = esc(opts.title || EP.puzzle.format(state, ' / '));
    return `<div class="mini-board${size}" title="${title}" aria-label="${title}">${cells}</div>`;
  }

  ui.AnimatedBoard = AnimatedBoard;
  ui.miniBoard = miniBoard;
})(typeof window !== 'undefined' ? window : globalThis);
