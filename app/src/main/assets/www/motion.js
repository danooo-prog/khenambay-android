/* Khenambay · animasi interaksi.
   - riak (ripple) di titik sentuh pada tombol, chip, kartu, dan menu
   - pilihan yang baru diketuk "melompat" kecil
   - isi halaman muncul bertahap saat pindah halaman
   - angka menghitung naik, cincin progres terisi
   - bagian halaman awal muncul saat di-scroll + judul raksasa paralaks
   Semua dimatikan bila pengguna memilih "kurangi gerakan" di perangkatnya. */
(function () {
  'use strict';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PRESS = '.btn, .chip, .bt, .l-path, .dk:not(.dk-fab), .opp, .item, .kpi, .side a, .topnav a, .l-role, .sector, .l-card, .icon-btn, .mini-opp, .l-cta, .l-pill, .faq summary, .seg button, .mapseg button, .levels button';

  // ---------- riak saat ditekan ----------
  document.addEventListener('pointerdown', (e) => {
    if (reduce() || e.button > 0) return;
    const el = e.target.closest(PRESS);
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.2;
    const rp = document.createElement('span');
    rp.className = 'ripple';
    rp.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.classList.add('rp-host');
    el.appendChild(rp);
    rp.addEventListener('animationend', () => { rp.remove(); if (!el.querySelector('.ripple')) el.classList.remove('rp-host'); });
  }, { passive: true });

  // ---------- pilihan yang baru diketuk ----------
  let lastSel = null;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act][data-v], [data-act="save"], .sector, .chip, .seg button, .levels button');
    if (!el) return;
    lastSel = { act: el.dataset.act || '', v: el.dataset.v || '', id: el.dataset.id || '', text: el.textContent.trim().slice(0, 40), at: Date.now() };
    setTimeout(markSelected, 0);
  }, true);
  function markSelected() {
    if (!lastSel || Date.now() - lastSel.at > 800) return;
    const s = lastSel; lastSel = null;
    let sel = '';
    if (s.act) sel = `[data-act="${CSS.escape(s.act)}"]` + (s.v ? `[data-v="${CSS.escape(s.v)}"]` : '') + (s.id ? `[data-id="${CSS.escape(s.id)}"]` : '');
    const el = sel ? document.querySelector(sel) : null;
    if (!el || reduce()) return;
    el.classList.remove('just-sel'); void el.offsetWidth; el.classList.add('just-sel');
    if (s.act === 'save' && el.getAttribute('aria-pressed') === 'true') burst(el);
  }
  function burst(el) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('i'); p.className = 'burst';
      const a = (i / 8) * Math.PI * 2;
      p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${Math.cos(a) * 26}px;--dy:${Math.sin(a) * 26}px`;
      document.body.appendChild(p); p.addEventListener('animationend', () => p.remove());
    }
  }

  // ---------- angka menghitung naik ----------
  function countUp(root) {
    root.querySelectorAll('.bt-n, .kpi b, .stats b, .ph-goal .ring b, .hero-num').forEach((el) => {
      const m = el.textContent.match(/^(\d+)(%?)$/);
      if (!m) return;
      const to = +m[1], suf = m[2];
      if (to === 0) return;
      const t0 = performance.now(), dur = Math.min(900, 300 + to * 25);
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(to * e) + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = '0' + suf; requestAnimationFrame(step);
    });
  }

  // ---------- isi halaman muncul bertahap ----------
  const STAGGER = '.stack, .bento, .kpis, .opp-grid, .opp-list, .l-feat, .l-paths, .sx-chips, .kdocs, .sec-list, .photos, .chips:not(.sx-chips)';
  function stagger(root) {
    root.querySelectorAll(STAGGER).forEach((box) => {
      Array.from(box.children).slice(0, 14).forEach((c, i) => c.style.setProperty('--i', i));
    });
  }
  function afterRender(changed) {
    const app = document.getElementById('app');
    if (!app || !changed || reduce()) return;
    stagger(app);
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
    clearTimeout(afterRender.t); afterRender.t = setTimeout(() => app.classList.remove('enter'), 1100);
    countUp(app);
    reveal(app);
    window.KPapua?.scrollReveal(app);
  }

  // ---------- halaman awal: muncul saat di-scroll + paralaks ----------
  let io = null;
  function reveal(root) {
    const els = root.querySelectorAll('.l-sec, .l-end, .l-step, .l-f, .l-path');
    if (!els.length) return;
    io?.disconnect();
    io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.15 });
    els.forEach((el, i) => { el.classList.add('reveal'); el.style.setProperty('--ri', i % 4); io.observe(el); });
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking || reduce()) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const g = document.querySelector('.l-giant'); if (!g) return;
      const y = Math.min(window.scrollY, 900);
      g.style.transform = `translateY(${y * 0.35}px)`; g.style.opacity = String(Math.max(0, 1 - y / 700));
      const f = document.querySelector('.l-hero .front'); if (f) f.style.transform = `translateY(${y * -0.06}px)`;
    });
  }, { passive: true });

  window.KMotion = { afterRender, countUp };
})();
