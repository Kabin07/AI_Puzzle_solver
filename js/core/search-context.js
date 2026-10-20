/*
 * Shared search infrastructure:
 *  - SearchNode     : a node of the search tree (state + parent pointer + g, h, f, depth)
 *  - SearchContext  : counters (generated / expanded / max depth / peak memory),
 *                     limits, and the step-trace recorder used by the visualiser
 *  - finish()       : turns the goal node into a result object with the solution path
 *
 * Algorithms call ctx.record(...) once per expansion. With tracing off,
 * canRecord() is false and nothing is stored, so timed runs are not slowed down.
 */
(function (root) {
  'use strict';
  const EP = (root.EP = root.EP || {});

  // Rough per-node memory estimate in bytes: node object (~7 fields), its 9-char
  // state string, and its entry in a frontier / explored hash structure.
  const BYTES_PER_NODE = 120;

  class SearchNode {
    constructor(state, parent, action, g, h, f, id) {
      this.state = state;
      this.parent = parent;
      this.action = action;
      this.g = g; // path cost from the root
      this.h = h; // heuristic estimate (null for uninformed search)
      this.f = f; // evaluation function used to order the frontier (null if unused)
      this.depth = parent ? parent.depth + 1 : 0;
      this.id = id;
    }
  }

  function nodeInfo(n) {
    return {
      id: n.id,
      state: n.state,
      action: n.action,
      g: n.g,
      h: n.h,
      f: n.f,
      depth: n.depth,
      parentId: n.parent ? n.parent.id : null,
      parentState: n.parent ? n.parent.state : null,
    };
  }

  class SearchContext {
    constructor(opts = {}) {
      const cfg = EP.config || {};
      this.trace = !!opts.trace;
      this.maxTraceSteps = opts.maxTraceSteps || cfg.maxTraceSteps || 3000;
      this.previewSize = opts.previewSize || cfg.previewSize || 12;
      this.maxExpansions = opts.maxExpansions || cfg.maxExpansions || 2000000;

      this.generated = 0;
      this.expanded = 0;
      this.maxDepth = 0;
      this.peakNodes = 0;

      this.steps = [];
      this.truncated = false;
      this.recentExplored = [];
    }

    /** Create (generate) a node. Every generated node is counted, including duplicates later discarded. */
    makeNode(state, parent, action, g, h, f) {
      this.generated++;
      const node = new SearchNode(state, parent, action, g, h, f, this.generated);
      if (node.depth > this.maxDepth) this.maxDepth = node.depth;
      return node;
    }

    get budgetExceeded() {
      return this.expanded >= this.maxExpansions;
    }

    /** Track the largest number of nodes held in memory (frontier + explored) at once. */
    notePeak(nodesInMemory) {
      if (nodesInMemory > this.peakNodes) this.peakNodes = nodesInMemory;
    }

    /** Remember the most recently closed states for the Explored (Closed List) panel. */
    markExplored(state) {
      if (!this.trace) return;
      this.recentExplored.push(state);
      if (this.recentExplored.length > this.previewSize) this.recentExplored.shift();
    }

    clearRecentExplored() {
      this.recentExplored = [];
    }

    /** Whether a snapshot should be recorded now. `force` lets the final goal/failure step through. */
    canRecord(force = false) {
      if (!this.trace) return false;
      if (force) return true;
      if (this.steps.length >= this.maxTraceSteps) {
        this.truncated = true;
        return false;
      }
      return true;
    }

    /**
     * Store one visualisation snapshot.
     * step = { kind, current, successors, frontier, frontierSize, exploredSize, note, limit }
     */
    record(step) {
      this.steps.push({
        index: this.steps.length,
        kind: step.kind,
        note: step.note || '',
        limit: step.limit == null ? null : step.limit,
        current: step.current ? nodeInfo(step.current) : null,
        successors: step.successors || [],
        frontier: (step.frontier || []).map(nodeInfo),
        frontierSize: step.frontierSize || 0,
        exploredSize: step.exploredSize || 0,
        explored: this.recentExplored.slice().reverse(),
        generated: this.generated,
        expanded: this.expanded,
        maxDepth: this.maxDepth,
      });
    }

    /** Describe a generated successor and what the algorithm did with it. */
    successorInfo(child, status, tile) {
      return {
        id: child.id,
        state: child.state,
        action: child.action,
        tile,
        g: child.g,
        h: child.h,
        f: child.f,
        depth: child.depth,
        status, // 'added' | 'explored' | 'in-frontier' | 'replaced'
      };
    }

    /** Build the final result. status: 'found' | 'cutoff' | 'failure' | 'limit' */
    finish(status, goalNode, extra = {}) {
      const path = [];
      for (let n = goalNode; n; n = n.parent) {
        path.push({ state: n.state, action: n.action, g: n.g, h: n.h, f: n.f, depth: n.depth });
      }
      path.reverse();
      const found = status === 'found';
      return Object.assign(
        {
          status,
          found,
          path,
          moves: found ? path.length - 1 : null,
          cost: found ? goalNode.g : null,
          generated: this.generated,
          expanded: this.expanded,
          maxDepth: this.maxDepth,
          peakNodes: this.peakNodes,
          memoryBytes: this.peakNodes * BYTES_PER_NODE,
          steps: this.steps,
          truncated: this.truncated,
        },
        extra
      );
    }
  }

  /** Qualitative memory label used in the summary and comparison table. */
  function memoryLabel(peakNodes) {
    if (peakNodes < 1000) return 'Low';
    if (peakNodes < 20000) return 'Medium';
    return 'High';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  EP.SearchNode = SearchNode;
  EP.SearchContext = SearchContext;
  EP.BYTES_PER_NODE = BYTES_PER_NODE;
  EP.memoryLabel = memoryLabel;
  EP.formatBytes = formatBytes;
  EP.search = EP.search || {};
})(typeof window !== 'undefined' ? window : globalThis);
