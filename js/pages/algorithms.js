/*
 * Algorithm information page, rendered from js/data/algorithm-info.js.
 * The GBFS section also contains a worked example traced live by the real implementation.
 */
(function () {
  'use strict';
  const EP = window.EP;
  const P = EP.puzzle;
  const ui = EP.ui;
  const esc = ui.esc;
  const $ = (id) => document.getElementById(id);

  const ORDER = ['gbfs', 'bfs', 'dfs', 'dls', 'iddls', 'ucs', 'astar'];

  const GBFS_PSEUDOCODE = `function GREEDY-BEST-FIRST-SEARCH(problem, h) returns a solution or failure
    node ← NODE(state = problem.INITIAL, g = 0)
    frontier ← priority queue ordered by h(n), containing node
    explored ← empty set
    loop do
        if EMPTY(frontier) then return failure
        node ← POP(frontier)                     ▷ lowest h(n); ties: first in, first out
        if problem.GOAL-TEST(node.state) then return SOLUTION(node)
        add node.state to explored
        for each action in problem.ACTIONS(node.state) do
            child ← CHILD-NODE(problem, node, action)        ▷ g = node.g + 1
            if child.state ∉ explored and child.state ∉ frontier then
                INSERT(child, frontier) with priority h(child.state)`;

  function yesNo(v) {
    const ok = v.startsWith('Yes');
    return `<span class="badge text-bg-${ok ? 'success' : 'danger'} prop-badge">${esc(v)}</span>`;
  }

  function renderNav() {
    const items = [['overview', 'Overview'], ['heuristics', 'Heuristic functions']].concat(
      ORDER.map((k) => [k, `${EP.algorithms[k].short}: ${EP.algorithms[k].name}${k === EP.config.assignedAlgorithm ? ' ★' : ''}`])
    );
    $('algoNav').innerHTML = items.map(([id, label]) => `<a class="list-group-item list-group-item-action" href="#${id}">${esc(label)}</a>`).join('');
  }

  function renderOverview() {
    $('overviewBody').innerHTML = EP.ALGORITHM_ORDER.map((k) => {
      const a = EP.algorithms[k];
      const info = EP.algorithmInfo[k];
      return `<tr${k === EP.config.assignedAlgorithm ? ' class="table-active"' : ''}>
        <td><a href="#${k}" class="fw-semibold text-decoration-none">${esc(a.short)}</a>${k === EP.config.assignedAlgorithm ? ' <span class="badge badge-assigned">Assigned</span>' : ''}</td>
        <td class="small">${esc(a.type)}</td>
        <td class="small">${esc(info.evaluation)}</td>
        <td class="small font-monospace">${esc(info.time)}</td>
        <td class="small font-monospace">${esc(info.space)}</td>
        <td>${yesNo(info.complete)}</td>
        <td>${yesNo(info.optimal)}</td></tr>`;
    }).join('');
  }

  function renderHeuristics() {
    const goal = P.DEFAULT_GOAL;
    const start = P.EXAMPLE_START;
    const h1 = EP.createHeuristic('misplaced', goal)(start);
    const h2 = EP.createHeuristic('manhattan', goal)(start);
    $('heuristicsBody').innerHTML = `
      <p class="small">A heuristic <b>h(n)</b> estimates the cost of the cheapest path from node n to the goal. GBFS orders its
        frontier by h(n) alone, and A* by g(n) + h(n). Both heuristics below are <b>admissible</b> (never overestimate) and <b>consistent</b>
        (h(n) ≤ 1 + h(n′) for every move n → n′). The blank is never counted.</p>
      <div class="row g-4">
        ${['misplaced', 'manhattan']
          .map((k) => {
            const h = EP.heuristics[k];
            return `<div class="col-md-6"><div class="border rounded-3 p-3 h-100">
              <h3 class="h6 fw-bold">${esc(h.name)}</h3>
              <div class="formula mb-2">${esc(h.formula)}</div>
              <p class="small mb-0">${esc(h.description)}</p></div></div>`;
          })
          .join('')}
      </div>
      <div class="d-flex flex-wrap align-items-center gap-4 mt-4">
        <div class="text-center">${ui.miniBoard(start, { size: 'lg', goal })}<div class="small mt-1">Example state</div></div>
        <div class="text-center">${ui.miniBoard(goal, { size: 'lg', goal })}<div class="small mt-1">Goal</div></div>
        <div class="small">
          <div>Misplaced tiles: <b>h₁ = ${h1}</b> (tiles 2, 8, 1 and 6 are out of place)</div>
          <div>Manhattan distance: <b>h₂ = ${h2}</b> (2 → 1, 8 → 2, 1 → 1, 6 → 1)</div>
          <div class="text-body-secondary mt-1">True optimal cost: 5 moves, so h₁ ≤ h₂ ≤ h*.</div>
        </div>
      </div>`;
  }

  function sectionHtml(k) {
    const a = EP.algorithms[k];
    const info = EP.algorithmInfo[k];
    const assigned = k === EP.config.assignedAlgorithm;
    return `<section id="${k}" class="card mb-4${assigned ? ' border-2' : ''}"${assigned ? ' style="border-color: var(--ep-accent)"' : ''}>
      <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span class="fs-6">${esc(a.name)} (${esc(a.short)}) ${assigned ? '<span class="badge badge-assigned ms-1">Assigned algorithm · No. 6</span>' : ''}</span>
        <span class="d-flex gap-1"><span class="badge text-bg-secondary prop-badge">${esc(a.type)}</span>
          <span class="badge bg-accent-soft text-accent prop-badge">${esc(info.evaluation)}</span></span>
      </div>
      <div class="card-body">
        <h3 class="h6 fw-bold">Description</h3>
        <p class="small">${esc(info.description)}</p>
        <h3 class="h6 fw-bold">Working principle</h3>
        <ol class="small">${info.principle.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${assigned ? `<h3 class="h6 fw-bold">Pseudocode (graph search)</h3><pre class="pseudocode">${esc(GBFS_PSEUDOCODE)}</pre>` : ''}
        <div class="row g-3 mb-3">
          <div class="col-md-6"><div class="border rounded-3 p-3 h-100">
            <h3 class="h6 fw-bold text-success"><i class="bi bi-hand-thumbs-up"></i> Advantages</h3>
            <ul class="small mb-0">${info.advantages.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div>
          <div class="col-md-6"><div class="border rounded-3 p-3 h-100">
            <h3 class="h6 fw-bold text-danger"><i class="bi bi-hand-thumbs-down"></i> Limitations</h3>
            <ul class="small mb-0">${info.limitations.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-bordered small mb-2">
            <tbody>
              <tr><th class="w-25">Time complexity</th><td class="font-monospace">${esc(info.time)}</td></tr>
              <tr><th>Space complexity</th><td class="font-monospace">${esc(info.space)}</td></tr>
              <tr><th>Completeness</th><td>${yesNo(info.complete)} <span class="text-body-secondary">${esc(info.completeNote || '')}</span></td></tr>
              <tr><th>Optimality</th><td>${yesNo(info.optimal)} <span class="text-body-secondary">${esc(info.optimalNote || '')}</span></td></tr>
            </tbody>
          </table>
        </div>
        ${info.implementationNote ? `<p class="small text-body-secondary"><i class="bi bi-info-circle"></i> <b>Implementation note:</b> ${esc(info.implementationNote)}</p>` : ''}
        ${assigned ? '<div id="gbfsExample"></div>' : ''}
        <a class="btn btn-sm btn-outline-secondary" href="solver.html?algo=${k}"><i class="bi bi-play-circle"></i> Try ${esc(a.short)} in the solver</a>
      </div></section>`;
  }

  /** Live GBFS trace on the assignment example, plus a generated case where GBFS is not optimal. */
  function renderGbfsExample() {
    const el = $('gbfsExample');
    if (!el) return;
    const goal = P.DEFAULT_GOAL;
    const start = P.EXAMPLE_START;
    const r = EP.solve('gbfs', { start, goal, heuristic: 'manhattan', trace: true });
    const rMis = EP.solve('gbfs', { start, goal, heuristic: 'misplaced' });

    const rows = r.steps
      .map((s, i) => {
        const c = s.current;
        const succ = s.successors.length
          ? s.successors
              .map(
                (x) => `<div class="d-inline-flex flex-column align-items-center me-2 mb-1">${ui.miniBoard(x.state, { size: 'sm', parent: c.state, goal })}
                <span class="${x.status === 'added' ? '' : 'text-body-secondary text-decoration-line-through'}">h=${x.h}</span></div>`
              )
              .join('')
          : `<span class="text-success fw-semibold">Goal ✓</span>`;
        const frontier = s.frontier.map((n) => n.h).join(', ') || '∅';
        return `<tr><td class="text-center">${i}</td>
          <td>${ui.miniBoard(c.state, { parent: c.parentState, goal })}<div class="text-center">h=${c.h}, g=${c.g}</div></td>
          <td>${succ}</td><td class="font-monospace">[${frontier}]</td></tr>`;
      })
      .join('');

    // Find a deterministic random instance where GBFS returns a longer path than optimal
    let seed = 2024;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let counter = null;
    for (let t = 0; t < 300 && !counter; t++) {
      const s = P.randomPuzzle(goal, 'random', rng);
      const g = EP.solve('gbfs', { start: s, goal, heuristic: 'manhattan' });
      const a = EP.solve('astar', { start: s, goal, heuristic: 'manhattan' });
      if (g.moves > a.moves + 4) counter = { s, g, a };
    }

    el.innerHTML = `
      <h3 class="h6 fw-bold mt-2">Worked example: GBFS + Manhattan on the assignment puzzle</h3>
      <p class="small">Each row is one expansion. Successors crossed out were discarded (already explored or already in the frontier).
        The last column lists the h-values in the frontier after the expansion; GBFS always pops the smallest.
        Traced live by the implementation in <code>js/algorithms/gbfs.js</code>.</p>
      <div class="table-responsive mb-2">
        <table class="table table-sm table-bordered small align-middle">
          <thead class="table-light"><tr><th>Step</th><th>Expanded node</th><th>Generated successors (h)</th><th>Frontier h-values</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="small">Result: <b>${r.moves}</b> moves, <b>${r.expanded}</b> nodes expanded, ${r.generated} generated.
        With Misplaced Tiles GBFS needs ${rMis.expanded} expansions and finds a ${rMis.moves}-move solution.</p>
      ${
        counter
          ? `<div class="alert alert-warning small">
              <b>Why GBFS is not optimal:</b> for the initial state <span class="font-monospace">${esc(P.format(counter.s, ' / '))}</span>,
              GBFS (Manhattan) returns a <b>${counter.g.moves}-move</b> solution after ${counter.g.expanded} expansions, while A* finds the optimal
              <b>${counter.a.moves}-move</b> solution (${counter.a.expanded} expansions). GBFS commits to whatever looks closest and never accounts for the moves already made.
              <a class="alert-link" href="solver.html?algo=gbfs&h=manhattan&start=${counter.s}&goal=${goal}">Open this case in the solver →</a>
            </div>`
          : ''
      }`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    renderOverview();
    renderHeuristics();
    $('algoSections').innerHTML = ORDER.map(sectionHtml).join('');
    renderGbfsExample();
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) target.scrollIntoView();
    }
  });
})();
