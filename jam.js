/* C-Note — the Jam Room: drum pads, keys, guitar chords and a groove machine */
(() => {
  'use strict';
  const { Sound, Audio, NOTES, noteFreq, midiFreq, $, $$, clamp, spawnNote, onVisible } = window.CNote;
  const jam = $('#jam');
  if (!jam) return;
  const now = () => (Audio.ctx ? Audio.ctx.currentTime : 0);
  const ensure = () => Sound.ensure();
  let jamVisible = false;
  const pill = $('#nowPlaying'), pillText = $('#npText');
  onVisible(jam, (v) => { jamVisible = v; updatePill(); });

  /* ---------- tabs ---------- */
  const tabs = $$('.tab', jam);
  const tipEl = $('#consoleTip');
  const TIPS = {
    drums: '<span class="kb-only">Keys Q W E R / A S D F play the pads — or </span>click and tap away.',
    keys: '<span class="kb-only">Play with A–; for white keys and W E T Y U O P for sharps. </span>Click and drag across the keys for a glissando.',
    guitar: 'Pick a chord<span class="kb-only"> (1–6)</span>, then sweep across the strings — or hit Strum.',
    groove: 'Tap the grid to write a beat. The bass line follows along.<span class="kb-only"> Space = play / stop.</span>',
  };
  let active = 'drums';
  function select(name, focus) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#panel-' + t.dataset.tab).hidden = !on;
      if (on && focus) t.focus();
    });
    active = name;
    tipEl.innerHTML = TIPS[name];
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(n.dataset.tab, true);
    });
  });
  select('drums');
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    select(b.dataset.goto);
    jam.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  /* ---------- drum pads ---------- */
  const PADS = [
    { id: 'crash', name: 'Crash', key: 'q', color: '#ffd27a' },
    { id: 'ohat', name: 'Open Hat', key: 'w', color: '#f0b43c' },
    { id: 'tomh', name: 'High Tom', key: 'e', color: '#e0609e' },
    { id: 'clap', name: 'Clap', key: 'r', color: '#a78bfa' },
    { id: 'kick', name: 'Kick', key: 'a', color: '#e4572e' },
    { id: 'snare', name: 'Snare', key: 's', color: '#f3ead8' },
    { id: 'hat', name: 'Hi-Hat', key: 'd', color: '#ffd27a' },
    { id: 'toml', name: 'Low Tom', key: 'f', color: '#5b8def' },
  ];
  const padEls = {};
  function playDrum(id, t, v = 1) {
    const d = Audio.drums;
    switch (id) {
      case 'kick': d.kick(t, v); break;
      case 'snare': d.snare(t, v); break;
      case 'hat': d.hat(t, v, false); break;
      case 'ohat': d.hat(t, v, true); break;
      case 'tomh': d.tom(t, v, 240); break;
      case 'toml': d.tom(t, v, 130); break;
      case 'clap': d.clap(t, v); break;
      case 'crash': d.crash(t, v); break;
    }
  }
  function hitPad(id) {
    if (!ensure()) return;
    playDrum(id, now());
    const el = padEls[id], p = PADS.find((x) => x.id === id);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hit'), 110);
    spawnNote(el, p.color);
  }
  const padWrap = $('#pads');
  PADS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pad';
    b.style.setProperty('--pc', p.color);
    b.setAttribute('aria-label', `${p.name} (key ${p.key.toUpperCase()})`);
    b.innerHTML = `<span class="kbd">${p.key.toUpperCase()}</span><span class="pad-name">${p.name}</span>`;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); hitPad(p.id); });
    b.addEventListener('click', (e) => { if (e.detail === 0) hitPad(p.id); });
    padWrap.appendChild(b);
    padEls[p.id] = b;
  });

  /* ---------- keys ---------- */
  const KEYMAP = 'awsedftgyhujkolp;';
  const piano = $('#piano');
  const keys = [];
  let white = 0;
  for (let i = 0; i < 17; i++) {
    const midi = 60 + i, name = NOTES[midi % 12], black = name.includes('#');
    const el = document.createElement('button');
    el.type = 'button';
    el.className = black ? 'bk' : 'wk';
    el.setAttribute('aria-label', `${name.replace('#', ' sharp')}${Math.floor(midi / 12) - 1}`);
    el.innerHTML = `<span class="kbd">${KEYMAP[i] === ';' ? ';' : KEYMAP[i].toUpperCase()}</span>${name === 'C' ? `<span class="kn">C${Math.floor(midi / 12) - 1}</span>` : ''}`;
    if (black) el.style.left = `calc(10px + (100% - 20px) * ${white / 10})`;
    else white++;
    piano.appendChild(el);
    keys.push({ el, freq: midiFreq(midi), voice: null, src: null });
  }
  function keyOn(k, src) {
    if (k.voice) return;
    if (!ensure()) return;
    k.voice = Audio.keyOn(k.freq, now(), 0.42);
    k.src = src;
    k.el.classList.add('on');
    spawnNote(k.el);
  }
  function keyOff(k) {
    if (!k.voice) return;
    k.voice.off(); k.voice = null; k.src = null;
    k.el.classList.remove('on');
  }
  let mouseDown = false;
  keys.forEach((k) => {
    k.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      mouseDown = true;
      try { k.el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      keyOn(k, 'ptr');
    });
    k.el.addEventListener('pointerenter', () => { if (mouseDown) keyOn(k, 'ptr'); });
    k.el.addEventListener('pointerleave', () => { if (mouseDown && k.src === 'ptr') keyOff(k); });
    k.el.addEventListener('click', (e) => { if (e.detail === 0) { keyOn(k, 'kbd'); setTimeout(() => keyOff(k), 350); } });
  });
  const allUp = () => { if (!mouseDown) return; mouseDown = false; keys.forEach((k) => { if (k.src === 'ptr') keyOff(k); }); };
  addEventListener('pointerup', allUp);
  addEventListener('pointercancel', allUp);

  /* ---------- guitar ---------- */
  const OPEN_LH = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // low E → high e
  const CHORDS = {
    C: [-1, 3, 2, 0, 1, 0], G: [3, 2, 0, 0, 0, 3], D: [-1, -1, 0, 2, 3, 2],
    Em: [0, 2, 2, 0, 0, 0], Am: [-1, 0, 2, 2, 1, 0], F: [1, 3, 3, 2, 1, 1],
  };
  const chordNames = Object.keys(CHORDS);
  let chord = 'G', strumDir = 1;
  const svg = $('#fretSvg'), chordWrap = $('#chords');
  const X0 = 70, FW = 120, Y0 = 30, SG = 36, END = X0 + FW * 4 + 30;
  const yOf = (s) => Y0 + SG * (5 - s); // s: 0 = low E (bottom)
  (function buildBoard() {
    let h = `<defs><linearGradient id="wood" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2a1c12"/><stop offset=".5" stop-color="#3a2717"/><stop offset="1" stop-color="#26190f"/></linearGradient></defs>`;
    h += `<rect x="${X0}" y="${Y0 - 16}" width="${END - X0}" height="${SG * 5 + 32}" rx="6" fill="url(#wood)"/>`;
    h += `<circle cx="${X0 + FW * 2.5}" cy="${Y0 + SG * 2.5}" r="8" fill="rgba(243,234,216,.16)"/>`;
    for (let f = 1; f <= 4; f++) h += `<rect x="${X0 + FW * f - 2}" y="${Y0 - 16}" width="4" height="${SG * 5 + 32}" fill="#9a8a72" opacity=".75"/>`;
    h += `<rect x="${X0 - 7}" y="${Y0 - 16}" width="9" height="${SG * 5 + 32}" rx="2" fill="#efe6d4"/>`;
    for (let f = 1; f <= 4; f++) h += `<text x="${X0 + FW * (f - 0.5)}" y="${Y0 + SG * 5 + 34}" text-anchor="middle" font-family="DM Mono, monospace" font-size="12" fill="#a39884">${f}</text>`;
    for (let s = 0; s < 6; s++) {
      const y = yOf(s), w = 1 + (5 - s) * 0.45, col = s <= 2 ? '#dcb878' : '#ece4d6';
      h += `<g class="fs" data-s="${s}"><line class="str" x1="${X0}" y1="${y}" x2="${END}" y2="${y}" stroke="${col}" stroke-width="${w}"/><line class="glow" x1="${X0}" y1="${y}" x2="${END}" y2="${y}" stroke="#ffd27a" stroke-width="${w + 2}" opacity="0" style="filter:blur(2px)"/></g>`;
    }
    h += `<g id="marks"></g><g id="dots"></g>`;
    svg.innerHTML = h;
  })();
  function drawChord() {
    const shape = CHORDS[chord];
    let dots = '', marks = '';
    const fretted = shape.filter((f) => f > 0);
    const barre = shape.every((f) => f >= 1) ? Math.min(...shape) : 0;
    if (barre) dots += `<rect class="dot-in" x="${X0 + FW * (barre - 0.5) - 13}" y="${Y0 - 13}" width="26" height="${SG * 5 + 26}" rx="13" fill="#f0b43c"/>`;
    shape.forEach((f, s) => {
      const y = yOf(s);
      if (f < 0) marks += `<text x="${X0 - 34}" y="${y + 5}" text-anchor="middle" font-family="DM Mono, monospace" font-size="16" fill="#e4572e">×</text>`;
      else if (f === 0) marks += `<circle cx="${X0 - 34}" cy="${y}" r="7" fill="none" stroke="#a39884" stroke-width="2"/>`;
      else if (f !== barre) dots += `<circle class="dot-in" style="animation-delay:${s * 30}ms" cx="${X0 + FW * (f - 0.5)}" cy="${y}" r="14" fill="#f0b43c" stroke="#140f07" stroke-opacity=".3" stroke-width="2"/>`;
    });
    if (!fretted.length) dots += '';
    $('#dots', svg).innerHTML = dots;
    $('#marks', svg).innerHTML = marks;
    $$('.chord', chordWrap).forEach((b) => b.classList.toggle('active', b.dataset.chord === chord));
  }
  function vibrate(s, delay) {
    const el = $(`.fs[data-s="${s}"]`, svg);
    setTimeout(() => { el.classList.remove('vib'); void el.getBoundingClientRect(); el.classList.add('vib'); }, delay);
  }
  function pluckString(s, t, audible) {
    const f = CHORDS[chord][s];
    if (f < 0) return false;
    if (audible) Audio.pluck(OPEN_LH[s] * Math.pow(2, f / 12), t, 0.5);
    return true;
  }
  function strum() {
    const c = ensure();
    if (!c) return;
    const order = strumDir > 0 ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
    let k = 0;
    order.forEach((s) => { if (pluckString(s, c.currentTime + k * 0.024, true)) { vibrate(s, k * 24); k++; } });
    spawnNote($('#fretboard'));
    strumDir *= -1;
    $('#strumDir').textContent = strumDir > 0 ? '↓' : '↑';
  }
  chordNames.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chord'; b.dataset.chord = name;
    b.setAttribute('aria-label', `${name} chord (key ${i + 1})`);
    b.innerHTML = `<span class="kbd">${i + 1}</span><b>${name}</b>`;
    b.addEventListener('click', () => { chord = name; strumDir = 1; drawChord(); strum(); });
    chordWrap.appendChild(b);
  });
  $('#strumBtn').addEventListener('click', strum);
  drawChord();
  // sweep across the fretboard strings to strum
  (function sweep() {
    const board = $('#fretboard');
    let prev = null;
    const toSvg = (e) => { const r = svg.getBoundingClientRect(); return { x: ((e.clientX - r.left) * 600) / r.width, y: ((e.clientY - r.top) * 240) / r.height }; };
    const cross = (p) => {
      if (prev) {
        for (let s = 0; s < 6; s++) {
          const y = yOf(s), a = prev.y - y, b = p.y - y;
          if ((a < 0 && b >= 0) || (a > 0 && b <= 0)) {
            const audible = Sound.on;
            if (pluckString(s, now(), audible && Audio.wake())) vibrate(s, 0);
          }
        }
      }
      prev = p;
    };
    board.addEventListener('pointermove', (e) => cross(toSvg(e)));
    board.addEventListener('pointerleave', () => { prev = null; });
    board.addEventListener('pointerdown', (e) => {
      const p = toSvg(e);
      let best = -1, bd = Infinity;
      for (let s = 0; s < 6; s++) { const d = Math.abs(yOf(s) - p.y); if (d < bd) { bd = d; best = s; } }
      if (bd < SG * 0.6 && ensure() && pluckString(best, now(), true)) vibrate(best, 0);
      prev = p;
    });
  })();

  /* ---------- groove machine ---------- */
  const ROWS = [
    { id: 'hat', label: 'Hi-Hat', color: '#ffd27a' },
    { id: 'snare', label: 'Snare', color: '#f3ead8' },
    { id: 'kick', label: 'Kick', color: '#e4572e' },
    { id: 'bass', label: 'Bass', color: '#a78bfa' },
  ];
  const pat = (s) => [...s].map((c) => c === 'x');
  const expand = (arr) => arr.flatMap((n) => [n, n]); // 8 eighth-notes → 16 steps
  const PRESETS = {
    rock:   { bpm: 116, swing: 0, hat: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', kick: 'x.....x.x.x.....', bass: 'x.x.x.x.x.x.x.x.', riff: expand(['E2', 'E2', 'E2', 'G2', 'A2', 'A2', 'G2', 'D2']) },
    funk:   { bpm: 100, swing: 0.12, hat: 'x.xxx.x.x.xxx.x.', snare: '....x..x.x..x...', kick: 'x..x......x..x..', bass: 'x..x..x...x.xx..', riff: ['E2', 'E2', 'E2', 'E3', 'E3', 'E3', 'G2', 'G2', 'G2', 'G2', 'A2', 'A2', 'B2', 'D3', 'D3', 'D3'] },
    reggae: { bpm: 76, swing: 0.1, hat: '..x...x...x...x.', snare: '........x.......', kick: '........x.......', bass: '..xx..x...xx.x..', riff: ['E2', 'E2', 'E2', 'G2', 'G2', 'G2', 'A2', 'A2', 'A2', 'A2', 'B2', 'A2', 'A2', 'G2', 'G2', 'G2'] },
    metal:  { bpm: 168, swing: 0, hat: 'x...x...x...x...', snare: '....x.......x...', kick: 'xxxxxxxxxxxxxxxx', bass: 'xxxxxx.xxxxxx.x.', riff: ['E2', 'E2', 'E2', 'E2', 'E2', 'E2', 'F2', 'E2', 'E2', 'E2', 'E2', 'E2', 'G2', 'E2', 'A#2', 'A#2'] },
    dance:  { bpm: 124, swing: 0, open: true, clap: true, hat: '..x...x...x...x.', snare: '....x.......x...', kick: 'x...x...x...x...', bass: 'x.x.x.x.x.x.x.x.', riff: expand(['E2', 'E3', 'E2', 'E3', 'G2', 'G3', 'A2', 'A3']) },
  };
  const seq = { playing: false, step: 0, next: 0, bpm: 100, swing: 0, open: false, clap: false, timer: 0, queue: [], grid: {}, riff: [], name: 'funk' };
  const seqEl = $('#seq'), cells = {}, leds = [];
  (function buildSeq() {
    seqEl.appendChild(document.createElement('span'));
    for (let i = 0; i < 16; i++) { const l = document.createElement('span'); l.className = 'led-cell'; seqEl.appendChild(l); leds.push(l); }
    ROWS.forEach((row) => {
      const lab = document.createElement('span');
      lab.className = 'seq-label'; lab.style.setProperty('--rc', row.color); lab.textContent = row.label;
      seqEl.appendChild(lab);
      cells[row.id] = [];
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'cell' + (i % 4 === 0 ? ' q' : '');
        c.style.setProperty('--rc', row.color);
        c.setAttribute('aria-label', `${row.label}, step ${i + 1}`);
        c.setAttribute('aria-pressed', 'false');
        c.addEventListener('click', () => {
          seq.grid[row.id][i] = !seq.grid[row.id][i];
          paintCell(row.id, i);
          if (seq.grid[row.id][i] && !seq.playing && ensure()) {
            if (row.id === 'bass') Audio.bass(noteFreq(seq.riff[i]), now(), 0.2);
            else playRowSound(row.id, i, now());
          }
        });
        seqEl.appendChild(c);
        cells[row.id].push(c);
      }
    });
  })();
  function paintCell(row, i) {
    const on = !!seq.grid[row][i], c = cells[row][i];
    c.setAttribute('aria-pressed', String(on));
    c.textContent = row === 'bass' && on ? seq.riff[i].replace(/\d/, '') : '';
  }
  function paintAll() { ROWS.forEach((r) => { for (let i = 0; i < 16; i++) paintCell(r.id, i); }); }
  const bpmIn = $('#bpm'), bpmOut = $('#bpmOut'), playBtn = $('#playBtn');
  function setBpm(v) {
    seq.bpm = +v; bpmIn.value = v; bpmOut.value = v; bpmOut.textContent = v;
    bpmIn.style.setProperty('--fill', ((v - 60) / 120) * 100 + '%');
    playBtn.style.animationDuration = 60 / seq.bpm + 's';
  }
  bpmIn.addEventListener('input', () => setBpm(bpmIn.value));
  function loadPreset(name) {
    const chips = $$('.chip', $('#presets'));
    if (name === 'clear') {
      ROWS.forEach((r) => { seq.grid[r.id] = Array(16).fill(false); });
    } else {
      const p = PRESETS[name];
      seq.name = name; seq.swing = p.swing; seq.open = !!p.open; seq.clap = !!p.clap; seq.riff = p.riff.slice();
      ROWS.forEach((r) => { seq.grid[r.id] = pat(p[r.id]); });
      setBpm(p.bpm);
      chips.forEach((c) => c.classList.toggle('active', c.dataset.preset === name));
    }
    paintAll();
    updatePill();
  }
  $$('.chip', $('#presets')).forEach((c) => c.addEventListener('click', () => loadPreset(c.dataset.preset)));
  loadPreset('funk');

  function playRowSound(row, s, t) {
    const d = Audio.drums;
    if (row === 'hat') d.hat(t, s % 4 === 0 ? 0.9 : 0.6, seq.open);
    else if (row === 'snare') { if (seq.clap) d.clap(t, 0.9); else d.snare(t, s === 4 || s === 12 ? 1 : 0.35); }
    else if (row === 'kick') d.kick(t, 1);
  }
  const stepDur = () => 60 / seq.bpm / 4;
  function scheduleStep(s, t) {
    ['hat', 'snare', 'kick'].forEach((r) => { if (seq.grid[r][s]) playRowSound(r, s, t); });
    if (seq.grid.bass[s]) {
      let len = 1;
      while (len < 4 && !seq.grid.bass[(s + len) % 16]) len++;
      Audio.bass(noteFreq(seq.riff[s]), t, Math.min(len, 2) * stepDur() * 0.85, 0.5);
    }
  }
  function scheduler() {
    const c = Audio.ctx;
    while (seq.next < c.currentTime + 0.12) {
      const s = seq.step;
      const t = seq.next + (s % 2 ? seq.swing * stepDur() : 0);
      scheduleStep(s, t);
      seq.queue.push({ s, t });
      seq.next += stepDur();
      seq.step = (s + 1) % 16;
    }
  }
  let lastLit = -1;
  function light(s) {
    if (lastLit >= 0) { leds[lastLit].classList.remove('now'); ROWS.forEach((r) => cells[r.id][lastLit].classList.remove('now')); }
    if (s >= 0) { leds[s].classList.add('now'); ROWS.forEach((r) => cells[r.id][s].classList.add('now')); }
    lastLit = s;
  }
  function drawLoop() {
    if (!seq.playing) return;
    const c = Audio.ctx;
    let cur = null;
    while (seq.queue.length && seq.queue[0].t <= c.currentTime) cur = seq.queue.shift().s;
    if (cur !== null) light(cur);
    requestAnimationFrame(drawLoop);
  }
  function start() {
    const c = ensure();
    if (!c || seq.playing) return;
    seq.playing = true; seq.step = 0; seq.queue.length = 0;
    seq.next = c.currentTime + 0.08;
    scheduler();
    seq.timer = setInterval(scheduler, 25);
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.setAttribute('aria-label', 'Stop groove');
    requestAnimationFrame(drawLoop);
    updatePill();
  }
  function stop() {
    if (!seq.playing) return;
    clearInterval(seq.timer);
    seq.playing = false; seq.queue.length = 0;
    light(-1);
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.setAttribute('aria-label', 'Play groove');
    updatePill();
  }
  playBtn.addEventListener('click', () => (seq.playing ? stop() : start()));
  Sound.onChange((on) => { if (!on) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

  /* ---------- "now playing" pill ---------- */
  function updatePill() {
    if (!pill) return;
    const show = seq.playing && !jamVisible;
    pill.hidden = !show;
    if (show) pillText.textContent = `${seq.name[0].toUpperCase() + seq.name.slice(1)} groove · ${seq.bpm} BPM`;
  }
  $('#npStop').addEventListener('click', stop);

  /* ---------- oscilloscope ---------- */
  (function scope() {
    const cv = $('#scope');
    const g = cv.getContext('2d');
    let W = 0, H = 0, data = null;
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    new ResizeObserver(size).observe(cv);
    function frame(t) {
      if (jamVisible && W) {
        g.clearRect(0, 0, W, H);
        g.strokeStyle = 'rgba(243,234,216,.07)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
        const an = Audio.analyser;
        g.beginPath();
        if (an && Sound.on) {
          if (!data) data = new Uint8Array(an.fftSize);
          an.getByteTimeDomainData(data);
          const n = data.length;
          for (let i = 0; i < n; i += 2) {
            const x = (i / (n - 1)) * W, y = H / 2 + ((data[i] - 128) / 128) * (H / 2) * 1.6;
            i === 0 ? g.moveTo(x, y) : g.lineTo(x, clamp(y, 2, H - 2));
          }
        } else {
          for (let x = 0; x <= W; x += 3) { const y = H / 2 + Math.sin(x * 0.08 + t * 0.003) * 1.5; x === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
        }
        g.strokeStyle = '#f0b43c'; g.lineWidth = 1.6;
        g.shadowColor = 'rgba(240,180,60,.8)'; g.shadowBlur = 8;
        g.stroke(); g.shadowBlur = 0;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* ---------- computer keyboard ---------- */
  const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || !jamVisible) return;
    const k = e.key.toLowerCase();
    if (active === 'drums') {
      const p = PADS.find((x) => x.key === k);
      if (p) { e.preventDefault(); if (!e.repeat) hitPad(p.id); }
    } else if (active === 'keys') {
      const i = KEYMAP.indexOf(k);
      if (i > -1) { e.preventDefault(); if (!e.repeat) keyOn(keys[i], 'kbd'); }
    } else if (active === 'guitar') {
      const i = '123456'.indexOf(k);
      if (i > -1 && !e.repeat) { e.preventDefault(); chord = chordNames[i]; strumDir = 1; drawChord(); strum(); }
    } else if (active === 'groove' && k === ' ' && e.target.tagName !== 'BUTTON') {
      e.preventDefault(); seq.playing ? stop() : start();
    }
  });
  addEventListener('keyup', (e) => {
    const i = KEYMAP.indexOf(e.key.toLowerCase());
    if (i > -1 && keys[i].src === 'kbd') keyOff(keys[i]);
  });
})();
