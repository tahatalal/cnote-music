/* C-Note Music School: photo interactions (lightbox, school gallery, hero parallax, setlist record) */
(() => {
  'use strict';
  const { $, $$, reduce, fine } = window.CNote;

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
  let lastTrigger = null;
  function openPhoto(src, caption, alt, trigger) {
    if (!lb || typeof lb.showModal !== 'function') { window.open(src, '_blank', 'noopener'); return; }
    lastTrigger = trigger || null;
    lbImg.removeAttribute('style');
    lbImg.onload = () => {
      // never blow small photos up more than ~2.4x, so they stay crisp enough
      const maxW = Math.min(lbImg.naturalWidth * 2.4, innerWidth * 0.92 - 24);
      const maxH = Math.min(lbImg.naturalHeight * 2.4, innerHeight * 0.92 - 90);
      const scale = Math.min(maxW / lbImg.naturalWidth, maxH / lbImg.naturalHeight);
      lbImg.style.width = Math.round(lbImg.naturalWidth * scale) + 'px';
      lbImg.style.height = Math.round(lbImg.naturalHeight * scale) + 'px';
    };
    lbImg.src = src;
    lbImg.alt = alt || caption || '';
    lbCap.textContent = caption || '';
    lb.showModal();
  }
  if (lb) {
    $('#lbClose').addEventListener('click', () => lb.close());
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', () => { if (lastTrigger) lastTrigger.focus({ preventScroll: true }); });
  }
  $$('.pl-img').forEach((b) => b.addEventListener('click', () => {
    const img = $('img', b);
    openPhoto(b.dataset.full, b.dataset.caption, img && img.alt, b);
  }));

  /* ---------- school gallery: expanding panels ---------- */
  (function gallery() {
    const panels = $$('#gallery .g-panel');
    if (!panels.length) return;
    const open = (p) => panels.forEach((x) => x.classList.toggle('is-open', x === p));
    panels.forEach((p) => {
      if (fine) p.addEventListener('pointerenter', () => open(p));
      p.addEventListener('focus', () => open(p));
      if (p.tagName === 'BUTTON') {
        p.addEventListener('click', () => {
          if (!p.classList.contains('is-open')) { open(p); return; }
          const img = $('img', p);
          openPhoto(p.dataset.full, p.dataset.caption, img && img.alt, p);
        });
      }
    });
  })();

  /* ---------- hero photo parallax ---------- */
  (function heroParallax() {
    const hero = $('.hero'), photo = $('.hero-photo');
    if (!hero || !photo || !fine || reduce) return;
    let raf = 0, tx = 0, ty = 0;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * -18;
      ty = ((e.clientY - r.top) / r.height - 0.5) * -12;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        photo.style.setProperty('--px', tx.toFixed(1) + 'px');
        photo.style.setProperty('--py', ty.toFixed(1) + 'px');
      });
    });
  })();

  /* ---------- setlist: the record label follows the genre ---------- */
  (function setlistRecord() {
    const fill = $('#labelFill'), title = $('#labelTitle'), cap = $('#deckGenre');
    const rows = $$('.setlist-grid .genre');
    if (!fill || !title || !rows.length) return;
    const DEFAULT = { color: '#f0b43c', name: 'C-NOTE', caption: cap ? cap.textContent : '' };
    function setRecord(row) {
      rows.forEach((r) => r.classList.toggle('is-current', r === row));
      if (!row) {
        fill.setAttribute('fill', DEFAULT.color);
        title.textContent = DEFAULT.name;
        title.setAttribute('font-size', '36');
        if (cap) cap.textContent = DEFAULT.caption;
        return;
      }
      const name = $('.g-name', row).textContent.trim();
      const color = row.style.getPropertyValue('--gc').trim() || DEFAULT.color;
      fill.setAttribute('fill', color);
      title.textContent = name.toUpperCase();
      const n = name.length;
      title.setAttribute('font-size', n <= 6 ? '36' : n <= 8 ? '30' : n <= 11 ? '24' : '20');
      if (cap) cap.textContent = name;
    }
    rows.forEach((r) => {
      r.tabIndex = 0;
      r.setAttribute('role', 'button');
      r.setAttribute('aria-label', `Spin ${$('.g-name', r).textContent.trim()}`);
      if (fine) r.addEventListener('pointerenter', () => setRecord(r));
      r.addEventListener('focus', () => setRecord(r));
      r.addEventListener('click', () => setRecord(r));
    });
  })();
})();
