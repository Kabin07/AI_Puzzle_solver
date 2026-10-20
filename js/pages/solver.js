/*
 * Solver page controller.
 *
 * Pressing Run computes the whole search once (recording a snapshot per
 * expansion), then plays back a list of frames:
 *     [ search snapshot 0 … search snapshot k ][ solution move 0 … solution move m ]
 * Run / Pause / Resume / Next / Previous / Skip / Reset / Speed only move the
 * playback index, so stepping backwards is exact.
 */
(function () {
  'use strict';
  const EP = window.EP;
  const P = EP.puzzle;
  const ui = EP.ui;
  const esc = ui.esc;

  const SPEEDS = [1400, 1000, 750, 550, 400, 280, 180, 100, 45, 12]; // ms per frame
  const MAX_PATH_RENDER = 400;
  const $ = (id) => document.getElementById(id);

  let els;
  let setup;
  let boards;
  let puzzle = null; // last valid { start, goal }
  let run = null; // { result, frames, searchCount, algo, informed, chartValues, optimal }
  let index = -1;
  let timer = null;
  let playing = false;

  // ---------------------------------------------------------------- helpers
  const fmt = (v) => (v == null ? '—' : typeof v === 'number' ? v.toLocaleString() : v);
  const clampInt = (v, lo, hi, dflt) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
  };
  const delay = () => SPEEDS[clampInt(els.speed.value, 1, 10, 5) - 1];
  const actionArrow = (a) => (a ? P.ACTIONS[a].arrow : '');

  function settings() {
    return {
      algorithm: els.algo.value,
      heuristic: document.querySelector('input[name="heuristic"]:checked').value,
      depthLimit: clampInt(els.depthLimit.value, 0, 60, 10),
      maxDepth: clampInt(els.maxDepth.value, 0, 60, 31),
    };
  }

  function stat(label, value, accent = false, title = '') {
    return `<div class="stat${accent ? ' stat-accent' : ''}"${title ? ` title="${esc(title)}"` : ''}>
      <div class="label">${label}</div><div class="value">${value}</div></div>`;
  }

  function showAlert(html, kind = 'danger') {
    els.alert.innerHTML = html
      ? `<div class="alert alert-${kind} alert-dismissible small py-2" role="alert">${html}
          <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert" aria-label="Close"></button></div>`
      : '';
  }

  // ------------------------------------------------------- algorithm panel
  function evalLabel(key) {
    return { gbfs: 'f(n) = h(n)', astar: 'f(n) = g(n) + h(n)', ucs: 'f(n) = g(n)' }[key] || EP.algorithms[key].frontierKind;
  }

  function updateAlgoUI() {
    const key = els.algo.value;
    const algo = EP.algorithms[key];
    const info = EP.algorithmInfo[key];
    els.heuristicGroup.classList.toggle('d-none', !algo.informed);
    els.depthLimitGroup.classList.toggle('d-none', key !== 'dls');
    els.maxDepthGroup.classList.toggle('d-none', key !== 'iddls');
    els.evalBadge.textContent = evalLabel(key);
    els.blurb.innerHTML = `
      ${key === EP.config.assignedAlgorithm ? '<span class="badge badge-assigned mb-2">Assigned algorithm</span><br>' : ''}
      ${esc(info.summary)}
      <div class="mt-2"><b>Frontier:</b> ${esc(algo.frontierKind)}<br>
      <b>Complete:</b> ${info.complete} · <b>Optimal:</b> ${info.optimal}</div>
      <a class="d-inline-block mt-2 text-accent fw-semibold" href="algorithms.html#${key}">How ${esc(algo.short)} works →</a>`;
  }

  // ---------------------------------------------------------------- render
  function nodeCard(state, lines, opts = {}) {
    return `${ui.miniBoard(state, Object.assign({ size: 'lg', goal: puzzle.goal }, opts))}
      <div class="succ-meta">${lines.filter(Boolean).join('<br>')}</div>`;
  }

  function renderStats(step) {
    const c = step.current;
    const informed = run.informed;
    const items = [
      stat('Current node', c ? `#${c.id}` : '—', true),
      stat('Parent node', c && c.parentId ? `#${c.parentId}` : c ? 'root' : '—'),
      stat('Search depth', c ? c.depth : '—'),
      stat('Path cost g(n)', c ? c.g : '—', informed),
    ];
    if (informed) {
      items.push(stat('Heuristic h(n)', c ? c.h : '—', true));
      items.push(stat('Evaluation f(n)', c ? c.f : '—', true, evalLabel(run.algo)));
    } else if (run.algo === 'ucs') {
      items.push(stat('Evaluation f(n)', c ? c.f : '—', false, 'f(n) = g(n)'));
    }
    if (step.limit != null) items.push(stat('Depth limit ℓ', step.limit));
    items.push(
      stat('Nodes generated', fmt(step.generated)),
      stat('Nodes expanded', fmt(step.expanded)),
      stat('Frontier size', fmt(step.frontierSize)),
      stat('Explored size', fmt(step.exploredSize)),
      stat('Max depth so far', fmt(step.maxDepth))
    );
    els.statGrid.innerHTML = items.join('');
  }

  function renderNodes(step) {
    const c = step.current;
    if (!c) {
      els.currentNode.innerHTML = '<span>—</span>';
      els.parentNode.innerHTML = '<span>—</span>';
      return;
    }
    const hf = run.informed ? `h = <b>${c.h}</b> · f = <b>${c.f}</b>` : run.algo === 'ucs' ? `f = <b>${c.f}</b>` : '';
    els.currentNode.innerHTML = nodeCard(c.state, [`<b>Node #${c.id}</b>`, `depth ${c.depth} · g = <b>${c.g}</b>`, hf], {
      parent: c.parentState,
    });
    if (c.parentState) {
      els.parentNode.innerHTML = nodeCard(c.parentState, [`<b>Node #${c.parentId}</b>`, `move to child:`, `Blank ${actionArrow(c.action)} ${c.action}`]);
    } else {
      els.parentNode.innerHTML = '<span>Root node: no parent</span>';
    }
  }

  const STATUS = {
    added: ['success', 'Added to frontier'],
    explored: ['secondary', 'Already explored'],
    'in-frontier': ['warning', 'Already in frontier'],
    replaced: ['info', 'Cheaper path: replaced'],
  };

  function renderSuccessors(step) {
    const list = step.successors;
    if (!list.length) {
      const msg =
        step.kind === 'goal'
          ? 'Goal state selected: no expansion needed.'
          : step.kind === 'cutoff'
            ? 'Node is at the depth limit, so it is not expanded.'
            : step.kind === 'iteration'
              ? 'New iteration: the search restarts from the root.'
              : step.note || '—';
      els.successors.innerHTML = `<span>${esc(msg)}</span>`;
      els.succCount.textContent = '';
      return;
    }
    const parent = step.current.state;
    els.succCount.textContent = `${list.length} generated · ${list.filter((s) => s.status === 'added' || s.status === 'replaced').length} added`;
    els.successors.innerHTML = list
      .map((s) => {
        const [color, label] = STATUS[s.status];
        const nums = run.informed
          ? `g=${s.g} · <b>h=${s.h}</b> · f=${s.f}`
          : run.algo === 'ucs'
            ? `g=${s.g} · f=${s.f}`
            : `depth ${s.depth} · g=${s.g}`;
        return `<div class="succ-card status-${s.status}">
          ${ui.miniBoard(s.state, { parent, goal: puzzle.goal })}
          <div class="succ-meta"><b>#${s.id}</b> · Blank ${actionArrow(s.action)} ${s.action}<br>${nums}<br>
          <span class="badge text-bg-${color}">${label}</span></div></div>`;
      })
      .join('');
  }

  function renderLists(step) {
    const kind = EP.algorithms[run.algo].frontierKind;
    els.frontierTitle.textContent = `${fmt(step.frontierSize)} nodes · ${kind}${step.frontierSize > step.frontier.length ? ` · top ${step.frontier.length}` : ''}`;
    if (!step.frontier.length) {
      els.frontierList.innerHTML = '<span class="small text-body-secondary">Frontier is empty.</span>';
    } else {
      els.frontierList.innerHTML = step.frontier
        .map((n, i) => {
          const vals = run.informed
            ? `<span>g=${n.g}</span><span class="fw-bold">h=${n.h}</span><span>f=${n.f}</span>`
            : run.algo === 'ucs'
              ? `<span>g=${n.g}</span><span class="fw-bold">f=${n.f}</span>`
              : `<span>depth ${n.depth}</span><span>g=${n.g}</span>`;
          return `<div class="list-row${i === 0 ? ' next-up' : ''}">
            <span class="rank">${i + 1}</span>${ui.miniBoard(n.state, { size: 'sm', goal: puzzle.goal })}
            <span class="text-body-secondary">#${n.id}</span>
            <span class="d-flex gap-2 ms-auto">${vals}</span>
            ${i === 0 ? '<span class="badge bg-accent-soft text-accent">next</span>' : ''}</div>`;
        })
        .join('');
    }
    els.exploredTitle.textContent = `${fmt(step.exploredSize)} states${step.explored.length ? ' · newest first' : ''}`;
    els.exploredList.innerHTML = step.explored.length
      ? step.explored.map((s) => ui.miniBoard(s, { size: 'sm', goal: puzzle.goal })).join('')
      : '<span class="small text-body-secondary">Nothing explored yet.</span>';
  }

  function renderChart(stepIndex) {
    ui.lineChart(els.chart, run.chartValues, {
      upto: stepIndex,
      yLabel: run.informed ? 'h(n) of expanded node' : 'Depth of expanded node',
    });
  }

  function renderSearch(step, stepIndex) {
    const c = step.current;
    boards.current.setState(c ? c.state : puzzle.start);
    els.currentTitle.textContent = 'Current state (node being expanded)';
    let caption;
    if (step.kind === 'expand') caption = `Expanding node #${c.id} at depth ${c.depth}${run.informed ? ` · h(n) = ${c.h}` : ''}`;
    else if (step.kind === 'goal') caption = `✓ Goal test passed on node #${c.id}. ${step.note}`;
    else caption = step.note;
    els.caption.textContent = caption;
    renderStats(step);
    renderNodes(step);
    renderSuccessors(step);
    renderLists(step);
    renderChart(stepIndex);
    setActivePathStep(-1);
  }

  function renderSolution(i) {
    const path = run.result.path;
    const node = path[i];
    boards.current.setState(node.state);
    els.currentTitle.textContent = `Solution path · step ${i} of ${run.result.moves}`;
    const prev = i > 0 ? path[i - 1].state : null;
    const tile = prev ? node.state[prev.indexOf('0')] : null;
    const h = run.informed ? ` · h(n) = ${node.h}` : '';
    els.caption.textContent = `Step ${i}: ${P.describeMove(node.action, tile)} · g(n) = ${node.g}${h}`;
    setActivePathStep(i);
  }

  function setActivePathStep(i) {
    const prev = els.pathList.querySelector('.path-step.active');
    if (prev) prev.classList.remove('active');
    if (i < 0) return;
    const el = els.pathList.querySelector(`[data-i="${i}"]`);
    if (el) {
      el.classList.add('active');
      const box = els.pathBox;
      const top = el.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTop = top - box.clientHeight / 2 + el.offsetHeight / 2;
      }
    }
  }

  function renderPath() {
    const r = run.result;
    if (!r.found) {
      els.pathCard.classList.add('d-none');
      return;
    }
    const shown = r.path.slice(0, MAX_PATH_RENDER);
    els.pathMeta.textContent = `${r.moves} move${r.moves === 1 ? '' : 's'}${r.path.length > MAX_PATH_RENDER ? ` · showing first ${MAX_PATH_RENDER} states` : ''} · click a step to jump to it`;
    els.pathList.innerHTML = shown
      .map((n, i) => {
        const prev = i > 0 ? r.path[i - 1].state : null;
        const label = n.action ? `${actionArrow(n.action)} ${n.action}` : 'Start';
        return `${i > 0 ? '<span class="path-arrow">→</span>' : ''}
          <div class="path-step" data-i="${i}" role="button" tabindex="0" aria-label="Go to step ${i}">
            <span class="fw-semibold">Step ${i}</span>${ui.miniBoard(n.state, { parent: prev, goal: puzzle.goal })}<span class="text-body-secondary">${label}</span>
          </div>`;
      })
      .join('');
    els.pathCard.classList.remove('d-none');
  }

  function renderSummary() {
    const r = run.result;
    const algo = EP.algorithms[run.algo];
    const optimal = run.optimal;
    const items = [
      stat('Result', r.found ? '<span class="text-success">Solution found</span>' : '<span class="text-danger">Not found</span>', true),
      stat('Total moves', fmt(r.moves), true),
      stat('Path cost', fmt(r.cost)),
      stat('Nodes generated', fmt(r.generated)),
      stat('Nodes expanded', fmt(r.expanded)),
      stat('Max search depth', fmt(r.maxDepth)),
      stat('Execution time', EP.formatTime(r.timeMs), false, `Measured without visualisation overhead${r.timingRuns > 1 ? ` (average of ${r.timingRuns} runs)` : ''}`),
      stat('Memory (approx.)', `${EP.formatBytes(r.memoryBytes)}`, false, `Peak ${r.peakNodes.toLocaleString()} nodes held × ~${EP.BYTES_PER_NODE} B/node`),
    ];
    const notes = [];
    notes.push(`<b>${esc(algo.name)}</b>${algo.informed ? ` with <b>${esc(EP.heuristics[r.heuristic].name)}</b>` : ''}: ${esc(EP.describeStatus(r))}.`);
    notes.push(`Peak memory: <b>${r.peakNodes.toLocaleString()}</b> nodes in frontier + explored (${EP.memoryLabel(r.peakNodes)}).`);
    if (r.iterations) notes.push(`Iterative deepening ran <b>${r.iterations}</b> iteration(s), final depth limit ${r.finalLimit}.`);
    if (optimal != null) {
      if (r.found) {
        notes.push(
          r.moves === optimal
            ? `<span class="text-success"><i class="bi bi-patch-check"></i> This solution is optimal (shortest possible = ${optimal} moves).</span>`
            : `<span class="text-warning-emphasis"><i class="bi bi-exclamation-diamond"></i> Not optimal: the shortest solution has ${optimal} moves, ${(r.moves - optimal).toLocaleString()} fewer than this one.</span>`
        );
      } else if (r.status === 'cutoff' && run.algo === 'dls') {
        notes.push(`Hint: the shortest solution needs ${optimal} moves. Set the depth limit to at least ${optimal}.`);
      }
    }
    if (r.truncated) {
      notes.push(
        `<span class="text-warning-emphasis"><i class="bi bi-info-circle"></i> The step-by-step view shows the first ${r.steps.length - 1} of ${r.expanded.toLocaleString()} expansions plus the final step. All statistics cover the full search.</span>`
      );
    }
    if (r.found && r.moves > 0 && r.moves <= 200) {
      notes.push(`Moves of the blank: <span class="font-monospace">${r.path.slice(1).map((n) => actionArrow(n.action)).join(' ')}</span>`);
    }
    els.summaryBody.innerHTML = `<div class="stat-grid mb-3">${items.join('')}</div><ul class="small mb-0 ps-3">${notes.map((n) => `<li class="mb-1">${n}</li>`).join('')}</ul>`;
    els.summaryCard.classList.remove('d-none');
  }

  // -------------------------------------------------------------- playback
  function show(i) {
    if (!run) return;
    index = Math.max(0, Math.min(i, run.frames.length - 1));
    const fr = run.frames[index];
    boards.current.setDuration(Math.min(320, delay() * 0.85));
    if (fr.type === 'search') {
      renderSearch(fr.step, index);
      run.shownSearch = index;
    } else {
      // jumping straight into the solution: make the search panels show the final search step
      if (run.shownSearch !== run.searchCount - 1) {
        renderSearch(run.frames[run.searchCount - 1].step, run.searchCount - 1);
        run.shownSearch = run.searchCount - 1;
      }
      renderSolution(fr.i);
    }
    if (index >= run.searchCount - 1 && els.summaryCard.classList.contains('d-none')) renderSummary();
    updateProgress();
    updateControls();
  }

  function updateProgress() {
    if (!run) {
      els.phase.textContent = 'Ready';
      els.progress.style.width = '0%';
      return;
    }
    const total = run.frames.length;
    const fr = run.frames[index];
    const last = index >= total - 1;
    if (fr.type === 'search') {
      els.phase.textContent = `${last ? 'Finished' : 'Searching'} · step ${index + 1} / ${run.searchCount}`;
    } else {
      els.phase.textContent = `${last ? 'Finished' : 'Solution'} · move ${fr.i} / ${run.result.moves}`;
    }
    els.progress.style.width = `${((index + 1) / total) * 100}%`;
  }

  function updateControls() {
    const has = !!run;
    const last = has ? run.frames.length - 1 : -1;
    els.btnPause.disabled = !playing;
    els.btnResume.disabled = playing || !has || index >= last;
    els.btnPrev.disabled = !has || index <= 0;
    els.btnNext.disabled = !has || index >= last;
    els.btnSkip.disabled = !has || index >= last;
    els.btnRun.innerHTML = has ? '<i class="bi bi-arrow-repeat"></i> Run again' : '<i class="bi bi-play-fill"></i> Run';
  }

  function tick() {
    if (!playing || !run) return;
    if (index < run.frames.length - 1) show(index + 1);
    if (index >= run.frames.length - 1) {
      playing = false;
      updateControls();
    } else {
      timer = setTimeout(tick, delay());
    }
  }

  function play() {
    if (!run || index >= run.frames.length - 1) return;
    playing = true;
    clearTimeout(timer);
    timer = setTimeout(tick, delay());
    updateControls();
  }

  function pause() {
    playing = false;
    clearTimeout(timer);
    updateControls();
  }

  function step(delta) {
    pause();
    show(index + delta);
  }

  function skip() {
    pause();
    if (!run) return;
    // first jump to the end of the search (or the start of the solution), then to the very end
    const target = index < run.searchCount - 1 ? (run.result.found ? run.searchCount : run.searchCount - 1) : run.frames.length - 1;
    show(target);
  }

  function reset() {
    pause();
    run = null;
    index = -1;
    showAlert('');
    els.summaryCard.classList.add('d-none');
    els.pathCard.classList.add('d-none');
    els.pathList.innerHTML = '';
    els.statGrid.innerHTML = '';
    els.currentNode.innerHTML = els.parentNode.innerHTML = '<span>—</span>';
    els.successors.innerHTML = '<span>—</span>';
    els.succCount.textContent = els.frontierTitle.textContent = els.exploredTitle.textContent = '';
    els.frontierList.innerHTML = '<span class="small text-body-secondary">—</span>';
    els.exploredList.innerHTML = '<span class="small text-body-secondary">—</span>';
    els.chart.innerHTML = '<span class="small text-body-secondary">Run a search to see the chart.</span>';
    els.currentTitle.textContent = 'Current state';
    els.caption.textContent = 'Press Run to start the search.';
    if (puzzle) boards.current.setState(puzzle.start, { animate: false });
    updateProgress();
    updateControls();
  }

  function runSearch(after) {
    const p = setup.read();
    if (!p.ok) {
      showAlert(`<i class="bi bi-exclamation-triangle"></i> ${esc(p.error)}`);
      return;
    }
    puzzleChanged(p, true);
    reset();
    const s = settings();
    els.phase.textContent = 'Searching…';
    els.btnRun.disabled = true;
    setTimeout(() => {
      try {
        const opts = { start: p.start, goal: p.goal, heuristic: s.heuristic, depthLimit: s.depthLimit, maxDepth: s.maxDepth };
        const result = EP.solveForVisualisation(s.algorithm, opts);
        const algo = EP.algorithms[s.algorithm];
        const isOptimalAlgo = ['bfs', 'iddls', 'ucs', 'astar'].includes(s.algorithm);
        const optimal =
          result.found && isOptimalAlgo ? result.moves : EP.solve('astar', { start: p.start, goal: p.goal, heuristic: 'manhattan' }).moves;
        const frames = result.steps.map((st) => ({ type: 'search', step: st }));
        const searchCount = frames.length;
        if (result.found) result.path.forEach((_, i) => frames.push({ type: 'solution', i }));
        run = {
          result,
          frames,
          searchCount,
          algo: s.algorithm,
          informed: algo.informed,
          optimal,
          chartValues: result.steps.map((st) => (st.current ? (algo.informed ? st.current.h : st.current.depth) : null)),
        };
        renderPath();
        show(0);
        if (after) after();
        else play();
      } catch (e) {
        showAlert(`Search failed: ${esc(e.message)}`);
        console.error(e);
      } finally {
        els.btnRun.disabled = false;
      }
    }, 20);
  }

  function puzzleChanged(p, keepRun) {
    if (!p.ok) return;
    const changed = !puzzle || puzzle.start !== p.start || puzzle.goal !== p.goal;
    puzzle = { start: p.start, goal: p.goal };
    if (!changed) return;
    boards.initial.setGoal(p.goal);
    boards.goal.setGoal(p.goal);
    boards.current.setGoal(p.goal);
    boards.initial.setState(p.start, { animate: false });
    boards.goal.setState(p.goal, { animate: false });
    if (!keepRun) reset();
  }

  // ------------------------------------------------------------------ init
  document.addEventListener('DOMContentLoaded', () => {
    els = {
      algo: $('algoSelect'),
      heuristicGroup: $('heuristicGroup'),
      depthLimitGroup: $('depthLimitGroup'),
      maxDepthGroup: $('maxDepthGroup'),
      depthLimit: $('depthLimit'),
      maxDepth: $('maxDepth'),
      blurb: $('algoBlurb'),
      evalBadge: $('evalBadge'),
      btnRun: $('btnRun'),
      btnPause: $('btnPause'),
      btnResume: $('btnResume'),
      btnPrev: $('btnPrev'),
      btnNext: $('btnNext'),
      btnSkip: $('btnSkip'),
      btnReset: $('btnReset'),
      speed: $('speed'),
      speedLabel: $('speedLabel'),
      phase: $('phaseLabel'),
      progress: $('progressBar'),
      alert: $('alertBox'),
      currentTitle: $('currentTitle'),
      caption: $('currentCaption'),
      statGrid: $('statGrid'),
      currentNode: $('currentNode'),
      parentNode: $('parentNode'),
      successors: $('successors'),
      succCount: $('succCount'),
      frontierList: $('frontierList'),
      frontierTitle: $('frontierTitle'),
      exploredList: $('exploredList'),
      exploredTitle: $('exploredTitle'),
      chart: $('chart'),
      summaryCard: $('summaryCard'),
      summaryBody: $('summaryBody'),
      pathCard: $('pathCard'),
      pathBox: $('pathBox'),
      pathList: $('pathList'),
      pathMeta: $('pathMeta'),
    };

    boards = {
      initial: new ui.AnimatedBoard($('boardInitial')),
      current: new ui.AnimatedBoard($('boardCurrent')),
      goal: new ui.AnimatedBoard($('boardGoal')),
    };

    setup = new ui.PuzzleSetup($('setup'), { onChange: (p) => puzzleChanged(p, false) });

    // URL parameters (handy for demos): ?algo=gbfs&h=manhattan&start=283164705&goal=123804765&speed=6&autorun=1&jump=solution
    const q = new URLSearchParams(location.search);
    if (q.get('start') && q.get('goal')) {
      const s = P.parseState(q.get('start'));
      const g = P.parseState(q.get('goal'));
      if (s.ok && g.ok) setup.set(s.state, g.state, { silent: true });
    }
    if (q.get('algo') && EP.algorithms[q.get('algo')]) els.algo.value = q.get('algo');
    if (q.get('h') && EP.heuristics[q.get('h')]) document.querySelector(`input[name="heuristic"][value="${q.get('h')}"]`).checked = true;
    if (q.get('speed')) els.speed.value = clampInt(q.get('speed'), 1, 10, 5);
    if (q.get('limit')) els.depthLimit.value = clampInt(q.get('limit'), 0, 60, 10);

    puzzleChanged(setup.read(), false);
    updateAlgoUI();

    els.algo.addEventListener('change', () => {
      updateAlgoUI();
      reset();
    });
    document.querySelectorAll('input[name="heuristic"], #depthLimit, #maxDepth').forEach((el) => el.addEventListener('change', reset));

    const syncSpeed = () => {
      els.speedLabel.textContent = `${delay()} ms`;
    };
    els.speed.addEventListener('input', syncSpeed);
    syncSpeed();

    els.btnRun.addEventListener('click', () => runSearch());
    els.btnPause.addEventListener('click', pause);
    els.btnResume.addEventListener('click', play);
    els.btnNext.addEventListener('click', () => step(1));
    els.btnPrev.addEventListener('click', () => step(-1));
    els.btnSkip.addEventListener('click', skip);
    els.btnReset.addEventListener('click', reset);
    els.pathList.addEventListener('click', (e) => {
      const el = e.target.closest('.path-step');
      if (el && run) {
        pause();
        show(run.searchCount + Number(el.dataset.i));
      }
    });
    els.pathList.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('path-step')) {
        e.preventDefault();
        e.target.click();
      }
    });

    document.addEventListener('keydown', (e) => {
      const t = e.target instanceof Element ? e.target : document.body;
      if (t.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' && t.closest('button, [role="button"], a')) return; // let Space activate the focused control
      if (e.key === ' ') {
        e.preventDefault();
        if (playing) pause();
        else if (run) play();
        else runSearch();
      } else if (e.key === 'ArrowRight' && run) {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft' && run) {
        e.preventDefault();
        step(-1);
      }
    });

    updateControls();

    if (q.get('autorun')) {
      const jump = q.get('jump');
      runSearch(
        jump
          ? () => {
              if (jump === 'end') show(run.frames.length - 1);
              else if (jump === 'solution') show(run.result.found ? run.searchCount : run.searchCount - 1);
              else show(clampInt(jump, 0, run.frames.length - 1, 0));
            }
          : null
      );
    }
  });
})();
