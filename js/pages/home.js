/*
 * Home page: example boards and a looping GBFS demo on the assignment example.
 */
(function () {
  'use strict';
  const EP = window.EP;
  const P = EP.puzzle;

  document.addEventListener('DOMContentLoaded', () => {
    const goal = P.DEFAULT_GOAL;
    const start = P.EXAMPLE_START;

    new EP.ui.AnimatedBoard(document.getElementById('exStart'), { goal }).setState(start, { animate: false });
    new EP.ui.AnimatedBoard(document.getElementById('exGoal'), { goal }).setState(goal, { animate: false });

    const result = EP.solve('gbfs', { start, goal, heuristic: 'manhattan' });
    const board = new EP.ui.AnimatedBoard(document.getElementById('demoBoard'), { goal });
    board.setDuration(450);
    const stepEl = document.getElementById('demoStep');
    const captionEl = document.getElementById('demoCaption');
    const h = EP.createHeuristic('manhattan', goal);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let i = 0;
    function show() {
      const node = result.path[i];
      board.setState(node.state, { animate: i !== 0 });
      stepEl.textContent = `Step ${i} / ${result.moves}`;
      const prev = i > 0 ? result.path[i - 1].state : null;
      const tile = prev ? node.state[prev.indexOf('0')] : null;
      captionEl.textContent = `${P.describeMove(node.action, tile)} · h(n) = ${h(node.state)}`;
    }
    show();
    if (reduced) return;
    setInterval(() => {
      i = (i + 1) % (result.path.length + 2); // short pause on the goal
      if (i < result.path.length) show();
    }, 1100);
  });
})();
