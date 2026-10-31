// Rules: every rule can comply / violate a case, and judge it. Verdicts are always computed, never guessed.
(function () {
  const R = RNG, D = Dates;
  const PTO = ['pto'], EXP = ['expense'], OFF = ['offer'], ALL = ['pto', 'expense', 'offer'];
  const deptName = (S, i) => C.depts[S.depts[i].chain][S.depts[i].lvl];
  const oldNames = (S, i) => C.depts[S.depts[i].chain].slice(0, S.depts[i].lvl);
  const currentNames = (S) => S.depts.map((_, i) => deptName(S, i));
  const overlaps = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
  const setDates = (c, start, days) => {
    while (D.isWeekend(start)) start++;
    c.form.start = start; c.form.days = days; c.form.end = D.addWorkdays(start, days);
  };
  const pickOther = (arr, cur) => R.pick(arr.filter((x) => x !== cur));
  const money = (n) => '$' + n.toLocaleString('en-US');

  const RULES = {
    // ---------- BASE ----------
    expiry: {
      base: true, types: ALL, exc: 'expiry',
      text: () => 'Badge must not be expired.',
      check: (c, S) => c.badge.expiry < S.today,
      comply: (c, S) => { if (c.badge.expiry < S.today) c.badge.expiry = S.today + R.int(20, 700); },
      violate: (c, S) => { c.badge.expiry = S.today - R.int(1, 300); },
      keys: () => [['badge.expiry', 'today'], ['badge.expiry', 'rule:expiry']],
    },
    name: {
      base: true, types: ALL, exc: 'name',
      text: () => 'Name on form must match badge.',
      check: (c) => c.form.first !== c.badge.first || c.form.last !== c.badge.last,
      comply: (c) => { c.form.first = c.badge.first; c.form.last = c.badge.last; },
      violate: (c) => {
        if (R.chance(0.5)) c.form.first = pickOther(C.firstNames, c.badge.first);
        else {
          const l = c.badge.last.split('');
          const i = R.int(1, l.length - 2);
          if (R.chance(0.5)) [l[i], l[i + 1]] = [l[i + 1], l[i]]; else l[i] = R.pick('aeiouyrnst'.split('').filter((x) => x !== l[i]));
          c.form.last = l.join('');
          if (c.form.last === c.badge.last) c.form.last = c.badge.last + 's';
        }
      },
      keys: () => [['form.name', 'badge.name']],
    },
    id: {
      base: true, types: ALL, exc: 'id',
      text: () => 'Employee ID on form must match badge.',
      check: (c) => c.form.id !== c.badge.id,
      comply: (c) => { c.form.id = c.badge.id; },
      violate: (c) => {
        const d = c.badge.id.split('');
        const i = R.int(3, d.length - 1);
        d[i] = String((+d[i] + R.int(1, 8)) % 10);
        c.form.id = d.join('');
      },
      keys: () => [['form.id', 'badge.id']],
    },
    sig: {
      base: true, types: ALL, exc: 'sig',
      text: () => 'Form must be signed by employee.',
      check: (c) => !c.form.signed,
      comply: (c) => { c.form.signed = true; },
      violate: (c) => { c.form.signed = false; },
      keys: () => [['form.sig', 'rule:sig']],
    },
    photo: {
      base: true, types: ALL, exc: 'photo',
      text: () => 'Badge photo must match the person.',
      memo: () => 'SECURITY: Badge photos must match the actual human standing in front of you. Yes, we have to say this.',
      check: (c) => !Faces.same(c.badge.face, c.person.face),
      comply: (c) => { c.badge.face = c.person.face; },
      violate: (c) => { c.badge.face = Faces.different(c.person.face); },
      keys: () => [['badge.photo', 'person']],
    },
    dept: {
      base: true, types: ALL, exc: 'dept',
      text: () => 'Form must list CURRENT dept name (see Org Chart).',
      memo: () => 'Forms must list the CURRENT department name. See the Org Chart in your handbook. Badges were reprinted. Forms were not.',
      check: (c, S) => !currentNames(S).includes(c.form.dept),
      comply: (c, S) => { c.form.dept = deptName(S, c.badge.deptIdx); },
      violate: (c, S) => {
        const old = oldNames(S, c.badge.deptIdx);
        c.form.dept = old.length ? R.pick(old) : R.pick(['Dept. of Fun', 'Synergy Pod', 'Team Awesome', 'Misc.']);
      },
      keys: () => [['form.dept', 'org'], ['form.dept', 'badge.dept'], ['form.dept', 'rule:dept']],
    },
    receipt: {
      base: true, types: EXP, exc: 'receipt',
      text: () => 'Receipt amount must match amount claimed.',
      check: (c) => c.form.amount !== c.receipt.amount,
      comply: (c) => { c.receipt.amount = c.form.amount; },
      violate: (c) => { c.receipt.amount = Math.max(1, c.form.amount - R.int(3, Math.max(5, Math.round(c.form.amount * 0.6)))); },
      keys: () => [['form.amount', 'receipt.amount']],
    },
    candidate: {
      base: true, types: OFF, exc: 'candidate',
      text: () => 'Candidate name must match resume.',
      check: (c) => c.form.candFirst !== c.resume.first || c.form.candLast !== c.resume.last,
      comply: (c) => { c.form.candFirst = c.resume.first; c.form.candLast = c.resume.last; },
      violate: (c) => { c.form.candFirst = pickOther(C.firstNames, c.resume.first); },
      keys: () => [['form.cand', 'resume.name']],
    },

    // ---------- EDICTS ----------
    notice: {
      types: PTO, exc: 'notice',
      params: () => ({ n: R.pick([10, 14, 21]) }),
      mod: (p) => ({ n: pickOther([7, 10, 14, 21, 30], p.n) }),
      text: (p) => `PTO must be requested ${p.n}+ days ahead.`,
      memo: (p) => `Effective immediately, PTO must be requested at least ${p.n} days in advance. Spontaneity is not a core value.`,
      modMemo: (p) => `CORRECTION: PTO notice is now ${p.n} days. The previous number was a typo. Or was it?`,
      check: (c, S, p) => c.form.start - S.today < p.n,
      comply: (c, S, p) => { if (c.form.start - S.today < p.n) setDates(c, S.today + p.n + R.int(0, 12), c.form.days); },
      violate: (c, S, p) => { setDates(c, S.today + R.int(1, p.n - 3), c.form.days); },
      keys: () => [['form.dates', 'rule:notice'], ['form.dates', 'today']],
    },
    blackout: {
      types: PTO, exc: 'blackout',
      params: (S) => { const f = S.today + R.int(8, 20); return { from: f, to: f + R.int(10, 18) }; },
      mod: (p, S) => { const f = S.today + R.int(5, 15); return { from: f, to: f + R.int(12, 25) }; },
      text: (p) => `No PTO from ${D.fmt(p.from)} to ${D.fmt(p.to)}.`,
      memo: (p) => `PEAK SEASON READINESS WINDOW: No PTO from ${D.fmt(p.from)} through ${D.fmt(p.to)}. Our customers need us. Our shareholders need us more.`,
      modMemo: (p) => `The Peak Season Readiness Window has MOVED (and grown): now ${D.fmt(p.from)} through ${D.fmt(p.to)}.`,
      check: (c, S, p) => overlaps(c.form.start, c.form.end, p.from, p.to),
      comply: (c, S, p) => { if (overlaps(c.form.start, c.form.end, p.from, p.to)) setDates(c, R.chance(0.5) && p.from - S.today > 12 ? S.today + R.int(3, 6) : p.to + R.int(1, 8), Math.min(c.form.days, 2)); },
      violate: (c, S, p) => { setDates(c, R.int(p.from, p.to - 1), c.form.days); },
      keys: () => [['form.dates', 'rule:blackout']],
    },
    newhire: {
      types: PTO, exc: 'newhire',
      params: () => ({ n: 90 }),
      mod: (p) => ({ n: pickOther([60, 90, 120, 180], p.n) }),
      text: (p) => `No PTO if hired less than ${p.n} days ago.`,
      memo: (p) => `New hires (under ${p.n} days) may not take PTO. They have not earned their burnout yet.`,
      modMemo: (p) => `New-hire PTO waiting period is now ${p.n} days. Because reasons.`,
      check: (c, S, p) => S.today - c.badge.hire < p.n,
      comply: (c, S, p) => { if (S.today - c.badge.hire < p.n) c.badge.hire = S.today - p.n - R.int(5, 1500); },
      violate: (c, S, p) => { c.badge.hire = S.today - R.int(3, p.n - 4); },
      keys: () => [['badge.hire', 'rule:newhire'], ['badge.hire', 'today']],
    },
    maxdays: {
      types: PTO, exc: 'maxdays',
      params: () => ({ n: 3 }),
      mod: (p) => ({ n: pickOther([2, 3, 4], p.n) }),
      text: (p) => `"Unlimited" PTO: max ${p.n} days per request.`,
      memo: (p) => `GREAT NEWS! OmniGlob now offers UNLIMITED PTO! To keep it fair, requests over ${p.n} days will be denied.`,
      modMemo: (p) => `Unlimited PTO has been optimized. Max per request is now ${p.n} days. Still unlimited though!`,
      check: (c, S, p) => c.form.days > p.n,
      comply: (c, S, p) => { if (c.form.days > p.n) setDates(c, c.form.start, R.int(1, p.n)); },
      violate: (c, S, p) => { setDates(c, c.form.start, p.n + R.int(1, 4)); },
      keys: () => [['form.days', 'rule:maxdays'], ['form.dates', 'rule:maxdays']],
    },
    friday: {
      types: PTO, exc: 'friday',
      text: () => 'Focus Fridays: PTO may not START on a Friday.',
      memo: () => 'Introducing FOCUS FRIDAYS! PTO may no longer start on a Friday. Focus! (Leadership is exempt; they golf.)',
      check: (c) => D.dow(c.form.start) === 'Fri',
      comply: (c) => { if (D.dow(c.form.start) === 'Fri') setDates(c, c.form.start + 3, c.form.days); },
      violate: (c, S) => { let s = c.form.start; while (D.dow(s) !== 'Fri') s++; setDates(c, s, c.form.days); },
      keys: () => [['form.dates', 'rule:friday']],
    },
    vibes: {
      types: PTO, exc: 'vibes',
      text: () => "Deny requests citing 'vibes'.",
      memo: () => "Leadership has determined that 'vibes' is not a valid reason for time off. Deny all vibe-based requests.",
      check: (c) => /vibe/i.test(c.form.reason),
      comply: (c) => { if (/vibe/i.test(c.form.reason)) c.form.reason = R.pick(C.ptoReasons); },
      violate: (c) => { c.form.reason = R.pick(C.vibesReasons); },
      keys: () => [['form.reason', 'rule:vibes']],
    },
    ink: {
      types: ALL, exc: 'ink',
      params: () => ({ color: 'blue' }),
      mod: (p) => ({ color: pickOther(['blue', 'black', 'green'], p.color) }),
      text: (p) => `Forms must be signed in ${p.color.toUpperCase()} ink.`,
      memo: (p) => `Studies (Chad read one) show ${p.color.toUpperCase()} ink signals trust. All forms must be signed in ${p.color} ink.`,
      modMemo: (p) => ({ blue: 'Blue ink is BACK. Black ink felt "too corporate."', black: 'Blue ink is now considered "too casual." All signatures must be in BLACK ink.', green: 'Sustainability initiative! All signatures must now be in GREEN ink.' })[p.color],
      check: (c, S, p) => c.form.signed && c.form.ink !== p.color,
      comply: (c, S, p) => { c.form.ink = p.color; },
      violate: (c, S, p) => { c.form.signed = true; c.form.ink = pickOther(['blue', 'black', 'green', 'red'], p.color); },
      keys: () => [['form.sig', 'rule:ink']],
    },
    version: {
      types: ALL, exc: 'version',
      params: () => ({ v: 'b' }),
      mod: (p) => ({ v: String.fromCharCode(p.v.charCodeAt(0) + 1) }),
      text: (p) => `Only form version HR-27${p.v} is accepted.`,
      memo: (p) => `Form HR-27a is RETIRED. Only HR-27${p.v} is accepted. It has one extra checkbox. Nobody knows what it does.`,
      modMemo: (p) => `Form HR-27${String.fromCharCode(p.v.charCodeAt(0) - 1)} is now retired. Please use HR-27${p.v}. It is the same, but newer.`,
      check: (c, S, p) => c.form.version !== 'HR-27' + p.v,
      comply: (c, S, p) => { c.form.version = 'HR-27' + p.v; },
      violate: (c, S, p) => { c.form.version = 'HR-27' + String.fromCharCode(p.v.charCodeAt(0) - R.int(1, p.v.charCodeAt(0) - 97)); },
      keys: () => [['form.version', 'rule:version']],
    },
    mgr: {
      types: ALL, exc: 'mgr',
      text: () => 'Forms require manager initials.',
      memo: () => "All forms now require your manager's initials. Accountability! (Managers: please initial things.)",
      check: (c) => !c.form.mgr,
      comply: (c) => { if (!c.form.mgr) c.form.mgr = Cases.initials(); },
      violate: (c) => { c.form.mgr = ''; },
      keys: () => [['form.mgr', 'rule:mgr']],
    },
    sticker: {
      types: ALL, exc: 'sticker',
      text: () => 'Badge needs the 2026 Compliance sticker.',
      memo: () => 'Badges must display the 2026 Compliance Sticker. It is gold. It means you watched the 3-hour video.',
      check: (c) => c.badge.sticker !== 2026,
      comply: (c) => { c.badge.sticker = 2026; },
      violate: (c) => { c.badge.sticker = R.chance(0.5) ? 2025 : null; },
      keys: () => [['badge.sticker', 'rule:sticker']],
    },
    rto: {
      types: ALL, exc: 'rto',
      params: () => ({ n: 3 }),
      mod: (p) => ({ n: pickOther([2, 3, 4], p.n) }),
      text: (p) => `Remote staff need ${p.n}+ office days on swipe report.`,
      memo: (p) => `RETURN TO OFFICE! Remote employees must show ${p.n}+ office days on their Badge Swipe Report. The office misses you. (The office is empty.)`,
      modMemo: (p) => `RTO UPDATE: Remote employees now need ${p.n}+ office days. The beanbags were expensive.`,
      check: (c, S, p) => c.badge.loc === 'Remote' && (!c.swipes || c.swipes.filter(Boolean).length < p.n),
      comply: (c, S, p) => {
        if (c.badge.loc !== 'Remote') return;
        c.swipes = c.swipes || [0, 0, 0, 0, 0].map(() => R.chance(0.3));
        while (c.swipes.filter(Boolean).length < p.n) c.swipes[R.int(0, 4)] = true;
      },
      violate: (c, S, p) => {
        c.badge.loc = 'Remote';
        c.swipes = [false, false, false, false, false];
        const k = R.int(0, p.n - 1);
        for (let i = 0; i < k; i++) c.swipes[R.int(0, 4)] = true;
      },
      keys: () => [['swipes.days', 'rule:rto'], ['badge.loc', 'rule:rto']],
    },
    nephew: {
      types: ALL, exc: 'nephew', verdict: 'escalate',
      text: () => 'ESCALATE anything from Brayden Thornquist-Vance.',
      memo: () => 'Please ESCALATE any request from Brayden Thornquist-Vance, my nephew. No particular reason. You now have an ESCALATE stamp. Use it.',
      check: (c) => c.badge.first === C.nephew.first && c.badge.last === C.nephew.last,
      comply: (c) => { if (c.badge.first === C.nephew.first && c.badge.last === C.nephew.last) { c.badge.last = R.pick(C.lastNames); c.form.last = c.badge.last; } },
      violate: (c) => {
        c.badge.first = c.form.first = C.nephew.first;
        c.badge.last = c.form.last = C.nephew.last;
        c.person.face = c.badge.face = Faces.nephew();
        c.isNephew = true;
      },
      keys: () => [['form.name', 'rule:nephew'], ['badge.name', 'rule:nephew'], ['person', 'rule:nephew']],
    },
    beverage: {
      types: EXP, exc: 'beverage',
      text: () => 'No kombucha, cold brew, or oat milk.',
      memo: () => 'Kombucha, cold brew and oat milk are no longer reimbursable. Please hydrate with gratitude.',
      check: (c) => C.bannedBeverages.some((b) => b.item === c.form.item),
      comply: (c) => { if (C.bannedBeverages.some((b) => b.item === c.form.item)) Cases.setExpenseItem(c, R.pick(C.expenseItems)); },
      violate: (c) => { Cases.setExpenseItem(c, R.pick(C.bannedBeverages)); },
      keys: () => [['form.item', 'rule:beverage'], ['receipt.item', 'rule:beverage']],
    },
    vendor: {
      types: EXP, exc: 'vendor',
      text: () => `No purchases from ${C.bannedVendor}.`,
      memo: () => `${C.bannedVendor} is banned after The Incident. Do not reimburse anything purchased there.`,
      check: (c) => c.receipt.vendor === C.bannedVendor,
      comply: (c) => { if (c.receipt.vendor === C.bannedVendor) c.receipt.vendor = 'Office Planet'; },
      violate: (c) => { c.receipt.vendor = C.bannedVendor; },
      keys: () => [['receipt.vendor', 'rule:vendor']],
    },
    late: {
      types: EXP, exc: 'late',
      params: () => ({ n: 30 }),
      mod: (p) => ({ n: pickOther([14, 21, 30, 45], p.n) }),
      text: (p) => `Expenses must be within ${p.n} days of purchase.`,
      memo: (p) => `Expenses older than ${p.n} days will not be reimbursed. Time is money. Our money.`,
      modMemo: (p) => `Expense window is now ${p.n} days. Finance found a new spreadsheet.`,
      check: (c, S, p) => S.today - c.receipt.date > p.n,
      comply: (c, S, p) => { if (S.today - c.receipt.date > p.n) c.receipt.date = S.today - R.int(1, p.n - 1); },
      violate: (c, S, p) => { c.receipt.date = S.today - p.n - R.int(2, 60); },
      keys: () => [['receipt.date', 'rule:late'], ['receipt.date', 'today']],
    },
    vp: {
      types: EXP, exc: 'vp',
      params: () => ({ amt: R.pick([50, 75, 100]) }),
      mod: (p) => ({ amt: pickOther([25, 50, 75, 100, 150], p.amt) }),
      text: (p) => `Expenses over ${money(p.amt)} need VP signature.`,
      memo: (p) => `Expenses over ${money(p.amt)} require a VP signature. VPs are available Tuesdays, 2:00-2:05pm.`,
      modMemo: (p) => `VP signature threshold is now ${money(p.amt)}. Inflation, probably.`,
      check: (c, S, p) => c.form.amount > p.amt && !c.form.vp,
      comply: (c, S, p) => { if (c.form.amount > p.amt) c.form.vp = true; },
      violate: (c, S, p) => {
        if (c.form.amount <= p.amt) { c.form.amount = p.amt + R.int(5, 200); c.receipt.amount = c.form.amount; }
        c.form.vp = false;
      },
      keys: () => [['form.vp', 'rule:vp'], ['form.amount', 'rule:vp']],
    },
    exp: {
      types: OFF, exc: 'exp',
      params: () => ({ n: R.pick([5, 8]) }),
      mod: (p) => ({ n: pickOther([5, 8, 10, 12], p.n) }),
      text: (p) => `Entry-level roles need ${p.n}+ years experience.`,
      memo: (p) => `To raise the bar, ENTRY-LEVEL roles now require ${p.n}+ years of experience.`,
      modMemo: (p) => `Entry-level experience requirement is now ${p.n}+ years. We are very selective about entry.`,
      check: (c, S, p) => c.form.level === 'Entry' && c.resume.years < p.n,
      comply: (c, S, p) => { if (c.form.level === 'Entry' && c.resume.years < p.n) c.resume.years = p.n + R.int(0, 9); },
      violate: (c, S, p) => { c.form.level = 'Entry'; c.form.role = R.pick(C.roles); c.resume.years = R.int(0, p.n - 1); },
      keys: () => [['resume.years', 'rule:exp'], ['form.level', 'rule:exp']],
    },
    band: {
      types: OFF, exc: 'band',
      params: () => ({ max: 42000 }),
      mod: (p) => ({ max: pickOther([31000, 38000, 42000, 45000], p.max) }),
      text: (p) => `Entry-level salary max: ${money(p.max)}.`,
      memo: (p) => `The entry-level salary band max is ${money(p.max)}. Remember: free snacks are compensation.`,
      modMemo: (p) => `Entry-level band adjusted to ${money(p.max)}. Market data (one blog post) supports this.`,
      check: (c, S, p) => c.form.level === 'Entry' && c.form.salary > p.max,
      comply: (c, S, p) => { if (c.form.level === 'Entry' && c.form.salary > p.max) c.form.salary = p.max - R.int(0, 8) * 500; },
      violate: (c, S, p) => { c.form.level = 'Entry'; c.form.role = R.pick(C.roles); c.form.salary = p.max + R.int(1, 30) * 500; },
      keys: () => [['form.salary', 'rule:band']],
    },
    word: {
      types: OFF, exc: 'word',
      text: () => "Deny candidates listing 'Microsoft Word'.",
      memo: () => "Candidates listing 'Microsoft Word' as a skill are overqualified and intimidate leadership. Deny.",
      check: (c) => c.resume.skills.includes(C.wordSkill),
      comply: (c) => { c.resume.skills = c.resume.skills.map((s) => (s === C.wordSkill ? pickOther(C.skills, s) : s)); },
      violate: (c) => { c.resume.skills[R.int(0, c.resume.skills.length - 1)] = C.wordSkill; },
      keys: () => [['resume.skills', 'rule:word']],
    },
  };
  for (const [id, r] of Object.entries(RULES)) r.id = id;

  window.Rules = { RULES, deptName, oldNames, currentNames, money };
})();
