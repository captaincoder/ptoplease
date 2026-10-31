// Document rendering. Each draw registers inspectable fields (doc.fields) in screen coords.
(function () {
  const { PAL, rect, frame, paper, INK } = G;
  const T = (g, s, x, y, c = PAL.ink, sc = 1) => Font.text(g, s, x, y, c, sc);
  const W = (s) => Font.width(s);
  const money = (n) => '$' + Number(n).toLocaleString('en-US');

  const SIZES = {
    badge: [136, 84], form: [156, 202], receipt: [92, 140], resume: [148, 176], swipes: [140, 70],
    memo: [176, 236], book: [204, 236], bookClosed: [46, 60], citation: [150, 54],
  };
  function size(doc) {
    if (doc.kind === 'book' && !doc.bookOpen) return SIZES.bookClosed;
    return SIZES[doc.kind];
  }
  const MINI = [22, 28];

  function hash(s) { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
  function scribble(g, x, y, w, seed, color) {
    g.fillStyle = color;
    let py = y;
    for (let i = 0; i < w; i++) {
      const t = i / w;
      const yy = Math.round(y + Math.sin(i * 0.55 + (seed % 7)) * 3 * (1 - t * 0.5) + Math.sin(i * 0.19 + seed) * 2);
      const a = Math.min(py, yy), b = Math.max(py, yy);
      g.fillRect(x + i, a, 1, b - a + 1);
      py = yy;
    }
    g.fillRect(x + 4, y + 5, Math.round(w * 0.4), 1);
  }

  function stampArt(g, kind, x, y, alpha = 0.85) {
    const col = { approve: PAL.green, deny: PAL.red, escalate: PAL.purple }[kind];
    const label = { approve: 'APPROVED', deny: 'DENIED', escalate: 'ESCALATED' }[kind];
    g.globalAlpha = alpha;
    frame(g, x, y, 56, 20, col); frame(g, x + 1, y + 1, 54, 18, col);
    T(g, label, x + Math.round((56 - W(label)) / 2), y + 6, col);
    g.globalAlpha = 1;
  }

  // Shared field helper
  function mk(doc, ox, oy) {
    doc.fields = [];
    return {
      F(key, x, y, w, h) { doc.fields.push({ key, x: ox + x, y: oy + y, w, h }); },
      L(label, value, x, y, key, vc = PAL.ink) {
        T(this.g, label, ox + x, oy + y, PAL.inkSoft);
        const lx = x + W(label) + 4;
        T(this.g, String(value), ox + lx, oy + y, vc);
        if (key) this.F(key, x - 1, y - 1, Math.max(W(label) + 4 + W(String(value)), 10) + 2, 10);
      },
    };
  }

  const DRAW = {
    badge(g, doc, x, y, { c }) {
      const h = mk(doc, x, y); h.g = g;
      const b = c.badge;
      paper(g, x, y, 136, 84, '#efe7d2', '#b9ae92');
      rect(g, x, y, 136, 12, PAL.orange);
      T(g, 'OMNIGLOB', x + 4, y + 2, PAL.white);
      T(g, 'EMPLOYEE', x + 132 - W('EMPLOYEE'), y + 2, PAL.white);
      rect(g, x + 4, y + 15, 26, 30, '#2a2430'); rect(g, x + 5, y + 16, 24, 28, '#9fb4c0');
      G.face(g, b.face, x + 5, y + 16, 1);
      h.F('badge.photo', 3, 14, 28, 32);
      T(g, b.first, x + 34, y + 15); T(g, b.last.toUpperCase(), x + 34, y + 24);
      h.F('badge.name', 33, 14, 100, 19);
      h.L('ID', b.id, 34, 35, 'badge.id');
      h.L('', b.dept, 30, 45, 'badge.dept', PAL.blue);
      h.L('HIRED', Dates.fmt(b.hire), 34, 55, 'badge.hire');
      h.L('EXP', Dates.fmt(b.expiry), 34, 64, 'badge.expiry');
      h.L('LOC', b.loc, 34, 73, 'badge.loc');
      // barcode under photo
      for (let i = 0; i < 24; i++) if (hash(b.id + i) % 3) rect(g, x + 5 + i, y + 50, 1, 14, PAL.ink);
      T(g, b.id.slice(3), x + 5, y + 66, PAL.inkSoft);
      // compliance sticker
      const sx = x + 112, sy = y + 52;
      if (b.sticker) {
        const col = b.sticker === 2026 ? PAL.gold : PAL.silver;
        rect(g, sx + 3, sy, 14, 20, col); rect(g, sx, sy + 3, 20, 14, col); rect(g, sx + 1, sy + 1, 18, 18, col);
        rect(g, sx + 2, sy + 2, 16, 16, G.shade(col, 1.12));
        T(g, String(b.sticker).slice(2), sx + 5, sy + 6, G.shade(col, 0.5));
      } else {
        frame(g, sx + 1, sy + 1, 18, 18, '#cfc4a8');
      }
      h.F('badge.sticker', 110, 50, 24, 24);
    },

    form(g, doc, x, y, { c }) {
      const h = mk(doc, x, y); h.g = g;
      const f = c.form;
      paper(g, x, y, 156, 202);
      rect(g, x, y, 156, 12, PAL.ink);
      T(g, 'OMNIGLOB PEOPLE OPS', x + 4, y + 2, PAL.paper);
      const title = { pto: 'PTO REQUEST', expense: 'EXPENSE REPORT', offer: 'OFFER APPROVAL' }[c.type];
      T(g, title, x + 5, y + 15, PAL.ink);
      T(g, f.version, x + 151 - W(f.version), y + 15, PAL.inkSoft);
      h.F('form.version', 150 - W(f.version), 14, W(f.version) + 3, 10);
      rect(g, x + 4, y + 25, 148, 1, PAL.paperLine);
      h.L('Name', `${f.first} ${f.last}`, 5, 29, 'form.name');
      h.L('Emp ID', f.id, 5, 40, 'form.id');
      h.L('Dept', f.dept, 5, 51, 'form.dept');
      rect(g, x + 4, y + 62, 148, 1, PAL.paperLine);
      if (c.type === 'pto') {
        T(g, 'From', x + 5, y + 66, PAL.inkSoft); T(g, Dates.fmt(f.start), x + 30, y + 66);
        T(g, Dates.dow(f.start), x + 82, y + 66, PAL.inkSoft);
        T(g, 'To', x + 5, y + 77, PAL.inkSoft); T(g, Dates.fmt(f.end), x + 30, y + 77);
        T(g, Dates.dow(f.end), x + 82, y + 77, PAL.inkSoft);
        h.F('form.dates', 4, 65, 100, 21);
        h.L('Workdays', f.days, 5, 88, 'form.days');
        T(g, 'Reason', x + 5, y + 99, PAL.inkSoft);
        const lines = Font.wrap(f.reason, 144).slice(0, 3);
        lines.forEach((ln, i) => T(g, ln, x + 7, y + 109 + i * 9, INK.black));
        h.F('form.reason', 4, 98, 148, 12 + lines.length * 9);
      } else if (c.type === 'expense') {
        T(g, 'Item', x + 5, y + 66, PAL.inkSoft);
        const lines = Font.wrap(f.item, 144).slice(0, 2);
        lines.forEach((ln, i) => T(g, ln, x + 7, y + 76 + i * 9, INK.black));
        h.F('form.item', 4, 65, 148, 12 + lines.length * 9);
        h.L('Amount', money(f.amount), 5, 98, 'form.amount');
        T(g, 'VP OK', x + 5, y + 112, PAL.inkSoft);
        rect(g, x + 38, y + 120, 70, 1, PAL.paperLine);
        if (f.vp) scribble(g, x + 42, y + 113, 50, hash(f.id + 'vp'), INK.black);
        h.F('form.vp', 4, 108, 106, 16);
      } else {
        h.L('Candidate', `${f.candFirst} ${f.candLast}`, 5, 66, 'form.cand');
        T(g, 'Role', x + 5, y + 77, PAL.inkSoft);
        const lines = Font.wrap(f.role, 120);
        lines.forEach((ln, i) => T(g, ln, x + 30, y + 77 + i * 9, PAL.ink));
        const ly = 77 + lines.length * 9 + 2;
        h.L('Level', f.level, 5, ly, 'form.level');
        h.L('Salary', money(f.salary), 5, ly + 11, 'form.salary');
      }
      rect(g, x + 4, y + 140, 148, 1, PAL.paperLine);
      T(g, 'Mgr initials', x + 5, y + 146, PAL.inkSoft);
      frame(g, x + 74, y + 143, 26, 14, PAL.paperLine);
      if (f.mgr) T(g, f.mgr, x + 80, y + 146, INK.black);
      h.F('form.mgr', 4, 142, 98, 16);
      T(g, 'Signature', x + 5, y + 166, PAL.inkSoft);
      rect(g, x + 8, y + 190, 110, 1, PAL.ink);
      T(g, 'X', x + 8, y + 181, PAL.inkSoft);
      if (f.signed) scribble(g, x + 18, y + 181, 80, hash(f.first + f.last), INK[f.ink]);
      h.F('form.sig', 4, 164, 120, 30);
      // stamps
      g.save(); g.beginPath(); g.rect(x, y, 156, 202); g.clip();
      for (const s of doc.stamps || []) stampArt(g, s.kind, x + s.x, y + s.y);
      g.restore();
    },

    receipt(g, doc, x, y, { c }) {
      const h = mk(doc, x, y); h.g = g;
      const r = c.receipt;
      rect(g, x + 2, y + 2, 92, 140, 'rgba(0,0,0,0.35)');
      rect(g, x, y, 92, 136, '#f6f3ea');
      for (let i = 0; i < 92; i += 4) { rect(g, x + i, y + 136, 2, 2, '#f6f3ea'); }
      const vlines = Font.wrap(r.vendor.toUpperCase(), 84);
      vlines.forEach((ln, i) => T(g, ln, x + Math.round((92 - W(ln)) / 2), y + 5 + i * 9));
      h.F('receipt.vendor', 2, 4, 88, vlines.length * 9 + 2);
      let yy = 7 + vlines.length * 9;
      T(g, 'STORE #' + (hash(r.vendor) % 900 + 100), x + 18, y + yy, PAL.inkSoft); yy += 11;
      T(g, Dates.fmt(r.date), x + 4, y + yy); h.F('receipt.date', 2, yy - 1, 52, 10); yy += 10;
      T(g, '- - - - - - - - - -', x + 4, y + yy, PAL.inkSoft); yy += 9;
      const il = Font.wrap(r.item, 84).slice(0, 3);
      il.forEach((ln, i) => T(g, ln, x + 4, y + yy + i * 9));
      h.F('receipt.item', 2, yy - 1, 88, il.length * 9 + 2); yy += il.length * 9 + 4;
      T(g, 'TOTAL', x + 4, y + yy); T(g, money(r.amount), x + 88 - W(money(r.amount)), y + yy);
      h.F('receipt.amount', 2, yy - 1, 88, 10); yy += 14;
      T(g, 'THANK YOU!', x + 18, y + yy, PAL.inkSoft);
      for (let i = 0; i < 70; i++) if (hash(r.vendor + i) % 3) rect(g, x + 11 + i, y + 118, 1, 12, PAL.ink);
    },

    resume(g, doc, x, y, { c }) {
      const h = mk(doc, x, y); h.g = g;
      const r = c.resume;
      paper(g, x, y, 148, 176, PAL.white, '#c9c2b0');
      T(g, `${r.first} ${r.last}`.toUpperCase(), x + 6, y + 6);
      h.F('resume.name', 4, 5, 140, 10);
      T(g, 'RESUME (FINAL_v7)', x + 6, y + 16, PAL.inkSoft);
      rect(g, x + 6, y + 27, 136, 1, PAL.ink);
      T(g, 'Objective: To synergize', x + 6, y + 31, PAL.inkSoft);
      T(g, 'at scale.', x + 6, y + 40, PAL.inkSoft);
      T(g, 'EXPERIENCE', x + 6, y + 54);
      const yrs = r.years === 1 ? '1 year' : r.years + ' years';
      T(g, yrs + ' total', x + 10, y + 64, PAL.blue);
      h.F('resume.years', 4, 63, 100, 10);
      const job = r.years === 0 ? 'Lemonade stand (CEO)' : r.years < 4 ? 'Intern, various' : 'Meeting Attender';
      T(g, job, x + 10, y + 73, PAL.inkSoft);
      T(g, 'SKILLS', x + 6, y + 88);
      r.skills.forEach((s, i) => { T(g, '•', x + 8, y + 98 + i * 10); T(g, s, x + 14, y + 98 + i * 10); });
      h.F('resume.skills', 4, 96, 140, r.skills.length * 10 + 2);
      T(g, 'REFERENCES:', x + 6, y + 136);
      T(g, 'Available upon vibes.', x + 6, y + 146, PAL.inkSoft);
    },

    swipes(g, doc, x, y, { c }) {
      const h = mk(doc, x, y); h.g = g;
      paper(g, x, y, 140, 70, '#dfe6e8', '#a9b4b8');
      rect(g, x, y, 140, 11, '#56707a');
      T(g, 'BADGE SWIPE REPORT', x + 4, y + 2, PAL.white);
      T(g, `${c.badge.first} ${c.badge.last}`, x + 5, y + 15);
      T(g, 'Last week:', x + 5, y + 26, PAL.inkSoft);
      ['M', 'T', 'W', 'T', 'F'].forEach((d, i) => {
        const bx = x + 8 + i * 26, by = y + 38;
        T(g, d, bx + 6, by);
        frame(g, bx, by + 10, 18, 16, '#56707a');
        if (c.swipes[i]) { for (let k = 0; k < 4; k++) rect(g, bx + 3 + k, by + 17 + k, 1, 2, PAL.green); for (let k = 0; k < 7; k++) rect(g, bx + 7 + k, by + 20 - k, 1, 2, PAL.green); }
        else { for (let k = 0; k < 9; k++) { rect(g, bx + 5 + k, by + 13 + k, 1, 1, PAL.red); rect(g, bx + 13 - k, by + 13 + k, 1, 1, PAL.red); } }
      });
      h.F('swipes.days', 6, 36, 132, 32);
    },

    memo(g, doc, x, y, { game }) {
      const h = mk(doc, x, y); h.g = g;
      const m = game.memo;
      paper(g, x, y, 176, 236, '#f1ead6');
      if (!doc.pages) {
        const lines = [];
        m.paras.forEach((p, i) => { Font.wrap(p, 162).forEach((l) => lines.push(l)); lines.push(''); });
        lines.push('-- ' + m.from.name); lines.push(m.from.title); lines.push(''); lines.push(m.signoff);
        const per = 15, pages = [];
        for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
        doc.pages = pages; doc.page = 0;
      }
      T(g, 'MEMO', x + 6, y + 5, PAL.red, 2);
      T(g, 'FROM THE DESK OF', x + 60, y + 5, PAL.inkSoft);
      T(g, m.from.name.toUpperCase(), x + 60, y + 14, PAL.ink);
      rect(g, x + 6, y + 26, 164, 1, PAL.ink);
      const subj = Font.wrap('RE: ' + m.subject, 162);
      subj.slice(0, 2).forEach((l, i) => T(g, l, x + 7, y + 30 + i * 9, PAL.ink));
      rect(g, x + 6, y + 31 + subj.slice(0, 2).length * 9, 164, 1, PAL.paperLine);
      const top = 35 + subj.slice(0, 2).length * 9;
      (doc.pages[doc.page] || []).forEach((l, i) => T(g, l, x + 7, y + top + i * 11, l.startsWith('-- ') ? PAL.blue : PAL.ink));
      if (doc.pages.length > 1) pager(g, doc, x, y, 176, 236);
    },

    book(g, doc, x, y, { S, game }) {
      const h = mk(doc, x, y); h.g = g;
      if (!doc.bookOpen) {
        rect(g, x + 2, y + 2, 46, 60, 'rgba(0,0,0,0.4)');
        rect(g, x, y, 46, 60, PAL.orangeDark); rect(g, x, y, 4, 60, '#7a3c12');
        frame(g, x, y, 46, 60, '#6a320e');
        T(g, 'EMPL.', x + 8, y + 8, PAL.paper); T(g, 'HAND', x + 8, y + 18, PAL.paper); T(g, 'BOOK', x + 8, y + 28, PAL.paper);
        rect(g, x + 8, y + 42, 30, 8, PAL.gold); T(g, 'OG', x + 17, y + 42, PAL.orangeDark);
        if (game.bookNew) { rect(g, x + 30, y - 4, 20, 11, PAL.red); T(g, 'NEW', x + 31, y - 2, PAL.white); }
        return;
      }
      rect(g, x + 2, y + 2, 204, 236, 'rgba(0,0,0,0.4)');
      rect(g, x, y, 204, 236, PAL.orangeDark);
      rect(g, x + 3, y + 14, 198, 219, '#f3ecd8');
      // tabs
      const tabs = [['RULES', 'rules'], ['ORG CHART', 'org']];
      let tx = x + 4;
      tabs.forEach(([lab, id]) => {
        const w = W(lab) + 10;
        const on = (doc.tab || 'rules') === id;
        rect(g, tx, y + 2, w, 12, on ? '#f3ecd8' : '#c9844c');
        T(g, lab, tx + 5, y + 4, on ? PAL.ink : PAL.paper);
        doc['tab_' + id] = [tx - x, 2, w, 12];
        tx += w + 2;
      });
      rect(g, x + 190, y + 2, 12, 11, PAL.dark); T(g, 'X', x + 194, y + 4, PAL.paper);
      doc.closeBtn = [190, 0, 14, 14];
      const tab = doc.tab || 'rules';
      if (tab === 'rules') {
        if (!doc.pages || doc.pagesDay !== S.day + ':' + S.rules.length) {
          const items = [];
          S.rules.forEach((r, i) => {
            const def = Rules.RULES[r.id];
            const lines = Font.wrap(`${i + 1}. ${def.text(r.p)}`, r.addedDay === S.day ? 160 : 188);
            items.push({ id: r.id, lines, isNew: r.addedDay === S.day && S.day > 1 });
          });
          const pages = [[]]; let used = 0;
          for (const it of items) {
            const hgt = it.lines.length * 9 + 4;
            if (used + hgt > 196 && pages[pages.length - 1].length) { pages.push([]); used = 0; }
            pages[pages.length - 1].push(it); used += hgt;
          }
          doc.pages = pages; doc.pagesDay = S.day + ':' + S.rules.length; doc.page = Math.min(doc.page || 0, pages.length - 1);
        }
        let yy = y + 18;
        for (const it of doc.pages[doc.page]) {
          it.lines.forEach((l, i) => T(g, l, x + 7, yy + i * 9, PAL.ink));
          if (it.isNew) { rect(g, x + 176, yy, 22, 9, PAL.red); T(g, 'NEW', x + 178, yy + 1, PAL.white); }
          h.F('rule:' + it.id, 5, yy - y - 1, 194, it.lines.length * 9 + 1);
          yy += it.lines.length * 9 + 4;
        }
        if (doc.pages.length > 1) pager(g, doc, x, y, 204, 236);
      } else {
        T(g, 'CURRENT DEPARTMENTS', x + 7, y + 19, PAL.red);
        let yy = y + 32;
        S.depts.forEach((d, i) => {
          const name = Rules.deptName(S, i);
          T(g, name, x + 9, yy, PAL.ink);
          if (d.lvl > 0) T(g, '(was ' + C.depts[d.chain][d.lvl - 1] + ')', x + 14, yy + 9, PAL.inkSoft);
          yy += d.lvl > 0 ? 21 : 13;
        });
        h.F('org', 5, 30, 194, yy - y - 30);
        T(g, 'All other names are wrong.', x + 7, y + 220, PAL.inkSoft);
      }
    },

    citation(g, doc, x, y) {
      mk(doc, x, y);
      paper(g, x, y, 150, 54, '#f0c4c4', '#c08c8c');
      T(g, 'CITATION', x + 5, y + 4, PAL.red);
      T(g, doc.penalty, x + 145 - W(doc.penalty), y + 4, PAL.red);
      Font.wrap(doc.reason, 140).slice(0, 3).forEach((l, i) => T(g, l, x + 5, y + 16 + i * 9, PAL.ink));
      T(g, 'Tap to dismiss', x + 5, y + 44, '#a07070');
    },
  };

  function pager(g, doc, x, y, w, h) {
    const by = y + h - 15;
    G.button(g, x + 6, by, 18, 12, '<', doc.page > 0 ? PAL.paper : PAL.paperShade);
    G.button(g, x + w - 24, by, 18, 12, '>', doc.page < doc.pages.length - 1 ? PAL.paper : PAL.paperShade);
    const lab = `${doc.page + 1}/${doc.pages.length}`;
    T(g, lab, x + Math.round((w - W(lab)) / 2), by + 2, PAL.inkSoft);
    doc.prevBtn = [6, h - 15, 18, 14]; doc.nextBtn = [w - 24, h - 15, 18, 14];
  }

  function drawMini(g, doc, x, y) {
    const [w, h] = MINI;
    const fill = { badge: '#efe7d2', form: PAL.paper, receipt: '#f6f3ea', resume: PAL.white, swipes: '#dfe6e8' }[doc.kind] || PAL.paper;
    rect(g, x + 1, y + 1, w, h, 'rgba(0,0,0,0.4)');
    rect(g, x, y, w, h, fill); frame(g, x, y, w, h, G.shade(fill, 0.7));
    if (doc.kind === 'badge') { rect(g, x, y, w, 5, PAL.orange); rect(g, x + 3, y + 8, 7, 9, '#9fb4c0'); }
    else if (doc.kind === 'swipes') rect(g, x, y, w, 5, '#56707a');
    else if (doc.kind === 'form') rect(g, x, y, w, 4, PAL.ink);
    for (let i = 0; i < 4; i++) rect(g, x + (doc.kind === 'badge' ? 12 : 3), y + 9 + i * 4, doc.kind === 'badge' ? 7 : 15, 1, PAL.inkSoft);
    if (doc.stamps && doc.stamps.length) rect(g, x + 4, y + 20, 14, 5, { approve: PAL.green, deny: PAL.red, escalate: PAL.purple }[doc.stamps[0].kind]);
  }

  // Tap handling for interactive bits; lx, ly local to doc
  function tap(doc, lx, ly) {
    const hit = (r) => r && lx >= r[0] && lx < r[0] + r[2] && ly >= r[1] && ly < r[1] + r[3];
    if (doc.kind === 'book') {
      if (!doc.bookOpen) { doc.bookOpen = true; return 'open'; }
      if (hit(doc.closeBtn)) { doc.bookOpen = false; return 'close'; }
      if (hit(doc.tab_rules)) { doc.tab = 'rules'; doc.page = 0; return 'tab'; }
      if (hit(doc.tab_org)) { doc.tab = 'org'; return 'tab'; }
    }
    if (doc.pages && doc.pages.length > 1 && (doc.kind === 'memo' || (doc.kind === 'book' && (doc.tab || 'rules') === 'rules'))) {
      if (hit(doc.prevBtn) && doc.page > 0) { doc.page--; return 'page'; }
      if (hit(doc.nextBtn) && doc.page < doc.pages.length - 1) { doc.page++; return 'page'; }
    }
    if (doc.kind === 'citation') return 'dismiss';
    return null;
  }

  window.Docs = { DRAW, size, MINI, drawMini, tap, stampArt };
})();
