// Palette, primitives, portraits, walkers and static scenery.
(function () {
  const PAL = {
    void: '#141218', dark: '#1f1c24', ink: '#2a2430', inkSoft: '#5a5260',
    paper: '#e9e1cb', paperShade: '#cdc2a6', paperLine: '#b8ad92', white: '#f4efe2',
    wood: '#5b3f2b', woodDark: '#45301f', woodLight: '#6f4d35', woodEdge: '#30210f',
    wall: '#8b8c78', wallDark: '#727361', base: '#4d4a40',
    carpet: '#3d4851', carpetDot: '#36404a', cube: '#7c8189', cubeDark: '#5e636b', cubeTop: '#a1a5ab',
    orange: '#e07a2e', orangeDark: '#a8531a', gold: '#d9b23c', silver: '#a7adb5',
    green: '#3f8a3a', red: '#b8322c', purple: '#6a3fa0', blue: '#2f4fa8', pink: '#e8b4b4',
    light: '#d8e3c4', glass: '#8fa3a8', glassDark: '#6c8287',
  };
  const SKIN = ['#f2d3b3', '#e6b98f', '#c98e62', '#a26a43', '#7a4b2c', '#5a3520'];
  const HAIR = ['#1d1a18', '#4a2f1d', '#7a4a24', '#d1ac52', '#a33b1e', '#8c8c8c', '#e3dccb'];
  const SHIRT = ['#3b5b8a', '#8a3b3b', '#3b7a5b', '#6a6a6a', '#cfc8b6', '#2c2c3a', '#c46a95'];
  const TIES = ['#a83232', '#2f4fa8', '#d9b23c', '#3f8a3a'];
  const INK = { blue: '#2f4fa8', black: '#1b1820', green: '#2f7a34', red: '#b8322c' };

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  const rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const frame = (g, x, y, w, h, c) => { rect(g, x, y, w, 1, c); rect(g, x, y + h - 1, w, 1, c); rect(g, x, y, 1, h, c); rect(g, x + w - 1, y, 1, h, c); };
  function paper(g, x, y, w, h, fill = PAL.paper, edge = PAL.paperShade) {
    rect(g, x + 2, y + 2, w, h, 'rgba(0,0,0,0.35)');
    rect(g, x, y, w, h, fill);
    frame(g, x, y, w, h, edge);
  }
  function button(g, x, y, w, h, label, fill = PAL.paper, fg = PAL.ink, scale = 1) {
    rect(g, x, y + 2, w, h, 'rgba(0,0,0,0.4)');
    rect(g, x, y, w, h, fill);
    frame(g, x, y, w, h, shade(fill, 0.6));
    const tw = Font.width(label, scale);
    Font.text(g, label, x + Math.round((w - tw) / 2), y + Math.round((h - 7 * scale) / 2), fg, scale);
  }

  // 24x28 portrait grid, drawn at pixel size s
  function face(g, f, x0, y0, s = 1, talk = false, blink = false) {
    const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x0 + x * s, y0 + y * s, w * s, h * s); };
    const sk = SKIN[f.skin], skd = shade(sk, 0.82), hc = HAIR[f.hairC], hcd = shade(hc, 0.75);
    const shirt = SHIRT[f.shirt], dark = '#1b1820';
    // hair behind the head (long styles)
    if (f.hair === 3) { P(5, 6, 2, 17, hc); P(17, 6, 2, 17, hc); }
    if (f.hair === 9) { P(18, 5, 2, 9, hc); P(19, 13, 1, 3, hc); }
    // shirt & shoulders
    P(2, 22, 20, 6, shirt); P(1, 24, 1, 4, shirt); P(22, 24, 1, 4, shirt);
    P(2, 22, 20, 1, shade(shirt, 1.15));
    if (f.nephew) { P(7, 19, 3, 4, shade(shirt, 1.25)); P(14, 19, 3, 4, shade(shirt, 1.25)); }
    P(9, 21, 6, 2, PAL.white);
    if (f.tie) { P(11, 22, 2, 1, TIES[f.shirt % 4]); P(11, 23, 2, 5, TIES[f.shirt % 4]); }
    else P(11, 22, 2, 1, skd);
    // lanyard
    if (!f.tie && !f.nephew) { P(8, 22, 1, 4, PAL.orange); P(15, 22, 1, 4, PAL.orange); P(9, 26, 6, 2, PAL.orange); }
    // neck & head
    P(10, 18, 4, 4, skd);
    P(7, 5, 10, 14, sk); P(6, 7, 1, 9, sk); P(17, 7, 1, 9, sk); P(8, 19, 8, 1, sk);
    P(5, 10, 1, 3, sk); P(18, 10, 1, 3, sk);
    if (f.ear) { P(5, 13, 1, 1, PAL.gold); }
    // eyes
    if (blink) { P(8, 12, 2, 1, dark); P(14, 12, 2, 1, dark); }
    else { P(8, 11, 2, 2, dark); P(14, 11, 2, 2, dark); if (s >= 2) { P(8, 11, 1, 1, '#ffffff'); P(14, 11, 1, 1, '#ffffff'); } }
    // brows
    const bc = f.hair === 0 ? hcd : hc;
    if (f.brows === 0) { P(8, 9, 2, 1, bc); P(14, 9, 2, 1, bc); }
    else if (f.brows === 1) { P(8, 8, 2, 1, bc); P(14, 8, 2, 1, bc); }
    else { P(8, 8, 1, 1, bc); P(9, 9, 1, 1, bc); P(15, 8, 1, 1, bc); P(14, 9, 1, 1, bc); }
    // nose
    P(11, 13, 2, 2, skd);
    // beard
    if (f.beard === 1) { P(7, 15, 10, 4, hc); P(8, 19, 8, 1, hc); P(6, 13, 1, 3, hc); P(17, 13, 1, 3, hc); }
    if (f.beard === 2) P(9, 15, 6, 1, hc);
    // mouth
    const mc = '#7a3b34';
    if (talk) { P(10, 16, 4, 2, '#4a1f1c'); }
    else if (f.mouth === 0) P(10, 16, 4, 1, mc);
    else if (f.mouth === 1) { P(9, 15, 1, 1, mc); P(10, 16, 4, 1, mc); P(14, 15, 1, 1, mc); }
    else { P(10, 16, 3, 1, mc); P(13, 15, 1, 1, mc); }
    // glasses
    if (f.glasses === 1) {
      const gc = f.kendra ? '#d0408a' : '#6a5246';
      if (f.kendra) { P(6, 9, 1, 1, gc); P(17, 9, 1, 1, gc); }
      P(7, 10, 4, 1, gc); P(7, 13, 4, 1, gc); P(7, 10, 1, 4, gc); P(10, 10, 1, 4, gc);
      P(13, 10, 4, 1, gc); P(13, 13, 4, 1, gc); P(13, 10, 1, 4, gc); P(16, 10, 1, 4, gc);
      P(11, 11, 2, 1, gc);
    } else if (f.glasses === 2) {
      P(7, 10, 4, 3, '#151318'); P(13, 10, 4, 3, '#151318'); P(11, 11, 2, 1, '#151318');
      P(8, 10, 1, 1, '#6a7a8a'); P(14, 10, 1, 1, '#6a7a8a');
    }
    // hair
    switch (f.hair) {
      case 0: P(10, 6, 2, 1, shade(sk, 1.12)); P(6, 9, 1, 3, hc); P(17, 9, 1, 3, hc); break;
      case 1: P(7, 4, 10, 3, hc); P(6, 6, 1, 3, hc); P(17, 6, 1, 3, hc); break;
      case 2: P(6, 3, 12, 4, hc); P(6, 7, 2, 4, hc); P(17, 7, 1, 3, hc); P(12, 3, 1, 2, hcd); break;
      case 3: P(6, 3, 12, 4, hc); P(7, 7, 3, 1, hc); break;
      case 4: P(6, 3, 12, 5, hc); P(5, 6, 2, 11, hc); P(17, 6, 2, 11, hc); P(7, 7, 10, 1, hc); P(8, 3, 6, 1, shade(hc, 1.2)); break;
      case 5: P(10, 0, 4, 3, hc); P(7, 3, 10, 3, hc); P(6, 5, 1, 4, hc); P(17, 5, 1, 4, hc); break;
      case 6: P(4, 1, 16, 7, hc); P(3, 3, 1, 6, hc); P(20, 3, 1, 6, hc); P(4, 8, 3, 4, hc); P(17, 8, 3, 4, hc); break;
      case 7: {
        P(7, 4, 10, 3, hc); P(6, 6, 1, 3, hc); P(17, 6, 1, 3, hc);
        const tip = f.nephew ? '#f2e6a0' : shade(hc, 1.3);
        [[7, 2], [9, 1], [11, 2], [13, 1], [15, 2]].forEach(([x, y]) => { P(x, y, 1, 4 - y, hc); P(x, y, 1, 1, tip); });
        break;
      }
      case 8: P(7, 4, 10, 3, hc); P(8, 2, 6, 2, hc); P(13, 1, 3, 2, hc); P(6, 6, 1, 3, hc); P(17, 6, 1, 3, hc); break;
      case 9: P(6, 3, 12, 4, hc); P(6, 7, 1, 4, hc); break;
    }
  }

  // tiny side-view person, 7x16
  function walker(g, f, x, y, step = 0, dir = 1) {
    const P = (px, py, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x) + (dir > 0 ? px : 7 - px - w), Math.round(y) + py, w, h); };
    const sk = SKIN[f.skin], hc = HAIR[f.hairC], sh = SHIRT[f.shirt];
    P(1, 2, 5, 4, sk);
    if (f.hair !== 0) P(1, 1, 5, 2, hc);
    if (f.hair === 6) P(0, 0, 7, 3, hc);
    if (f.hair === 3 || f.hair === 4) P(1, 2, 1, 4, hc);
    if (f.hair === 7) { P(1, 0, 1, 1, hc); P(3, 0, 1, 1, hc); P(5, 0, 1, 1, hc); }
    if (f.glasses) P(4, 3, 2, 1, '#151318');
    P(5, 4, 1, 1, '#1b1820');
    P(0, 6, 7, 6, sh); P(3, 6, 1, 6, f.tie ? TIES[f.shirt % 4] : sh);
    P(dir > 0 ? 6 : 0, 9, 1, 2, sk);
    const pants = '#2b2a33';
    if (step % 2 === 0) { P(1, 12, 2, 4, pants); P(4, 12, 2, 4, pants); }
    else { P(0, 12, 2, 3, pants); P(5, 12, 2, 3, pants); P(2, 12, 3, 1, pants); P(0, 15, 2, 1, '#111'); P(5, 15, 2, 1, '#111'); }
  }

  function buildOffice() {
    const c = document.createElement('canvas'); c.width = 480; c.height = 112;
    const g = c.getContext('2d');
    rect(g, 0, 0, 480, 60, PAL.wall);
    for (let x = 0; x < 480; x += 32) rect(g, x, 0, 1, 60, PAL.wallDark);
    rect(g, 0, 0, 480, 4, '#5b5c4e');
    for (let x = 30; x < 480; x += 110) { rect(g, x, 4, 60, 3, PAL.light); rect(g, x, 7, 60, 1, '#9aa48c'); }
    // sign
    rect(g, 150, 12, 132, 30, PAL.dark); frame(g, 150, 12, 132, 30, PAL.orangeDark);
    Font.text(g, 'OMNIGLOB', 160, 15, PAL.orange, 2);
    Font.text(g, 'PEOPLE OPERATIONS', 166, 33, PAL.paper);
    // poster: SYNERGY
    rect(g, 94, 14, 44, 32, PAL.dark); rect(g, 96, 16, 40, 20, '#4f6d8a');
    for (let i = 0; i < 10; i++) rect(g, 106 + i, 34 - i, 20 - 2 * i, 1, '#6b7f6a');
    rect(g, 114, 25, 4, 2, '#fff');
    Font.text(g, 'SYNERGY', 96, 37, PAL.gold);
    // sad plastic plant
    rect(g, 288, 48, 8, 12, '#8a5a3a'); rect(g, 286, 46, 12, 3, '#6a4228');
    [[289, 38], [292, 34], [286, 41], [295, 40], [291, 42]].forEach(([x, y]) => rect(g, x, y, 3, 6, '#4f8a4a'));
    // cubicles
    for (let x = 300; x < 420; x += 40) {
      rect(g, x, 36, 36, 24, PAL.cube); rect(g, x, 36, 36, 2, PAL.cubeTop); rect(g, x + 35, 36, 1, 24, PAL.cubeDark);
    }
    // door to your office
    rect(g, 432, 16, 34, 44, PAL.woodDark); rect(g, 434, 18, 30, 42, PAL.wood);
    rect(g, 438, 22, 22, 10, PAL.paper); Font.text(g, 'HR', 443, 23, PAL.ink);
    rect(g, 459, 40, 2, 2, PAL.gold);
    // floor
    rect(g, 0, 60, 480, 52, PAL.carpet);
    rect(g, 0, 60, 480, 2, PAL.base);
    for (let y = 64; y < 112; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < 480; x += 6) rect(g, x, y, 1, 1, PAL.carpetDot);
    // velvet rope stanchions
    for (let x = 60; x <= 420; x += 40) { rect(g, x, 82, 2, 14, PAL.gold); rect(g, x - 1, 95, 4, 2, '#8a7020'); }
    for (let x = 62; x < 420; x += 40) for (let i = 0; i < 38; i++) rect(g, x + i, 84 + Math.round(Math.sin((i / 38) * Math.PI) * 4), 1, 1, '#8a2a2a');
    return c;
  }

  function buildDesk() {
    const c = document.createElement('canvas'); c.width = 332; c.height = 248;
    const g = c.getContext('2d');
    rect(g, 0, 0, 332, 248, PAL.wood);
    for (let y = 0; y < 248; y += 20) { rect(g, 0, y, 332, 1, PAL.woodDark); }
    for (let i = 0; i < 90; i++) { const x = (i * 97) % 330, y = (i * 53) % 246; rect(g, x, y, 6 + (i % 5) * 3, 1, PAL.woodLight); }
    rect(g, 0, 0, 2, 248, PAL.woodEdge);
    // coffee ring
    for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; rect(g, 300 + Math.round(Math.cos(t) * 9), 222 + Math.round(Math.sin(t) * 9), 1, 1, PAL.woodDark); }
    return c;
  }

  function buildBooth() {
    const c = document.createElement('canvas'); c.width = 148; c.height = 248;
    const g = c.getContext('2d');
    rect(g, 0, 0, 148, 248, '#4a4a42');
    // window
    rect(g, 6, 6, 136, 100, PAL.glassDark); rect(g, 8, 8, 132, 96, '#5f7378');
    rect(g, 8, 70, 132, 34, '#536569');
    for (let i = 0; i < 6; i++) rect(g, 20 + i * 3, 12 + i * 3, 30, 1, 'rgba(255,255,255,0.08)');
    frame(g, 6, 6, 136, 100, '#2e2e28');
    // counter
    rect(g, 0, 106, 148, 40, '#77736a'); rect(g, 0, 106, 148, 3, '#9a958a'); rect(g, 0, 145, 148, 1, '#3a3832');
    // transcript paper roll
    rect(g, 0, 146, 148, 102, '#3a3832');
    return c;
  }

  window.G = { PAL, SKIN, HAIR, SHIRT, INK, shade, rect, frame, paper, button, face, walker, buildOffice, buildDesk, buildBooth };
})();
