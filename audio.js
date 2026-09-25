/* C-Note — tiny Web Audio synth engine (no samples, everything is synthesized) */
(() => {
  'use strict';
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const noteFreq = (n) => {
    const m = /^([A-G]#?)(-?\d)$/.exec(n);
    return 440 * Math.pow(2, ((+m[2] + 1) * 12 + NOTES.indexOf(m[1]) - 69) / 12);
  };
  const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx = null, master = null, analyser = null, noiseBuf = null;
  const ksCache = new Map();

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function wake() {
    const c = init();
    if (c && c.state === 'suspended') c.resume();
    return c;
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }

  // helpers
  const env = (p, t, peak, a, d) => {
    peak = Math.max(peak, 0.0002);
    p.setValueAtTime(0.0001, t);
    p.exponentialRampToValueAtTime(peak, t + a);
    p.exponentialRampToValueAtTime(0.0001, t + a + d);
  };
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const noise = (t, dur) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.start(t, Math.random() * 0.3); s.stop(t + dur);
    return s;
  };

  // ---------- drums ----------
  const drums = {
    kick(t, v = 1) {
      const o = osc('sine', 150), g = gain(0);
      o.frequency.setValueAtTime(155, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
      env(g.gain, t, v, 0.004, 0.46);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.55);
      const n = noise(t, 0.03), ng = gain(0);
      env(ng.gain, t, 0.22 * v, 0.001, 0.018);
      n.connect(filt('highpass', 2600)).connect(ng).connect(master);
    },
    snare(t, v = 1) {
      const n = noise(t, 0.3), g = gain(0);
      env(g.gain, t, 0.7 * v, 0.002, 0.19);
      n.connect(filt('highpass', 1400)).connect(g).connect(master);
      const o = osc('triangle', 220), og = gain(0);
      o.frequency.setValueAtTime(230, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.1);
      env(og.gain, t, 0.5 * v, 0.002, 0.11);
      o.connect(og).connect(master); o.start(t); o.stop(t + 0.2);
    },
    hat(t, v = 1, open = false) {
      const dur = open ? 0.36 : 0.055;
      const n = noise(t, dur + 0.05), g = gain(0);
      env(g.gain, t, (open ? 0.34 : 0.3) * v, 0.001, dur);
      n.connect(filt('bandpass', 10000, 0.8)).connect(filt('highpass', 7000)).connect(g).connect(master);
    },
    tom(t, v = 1, f0 = 200) {
      const o = osc('sine', f0), g = gain(0);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.35);
      env(g.gain, t, 0.9 * v, 0.003, 0.45);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.5);
      const n = noise(t, 0.04), ng = gain(0);
      env(ng.gain, t, 0.12 * v, 0.001, 0.03);
      n.connect(filt('lowpass', 3000)).connect(ng).connect(master);
    },
    clap(t, v = 1) {
      const n = noise(t, 0.35), g = gain(0);
      g.gain.setValueAtTime(0.0001, t);
      [0, 0.011, 0.022].forEach((d) => {
        g.gain.setValueAtTime(0.7 * v, t + d);
        g.gain.exponentialRampToValueAtTime(0.06 * v, t + d + 0.009);
      });
      g.gain.setValueAtTime(0.6 * v, t + 0.033);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      n.connect(filt('bandpass', 1500, 0.9)).connect(g).connect(master);
    },
    crash(t, v = 1) {
      const n = noise(t, 1.6), g = gain(0);
      env(g.gain, t, 0.38 * v, 0.002, 1.4);
      n.connect(filt('highpass', 4500)).connect(g).connect(master);
    },
  };

  // ---------- Karplus–Strong plucked string ----------
  function ksBuffer(freq) {
    const key = Math.round(freq * 100);
    if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / freq));
    const len = Math.floor(sr * 2.4);
    const line = new Float32Array(N), out = new Float32Array(len);
    let prev = 0, mean = 0;
    for (let i = 0; i < N; i++) { prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55; line[i] = prev; mean += prev; }
    mean /= N;
    for (let i = 0; i < N; i++) line[i] -= mean;
    const rho = Math.pow(0.001, 1 / (3 * freq)); // ~3s decay for the fundamental
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const nxt = idx + 1 === N ? 0 : idx + 1;
      const v = line[idx];
      out[i] = v;
      line[idx] = rho * 0.5 * (v + line[nxt]);
      idx = nxt;
    }
    const fade = Math.floor(sr * 0.4);
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
    const buf = ctx.createBuffer(1, len, sr);
    buf.getChannelData(0).set(out);
    const entry = { buf, rate: freq / (sr / N) };
    ksCache.set(key, entry);
    return entry;
  }
  function pluck(freq, t, v = 0.6) {
    const e = ksBuffer(freq);
    const s = ctx.createBufferSource();
    s.buffer = e.buf; s.playbackRate.value = e.rate;
    s.connect(filt('lowpass', 4200)).connect(gain(v * 1.4)).connect(master);
    s.start(t);
  }

  // ---------- electric-piano-ish keys ----------
  function keyOn(freq, t, v = 0.45) {
    const o1 = osc('triangle', freq), o2 = osc('sine', freq * 2), o3 = osc('sine', freq * 3.01);
    const g2 = gain(0.28), g3 = gain(0.07);
    const lp = filt('lowpass', freq * 8);
    lp.frequency.setValueAtTime(Math.min(freq * 9, 12000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 500), t + 1.3);
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o1.connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(lp);
    lp.connect(g).connect(master);
    const oscs = [o1, o2, o3];
    oscs.forEach((o) => { o.start(t); o.stop(t + 3.05); });
    return {
      off() {
        const n = ctx.currentTime;
        if (g.gain.cancelAndHoldAtTime) g.gain.cancelAndHoldAtTime(n);
        else { g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), n); }
        g.gain.exponentialRampToValueAtTime(0.0001, n + 0.3);
        oscs.forEach((o) => { try { o.stop(n + 0.32); } catch (e) { /* already stopped */ } });
      },
    };
  }

  // ---------- mallet / bell (footer letters) ----------
  function bell(freq, t, v = 0.3) {
    const o1 = osc('sine', freq), o2 = osc('sine', freq * 2.76), g = gain(0), g2 = gain(0.25);
    env(g.gain, t, v, 0.003, 1.3);
    o1.connect(g); o2.connect(g2).connect(g); g.connect(master);
    [o1, o2].forEach((o) => { o.start(t); o.stop(t + 1.4); });
  }

  // ---------- synth bass ----------
  function bass(freq, t, dur = 0.25, v = 0.55) {
    const o = osc('sawtooth', freq), sub = osc('sine', freq), sg = gain(0.7);
    const lp = filt('lowpass', freq * 10, 7);
    lp.frequency.setValueAtTime(Math.min(freq * 16, 4000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 120), t + 0.2);
    const g = gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(v * 0.5, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    o.connect(lp); sub.connect(sg).connect(lp); lp.connect(g).connect(master);
    [o, sub].forEach((x) => { x.start(t); x.stop(t + dur + 0.12); });
  }

  // ---------- global sound state ----------
  const listeners = new Set();
  const Sound = {
    on: false,
    set(v) {
      this.on = !!v;
      if (this.on) wake(); else suspend();
      listeners.forEach((fn) => fn(this.on));
    },
    onChange(fn) { listeners.add(fn); },
    ensure() { if (!this.on) this.set(true); return wake(); },
  };

  window.CNote = window.CNote || {};
  Object.assign(window.CNote, {
    NOTES, noteFreq, midiFreq, Sound,
    Audio: {
      wake, suspend, drums, pluck, keyOn, bell, bass,
      get ctx() { return ctx; },
      get analyser() { return analyser; },
    },
  });
})();
