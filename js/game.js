// PTO, PLEASE — main game: scenes, input, the booth, the desk, days, endings.
(function () {
  const { PAL, rect, frame } = G;
  const T = (g, s, x, y, c = PAL.ink, sc = 1) => Font.text(g, s, x, y, c, sc);
  const TW = (s, sc = 1) => Font.width(s, sc);
  const TC = (g, s, cx, y, c, sc = 1) => T(g, s, Math.round(cx - TW(s, sc) / 2), y, c, sc);
  const money = Rules.money;
  const SAVE = 'ptoplease_save_v1';
  const MIN_SEC = 0.55; // real seconds per game minute
  const DAY_MIN = 480;
  const SPEC = { booth: [0, 112, 148, 248], desk: [148, 112, 332, 248], counter: [2, 220, 116, 36], bell: [122, 221, 22, 22],
    window: [8, 120, 132, 96], person: [36, 128, 76, 88], clock: [4, 4, 80, 33], stampTab: [466, 186, 14, 64],
    inspect: [98, 221, 22, 22], music: [454, 90, 22, 16], transcript: [4, 260, 140, 96] };
  const inR = (x, y, r) => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];

  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  let officeBg, deskBg, boothBg;

  const Gm = {
    scene: 'title', t: 0, docs: [], zc: 1, transcript: [], floats: [], banner: null, hint: null,
    stampOpen: false, stampAnim: null, inspect: false, sel: null, popup: null, queue: [], fillers: [],
    walkerIn: null, walkersOut: [], booth: { state: 'empty', slide: 0 }, nowServing: 40,
  };
  window.Gm = Gm;

  // ---------- Save / load ----------
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ run: Gm.run, S: Gm.S, bonus: Gm.bonus, stats: Gm.stats, nextDay: Gm.S.day + 1, nowServing: Gm.nowServing })); } catch (e) {}
  }
  function loadSave() { try { const s = localStorage.getItem(SAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }

  // ---------- Run / day lifecycle ----------
  function newGame() {
    RNG.seed((Date.now() ^ (Math.random() * 1e9)) & 0x7fffffff);
    Gm.run = Cases.planRun();
    Gm.S = { day: 0, today: 0, depts: C.depts.map((_, i) => ({ chain: i, lvl: 0 })), rules: [], types: ['pto'], escalate: false, formV: 'a' };
    Gm.bonus = 2500;
    Gm.stats = { correct: 0, total: 0, citations: 0, found: 0 };
    startDay(1);
  }
  function continueGame() {
    const s = loadSave(); if (!s) return newGame();
    Object.assign(Gm, { run: s.run, S: s.S, bonus: s.bonus, stats: s.stats, nowServing: s.nowServing || 40 });
    startDay(s.nextDay);
  }

  function startDay(n) {
    const dp = Gm.run.plan[n - 1];
    Cases.applyDay(Gm.S, dp);
    Gm.dp = dp;
    Gm.memo = Cases.memoFor(dp);
    Gm.clock = 0; Gm.dayOver = false; Gm.closedAnnounced = false;
    Gm.dayStart = Gm.bonus;
    Gm.day = { correct: 0, wrong: 0, cases: 0, cites: 0, penalty: 0, kudos: 0, found: 0 };
    Gm.docs = []; Gm.transcript = []; Gm.floats = []; Gm.banner = null; Gm.sel = null; Gm.inspect = false; Gm.stampOpen = false;
    Gm.booth = { state: 'empty', slide: 0 }; Gm.cur = null; Gm.walkerIn = null; Gm.walkersOut = [];
    Gm.interruptDone = !dp.interrupt; Gm.kendraDone = !dp.kendraDrop;
    Gm.bookNew = n > 1 && dp.events.length > 0;
    Gm.tut = n === 1 ? 0 : -1;
    addDoc({ kind: 'book', where: 'desk', x: 156, y: 292, owner: 'me' });
    addDoc({ kind: 'memo', where: 'desk', x: 270, y: 118, owner: 'me' });
    // the line
    Gm.queue = [];
    const kendraAt = dp.kendraCase ? RNG.int(1, 5) : -1;
    for (let i = 0; i < 9; i++) Gm.queue.push(makeQueued(i === kendraAt));
    Gm.fillers = [];
    for (let i = 0; i < 16; i++) Gm.fillers.push(Faces.random());
    layoutQueue(true);
    Gm.dayTip = RNG.pick(['Leadership has been busy. Read the memo.', 'Your bonus is watching.', 'Kendra is in the building.', 'Remember: the handbook is always right. Even when it is wrong.']);
    Gm.scene = 'dayintro'; Gm.sceneT = 0;
  }

  function makeQueued(kendra) {
    const c = Cases.gen(Gm.S, kendra ? { kendra: true } : {});
    return { c, x: -20, tx: 0, step: 0 };
  }
  function layoutQueue(snap) {
    Gm.queue.forEach((q, i) => { q.tx = 408 - i * 14; if (snap) q.x = q.tx; });
  }

  function addDoc(d) {
    const doc = Object.assign({ id: Math.random().toString(36).slice(2), z: Gm.zc++, stamps: [] }, d);
    Gm.docs.push(doc);
    return doc;
  }
  function docSize(doc) { return doc.where === 'desk' ? Docs.size(doc) : Docs.MINI; }
  function clampDoc(doc) {
    const [w, h] = docSize(doc);
    if (doc.where === 'desk') {
      doc.x = Math.max(150, Math.min(480 - w, doc.x)); doc.y = Math.max(113, Math.min(360 - h, doc.y));
    } else {
      doc.x = Math.max(2, Math.min(96 - w, doc.x)); doc.y = Math.max(218, Math.min(256 - h, doc.y));
    }
  }

  // ---------- Booth flow ----------
  function say(who, text) { Gm.transcript.push({ who, text, t: Gm.t }); if (Gm.transcript.length > 30) Gm.transcript.shift(); }

  function callNext() {
    if (Gm.booth.state !== 'empty' || Gm.dayOver) return;
    Sound.SFX.bell();
    Gm.nowServing++;
    const q = Gm.queue.shift();
    Gm.queue.push(makeQueued(false));
    layoutQueue(false);
    Gm.queue[Gm.queue.length - 1].x = -30;
    Gm.walkerIn = q;
    Gm.booth.state = 'arriving';
    Gm.transcript = [];
    if (Gm.tut === 0) Gm.tut = 1;
  }

  function personArrives() {
    const c = Gm.walkerIn.c;
    Gm.walkerIn = null;
    Gm.cur = c; c.revealed = [];
    Gm.booth.state = 'entering'; Gm.booth.slide = 0;
    c.lines.forEach((l, i) => setTimeout(() => { if (Gm.cur === c) say('them', l); }, 350 + i * 1100));
    setTimeout(() => {
      if (Gm.cur !== c) return;
      Sound.SFX.paper();
      c.docs.forEach((k, i) => addDoc({ kind: k, where: 'counter', x: 6 + i * 23, y: 226, caseDoc: true }));
      say('sys', '*slides papers across the counter*');
      Gm.day.cases++;
    }, 900);
  }

  function handBack(formDoc) {
    const c = Gm.cur;
    const kinds = [...new Set(formDoc.stamps.map((s) => s.kind))];
    if (!kinds.length) { say('them', RNG.pick(C.unstamped)); formDoc.where = 'counter'; formDoc.x = 30; formDoc.y = 226; clampDoc(formDoc); return; }
    const chosen = kinds.length > 1 ? 'conflict' : kinds[0];
    const correct = chosen === c.verdict;
    // reaction
    let line;
    if (c.isKendra) line = chosen === 'approve' ? "Thanks, bestie! I'll still CC your manager." : 'Wow. Writing this down. In my notes. About you.';
    else if (c.isNephew) line = chosen === 'escalate' ? RNG.pick(C.escalated) : chosen === 'approve' ? 'Nice. Uncle Brock will hear you are cool.' : 'DENIED?! Do you know who my uncle is?';
    else line = RNG.pick({ approve: C.approved, deny: C.denied, escalate: ['Escalated? To who?', 'Okay... I will wait by the phone.'], conflict: ['So... is that a yes AND a no?'] }[chosen]);
    say('them', line);
    Gm.docs = Gm.docs.filter((d) => !d.caseDoc);
    Gm.sel = null;
    Gm.stats.total++;
    if (correct) {
      Gm.day.correct++; Gm.stats.correct++; Gm.bonus += 5; Gm.day.kudos += 5;
      Gm.floats.push({ text: '+$5', x: 420, y: 26, t: Gm.t, color: '#8fd18a' });
      Sound.SFX.good();
    } else {
      Gm.day.wrong++;
      setTimeout(() => citation(c, chosen), 900);
    }
    if (Gm.tut >= 0 && Gm.tut < 5) Gm.tut = 5;
    Gm.booth.state = 'leaving'; Gm.booth.leaveAt = Gm.t + 1.6;
  }

  function citeReason(c, chosen) {
    if (chosen === 'conflict') return 'Multiple stamps on one form. Pick a lane.';
    if (c.verdict === 'escalate') return "Failed to ESCALATE the CEO's nephew. Brock is 'disappointed.'";
    if (chosen === 'escalate') return 'Escalated for no reason. Leadership hates being bothered.';
    if (chosen === 'approve') {
      const f = c.flaws[0]; const r = Gm.S.rules.find((x) => x.id === f.id);
      return 'Approved despite rule: ' + Rules.RULES[f.id].text(r && r.p);
    }
    return 'Denied a valid request. Employee left a Glassdoor review.';
  }
  function citation(c, chosen) {
    Gm.day.cites++; Gm.stats.citations++;
    let penalty = 'WARNING';
    if (Gm.day.cites > 2) { penalty = '-$100'; Gm.bonus -= 100; Gm.day.penalty += 100; Gm.floats.push({ text: '-$100', x: 410, y: 26, t: Gm.t, color: '#ff8a7a' }); }
    Sound.SFX.print();
    const d = addDoc({ kind: 'citation', where: 'desk', x: 168 + RNG.int(0, 40), y: 113, owner: 'me', reason: citeReason(c, chosen), penalty, slideFrom: Gm.t });
    clampDoc(d);
  }

  // ---------- Stamping ----------
  const STAMPS = () => (Gm.S.escalate ? ['approve', 'deny', 'escalate'] : ['approve', 'deny']);
  function stampButtons() {
    const list = STAMPS();
    return list.map((k, i) => ({ k, r: [304 + i * 58, 116, 52, 26] }));
  }
  function doStamp(kind, r) {
    if (Gm.stampAnim) return;
    Gm.stampAnim = { kind, x: r[0] - 2, t: Gm.t, done: false };
  }
  function stampImpact(a) {
    Sound.SFX.stamp();
    const px = a.x + 28, py = 160;
    const top = Gm.docs.filter((d) => d.where === 'desk' && hitDoc(d, px, py)).sort((p, q) => q.z - p.z)[0];
    if (top && top.kind === 'form') {
      top.stamps.push({ kind: a.kind, x: a.x - top.x, y: 150 - top.y });
      if (Gm.tut >= 0 && Gm.tut < 4) Gm.tut = 4;
    } else {
      Gm.banner = { text: top ? 'Only the FORM can be stamped. Slide the form under the stamp first.' : 'You stamped the desk. Slide the FORM under the stamp first.', color: PAL.orange, t: Gm.t, dur: 3 };
      Sound.SFX.bad();
    }
  }

  // ---------- Inspect ----------
  function fieldAt(x, y) {
    const desk = Gm.docs.filter((d) => d.where === 'desk' && hitDoc(d, x, y)).sort((p, q) => q.z - p.z);
    if (desk.length) {
      const f = (desk[0].fields || []).find((f) => inR(x, y, [f.x, f.y, f.w, f.h]));
      return f ? f.key : null;
    }
    if (Gm.cur && Gm.booth.state === 'active' && inR(x, y, SPEC.person)) return 'person';
    if (inR(x, y, SPEC.clock)) return 'today';
    return null;
  }
  function rectForKey(key) {
    if (key === 'person') return SPEC.person;
    if (key === 'today') return SPEC.clock;
    const docs = Gm.docs.filter((d) => d.where === 'desk').sort((p, q) => q.z - p.z);
    for (const d of docs) { const f = (d.fields || []).find((f) => f.key === key); if (f) return [f.x, f.y, f.w, f.h]; }
    return null;
  }
  function inspectTap(x, y) {
    const key = fieldAt(x, y);
    if (!key) return;
    Sound.SFX.click();
    if (!Gm.sel) { Gm.sel = { a: key }; return; }
    if (Gm.sel.a === key) { Gm.sel = null; return; }
    const a = Gm.sel.a, b = key;
    const c = Gm.cur;
    const flaw = c && Gm.booth.state === 'active' && c.flaws.find((f) => f.keys.some(([p, q]) => (p === a && q === b) || (p === b && q === a)));
    if (flaw) {
      Sound.SFX.find();
      const r = Gm.S.rules.find((x) => x.id === flaw.id);
      Gm.banner = { text: 'DISCREPANCY: ' + Rules.RULES[flaw.id].text(r && r.p), color: PAL.red, t: Gm.t, dur: 4 };
      Gm.sel = { a, b, hit: true, t: Gm.t };
      if (!c.revealed.includes(flaw.id)) {
        c.revealed.push(flaw.id); Gm.day.found++; Gm.stats.found++;
        say('them', RNG.pick(C.excuses[flaw.exc] || ['Uh...']));
      }
    } else {
      Gm.banner = { text: 'No discrepancy there.', color: PAL.inkSoft, t: Gm.t, dur: 1.6 };
      Gm.sel = { a, b, hit: false, t: Gm.t };
    }
  }

  // ---------- Input ----------
  let drag = null, pointerId = null;
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * 480 / r.width, (e.clientY - r.top) * 360 / r.height];
  }
  function hitDoc(d, x, y) { const [w, h] = docSize(d); return x >= d.x && x < d.x + w && y >= d.y && y < d.y + h; }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.init();
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
    const [x, y] = pos(e);
    drag = { sx: x, sy: y, x, y, moved: false, doc: null };
    if (Gm.scene !== 'work' || Gm.popup || Gm.inspect) return;
    if (Gm.stampOpen && x > 296 && y < 147) return; // stamp bar area: taps only
    const cand = Gm.docs.filter((d) => hitDoc(d, x, y)).sort((p, q) => (p.where === q.where ? q.z - p.z : p.where === 'desk' ? -1 : 1));
    if (cand.length) {
      const d = cand[0];
      d.z = Gm.zc++;
      drag.doc = d; drag.ox = x - d.x; drag.oy = y - d.y; drag.from = d.where;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId || !drag) return;
    const [x, y] = pos(e);
    drag.x = x; drag.y = y;
    if (Math.abs(x - drag.sx) + Math.abs(y - drag.sy) > 5) drag.moved = true;
  });
  function endPointer(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const d = drag; drag = null;
    if (!d) return;
    if (d.moved && d.doc) drop(d); else tapAt(d.sx, d.sy, d.doc);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  function overBooth(x, y) { return x < 148 && y > 112; }

  function drop(d) {
    const doc = d.doc, x = d.x, y = d.y;
    Sound.SFX.paper();
    if (overBooth(x, y)) {
      if (doc.owner === 'me') { // your stuff stays on your desk
        doc.where = 'desk'; doc.x = 152; doc.y = Math.min(y, 300); clampDoc(doc); return;
      }
      if (doc.kind === 'form' && Gm.booth.state === 'active') {
        if (doc.stamps.length) { handBack(doc); return; }
      }
      doc.where = 'counter'; doc.x = x - 11; doc.y = y - 14; clampDoc(doc);
      if (doc.kind === 'form' && !doc.stamps.length && Gm.booth.state === 'active') say('them', RNG.pick(C.unstamped));
      return;
    }
    if (doc.where === 'counter' || d.from === 'counter') {
      doc.where = 'desk';
      const [w] = Docs.size(doc);
      doc.x = x - w / 2; doc.y = y - 10;
      if (Gm.tut === 2) Gm.tut = 3;
    } else { doc.x = x - d.ox; doc.y = y - d.oy; }
    clampDoc(doc);
  }

  function tapAt(x, y, doc) {
    if (Gm.scene === 'title') return titleTap(x, y);
    if (Gm.scene === 'dayintro') { if (Gm.sceneT > 0.5) { Gm.scene = 'work'; Sound.SFX.click(); } return; }
    if (Gm.scene === 'eod') return eodTap(x, y);
    if (Gm.scene === 'review' || Gm.scene === 'pip') { if (Gm.sceneT > 2 && inR(x, y, [170, 316, 140, 24])) { clearSave(); Gm.scene = 'title'; Gm.sceneT = 0; } return; }
    if (Gm.scene !== 'work') return;
    if (Gm.popup) { if (Gm.t - Gm.popup.t > 0.6) closePopup(); return; }
    // global buttons
    if (inR(x, y, SPEC.music)) { const on = Sound.toggleMusic(); Gm.banner = { text: on ? 'Music ON' : 'Music OFF', color: PAL.orange, t: Gm.t, dur: 1.2 }; return; }
    if (inR(x, y, SPEC.inspect)) { Gm.inspect = !Gm.inspect; Gm.sel = null; Sound.SFX.click(); if (Gm.inspect) { Gm.stampOpen = false; Gm.banner = { text: 'INSPECT: tap two things that should match.', color: PAL.blue, t: Gm.t, dur: 2.5 }; } return; }
    if (Gm.inspect) { inspectTap(x, y); return; }
    if (Gm.stampOpen) {
      for (const b of stampButtons()) if (inR(x, y, b.r)) { doStamp(b.k, b.r); return; }
      if (inR(x, y, [282, 112, 14, 34])) { Gm.stampOpen = false; Sound.SFX.click(); return; }
      if (x > 296 && y < 147) return;
    } else if (inR(x, y, SPEC.stampTab)) { Gm.stampOpen = true; Sound.SFX.click(); if (Gm.tut === 3) Gm.tut = 3.5; return; }
    if (inR(x, y, SPEC.bell)) { callNext(); return; }
    if (doc) {
      if (doc.where === 'counter') { // tap a mini doc: pop it open on the desk
        doc.where = 'desk';
        const n = Gm.docs.filter((q) => q.where === 'desk' && q.caseDoc).length;
        doc.x = 160 + n * 26; doc.y = 120 + n * 12; clampDoc(doc); Sound.SFX.paper();
        if (Gm.tut === 2) Gm.tut = 3;
        return;
      }
      const r = Docs.tap(doc, x - doc.x, y - doc.y);
      if (r === 'dismiss') Gm.docs = Gm.docs.filter((q) => q !== doc);
      if (r === 'open') { Gm.bookNew = false; doc.x = Math.min(doc.x, 276); doc.y = 113; clampDoc(doc); }
      if (r) Sound.SFX.click();
    }
  }

  // ---------- Popups (interruptions) ----------
  function openPopup(p) { Gm.popup = Object.assign({ t: Gm.t }, p); Sound.SFX.alarm(); }
  function closePopup() {
    const p = Gm.popup; Gm.popup = null;
    Gm.clock = Math.min(DAY_MIN, Gm.clock + p.mins);
    Gm.floats.push({ text: `-${p.mins} min`, x: 20, y: 36, t: Gm.t, color: '#ffe08a' });
  }

  // ---------- End of day ----------
  function endDay() {
    const lines = [['Starting bonus', Gm.dayStart, 'base']];
    lines.push([`Cases done right (${Gm.day.correct} x $5)`, Gm.day.kudos, 'plus']);
    lines.push([`Citations (${Gm.day.cites}, 2 free)`, -Gm.day.penalty, 'minus']);
    const picks = RNG.shuffle(C.deductions).slice(0, RNG.int(2, 3));
    for (const [name, a, b] of picks) {
      const amt = Math.round(RNG.int(a, b) * (1 + Gm.S.day * 0.06));
      Gm.bonus -= amt; lines.push([name, -amt, 'minus']);
    }
    lines.push(['Bonus balance', Gm.bonus, 'total']);
    Gm.ledger = { lines, aff: RNG.pick(C.affirmations), kendra: RNG.chance(0.6) ? RNG.pick(C.kendraEOD) : null };
    Gm.scene = 'eod'; Gm.sceneT = 0;
    if (Gm.bonus > 0 && Gm.S.day < Gm.run.days) save();
    Sound.SFX.clockout();
  }
  function eodTap(x, y) {
    if (Gm.sceneT < 1.5) return;
    if (!inR(x, y, [170, 322, 140, 24])) return;
    Sound.SFX.click();
    if (Gm.bonus <= 0) { Gm.scene = 'pip'; Gm.sceneT = 0; clearSave(); }
    else if (Gm.S.day >= Gm.run.days) { buildReview(); Gm.scene = 'review'; Gm.sceneT = 0; clearSave(); }
    else startDay(Gm.S.day + 1);
  }
  function buildReview() {
    const acc = Gm.stats.total ? Gm.stats.correct / Gm.stats.total : 0;
    const factor = RNG.int(21, 43) / 100;
    let rating, outcome;
    if (acc >= 0.92) {
      rating = 'EXCEEDS EXPECTATIONS';
      outcome = ['You have been PROMOTED to SVP of People Excitement!', 'Your bonus will be paid in OmniGlob Bucks.', 'Your first task: write tomorrow\'s memo.'];
    } else if (acc >= 0.75) {
      rating = 'MEETS EXPECTATIONS';
      outcome = ['Your bonus has been adjusted by the', `Macroeconomic Headwinds Factor (x${factor.toFixed(2)}).`, 'Please enjoy this branded stress ball.'];
    } else {
      rating = 'NEEDS IMPROVEMENT';
      outcome = ['Your bonus has been converted into', 'one (1) pizza party coupon. One slice.', 'Glory to OmniGlob.'];
    }
    const payout = acc >= 0.92 ? Math.round(Gm.bonus * factor) : acc >= 0.75 ? Math.round(Gm.bonus * factor) : 0;
    Gm.review = { acc, rating, outcome, payout, factor, quote: RNG.pick(C.affirmations) };
  }

  // ---------- Update ----------
  function update(dt) {
    Gm.t += dt; Gm.sceneT = (Gm.sceneT || 0) + dt;
    if (Gm.scene !== 'work') return;
    // queue shuffle
    for (const q of Gm.queue) { if (Math.abs(q.x - q.tx) > 0.5) { q.x += Math.sign(q.tx - q.x) * Math.min(Math.abs(q.tx - q.x), 30 * dt); q.step += dt * 8; } }
    if (Gm.walkerIn) {
      const w = Gm.walkerIn; w.x += 34 * dt; w.step += dt * 8;
      if (w.x >= 442) personArrives();
    }
    Gm.walkersOut = Gm.walkersOut.filter((w) => { w.x -= 36 * dt; w.step += dt * 8; return w.x > -12; });
    // booth anims
    const b = Gm.booth;
    if (b.state === 'entering') { b.slide = Math.min(1, b.slide + dt * 3); if (b.slide >= 1) b.state = 'active'; if (Gm.tut === 1 && Gm.cur) setTimeout(() => { if (Gm.tut === 1) Gm.tut = 2; }, 1200); }
    if (b.state === 'leaving' && Gm.t > b.leaveAt) {
      b.slide = Math.max(0, b.slide - dt * 3);
      if (b.slide <= 0) { b.state = 'empty'; Gm.walkersOut.push({ f: Gm.cur.person.face, x: 440, step: 0 }); Gm.cur = null; }
    }
    // stamp anim
    if (Gm.stampAnim) { const a = Gm.stampAnim; const k = Gm.t - a.t; if (!a.done && k > 0.12) { a.done = true; stampImpact(a); } if (k > 0.3) Gm.stampAnim = null; }
    // clock
    if (!Gm.popup && !Gm.dayOver) {
      Gm.clock += dt / MIN_SEC;
      if (!Gm.interruptDone && Gm.clock >= Gm.dp.interrupt.at) {
        Gm.interruptDone = true; const it = C.interruptions[Gm.dp.interrupt.i];
        openPopup({ kind: 'interrupt', title: it.t, body: it.body, mins: it.mins });
      } else if (!Gm.kendraDone && Gm.clock >= Gm.dp.kendraDrop.at) {
        Gm.kendraDone = true;
        openPopup({ kind: 'kendra', title: 'KENDRA STOPS BY', body: C.kendraDrops[Gm.dp.kendraDrop.i], mins: RNG.int(15, 30) });
      }
      if (Gm.clock >= DAY_MIN) { Gm.clock = DAY_MIN; Gm.dayOver = true; }
    }
    if (Gm.dayOver && !Gm.closedAnnounced) {
      Gm.closedAnnounced = true; Sound.SFX.bell(); setTimeout(() => Sound.SFX.bell(), 300);
      Gm.banner = { text: "5:00 PM! Finish this case, then you're done.", color: PAL.orange, t: Gm.t, dur: 3.5 };
    }
    if (Gm.dayOver && b.state === 'empty' && !Gm.walkerIn && !Gm.popup) {
      if (!Gm.endAt) Gm.endAt = Gm.t + 1.2;
      if (Gm.t > Gm.endAt) { Gm.endAt = null; endDay(); }
    }
    Gm.floats = Gm.floats.filter((f) => Gm.t - f.t < 1.6);
  }

  // ---------- Render ----------
  function timeStr(m) {
    const h = 9 + Math.floor(m / 60), mm = Math.floor(m % 60);
    return `${((h - 1) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  function drawOffice() {
    g.drawImage(officeBg, 0, 0);
    // cubicle heads
    [[312, 0], [356, 3], [394, 6]].forEach(([x, ph], i) => {
      const bob = Math.round(Math.sin(Gm.t * 2 + ph) * 0.8);
      G.walker(g, Gm.fillers[i] || Faces.nephew(), x, 26 + bob, 0, 1);
    });
    rect(g, 300, 36, 120, 1, G.PAL.cubeTop);
    for (let x = 300; x < 420; x += 40) { rect(g, x, 37, 36, 23, G.PAL.cube); rect(g, x + 35, 37, 1, 23, G.PAL.cubeDark); }
    // now serving
    rect(g, 344, 6, 74, 12, '#1b1416'); frame(g, 344, 6, 74, 12, '#444');
    T(g, 'NOW: ' + String(Gm.nowServing).padStart(3, '0'), 348, 8, '#ff5a3a');
    // queue (fillers trail off the left)
    const last = Gm.queue.length ? Gm.queue[Gm.queue.length - 1].tx : 400;
    Gm.fillers.forEach((f, i) => { const x = last - (i + 1) * 14; if (x > -10) G.walker(g, f, x, 78, 0, 1); });
    for (const q of Gm.queue) G.walker(g, q.c.person.face, q.x, 78, Math.floor(q.step), 1);
    if (Gm.walkerIn) G.walker(g, Gm.walkerIn.c.person.face, Gm.walkerIn.x, 78 - Math.max(0, (Gm.walkerIn.x - 420) * 0.9), Math.floor(Gm.walkerIn.step), 1);
    for (const w of Gm.walkersOut) G.walker(g, w.f, w.x, 94, Math.floor(w.step), -1);
    // HUD: clock
    rect(g, 4, 4, 80, 33, PAL.dark); frame(g, 4, 4, 80, 33, '#4a4550');
    T(g, Dates.long(Gm.S.today), 8, 7, PAL.paper);
    T(g, timeStr(Gm.clock), 8, 17, Gm.dayOver ? '#ff8a7a' : '#9fe08a');
    T(g, `DAY ${Gm.S.day}/${Gm.run.days}`, 8, 26, '#9a90a8');
    // bonus
    rect(g, 392, 22, 84, 13, PAL.dark); frame(g, 392, 22, 84, 13, '#4a4550');
    T(g, 'BONUS ' + money(Gm.bonus), 396, 25, Gm.bonus < 500 ? '#ff8a7a' : PAL.gold);
    // music toggle
    rect(g, 454, 90, 22, 16, PAL.dark); frame(g, 454, 90, 22, 16, '#4a4550');
    const nc = Sound.musicOn ? PAL.paper : '#555';
    rect(g, 462, 94, 1, 7, nc); rect(g, 463, 94, 4, 1, nc); rect(g, 466, 94, 1, 6, nc); rect(g, 460, 100, 3, 2, nc); rect(g, 464, 99, 3, 2, nc);
    if (!Sound.musicOn) for (let i = 0; i < 12; i++) rect(g, 458 + i, 92 + i, 1, 1, PAL.red);
  }

  function drawBooth() {
    g.drawImage(boothBg, 0, 112);
    const c = Gm.cur;
    const b = Gm.booth;
    if (c && b.slide > 0) {
      g.save(); g.beginPath(); g.rect(SPEC.window[0], SPEC.window[1], SPEC.window[2], SPEC.window[3]); g.clip();
      const last = Gm.transcript[Gm.transcript.length - 1];
      const talking = last && last.who === 'them' && (Gm.t - last.t) * 40 < last.text.length && Math.floor(Gm.t * 8) % 2 === 0;
      const blink = Math.floor(Gm.t * 10) % 37 === 0;
      G.face(g, c.person.face, 38, 132 + Math.round((1 - b.slide) * 90), 3, talking, blink);
      g.restore();
    }
    // counter minis
    for (const d of Gm.docs.filter((d) => d.where === 'counter').sort((p, q) => p.z - q.z)) if (!(drag && drag.moved && drag.doc === d)) Docs.drawMini(g, d, d.x, d.y);
    // bell
    const br = SPEC.bell, ready = b.state === 'empty' && !Gm.dayOver;
    rect(g, br[0] + 2, br[1] + 16, 18, 4, '#3a3832');
    rect(g, br[0] + 5, br[1] + 6, 12, 10, ready ? PAL.gold : '#8a7a4a'); rect(g, br[0] + 3, br[1] + 14, 16, 3, ready ? '#b8952e' : '#6a5a3a');
    rect(g, br[0] + 10, br[1] + 3, 2, 3, '#555');
    if (ready && Math.floor(Gm.t * 2) % 2 === 0) T(g, 'NEXT', br[0] - 2, br[1] - 9, PAL.gold);
    if (Gm.dayOver && b.state === 'empty') T(g, 'CLOSED', br[0] - 14, br[1] - 9, PAL.red);
    // transcript
    rect(g, 4, 260, 140, 96, '#e6dfcc'); frame(g, 4, 260, 140, 96, '#b8ad92');
    const lines = [];
    for (const e of Gm.transcript) {
      const shown = e.text.slice(0, Math.max(0, Math.floor((Gm.t - e.t) * 40)));
      Font.wrap(e.who === 'them' ? '"' + shown + (shown.length >= e.text.length ? '"' : '') : shown, 132).forEach((l) => lines.push([l, e.who]));
    }
    lines.slice(-9).forEach(([l, who], i) => T(g, l, 8, 263 + i * 10, who === 'them' ? PAL.ink : who === 'sys' ? PAL.inkSoft : PAL.blue));
    if (!Gm.transcript.length) T(g, Gm.dayOver ? 'Day is over.' : 'Ring the bell.', 8, 263, PAL.inkSoft);
  }

  function drawDocFull(d, x, y) { Docs.DRAW[d.kind](g, d, x, y, { c: Gm.cur, S: Gm.S, game: Gm }); }

  function drawDesk() {
    g.drawImage(deskBg, 148, 112);
    const desk = Gm.docs.filter((d) => d.where === 'desk').sort((p, q) => p.z - q.z);
    for (const d of desk) {
      if (drag && drag.moved && drag.doc === d) continue;
      let y = d.y;
      if (d.slideFrom != null) { const k = Math.min(1, (Gm.t - d.slideFrom) * 3); y = Math.round(d.y - (1 - k) * 60); }
      if (!d.caseDoc || Gm.cur) drawDocFull(d, d.x, y);
    }
    // stamp bar
    if (Gm.stampOpen) {
      rect(g, 296, 112, 184, 34, '#2b2730'); rect(g, 296, 146, 184, 2, '#18151b');
      rect(g, 282, 112, 14, 34, '#2b2730'); T(g, '>', 286, 124, PAL.paper);
      for (const b of stampButtons()) {
        const col = { approve: PAL.green, deny: PAL.red, escalate: PAL.purple }[b.k];
        const lab = { approve: 'APPROVE', deny: 'DENY', escalate: 'ESCALATE' }[b.k];
        const anim = Gm.stampAnim && Gm.stampAnim.kind === b.k ? Math.sin(Math.min(1, (Gm.t - Gm.stampAnim.t) / 0.3) * Math.PI) * 16 : 0;
        rect(g, b.r[0], b.r[1] + anim, b.r[2], b.r[3], G.shade(col, 0.8)); frame(g, b.r[0], b.r[1] + anim, b.r[2], b.r[3], G.shade(col, 0.5));
        rect(g, b.r[0] + 18, b.r[1] - 4 + anim, 16, 6, '#6b4a2e');
        TC(g, lab, b.r[0] + b.r[2] / 2, b.r[1] + 9 + anim, PAL.white);
      }
    } else {
      const r = SPEC.stampTab;
      rect(g, r[0], r[1], r[2], r[3], '#2b2730');
      'STAMP'.split('').forEach((ch, i) => T(g, ch, r[0] + 4, r[1] + 6 + i * 11, PAL.gold));
    }
    // inspect button
    const ir = SPEC.inspect;
    rect(g, ir[0], ir[1], ir[2], ir[3], Gm.inspect ? PAL.gold : '#2b2730'); frame(g, ir[0], ir[1], ir[2], ir[3], '#18151b');
    const ic = Gm.inspect ? PAL.ink : PAL.paper;
    frame(g, ir[0] + 7, ir[1] + 4, 9, 9, ic); for (let i = 0; i < 5; i++) rect(g, ir[0] + 15 + i, ir[1] + 12 + i, 2, 2, ic);
  }

  function drawInspectOverlay() {
    if (!Gm.inspect) return;
    g.fillStyle = 'rgba(40,60,120,0.12)'; g.fillRect(0, 112, 480, 248);
    frame(g, 0, 0, 480, 360, PAL.gold); frame(g, 1, 1, 478, 358, PAL.gold);
    const s = Gm.sel;
    if (!s) return;
    const col = s.b ? (s.hit ? PAL.red : '#8a8a8a') : '#ffd23a';
    const ra = rectForKey(s.a), rb = s.b && rectForKey(s.b);
    [ra, rb].forEach((r) => { if (r) { frame(g, r[0] - 1, r[1] - 1, r[2] + 2, r[3] + 2, col); frame(g, r[0] - 2, r[1] - 2, r[2] + 4, r[3] + 4, col); } });
    if (ra && rb && s.hit) {
      const ax = ra[0] + ra[2] / 2, ay = ra[1] + ra[3] / 2, bx = rb[0] + rb[2] / 2, by = rb[1] + rb[3] / 2;
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let i = 0; i < n; i += 2) rect(g, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, 1, 1, PAL.red);
    }
    if (s.b && Gm.t - s.t > 2.2 && !s.hit) Gm.sel = null;
  }

  const HINTS = {
    0: 'Tap the gold BELL to call the next employee.',
    1: 'Here they come...',
    2: 'Drag (or tap) their papers onto your desk.',
    3: 'Check the papers vs. the HANDBOOK. Open the STAMP tab.',
    3.5: 'Slide the FORM under a stamp, then tap the stamp.',
    4: 'Drag the stamped form back to the employee.',
  };
  function drawHint() {
    let text = HINTS[Gm.tut];
    if (Gm.tut === 3 && Gm.stampOpen) text = HINTS[3.5];
    if (Gm.tut === 5 && Gm.S.day === 1 && Gm.day.cases === 1 && Gm.booth.state !== 'active') text = 'Nice! Tip: the ? button lets you flag mismatches.';
    if (!text) return;
    const w = TW(text) + 10;
    rect(g, 448 - w, 96, w, 14, 'rgba(20,18,24,0.88)'); frame(g, 448 - w, 96, w, 14, '#ffe08a');
    T(g, text, 453 - w, 99, '#ffe08a');
  }
  function drawBanner() {
    const b = Gm.banner;
    if (!b || Gm.t - b.t > b.dur) return;
    const lines = Font.wrap(b.text, 300);
    const h = lines.length * 10 + 8;
    rect(g, 160, 64, 312, h, 'rgba(20,18,24,0.92)'); frame(g, 160, 64, 312, h, b.color);
    lines.forEach((l, i) => TC(g, l, 316, 68 + i * 10, b.color === PAL.inkSoft ? PAL.paper : b.color === PAL.red ? '#ff8a7a' : b.color === PAL.blue ? '#9ab8ff' : '#ffc070'));
  }
  function drawFloats() {
    for (const f of Gm.floats) {
      const k = Gm.t - f.t, y = Math.round(f.y - k * 12), w = TW(f.text);
      rect(g, f.x - 3, y - 3, w + 6, 13, 'rgba(20,18,24,0.9)');
      T(g, f.text, f.x, y, f.color);
    }
  }
  function drawPopup() {
    const p = Gm.popup; if (!p) return;
    g.fillStyle = 'rgba(10,8,14,0.7)'; g.fillRect(0, 0, 480, 360);
    const x = 90, y = 70, w = 300, h = 210;
    G.paper(g, x, y, w, h, '#f1ead6');
    rect(g, x, y, w, 16, p.kind === 'kendra' ? '#c46a95' : PAL.red);
    TC(g, p.title, x + w / 2, y + 4, PAL.white);
    let ty = y + 26;
    if (p.kind === 'kendra') {
      rect(g, x + 12, y + 26, 74, 86, '#9fb4c0'); G.face(g, Faces.kendra(), x + 13, y + 27, 3, Math.floor(Gm.t * 6) % 2 === 0);
      T(g, C.kendra.first + ' ' + C.kendra.last, x + 96, y + 30, PAL.ink);
      T(g, '"Senior" HR Business', x + 96, y + 40, PAL.inkSoft); T(g, 'Partner (self-titled)', x + 96, y + 50, PAL.inkSoft);
      Font.wrap('"' + p.body + '"', w - 24).forEach((l, i) => T(g, l, x + 12, y + 122 + i * 11, PAL.ink));
    } else {
      Font.wrap(p.body, w - 24).forEach((l, i) => T(g, l, x + 12, ty + i * 11, PAL.ink));
      // little alarm graphic
      for (let i = 0; i < 3; i++) { rect(g, x + 130 + i * 16, y + 120, 10, 10, Math.floor(Gm.t * 4 + i) % 2 ? PAL.red : PAL.orange); }
    }
    T(g, `Time lost: ${p.mins} minutes`, x + 12, y + h - 30, PAL.red);
    if (Gm.t - p.t > 0.6) TC(g, 'Tap to get back to work', x + w / 2, y + h - 16, PAL.inkSoft);
  }

  function drawDragged() {
    if (!drag || !drag.moved || !drag.doc) return;
    const d = drag.doc;
    if (overBooth(drag.x, drag.y) || (d.where === 'counter' && drag.from === 'counter' && drag.x < 148)) {
      Docs.drawMini(g, d, drag.x - 11, drag.y - 14);
    } else if (d.where === 'counter') {
      const [w] = Docs.size(Object.assign({}, d, { where: 'desk' }));
      drawDocFull(d, Math.round(drag.x - w / 2), Math.round(drag.y - 10));
    } else drawDocFull(d, Math.round(drag.x - drag.ox), Math.round(drag.y - drag.oy));
  }

  // --- Other scenes ---
  function drawTitle() {
    rect(g, 0, 0, 480, 360, '#1a1620');
    for (let i = 0; i < 40; i++) rect(g, (i * 53) % 480, (i * 37) % 360, 2, 2, '#2a2430');
    // parade of employees
    for (let i = 0; i < 22; i++) {
      const f = Gm.fillers[i % Gm.fillers.length] || Faces.random();
      const x = ((i * 26 + Gm.t * 20) % 560) - 40;
      G.walker(g, f, x, 300, Math.floor(Gm.t * 6 + i), 1);
    }
    rect(g, 0, 316, 480, 2, '#3a3440');
    rect(g, 120, 30, 240, 10, PAL.orange);
    TC(g, C.company.toUpperCase() + ' PRESENTS', 240, 31, PAL.white);
    TC(g, 'PTO,', 240, 56, PAL.paper, 6);
    TC(g, 'PLEASE', 240, 112, PAL.orange, 6);
    TC(g, C.subtitle, 240, 172, PAL.paperShade);
    const hasSave = !!loadSave();
    G.button(g, 170, 196, 140, 24, 'NEW GAME', PAL.paper, PAL.ink);
    if (hasSave) G.button(g, 170, 228, 140, 24, 'CONTINUE', PAL.gold, PAL.ink);
    TC(g, 'Dedicated to everyone in HR. You deserve the PTO.', 240, 268, PAL.inkSoft);
    TC(g, 'Glory to OmniGlob. ' + C.tagline + '.', 240, 330, '#5a5260');
    const V = window.VERSION || { version: 'dev', commit: '' };
    const vs = V.version + (V.commit ? ' - ' + V.commit : '');
    T(g, vs, 476 - TW(vs), 349, '#6a6274');
    // stamp flourish
    Docs.stampArt(g, 'approve', 352, 128, 0.9);
  }
  function titleTap(x, y) {
    if (inR(x, y, [170, 196, 140, 24])) { Sound.SFX.stamp(); newGame(); }
    else if (loadSave() && inR(x, y, [170, 228, 140, 24])) { Sound.SFX.stamp(); continueGame(); }
  }

  function drawDayIntro() {
    rect(g, 0, 0, 480, 360, '#141218');
    TC(g, `DAY ${Gm.S.day}`, 240, 90, PAL.paper, 4);
    TC(g, Dates.long(Gm.S.today) + ', 2026', 240, 136, PAL.gold, 2);
    TC(g, `OmniGlob HQ. People Operations. Day ${Gm.S.day} of ${Gm.run.days}.`, 240, 170, PAL.paperShade);
    const tips = {
      1: ['Read the memo. Check the handbook.', 'Approve what follows the rules. Deny what does not.'],
      2: ['Rules change every day. Read the memo first.', 'The handbook marks new rules in red.'],
      3: ['Stuck? The ? button lets you tap two things to', 'flag a mismatch. Employees will make excuses.'],
    };
    const tip = tips[Gm.S.day] || [Gm.dayTip || '', ''];
    TC(g, tip[0], 240, 200, '#9a90a8'); TC(g, tip[1], 240, 212, '#9a90a8');
    if (Gm.sceneT > 0.5 && Math.floor(Gm.t * 2) % 2 === 0) TC(g, 'TAP TO CLOCK IN', 240, 260, PAL.orange, 2);
  }

  function drawEOD() {
    rect(g, 0, 0, 480, 360, '#141218');
    TC(g, '5:00 PM', 240, 18, PAL.orange, 2);
    TC(g, `END OF DAY ${Gm.S.day} - BONUS LEDGER`, 240, 42, PAL.paper);
    const L = Gm.ledger.lines;
    const show = Math.min(L.length, Math.floor(Gm.sceneT / 0.3));
    G.paper(g, 80, 58, 320, 22 + L.length * 13, '#efe7d2');
    for (let i = 0; i < show; i++) {
      const [name, amt, kind] = L[i];
      const y = 66 + i * 13;
      if (kind === 'total') rect(g, 88, y - 3, 304, 1, PAL.ink);
      T(g, name, 90, y, kind === 'total' ? PAL.ink : PAL.inkSoft);
      const s = kind === 'plus' ? '+' + money(amt) : kind === 'minus' ? (amt === 0 ? money(0) : '-' + money(-amt)) : money(amt);
      T(g, s, 390 - TW(s), y, kind === 'minus' && amt < 0 ? PAL.red : kind === 'plus' ? PAL.green : PAL.ink);
    }
    if (show >= L.length) {
      const y0 = 92 + L.length * 13;
      T(g, `Correct: ${Gm.day.correct}   Citations: ${Gm.day.cites}   Discrepancies found: ${Gm.day.found}`, 80, y0, '#9a90a8');
      Font.wrap('Daily affirmation: ' + Gm.ledger.aff, 320).forEach((l, i) => T(g, l, 80, y0 + 16 + i * 10, PAL.gold));
      if (Gm.ledger.kendra) Font.wrap(Gm.ledger.kendra, 320).forEach((l, i) => T(g, l, 80, y0 + 44 + i * 10, '#e8a0c4'));
      const label = Gm.bonus <= 0 ? 'UH OH...' : Gm.S.day >= Gm.run.days ? 'ANNUAL REVIEW' : 'NEXT DAY';
      if (Gm.sceneT > 1.5) G.button(g, 170, 322, 140, 24, label, Gm.bonus <= 0 ? PAL.red : PAL.gold, Gm.bonus <= 0 ? PAL.white : PAL.ink);
    }
  }

  function drawReview() {
    const r = Gm.review;
    rect(g, 0, 0, 480, 360, '#141218');
    TC(g, 'ANNUAL PERFORMANCE REVIEW', 240, 20, PAL.paper, 2);
    G.paper(g, 60, 50, 360, 254, '#efe7d2');
    T(g, 'Employee: You (People Ops)', 74, 60);
    T(g, `Cases handled: ${Gm.stats.total}   Accuracy: ${Math.round(r.acc * 100)}%`, 74, 72);
    T(g, `Citations: ${Gm.stats.citations}   Discrepancies found: ${Gm.stats.found}`, 74, 84);
    T(g, 'RATING:', 74, 104, PAL.inkSoft);
    if (Gm.sceneT > 1) T(g, r.rating, 124, 104, r.rating.startsWith('EXCEEDS') ? PAL.green : r.rating.startsWith('MEETS') ? PAL.blue : PAL.red);
    if (Gm.sceneT > 1.6) {
      T(g, `Bonus balance: ${money(Gm.bonus)}`, 74, 124);
      r.outcome.forEach((l, i) => T(g, l, 74, 140 + i * 11));
      T(g, 'FINAL PAYOUT:', 74, 184, PAL.inkSoft);
      T(g, r.payout > 0 ? money(r.payout) : 'one slice of pizza', 160, 184, PAL.red);
    }
    if (Gm.sceneT > 2.4) {
      Font.wrap('Also: Kendra Whitlock has been promoted to Director of People Excitement. Starting Monday, she is your manager.', 330).forEach((l, i) => T(g, l, 74, 208 + i * 10, '#a04a7a'));
      Font.wrap('"' + r.quote + '" - Brock', 330).forEach((l, i) => T(g, l, 74, 248 + i * 10, PAL.inkSoft));
      Docs.stampArt(g, r.rating.startsWith('NEEDS') ? 'deny' : 'approve', 340, 270, 0.9);
      G.button(g, 170, 316, 140, 24, 'PLAY AGAIN', PAL.gold);
    }
  }
  function drawPIP() {
    rect(g, 0, 0, 480, 360, '#200f12');
    TC(g, 'PERFORMANCE', 240, 50, PAL.red, 3);
    TC(g, 'IMPROVEMENT PLAN', 240, 80, PAL.red, 3);
    const lines = ['Your bonus has reached $0. Leadership is "concerned."',
      'You have been placed on a 30-day PIP.', 'Your PIP coach is Kendra.', '',
      'She has already scheduled 14 "quick syncs."', 'All of them are at 7:30 AM.', '', 'Glory to OmniGlob.'];
    lines.forEach((l, i) => TC(g, l, 240, 130 + i * 14, PAL.paper));
    if (Gm.sceneT > 2) G.button(g, 170, 316, 140, 24, 'TRY AGAIN', PAL.gold);
  }

  function render() {
    g.clearRect(0, 0, 480, 360);
    switch (Gm.scene) {
      case 'title': drawTitle(); break;
      case 'dayintro': drawDayIntro(); break;
      case 'eod': drawEOD(); break;
      case 'review': drawReview(); break;
      case 'pip': drawPIP(); break;
      case 'work':
        drawOffice(); drawBooth(); drawDesk(); drawInspectOverlay(); drawDragged(); drawHint(); drawBanner(); drawFloats(); drawPopup();
        break;
    }
  }

  // ---------- Boot ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    update(dt); render();
    requestAnimationFrame(loop);
  }
  function fit() {
    const W = window.innerWidth, H = window.innerHeight;
    const s = Math.min(W / 480, H / 360);
    canvas.style.width = Math.floor(480 * s) + 'px';
    canvas.style.height = Math.floor(360 * s) + 'px';
  }
  window.addEventListener('resize', fit);
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  ['touchstart', 'touchend', 'pointerup', 'mousedown', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, () => Sound.init(), { passive: true, capture: true }));
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  officeBg = G.buildOffice(); deskBg = G.buildDesk(); boothBg = G.buildBooth();
  for (let i = 0; i < 16; i++) Gm.fillers.push(Faces.random());
  fit();
  requestAnimationFrame(loop);

  // test hooks
  window.__pto = { newGame, startDay, callNext, handBack, endDay, tapAt, Gm };
})();
