// Seeded RNG so a run can be saved and resumed.
(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = {
    _f: mulberry32(Date.now() & 0xffffffff),
    seed(s) { this._f = mulberry32(s); },
    next() { return this._f(); },
    int(a, b) { return a + Math.floor(this._f() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(this._f() * arr.length)]; },
    chance(p) { return this._f() < p; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this._f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
  // Dates are integer day numbers (days since 2026-01-01, a Thursday).
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'];
  const base = Date.UTC(2026, 0, 1);
  const D = {
    of(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - base) / 86400000); },
    parts(n) { const dt = new Date(base + n * 86400000); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }; },
    fmt(n) { const p = this.parts(n); return `${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}/${String(p.y).slice(2)}`; },
    long(n) { const p = this.parts(n); return `${this.dow(n)} ${MONTHS[p.m - 1]} ${p.d}`; },
    dow(n) { return DOW[((n % 7) + 7) % 7]; },
    isWeekend(n) { const w = this.dow(n); return w === 'Sat' || w === 'Sun'; },
    nextWorkday(n) { do { n++; } while (this.isWeekend(n)); return n; },
    workdaysBetween(a, b) { let c = 0; for (let i = a; i <= b; i++) if (!this.isWeekend(i)) c++; return c; },
    addWorkdays(a, k) { let n = a; let c = 1; while (c < k) { n++; if (!this.isWeekend(n)) c++; } return n; },
  };
  window.RNG = R;
  window.Dates = D;
})();
