// Faces, case generation, run schedule (the randomized parade of edicts), and memos.
(function () {
  const R = RNG, D = Dates, RU = () => Rules.RULES;

  const Faces = {
    random() {
      return {
        skin: R.int(0, 5), hair: R.int(0, 9), hairC: R.int(0, 6), glasses: R.chance(0.3) ? R.int(1, 2) : 0,
        beard: R.chance(0.2) ? R.int(1, 2) : 0, shirt: R.int(0, 6), tie: R.chance(0.4) ? 1 : 0,
        brows: R.int(0, 2), mouth: R.int(0, 2), ear: R.int(0, 1),
      };
    },
    same(a, b) { return JSON.stringify(a) === JSON.stringify(b); },
    different(f) {
      const g = Object.assign({}, f);
      g.hair = (f.hair + R.int(2, 7)) % 10;
      g.hairC = (f.hairC + R.int(1, 6)) % 7;
      if (R.chance(0.5)) g.glasses = f.glasses ? 0 : 1;
      if (R.chance(0.4)) g.beard = f.beard ? 0 : 1;
      if (R.chance(0.4)) g.skin = (f.skin + R.int(1, 5)) % 6;
      return g;
    },
    nephew() { return { skin: 0, hair: 7, hairC: 2, glasses: 2, beard: 0, shirt: 5, tie: 0, brows: 1, mouth: 1, ear: 0, nephew: 1 }; },
    kendra() { return { skin: 1, hair: 4, hairC: 2, glasses: 1, beard: 0, shirt: 6, tie: 0, brows: 2, mouth: 2, ear: 1, kendra: 1 }; },
  };

  function initials() { return R.pick('ABCDEFGHJKLMNPRSTW'.split('')) + R.pick('ABCDEFGHJKLMNPRSTW'.split('')); }
  function setExpenseItem(c, it) {
    c.form.item = it.item; c.form.amount = R.int(it.min, it.max);
    c.receipt.item = it.item; c.receipt.amount = c.form.amount; c.receipt.vendor = it.vendor;
  }
  function activeRules(S, type) {
    return S.rules.map((r) => ({ r, def: RU()[r.id] })).filter((x) => x.def.types.includes(type));
  }

  function baseCase(S, type, opts = {}) {
    const face = opts.kendra ? Faces.kendra() : Faces.random();
    let first = R.pick(C.firstNames), last = R.pick(C.lastNames);
    if (opts.kendra) { first = C.kendra.first; last = C.kendra.last; }
    const deptIdx = opts.kendra ? S.depts.length - 1 : R.int(0, S.depts.length - 2);
    const id = 'OG-' + R.int(10000, 99999);
    const c = {
      type, person: { face }, isKendra: !!opts.kendra,
      badge: {
        first, last, id, deptIdx, dept: Rules.deptName(S, deptIdx), hire: S.today - R.int(100, 3000),
        expiry: S.today + R.int(20, 700), loc: R.pick(['Onsite', 'Onsite', 'Hybrid', 'Remote']),
        sticker: R.pick([2026, 2026, 2025, null]), face,
      },
      form: {
        version: 'HR-27' + (S.formV || 'a'), first, last, id, dept: Rules.deptName(S, deptIdx),
        signed: true, ink: R.pick(['blue', 'black']), mgr: R.chance(0.75) ? initials() : '',
      },
    };
    if (type === 'pto') {
      let start = S.today + R.int(3, 45); while (D.isWeekend(start)) start++;
      const days = R.pick([1, 1, 2, 2, 3, 3, 4, 5, 7, 10]);
      Object.assign(c.form, { start, days, end: D.addWorkdays(start, days), reason: R.chance(0.12) ? R.pick(C.vibesReasons) : R.pick(C.ptoReasons) });
    } else if (type === 'expense') {
      c.receipt = { date: S.today - R.int(1, 25) };
      setExpenseItem(c, R.chance(0.15) ? R.pick(C.bannedBeverages) : R.pick(C.expenseItems));
      if (R.chance(0.1)) c.receipt.vendor = C.bannedVendor;
      c.form.vp = R.chance(0.4);
    } else if (type === 'offer') {
      const skills = R.shuffle(C.skills).slice(0, 3);
      if (R.chance(0.12)) skills[R.int(0, 2)] = C.wordSkill;
      c.resume = { first: R.pick(C.firstNames), last: R.pick(C.lastNames), years: R.int(0, 14), skills };
      const entry = R.chance(0.7);
      Object.assign(c.form, {
        candFirst: c.resume.first, candLast: c.resume.last, level: entry ? 'Entry' : 'Mid',
        role: entry ? R.pick(C.roles) : R.pick(C.midRoles),
        salary: entry ? R.int(56, 96) * 500 : R.int(120, 190) * 500,
      });
    }
    if (c.badge.loc === 'Remote') c.swipes = [0, 0, 0, 0, 0].map(() => R.chance(0.45));
    return c;
  }

  function judge(c, S) {
    c.flaws = [];
    for (const { r, def } of activeRules(S, c.type)) {
      if (def.check(c, S, r.p)) c.flaws.push({ id: def.id, keys: def.keys(c, r.p), exc: def.exc, verdict: def.verdict || 'deny' });
    }
    c.verdict = c.flaws.some((f) => f.verdict === 'escalate') ? 'escalate' : c.flaws.length ? 'deny' : 'approve';
    return c;
  }

  function gen(S, opts = {}) {
    const weights = { pto: 1.2, expense: 1, offer: 0.9 };
    const pool = [];
    S.types.forEach((t) => pool.push([t, weights[t]]));
    let total = pool.reduce((a, b) => a + b[1], 0), x = R.next() * total, type = pool[0][0];
    for (const [t, w] of pool) { if ((x -= w) < 0) { type = t; break; } }
    if (opts.type) type = opts.type;

    let c;
    for (let tries = 0; tries < 60; tries++) {
      c = baseCase(S, type, opts);
      const act = activeRules(S, type);
      for (let pass = 0; pass < 3; pass++) for (const { r, def } of R.shuffle(act)) def.comply(c, S, r.p);
      if (!act.some(({ r, def }) => def.check(c, S, r.p))) break;
    }
    // Plant (at most) one violation.
    const pFlaw = opts.forceFlaw != null ? (opts.forceFlaw ? 1 : 0) : S.day === 1 ? 0.4 : 0.5;
    if (R.chance(pFlaw)) {
      const cands = activeRules(S, type).filter(({ def }) => !(opts.kendra && def.id === 'nephew'));
      const w = cands.map(({ r, def }) => (def.id === 'nephew' ? 1.2 : r.addedDay === S.day ? 3 : def.base ? 1 : 1.6));
      let t = R.next() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < cands.length; i++) {
        if ((t -= w[i]) < 0) { cands[i].def.violate(c, S, cands[i].r.p); break; }
      }
    }
    c.badge.dept = Rules.deptName(S, c.badge.deptIdx);
    judge(c, S);
    // Which documents come over the counter
    c.docs = ['badge', 'form'];
    if (c.receipt) c.docs.push('receipt');
    if (c.resume) c.docs.push('resume');
    if (c.swipes && c.badge.loc === 'Remote' && S.rules.some((r) => r.id === 'rto')) c.docs.push('swipes');
    // What they say
    const greet = { pto: C.greetPTO, expense: C.greetExpense, offer: C.greetOffer }[type];
    c.lines = c.isKendra
      ? ["It's me! Kendra!", R.pick(["Just need a teensy approval. You'd never deny a colleague, right?", 'I filled this out super fast. You know how it is.', "Wellness retreat. In Cabo. With Chad. It's for work."])]
      : c.isNephew ? ['Sup. My uncle owns this place.', 'Just stamp it, bro.'] : [R.pick(C.greet), R.pick(greet)];
    return c;
  }

  // ---------- The run: randomized 12-day schedule ----------
  const DAYS = 12;
  function workdays(n) {
    const out = []; let d = D.of(2026, 11, 2);
    for (let i = 0; i < n; i++) { out.push(d); d = D.nextWorkday(d); }
    return out;
  }

  function planRun() {
    const dates = workdays(DAYS);
    const plan = dates.map((date, i) => ({ day: i + 1, date, events: [], interrupt: null, kendraDrop: null, kendraCase: false }));
    const active = new Set(['expiry', 'name', 'id', 'sig']);
    const addedOn = {};
    const unlocked = new Set(['pto']);
    plan[0].events.push({ t: 'intro' });
    ['expiry', 'name', 'id', 'sig'].forEach((id) => (addedOn[id] = 1));

    const photoDay = R.int(2, 3), expenseDay = R.int(2, 4), offerDay = R.int(4, 6), nephewDay = R.int(3, 8);
    const firstReorgDay = R.int(3, 5);
    const params = {}; // current params per rule
    const S0 = (d) => ({ today: dates[d - 1] });
    const pool = R.shuffle(['notice', 'blackout', 'newhire', 'maxdays', 'friday', 'vibes', 'ink', 'version', 'mgr', 'sticker', 'rto', 'beverage', 'vendor', 'late', 'vp', 'exp', 'band', 'word']);
    // Make the opener a PTO classic so day 2 always has something PTO-y
    const firstPTO = R.pick(['notice', 'maxdays', 'vibes', 'friday']);
    pool.splice(pool.indexOf(firstPTO), 1); pool.unshift(firstPTO);
    const lvls = C.depts.map(() => 0);
    let reorged = false;

    for (let d = 2; d <= DAYS; d++) {
      const ev = plan[d - 1].events;
      const add = (id) => {
        const def = RU()[id];
        const p = def.params ? def.params(S0(d)) : undefined;
        params[id] = p; active.add(id); addedOn[id] = d;
        ev.push({ t: 'add', id, p });
      };
      if (d === photoDay) add('photo');
      if (d === expenseDay) { unlocked.add('expense'); ev.push({ t: 'unlock', what: 'expense' }); active.add('receipt'); addedOn.receipt = d; }
      if (d === offerDay) { unlocked.add('offer'); ev.push({ t: 'unlock', what: 'offer' }); active.add('candidate'); addedOn.candidate = d; }
      if (d === nephewDay) add('nephew');
      // Reorg
      if (d >= 3 && (d === firstReorgDay || (reorged && R.chance(0.4)))) {
        const cands = lvls.map((l, i) => i).filter((i) => lvls[i] < C.depts[i].length - 1);
        const i = R.pick(cands);
        const from = C.depts[i][lvls[i]]; lvls[i]++;
        ev.push({ t: 'reorg', dept: i, from, to: C.depts[i][lvls[i]] });
        if (!reorged) { reorged = true; active.add('dept'); addedOn.dept = d; ev.push({ t: 'add', id: 'dept' }); }
      }
      // Rescind something old
      if (d >= 6 && R.chance(0.25)) {
        const cands = [...active].filter((id) => !RU()[id].base && id !== 'nephew' && addedOn[id] <= d - 2);
        if (cands.length) { const id = R.pick(cands); active.delete(id); ev.push({ t: 'remove', id, p: params[id] }); }
      }
      // Change a rule's numbers
      if (d >= 4 && R.chance(0.5)) {
        const cands = [...active].filter((id) => RU()[id].mod && addedOn[id] < d);
        if (cands.length) {
          const id = R.pick(cands);
          const p = RU()[id].mod(params[id], S0(d));
          params[id] = p; ev.push({ t: 'mod', id, p });
        }
      }
      // New edicts
      const n = 1 + (d >= 5 && R.chance(0.35) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const idx = pool.findIndex((id) => RU()[id].types.some((t) => unlocked.has(t)) && !active.has(id));
        if (idx >= 0) add(pool.splice(idx, 1)[0]);
      }
      // Daily chaos
      if (R.chance(0.55)) plan[d - 1].interrupt = { at: R.int(90, 360), i: R.int(0, C.interruptions.length - 1) };
      if (R.chance(0.5)) plan[d - 1].kendraDrop = { at: R.int(60, 400), i: R.int(0, C.kendraDrops.length - 1) };
      if (d >= 3 && R.chance(0.35)) plan[d - 1].kendraCase = true;
    }
    return { days: DAYS, dates, plan };
  }

  // Apply a day's events to the game state.
  function applyDay(S, dayPlan) {
    S.day = dayPlan.day; S.today = dayPlan.date;
    for (const e of dayPlan.events) {
      if (e.t === 'intro') {
        S.rules = ['expiry', 'name', 'id', 'sig'].map((id) => ({ id, addedDay: 1 }));
      } else if (e.t === 'add') {
        if (!S.rules.some((r) => r.id === e.id)) S.rules.push({ id: e.id, p: e.p, addedDay: S.day });
        if (e.id === 'nephew') S.escalate = true;
        if (e.id === 'version') S.formV = e.p.v;
      } else if (e.t === 'mod') {
        const r = S.rules.find((x) => x.id === e.id); if (r) { r.p = e.p; r.addedDay = S.day; }
        if (e.id === 'version') S.formV = e.p.v;
      } else if (e.t === 'remove') {
        S.rules = S.rules.filter((r) => r.id !== e.id);
        if (e.id === 'version') S.formV = 'a';
      } else if (e.t === 'unlock') {
        if (!S.types.includes(e.what)) S.types.push(e.what);
        const id = e.what === 'expense' ? 'receipt' : 'candidate';
        S.rules.push({ id, addedDay: S.day });
      } else if (e.t === 'reorg') {
        S.depts[e.dept].lvl++;
      }
    }
  }

  function memoFor(dayPlan) {
    const out = [];
    let sender = R.pick(C.senders);
    for (const e of dayPlan.events) {
      const def = e.id && RU()[e.id];
      if (e.t === 'intro') {
        sender = C.senders[0];
        out.push("Welcome to People Operations at OmniGlob! Check every employee's badge and form.");
        out.push('Names and IDs must match. Badges must not be expired. Forms must be signed.');
        out.push('APPROVE what follows the rules. DENY what does not. Glory to OmniGlob!');
      } else if (e.t === 'add') {
        if (e.id === 'nephew') sender = C.senders[0];
        out.push(def.memo(e.p));
      } else if (e.t === 'mod') out.push(def.modMemo(e.p));
      else if (e.t === 'remove') out.push(`After extensive feedback (one angry tweet), this policy is RESCINDED: "${def.text(e.p)}"`);
      else if (e.t === 'unlock') {
        out.push(e.what === 'expense'
          ? "Finance was 'streamlined.' You now process EXPENSE REPORTS too. The receipt amount must match the claim."
          : "Recruiting was 'right-sized' (it is you now). You now approve JOB OFFERS. Candidate name must match the resume.");
      } else if (e.t === 'reorg') out.push(`REORG! ${e.from} is now called ${e.to}. Please update your hearts.`);
    }
    if (!out.length) out.push('No new policies today. That is suspicious. Stay alert.');
    return {
      subject: dayPlan.day === 1 ? 'WELCOME TO PEOPLE OPS!' : R.pick(C.memoSubjects),
      from: sender, paras: out, signoff: R.pick(C.signoffs),
    };
  }

  window.Faces = Faces;
  window.Cases = { gen, judge, initials, setExpenseItem, planRun, applyDay, memoFor, DAYS };
})();
