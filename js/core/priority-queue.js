/*
 * Binary min-heap used as the priority-queue frontier of GBFS, A* and UCS.
 * push / pop are O(log n). topK(k) returns the k best items in pop order in
 * O(k log k) without modifying the heap (used to display the Open List).
 */
(function (root) {
  'use strict';
  const EP = (root.EP = root.EP || {});

  class MinHeap {
    /** @param {(a, b) => number} compare negative when a has higher priority than b */
    constructor(compare) {
      this.compare = compare;
      this.items = [];
    }

    get size() {
      return this.items.length;
    }

    push(item) {
      const a = this.items;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (this.compare(a[i], a[p]) >= 0) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    }

    peek() {
      return this.items[0];
    }

    pop() {
      const a = this.items;
      if (a.length === 0) return undefined;
      const top = a[0];
      const last = a.pop();
      if (a.length > 0) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
          if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]];
          i = m;
        }
      }
      return top;
    }

    /** The k highest-priority items, best first, heap left untouched. */
    topK(k) {
      const a = this.items;
      const out = [];
      if (a.length === 0 || k <= 0) return out;
      const candidates = new MinHeap((i, j) => this.compare(a[i], a[j]));
      candidates.push(0);
      while (out.length < k && candidates.size > 0) {
        const i = candidates.pop();
        out.push(a[i]);
        const l = 2 * i + 1;
        if (l < a.length) candidates.push(l);
        if (l + 1 < a.length) candidates.push(l + 1);
      }
      return out;
    }
  }

  EP.MinHeap = MinHeap;
})(typeof window !== 'undefined' ? window : globalThis);
