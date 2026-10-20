/*
 * Shared page chrome, rendered from one list of pages so navigation is identical everywhere:
 *   <div data-site-header></div>  → navbar (+ breadcrumb / "Back to Home" bar on inner pages)
 *   <div data-site-pager></div>   → "Previous / Next section" links at the bottom of inner pages
 *   <div data-site-footer></div>  → footer with student details and quick links
 * Also binds config values (data-bind="student.name") and handles the light/dark toggle.
 *
 * This script runs as soon as it is loaded (it sits at the end of <body>), so the
 * header is in place before the first paint.
 */
(function (root) {
  'use strict';
  const EP = root.EP;
  const THEME_KEY = 'ep.theme';

  // Order = order of sections in the menu, on the home page and in the previous/next pager.
  const PAGES = [
    { key: 'home', href: 'index.html', label: 'Home', icon: 'house-door' },
    { key: 'solver', href: 'solver.html', label: 'Puzzle Solver', short: 'Solver', icon: 'play-circle',
      desc: 'Enter or generate a puzzle, pick an algorithm and watch the search step by step.' },
    { key: 'compare', href: 'compare.html', label: 'Heuristic Comparison', short: 'Comparison', icon: 'bar-chart-line',
      desc: 'GBFS with Manhattan Distance vs Misplaced Tiles on the same puzzle and on random puzzles.' },
    { key: 'algorithms', href: 'algorithms.html', label: 'Algorithm Description', short: 'Algorithm', icon: 'book',
      desc: 'How Greedy Best-First Search works: principle, pros and cons, complexity, completeness and optimality.' },
    { key: 'details', href: 'details.html', label: 'Project Details', short: 'Details', icon: 'info-circle',
      desc: 'The 8-puzzle problem, how to use this app, features, technologies and student details.' },
  ];
  EP.PAGES = PAGES;

  const page = document.body.getAttribute('data-page') || 'home';
  const idx = Math.max(0, PAGES.findIndex((p) => p.key === page));
  const current = PAGES[idx];

  function headerHtml() {
    const links = PAGES.map(
      (p) => `<li class="nav-item"><a class="nav-link${p.key === page ? ' active' : ''}" href="${p.href}"${p.key === page ? ' aria-current="page"' : ''}>
          <i class="bi bi-${p.icon}"></i> ${p.short || p.label}</a></li>`
    ).join('');

    const navbar = `
      <a class="visually-hidden-focusable btn btn-accent position-absolute m-2" style="z-index:2000" href="#main">Skip to content</a>
      <nav class="navbar navbar-expand-lg bg-body border-bottom" aria-label="Main navigation">
        <div class="container-xxl">
          <a class="navbar-brand d-flex align-items-center gap-2 fw-bold" href="index.html" title="Go to the home page">
            <img src="assets/logo.svg" alt=""> 8-Puzzle AI</a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNav" aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span></button>
          <div class="collapse navbar-collapse" id="mainNav">
            <ul class="navbar-nav me-auto">${links}</ul>
            <span class="navbar-text small me-3 d-none d-xl-inline"><span data-bind="student.name"></span> · <span data-bind="student.regNo"></span></span>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-theme-toggle aria-label="Toggle dark mode" title="Light / dark mode">
              <i data-theme-icon class="bi bi-moon-stars"></i></button>
          </div>
        </div>
      </nav>`;

    if (page === 'home') return navbar;

    // Inner pages: breadcrumb + section stepper + back button
    const steps = PAGES.slice(1)
      .map(
        (p, i) => `<a href="${p.href}" class="section-step${p.key === page ? ' active' : ''}" title="${p.label}"${p.key === page ? ' aria-current="page"' : ''}>
          <span class="num">${i + 1}</span><span class="d-none d-md-inline">${p.short}</span></a>`
      )
      .join('');
    return `${navbar}
      <div class="page-bar border-bottom">
        <div class="container-xxl d-flex flex-wrap align-items-center justify-content-between gap-2 py-2">
          <nav aria-label="breadcrumb">
            <ol class="breadcrumb mb-0 small">
              <li class="breadcrumb-item"><a href="index.html"><i class="bi bi-house-door"></i> Home</a></li>
              <li class="breadcrumb-item active" aria-current="page"><i class="bi bi-${current.icon}"></i> ${current.label}</li>
            </ol>
          </nav>
          <div class="d-flex align-items-center gap-2">
            <nav class="section-steps d-none d-sm-flex" aria-label="Sections">${steps}</nav>
            <a class="btn btn-sm btn-outline-accent" href="index.html"><i class="bi bi-arrow-left"></i> Back to Home</a>
          </div>
        </div>
      </div>`;
  }

  function pagerHtml() {
    if (page === 'home') return '';
    const prev = PAGES[idx - 1];
    const next = PAGES[idx + 1];
    const card = (p, dir) =>
      p
        ? `<a href="${p.href}" class="card pager-card h-100 text-decoration-none ${dir === 'next' ? 'text-end' : ''}">
            <div class="card-body">
              <div class="small text-body-secondary">${dir === 'next' ? 'Next section' : p.key === 'home' ? 'Back to' : 'Previous section'}</div>
              <div class="fw-semibold text-body">${dir === 'next' ? '' : '<i class="bi bi-arrow-left"></i> '}<i class="bi bi-${p.icon}"></i> ${p.label}${dir === 'next' ? ' <i class="bi bi-arrow-right"></i>' : ''}</div>
            </div></a>`
        : `<a href="index.html" class="card pager-card h-100 text-decoration-none text-end">
            <div class="card-body"><div class="small text-body-secondary">You have seen every section</div>
            <div class="fw-semibold text-body"><i class="bi bi-house-door"></i> Back to Home <i class="bi bi-arrow-right"></i></div></div></a>`;
    return `<div class="container-xxl mt-4"><div class="row g-3">
        <div class="col-6">${card(prev, 'prev')}</div>
        <div class="col-6">${card(next, 'next')}</div>
      </div></div>`;
  }

  function footerHtml() {
    const links = PAGES.map((p) => `<a href="${p.href}" class="link-secondary text-decoration-none">${p.short || p.label}</a>`).join('<span class="opacity-50">·</span>');
    return `<footer class="site-footer py-3 mt-4">
        <div class="container-xxl small text-body-secondary d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span><span data-bind="course"></span> · Digital Assignment · <span data-bind="student.name"></span> (<span data-bind="student.regNo"></span>)</span>
          <span class="d-flex flex-wrap gap-2">${links}</span>
        </div>
      </footer>`;
  }

  function fill(selector, html) {
    document.querySelectorAll(selector).forEach((el) => {
      el.outerHTML = html;
    });
  }

  function get(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.querySelectorAll('[data-theme-icon]').forEach((i) => {
      i.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
    });
  }

  // ---- render immediately ----
  fill('[data-site-header]', headerHtml());
  fill('[data-site-pager]', pagerHtml());
  fill('[data-site-footer]', footerHtml());

  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main';

  document.querySelectorAll('[data-bind]').forEach((el) => {
    const v = get(EP.config, el.getAttribute('data-bind'));
    if (v != null) el.textContent = v;
  });

  // Collapsible "How to use" guides; the choice is remembered per page
  document.querySelectorAll('[data-guide-toggle]').forEach((btn) => {
    const body = document.getElementById(btn.getAttribute('aria-controls'));
    const key = `ep.guide.${page}`;
    const set = (hidden) => {
      body.classList.toggle('d-none', hidden);
      btn.textContent = hidden ? 'Show' : 'Hide';
      btn.setAttribute('aria-expanded', String(!hidden));
    };
    try {
      set(localStorage.getItem(key) === 'hidden');
    } catch (e) {
      set(false);
    }
    btn.addEventListener('click', () => {
      const hidden = !body.classList.contains('d-none');
      set(hidden);
      try {
        localStorage.setItem(key, hidden ? 'hidden' : 'shown');
      } catch (e) {
        /* ignore */
      }
    });
  });

  applyTheme(document.documentElement.getAttribute('data-bs-theme') || 'light');
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* ignore */
      }
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
