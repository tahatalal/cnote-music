/* C-Note — hero fretboard: six elastic guitar strings you can pluck with the cursor */
(() => {
  'use strict';
  const { Sound, Audio, clamp, reduce, onVisible } = window.CNote;
  const wrap = document.getElementById('strings');
  const cv = document.getElementById('stringsCanvas');
  if (!wrap || !cv) return;
  const g = cv.getContext('2d');

  const OPEN = [329.63, 246.94, 196.0, 146.83, 110.0, 82.41]; // top → bottom: e B G D A E
  const NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
  const FRETS = 15, INLAYS = [3, 5, 7, 9, 15];
  const S = OPEN.map((f, i) => ({ f, i, y: 0, amp: 0, phase: 0, px: 0, grab: false, pull: 0, pullX: 0, glow: 0, spark: 0, sx: 0, fret: 0 }));
  let W = 0, H = 0, dpr = 1, nutX = 0, frets = [], gap = 20, GRAB = 12;
  let visible = true, prev = null, introStart = 0, introDone = reduce, dirty = true;

  const fx = (n) => (n <= 0 ? nutX : frets[n - 1]);
  function resize() {
    const r = wrap.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const top = H * 0.25, bot = H * 0.84;
    S.forEach((s, i) => { s.y = top + ((bot - top) * i) / 5; });
    gap = (bot - top) / 5;
    GRAB = Math.min(14, gap * 0.42);
    nutX = W < 600 ? 34 : 58;
    const L = W - nutX, k = 1 - Math.pow(2, -FRETS / 12);
    frets = [];
    for (let n = 1; n <= FRETS; n++) frets.push(nutX + (L * (1 - Math.pow(2, -n / 12))) / k);
    dirty = true;
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  function fretAt(x) {
    if (x < nutX) return 0;
    for (let n = 1; n <= FRETS; n++) if (x < fx(n)) return n;
    return FRETS;
  }

  function release(s, amp, silent) {
    s.grab = false; s.amp = amp; s.phase = 0; s.px = s.pullX; s.pull = 0;
    s.glow = 1; s.spark = 1; s.sx = s.pullX;
    s.fret = fretAt(s.pullX);
    dirty = true;
    if (!silent && Sound.on) {
      const c = Audio.wake();
      if (c) Audio.pluck(s.f * Math.pow(2, s.fret / 12), c.currentTime, 0.3 + 0.35 * Math.min(1, Math.abs(amp) / 14));
    }
  }

  function local(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function move(p) {
    if (prev && p.x >= 0 && p.x <= W) {
      for (const s of S) {
        if (s.grab) {
          s.pull = p.y - s.y;
          s.pullX = clamp(p.x, nutX + 4, W - 4);
          if (Math.abs(s.pull) > GRAB) release(s, Math.sign(s.pull) * GRAB);
          dirty = true;
          continue;
        }
        const a = prev.y - s.y, b = p.y - s.y;
        if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
          const t = a / (a - b);
          const x = prev.x + (p.x - prev.x) * t;
          if (x < nutX - 8 || x > W) continue;
          s.pullX = clamp(x, nutX + 4, W - 4);
          if (Math.abs(b) > GRAB * 0.7) release(s, Math.sign(b) * GRAB * clamp(Math.abs(b) / GRAB, 0.7, 1));
          else { s.grab = true; s.pull = b; dirty = true; }
        }
      }
    }
    prev = p;
  }
  function letGo() {
    S.forEach((s) => { if (s.grab) release(s, s.pull || GRAB * 0.5); });
    prev = null;
  }
  wrap.addEventListener('pointermove', (e) => move(local(e)));
  wrap.addEventListener('pointerenter', (e) => { prev = local(e); });
  wrap.addEventListener('pointerleave', letGo);
  wrap.addEventListener('pointerdown', (e) => {
    // tap on touch screens: pluck the nearest string
    const p = local(e);
    let best = null, bd = Infinity;
    S.forEach((s) => { const d = Math.abs(s.y - p.y); if (d < bd) { bd = d; best = s; } });
    if (best && bd < gap * 0.6 && e.pointerType !== 'mouse') {
      best.pullX = clamp(p.x, nutX + 4, W - 4);
      release(best, GRAB * 0.8);
    }
  });
  // swipes while scrolling on touch devices
  wrap.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) move(local(t)); }, { passive: true });
  wrap.addEventListener('touchend', () => { prev = null; }, { passive: true });

  /* ---------- drawing ---------- */
  function shape(s, x, pure) {
    const L = W - nutX, u = (x - nutX) / L;
    const p = clamp((s.px - nutX) / L, 0.03, 0.97);
    const tri = u < p ? u / p : (1 - u) / (1 - p);
    return pure ? tri : 0.55 * tri + 0.45 * Math.sin(Math.PI * u);
  }
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function draw(now) {
    g.clearRect(0, 0, W, H);
    const top = S[0].y - gap * 0.55, bot = S[5].y + gap * 0.55;
    const ip = introDone ? 1 : clamp((now - introStart) / 1500, 0, 1);

    // frets
    g.globalAlpha = ip;
    for (let n = 1; n <= FRETS; n++) {
      const x = fx(n);
      const grad = g.createLinearGradient(x - 1.5, 0, x + 1.5, 0);
      grad.addColorStop(0, 'rgba(243,234,216,.05)');
      grad.addColorStop(0.5, 'rgba(243,234,216,.2)');
      grad.addColorStop(1, 'rgba(243,234,216,.05)');
      g.fillStyle = grad;
      g.fillRect(x - 1.5, top, 3, bot - top);
    }
    // played-fret glow
    for (const s of S) {
      if (s.glow > 0.02 && s.fret > 0) {
        g.fillStyle = `rgba(240,180,60,${0.14 * s.glow})`;
        g.fillRect(fx(s.fret - 1) + 2, s.y - gap / 2, fx(s.fret) - fx(s.fret - 1) - 4, gap);
      }
    }
    // inlays
    g.fillStyle = 'rgba(243,234,216,.1)';
    const mid = (S[2].y + S[3].y) / 2;
    const dot = (x, y) => { g.beginPath(); g.arc(x, y, Math.max(3, gap * 0.16), 0, Math.PI * 2); g.fill(); };
    INLAYS.forEach((n) => dot((fx(n - 1) + fx(n)) / 2, mid));
    const x12 = (fx(11) + fx(12)) / 2;
    dot(x12, (S[1].y + S[2].y) / 2); dot(x12, (S[3].y + S[4].y) / 2);
    // nut
    g.fillStyle = 'rgba(243,234,216,.6)';
    g.fillRect(nutX - 5, top, 5, bot - top);
    // string names
    g.font = '500 11px "DM Mono", ui-monospace, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    S.forEach((s) => { g.fillStyle = s.glow > 0.05 ? `rgba(240,180,60,${0.5 + s.glow * 0.5})` : 'rgba(163,152,132,.85)'; g.fillText(NAMES[s.i], (nutX - 5) / 2, s.y); });
    g.globalAlpha = 1;

    // strings
    for (const s of S) {
      const sp = introDone ? 1 : easeOut(clamp((now - introStart - s.i * 90) / 900, 0, 1));
      if (sp <= 0) continue;
      const x0 = nutX, x1 = nutX + (W - nutX) * sp;
      const moving = s.grab || Math.abs(s.amp) > 0.04;
      const thick = 0.9 + s.i * 0.36;
      const wound = s.i >= 3;
      const baseCol = wound ? 'rgba(222,184,120,.85)' : 'rgba(236,228,214,.8)';

      // vibration envelope ("blur lens")
      if (!s.grab && Math.abs(s.amp) > 0.3) {
        const A = Math.abs(s.amp);
        g.beginPath();
        for (let x = x0; x <= x1; x += 6) g.lineTo(x, s.y - A * shape(s, x));
        for (let x = x1; x >= x0; x -= 6) g.lineTo(x, s.y + A * shape(s, x));
        g.closePath();
        g.fillStyle = `rgba(240,180,60,${0.05 + 0.1 * s.glow})`;
        g.fill();
      }

      g.beginPath();
      if (!moving) { g.moveTo(x0, s.y); g.lineTo(x1, s.y); }
      else {
        for (let x = x0; x <= x1 + 5; x += 5) {
          const xx = Math.min(x, x1);
          let d;
          if (s.grab) d = s.pull * shape(s, xx, true);
          else {
            const L = W - nutX, u = (xx - nutX) / L;
            d = s.amp * shape(s, xx) * Math.cos(s.phase) + s.amp * 0.22 * Math.sin(Math.PI * 2 * u) * Math.sin(s.phase * 2.03);
          }
          if (x === x0) g.moveTo(xx, s.y + d); else g.lineTo(xx, s.y + d);
        }
      }
      g.lineWidth = thick;
      g.strokeStyle = baseCol;
      g.stroke();
      if (s.glow > 0.03 || s.grab) {
        g.save();
        g.shadowColor = 'rgba(240,180,60,.9)';
        g.shadowBlur = 14 * Math.max(s.glow, s.grab ? 0.6 : 0);
        g.strokeStyle = `rgba(255,210,122,${Math.max(s.glow, s.grab ? 0.7 : 0)})`;
        g.lineWidth = thick + 0.6;
        g.stroke();
        g.restore();
      }
      if (s.spark > 0.03) {
        const r = 34 * (1.2 - s.spark);
        const rg = g.createRadialGradient(s.sx, s.y, 0, s.sx, s.y, r);
        rg.addColorStop(0, `rgba(255,214,140,${0.55 * s.spark})`);
        rg.addColorStop(1, 'rgba(255,214,140,0)');
        g.fillStyle = rg;
        g.beginPath(); g.arc(s.sx, s.y, r, 0, Math.PI * 2); g.fill();
      }
    }
    if (ip >= 1 && !introDone && now - introStart > 1500 + 6 * 90) {
      introDone = true;
      demo();
    }
  }

  // a silent "strum" after the intro hints that the strings are alive
  function demo() {
    if (reduce) return;
    S.forEach((s, i) => setTimeout(() => { s.pullX = W * 0.62 - i * 6; release(s, 5 + i * 0.6, true); }, 380 + i * 55));
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let active = !introDone;
    for (const s of S) {
      if (s.amp) {
        s.phase += dt * Math.PI * 2 * (9 + (5 - s.i) * 1.6);
        s.amp *= Math.pow(0.012, dt / 1.7);
        if (Math.abs(s.amp) < 0.04) s.amp = 0;
      }
      if (s.glow > 0.01) s.glow *= Math.pow(0.02, dt / 1.3); else s.glow = 0;
      if (s.spark > 0.01) s.spark *= Math.pow(0.001, dt / 0.7); else s.spark = 0;
      if (s.amp || s.grab || s.glow || s.spark) active = true;
    }
    if (visible && (active || dirty)) { draw(now); dirty = false; }
    requestAnimationFrame(frame);
  }
  onVisible(wrap, (v) => { visible = v; dirty = true; });

  const begin = () => { introStart = performance.now() + 250; requestAnimationFrame(frame); };
  if (document.body.classList.contains('ready')) begin();
  else document.addEventListener('cnote:ready', begin, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { dirty = true; });
})();
