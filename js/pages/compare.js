/*
 * Heuristic comparison page.
 * Runs Greedy Best-First Search with Manhattan Distance and with Misplaced Tiles
 *  1) on the same puzzle instance (table + charts), and
 *  2) on a batch of random solvable puzzles (averages),
 * then writes observations and offers a CSV download.
 */
(function () {
  'use strict';
  const EP = window.EP;
  const ui = EP.ui;
  const esc = ui.esc;
  const $ = (id) => document.getElementById(id);

  const HEURISTICS = ['manhattan', 'misplaced'];
  const NAME = { manhattan: 'Manhattan Distance', misplaced: 'Misplaced Tiles' };

  let setup;
  let last = null; // { puzzle, single: {h: result}, batch: {h: stats} | null }

  const fmt = (v) => (v == null ? '—' : v.toLocaleString());
  const fmt1 = (v) => (v == null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 1 }));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------- same puzzle
  function singleRow(h, r, hStart) {
    const head = `<td><div class="fw-semibold">GBFS + ${esc(NAME[h])}</div><div class="small text-body-secondary">${h === 'manhattan' ? 'h₂(n)' : 'h₁(n)'}</div></td>`;
    if (!r) {
      return `<tr>${head}<td colspan="8" class="text-body-secondary small"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Running…</td></tr>`;
    }
    const found = r.found
      ? '<span class="badge text-bg-success">Yes</span>'
      : `<span class="badge text-bg-danger">No</span><div class="small text-body-secondary">${esc(EP.describeStatus(r))}</div>`;
    const memLabel = EP.memoryLabel(r.peakNodes);
    const memColor = { Low: 'success', Medium: 'warning', High: 'danger' }[memLabel];
    return `<tr${h === 'manhattan' ? ' class="assigned-row"' : ''}>${head}
      <td class="text-end">${hStart}</td>
      <td>${found}</td>
      <td class="text-end">${fmt(r.moves)}</td>
      <td class="text-end">${fmt(r.generated)}</td>
      <td class="text-end">${fmt(r.expanded)}</td>
      <td class="text-end">${fmt(r.maxDepth)}</td>
      <td class="text-end">${EP.formatTime(r.timeMs)}</td>
      <td><span class="badge text-bg-${memColor}">${memLabel}</span><div class="small text-body-secondary">≈ ${EP.formatBytes(r.memoryBytes)}</div></td></tr>`;
  }

  function renderSingle(puzzle, single) {
    $('resultsBody').innerHTML = HEURISTICS.map((h) => singleRow(h, single[h], EP.createHeuristic(h, puzzle.goal)(puzzle.start))).join('');
  }

  function renderCharts(single) {
    const rows = (fn, display) =>
      HEURISTICS.map((h) => ({
        label: NAME[h],
        value: single[h] ? fn(single[h]) : null,
        display: single[h] && display ? display(single[h]) : null,
        highlight: h === 'manhattan',
      }));
    ui.barChart($('chartExpanded'), rows((r) => r.expanded, (r) => r.expanded.toLocaleString()));
    ui.barChart($('chartTime'), rows((r) => r.timeMs, (r) => EP.formatTime(r.timeMs)));
    ui.barChart($('chartMemory'), rows((r) => r.peakNodes, (r) => r.peakNodes.toLocaleString()));
    ui.barChart($('chartMoves'), rows((r) => (r.found ? r.moves : null), (r) => (r.found ? r.moves.toLocaleString() : 'not found')));
  }

  // --------------------------------------------------------- batch test
  async function runBatch(goal, n, onProgress) {
    const stats = {};
    HEURISTICS.forEach((h) => (stats[h] = { solved: 0, moves: 0, expanded: 0, maxExpanded: 0, time: 0, peak: 0, wins: 0 }));
    let ties = 0;
    for (let i = 0; i < n; i++) {
      const start = EP.puzzle.randomPuzzle(goal, 'random');
      const res = {};
      for (const h of HEURISTICS) {
        const r = EP.solve('gbfs', { start, goal, heuristic: h });
        res[h] = r;
        const s = stats[h];
        if (r.found) {
          s.solved++;
          s.moves += r.moves;
        }
        s.expanded += r.expanded;
        s.maxExpanded = Math.max(s.maxExpanded, r.expanded);
        s.time += r.timeMs;
        s.peak += r.peakNodes;
      }
      if (res.manhattan.expanded < res.misplaced.expanded) stats.manhattan.wins++;
      else if (res.misplaced.expanded < res.manhattan.expanded) stats.misplaced.wins++;
      else ties++;
      if (i % 5 === 4) {
        onProgress(i + 1);
        await sleep(0); // keep the page responsive
      }
    }
    HEURISTICS.forEach((h) => {
      const s = stats[h];
      s.avgMoves = s.solved ? s.moves / s.solved : null;
      s.avgExpanded = s.expanded / n;
      s.avgTime = s.time / n;
      s.avgPeak = s.peak / n;
    });
    stats.n = n;
    stats.ties = ties;
    return stats;
  }

  function renderBatch(stats) {
    if (!stats) {
      $('batchBody').innerHTML = '<tr><td colspan="8" class="text-center text-body-secondary py-3 small">Batch test skipped (batch size: none).</td></tr>';
      $('batchInfo').textContent = '';
      return;
    }
    $('batchInfo').textContent = `${stats.n} fully random solvable puzzles · same puzzles for both heuristics`;
    $('batchBody').innerHTML = HEURISTICS.map((h) => {
      const s = stats[h];
      return `<tr${h === 'manhattan' ? ' class="assigned-row"' : ''}>
        <td class="fw-semibold">GBFS + ${esc(NAME[h])}</td>
        <td class="text-end">${s.solved} / ${stats.n}</td>
        <td class="text-end">${fmt1(s.avgMoves)}</td>
        <td class="text-end">${fmt1(s.avgExpanded)}</td>
        <td class="text-end">${fmt(s.maxExpanded)}</td>
        <td class="text-end">${EP.formatTime(s.avgTime)}</td>
        <td class="text-end">${fmt1(s.avgPeak)} nodes</td>
        <td class="text-end">${s.wins} puzzle${s.wins === 1 ? '' : 's'}</td></tr>`;
    }).join('');
  }

  // ------------------------------------------------------- observations
  function observations(puzzle, single, batch) {
    const out = [];
    const m = single.manhattan;
    const x = single.misplaced;
    const hm = EP.createHeuristic('manhattan', puzzle.goal)(puzzle.start);
    const hx = EP.createHeuristic('misplaced', puzzle.goal)(puzzle.start);
    out.push(
      `For the initial state, Manhattan Distance estimates <b>${hm}</b> and Misplaced Tiles estimates <b>${hx}</b>. Manhattan is always ≥ Misplaced (it <i>dominates</i> it), so it gives GBFS a more informed estimate.`
    );
    if (m && x) {
      const better = m.expanded <= x.expanded ? 'manhattan' : 'misplaced';
      const worse = better === 'manhattan' ? 'misplaced' : 'manhattan';
      const factor = single[worse].expanded / Math.max(single[better].expanded, 1);
      out.push(
        `On this puzzle GBFS + <b>${NAME[better]}</b> expanded <b>${fmt(single[better].expanded)}</b> nodes against ${fmt(single[worse].expanded)} with ${NAME[worse]}` +
          (factor >= 1.2 ? ` (about <b>${factor.toFixed(factor >= 10 ? 0 : 1)}×</b> fewer).` : '.')
      );
      if (m.found && x.found) {
        out.push(
          m.moves === x.moves
            ? `Both heuristics led to a ${m.moves}-move solution.`
            : `The solutions have different lengths: <b>${m.moves}</b> moves with Manhattan and <b>${x.moves}</b> with Misplaced Tiles. GBFS returns the first path it reaches, not the shortest one, so the heuristic also changes the path.`
        );
      }
    }
    if (batch) {
      const bm = batch.manhattan;
      const bx = batch.misplaced;
      out.push(
        `Over <b>${batch.n}</b> random puzzles, GBFS expanded on average <b>${fmt1(bm.avgExpanded)}</b> nodes with Manhattan and <b>${fmt1(bx.avgExpanded)}</b> with Misplaced Tiles. Manhattan needed fewer expansions on ${bm.wins} puzzles, Misplaced on ${bx.wins}${batch.ties ? `, with ${batch.ties} ties` : ''}.`
      );
      out.push(
        `Average solution length was ${fmt1(bm.avgMoves)} moves (Manhattan) and ${fmt1(bx.avgMoves)} moves (Misplaced). Random puzzles need about 22 moves when solved optimally, so these longer paths show that GBFS is not optimal.`
      );
      out.push(`Both heuristics solved every puzzle (${bm.solved}/${batch.n} and ${bx.solved}/${batch.n}). Graph-search GBFS is complete on the finite 8-puzzle state space.`);
    }
    $('observations').innerHTML = `<ul class="mb-0 ps-3">${out.map((o) => `<li class="mb-2">${o}</li>`).join('')}</ul>`;
  }

  // ---------------------------------------------------------------- CSV
  function toCsv(res) {
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [['Section', 'Heuristic', 'Solution Found / Solved', 'Moves (avg for batch)', 'Nodes Generated', 'Nodes Expanded (avg for batch)', 'Max Depth / Max Expanded', 'Time (ms)', 'Peak Nodes (avg for batch)', 'Memory (bytes, approx)']];
    HEURISTICS.forEach((h) => {
      const r = res.single[h];
      lines.push(['Same puzzle', NAME[h], r.found ? 'Yes' : 'No', r.moves, r.generated, r.expanded, r.maxDepth, r.timeMs.toFixed(3), r.peakNodes, r.memoryBytes]);
    });
    if (res.batch) {
      HEURISTICS.forEach((h) => {
        const s = res.batch[h];
        lines.push([`Batch (${res.batch.n} random)`, NAME[h], `${s.solved}/${res.batch.n}`, s.avgMoves && s.avgMoves.toFixed(2), '', s.avgExpanded.toFixed(2), s.maxExpanded, s.avgTime.toFixed(3), s.avgPeak.toFixed(1), '']);
      });
    }
    return lines.map((l) => l.map(q).join(',')).join('\r\n');
  }

  // ---------------------------------------------------------------- run
  async function runComparison() {
    const p = setup.read();
    if (!p.ok) {
      $('resultsBody').innerHTML = `<tr><td colspan="9" class="text-danger small py-3"><i class="bi bi-exclamation-triangle"></i> ${esc(p.error)}</td></tr>`;
      return;
    }
    const puzzle = { start: p.start, goal: p.goal };
    const n = parseInt($('batchSize').value, 10) || 0;
    const btn = $('btnCompare');
    btn.disabled = true;
    $('btnCsv').disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Running…';
    $('instanceInfo').innerHTML = `Initial <span class="font-monospace">${esc(EP.puzzle.format(p.start, ' / '))}</span> → Goal <span class="font-monospace">${esc(EP.puzzle.format(p.goal, ' / '))}</span>`;

    const single = {};
    renderSingle(puzzle, single);
    await sleep(30);
    for (const h of HEURISTICS) {
      single[h] = EP.timedRun('gbfs', { start: p.start, goal: p.goal, heuristic: h });
      renderSingle(puzzle, single);
      await sleep(15);
    }
    renderCharts(single);

    let batch = null;
    if (n > 0) {
      $('batchBody').innerHTML = `<tr><td colspan="8" class="text-body-secondary small py-3"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span><span id="batchProgress">Solving 0 / ${n} random puzzles…</span></td></tr>`;
      batch = await runBatch(p.goal, n, (k) => {
        const el = $('batchProgress');
        if (el) el.textContent = `Solving ${k} / ${n} random puzzles…`;
      });
    }
    renderBatch(batch);
    observations(puzzle, single, batch);

    last = { puzzle, single, batch };
    btn.disabled = false;
    $('btnCsv').disabled = false;
    btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Run Comparison Again';
  }

  document.addEventListener('DOMContentLoaded', () => {
    setup = new ui.PuzzleSetup($('setup'), {
      onChange: () => {
        if (last) $('instanceInfo').innerHTML = '<span class="text-warning-emphasis">Puzzle changed: run the comparison again</span>';
      },
    });
    $('btnCompare').addEventListener('click', runComparison);
    $('btnCsv').addEventListener('click', () => {
      if (!last) return;
      const blob = new Blob([toCsv(last)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gbfs-heuristic-comparison-${last.puzzle.start}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
    });

    // URL parameters: ?start=702645381&goal=123804765&autorun=1
    const q = new URLSearchParams(location.search);
    if (q.get('start') && q.get('goal')) {
      const s = EP.puzzle.parseState(q.get('start'));
      const g = EP.puzzle.parseState(q.get('goal'));
      if (s.ok && g.ok) setup.set(s.state, g.state, { silent: true });
    }
    if (q.get('autorun')) runComparison();
  });
})();
