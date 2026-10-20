/*
 * Project-wide configuration.
 * Student details are bound into every page from here (elements with data-bind="...").
 */
(function (root) {
  'use strict';
  const EP = (root.EP = root.EP || {});

  EP.config = {
    course: 'Artificial Intelligence',
    title: 'Interactive 8-Puzzle Problem Solver using AI Search Algorithms',
    student: {
      name: 'Kabin Mukesh R',
      regNo: '24BCT0117',
    },
    // Algorithm allotted to this register number (No. 6 in the assignment list).
    assignedAlgorithm: 'gbfs',

    // Search limits
    maxExpansions: 2000000, // safety cap on node expansions for any single run
    maxTraceSteps: 3000, // expansions recorded for step-by-step visualisation
    previewSize: 12, // how many frontier / explored entries each snapshot keeps
  };
})(typeof window !== 'undefined' ? window : globalThis);
