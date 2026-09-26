/* C-Note — page interactions */
(() => {
  'use strict';
  const { Sound, Audio } = window.CNote;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.documentElement.classList.add('js');

  /* ---------- shared helpers ---------- */
  const GLYPHS = ['♪', '♫', '♩', '♬'];
  let liveNotes = 0;
  function spawnNote(el, color) {
    if (reduce || liveNotes > 28 || !el) return;
    const r = el.getBoundingClientRect();
    const n = document.createElement('span');
    n.className = 'fnote';
    n.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0] + '︎';
    n.style.left = r.left + r.width * (0.25 + Math.random() * 0.5) + 'px';
    n.style.top = r.top + r.height * 0.35 + 'px';
    n.style.color = color || 'var(--gold)';
    document.body.appendChild(n);
    liveNotes++;
    const dx = (Math.random() - 0.5) * 90;
    const a = n.animate([
      { transform: 'translate(-50%,0) scale(.5)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { transform: `translate(calc(-50% + ${dx}px),-130px) scale(1.25) rotate(${dx / 3}deg)`, opacity: 0 },
    ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' });
    a.onfinish = () => { n.remove(); liveNotes--; };
  }
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }
  function onVisible(el, cb, opts) {
    if (!el) return;
    new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting, e)), opts || { threshold: 0 }).observe(el);
  }
  Object.assign(window.CNote, { $, $$, clamp, lerp, reduce, fine, spawnNote, toast, onVisible });

  /* ---------- sound toggle UI ---------- */
  const soundBtns = $$('[data-sound-toggle]');
  function paintSound(on) {
    soundBtns.forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      const l = $('[data-sound-label]', b);
      if (l) l.textContent = on ? (b.dataset.on || 'Sound on') : (b.dataset.off || 'Sound off');
    });
  }
  soundBtns.forEach((b) => b.addEventListener('click', () => {
    Sound.set(!Sound.on);
    if (Sound.on) toast('Sound on — go make some noise');
  }));
  Sound.onChange(paintSound);

  /* ---------- count-in intro ---------- */
  const countin = $('#countin');
  let started = false;
  function go() {
    if (started) return;
    started = true;
    document.body.classList.remove('locked');
    document.body.classList.add('ready');
    document.dispatchEvent(new Event('cnote:ready'));
  }
  let seen = false;
  try { seen = sessionStorage.getItem('cnote-counted') === '1'; } catch (e) { /* storage blocked */ }
  if (reduce || seen || !countin) {
    if (countin) countin.remove();
    requestAnimationFrame(go);
  } else {
    document.body.classList.add('locked');
    const nums = $$('.ci-nums span', countin);
    const beat = 330;
    const timers = nums.map((n, i) => setTimeout(() => n.classList.add('on'), 120 + i * beat));
    const finish = () => {
      timers.forEach(clearTimeout);
      countin.classList.add('out');
      go();
      setTimeout(() => countin.remove(), 1000);
      try { sessionStorage.setItem('cnote-counted', '1'); } catch (e) { /* ignore */ }
    };
    const end = setTimeout(finish, 120 + nums.length * beat + 260);
    countin.addEventListener('click', () => { clearTimeout(end); finish(); }, { once: true });
  }

  /* ---------- nav, progress, active links, mobile menu ---------- */
  const nav = $('#nav'), bar = $('#progressBar'), menuBtn = $('#menuBtn'), mmenu = $('#mmenu');
  let lastY = scrollY, ticking = false;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 30);
    const menuOpen = menuBtn.getAttribute('aria-expanded') === 'true';
    if (!menuOpen) nav.classList.toggle('hide', y > 500 && y > lastY + 2);
    if (y < lastY - 2) nav.classList.remove('hide');
    lastY = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const links = $$('.nav-links a');
  $$('main section[id]').forEach((sec) => onVisible(sec, (vis) => {
    if (!vis) return;
    links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + sec.id));
  }, { rootMargin: '-50% 0px -50% 0px' }));

  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mmenu.hidden = !open;
    document.body.classList.toggle('locked', open);
    if (open) nav.classList.remove('hide');
  }
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  $$('a', mmenu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mmenu.hidden) setMenu(false); });

  /* ---------- split headings + reveals ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.className = 'wi';
            inner.textContent = p; inner.style.setProperty('--d', i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') walk(ch);
      });
    };
    walk(el);
  }
  $$('[data-split]').forEach(splitWords);
  const revealIO = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    // stagger siblings that reveal together
    const sibs = el.parentElement ? $$(':scope > .reveal', el.parentElement) : [];
    const idx = Math.max(0, sibs.indexOf(el));
    el.style.transitionDelay = Math.min(idx, 8) * 70 + 'ms';
    el.classList.add('in');
    revealIO.unobserve(el);
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal, [data-split]').forEach((el) => revealIO.observe(el));

  /* ---------- magnetic buttons ---------- */
  if (fine && !reduce) {
    $$('.magnetic').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = `translate(${dx * 0.22}px,${dy * 0.32}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------- hero spotlight ---------- */
  const hero = $('.hero');
  if (fine && hero) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--sx', e.clientX - r.left + 'px');
      hero.style.setProperty('--sy', e.clientY - r.top + 'px');
    });
  }

  /* ---------- marquee (scroll-velocity aware) ---------- */
  (function marquee() {
    const rows = $$('.mq-row');
    if (!rows.length) return;
    const state = rows.map((row) => {
      const track = $('.mq-track', row);
      return { row, track, base: track.innerHTML, x: 0, dir: +row.dataset.dir || 1, wrap: 0 };
    });
    function build() {
      state.forEach((s) => {
        s.track.innerHTML = s.base;
        const w0 = s.track.scrollWidth || 1;
        const k = Math.ceil(innerWidth / w0) + 1;
        const chunk = s.base.repeat(k);
        s.track.innerHTML = chunk + chunk;
        s.wrap = s.track.scrollWidth / 2;
      });
    }
    build();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
    if (reduce) return;
    let vis = true, vel = 0, sy = scrollY, sdir = 1, last = performance.now();
    onVisible($('.marquee'), (v) => { vis = v; });
    function tick(now) {
      const dt = Math.min(50, now - last) / 16.67; last = now;
      const d = scrollY - sy; sy = scrollY;
      if (d) sdir = d > 0 ? 1 : -1;
      vel = lerp(vel, Math.abs(d), 0.12);
      if (vis) {
        const speed = (1.1 + vel * 0.35) * sdir * dt;
        state.forEach((s) => {
          s.x -= speed * s.dir;
          if (s.x <= -s.wrap) s.x += s.wrap;
          if (s.x > 0) s.x -= s.wrap;
          s.track.style.transform = `translate3d(${s.x}px,0,0)`;
        });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- turntable ---------- */
  (function turntable() {
    const rec = $('#record'), spin = $('#recordSpin'), arm = $('#tonearm'), power = $('#deckPower');
    if (!rec) return;
    let angle = 0, vel = 0, on = false, powered = true, dragging = false, lastA = 0, lastT = 0, vis = false;
    let base = 200; // deg/s = 33⅓ rpm
    const angleOf = (e) => { const r = rec.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
    onVisible($('#deck'), (v) => {
      vis = v;
      if (v && powered && !on) { arm.classList.add('play'); setTimeout(() => { on = powered; }, 900); }
    }, { threshold: 0.35 });
    power.addEventListener('click', () => {
      powered = !powered;
      power.setAttribute('aria-pressed', String(powered));
      arm.classList.toggle('play', powered);
      if (powered) setTimeout(() => { on = powered; }, 700); else on = false;
    });
    $$('[data-rpm]').forEach((b) => b.addEventListener('click', () => {
      base = b.dataset.rpm === '45' ? 270 : 200;
      $$('[data-rpm]').forEach((x) => x.classList.toggle('active', x === b));
    }));
    rec.addEventListener('pointerdown', (e) => {
      dragging = true; lastA = angleOf(e); lastT = e.timeStamp;
      rec.setPointerCapture(e.pointerId);
    });
    rec.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const a = angleOf(e);
      let d = a - lastA;
      if (d > 180) d -= 360; else if (d < -180) d += 360;
      angle += d;
      const dt = Math.max(0.008, (e.timeStamp - lastT) / 1000);
      vel = lerp(vel, d / dt, 0.5);
      lastA = a; lastT = e.timeStamp;
    });
    const end = () => { dragging = false; };
    rec.addEventListener('pointerup', end);
    rec.addEventListener('pointercancel', end);
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (vis || Math.abs(vel) > 1) {
        if (dragging) {
          if (now - lastT > 80) vel = lerp(vel, 0, 0.3);
        } else {
          const target = on ? base : 0;
          vel = lerp(vel, target, 1 - Math.pow(on ? 0.25 : 0.4, dt));
          angle += vel * dt;
        }
        spin.style.transform = `rotate(${angle}deg)`;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- counters ---------- */
  $$('[data-count]').forEach((el) => {
    const target = +el.dataset.count;
    onVisible(el, (v) => {
      if (!v || el.dataset.done) return;
      el.dataset.done = '1';
      if (reduce) { el.textContent = target.toLocaleString(); return; }
      const t0 = performance.now(), dur = 1700;
      const step = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(2, -10 * p);
        el.textContent = Math.round(target * (p === 1 ? 1 : e)).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
  });

  /* ---------- genre hover disc ---------- */
  (function genreFloat() {
    const fl = $('.genre-float'), list = $('.genres');
    if (!fine || !fl || !list) return;
    const name = $('.gf-name', fl);
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = 0;
    const tick = () => {
      x = lerp(x, tx, 0.14); y = lerp(y, ty, 0.14);
      fl.style.transform = `translate(${x}px,${y}px)`;
      raf = Math.abs(x - tx) + Math.abs(y - ty) > 0.4 ? requestAnimationFrame(tick) : 0;
    };
    list.addEventListener('pointermove', (e) => {
      tx = e.clientX + 150; ty = e.clientY;
      if (e.target.closest('.genre')) fl.classList.add('on');
      if (!raf) raf = requestAnimationFrame(tick);
    });
    addEventListener('scroll', () => fl.classList.remove('on'), { passive: true });
    $$('.genre', list).forEach((li) => li.addEventListener('pointerenter', (e) => {
      if (!fl.classList.contains('on')) { x = e.clientX + 150; y = e.clientY; }
      fl.style.setProperty('--gc', li.style.getPropertyValue('--gc'));
      name.textContent = li.dataset.name;
      fl.classList.add('on');
    }));
    list.addEventListener('pointerleave', () => fl.classList.remove('on'));
  })();

  /* ---------- 3D tilt (cards + ticket) ---------- */
  if (fine && !reduce) {
    $$('.tilt').forEach((el) => {
      const isTicket = el.id === 'ticket';
      const max = isTicket ? 10 : 7;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.transform = `perspective(1100px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg)${isTicket ? ' rotate(-1deg)' : ' translateY(-4px)'}`;
        el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
        el.style.setProperty('--gx', px * 100 + '%'); el.style.setProperty('--gy', py * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('tilting'); el.style.transform = ''; });
    });
  }

  /* ---------- method steps ---------- */
  (function method() {
    const steps = $$('.step'), num = $('#mcNum'), mbar = $('#mcBar');
    if (!steps.length) return;
    steps.forEach((s) => onVisible(s, (v) => {
      if (!v) return;
      steps.forEach((x) => x.classList.toggle('active', x === s));
      const n = s.dataset.step;
      if (num && num.textContent !== '0' + n) {
        num.textContent = '0' + n;
        num.classList.remove('flip'); void num.offsetWidth; num.classList.add('flip');
      }
      if (mbar) mbar.style.width = n * 25 + '%';
    }, { rootMargin: '-45% 0px -45% 0px' }));
  })();

  /* ---------- quote: words light up with scroll ---------- */
  (function quote() {
    const q = $('#quoteText');
    if (!q) return;
    const words = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span'); s.className = 'qw'; s.textContent = p;
            words.push(s); frag.appendChild(s);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) walk(ch);
      });
    };
    walk(q);
    if (reduce) { words.forEach((w) => w.classList.add('lit')); return; }
    let vis = false, queued = false;
    const update = () => {
      queued = false;
      const r = q.getBoundingClientRect();
      const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35), 0, 1);
      const n = Math.round(p * words.length * 1.15);
      words.forEach((w, i) => w.classList.toggle('lit', i < n));
    };
    onVisible(q, (v) => { vis = v; if (v) update(); });
    addEventListener('scroll', () => { if (vis && !queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  })();

  /* ---------- contact: copy, claim, mailto form ---------- */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = b.dataset.copy;
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { document.execCommand('copy'); } catch (err) { /* ignore */ } ta.remove();
    }
    const old = b.textContent; b.textContent = 'Copied'; toast(`Copied ${text}`);
    setTimeout(() => { b.textContent = old; }, 1600);
  }));
  const msg = $('#f-msg');
  $$('[data-claim]').forEach((a) => a.addEventListener('click', () => {
    if (msg && !msg.value.trim()) msg.value = 'Hi C-Note! I’d like to claim my free trial mini lesson.';
  }));
  const form = $('#contactForm');
  if (form) {
    const nameEl = $('#f-name'), err = $('#f-name-err'), note = $('#formNote');
    nameEl.addEventListener('input', () => { nameEl.removeAttribute('aria-invalid'); err.textContent = ''; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameEl.value.trim();
      if (!name) {
        nameEl.setAttribute('aria-invalid', 'true');
        err.textContent = 'Please tell me your name.';
        nameEl.focus();
        return;
      }
      const inst = $('#f-inst').value, level = $('#f-level').value, m = msg.value.trim();
      const subject = `Lesson inquiry — ${name} (${inst})`;
      const body = `Hi C-Note,\n\nMy name is ${name}.\nInstrument: ${inst}\nExperience: ${level}\n\n${m || 'I’d like to set up a free trial mini lesson.'}\n\nThanks!\n${name}`;
      window.location.href = `mailto:cnotemusicphilly@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      note.classList.add('ok');
      note.innerHTML = 'Your email app should open with your message ready to send. Nothing happened? Email <a href="mailto:cnotemusicphilly@gmail.com">cnotemusicphilly@gmail.com</a> or call <a href="tel:+16103043444">610-304-3444</a>.';
    });
  }

  /* ---------- footer: PLAY ON!!! xylophone ---------- */
  (function playOn() {
    const el = $('#playOn');
    if (!el) return;
    const text = 'PLAY ON!!!';
    const scale = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      if (ch === ' ') { s.className = 'gap'; el.appendChild(s); return; }
      s.textContent = ch;
      const hit = () => {
        s.classList.add('bump');
        clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove('bump'), 160);
        if (Sound.on) { const c = Audio.wake(); if (c) Audio.bell(window.CNote.midiFreq(scale[i]), c.currentTime, 0.28); }
      };
      s.addEventListener('pointerenter', hit);
      s.addEventListener('pointerdown', hit);
      el.appendChild(s);
    });
  })();

  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();
})();
