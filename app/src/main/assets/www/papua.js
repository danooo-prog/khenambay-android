/* Khenambay · sentuhan Papua yang bergerak.
   - Burung cenderawasih (gambar SVG buatan sendiri): sayap mengepak, bulu ekor jingga-keemasan berayun.
     Terbang melintasi langit halaman awal, melintas saat bagian halaman di-scroll, dan
     sekali melintas di banner beranda sesudah login.
   - Bilah kemajuan scroll berwarna emas.
   - Kartu dan daftar yang ada di bawah layar muncul saat di-scroll. */
(function () {
  'use strict';
  let uid = 0;
  /** Burung cenderawasih menghadap kanan. tone: 'raggiana' (jingga) atau 'emas'. */
  function bird(tone = 'raggiana') {
    const id = 'cb' + (++uid);
    const plume = tone === 'emas' ? ['#FFE7A3', '#E8B64A'] : ['#F6C04A', '#E45C10'];
    return `<svg class="cbird" viewBox="0 0 220 120" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${id}p" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${plume[0]}"/><stop offset=".55" stop-color="${plume[1]}"/><stop offset="1" stop-color="${plume[1]}" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A4418"/><stop offset="1" stop-color="#4A2108"/></linearGradient></defs>
      <g class="wire" fill="none" stroke="#2A1503" stroke-width="1.5" stroke-linecap="round">
        <path d="M120 70 C98 92 72 104 50 98 C40 95 41 85 50 86 C55 87 55 92 51 93"/>
        <path d="M120 72 C102 98 84 112 64 112 C56 112 55 104 62 104"/></g>
      <g class="plume" fill="url(#${id}p)">
        <path d="M120 62 C92 54 60 36 6 42 C48 54 84 64 120 68 Z"/>
        <path d="M120 66 C86 72 54 76 12 92 C56 82 88 78 120 72 Z" opacity=".9"/>
        <path d="M120 64 C90 62 60 58 0 66 C58 70 90 70 120 70 Z" opacity=".75"/></g>
      <g class="wing2"><path d="M134 60 C124 44 114 30 100 22 C110 36 116 48 122 60 Z" fill="#3C1A06"/></g>
      <ellipse cx="134" cy="64" rx="22" ry="11" fill="#5B2A08"/>
      <path d="M148 60 Q158 74 170 60 Q160 68 148 60 Z" fill="#1F8A4C"/>
      <circle cx="158" cy="55" r="10" fill="#F2C84B"/>
      <path d="M150 50 Q158 44 167 50" fill="none" stroke="#FFE7A3" stroke-width="2" stroke-linecap="round"/>
      <circle cx="161" cy="53" r="1.7" fill="#1A1C0C"/>
      <path d="M166 54 L178 57.5 L166 60 Z" fill="#B9C3C9"/>
      <g class="wing"><path d="M142 60 C130 36 112 14 88 6 C102 24 112 42 122 58 Z" fill="url(#${id}w)" stroke="#E8C46A" stroke-width=".8" stroke-opacity=".7"/>
        <path d="M134 50 C126 36 114 24 102 18" fill="none" stroke="#E8C46A" stroke-width=".7" stroke-opacity=".5"/></g>
    </svg>`;
  }
  /** Beberapa burung terbang berulang di langit (halaman awal). */
  function flock(n = 3) {
    const conf = [{ w: 130, top: 12, dur: 22, delay: 0 }, { w: 84, top: 26, dur: 28, delay: 7 }, { w: 104, top: 6, dur: 25, delay: 15 }];
    return `<div class="l-birds" aria-hidden="true">${conf.slice(0, n).map((c, i) => `<div class="bird-fly" style="--w:${c.w}px;--top:${c.top}%;--dur:${c.dur}s;--delay:${c.delay}s">${bird(i === 1 ? 'emas' : 'raggiana')}</div>`).join('')}</div>`;
  }
  /** Burung yang melintas sekali (saat bagian terlihat atau halaman dibuka). */
  const once = (cls = 'sbird', o = {}) => `<div class="${cls}" aria-hidden="true" style="--w:${o.w || 96}px;--top:${o.top ?? 6}px;--dur:${o.dur || 4.2}s;--delay:${o.delay || .2}s;--span:${o.span || '100vw'}">${bird(o.tone)}</div>`;

  // ---------- bilah kemajuan scroll ----------
  const bar = document.createElement('div'); bar.id = 'scroll-prog'; bar.setAttribute('aria-hidden', 'true');
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(bar));
  let tick = false;
  addEventListener('scroll', () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      tick = false;
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 40 ? Math.min(1, scrollY / h) : 0})`;
    });
  }, { passive: true });

  // ---------- muncul saat di-scroll (halaman sesudah login) ----------
  let io = null;
  function scrollReveal(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    io?.disconnect();
    io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    root.querySelectorAll('.opp, .item, .kpi, .card, .bt, .geo-card, .table-wrap, .faq, .kdoc, .chk').forEach((el) => {
      if (el.closest('.land, .sheet, #cenra')) return;
      if (el.getBoundingClientRect().top > innerHeight * 0.95) { el.classList.add('sr'); io.observe(el); }
    });
  }
  window.KPapua = { bird, flock, once, scrollReveal };
})();
