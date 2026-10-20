/*
 * Comparison page: runs every algorithm on the same puzzle instance and
 * reports found / moves / nodes / depth / time / memory, with charts and
 * automatically generated observations.
 */
(function () {
  'use strict';
  const EP = window.EP;
  const ui = EP.ui;
  const esc = ui.esc;
  const $ = (id) => document.getElementById(id);

  let setup;
  let lastRows = null;
  let lastPuzzle = null;

  const fmt = (v) => (v == null ? '—' : v.toLocaleString());
  const fmtTime = (ms) => EP.formatTime(ms);
  const clampInt = (v, lo, hi, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
  };
  const hShort = { manhattan: 'Manhattan', misplaced: 'Misplaced' };

  function plan() {
    const h = $('heuristic').value;
    const other = h === 'manhattan' ? 'misplaced' : 'manhattan';
    const depthLimit = clampInt($('depthLimit').value, 0, 60, 10);
    const maxDepth = clampInt($('maxDepth').value, 0, 60, 31);
    const runs = [
      { key: 'bfs' },
      { key: 'dfs' },
      { key: 'dls', depthLimit },
      { key: 'iddls', maxDepth },
    ];
    if ($('includeUcs').checked) runs.push({ key: 'ucs' });
    runs.push({ key: 'gbfs', heuristic: h, primary: true }, { key: 'astar', heuristic: h });
    if ($('bothHeuristics').checked) runs.push({ key: 'gbfs', heuristic: other }, { key: 'astar', heuristic: other });
    runs.forEach((r) => {
      const a = EP.algorithms[r.key];
      r.label = a.short + (a.informed ? ` (${hShort[r.heuristic]})` : '') + (r.key === 'dls' ? ` (ℓ = ${depthLimit})` : '');
      r.name = a.name;
      r.assigned = r.key === EP.config.assignedAlgorithm;
    });
    return runs;
  }

  function rowHtml(run, r, optimal) {
    const a = EP.algorithms[run.key];
    const name = `<div class="fw-semibold">${esc(run.label)} ${run.assigned && run.primary ? '<span class="badge badge-assigned ms-1">Assigned</span>' : ''}</div>
      <div class="small text-body-secondary">${esc(a.type)}</div>`;
    if (!r) {
      return `<tr class="${run.assigned && run.primary ? 'assigned-row' : ''}"><td>${name}</td>
        <td colspan="8" class="text-body-secondary small"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Waiting…</td></tr>`;
    }
    const found = r.found
      ? '<span class="badge text-bg-success">Yes</span>'
      : `<span class="badge text-bg-danger" title="${esc(EP.describeStatus(r))}">No</span><div class="small text-body-secondary">${esc(EP.describeStatus(r).replace('Not found', '').replace(/^[\s(]+|\)$/g, ''))}</div>`;
    const memLabel = EP.memoryLabel(r.peakNodes);
    const memColor = { Low: 'success', Medium: 'warning', High: 'danger' }[memLabel];
    const opt =
      !r.found || optimal == null
        ? '—'
        : r.moves === optimal
          ? '<span class="text-success"><i class="bi bi-check-circle-fill"></i> Yes</span>'
          : `<span class="text-warning-emphasis">No (+${(r.moves - optimal).toLocaleString()})</span>`;
    return `<tr class="${run.assigned && run.primary ? 'assigned-row' : ''}">
      <td>${name}</td>
      <td>${found}</td>
      <td class="text-end">${fmt(r.moves)}</td>
      <td class="text-end">${fmt(r.generated)}</td>
      <td class="text-end">${fmt(r.expanded)}</td>
      <td class="text-end">${fmt(r.maxDepth)}</td>
      <td class="text-end">${fmtTime(r.timeMs)}</td>
      <td><span class="badge text-bg-${memColor}">${memLabel}</span><div class="small text-body-secondary">≈ ${EP.formatBytes(r.memoryBytes)}</div></td>
      <td>${opt}</td></tr>`;
  }

  function renderTable(runs, results, optimal) {
    $('resultsBody').innerHTML = runs.map((run, i) => rowHtml(run, results[i], optimal)).join('');
  }

  function renderCharts(runs, results) {
    const rows = (fn, display) =>
      runs.map((run, i) => ({
        label: run.label.replace(' (ℓ = ', ' ℓ=').replace(')', '').replace(' (', ' '),
        value: fn(results[i]),
        display: display ? display(results[i]) : null,
        highlight: run.assigned && run.primary,
      }));
    ui.barChart($('chartExpanded'), rows((r) => r.expanded), { log: true });
    ui.barChart($('chartTime'), rows((r) => r.timeMs, (r) => fmtTime(r.timeMs)));
    ui.barChart($('chartMemory'), rows((r) => r.peakNodes, (r) => r.peakNodes.toLocaleString()), { log: true });
    ui.barChart($('chartMoves'), rows((r) => (r.found ? r.moves : null), (r) => (r.found ? r.moves.toLocaleString() : 'not found')), { log: true });
  }

  function observations(runs, results, optimal) {
    const out = [];
    const by = (key, h) => {
      const i = runs.findIndex((r) => r.key === key && (h === undefined || r.heuristic === h));
      return i < 0 ? null : results[i];
    };
    const h = $('heuristic').value;
    const other = h === 'manhattan' ? 'misplaced' : 'manhattan';
    const gbfs = by('gbfs', h);
    const astar = by('astar', h);
    const bfs = by('bfs');
    const dfs = by('dfs');
    const dls = by('dls');
    const iddls = by('iddls');

    if (optimal != null) out.push(`The optimal solution for this instance is <b>${optimal}</b> moves (found by BFS, IDDLS, UCS and A*).`);
    if (gbfs && bfs) {
      const factor = bfs.expanded / Math.max(gbfs.expanded, 1);
      out.push(
        `<b>GBFS (${hShort[h]})</b> expanded <b>${fmt(gbfs.expanded)}</b> nodes, compared with ${fmt(bfs.expanded)} for BFS` +
          (factor >= 1.5 ? ` (about <b>${factor.toFixed(factor >= 10 ? 0 : 1)}×</b> fewer)` : '') +
          `. Its solution has ${fmt(gbfs.moves)} moves` +
          (optimal != null && gbfs.moves > optimal ? `, which is <b>${gbfs.moves - optimal}</b> more than optimal. GBFS ignores g(n), so it is not optimal.` : `, which is optimal for this instance.`)
      );
    }
    if (gbfs && astar) {
      out.push(
        `A* (${hShort[h]}) expanded ${fmt(astar.expanded)} nodes against ${fmt(gbfs.expanded)} for GBFS. ` +
          (astar.expanded > gbfs.expanded
            ? 'A* expands more because adding g(n) makes it back off long paths, and that is what guarantees optimality.'
            : 'Here A* was at least as efficient as GBFS and still optimal.')
      );
    }
    const g2 = by('gbfs', other);
    const a2 = by('astar', other);
    if (g2 && gbfs && a2 && astar) {
      const man = h === 'manhattan' ? { g: gbfs, a: astar } : { g: g2, a: a2 };
      const mis = h === 'manhattan' ? { g: g2, a: a2 } : { g: gbfs, a: astar };
      out.push(
        `Heuristic quality: with Misplaced Tiles, A* expanded ${fmt(mis.a.expanded)} nodes and GBFS ${fmt(mis.g.expanded)}. With Manhattan Distance, A* expanded ${fmt(man.a.expanded)} and GBFS ${fmt(man.g.expanded)}. Manhattan dominates Misplaced (h₂ ≥ h₁), so it usually guides the search better.`
      );
    }
    if (dfs && dfs.found) {
      out.push(`DFS found a solution of <b>${fmt(dfs.moves)}</b> moves after ${fmt(dfs.expanded)} expansions. Depth-first order commits to one branch, so its solutions are very long.`);
    }
    if (dls) {
      out.push(
        dls.found
          ? `DLS with ℓ = ${dls.depthLimit} found a ${dls.moves}-move solution${optimal != null && dls.moves > optimal ? ' (not optimal)' : ''}.`
          : `DLS with ℓ = ${dls.depthLimit} found no solution${optimal != null ? `: the shortest solution needs ${optimal} moves, deeper than the limit` : ''}.`
      );
    }
    if (iddls && bfs && iddls.found) {
      out.push(
        `IDDLS needed ${iddls.iterations} iterations and ${fmt(iddls.expanded)} expansions (vs ${fmt(bfs.expanded)} for BFS) because it re-expands shallow levels. Its peak memory was ${fmt(iddls.peakNodes)} nodes against ${fmt(bfs.peakNodes)} for BFS.`
      );
    }
    $('observations').innerHTML = `<ul class="mb-0 ps-3">${out.map((o) => `<li class="mb-2">${o}</li>`).join('')}</ul>`;
  }

  function toCsv(runs, results, optimal) {
    const head = ['Algorithm', 'Solution Found', 'Moves', 'Nodes Generated', 'Nodes Expanded', 'Max Depth', 'Time (ms)', 'Peak Nodes', 'Memory (bytes, approx)', 'Memory Level', 'Optimal'];
    const lines = [head];
    runs.forEach((run, i) => {
      const r = results[i];
      lines.push([
        run.label,
        r.found ? 'Yes' : 'No',
        r.moves == null ? '' : r.moves,
        r.generated,
        r.expanded,
        r.maxDepth,
        r.timeMs.toFixed(3),
        r.peakNodes,
        r.memoryBytes,
        EP.memoryLabel(r.peakNodes),
        r.found && optimal != null ? (r.moves === optimal ? 'Yes' : 'No') : '',
      ]);
    });
    return lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  }

  function runComparison() {
    const p = setup.read();
    if (!p.ok) {
      $('resultsBody').innerHTML = `<tr><td colspan="9" class="text-danger small py-3"><i class="bi bi-exclamation-triangle"></i> ${esc(p.error)}</td></tr>`;
      return;
    }
    const runs = plan();
    const results = new Array(runs.length).fill(null);
    const btn = $('btnCompare');
    btn.disabled = true;
    $('btnCsv').disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Running…';
    $('instanceInfo').innerHTML = `Initial <span class="font-monospace">${esc(EP.puzzle.format(p.start, ' / '))}</span> → Goal <span class="font-monospace">${esc(EP.puzzle.format(p.goal, ' / '))}</span>`;
    renderTable(runs, results, null);

    let i = 0;
    const next = () => {
      if (i >= runs.length) {
        const optimalRun = results.find((r, k) => r.found && ['bfs', 'ucs', 'astar', 'iddls'].includes(runs[k].key));
        const optimal = optimalRun ? optimalRun.moves : null;
        renderTable(runs, results, optimal);
        renderCharts(runs, results);
        observations(runs, results, optimal);
        lastRows = { runs, results, optimal };
        lastPuzzle = p;
        btn.disabled = false;
        $('btnCsv').disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Run Comparison Again';
        return;
      }
      const run = runs[i];
      results[i] = EP.timedRun(run.key, {
        start: p.start,
        goal: p.goal,
        heuristic: run.heuristic,
        depthLimit: run.depthLimit,
        maxDepth: run.maxDepth,
      });
      renderTable(runs, results, null);
      i++;
      setTimeout(next, 15); // let the browser repaint between algorithms
    };
    setTimeout(next, 30);
  }

  document.addEventListener('DOMContentLoaded', () => {
    setup = new ui.PuzzleSetup($('setup'), {
      onChange: () => {
        if (lastRows) $('instanceInfo').innerHTML = '<span class="text-warning-emphasis">Puzzle changed: run the comparison again</span>';
      },
    });
    $('btnCompare').addEventListener('click', runComparison);
    $('btnCsv').addEventListener('click', () => {
      if (!lastRows) return;
      const blob = new Blob([toCsv(lastRows.runs, lastRows.results, lastRows.optimal)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `8puzzle-comparison-${lastPuzzle.start}.csv`;
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
