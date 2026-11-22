// =====================================================
//  LAST EMBER — procedural horror audio (WebAudio, no files)
// =====================================================
const SFX = (() => {
  let ctx = null, master, comp, noiseBuf, ambGain, fireGain, windFilter;
  let heartTimer = 0, danger = 0, fireLevel = 0, muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    comp = ctx.createDynamicsCompressor();
    master = ctx.createGain(); master.gain.value = 0.8;
    master.connect(comp); comp.connect(ctx.destination);
    // 2s white noise buffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbient();
  }

  function noiseSrc(loop = false) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop;
    s.loopStart = Math.random(); return s;
  }
  function panner(p) {
    if (ctx.createStereoPanner) { const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p || 0)); return n; }
    return ctx.createGain();
  }

  function startAmbient() {
    ambGain = ctx.createGain(); ambGain.gain.value = 0.0;
    ambGain.connect(master);
    ambGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 4);
    // low drone
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(ambGain);
    [41, 43.7, 82.5, 61.2].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.05 : 0.16;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
      const lg = ctx.createGain(); lg.gain.value = 0.08; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      o.connect(g); g.connect(lp); o.start();
    });
    // wind
    const w = noiseSrc(true); windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass';
    windFilter.frequency.value = 400; windFilter.Q.value = 0.8;
    const wg = ctx.createGain(); wg.gain.value = 0.12;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.07; const wlg = ctx.createGain(); wlg.gain.value = 250;
    wl.connect(wlg); wlg.connect(windFilter.frequency); wl.start();
    w.connect(windFilter); windFilter.connect(wg); wg.connect(ambGain); w.start();
    // fire bed
    const f = noiseSrc(true); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
    fireGain = ctx.createGain(); fireGain.gain.value = 0; f.connect(fl); fl.connect(fireGain); fireGain.connect(master); f.start();
  }

  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }

  // ---------- one-shots ----------
  function crackle() {
    if (!ctx || fireLevel < 0.02) return;
    const t = ctx.currentTime, s = noiseSrc(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 3000;
    env(g, t, 0.002, 0.25 * fireLevel, 0.03 + Math.random() * 0.05);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.15);
  }
  function thump(vol) {
    const t = ctx.currentTime;
    [0, 0.22].forEach((off, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(70, t + off); o.frequency.exponentialRampToValueAtTime(35, t + off + 0.15);
      env(g, t + off, 0.01, vol * (i ? 0.6 : 1), 0.18); o.connect(g); g.connect(master); o.start(t + off); o.stop(t + off + 0.3);
    });
  }
  function scream(vol = 1, pan = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, out = ctx.createGain(), p = panner(pan); out.gain.value = vol * 0.6;
    out.connect(p); p.connect(master);
    const ws = ctx.createWaveShaper(); const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); } ws.curve = curve; ws.connect(out);
    [1, 1.06, 1.49].forEach((m, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(220 * m, t); o.frequency.linearRampToValueAtTime(900 * m, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(140 * m, t + 1.6);
      const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 23 + i * 7; vg.gain.value = 40;
      v.connect(vg); vg.connect(o.frequency); v.start(t); v.stop(t + 1.8);
      env(g, t, 0.05, 0.35, 1.6); o.connect(g); g.connect(ws); o.start(t); o.stop(t + 1.8);
    });
    const n = noiseSrc(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2;
    env(ng, t, 0.02, 0.7, 1.3); n.connect(bp); bp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 1.5);
  }
  function growl(vol = 0.5, pan = 0, pitch = 1) {
    if (!ctx || muted || vol < 0.02) return;
    const t = ctx.currentTime, p = panner(pan), g = ctx.createGain(); g.connect(p); p.connect(master);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime((55 + Math.random() * 20) * pitch, t);
    o.frequency.linearRampToValueAtTime(40 * pitch, t + 1.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const am = ctx.createOscillator(), amg = ctx.createGain(); am.frequency.value = 11; amg.gain.value = 0.5; am.connect(amg); amg.connect(g.gain);
    env(g, t, 0.2, vol * 0.5, 1.1); o.connect(lp); lp.connect(g); o.start(t); o.stop(t + 1.4); am.start(t); am.stop(t + 1.4);
  }
  function sob(vol = 0.4, pan = 0) {
    if (!ctx || muted || vol < 0.02) return;
    const t = ctx.currentTime, p = panner(pan), out = ctx.createGain(); out.gain.value = vol; out.connect(p); p.connect(master);
    for (let k = 0; k < 3; k++) {
      const st = t + k * 0.45 + Math.random() * 0.1, o = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(420 + Math.random() * 60, st); o.frequency.exponentialRampToValueAtTime(260, st + 0.35);
      const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = 7; vg.gain.value = 18; v.connect(vg); vg.connect(o.frequency);
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 4;
      env(g, st, 0.04, 0.22, 0.32); o.connect(bp); bp.connect(g); g.connect(out); o.start(st); o.stop(st + 0.45); v.start(st); v.stop(st + 0.45);
      const n = noiseSrc(), nb = ctx.createBiquadFilter(), ng = ctx.createGain(); nb.type = 'bandpass'; nb.frequency.value = 2500; nb.Q.value = 3;
      env(ng, st, 0.02, 0.15, 0.25); n.connect(nb); nb.connect(ng); ng.connect(out); n.start(st); n.stop(st + 0.35);
    }
  }
  function footstep(vol = 0.3, pan = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, s = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(pan);
    lp.type = 'lowpass'; lp.frequency.value = 500 + Math.random() * 300;
    env(g, t, 0.005, vol, 0.09); s.connect(lp); lp.connect(g); g.connect(p); p.connect(master); s.start(t); s.stop(t + 0.15);
  }
  function falseFootsteps() {
    const pan = Math.random() < 0.5 ? -0.8 : 0.8; let n = 0;
    const iv = setInterval(() => { footstep(0.35 + n * 0.03, pan); if (++n > 7) clearInterval(iv); }, 380);
  }
  function whisper(pan = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, p = panner(pan), out = ctx.createGain(); out.gain.value = 0.9; out.connect(p); p.connect(master);
    for (let k = 0; k < 7; k++) {
      const st = t + k * 0.28 + Math.random() * 0.1, s = noiseSrc(), g = ctx.createGain();
      [700 + Math.random() * 500, 1800 + Math.random() * 800, 3000].forEach(f => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 9; s.connect(bp); bp.connect(g);
      });
      env(g, st, 0.06, 0.5, 0.2); g.connect(out); s.start(st); s.stop(st + 0.4);
    }
  }
  function sting() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [110, 116.5, 155.6, 233].forEach(f => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 2);
      env(g, t, 0.01, 0.12, 2.2); o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 2.4);
    });
  }
  function pickup() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [523, 784].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f;
      env(g, t + i * 0.07, 0.01, 0.12, 0.25); o.connect(g); g.connect(master); o.start(t + i * 0.07); o.stop(t + 0.5); });
  }
  function whoosh() {
    if (!ctx || muted) return;
    const t = ctx.currentTime, s = noiseSrc(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 0.5);
    env(g, t, 0.05, 0.4, 0.6); s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.8);
  }
  function warn() {
    if (!ctx || muted) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 98;
    env(g, t, 0.05, 0.25, 0.7); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.9);
  }
  function staticBurst(dur = 1.2) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, s = noiseSrc(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2500; g.gain.setValueAtTime(0.12, t); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  function death() {
    if (!ctx || muted) return;
    scream(1, 0); const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(20, t + 2);
    env(g, t, 0.01, 0.3, 2); o.connect(g); g.connect(master); o.start(t); o.stop(t + 2.2);
  }

  // called every frame
  function update(dt) {
    if (!ctx) return;
    fireGain.gain.setTargetAtTime(muted ? 0 : fireLevel * 0.09, ctx.currentTime, 0.2);
    if (Math.random() < fireLevel * dt * 9) crackle();
    if (danger > 0.05 && !muted) {
      heartTimer -= dt;
      if (heartTimer <= 0) { thump(0.25 + danger * 0.55); heartTimer = 60 / (62 + danger * 90); }
    }
  }

  return {
    init, update, scream, growl, sob, footstep, falseFootsteps, whisper, sting, pickup, whoosh, warn, staticBurst, death,
    setDanger(v) { danger = v; }, setFire(v) { fireLevel = v; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; return muted; },
    get ready() { return !!ctx; }
  };
})();
