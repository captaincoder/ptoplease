// Synthesized sound effects + a gloomy-but-chipper office march.
// iPad notes: audio must be unlocked inside a real tap, and Web Audio is silenced by the
// mute switch / silent mode unless the audio session is set to "playback".
(function () {
  let ac = null, master = null, musicGain = null, sfxGain = null;
  let musicOn = true, timer = null, step = 0, nextT = 0, unlocked = false, silentEl = null;
  try { musicOn = localStorage.getItem('ptoplease_music') !== '0'; } catch (e) {}

  function silentWavUrl() {
    // 0.5s of silence, 8kHz mono 8-bit
    const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  // Called from every tap. Cheap after the first successful unlock.
  function init() {
    try {
      if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
    } catch (e) {}
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      musicGain = ac.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
      sfxGain = ac.createGain(); sfxGain.gain.value = 1; sfxGain.connect(master);
    }
    if (ac.state !== 'running') { try { ac.resume(); } catch (e) {} }
    if (!unlocked) {
      // A silent buffer played inside the gesture finishes the Web Audio unlock on iOS.
      try { const b = ac.createBuffer(1, 1, 22050); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
      // A looping silent <audio> element moves iOS into the playback session so the
      // mute switch doesn't silence the game.
      try {
        if (!silentEl) { silentEl = new Audio(silentWavUrl()); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); silentEl.volume = 0.01; }
        const p = silentEl.play(); if (p && p.catch) p.catch(() => {});
      } catch (e) {}
      if (ac.state === 'running') unlocked = true;
    }
    if (musicOn && !timer) startMusic();
  }
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) { try { ac.suspend(); } catch (e) {} }
    else if (ac.state !== 'running') { try { ac.resume(); } catch (e) {} }
  });

  function tone(freq, dur, type = 'square', vol = 0.3, when = 0, dest = sfxGain, slide = 0) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + Math.max(0, when);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol = 0.3, when = 0, hp = 800, dest = sfxGain) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + Math.max(0, when);
    const b = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t);
  }
  const SFX = {
    stamp() { noise(0.08, 0.6, 0, 200); tone(140, 0.12, 'triangle', 0.7, 0, sfxGain, -60); },
    bell() { tone(1320, 0.6, 'sine', 0.3); tone(1980, 0.4, 'sine', 0.12); },
    paper() { noise(0.06, 0.18, 0, 2500); },
    print() { for (let i = 0; i < 6; i++) tone(220 + (i % 2) * 60, 0.05, 'square', 0.12, i * 0.07); },
    good() { tone(660, 0.08, 'square', 0.15); tone(880, 0.12, 'square', 0.15, 0.08); },
    bad() { tone(260, 0.25, 'square', 0.18, 0, sfxGain, -100); },
    click() { tone(900, 0.03, 'square', 0.1); },
    find() { tone(523, 0.08, 'square', 0.15); tone(784, 0.08, 'square', 0.15, 0.09); tone(1046, 0.14, 'square', 0.15, 0.18); },
    blip() { tone(300 + Math.random() * 200, 0.025, 'square', 0.06); },
    alarm() { for (let i = 0; i < 4; i++) { tone(880, 0.12, 'square', 0.15, i * 0.25); tone(660, 0.12, 'square', 0.15, i * 0.25 + 0.12); } },
    clockout() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.15, i * 0.12)); },
  };

  // A minor-key office march. 16th-note grid. Bass sits an octave higher than "real" bass
  // so tablet speakers can actually reproduce it.
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const MEL = [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 69, 0, 0, 0, 67, 0, 69, 0, 71, 0, 72, 74, 76, 0, 74, 0, 72, 0, 0, 0,
    69, 0, 72, 0, 76, 0, 77, 76, 74, 0, 72, 0, 71, 0, 72, 74, 76, 0, 74, 72, 71, 0, 67, 0, 69, 0, 0, 0, 0, 0, 0, 0];
  const BASS = [57, 64, 57, 64, 53, 60, 53, 60, 55, 62, 55, 62, 52, 59, 52, 59];
  function startMusic() {
    if (!ac || timer) return;
    nextT = ac.currentTime + 0.1; step = 0;
    timer = setInterval(() => {
      if (!ac || ac.state !== 'running') return;
      if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05; // recover after a pause
      const spb = 60 / 104 / 4;
      while (nextT < ac.currentTime + 0.3) {
        const when = nextT - ac.currentTime;
        const m = MEL[step % MEL.length];
        if (m) tone(N(m), spb * 1.8, 'square', 0.12, when, musicGain);
        if (step % 4 === 0) tone(N(BASS[(step / 4) % BASS.length]), spb * 3.2, 'triangle', 0.35, when, musicGain);
        if (step % 4 === 2) noise(0.03, 0.05, when, 6000, musicGain);
        nextT += spb; step++;
      }
    }, 50);
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }
  function toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('ptoplease_music', musicOn ? '1' : '0'); } catch (e) {}
    if (musicOn) { init(); startMusic(); } else stopMusic();
    return musicOn;
  }
  window.Sound = { init, SFX, toggleMusic, get musicOn() { return musicOn; }, get state() { return ac ? ac.state : 'none'; }, get playing() { return !!timer; } };
})();
