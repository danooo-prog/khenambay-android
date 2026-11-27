/* Khenambay — aplikasi web pendataan potensi investasi Kabupaten Jayapura.
   Satu berkas, tanpa pustaka luar, supaya bisa disimpan utuh di perangkat dan berjalan offline.
   Bagian: utilitas · penyimpanan (IndexedDB) · jaringan & sinkron · geografi · "AI" di perangkat ·
   Cenra · tampilan pendata · tampilan investor · tampilan admin · router. */
'use strict';
(() => {
// =====================================================================
// Utilitas
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmtNum = (n, d = 1) => n == null ? '—' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: d });
function rp(n) {
  if (n == null || n === '') return '—';
  if (n >= 1e9) return 'Rp ' + fmtNum(n / 1e9) + ' M';
  if (n >= 1e6) return 'Rp ' + fmtNum(n / 1e6, 0) + ' jt';
  return 'Rp ' + fmtNum(n, 0);
}
function ago(t) {
  if (!t) return '—';
  const s = (Date.now() - (t < 1e12 ? t * 1000 : t)) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  const d = Math.floor(s / 86400);
  return d === 1 ? 'kemarin' : d + ' hari lalu';
}
const days = (t) => (Date.now() / 1000 - t) / 86400;
const dateID = (t) => new Date(t < 1e12 ? t * 1000 : t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const timeID = (t) => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const title = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());
const LS = {
  get(k, d) { try { const v = localStorage.getItem('khb.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('khb.' + k, JSON.stringify(v)); } catch { /* penyimpanan penuh atau diblokir */ } },
};

const IC = {
  idcard: 'M3 6h18v12H3zM7 10a2 2 0 1 0 4 0a2 2 0 1 0-4 0M5.5 16c.6-1.6 1.8-2.4 3.5-2.4s2.9.8 3.5 2.4M14 10h5M14 13h4',
  shield: 'M12 3l8 3.5V12c0 4.6-3.4 8.1-8 9-4.6-.9-8-4.4-8-9V6.5zM8.5 12l2.5 2.5 4.5-5',
  back: 'M15 18l-6-6 6-6', chev: 'M9 6l6 6-6 6', check: 'M5 12.5l4.5 4.5L19 7.5', plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M18 6L6 18',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  save: 'M6 3h12v18l-6-4-6 4z', home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z',
  star: 'M12 3l2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.3 9.4l6-.9z', doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  pin: 'M12 21s-7-6.2-7-11.5C5 5.4 8.1 2.5 12 2.5S19 5.4 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3', cam: 'M4 8h3l2-3h6l2 3h3v11H4zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  wifiOff: 'M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18', sync: 'M4 12a8 8 0 0 1 14.4-4.8L20 9M20 4v5h-5M20 12a8 8 0 0 1-14.4 4.8L4 15M4 20v-5h5',
  fish: 'M3 12c3-5 9-6 14-3l4-3v12l-4-3c-5 3-11 2-14-3zM15 11h.01', leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7', wave: 'M3 15c3-3 6 3 9 0s6 3 9 0M3 9c3-3 6 3 9 0s6 3 9 0',
  sprout: 'M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 12c0-4 3-7 7-7 0 4-3 7-7 7z', box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4', filter: 'M4 6h16M7 12h10M10 18h4', search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', send: 'M4 12h15M13 6l6 6-6 6', copy: 'M8 8h12v12H8zM4 16V4h12',
  wa: 'M4 20l1.3-3.8A8 8 0 1 1 7.8 18.8z', phone: 'M7 2h10v20H7zM11 18h2', edit: 'M4 20h4L18 10l-4-4L4 16zM13 7l4 4', download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
};
const ic = (n, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}><path d="${IC[n] || ''}"/></svg>`;

const SECTORS = {
  Perikanan: { c: 'var(--ikan)', hex: '#1C8AB3', ic: 'fish', en: 'Fisheries' },
  Perkebunan: { c: 'var(--kebun)', hex: '#C26A2C', ic: 'leaf', en: 'Plantation' },
  Pariwisata: { c: 'var(--wisata)', hex: '#D04A72', ic: 'wave', en: 'Tourism' },
  Pertanian: { c: 'var(--tani)', hex: '#8A9A1F', ic: 'sprout', en: 'Agriculture' },
  Lainnya: { c: 'var(--lain)', hex: '#6B7A80', ic: 'box', en: 'Other' },
};
const sec = (s) => SECTORS[s] || SECTORS.Lainnya;
const LEVELS = ['', 'Potensi', 'Terverifikasi', 'Lahan jelas', 'Ada kajian', 'Siap ditawarkan'];
const LEVELS_EN = ['', 'Potential', 'Verified', 'Land cleared', 'Study available', 'Ready to offer'];
const INFRA = ['Jalan aspal', 'Jalan tanah', 'Listrik PLN', 'Sinyal 4G', 'Sinyal SMS', 'Air bersih', 'Dermaga'];
const LAHAN = ['Aset pemda', 'Milik pribadi', 'Tanah adat'];
const MUSY = ['Belum dimulai', 'Sedang berjalan', 'Sudah disepakati'];
const SATUAN = ['ha', 'ton', 'unit', 'kamar', 'kolam', 'ekor'];
const meter = (lv) => `<div class="meter l${lv}" aria-label="Tingkat kesiapan ${lv} dari 5"><i></i><i></i><i></i><i></i><i></i></div>`;
const secIcon = (s, size = 42) => `<span class="ic" style="width:${size}px;height:${size}px;background:color-mix(in srgb, ${sec(s).c} 20%, transparent);border:1px solid color-mix(in srgb, ${sec(s).c} 40%, transparent);color:${sec(s).c}">${ic(sec(s).ic)}</span>`;
const statusBadge = (st) => {
  const m = { 'Terbit': 'b-g', 'Menunggu verifikasi': 'b-t', 'Perlu perbaikan': 'b-r', 'Antre di HP': 'b-a', 'Draf': 'b-n', 'Konflik': 'b-r' };
  return `<span class="badge ${m[st] || 'b-n'}">${esc(st)}</span>`;
};

function toast(msg, kind = 'ok', ms = 3200) {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
}

// =====================================================================
// Penyimpanan di perangkat (IndexedDB, dengan cadangan di memori)
// =====================================================================
const idb = (() => {
  let dbp = null; const mem = { mine: new Map(), outbox: new Map(), cache: new Map() }; let useMem = false;
  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        try {
          const r = indexedDB.open('khenambay', 1);
          r.onupgradeneeded = () => ['mine', 'outbox', 'cache'].forEach((s) => r.result.objectStoreNames.contains(s) || r.result.createObjectStore(s, { keyPath: 'id' }));
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
      }).catch(() => { useMem = true; return null; });
    }
    return dbp;
  }
  async function run(store, mode, fn) {
    const d = await open();
    if (useMem || !d) return fn(null, mem[store]);
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req && 'result' in req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    all: (s) => run(s, 'readonly', (st, m) => (m ? [...m.values()] : st.getAll())),
    get: (s, k) => run(s, 'readonly', (st, m) => (m ? m.get(k) : st.get(k))),
    put: (s, v) => run(s, 'readwrite', (st, m) => (m ? m.set(v.id, v) : st.put(v))),
    del: (s, k) => run(s, 'readwrite', (st, m) => (m ? m.delete(k) : st.delete(k))),
    clear: (s) => run(s, 'readwrite', (st, m) => (m ? m.clear() : st.clear())),
  };
})();

// =====================================================================
// Status aplikasi
// =====================================================================
const S = {
  role: null, online: null, potensi: [], minat: [], mine: [], outbox: [], cacheTime: LS.get('cacheTime', null),
  settings: Object.assign({ nama: 'Markus Yoku', distrik: 'Nimboran', wifiOnly: false, compress: true, suara: false }, LS.get('settings', {})),
  saved: LS.get('saved', []), myMinat: LS.get('myMinat', []), reviewed: LS.get('reviewed', []), lang: LS.get('lang', 'id'),
  f: { sektor: 'Semua', q: '', maxNilai: null, minLevel: 1, lahan: [] }, aq: 'Semua', chat: {}, ctab: 'faq', ctxOpp: null, notifSeen: LS.get('notifSeen', 0),
};
S.auth = LS.get('auth', null);
const me = () => S.auth?.user || null;
const isRole = (r) => me()?.role === r;
const initials = (n) => String(n || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const loginHref = (role, next) => `#/masuk/${role}?next=${encodeURIComponent(next || location.hash)}`;
const pub = () => S.potensi.filter((p) => p.status === 'Terbit');
const byId = (id) => S.potensi.find((p) => p.id === id);
async function loadLocal() {
  const [mine, outbox, cp, cm] = await Promise.all([idb.all('mine'), idb.all('outbox'), idb.get('cache', 'potensi'), idb.get('cache', 'minat')]);
  S.mine = (mine || []).sort((a, b) => b.updatedAt - a.updatedAt);
  S.outbox = outbox || [];
  const role = me()?.role || 'tamu';
  if (cp?.items) S.potensi = ['admin', 'pendata'].includes(role) || ['tamu', 'investor'].includes(cp.role) ? cp.items : cp.items.filter((p) => p.status === 'Terbit');
  if (cm?.items) S.minat = role === 'admin' || role === 'investor' ? cm.items : [];
  updateChrome();
}

// =====================================================================
// Jaringan & sinkronisasi
// =====================================================================
// API PHP: '/api/potensi/x?y=1' -> 'api/index.php?r=potensi/x&y=1' (jalan di XAMPP tanpa mod_rewrite, juga di subfolder)
function apiUrl(path) {
  const [p, qs] = path.replace(/^\/api\//, '').split('?');
  return 'api/index.php?r=' + p + (qs ? '&' + qs : '');
}
/** Di aplikasi Android, API dijalankan oleh server lokal di HP (local-api.js), tanpa XAMPP atau alamat server. */
const LOCAL = !!window.KLocal;
async function api(path, opts = {}) {
  if (LOCAL) {
    try { return await window.KLocal.request(path, { method: opts.method, body: opts.body, token: opts.noAuth ? '' : S.auth?.token }); }
    catch (x) {
      if (x.status === 401 && S.auth && !path.startsWith('/api/auth/')) { S.auth = null; LS.set('auth', null); setTimeout(() => { toast('Sesi berakhir. Silakan masuk lagi.', 'warn'); render(); }, 0); }
      throw x;
    }
  }
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts.timeout || 9000);
  try {
    const headers = opts.body ? { 'Content-Type': 'application/json' } : {};
    if (S.auth?.token && !opts.noAuth) { headers.Authorization = 'Bearer ' + S.auth.token; headers['X-Auth-Token'] = S.auth.token; }
    const r = await fetch(apiUrl(path), { method: opts.method || 'GET', headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(j.error || 'HTTP ' + r.status); e.status = r.status;
      if (r.status === 401 && S.auth && !path.startsWith('/api/auth/')) { S.auth = null; LS.set('auth', null); setTimeout(() => { toast('Sesi berakhir. Silakan masuk lagi.', 'warn'); render(); }, 0); }
      throw e;
    }
    return j;
  } finally { clearTimeout(t); }
}
async function checkOnline() {
  if (!navigator.onLine) return setOnline(false);
  try { await api('/api/ping', { timeout: 4000 }); setOnline(true); } catch { setOnline(false); }
}
function setOnline(v) {
  const was = S.online; S.online = v; updateChrome();
  if (v && was !== true) sync();
}
let syncing = false;
async function sync(manual = false) {
  if (syncing) return;
  if (!S.online) { if (manual) toast('Belum ada sinyal. Data tetap aman di perangkat dan dikirim otomatis nanti.', 'warn'); return; }
  const conn = navigator.connection;
  if (S.settings.wifiOnly && !manual && conn && conn.type && !['wifi', 'ethernet'].includes(conn.type)) return;
  syncing = true; $('#btn-sync')?.classList.add('spin');
  let sent = 0, minatSent = 0;
  try {
    const ob = await idb.all('outbox');
    const pot = isRole('pendata') ? ob.filter((o) => o.kind === 'potensi') : [];
    if (pot.length) {
      const res = await api('/api/sync', { method: 'POST', timeout: 60000,
        body: { items: pot.map((o) => ({ id: o.id, data: o.data, photos: o.photos, baseVersion: o.baseVersion, force: !!o.force })) } });
      for (const r of res.results) {
        const m = await idb.get('mine', r.id);
        if (r.ok) {
          await idb.del('outbox', r.id); sent++;
          if (m) Object.assign(m, { state: 'terkirim', version: r.version, sentAt: Date.now(), conflict: null, server: { status: r.status, level: 1 } }), await idb.put('mine', m);
        } else if (r.conflict) {
          await idb.del('outbox', r.id);
          if (m) { m.conflict = r.server; m.state = 'konflik'; await idb.put('mine', m); }
        }
      }
    }
    for (const o of isRole('investor') ? ob.filter((x) => x.kind === 'minat') : []) {
      try {
        const r = await api('/api/minat', { method: 'POST', body: o.payload });
        await idb.del('outbox', o.id); minatSent++;
        S.myMinat = S.myMinat.map((x) => (x.id === o.id ? { ...x, kode: r.kode, sent: true } : x)); LS.set('myMinat', S.myMinat);
      } catch (e) { if (!e.status) throw e; if (e.status === 401 || e.status === 403) break; await idb.del('outbox', o.id); }
    }
    for (const o of isRole('admin') ? ob.filter((x) => x.kind === 'admin').sort((a, b) => a.t - b.t) : []) {
      try { await api(o.path, { method: 'POST', body: o.body }); await idb.del('outbox', o.id); } catch (e) { if (!e.status) throw e; if (e.status === 401 || e.status === 403) break; await idb.del('outbox', o.id); }
    }
    await refresh();
    if (sent) { toast(`${sent} data potensi terkirim ke DPMPTSP`, 'ok'); pushNotif('sinkron', `${sent} data terkirim saat sinyal kembali`); }
    if (minatSent) toast('Pengajuan minat terkirim ke DPMPTSP', 'ok');
  } catch (e) {
    if (manual) toast('Koneksi terputus saat sinkron. Dicoba lagi otomatis.', 'warn');
    setOnline(false);
  } finally {
    syncing = false; $('#btn-sync')?.classList.remove('spin');
    await loadLocal(); rerenderLive();
  }
}
async function refresh() {
  const p = await api('/api/potensi');
  const m = isRole('admin') ? await api('/api/minat') : isRole('investor') ? await api('/api/minat/saya') : { items: [] };
  S.potensi = p.items || []; S.minat = m.items || []; S.cacheTime = Date.now(); LS.set('cacheTime', S.cacheTime);
  if (isRole('investor')) loadKyc();
  if (MAP) MAP.inst.update(mapData(MAP.mode));
  await idb.put('cache', { id: 'potensi', items: p.items, role: p.role }); await idb.put('cache', { id: 'minat', items: m.items });
  for (const m2 of await idb.all('mine')) {
    const srv = p.items.find((x) => x.id === m2.id);
    if (srv && m2.state !== 'antre' && m2.state !== 'konflik') { m2.server = { status: srv.status, level: srv.level, catatan: srv.catatan, version: srv.version }; m2.version = srv.version; await idb.put('mine', m2); }
  }
}
// Aksi admin: langsung ke server bila online, masuk antrean bila offline. Cache lokal ikut diperbarui.
async function adminAction(path, body, localUpdate) {
  localUpdate?.();
  await idb.put('cache', { id: 'potensi', items: S.potensi });
  if (S.online) {
    try { await api(path, { method: 'POST', body }); return true; } catch (e) { if (e.status) { toast(e.message, 'warn'); return false; } }
  }
  await idb.put('outbox', { id: uid(), kind: 'admin', path, body, t: Date.now() });
  await loadLocal();
  toast('Offline: perubahan disimpan dan dikirim otomatis nanti', 'warn');
  return true;
}
function pushNotif(kind, text) {
  const n = LS.get('notifs', []); n.unshift({ kind, text, t: Date.now() }); LS.set('notifs', n.slice(0, 20));
}

// =====================================================================
// Geografi Kabupaten Jayapura (perkiraan untuk peta skematis dan pengecekan)
// =====================================================================
const DISTRIK = [
  ['Sentani', -2.565, 140.51], ['Sentani Timur', -2.60, 140.60], ['Sentani Barat', -2.56, 140.38], ['Waibu', -2.60, 140.40],
  ['Ebungfauw', -2.655, 140.45], ['Depapre', -2.48, 140.37], ['Ravenirara', -2.45, 140.47], ['Demta', -2.38, 140.13],
  ['Yokari', -2.36, 139.95], ['Kemtuk', -2.62, 140.27], ['Kemtuk Gresi', -2.71, 140.22], ['Gresi Selatan', -2.85, 140.24],
  ['Nimboran', -2.64, 140.16], ['Nimbokrang', -2.70, 139.98], ['Namblong', -2.61, 140.07], ['Unurum Guay', -2.92, 139.72],
  ['Kaureh', -3.05, 139.82], ['Airu', -3.10, 140.06], ['Yapsi', -2.96, 139.95],
];
const BOX = { w: 139.55, e: 140.80, n: -2.25, s: -3.22 };
const COAST = [[139.55, -2.32], [139.75, -2.33], [139.95, -2.335], [140.10, -2.35], [140.22, -2.40], [140.28, -2.43], [140.33, -2.44],
  [140.36, -2.46], [140.39, -2.475], [140.41, -2.46], [140.43, -2.42], [140.50, -2.45], [140.60, -2.50], [140.70, -2.52], [140.80, -2.53]];
function coastLat(lon) {
  for (let i = 0; i < COAST.length - 1; i++) {
    const [x1, y1] = COAST[i], [x2, y2] = COAST[i + 1];
    if (lon >= x1 && lon <= x2) return y1 + (y2 - y1) * (lon - x1) / (x2 - x1);
  }
  return lon < COAST[0][0] ? COAST[0][1] : COAST[COAST.length - 1][1];
}
const inBox = (lat, lon) => lon >= BOX.w && lon <= BOX.e && lat <= BOX.n && lat >= BOX.s;
const isSea = (lat, lon) => lat > coastLat(lon);
function dist(a1, o1, a2, o2) {
  const R = 6371000, r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function nearestDistrik(lat, lon) {
  let best = null, bd = Infinity;
  for (const [n, a, o] of DISTRIK) { const d = dist(lat, lon, a, o); if (d < bd) { bd = d; best = n; } }
  return { nama: best, jarak: bd };
}
function proj(lat, lon, W, H) { return [((lon - BOX.w) / (BOX.e - BOX.w)) * W, ((lat - BOX.n) / (BOX.s - BOX.n)) * H]; }
function baseMapSVG(W, H, extra = '', opts = {}) {
  const pts = COAST.map(([o, a]) => proj(a, o, W, H).map((v) => v.toFixed(1)).join(','));
  const land = `M${proj(-2.32, BOX.w, W, H)[0]},${H} L${pts.join(' L')} L${W},${H} Z`;
  const [lx, ly] = proj(-2.618, 140.50, W, H);
  const lrx = (0.12 / (BOX.e - BOX.w)) * W, lry = (0.022 / (BOX.s - BOX.n)) * -H;
  const labels = opts.labels === false ? '' : DISTRIK.map(([n, a, o]) => { const [x, y] = proj(a, o, W, H); return `<text x="${x.toFixed(0)}" y="${(y + 22).toFixed(0)}" text-anchor="middle" font-size="${opts.fs || 10}" font-weight="700" fill="#5A6B6E" letter-spacing=".5">${esc(n.toUpperCase())}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Peta skematis Kabupaten Jayapura" ${opts.attr || ''}>
    <rect width="${W}" height="${H}" fill="#CFE7EC"/>
    <path d="${land}" fill="#E4EEDC"/>
    <path d="M0 ${H * 0.62} C ${W * 0.3} ${H * 0.56} ${W * 0.5} ${H * 0.7} ${W} ${H * 0.6} L${W} ${H} L0 ${H}Z" fill="#D7E6CB"/>
    <path d="M0 ${H * 0.82} C ${W * 0.35} ${H * 0.76} ${W * 0.6} ${H * 0.9} ${W} ${H * 0.8} L${W} ${H} L0 ${H}Z" fill="#C9DDBA"/>
    <ellipse cx="${lx}" cy="${ly}" rx="${lrx}" ry="${Math.abs(lry)}" fill="#9ECFDA"/>
    <text x="${W * 0.42}" y="${H * 0.06}" font-size="${(opts.fs || 10) + 2}" fill="#2D6E7A" font-style="italic">Samudra Pasifik</text>
    <text x="${lx}" y="${ly + Math.abs(lry) + 14}" text-anchor="middle" font-size="${opts.fs || 10}" fill="#2D6E7A" font-style="italic">Danau Sentani</text>
    ${labels}${extra}</svg>`;
}

// =====================================================================
// "AI" di perangkat: memahami cerita petugas, ringkasan, pengecekan, ekstraksi dokumen
// (berbasis aturan bahasa sehingga tetap jalan tanpa internet)
// =====================================================================
const KOMODITAS = [
  ['kakao', 'Kakao', 'Perkebunan'], ['coklat', 'Kakao', 'Perkebunan'], ['kopi', 'Kopi', 'Perkebunan'], ['pinang', 'Pinang', 'Perkebunan'], ['kelapa', 'Kelapa', 'Perkebunan'],
  ['vanili', 'Vanili', 'Perkebunan'], ['sawit', 'Kelapa Sawit', 'Perkebunan'], ['sagu', 'Sagu', 'Pertanian'], ['padi', 'Padi', 'Pertanian'], ['jagung', 'Jagung', 'Pertanian'],
  ['sayur', 'Sayuran', 'Pertanian'], ['madu', 'Madu Hutan', 'Pertanian'], ['nila', 'Ikan Nila', 'Perikanan'], ['lele', 'Ikan Lele', 'Perikanan'], ['rumput laut', 'Rumput Laut', 'Perikanan'],
  ['udang', 'Udang', 'Perikanan'], ['ikan', 'Ikan', 'Perikanan'], ['keramba', 'Keramba Ikan', 'Perikanan'], ['homestay', 'Homestay', 'Pariwisata'], ['pantai', 'Pantai', 'Pariwisata'],
  ['air terjun', 'Air Terjun', 'Pariwisata'], ['cottage', 'Cottage', 'Pariwisata'], ['wisata', 'Wisata Alam', 'Pariwisata'], ['danau', 'Wisata Danau', 'Pariwisata'],
];
function parseStory(text) {
  const s = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const out = {}; const found = [];
  const kom = KOMODITAS.find(([k]) => s.includes(k));
  if (kom) { out.sektor = kom[2]; found.push('sektor'); }
  const kp = s.match(/kampung\s+([a-z]+(?:\s(?!dengan|yang|di|ada|sudah|luas|sekitar|seluas)[a-z]+)?)/);
  if (kp) { out.kampung = title(kp[1]); found.push('kampung'); }
  if (kom) {
    const k = kom[1], kpg = out.kampung ? ' ' + out.kampung : '';
    out.nama = { Perkebunan: `Kebun ${k} Rakyat${kpg}`, Pertanian: `Sentra ${k}${kpg}`, Perikanan: `Budidaya ${k}${kpg}`, Pariwisata: `Wisata ${k}${kpg}` }[kom[2]] || `${k}${kpg}`;
    if (/homestay|cottage/.test(kom[0])) out.nama = `${k}${kpg}`;
    found.push('nama');
  }
  const n = '(\\d+(?:[.,]\\d+)?)';
  let m;
  if ((m = s.match(new RegExp(n + '\\s*(hektar|hektare|ha)\\b')))) { out.luas = num(m[1]); out.satuan = 'ha'; found.push('luas'); }
  else if ((m = s.match(new RegExp(n + '\\s*(kamar|kolam|unit|ekor)\\b')))) { out.luas = num(m[1]); out.satuan = m[2]; found.push('luas'); }
  if ((m = s.match(new RegExp(n + '\\s*ton')))) { out.produksi = `${fmtNum(num(m[1]))} ton/tahun`; found.push('produksi'); }
  if ((m = s.match(new RegExp(n + '\\s*(miliar|milyar|m)\\b')))) { out.nilai = Math.round(num(m[1]) * 1e9); found.push('nilai'); }
  else if ((m = s.match(new RegExp(n + '\\s*juta')))) { out.nilai = Math.round(num(m[1]) * 1e6); found.push('nilai'); }
  const infra = [];
  if (/aspal/.test(s)) infra.push('Jalan aspal');
  if (/jalan (tanah|setapak|batu)|belum diaspal/.test(s)) infra.push('Jalan tanah');
  if (/listrik|pln/.test(s)) infra.push('Listrik PLN');
  if (/4g|internet|sinyal bagus/.test(s)) infra.push('Sinyal 4G'); else if (/sms|sinyal lemah|sinyal susah/.test(s)) infra.push('Sinyal SMS');
  if (/air bersih|sumur|pdam/.test(s)) infra.push('Air bersih');
  if (/dermaga|pelabuhan/.test(s)) infra.push('Dermaga');
  if (infra.length) { out.infra = infra; found.push('infrastruktur'); }
  if (/tanah adat|hak ulayat|ondoafi|kepala suku|marga/.test(s)) out.lahan = 'Tanah adat';
  else if (/milik pribadi|punya pribadi|bersertifikat|sertifikat/.test(s)) out.lahan = 'Milik pribadi';
  else if (/pemda|pemerintah|aset daerah/.test(s)) out.lahan = 'Aset pemda';
  if (out.lahan) found.push('status lahan');
  if ((m = s.match(/(ondoafi|kepala suku)\s+([a-z]+)/))) { out.adat = title(m[1] + ' ' + m[2]); found.push('pihak adat'); }
  if (/sudah sepakat|sudah setuju|disepakati/.test(s)) out.musyawarah = 'Sudah disepakati';
  else if (/musyawarah|rapat adat|sedang dibicarakan/.test(s)) out.musyawarah = 'Sedang berjalan';
  if ((m = s.match(/(kepala kampung|koperasi [a-z]+(?: [a-z]+)?|kelompok [a-z]+(?: [a-z]+)?|pokdarwis [a-z]+)/))) { out.kontak = title(m[1]); found.push('narahubung'); }
  return { out, found };
}
function ringkas(d, lang = 'id') {
  const s = sec(d.sektor);
  if (lang === 'en') {
    const lahan = { 'Aset pemda': 'a local-government asset', 'Milik pribadi': 'privately owned', 'Tanah adat': 'customary (adat) land' }[d.lahan] || 'not yet recorded';
    const mus = { 'Belum dimulai': 'not yet started', 'Sedang berjalan': 'in progress', 'Sudah disepakati': 'agreed' }[d.musyawarah];
    return `${s.en} opportunity "${d.nama}" in ${d.kampung ? d.kampung + ' village, ' : ''}${d.distrik || 'Jayapura Regency'} district` +
      `${d.luas ? `, ${fmtNum(d.luas)} ${d.satuan}` : ''}${d.produksi ? `, producing about ${d.produksi.replace('ton/tahun', 'tonnes/year')}` : ''}. ` +
      `${(d.infra || []).length ? 'Infrastructure: ' + d.infra.map((x) => ({ 'Jalan aspal': 'paved road', 'Jalan tanah': 'dirt road', 'Listrik PLN': 'grid electricity', 'Sinyal 4G': '4G signal', 'Sinyal SMS': 'SMS-only signal', 'Air bersih': 'clean water', 'Dermaga': 'jetty' }[x] || x)).join(', ') + '. ' : ''}` +
      `Land is ${lahan}${d.lahan === 'Tanah adat' && mus ? `, customary consultation ${mus}` : ''}.${d.nilai ? ` Estimated investment ${rp(d.nilai).replace(' M', ' billion')}.` : ''}${d.lokasiFoto ? ` Photo location: ${d.lokasiFoto}.` : ''}`;
  }
  return `${d.nama} di ${d.kampung ? 'Kampung ' + d.kampung + ', ' : ''}Distrik ${d.distrik || '—'}` +
    `${d.luas ? `, ${fmtNum(d.luas)} ${d.satuan}` : ''}${d.produksi ? `, produksi sekitar ${d.produksi}` : ''}. ` +
    `${(d.infra || []).length ? 'Infrastruktur: ' + d.infra.join(', ').toLowerCase() + '. ' : ''}` +
    `${d.lahan === 'Tanah adat' ? `Lahan adat${d.adat ? ' (' + d.adat + ')' : ''}${d.musyawarah ? ', musyawarah ' + d.musyawarah.toLowerCase() : ''}.` : d.lahan ? `Status lahan ${d.lahan.toLowerCase()}.` : ''}` +
    `${d.nilai ? ` Estimasi nilai investasi ${rp(d.nilai)}.` : ''}` +
    `${d.lokasiFoto ? ` Lokasi foto: ${d.lokasiFoto}.` : ''}`;
}
function tokens(s) { return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['dan', 'yang', 'rakyat', 'kampung', 'distrik'].includes(w)); }
function nameSim(a, b) { const A = new Set(tokens(a)), B = new Set(tokens(b)); if (!A.size || !B.size) return 0; let i = 0; A.forEach((w) => B.has(w) && i++); return i / Math.min(A.size, B.size); }
function findDuplicates(d, selfId) {
  if (d.lat == null) return [];
  return S.potensi.filter((p) => p.id !== selfId && p.status !== 'Perlu perbaikan').map((p) => {
    const m = dist(d.lat, d.lon, p.data.lat, p.data.lon); const sim = nameSim(d.nama, p.data.nama);
    const same = p.data.sektor === d.sektor;
    const score = Math.round(clamp((m < 300 ? 60 : m < 1500 ? 30 : 0) + sim * 30 + (same ? 10 : 0), 0, 99));
    return { p, m, score };
  }).filter((x) => x.score >= 60).sort((a, b) => b.score - a.score);
}
const WAJAR = { ha: 5000, ton: 100000, unit: 1000, kamar: 400, kolam: 2000, ekor: 100000 };
function aiChecks(item) {
  const d = item.data; const out = [];
  const dup = findDuplicates(d, item.id)[0];
  out.push(dup ? { ok: false, key: 'dup', t: 'Kemungkinan data ganda', d: `Mirip ${dup.score}% dengan "${dup.p.data.nama}", ${fmtNum(dup.m, 0)} m dari lokasi` }
    : { ok: true, key: 'dup', t: 'Tidak ada data ganda', d: 'Tidak ada data serupa dalam radius 300 m' });
  if (d.lat == null) out.push({ ok: false, key: 'loc', t: 'Koordinat belum ada', d: 'Lokasi belum dikunci GPS' });
  else if (!inBox(d.lat, d.lon)) out.push({ ok: false, key: 'loc', t: 'Di luar Kabupaten Jayapura', d: `${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}` });
  else if (isSea(d.lat, d.lon)) out.push({ ok: false, key: 'sea', t: 'Koordinat berada di laut', d: `Sekitar ${fmtNum((d.lat - coastLat(d.lon)) * 111000, 0)} m dari garis pantai` });
  else out.push({ ok: true, key: 'loc', t: 'Lokasi di daratan', d: `GPS ±${d.akurasi ?? '?'} m${(d.akurasi ?? 99) > 10 ? ' (akurasi kurang)' : ''}` });
  if (d.lat != null) {
    const nd = nearestDistrik(d.lat, d.lon);
    out.push(nd.nama === d.distrik || nd.jarak < 12000 ? { ok: true, key: 'wil', t: 'Wilayah sesuai', d: `Titik berada di sekitar Distrik ${nd.nama}` }
      : { ok: false, key: 'wil', t: 'Wilayah tidak cocok', d: `Tercatat ${d.distrik}, titik lebih dekat ke ${nd.nama}` });
  }
  const lim = WAJAR[d.satuan];
  out.push(lim && d.luas > lim ? { ok: false, key: 'num', t: 'Angka tidak wajar', d: `${fmtNum(d.luas)} ${d.satuan} jauh di atas umumnya (maks. ±${fmtNum(lim)} ${d.satuan})` }
    : { ok: true, key: 'num', t: 'Angka wajar', d: d.luas ? `${fmtNum(d.luas)} ${d.satuan} sesuai kisaran umum` : 'Luas/kapasitas belum diisi' });
  const nf = (item.photoCount || 0) + (d.fotoContoh || 0);
  out.push(nf ? { ok: true, key: 'foto', t: 'Foto dari kamera', d: `${nf} foto bercap koordinat dan waktu` } : { ok: false, key: 'foto', t: 'Foto belum ada', d: 'Belum ada bukti foto lapangan' });
  return out;
}
function suggestLevel(item, checks = aiChecks(item)) {
  const d = item.data; if (checks.some((c) => !c.ok)) return 1;
  let lv = 2;
  if (d.lahan === 'Aset pemda' || d.lahan === 'Milik pribadi' || (d.lahan === 'Tanah adat' && d.musyawarah === 'Sudah disepakati')) lv = 3;
  if (lv === 3 && d.irr && d.payback) lv = 4;
  return Math.max(lv, item.level === 5 ? 5 : 0);
}
async function pdfText(buf) {
  const bytes = new Uint8Array(buf); let raw = '';
  for (let i = 0; i < bytes.length; i += 0x8000) raw += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const parts = []; const re = /stream\r?\n/g; let m;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length; const end = raw.indexOf('endstream', start); if (end < 0) break;
    const dict = raw.slice(Math.max(0, m.index - 300), m.index);
    let chunk = bytes.subarray(start, end);
    if (/FlateDecode/.test(dict.slice(dict.lastIndexOf('<<')))) {
      try { chunk = new Uint8Array(await new Response(new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()); } catch { continue; }
    }
    let s = ''; for (let i = 0; i < chunk.length; i += 0x8000) s += String.fromCharCode.apply(null, chunk.subarray(i, i + 0x8000));
    if (!/T[Jj]/.test(s)) continue;
    const unesc = (t) => t.replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '', t: ' ', b: '', f: '' }[c] ?? c)).replace(/\\(\d{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
    s.replace(/(\[(?:[^\]\\]|\\.)*\]\s*TJ|\((?:[^)\\]|\\.)*\)\s*Tj|T\*|Td|TD|ET)/g, (tok) => {
      if (/^(T\*|Td|TD|ET)$/.test(tok)) parts.push('\n');
      else if (tok.endsWith('TJ')) parts.push((tok.match(/\((?:[^)\\]|\\.)*\)/g) || []).map((x) => unesc(x.slice(1, -1))).join(''));
      else parts.push(unesc(tok.slice(1, tok.lastIndexOf(')'))));
      return tok;
    });
  }
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}
function extractDoc(text) {
  const F = []; const add = (key, label, value, re, conf) => { const m = text.match(re); if (m) F.push({ key, label, value: value(m), match: m[0], conf }); };
  const money = (v, unit) => { const n = num(v); if (n == null) return null; return /juta/i.test(unit || '') ? n * 1e6 : /mil|^m$/i.test(unit || '') || n < 1000 ? n * 1e9 : n; };
  add('nilai', 'Nilai investasi', (m) => money(m[2], m[3]), /(?:total|kebutuhan|nilai)\s+investasi[^\d]{0,40}?([Rr]p\.?\s*)?([\d.,]+)\s*(miliar|milyar|juta|M)?/i, 98);
  add('irr', 'IRR', (m) => num(m[1]), /IRR[^\d]{0,30}([\d.,]+)\s*%/i, 95);
  add('payback', 'Balik modal', (m) => num(m[2]), /(payback(?:\s*period)?|balik modal|pengembalian modal)[^\d]{0,30}([\d.,]+)\s*tahun/i, 93);
  add('produksi', 'Kapasitas', (m) => `${m[2]} ${m[3].toLowerCase()}${m[4] ? '/tahun' : ''}`, /(kapasitas(?:\s+produksi)?|produksi)[^\d]{0,30}([\d.,]+)\s*(ton|kg|kamar|unit)(\s*(?:per|\/)\s*tahun)?/i, 91);
  add('lahan', 'Status lahan', (m) => title(m[1].trim()), /status lahan[:\s]+([^.,\n]{4,60})/i, 88);
  add('lokasi', 'Lokasi', (m) => `Kampung ${title(m[1])}, Distrik ${title(m[2])}`, /kampung\s+([a-z]+)[^.\n]{0,20}?distrik\s+([a-z]+(?:\s[a-z]+)?)/i, 99);
  const tm = text.match(/(?:kajian|studi)\s+kelayakan(?:\s+usaha)?\s*\n+\s*([^\n]{6,80})/i);
  return { fields: F.filter((f) => f.value != null && f.value !== ''), judul: tm ? tm[1].trim() : '' };
}
const CONTOH_DOK = `KAJIAN KELAYAKAN USAHA
Keramba Jaring Apung Ikan Nila Asei
Kampung Asei, Distrik Sentani Timur, Kabupaten Jayapura

BAB 1. PENDAHULUAN
Danau Sentani memiliki potensi budidaya ikan air tawar yang besar. Kelompok pembudidaya ikan Asei telah mengelola 60 unit keramba secara tradisional.

BAB 3. ASPEK TEKNIS
Rencana pengembangan mencakup 120 unit keramba baru, gudang pakan, dan unit pendingin. Kapasitas produksi 120 ton per tahun ikan nila segar.
Status lahan: milik pribadi bersertifikat atas nama kelompok, untuk fasilitas darat seluas 0,8 ha.

BAB 5. ANALISIS KEUANGAN
Total kebutuhan investasi sebesar Rp 6,5 miliar, terdiri atas keramba, gudang, dan modal kerja tahun pertama.
Dengan harga jual rata-rata Rp 38.000/kg, proyek menghasilkan IRR sebesar 16,8% per tahun.
Payback period diperkirakan 5 tahun sejak produksi pertama.

BAB 6. KESIMPULAN
Usaha layak dijalankan dengan kemitraan antara investor dan kelompok pembudidaya ikan Asei.`;

// =====================================================================
// Cenra — asisten AI
// =====================================================================
const CENRA_IMG = { menyapa: 'icons/cenra/cenra_menyapa.png', berpikir: 'icons/cenra/cenra_berpikir.png', senang: 'icons/cenra/cenra_senang.png' };
const cenraTip = (text, key = 'senang', dark = false) => `<div class="cenra-tip${dark ? ' dark' : ''}"><span class="avatar"><img src="${CENRA_IMG[key]}" alt=""></span><div><b>Cenra</b><p>${text}</p></div></div>`;
const FAQ = {
  pendata: [
    ['Bagaimana kalau tidak ada sinyal?', 'Tetap isi seperti biasa. Data disimpan di HP dan dikirim otomatis begitu ada sinyal. Jumlahnya terlihat di kartu "Antre di HP".'],
    ['Kenapa lokasi harus dikunci GPS?', 'Supaya titik potensi benar-benar di lokasi. Cenra menunggu akurasi di bawah 10 m, lalu mengecek apakah sudah ada data serupa di sekitarnya.'],
    ['Bagaimana mencatat tanah adat?', 'Pilih "Tanah adat", isi nama ondoafi atau pemilik hak ulayat, lalu tandai tahap musyawarah. Investor melihat statusnya, jadi tidak ada janji lahan sebelum adat setuju.'],
    ['Kenapa foto harus dari kamera langsung?', 'Foto dari kamera diberi cap koordinat dan waktu otomatis. Ini jadi bukti lapangan dan mencegah foto lama atau foto dari internet.'],
    ['Kapan data saya diverifikasi?', 'Biasanya 1–3 hari kerja setelah terkirim. Kakak dapat notifikasi saat data terbit atau perlu perbaikan.'],
  ],
  investor: [
    ['Apa arti tingkat kesiapan 1–5?', 'Level 1 berarti potensi baru tercatat. Level 5 berarti siap ditawarkan: lahan jelas, ada kajian, dan sudah diverifikasi DPMPTSP. Angka finansial hanya tampil di level 4–5.'],
    ['Apakah saya perlu membuat akun?', 'Untuk melihat-lihat peta dan daftar peluang tidak perlu. Bertanya ke Cenra juga bebas tanpa akun. Untuk menyimpan peluang, melihat IRR dan balik modal, dan mengajukan minat, Anda perlu masuk. Daftarnya gratis.'],
    ['Apakah data ini resmi dari DPMPTSP?', 'Ya. Yang tampil hanya data yang sudah diverifikasi petugas DPMPTSP Kabupaten Jayapura, lengkap dengan tanggal pembaruan terakhir.'],
    ['Bagaimana cara mengajukan minat?', 'Buka detail peluang, ketuk "Ajukan minat", lalu isi kontak dan rencana investasi. DPMPTSP menghubungi Anda paling lambat 2 hari kerja.'],
    ['Can I ask in English?', 'Yes! Simply type in English. Cenra answers in English using the same verified data.'],
  ],
  admin: [
    ['Bagaimana AI menandai data duplikat?', 'Cenra membandingkan titik GPS (radius 300 m), sektor, dan kemiripan nama potensi. Jika mirip, data diberi tanda dan tidak langsung terbit.'],
    ['Bagaimana menentukan tingkat kesiapan?', 'Level naik sesuai bukti: 2 terverifikasi, 3 lahan jelas, 4 ada kajian, 5 siap ditawarkan. Cenra menyarankan level dari data dan dokumen, keputusan akhir di verifikator.'],
    ['Bisakah data diekspor ke Excel?', 'Bisa. Di halaman Antrean verifikasi, klik "Ekspor CSV". Berkasnya bisa dibuka di Excel atau Google Sheets.'],
    ['Siapa yang bisa melihat data belum terverifikasi?', 'Hanya admin dan verifikator DPMPTSP. Investor dan publik hanya melihat data yang sudah terbit.'],
  ],
};
const GREET = {
  pendata: () => `Halo, Kak ${esc((me()?.nama || S.settings.nama).split(' ')[0])}! Ada yang bisa Cenra bantu soal pendataan hari ini?`,
  investor: () => (S.lang === 'en' ? 'Hello! I am Cenra. Looking for an investment opportunity in Jayapura Regency?' : 'Halo! Saya Cenra. Mau cari peluang investasi atau tanya soal Khenambay?'),
  admin: () => `Selamat datang! Ada ${S.potensi.filter((p) => p.status === 'Menunggu verifikasi').length} data menunggu verifikasi. Mau Cenra bantu?`,
};
const QUICK = {
  pendata: ['Cek data antre', 'Distrik paling sedikit data', 'Cara isi lewat suara'],
  investor: () => (S.lang === 'en' ? ['Fishery deals under Rp 20 B', 'Ready-to-offer projects', 'What permits do I need?'] : ['Perikanan di bawah Rp 20 M', 'Peluang level 5', 'Izin apa saja yang dibutuhkan?']),
  admin: ['Ringkas antrean hari ini', 'Distrik paling sedikit data', 'Buat draf pesan untuk investor terbaru'],
};
const IZIN = {
  Perikanan: ['NIB melalui OSS', 'PKKPR (kesesuaian tata ruang)', 'Persetujuan lingkungan (UKL-UPL)', 'Sertifikat standar usaha perikanan'],
  Pariwisata: ['NIB melalui OSS', 'PKKPR', 'Persetujuan lingkungan', 'Sertifikat standar usaha pariwisata (TDUP)'],
  Perkebunan: ['NIB melalui OSS', 'PKKPR', 'Persetujuan lingkungan (UKL-UPL atau AMDAL)', 'IUP-B bila kebun di atas 25 ha'],
  Pertanian: ['NIB melalui OSS', 'PKKPR', 'Persetujuan lingkungan (UKL-UPL)', 'Sertifikat standar usaha pertanian'],
};
const IZIN_EN = { 'NIB melalui OSS': 'Business ID (NIB) via OSS', 'PKKPR (kesesuaian tata ruang)': 'PKKPR (spatial-use conformity)', 'PKKPR': 'PKKPR (spatial-use conformity)',
  'Persetujuan lingkungan (UKL-UPL)': 'Environmental approval (UKL-UPL)', 'Persetujuan lingkungan': 'Environmental approval', 'Persetujuan lingkungan (UKL-UPL atau AMDAL)': 'Environmental approval (UKL-UPL or AMDAL)',
  'Sertifikat standar usaha perikanan': 'Fisheries business standard certificate', 'Sertifikat standar usaha pariwisata (TDUP)': 'Tourism business standard certificate (TDUP)',
  'IUP-B bila kebun di atas 25 ha': 'Plantation permit (IUP-B) above 25 ha', 'Sertifikat standar usaha pertanian': 'Agriculture business standard certificate' };

function miniOpp(p) {
  return `<button type="button" class="mini-opp" data-go="#/investor/p/${esc(p.id)}"><span class="secdot" style="background:${sec(p.data.sektor).c}"></span>
    <span class="grow"><b>${esc(p.data.nama)}</b><br><span class="muted xs">${esc(p.data.distrik)} · ${rp(p.data.nilai)} · Level ${p.level}</span></span>${ic('chev')}</button>`;
}
function cenraAnswer(role, q) {
  const s = q.toLowerCase();
  const en = /\b(what|how|which|where|when|permit|invest(ment)?|opportunit|fish(ery|eries)?|english|land|can i|is there|ready|under|below|show|tourism|plantation)\b/.test(s);
  const src = (lang) => `<span class="src">${lang === 'en' ? 'Source' : 'Sumber'}: ${lang === 'en' ? 'DPMPTSP verified data' : 'data terverifikasi DPMPTSP'}${S.cacheTime ? ', ' + dateID(S.cacheTime) : ''}${S.online ? '' : (lang === 'en' ? ' (offline copy)' : ' (salinan offline)')}</span>`;
  const faqHit = (FAQ[role] || []).find(([qq]) => tokens(qq).filter((w) => s.includes(w)).length >= 2);
  if (role === 'investor') {
    const L = en ? 'en' : 'id';
    if (/izin|perizinan|permit|licen/.test(s)) {
      const ctx = S.ctxOpp && byId(S.ctxOpp); const sk = ctx?.data.sektor || Object.keys(IZIN).find((k) => s.includes(k.toLowerCase()) || s.includes(sec(k).en.toLowerCase())) || 'Perikanan';
      const list = IZIN[sk] || IZIN.Perikanan;
      return `<p>${en ? `For a ${sec(sk).en.toLowerCase()} business${ctx ? ` such as ${esc(ctx.data.nama)}` : ''}, the usual permits are:` : `Untuk usaha ${sk.toLowerCase()}${ctx ? ` seperti ${esc(ctx.data.nama)}` : ''}, izin yang biasanya dibutuhkan:`}</p>
        <ol>${list.map((x) => `<li>${esc(en ? IZIN_EN[x] || x : x)}</li>`).join('')}</ol>
        ${ctx && ctx.data.lahan === 'Tanah adat' ? `<p>${en ? 'The land is customary (adat) land, so consultation with the ondoafi is required.' : 'Lahannya tanah adat, jadi perlu musyawarah dengan ondoafi.'}</p>` : ''}
        <p class="xs muted">${en ? 'Initial list, confirmed by DPMPTSP licensing officers.' : 'Daftar awal, dipastikan oleh petugas perizinan DPMPTSP.'}</p>${src(L)}`;
    }
    if (/bandingkan|compare/.test(s)) {
      const list = S.saved.map(byId).filter(Boolean);
      if (!isRole('investor')) return `<p>${en ? 'Comparing saved opportunities needs an investor account. Sign in (free), save two or more, then ask me again.' : 'Membandingkan peluang tersimpan perlu akun investor. Masuk dulu (gratis), simpan dua peluang atau lebih, lalu tanya Cenra lagi.'}</p><p><a class="btn sm" href="${loginHref('investor', location.hash)}">${en ? 'Sign in' : 'Masuk'}</a></p>`;
      if (list.length < 2) return `<p>${en ? 'Save at least two opportunities first, then I can compare them.' : 'Simpan minimal dua peluang dulu, nanti Cenra bandingkan.'}</p>`;
      return `<p>${en ? 'Comparison of your saved opportunities:' : 'Perbandingan peluang yang Anda simpan:'}</p><div class="table-wrap"><table class="table"><tr><th></th>${list.map((p) => `<th>${esc(p.data.nama)}</th>`).join('')}</tr>
        <tr><td>${en ? 'Value' : 'Nilai'}</td>${list.map((p) => `<td>${rp(p.data.nilai)}</td>`).join('')}</tr><tr><td>Level</td>${list.map((p) => `<td>${p.level}</td>`).join('')}</tr>
        <tr><td>IRR</td>${list.map((p) => `<td>${p.level >= 4 && p.data.irr ? fmtNum(p.data.irr) + '%' : '—'}</td>`).join('')}</tr><tr><td>${en ? 'Land' : 'Lahan'}</td>${list.map((p) => `<td>${esc(p.data.lahan)}</td>`).join('')}</tr></table></div>${src(L)}`;
    }
    if (faqHit && !/\d/.test(s)) return `<p>${esc(faqHit[1])}</p>`;
    if (/akun|login|daftar akun|account|sign/.test(s)) return `<p>${esc(FAQ.investor[1][1])}</p>`;
    if (/minat|ajukan|apply|interest/.test(s)) return `<p>${esc(FAQ.investor[3][1])}</p>`;
    // pencarian peluang
    let list = pub();
    const sk = Object.keys(SECTORS).find((k) => s.includes(k.toLowerCase()) || s.includes(sec(k).en.toLowerCase()) || (k === 'Perikanan' && /ikan|fish/.test(s)) || (k === 'Pariwisata' && /wisata|touris/.test(s)) || (k === 'Perkebunan' && /kebun|kopi|kakao|coffee|cocoa/.test(s)) || (k === 'Pertanian' && /tani|padi|sagu|agri/.test(s)));
    if (sk) list = list.filter((p) => p.data.sektor === sk);
    const bm = s.match(/(?:di bawah|kurang dari|maks(?:imal)?|under|below|<)\s*(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(m|miliar|milyar|b|billion)?/);
    if (bm) list = list.filter((p) => p.data.nilai && p.data.nilai <= num(bm[1]) * 1e9);
    const lm = s.match(/level\s*(\d)/);
    if (lm) list = list.filter((p) => p.level >= +lm[1]); else if (/siap|ready/.test(s)) list = list.filter((p) => p.level >= 5);
    const dn = DISTRIK.find(([n]) => s.includes(n.toLowerCase()));
    if (dn) list = list.filter((p) => p.data.distrik === dn[0]);
    const filtered = sk || bm || lm || dn || /siap|ready/.test(s);
    if (!filtered) return `<p>${en ? 'I can help you find opportunities by sector, budget, readiness level, or district, explain permits, and compare saved projects. Try: "fishery deals under 20 billion".' : 'Cenra bisa mencarikan peluang menurut sektor, nilai, tingkat kesiapan, atau distrik, menjelaskan izin, dan membandingkan peluang tersimpan. Coba: "perikanan di bawah 20 M".'}</p>`;
    list.sort((a, b) => b.level - a.level);
    if (!list.length) return `<p>${en ? 'No verified opportunity matches that yet. Try a wider budget or another sector.' : 'Belum ada peluang terverifikasi yang cocok. Coba perlebar nilai atau pilih sektor lain.'}</p>${src(L)}`;
    return `<p>${en ? `I found ${list.length} verified opportunit${list.length > 1 ? 'ies' : 'y'}:` : `Cenra menemukan ${list.length} peluang terverifikasi:`}</p>${list.slice(0, 4).map(miniOpp).join('')}${src(L)}`;
  }
  if (role === 'pendata') {
    if (/antre|sinyal|offline|aman|terkirim|kirim/.test(s)) {
      const n = S.outbox.filter((o) => o.kind === 'potensi').length;
      return n ? `<p>Aman, Kak! ${n} data tersimpan di HP dan masuk antrean. Cenra kirim otomatis begitu sinyal kembali, tidak perlu isi ulang.</p>${S.outbox.filter((o) => o.kind === 'potensi').map((o) => `<span class="badge b-a">${esc(o.data.nama)}</span>`).join(' ')}`
        : `<p>Tidak ada data yang antre, Kak. Semua data sudah terkirim ke DPMPTSP${S.online ? '' : '. Saat ini sedang offline, data baru akan disimpan dulu di HP'}.</p>`;
    }
    if (/distrik|sedikit|wilayah/.test(s)) { const r = districtStats().sort((a, b) => a.n - b.n).slice(0, 3); return `<p>Distrik dengan data paling sedikit: ${r.map((x) => `<b>${esc(x.nama)}</b> (${x.n})`).join(', ')}. Kalau sempat berkunjung, data dari sana sangat membantu.</p>`; }
    if (/suara|bicara|rekam/.test(s)) return '<p>Di langkah 2 formulir, ketuk tombol mikrofon lalu ceritakan potensinya, misalnya: "Kebun kakao di Kampung Genyem seluas 300 hektar, jalan aspal, listrik PLN, tanah adat Ondoafi Genyem." Cenra mengisi formulirnya. Kalau HP tidak mendukung rekam suara, ketik saja ceritanya.</p>';
    if (faqHit) return `<p>${esc(faqHit[1])}</p>`;
    if (/gps|lokasi|koordinat/.test(s)) return `<p>${esc(FAQ.pendata[1][1])}</p>`;
    if (/adat|ondoafi|ulayat/.test(s)) return `<p>${esc(FAQ.pendata[2][1])}</p>`;
    if (/foto|kamera/.test(s)) return `<p>${esc(FAQ.pendata[3][1])}</p>`;
    if (/verifikasi|kapan|terbit/.test(s)) return `<p>${esc(FAQ.pendata[4][1])}</p>`;
    return '<p>Cenra bisa membantu soal antrean data offline, cara isi formulir, tanah adat, foto, dan distrik yang perlu didata. Coba tanya "cek data antre".</p>';
  }
  // admin
  if (/ringkas|antrean|hari ini|summary/.test(s)) {
    const q = S.potensi.filter((p) => p.status === 'Menunggu verifikasi');
    const flagged = q.map((p) => ({ p, bad: aiChecks(p).filter((c) => !c.ok) })).filter((x) => x.bad.length);
    const oldest = [...q].sort((a, b) => a.createdAt - b.createdAt)[0];
    return `<p>${q.length} data menunggu verifikasi. ${flagged.length} ditandai Cenra:</p><ul>${flagged.map((x) => `<li><b>${esc(x.p.data.nama)}</b>: ${esc(x.bad.map((b) => b.t.toLowerCase()).join(', '))}</li>`).join('')}</ul>
      ${oldest ? `<p>Paling lama menunggu: <b>${esc(oldest.data.nama)}</b>, ${ago(oldest.createdAt)}.</p>` : ''}<button type="button" class="btn sm" data-go="#/admin/antrean">Buka antrean</button>`;
  }
  if (/distrik|sedikit|sebaran/.test(s)) { const r = districtStats().sort((a, b) => a.n - b.n).slice(0, 4); return `<p>Distrik dengan data paling sedikit: ${r.map((x) => `<b>${esc(x.nama)}</b> (${x.n})`).join(', ')}. Saran Cenra: jadwalkan pendataan ke distrik tersebut bulan ini.</p><button type="button" class="btn sm" data-go="#/admin/peta">Lihat peta persebaran</button>`; }
  if (/draf|pesan|undang|investor/.test(s)) {
    const m = S.minat.find((x) => x.status === 'Baru') || S.minat[0];
    if (!m) return '<p>Belum ada pengajuan minat investor.</p>';
    return `<p>Draf pesan untuk <b>${esc(m.nama)}</b>:</p><div class="card soft small">${esc(draftPesan(m))}</div><button type="button" class="btn sm" data-go="#/admin/minat">Buka minat investor</button>`;
  }
  if (faqHit) return `<p>${esc(faqHit[1])}</p>`;
  if (/duplikat|ganda/.test(s)) return `<p>${esc(FAQ.admin[0][1])}</p>`;
  if (/level|kesiapan/.test(s)) return `<p>${esc(FAQ.admin[1][1])}</p>`;
  if (/ekspor|excel|csv/.test(s)) return `<p>${esc(FAQ.admin[2][1])}</p>`;
  return '<p>Cenra bisa meringkas antrean, menunjukkan distrik yang datanya sedikit, membuat draf pesan untuk investor, dan menjelaskan aturan verifikasi.</p>';
}
function draftPesan(m) {
  const p = byId(m.potensiId);
  const tgl = new Date(Date.now() + 5 * 86400000).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `Yth. ${m.nama}, terima kasih atas minat Anda pada ${p ? p.data.nama : 'peluang investasi di Kabupaten Jayapura'}. Kami mengundang Anda meninjau lokasi pada ${tgl} pukul 10.00 WIT. Profil peluang dan data pendukung kami lampirkan. Salam, DPMPTSP Kabupaten Jayapura.`;
}

function openCenra(tab, opts = {}) {
  if (opts.ctx !== undefined) S.ctxOpp = opts.ctx;
  S.ctab = tab || S.ctab || 'faq';
  $('#cenra').hidden = false; document.body.style.overflow = 'hidden';
  renderCenra();
  if (opts.ask) setTimeout(() => askCenra(opts.ask), 150);
  setTimeout(() => (S.ctab === 'chat' ? $('#cenra-in') : $('#cenra .seg button[aria-selected="true"]'))?.focus(), 60);
}
function closeCenra() { $('#cenra').hidden = true; document.body.style.overflow = ''; $('#cenra-fab').focus(); }
function renderCenra() {
  const role = S.role || 'investor';
  $$('#cenra [data-ctab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ctab === S.ctab)));
  const body = $('#cenra-body');
  if (S.ctab === 'faq') {
    body.innerHTML = `<div class="greet"><img src="${CENRA_IMG.menyapa}" alt=""><div class="bubble">${GREET[role]()}</div></div>
      <div class="label">Pertanyaan umum · ketuk untuk membuka</div>
      ${FAQ[role].map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><div class="ans"><img src="${CENRA_IMG.senang}" alt=""><p>${esc(a)}</p></div>
        <div class="fb">Membantu? <button type="button" class="chip" data-fb="1">👍 Ya</button><button type="button" class="chip" data-fb="0">👎 Belum</button></div></details>`).join('')}`;
  } else {
    const log = S.chat[role] || (S.chat[role] = [{ who: 'ai', html: `<p>${GREET[role]()}</p>` }]);
    body.innerHTML = `<div class="chat">${log.map((m) => (m.who === 'me' ? `<div class="msg me">${esc(m.text)}</div>`
      : `<div class="msg-ai"><span class="av"><img src="${CENRA_IMG[m.img || 'senang']}" alt=""></span><div class="msg ai">${m.html}</div></div>`)).join('')}</div>`;
    body.scrollTop = body.scrollHeight;
  }
  $('#cenra-form').hidden = false; $('#cenra-quick').hidden = false;
  const qk = typeof QUICK[role] === 'function' ? QUICK[role]() : QUICK[role];
  $('#cenra-quick').innerHTML = qk.map((t) => `<button type="button" class="chip soft" data-ask="${esc(t)}">${esc(t)}</button>`).join('');
}
async function askCenra(text) {
  text = text.trim(); if (!text) return;
  const role = S.role || 'investor';
  S.ctab = 'chat';
  const log = S.chat[role] || (S.chat[role] = [{ who: 'ai', html: `<p>${GREET[role]()}</p>` }]);
  log.push({ who: 'me', text });
  renderCenra();
  const chat = $('#cenra-body .chat');
  chat.insertAdjacentHTML('beforeend', `<div class="msg-ai" id="typing"><span class="av"><img src="${CENRA_IMG.berpikir}" alt=""></span><div class="msg ai"><span class="typing"><i></i><i></i><i></i></span></div></div>`);
  $('#cenra-body').scrollTop = 1e6;
  await sleep(700);
  const html = cenraAnswer(role, text);
  log.push({ who: 'ai', html, img: 'senang' });
  renderCenra();
  if (S.settings.suara && role === 'pendata' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(html.replace(/<[^>]+>/g, ' ')); u.lang = 'id-ID'; speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
}
// Dibaca saat dipakai (bukan saat halaman dimuat) agar aplikasi Android bisa menyediakan pengenal suara bawaan HP.
const srClass = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const IN_APP = /KhenambayAndroid/.test(navigator.userAgent);
function listen(onText, btn, lang = 'id-ID') {
  const SR = srClass();
  if (!SR) { toast('Perangkat ini belum mendukung rekam suara. Silakan ketik saja.', 'warn'); return null; }
  if (!navigator.onLine) toast('Pengenalan suara browser butuh internet. Saat offline, ketik ceritanya.', 'warn');
  const r = new SR(); r.lang = lang; r.interimResults = true; r.continuous = true;
  let finalText = '';
  r.onresult = (e) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t + ' '; else interim += t; } onText(finalText + interim, false); };
  r.onend = () => { btn?.classList.remove('rec'); onText(finalText, true); };
  r.onerror = (e) => { if (e.error !== 'aborted') toast('Rekaman suara berhenti: ' + e.error, 'warn'); };
  btn?.classList.add('rec'); r.start();
  return r;
}

// =====================================================================
// Bingkai aplikasi (topbar, menu bawah, tombol Cenra)
// =====================================================================
const NAV = {
  pendata: [['#/pendata', 'home', 'Beranda'], ['#/pendata/data', 'list', 'Data saya'], ['#/pendata/baru', 'plus', 'Data baru'], ['#/pendata/notif', 'bell', 'Notifikasi'], ['#/pendata/profil', 'user', 'Profil']],
  investor: [['#/investor', 'map', 'Peta'], ['#/investor/daftar', 'list', 'Daftar'], ['cenra', 'spark', 'Tanya Cenra'], ['#/investor/disimpan', 'save', 'Disimpan']],
};
const ROLE_LABEL = { pendata: 'Pendata lapangan', investor: 'Calon investor', admin: 'Admin DPMPTSP' };
function updateChrome() {
  const pill = $('#conn'); if (!pill) return;
  pill.className = 'pill ' + (S.online == null ? 'wait' : S.online ? 'on' : 'off');
  pill.textContent = S.online == null ? 'Memeriksa…' : S.online ? 'Online' : 'Offline';
  $('#offline-banner').hidden = S.online !== false || !S.role;
  const n = S.outbox.length; const qc = $('#queue-count'); qc.hidden = !n; qc.textContent = n;
  $('#btn-sync').title = n ? `${n} perubahan menunggu dikirim` : 'Sinkron sekarang';
  const nb = $('#nav-notif'); if (nb) { const c = notifList().filter((x) => x.t > S.notifSeen).length; nb.hidden = !c; nb.textContent = c; }
}
function chrome(route) {
  const role = route.startsWith('#/pendata') ? 'pendata' : route.startsWith('#/investor') ? 'investor' : route.startsWith('#/admin') ? 'admin' : null;
  S.role = role; if (role) LS.set('role', role);
  $('#topbar').hidden = !role; $('#role-label').textContent = role ? (me() && me().role === role ? me().nama : role === 'investor' ? 'Tamu · lihat-lihat' : ROLE_LABEL[role]) : '';
  const ub = $('#btn-user');
  if (ub) {
    if (me() && me().role === role) { ub.hidden = false; ub.className = 'icon-btn user'; ub.innerHTML = `<span>${esc(initials(me().nama))}</span>`; ub.title = `${me().nama} · keluar`; ub.dataset.act = 'logout'; delete ub.dataset.go; }
    else if (role === 'investor') { ub.hidden = false; ub.className = 'btn sm'; ub.textContent = 'Masuk'; ub.dataset.go = loginHref('investor', route); delete ub.dataset.act; }
    else ub.hidden = true;
  }
  // Web komputer: menu atas seperti website biasa; dock bawah hanya di HP.
  const desk = role === 'investor' && document.body.classList.contains('desk');
  const tn = $('#topnav');
  if (tn) {
    tn.hidden = !desk;
    if (desk) {
      const items = [['#/investor', 'map', t('Peta', 'Map')], ['#/investor/daftar', 'list', t('Daftar peluang', 'Opportunities')], ['#/investor/disimpan', 'save', t('Disimpan', 'Saved')]];
      if (isRole('investor')) items.push(['#/investor/verifikasi', 'idcard', t('Verifikasi diri', 'Verification')]);
      tn.innerHTML = items.map(([h, i, l]) => { const cur = h === route || (h !== '#/investor' && route.startsWith(h)) || (h === '#/investor/daftar' && route.startsWith('#/investor/p/')); return `<a href="${h}"${cur ? ' aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a>`; }).join('')
        + `<a href="#" data-open-cenra="chat" class="tn-ai">${ic('spark')}<span>${t('Tanya Cenra', 'Ask Cenra')}</span></a>`;
    }
  }
  const ub2 = $('#btn-daftar'); if (ub2) ub2.hidden = !(desk && !isRole('investor'));
  const nav = $('#bottomnav');
  if (desk) { nav.hidden = true; document.body.classList.add('no-nav'); }
  else if (role && NAV[role]) {
    nav.hidden = false; document.body.classList.remove('no-nav');
    // Dock melayang: item aktif melebar jadi pil berwarna; "Data baru" pendata jadi tombol bulat besar di tengah.
    nav.className = 'bottomnav dock' + (role === 'pendata' ? ' has-fab' : '');
    nav.innerHTML = NAV[role].map(([h, i, l]) => {
      const cur = h === route || (h !== '#/pendata' && h !== '#/investor' && route.startsWith(h)) ? ' aria-current="page"' : '';
      const fab = h === '#/pendata/baru' ? ' dk-fab' : '';
      const inner = `<span class="dk-ic">${ic(i)}</span><span class="dk-l">${l}</span>`;
      return h === 'cenra' ? `<a href="#" class="dk dk-ai" data-open-cenra="chat">${inner}</a>` : `<a href="${h}" class="dk${fab}"${cur}>${inner}${h === '#/pendata/notif' ? '<span class="dot-count" id="nav-notif" hidden></span>' : ''}</a>`;
    }).join('');
  } else { nav.hidden = true; document.body.classList.add('no-nav'); }
  $('#cenra-fab').hidden = !role;
  $('#cenra-fab').classList.toggle('min', route !== '#/pendata' && route !== '#/investor' && route !== '#/admin');
  updateChrome();
}

// =====================================================================
// Halaman awal: pilih peran
// =====================================================================
// Web (komputer): hanya untuk investor. Pendata memakai aplikasi/HP. Admin DPMPTSP masuk lewat alamat khusus #/masuk/admin (tidak dipajang).
const IS_WEB = () => !IS_MOBILE && !IN_APP;
function startRoles() {
  if (IS_WEB()) {
    return [
      { r: 'investor', i: 'map', t: 'Lihat peluang', d: 'Jelajahi peta dan daftar peluang investasi tanpa login', b: 'Tanpa login', h: '#/investor', g: 'Jelajahi' },
      { r: 'investor', i: 'user', t: isRole('investor') ? 'Akun investor' : 'Masuk investor', d: 'Simpan peluang, lihat IRR, dan ajukan minat investasi', b: isRole('investor') ? 'Sudah masuk' : 'Punya akun', h: isRole('investor') ? '#/investor/disimpan' : '#/masuk/investor', g: isRole('investor') ? 'Buka' : 'Masuk' },
      { r: 'investor', i: 'idcard', t: 'Daftar gratis', d: 'Buat akun investor lalu verifikasi data diri', b: 'Akun baru', h: isRole('investor') ? '#/investor/verifikasi' : '#/daftar', g: isRole('investor') ? 'Verifikasi' : 'Daftar' },
      { r: 'admin', i: 'shield', t: 'Admin DPMPTSP', d: 'Khusus petugas verifikasi, masuk dengan Google Authenticator', b: isRole('admin') ? 'Sudah masuk' : 'Khusus PC', h: isRole('admin') ? '#/admin' : '#/masuk/admin', g: isRole('admin') ? 'Buka ruang kerja' : 'Masuk admin' },
    ];
  }
  return [
    { r: 'pendata', i: 'map', t: 'Pendata lapangan', d: 'Catat potensi kampung dengan suara, GPS, dan kamera', b: isRole('pendata') ? 'Sudah masuk' : 'Wajib masuk', h: isRole('pendata') ? '#/pendata' : '#/masuk/pendata', g: 'Masuk' },
    { r: 'investor', i: 'users', t: 'Calon investor', d: 'Lihat-lihat peta dan daftar peluang tanpa login', b: isRole('investor') ? 'Sudah masuk' : 'Lihat tanpa login', h: '#/investor', g: 'Lihat peluang' },
  ];
}
const roleBadge = (b) => `<span class="badge ${b === 'Sudah masuk' ? 'b-g' : 'b-t'}">${b}</span>`;
function startFoot() {
  return `${isRole('investor') ? '' : `<p class="small st-note">Investor yang ingin mengajukan minat? <a href="#/masuk/investor?next=%23%2Finvestor">Masuk</a> atau <a href="#/daftar">daftar gratis</a>.</p>`}
    ${me() ? `<p class="small st-note">Masuk sebagai <b>${esc(me().nama)}</b> · <a href="#" data-act="logout">Keluar</a></p>` : ''}
    <p class="xs st-fine">Prototipe lomba Inovasi Teknologi HUT ke-10 DPMPTSP Kabupaten Jayapura · data contoh${IN_APP && !LOCAL ? ' · <a href="#" data-act="app-server">Ubah alamat server</a>' : ''}</p>`;
}
const startLogo = (cls = '') => `<div class="logo ${cls}"><img src="icons/logo-cenderawasih.png" alt=""><div><b>Khenambay</b><small>Satu data, sejuta peluang investasi</small></div></div>`;

// ---------------------------------------------------------------------
// Ilustrasi pemandangan Sentani (digambar lewat kode, tanpa foto luar).
// Palet senja: krem, pasir, kuning, jingga, zaitun, hutan.
// ---------------------------------------------------------------------
const SC = { cream: '#F6F4F1', sand: '#ECE2CE', sun: '#F2B635', ember: '#E45C10', olive: '#4B5D16', forest: '#223300', deep: '#141C06' };
function ridge(w, base, amp, seed, step = 10) {
  const pts = [];
  for (let x = 0; x <= w + step; x += step) {
    const u = x / w;
    const y = base - amp * (0.55 * Math.sin(u * 5.1 + seed) + 0.3 * Math.sin(u * 11.7 + seed * 2.3) + 0.15 * Math.sin(u * 23.9 + seed * 3.1) + 0.35 * Math.exp(-((u - (0.35 + 0.3 * Math.sin(seed))) ** 2) / 0.02));
    pts.push(`${x.toFixed(0)},${y.toFixed(1)}`);
  }
  return `M0,${base + 900} L${pts.join(' L')} L${w + step},${base + 900} Z`;
}
let scId = 0;
function scSky(w, h, id, warm = 1) {
  return `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${warm ? '#E9DFC9' : '#B9A88A'}"/><stop offset=".38" stop-color="${SC.sun}"/><stop offset=".62" stop-color="${SC.ember}"/><stop offset="1" stop-color="#7A3A0C"/></linearGradient>
    <radialGradient id="${id}g" cx=".66" cy=".5" r=".5"><stop offset="0" stop-color="#FFF6DA" stop-opacity=".95"/><stop offset=".25" stop-color="${SC.sun}" stop-opacity=".55"/><stop offset="1" stop-color="${SC.sun}" stop-opacity="0"/></radialGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}s)"/><rect width="${w}" height="${h}" fill="url(#${id}g)"/>`;
}
// Hero: langit + pegunungan jauh (belakang judul) dan pegunungan dekat + danau (depan judul)
function heroScene() {
  const id = 'h' + (++scId), W = 1440, H = 900;
  const sky = `<svg class="sky" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><filter id="${id}b"><feGaussianBlur stdDeviation="6"/></filter></defs>
    ${scSky(W, H, id)}
    <circle cx="955" cy="440" r="62" fill="#FFF3CF" opacity=".95"/>
    <path d="${ridge(W, 330, 70, 1.3)}" fill="#E8C68E" opacity=".75" filter="url(#${id}b)"/>
    <path d="${ridge(W, 380, 90, 4.2)}" fill="#C98A45" opacity=".8"/></svg>`;
  const front = `<svg class="front" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SC.sun}" stop-opacity=".85"/><stop offset=".5" stop-color="${SC.ember}" stop-opacity=".55"/><stop offset="1" stop-color="${SC.deep}"/></linearGradient>
      <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FBEFD6" stop-opacity="0"/><stop offset=".5" stop-color="#FBEFD6" stop-opacity=".6"/><stop offset="1" stop-color="#FBEFD6" stop-opacity="0"/></linearGradient>
      <filter id="${id}f"><feGaussianBlur stdDeviation="14"/></filter></defs>
    <path d="${ridge(W, 430, 125, 2.6)}" fill="#7B6A2A"/>
    <rect x="-100" y="440" width="${W + 200}" height="60" fill="url(#${id}m)" filter="url(#${id}f)"/>
    <path d="${ridge(W, 530, 90, 5.4)}" fill="${SC.olive}"/>
    <rect x="0" y="600" width="${W}" height="300" fill="url(#${id}l)"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${880 + Math.sin(i * 1.7) * 90 - (60 - i * 3)}" y="${612 + i * 13}" width="${120 - i * 6}" height="3" rx="1.5" fill="#FFF3CF" opacity="${0.75 - i * 0.045}"/>`).join('')}
    <path d="M0,600 L${W},600 L${W},612 L0,614 Z" fill="${SC.forest}" opacity=".7"/>
    <path d="M120,612 q60,-26 150,-4 q40,10 90,4 l0,14 l-240,0 Z M560,616 q40,-16 110,-2 l0,10 l-110,0 Z" fill="${SC.forest}"/>
    ${stilts(1010, 640)}
    <path d="${ridge(W, 800, 60, 7.7, 16)}" fill="${SC.deep}" opacity=".9"/>
    ${palm(1300, 900, 1.25)}${palm(1395, 900, .9)}${palm(70, 900, 1.05)}</svg>`;
  return { sky, front };
}
function stilts(x, y, k = 1) { // rumah panggung di danau Sentani
  return Array.from({ length: 5 }, (_, i) => { const xx = x + i * 46 * k, s = (1 - i * 0.06) * k;
    return `<g fill="${SC.deep}" opacity=".9"><path d="M${xx},${y} l${30 * s},-${18 * s} l${30 * s},${18 * s} Z"/><rect x="${xx + 4 * s}" y="${y}" width="${52 * s}" height="${12 * s}"/><path d="M${xx + 8 * s},${y + 12 * s} v${14 * k} M${xx + 30 * s},${y + 12 * s} v${14 * k} M${xx + 52 * s},${y + 12 * s} v${14 * k}" stroke="${SC.deep}" stroke-width="${2 * k}"/></g>`; }).join('');
}
function palm(x, y, s) {
  const lf = (a, l) => { const r = a * Math.PI / 180, ex = x + Math.cos(r) * l * s, ey = y - 330 * s + Math.sin(r) * l * s;
    return `<path d="M${x},${y - 330 * s} Q${(x + ex) / 2},${y - 330 * s - 50 * s} ${ex},${ey}" stroke="${SC.deep}" stroke-width="${10 * s}" fill="none" stroke-linecap="round"/>`; };
  return `<path d="M${x},${y} C${x - 10 * s},${y - 120 * s} ${x + 20 * s},${y - 240 * s} ${x},${y - 330 * s}" stroke="${SC.deep}" stroke-width="${14 * s}" fill="none"/>${[200, 225, 250, 290, 320, 345, 165].map((a, i) => lf(a, 130 + (i % 3) * 30)).join('')}`;
}
// Kartu kecil: pemandangan per tema
/** Foto asli dari img/foto/<nama>.jpg. Selama fotonya belum ada, tampil ilustrasi miniScene sebagai cadangan. */
const realPic = (nama, cadangan, alt) => `<img class="real-pic" src="img/foto/${nama}.jpg" alt="${esc(alt)}" loading="lazy" decoding="async" data-ms="${cadangan}">`;
document.addEventListener('error', (e) => {
  const im = e.target;
  if (im.tagName === 'IMG' && im.classList.contains('real-pic') && im.parentNode) im.outerHTML = miniScene(im.dataset.ms, 160, 120);
}, true);
function miniScene(kind, w = 120, h = 160) {
  const id = 'm' + (++scId);
  const base = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs></defs>`;
  if (kind === 'sentani') return `${base}${scSky(w, h, id)}<circle cx="${w * .68}" cy="${h * .45}" r="${w * .09}" fill="#FFF3CF"/>
    <path d="${ridge(w, h * .5, h * .12, 2.1, 4)}" fill="#B77A3C"/><path d="${ridge(w, h * .58, h * .1, 4.4, 4)}" fill="${SC.olive}"/>
    <rect y="${h * .62}" width="${w}" height="${h}" fill="${SC.forest}"/><rect x="${w * .55}" y="${h * .64}" width="${w * .25}" height="2" fill="${SC.sun}" opacity=".8"/><rect x="${w * .58}" y="${h * .69}" width="${w * .18}" height="2" fill="${SC.sun}" opacity=".6"/>
    ${stilts(w * .06, h * .67, w / 400)}</svg>`;
  if (kind === 'kebun') return `${base}<rect width="${w}" height="${h}" fill="#E9C77A"/><circle cx="${w * .3}" cy="${h * .25}" r="${w * .1}" fill="#FFF3CF"/>
    <path d="${ridge(w, h * .42, h * .08, 1.2, 4)}" fill="#9AA24A"/><path d="${ridge(w, h * .55, h * .08, 3.3, 4)}" fill="${SC.olive}"/><path d="${ridge(w, h * .72, h * .06, 5.1, 4)}" fill="${SC.forest}"/>
    ${Array.from({ length: 18 }, (_, i) => `<circle cx="${(i % 6) * w / 5.5 + 6}" cy="${h * .6 + Math.floor(i / 6) * h * .1}" r="${5 + (i % 3)}" fill="${['#6E7F22', '#5B6B1A', '#89982E'][i % 3]}"/>`).join('')}</svg>`;
  if (kind === 'laut') return `${base}<linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3D28A"/><stop offset=".5" stop-color="${SC.ember}"/><stop offset="1" stop-color="${SC.forest}"/></linearGradient><rect width="${w}" height="${h}" fill="url(#${id}a)"/>
    <circle cx="${w * .5}" cy="${h * .48}" r="${w * .14}" fill="#FFF1C7"/><rect y="${h * .52}" width="${w}" height="${h}" fill="#2E3A0C"/>
    ${Array.from({ length: 6 }, (_, i) => `<rect x="${w * .5 - (30 - i * 4)}" y="${h * .56 + i * 7}" width="${60 - i * 8}" height="2" fill="${SC.sun}" opacity="${.8 - i * .1}"/>`).join('')}
    <path d="M${w * .18},${h * .78} q${w * .2},${h * .06} ${w * .42},0 l-${w * .05},${h * .05} l-${w * .32},0 Z" fill="${SC.deep}"/><path d="M${w * .36},${h * .78} v-${h * .2} l${w * .16},${h * .17} Z" fill="${SC.deep}"/></svg>`;
  if (kind === 'honai') return `${base}<linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B3510"/><stop offset=".6" stop-color="#5B3A12"/><stop offset="1" stop-color="${SC.ember}"/></linearGradient><rect width="${w}" height="${h}" fill="url(#${id}a)"/>
    ${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 37) % w}" cy="${(i * 23) % (h * .4)}" r="${i % 3 ? .8 : 1.4}" fill="#FFF3CF"/>`).join('')}
    <path d="${ridge(w, h * .6, h * .08, 2.8, 4)}" fill="#1E2608"/>
    ${[[.28, .78, 1], [.66, .8, .8]].map(([x, y, s]) => `<path d="M${w * x - 26 * s},${h * y} q${26 * s},-${46 * s} ${52 * s},0 Z" fill="${SC.deep}"/><rect x="${w * x - 22 * s}" y="${h * y}" width="${44 * s}" height="${22 * s}" fill="#2A1A07"/><rect x="${w * x - 5 * s}" y="${h * y + 8 * s}" width="${10 * s}" height="${14 * s}" fill="${SC.sun}"/>`).join('')}
    <rect y="${h * .9}" width="${w}" height="${h * .1}" fill="${SC.deep}"/></svg>`;
  if (kind === 'cenra') return `${base}<radialGradient id="${id}a" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="${SC.sun}"/><stop offset=".7" stop-color="${SC.ember}"/><stop offset="1" stop-color="#6B2A06"/></radialGradient><rect width="${w}" height="${h}" fill="url(#${id}a)"/></svg><img src="${CENRA_IMG.menyapa}" alt="" style="object-fit:contain;padding:10px 6px 26px">`;
  if (kind === 'satelit') return `<img src="img/sat.png" alt="">`;
  return base + '</svg>';
}
function endScene() {
  const id = 'e' + (++scId), W = 1440, H = 820;
  return `<svg class="bg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F1408"/><stop offset=".3" stop-color="#5B3A12"/><stop offset=".55" stop-color="${SC.ember}"/><stop offset=".75" stop-color="${SC.sun}"/><stop offset="1" stop-color="#2A320F"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${id}s)"/>
    <path d="M820,570 C930,470 990,360 1040,330 C1090,360 1150,470 1260,570 Z" fill="#8F4A16" opacity=".6"/><path d="M1008,352 C1022,340 1032,332 1040,330 C1048,332 1058,340 1072,352 L1056,350 L1046,360 L1036,350 L1024,358 Z" fill="${SC.sand}" opacity=".75"/>
    <path d="${ridge(W, 560, 70, 3.9, 12)}" fill="#3A410F"/>
    <rect y="600" width="${W}" height="${H}" fill="#1B2307"/>
    ${stilts(860, 640)}${stilts(1120, 652)}
    <path d="${ridge(W, 760, 40, 6.6, 16)}" fill="${SC.deep}"/>${palm(1360, 820, 1)}${palm(40, 820, .8)}</svg>`;
}
const SOC = ['IG', 'YT', 'WA'];

// Halaman awal sinematik: hero pemandangan Sentani + judul raksasa, kartu kecil, alur bertimeline, fitur, lalu pilih peran.
function vStart() {
  const n = pub().length, roles = startRoles();
  const navLinks = `<nav class="l-links" aria-label="Bagian halaman"><a href="#" data-scroll="l-tentang">Tentang</a><a href="#" data-scroll="l-fitur">Fitur</a><a href="#" data-scroll="l-jalur">Masuk</a></nav>`;
  const cards = [['sentani', '19 distrik<br>Kab. Jayapura', '#/investor'], ['kebun', '6 sektor<br>potensi', '#/investor/daftar'], ['satelit', 'peta satelit<br>langsung', '#/investor'], ['cenra', 'tanya<br>Cenra', 'cenra'], ['honai', 'tetap jalan<br>tanpa sinyal', null]];
  return `<div class="land">
  <section class="l-hero" aria-labelledby="l-h1">
    <img class="sky l-photo" src="img/foto/sentani-hero.jpg" alt="Bukit-bukit hijau di tepi Danau Sentani, Kabupaten Jayapura" fetchpriority="high" decoding="async"><div class="l-tint" aria-hidden="true"></div>
    <h1 id="l-h1" class="l-giant">Khenambay</h1>${window.KPapua ? KPapua.flock(3) : ''}
    <div class="l-wrap"><header class="l-nav"><a class="l-brand" href="#/"><img src="icons/logo-cenderawasih.png" alt="">Khenambay</a>${navLinks}<button type="button" class="l-pill" data-scroll="l-jalur">Mulai</button></header></div>
    <div class="l-social" aria-hidden="true">${SOC.map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="l-stage"><div class="l-wrap">
      <div><p class="l-intro">Satu data, sejuta peluang investasi. Potensi kampung di <b>Kabupaten Jayapura</b> dicatat pendata, diverifikasi DPMPTSP, lalu tampil untuk investor.</p>
        <div class="l-cards">${cards.map(([k, t, h]) => `<a class="l-card" href="#" ${h === 'cenra' ? 'data-open-cenra="chat"' : h ? `data-go="${h}"` : 'data-scroll="l-fitur"'}>${miniScene(k)}<span>${t}</span></a>`).join('')}</div>
        <button type="button" class="l-cta l-mcta" data-scroll="l-jalur">Mulai sekarang</button></div>
      <div class="l-cenra"><img src="${CENRA_IMG.menyapa}" alt="Cenra, maskot burung cenderawasih"><button type="button" class="l-cta" data-scroll="l-jalur">Mulai sekarang</button></div>
    </div></div>
  </section>

  <div class="l-mid"><img class="l-mid-bg" src="img/foto/sentani-tengah.jpg" alt="" loading="lazy" decoding="async"><div class="l-mid-tint" aria-hidden="true"></div>
  <section class="l-sec" id="l-jalur">${window.KPapua ? KPapua.once('sbird', { w: 104, top: 0, dur: 4.6 }) : ''}<div class="l-wrap">
    <h2 class="sx-title left">Pilih jalurmu</h2>
    ${IS_WEB() ? '<p class="l-note">Pendata lapangan memakai aplikasi Khenambay di HP.</p>' : ''}
    <div class="l-paths n${roles.length}">${roles.map((x, i) => `<button type="button" class="l-path ${x.r === 'admin' ? 'clay-night' : ['clay-ember', 'clay-sun', 'clay-olive'][i]}" data-go="${x.h}">
      <span class="lp-ic">${ic(x.i)}</span><span class="lp-tag">${x.b}</span><b>${x.t}</b><small>${x.d}</small><span class="lp-go">${x.g} ${ic('chev')}</span></button>`).join('')}</div>
  </div></section>

  <section class="l-sec" id="l-tentang">${window.KPapua ? KPapua.once('sbird', { w: 90, top: 20, dur: 5, tone: 'emas' }) : ''}<div class="l-wrap">
    <h2 class="sx-title">Tentang Khenambay</h2>
    <div class="l-about">
      <div class="txt"><p>Kami menyiapkan alur sederhana agar potensi tiap kampung sampai ke investor. Tiga pihak saling terhubung: <em>pendata, DPMPTSP, dan investor.</em></p>
        <p>Tidak perlu repot mencari data atau mengurus berkas. Pendata cukup bercerita, Cenra merapikan isinya, DPMPTSP memeriksa, dan investor tinggal <em>memilih peluang.</em></p></div>
      <div class="l-time">
        <div class="l-step"><div class="when">Langkah 1<b>Pendata</b>cerita lewat suara, GPS, foto</div><div class="l-pics"><div>${realPic('honai', 'honai', 'Rumah honai di kampung Papua')}</div><div>${realPic('kebun', 'kebun', 'Kebun rakyat di Kabupaten Jayapura')}</div></div></div>
        <div class="l-step"><div class="when">Langkah 2<b>DPMPTSP</b>6 cek AI, level 1–5</div><div class="l-pics"><div><img src="img/sat.png" alt="Citra satelit Kabupaten Jayapura" loading="lazy"></div><div>${realPic('sentani', 'sentani', 'Danau Sentani')}</div></div></div>
        <div class="l-step"><div class="when">Langkah 3<b>Investor</b>lihat peta, ajukan minat</div><div class="l-pics"><div>${realPic('pantai', 'laut', 'Pantai di Distrik Depapre')}</div><div>${realPic('cycloop', 'kebun', 'Pegunungan Cycloop')}</div></div></div>
      </div>
    </div>
  </div></section>

  <section class="l-sec" id="l-fitur">${window.KPapua ? KPapua.once('sbird', { w: 80, top: 0, dur: 4.2 }) : ''}<div class="l-wrap">
    <h2 class="sx-title left">Yang tersedia</h2>
    <div class="l-feat">
      <article class="l-f"><h3>${ic('spark')}Cenra AI</h3><p>Asisten yang mengisi formulir dari cerita suara dan menjawab pertanyaan investor.</p></article>
      <article class="l-f"><h3>${ic('map')}Peta satelit</h3><p>Lokasi lahan di citra satelit, lengkap dengan posisi Anda secara langsung.</p></article>
      <article class="l-f"><h3>${ic('save')}Tanpa sinyal</h3><p>Data tersimpan di HP dan terkirim sendiri begitu ada sinyal.</p></article>
      <article class="l-f"><h3>${ic('shield')}Data terverifikasi</h3><p>Setiap peluang dicek DPMPTSP. Data diri investor dienkripsi.</p></article>
    </div>
  </div></section>

  </div>
  <section class="l-end" id="l-peran"><img class="bg l-photo-end" src="img/foto/danau-penutup.jpg" alt="Danau di antara bukit hijau Kabupaten Jayapura" loading="lazy" decoding="async"><div class="l-end-tint" aria-hidden="true"></div><div class="l-wrap">
    <div class="l-panel">
      <h2>${IS_WEB() ? 'Siap berinvestasi di<br>Kabupaten Jayapura?' : 'Mau masuk sebagai apa,<br>atau masih ada pertanyaan?'}</h2>
      <p class="sub">${IS_WEB() ? 'Pilih langkah berikutnya.' : 'Pilih peran Anda.'}${n ? ` Saat ini ada <b>${n}</b> peluang terverifikasi.` : ''}</p>
      ${roles.map((x) => `<button type="button" class="l-role" data-go="${x.h}"><span class="ic">${ic(x.i)}</span><span><b>${x.t}</b><small>${x.d}</small></span>${roleBadge(x.b)}</button>`).join('')}
      <button type="button" class="l-cta" data-open-cenra="chat">Tanya Cenra dulu</button>
      ${startFoot()}
    </div>
    <footer class="l-foot"><a class="l-brand" href="#/"><img src="icons/logo-cenderawasih.png" alt="">Khenambay</a>${navLinks}<button type="button" class="l-pill" data-go="#/investor">Lihat peluang</button></footer>
  </div></section>
</div>`;
}

// =====================================================================
// Admin hanya dari komputer (web PC)
// =====================================================================
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad mode desktop
function vPendataApp() {
  return authShell(`<div class="card stack" style="text-align:center;justify-items:center;color:var(--ink)">
      <div class="app-ill" aria-hidden="true">${ic('pin')}</div>
      <h1 style="font-size:24px">Pendataan lapangan memakai aplikasi HP</h1>
      <p class="muted">Pendata bekerja di kampung dengan GPS, kamera bercap lokasi, dan suara, jadi fitur ini hanya ada di aplikasi Khenambay atau browser HP. Website di komputer khusus untuk investor.</p>
      <div class="row" style="width:100%"><a class="btn ghost grow" href="#/">Halaman awal</a><a class="btn grow" href="#/investor">Lihat peluang</a></div>
    </div>`);
}
function vAdminPC() {
  return authShell(`<div class="card stack" style="text-align:center;justify-items:center;color:var(--ink)">
      <div class="pc-ill" aria-hidden="true"><svg viewBox="0 0 120 80"><rect x="14" y="6" width="92" height="56" rx="6" fill="#0E6C72"/><rect x="20" y="12" width="80" height="44" rx="3" fill="#E6F4F5"/><rect x="48" y="62" width="24" height="6" fill="#0E6C72"/><rect x="36" y="68" width="48" height="5" rx="2.5" fill="#0E6C72"/><path d="M50 28h20M44 36h32M50 44h20" stroke="#0E6C72" stroke-width="4" stroke-linecap="round"/></svg></div>
      <h1 style="font-size:24px">Admin hanya bisa dibuka dari komputer</h1>
      <p class="muted">Halaman admin DPMPTSP berisi verifikasi data, tingkat kesiapan, ekstraksi dokumen, dan data minat investor. Demi keamanan dan kenyamanan kerja, halaman ini hanya bisa dibuka lewat website di PC atau laptop.</p>
      <div class="card stack-s" style="text-align:left;width:100%"><b>Cara membuka</b><ol class="small" style="margin:0;padding-left:18px;line-height:1.6"><li>Buka komputer atau laptop kantor.</li><li>Buka alamat website Khenambay di Chrome atau Edge.</li><li>Pilih <b>Admin DPMPTSP</b>, lalu masuk dengan akun admin.</li></ol></div>
      <div class="row" style="width:100%"><a class="btn ghost grow" href="#/">Kembali</a><a class="btn grow" href="#/investor">Lihat peluang</a></div>
    </div>`);
}

// =====================================================================
// Masuk & daftar
// =====================================================================
const ROLE_INFO = {
  pendata: { t: 'Pendata lapangan', d: 'Akun pendata dibuat oleh DPMPTSP. Setelah masuk sekali, aplikasi tetap bisa dipakai tanpa sinyal.', demo: ['markus@jayapurakab.go.id', 'pendata123'] },
  investor: { t: 'Investor', d: 'Masuk untuk menyimpan peluang, melihat angka keuangan, dan mengajukan minat investasi. Bertanya ke Cenra tetap bisa tanpa akun.', demo: ['investor@demo.id', 'investor123'] },
  admin: { t: 'Admin DPMPTSP', d: 'Khusus petugas verifikasi DPMPTSP Kabupaten Jayapura.', demo: ['admin@jayapurakab.go.id', 'admin123'] },
};
const nextOf = (def) => new URLSearchParams(location.hash.split('?')[1] || '').get('next') || def;
function authShell(inner, side = true) {
  // Di komputer: panel kiri berisi pesan untuk investor, form di kanan. Di HP: form saja.
  return `<div class="start st-scene${side ? '' : ' no-side'}">${endScene()}<aside class="auth-side" aria-hidden="true"><p class="auth-kicker">Khenambay untuk investor</p>
    <h2>Satu data,<br>sejuta peluang<br>investasi.</h2><p>Peluang di 19 distrik Kabupaten Jayapura, sudah diverifikasi DPMPTSP dan lengkap dengan status lahan adat.</p>
    <ul><li>${ic('map')} Peta satelit semua peluang</li><li>${ic('star')} Tingkat kesiapan level 1–5</li><li>${ic('shield')} Data diri terenkripsi</li></ul>
    <img src="${CENRA_IMG.menyapa}" alt=""></aside><div class="start-in">
    <a class="logo" href="#/" style="text-decoration:none;color:#fff"><img src="icons/logo-cenderawasih.png" alt=""><div><b>Khenambay</b><small>Satu data, sejuta peluang investasi</small></div></a>
    ${inner}</div></div>`;
}
function vLogin(role) {
  role = (role || 'investor').split('?')[0]; const r = ROLE_INFO[role] || ROLE_INFO.investor;
  return authShell(`<div class="card stack" style="color:var(--ink)">
      <div><div class="label" style="color:var(--teal)">Masuk sebagai</div><h1 style="font-size:24px">${r.t}</h1><p class="small muted" style="margin-top:4px">${r.d}</p></div>
      <form id="login-form" class="stack" data-role="${role}" novalidate>
        <label class="field">Email<input name="email" type="email" autocomplete="username" required></label>
        <label class="field"><span class="row between">Kata sandi <a href="#/lupa/${role}" class="forgot">Lupa kata sandi?</a></span><input name="password" type="password" autocomplete="current-password" required></label>
        <div id="auth-err" class="card coral small" hidden></div>
        <button type="submit" class="btn block">Masuk</button>
        ${role !== 'investor' ? `<p class="xs muted twofa-note">${ic('shield')} Akun ${role === 'admin' ? 'admin' : 'pendata'} dilindungi Google Authenticator. Siapkan aplikasinya di HP.</p>` : ''}
      </form>
      ${role === 'investor' ? `<p class="small">Belum punya akun? <a href="#/daftar?next=${encodeURIComponent(nextOf('#/investor'))}" style="font-weight:700">Daftar gratis</a></p>` : ''}
    </div>
    ${role === 'investor' ? '<a class="btn ghost block" href="#/investor">Lanjut lihat-lihat tanpa login</a>' : '<a class="btn ghost block" href="#/">Kembali ke pilihan peran</a>'}
    <div class="cenra-hello"><img src="${CENRA_IMG.menyapa}" alt=""><div class="bubble">${role === 'investor' ? 'Tanpa login Anda tetap bisa melihat peta dan daftar peluang. Untuk berinvestasi, masuk dulu, ya!' : 'Selamat datang kembali! Masukkan email dan kata sandi akun Anda.'}</div></div>`, role === 'investor');
}
function vRegister() {
  return authShell(`<div class="card stack" style="color:var(--ink)">
      <div><div class="label" style="color:var(--teal)">Daftar akun investor</div><h1 style="font-size:24px">Gratis, lalu verifikasi data diri</h1></div>
      <form id="reg-form" class="stack" novalidate>
        <label class="field">Nama lengkap *<input name="nama" autocomplete="name" required></label>
        <label class="field">Perusahaan / lembaga<input name="perusahaan" autocomplete="organization"></label>
        <div class="grid2"><label class="field">Email *<input name="email" type="email" autocomplete="email" required></label>
          <label class="field">WhatsApp<input name="telepon" type="tel" autocomplete="tel"></label></div>
        <label class="field">Kata sandi * <span class="hint">minimal 8 karakter, huruf dan angka</span><input name="password" type="password" autocomplete="new-password" required minlength="8" data-pwmeter></label><div class="pwm"><i></i><i></i><i></i><i></i></div>
        <p class="xs muted">Setelah daftar, Anda diminta melengkapi verifikasi data diri (KTP/paspor dan dokumen usaha) sebelum bisa mengajukan minat.</p>
        <label class="check"><input type="checkbox" name="setuju" required> Saya setuju data saya dipakai DPMPTSP Kabupaten Jayapura untuk menindaklanjuti minat investasi.</label>
        <div id="auth-err" class="card coral small" hidden></div>
        <button type="submit" class="btn block">Daftar & masuk</button>
      </form>
      <p class="small">Sudah punya akun? <a href="#/masuk/investor?next=${encodeURIComponent(nextOf('#/investor'))}" style="font-weight:700">Masuk</a></p>
    </div><a class="btn ghost block" href="#/investor">Lihat-lihat tanpa login</a>`);
}
// ---------- kotak 6 angka (kode email / Google Authenticator) ----------
const otpBoxes = (name = 'kode') => `<div class="otp" data-otp="${name}" role="group" aria-label="Kode 6 angka">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i ? 'off' : 'one-time-code'}" aria-label="Angka ${i + 1}">`).join('')}</div>`;
function otpValue(root) { return Array.from(root.querySelectorAll('.otp input')).map((i) => i.value).join(''); }
function wireOtp(root, onFull) {
  const ins = Array.from(root.querySelectorAll('.otp input'));
  ins.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/\D/g, '').slice(-1); inp.classList.toggle('on', !!inp.value);
      if (inp.value && ins[i + 1]) ins[i + 1].focus();
      if (ins.every((x) => x.value)) onFull?.();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) { ins[i - 1].focus(); ins[i - 1].value = ''; ins[i - 1].classList.remove('on'); } });
    inp.addEventListener('paste', (e) => {
      const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6); if (!d) return; e.preventDefault();
      ins.forEach((x, k) => { x.value = d[k] || ''; x.classList.toggle('on', !!x.value); }); (ins[d.length] || ins[5]).focus();
      if (d.length === 6) onFull?.();
    });
  });
  setTimeout(() => ins[0]?.focus(), 60);
}
function otpError(root, msg) {
  const box = root.querySelector('.otp'); const err = root.querySelector('.otp-err');
  if (err) { err.hidden = false; err.textContent = msg; }
  if (box) { box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); box.querySelectorAll('input').forEach((x) => { x.value = ''; x.classList.remove('on'); }); box.querySelector('input').focus(); }
}
function qrSvg(text) {
  if (!window.qrcode) return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}
/** Salin teks. navigator.clipboard hanya ada di https/localhost; di http (XAMPP lewat WiFi) dan WebView pakai cara lama. */
async function copyText(t) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) { /* lanjut ke cara lama */ }
  const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-100px;opacity:0';
  document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); return ok;
}
/** Langkah kedua login pendata/admin: aktivasi atau kode Google Authenticator. */
function showOtp(res, role, card) {
  const setup = !!res.setup_otp;
  const sec = setup ? res.secret.replace(/(.{4})/g, '$1 ').trim() : '';
  card.classList.add('otp-card');
  card.innerHTML = `<div class="otp-head"><span class="ga-ic" aria-hidden="true">${ic('shield')}</span><div><div class="label">Langkah 2 dari 2 · ${esc(res.user.nama)}</div>
      <h1 style="font-size:23px">${setup ? 'Aktifkan Google Authenticator' : 'Masukkan kode Google Authenticator'}</h1></div></div>
    ${setup ? `<ol class="ga-steps"><li>Pasang <b>Google Authenticator</b> dari Play Store atau App Store.</li><li>Ketuk <b>+</b> lalu <b>Pindai kode QR</b>.</li><li>Masukkan 6 angka yang muncul untuk <b>Khenambay DPMPTSP</b>.</li></ol>
      <div class="ga-qr">${qrSvg(res.uri)}<div class="ga-key"><small>Tidak bisa memindai? Ketik kunci ini:</small><code>${esc(sec)}</code>
        <button type="button" class="chip" data-act="copy-key" data-v="${esc(res.secret)}">${ic('copy')} Salin kunci</button></div></div>
      ${IS_MOBILE || IN_APP ? `<a class="btn ghost block ga-open" href="${esc(res.uri)}">${ic('shield')} Buka di Google Authenticator</a>
      <p class="xs muted" style="margin:-4px 0 0">QR tidak bisa dipindai dari layar HP yang sama. Ketuk tombol di atas, atau salin kunci lalu pilih <b>Masukkan kunci penyiapan</b> di Google Authenticator.</p>` : ''}`
      : `<p class="small muted">Buka aplikasi Google Authenticator di HP Anda, lalu ketik 6 angka untuk <b>Khenambay DPMPTSP</b>. Kode berganti tiap 30 detik.</p>`}
    <form id="otp-form" class="stack" novalidate>${otpBoxes()}<div class="otp-timer" aria-hidden="true"><i></i></div>
      <div class="otp-err card coral small" hidden></div>
      <button type="submit" class="btn block">${setup ? 'Aktifkan & masuk' : 'Masuk'}</button></form>
    <a href="#/masuk/${role}" class="small" style="justify-self:start">${ic('back', 'style="width:14px;height:14px;vertical-align:-2px"')} Pakai akun lain</a>`;
  const f = card.querySelector('#otp-form'); let busy = false;
  const go = async () => {
    if (busy) return; const kode = otpValue(f); if (kode.length < 6) return otpError(f, 'Lengkapi 6 angka.');
    busy = true; const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Memeriksa…';
    try { const r = await api(setup ? '/api/auth/otp-setup' : '/api/auth/otp', { method: 'POST', noAuth: true, body: { ticket: res.ticket, kode } }); card.classList.add('otp-ok'); await afterAuth(r, '#/' + role); }
    catch (x) { busy = false; btn.disabled = false; btn.textContent = setup ? 'Aktifkan & masuk' : 'Masuk'; if (x.status === 401 && /habis|awal/i.test(x.message)) { toast(x.message, 'warn'); return render(); } otpError(f, x.message || 'Kode salah'); }
  };
  f.addEventListener('submit', (e) => { e.preventDefault(); go(); });
  wireOtp(f, go);
  const bar = f.querySelector('.otp-timer i'); const tick = () => { if (!document.body.contains(bar)) return; bar.style.width = (100 - ((Date.now() / 1000) % 30) / 30 * 100) + '%'; requestAnimationFrame(tick); }; tick();
}
/** Lupa kata sandi: investor lewat kode email, pendata/admin lewat Google Authenticator. */
function vLupa(role) {
  role = ['investor', 'pendata', 'admin'].includes(role) ? role : 'investor';
  const L = S.lupa && S.lupa.role === role ? S.lupa : (S.lupa = { role, step: 1, email: '' });
  const staff = role !== 'investor';
  let inner;
  if (staff) {
    inner = `<div class="otp-head"><span class="ga-ic" aria-hidden="true">${ic('shield')}</span><div><div class="label">Lupa kata sandi · ${role === 'admin' ? 'Admin DPMPTSP' : 'Pendata lapangan'}</div><h1 style="font-size:23px">Reset dengan Google Authenticator</h1></div></div>
      <p class="small muted">Masukkan email akun, 6 angka dari Google Authenticator, lalu kata sandi baru. Belum pernah mengaktifkan authenticator? Minta admin DPMPTSP mereset akun Anda.</p>
      <form id="lupa-form" class="stack" data-mode="otp" novalidate>
        <label class="field">Email<input name="email" type="email" autocomplete="username" required value="${esc(L.email)}"></label>
        <div class="label">Kode Google Authenticator</div>${otpBoxes()}
        <label class="field">Kata sandi baru <span class="hint">minimal 8 karakter, huruf dan angka</span><input name="baru" type="password" autocomplete="new-password" data-pwmeter required></label><div class="pwm"><i></i><i></i><i></i><i></i></div>
        <div class="otp-err card coral small" hidden></div>
        <button type="submit" class="btn block">Simpan kata sandi baru</button></form>`;
  } else if (L.step === 1) {
    inner = `<div class="otp-head"><span class="ga-ic mail" aria-hidden="true">${ic('send')}</span><div><div class="label">Lupa kata sandi · Investor</div><h1 style="font-size:23px">Kirim kode ke email</h1></div></div>
      <p class="small muted">Kami kirim 6 angka ke email akun investor Anda. Kode berlaku 15 menit.</p>
      <form id="lupa-form" class="stack" data-mode="kirim" novalidate>
        <label class="field">Email<input name="email" type="email" autocomplete="username" required value="${esc(L.email)}"></label>
        <div class="otp-err card coral small" hidden></div>
        <button type="submit" class="btn block">${ic('send')} Kirim kode</button></form>`;
  } else {
    inner = `<div class="otp-head"><span class="ga-ic mail" aria-hidden="true">${ic('send')}</span><div><div class="label">Langkah 2 · ${esc(L.email)}</div><h1 style="font-size:23px">Masukkan kode dari email</h1></div></div>
      ${L.demo ? `<div class="card amber small demo-code"><b>Mode demo:</b> email belum diatur di <code>app/config.php</code>, jadi kodenya ditampilkan di sini: <b class="mono">${esc(L.demo)}</b></div>` : `<p class="small muted">${esc(L.pesan || 'Cek kotak masuk atau folder spam.')}</p>`}
      <form id="lupa-form" class="stack" data-mode="reset" novalidate>${otpBoxes()}
        <label class="field">Kata sandi baru <span class="hint">minimal 8 karakter, huruf dan angka</span><input name="baru" type="password" autocomplete="new-password" data-pwmeter required></label><div class="pwm"><i></i><i></i><i></i><i></i></div>
        <div class="otp-err card coral small" hidden></div>
        <button type="submit" class="btn block">Simpan kata sandi baru</button>
        <button type="button" class="chip" data-act="lupa-ulang" style="justify-self:start">Kirim ulang kode</button></form>`;
  }
  return authShell(`<div class="card stack otp-card" style="color:var(--ink)">${inner}</div>
    <a class="btn ghost block" href="#/masuk/${role}">${ic('back')} Kembali ke halaman masuk</a>`, role === 'investor');
}
async function lupaSubmit(f) {
  const L = S.lupa; const err = f.querySelector('.otp-err'); err.hidden = true;
  const btn = f.querySelector('button[type=submit]'); const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Memproses…';
  try {
    const mode = f.dataset.mode;
    if (mode === 'kirim') {
      L.email = f.email.value.trim();
      const r = await api('/api/auth/lupa', { method: 'POST', noAuth: true, body: { email: L.email } });
      Object.assign(L, { step: 2, demo: r.demo_kode || null, pesan: r.pesan }); toast('Kode dikirim. Cek email Anda.', 'ok'); return rerender();
    }
    const kode = otpValue(f); if (kode.length < 6) throw new Error('Lengkapi 6 angka kode.');
    if (mode === 'reset') await api('/api/auth/reset', { method: 'POST', noAuth: true, body: { email: L.email, kode, baru: f.baru.value } });
    else await api('/api/auth/reset-otp', { method: 'POST', noAuth: true, body: { email: f.email.value.trim(), kode, baru: f.baru.value } });
    S.lupa = null; toast('Kata sandi baru tersimpan. Silakan masuk.', 'ok'); location.hash = '#/masuk/' + L.role;
  } catch (x) { btn.disabled = false; btn.innerHTML = label; if (f.querySelector('.otp') && /kode/i.test(x.message)) otpError(f, x.message); else { err.hidden = false; err.textContent = x.message || 'Tidak bisa terhubung ke server.'; } }
}
async function afterAuth(res, def, direct) {
  S.auth = { token: res.token, user: res.user }; LS.set('auth', S.auth); setKyc(res.kyc); S.kf = null; S.kycSaved = null;
  if (res.user.role === 'investor') loadKyc();
  if (res.user.role === 'pendata') { S.settings.nama = res.user.nama; if (res.user.distrik) S.settings.distrik = res.user.distrik; LS.set('settings', S.settings); }
  await idb.put('cache', { id: 'minat', items: [] });
  try { await refresh(); } catch { /* offline */ }
  await loadLocal();
  toast(`Selamat datang, ${res.user.nama.split(' ')[0]}!`, 'ok');
  location.hash = direct ? def : nextOf(def);
  sync();
}
async function logout() {
  const pending = S.outbox.length;
  if (!confirm(pending ? `Masih ada ${pending} perubahan yang belum terkirim. Data itu tetap tersimpan di perangkat dan dikirim saat Anda masuk lagi. Keluar sekarang?` : 'Keluar dari akun ini?')) return;
  if (S.online || LOCAL) { try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* abaikan */ } }
  S.auth = null; LS.set('auth', null); LS.set('role', null); S.chat = {}; S.kyc = null; LS.set('kyc', null); S.kf = null; S.kycSaved = null; S.akyc = null; S.akycD = null; S.audit = null;
  await idb.put('cache', { id: 'potensi', items: S.potensi.filter((p) => p.status === 'Terbit').map((p) => ({ ...p, data: { ...p.data, kontak: undefined, irr: undefined, payback: undefined, pendata: undefined } })), role: 'tamu' });
  await idb.put('cache', { id: 'minat', items: [] });
  await loadLocal(); location.hash = '#/'; toast('Anda sudah keluar', 'ok');
  if (S.online || LOCAL) refresh().then(loadLocal).catch(() => {});
}
const lockCard = (text, next) => `<div class="card soft stack-s" style="text-align:center"><span style="font-size:26px">🔒</span><b>${text}</b>
  <div class="row" style="justify-content:center"><a class="btn sm" href="${loginHref('investor', next)}">Masuk</a><a class="btn sm ghost" href="#/daftar?next=${encodeURIComponent(next || location.hash)}">Daftar gratis</a></div></div>`;

// =====================================================================
// PENDATA
// =====================================================================
function myItems() {
  const ids = new Set(S.mine.map((m) => m.id));
  const local = S.mine.map((m) => {
    const st = m.state === 'antre' ? 'Antre di HP' : m.state === 'draf' ? 'Draf' : m.state === 'konflik' ? 'Konflik' : m.server?.status || 'Menunggu verifikasi';
    return { id: m.id, data: m.data, status: st, level: m.server?.level || 1, catatan: m.server?.catatan, t: m.updatedAt, local: m };
  });
  const srv = S.potensi.filter((p) => !ids.has(p.id) && p.data.pendata === (me()?.nama || S.settings.nama)).map((p) => ({ id: p.id, data: p.data, status: p.status, level: p.level, catatan: p.catatan, t: p.updatedAt * 1000 }));
  return [...local, ...srv].sort((a, b) => b.t - a.t);
}
function districtStats() {
  const c = Object.fromEntries(DISTRIK.map(([n]) => [n, { nama: n, n: 0, sek: {} }]));
  S.potensi.filter((p) => p.status !== 'Perlu perbaikan').forEach((p) => { const x = c[p.data.distrik]; if (x) { x.n++; x.sek[p.data.sektor] = (x.sek[p.data.sektor] || 0) + 1; } });
  return Object.values(c);
}
function notifList() {
  const out = [];
  myItems().forEach((it) => {
    if (it.status === 'Terbit') out.push({ k: 'terbit', icon: 'check', col: 'var(--green)', t: it.t, title: `${it.data.nama} terbit di peta investor`, sub: `Level ${it.level} · ${LEVELS[it.level]}`, go: `#/pendata/data/${it.id}` });
    if (it.status === 'Perlu perbaikan') out.push({ k: 'fix', icon: 'alert', col: 'var(--coral)', t: it.t, title: `${it.data.nama} perlu perbaikan`, sub: it.catatan || 'Lihat catatan admin', go: `#/pendata/data/${it.id}` });
    if (it.status === 'Konflik') out.push({ k: 'fix', icon: 'alert', col: 'var(--coral)', t: it.t, title: `${it.data.nama} diubah admin saat Kakak offline`, sub: 'Pilih versi yang dipakai', go: `#/pendata/data/${it.id}` });
  });
  LS.get('notifs', []).forEach((n) => out.push({ k: n.kind, icon: 'sync', col: 'var(--teal2)', t: n.t, title: n.text, sub: 'Sinkronisasi otomatis', go: '#/pendata/data' }));
  const low = districtStats().sort((a, b) => a.n - b.n)[0];
  if (low) out.push({ k: 'cenra', cenra: true, t: Date.now() - 86400000, title: low.n ? `Cenra: Distrik ${low.nama} baru punya ${low.n} data` : `Cenra: Distrik ${low.nama} belum punya data potensi`, sub: 'Ketuk untuk tanya Cenra distrik mana yang perlu didata', ask: 'Distrik paling sedikit data' });
  return out.sort((a, b) => b.t - a.t);
}
function pHome() {
  const items = myItems();
  const antre = S.outbox.filter((o) => o.kind === 'potensi');
  const sent = items.filter((i) => ['Terbit', 'Menunggu verifikasi'].includes(i.status)).length;
  const fix = items.filter((i) => ['Perlu perbaikan', 'Konflik'].includes(i.status)).length;
  const ds = districtStats(); const mineD = ds.find((d) => d.nama === S.settings.distrik) || ds[0];
  const rank = [...ds].sort((a, b) => b.n - a.n).findIndex((d) => d.nama === mineD.nama) + 1;
  const target = 25; const pct = Math.min(100, Math.round((mineD.n / target) * 100));
  const stale = pub().filter((p) => days(p.updatedAt) > 20 && !S.reviewed.includes(p.id) && (p.data.distrik === S.settings.distrik || p.data.pendata === S.settings.nama)).sort((a, b) => a.updatedAt - b.updatedAt)[0];
  const hour = new Date().getHours(); const salam = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
  const inits = initials(me().nama);
  const unread = notifList().filter((x) => x.t > S.notifSeen).length;
  return `<div class="page">
    <section class="ph-hero">${window.KPapua ? KPapua.once('hbird', { w: 88, top: 4, span: '90vw', dur: 4.4 }) : ''}
      <div class="row"><a href="#/pendata/profil" class="avatar-txt" aria-label="Profil" style="text-decoration:none">${esc(inits)}</a>
        <div class="grow"><div class="ph-hi">${salam} 👋</div><div class="ph-name">${esc(me().nama)}</div></div>
        <span class="pill ${S.online ? 'on' : 'off'}">${S.online ? 'Online' : 'Offline'}</span></div>
      <a class="ph-goal" href="#/pendata/data">
        <span class="ring" style="--p:${pct}"><b>${pct}%</b></span>
        <span class="grow"><b>Target Distrik ${esc(mineD.nama)}</b><small>${mineD.n} dari ${target} data · peringkat ${rank} dari 19 distrik</small>
          <span class="ph-next">${Math.max(0, target - mineD.n)} data lagi untuk capai target</span></span>
      </a>
    </section>
    <div class="bento" role="navigation" aria-label="Menu pendata">
      <a class="bt bt-big clay-ember" href="#/pendata/baru"><span class="bt-ic">${ic('mic')}</span><span class="bt-t">Catat potensi baru</span><span class="bt-s">Cukup cerita, Cenra yang isi formulirnya</span><span class="bt-go">${ic('plus')}</span></a>
      <a class="bt clay-sand" href="#/pendata/data"><span class="bt-ic">${ic('list')}</span><b class="bt-n">${sent}</b><span class="bt-t">Terkirim</span></a>
      <a class="bt clay-olive" href="#/pendata/data"><span class="bt-ic">${ic('sync')}</span><b class="bt-n">${antre.length}</b><span class="bt-t">Antre di HP</span></a>
      <a class="bt ${fix ? 'clay-sun' : 'clay-night'}" href="#/pendata/data?f=perbaikan"><span class="bt-ic">${ic('alert')}</span><b class="bt-n">${fix}</b><span class="bt-t">Perlu dicek</span></a>
      <a class="bt clay-night" href="#/pendata/notif"><span class="bt-ic">${ic('bell')}</span><b class="bt-n">${unread}</b><span class="bt-t">Notifikasi baru</span></a>
      <button type="button" class="bt bt-wide clay-night" data-open-cenra="faq"><span class="bt-ic"><img src="${CENRA_IMG.senang}" alt=""></span><span class="bt-t">Panduan dari Cenra</span><span class="bt-s">Cara isi lewat suara, GPS, dan foto</span></button>
    </div>
    ${stale ? `<div class="card amber stack-s"><div class="row">${ic('sync')}<div class="grow"><b>Data perlu dicek ulang</b><div class="xs" style="color:var(--amberD)">${esc(stale.data.nama)} · terakhir diperbarui ${ago(stale.updatedAt)}</div></div></div>
      <div class="row"><button type="button" class="chip on" data-act="reviewed" data-id="${esc(stale.id)}">✓ Masih sama</button><button type="button" class="chip" data-go="#/pendata/ubah/${esc(stale.id)}">Perbarui data</button></div></div>` : ''}
    ${antre.length ? `<div class="label">Antrean di HP</div>${antre.map((o) => `<a class="item" href="#/pendata/data/${esc(o.id)}"><span class="ic" style="background:var(--soft);color:var(--teal)">${ic('sync')}</span><span class="grow"><b>${esc(o.data.nama)}</b><small>${esc(o.data.distrik || '')} · ${o.photos?.length || 0} foto</small></span><span class="badge b-a">${S.online ? 'Mengirim…' : 'Menunggu sinyal'}</span></a>`).join('')}` : ''}
    ${antre.length && !S.online ? cenraTip(`${antre.length} data menunggu sinyal. Tenang, Cenra kirim otomatis begitu HP terhubung.`, 'berpikir') : ''}
  </div>`;
}

// ---------- formulir 4 langkah ----------
let D = null; // draf aktif
let geoWatch = null, recog = null;
function newDraft(edit) {
  if (edit) {
    const m = S.mine.find((x) => x.id === edit);
    if (m) return { id: m.id, step: 1, data: structuredClone(m.data), photos: [...(m.photos || [])], baseVersion: m.version ?? m.server?.version, story: '', lang: 'id', editing: true };
    const p = byId(edit);
    if (p) return { id: p.id, step: 1, data: { ...structuredClone(p.data), pendata: S.settings.nama }, photos: [], baseVersion: p.version, story: '', lang: 'id', editing: true };
  }
  const saved = LS.get('draft', null);
  if (saved && !saved.editing) return saved;
  return { id: uid(), step: 1, data: { nama: '', sektor: '', distrik: S.settings.distrik, kampung: '', lat: null, lon: null, akurasi: null, luas: null, satuan: 'ha', produksi: '', lahan: '', adat: '', musyawarah: '', infra: [], nilai: null, kontak: '', catatan: '', pendata: me()?.nama || S.settings.nama, setuju: false }, photos: [], story: '', lang: 'id' };
}
function persistDraft() { if (D && !D.editing) LS.set('draft', { ...D, photos: [] }); }
function completeness(d, photos) {
  const req = [d.lat != null, !!d.sektor, !!d.nama, !!d.luas, !!d.lahan, (d.infra || []).length > 0, photos.length > 0, !!d.kontak, !!d.setuju];
  return Math.round((req.filter(Boolean).length / req.length) * 100);
}
function pForm(editId) {
  if (!D || (editId && D.id !== editId) || (!editId && D.editing)) D = newDraft(editId);
  const d = D.data; const st = D.step;
  const titles = ['', 'Lokasi', 'Potensi', 'Lahan & adat', 'Bukti & kirim'];
  return `<div class="page">
    <div class="head"><a class="back" href="#/pendata" aria-label="Kembali ke beranda">${ic('back')}</a>
      <div class="grow"><div class="label" style="color:var(--teal)">${D.editing ? 'Perbarui data · ' : ''}Langkah ${st} dari 4</div><h1 style="font-size:22px">${titles[st]}</h1></div>
      ${S.online ? '' : `<span class="badge b-a">${ic('wifiOff', 'style="width:14px;height:14px"')} Offline</span>`}</div>
    <div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>
    <div id="step">${[null, step1, step2, step3, step4][st]()}</div>
    <div class="actionbar">
      ${st > 1 ? `<button type="button" class="btn ghost" data-act="step" data-d="-1">${ic('back')} Kembali</button>` : `<button type="button" class="btn ghost" data-act="draft-reset">Mulai ulang</button>`}
      ${st < 4 ? `<button type="button" class="btn grow" data-act="step" data-d="1">Lanjut ${ic('chev')}</button>` : `<button type="button" class="btn grow" data-act="submit">${D.editing ? 'Simpan perubahan' : 'Simpan & kirim'}</button>`}
    </div></div>`;
}
function step1() {
  const d = D.data; const locked = d.lat != null && D.locked !== false;
  const W = 360, H = 220;
  let extra = '';
  if (d.lat != null) {
    const [x, y] = proj(d.lat, d.lon, W, H);
    extra = findDuplicates(d, D.id).slice(0, 3).map((x2) => { const [a, b] = proj(x2.p.data.lat, x2.p.data.lon, W, H); return `<circle cx="${a}" cy="${b}" r="6" fill="#F2B33D" stroke="#fff" stroke-width="2"/>`; }).join('') +
      `<circle cx="${x}" cy="${y}" r="16" fill="rgba(25,163,155,.18)" stroke="#19A39B"/>`;
  }
  const checks = d.lat != null ? (() => {
    const dup = findDuplicates(d, D.id); const sea = isSea(d.lat, d.lon); const box = inBox(d.lat, d.lon);
    return `<div class="stack-s">
      ${!box ? `<div class="card coral small">${ic('alert')} Titik berada di luar Kabupaten Jayapura. Pastikan GPS sudah benar.</div>` : sea ? `<div class="card coral small">${ic('alert')} Titik ini tampak berada di laut. Ambil ulang saat sudah di daratan.</div>` : `<div class="card soft small"><b style="color:var(--green)">✓ Lokasi di daratan</b> · sekitar Distrik ${esc(nearestDistrik(d.lat, d.lon).nama)}</div>`}
      ${dup.length ? `<div class="card amber small"><b>Cenra menemukan data mirip di dekat sini</b><br>${dup.slice(0, 2).map((x) => `${esc(x.p.data.nama)} · ${fmtNum(x.m, 0)} m · ${x.p.status}`).join('<br>')}<br><span class="xs muted">Kalau potensinya sama, cukup perbarui data yang ada.</span>
        <div class="row" style="margin-top:8px"><button type="button" class="chip" data-go="#/pendata/ubah/${esc(dup[0].p.id)}">Perbarui data itu</button></div></div>` : `<div class="card soft small"><b style="color:var(--green)">✓ Tidak ada data ganda</b> dalam radius 300 m</div>`}
    </div>`;
  })() : '';
  return `<div class="stack">
    <div class="gps">${baseMapSVG(W, H, extra, { labels: false, attr: 'class="map" preserveAspectRatio="xMidYMid slice"' })}
      ${d.lat != null ? `<span class="pulse ${locked ? 'locked' : ''}" style="left:${(proj(d.lat, d.lon, W, H)[0] / W) * 100}%;top:${(proj(d.lat, d.lon, W, H)[1] / H) * 100}%"></span>` : ''}
      <div class="acc" id="gps-msg">${d.lat != null ? `<b>${locked ? '🔒 Lokasi terkunci' : 'Mencari…'}</b> · ${d.lat.toFixed(5)}, ${d.lon.toFixed(5)} · ±${d.akurasi ?? '?'} m` : 'Lokasi belum diambil. Berdiri di lokasi potensi, lalu ketuk "Kunci lokasi GPS".'}</div></div>
    <div class="row wrap"><button type="button" class="btn grow" data-act="gps">${ic('pin')} ${d.lat != null ? 'Ambil ulang GPS' : 'Kunci lokasi GPS'}</button>
      <button type="button" class="btn ghost" data-act="gps-demo" title="Untuk mencoba di laptop tanpa GPS">Pakai titik contoh</button></div>
    ${checks}
    <div class="grid2"><label class="field">Distrik<select data-f="distrik">${DISTRIK.map(([n]) => `<option${n === d.distrik ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">Kampung<input data-f="kampung" value="${esc(d.kampung)}" placeholder="Nama kampung"></label></div>
  </div>`;
}
function step2() {
  const d = D.data;
  return `<div class="stack">
    <div class="label">Sektor</div>
    <div class="sector-grid">${Object.keys(SECTORS).map((k) => `<button type="button" class="sector" aria-pressed="${d.sektor === k}" data-act="sektor" data-v="${k}">${secIcon(k, 38)}${k}</button>`).join('')}</div>
    <div class="card stack" style="text-align:center">
      <b>Ceritakan potensinya</b><p class="small muted">Bicara atau ketik seperti bercerita. Cenra mengubahnya menjadi isian formulir.</p>
      ${srClass() ? `<button type="button" class="mic" id="mic" data-act="mic" aria-label="Rekam suara">${ic('mic')}</button><div class="wave" id="wave" hidden>${Array.from({ length: 9 }, (_, i) => `<i style="animation-delay:${i * 0.09}s"></i>`).join('')}</div>` : ''}
      <label class="field" style="text-align:left"><span class="sr-only">Cerita potensi</span><textarea id="story" placeholder="Contoh: Kebun kakao rakyat di Kampung Genyem seluas 300 hektar, produksi 120 ton per tahun. Jalan aspal dan listrik PLN ada. Tanah adat Ondoafi Genyem, musyawarah sedang berjalan. Narahubung koperasi petani kakao.">${esc(D.story)}</textarea></label>
      <button type="button" class="btn dark" data-act="parse">${ic('spark')} Isi otomatis dengan Cenra</button>
      <div id="parse-msg"></div>
    </div>
    <label class="field">Nama potensi<input data-f="nama" value="${esc(d.nama)}" placeholder="mis. Kebun Kakao Rakyat Genyem"></label>
    <div class="grid2"><label class="field">Luas / kapasitas<input data-f="luas" inputmode="decimal" value="${d.luas ?? ''}" placeholder="mis. 300"></label>
      <label class="field">Satuan<select data-f="satuan">${SATUAN.map((s) => `<option${s === d.satuan ? ' selected' : ''}>${s}</option>`).join('')}</select></label></div>
    <label class="field">Produksi (opsional)<input data-f="produksi" value="${esc(d.produksi)}" placeholder="mis. 120 ton/tahun"></label>
    <div class="label">Infrastruktur pendukung</div>
    <div class="chips">${INFRA.map((x) => `<button type="button" class="chip" aria-pressed="${(d.infra || []).includes(x)}" data-act="infra" data-v="${x}">${x}</button>`).join('')}</div>
    <label class="field">Catatan<textarea data-f="catatan" placeholder="Gambaran singkat potensi">${esc(d.catatan)}</textarea></label>
  </div>`;
}
function step3() {
  const d = D.data;
  return `<div class="stack">
    <div class="label">Status lahan</div>
    <div class="chips">${LAHAN.map((x) => `<button type="button" class="chip" aria-pressed="${d.lahan === x}" data-act="lahan" data-v="${x}">${x}</button>`).join('')}</div>
    ${d.lahan === 'Tanah adat' ? `<div class="card soft stack">
      ${cenraTip('Tanah adat wajib melalui musyawarah. Status ini ditampilkan jujur kepada investor, supaya tidak ada janji lahan sebelum adat setuju.', 'menyapa')}
      <label class="field">Pihak adat (ondoafi / pemilik hak ulayat)<input data-f="adat" value="${esc(d.adat)}" placeholder="mis. Ondoafi Genyem"></label>
      <div class="label">Tahap musyawarah</div>
      <div class="chips">${MUSY.map((x) => `<button type="button" class="chip" aria-pressed="${d.musyawarah === x}" data-act="musy" data-v="${x}">${x}</button>`).join('')}</div></div>` : ''}
    <label class="field">Narahubung di lokasi<input data-f="kontak" value="${esc(d.kontak)}" placeholder="mis. Kepala kampung atau koperasi"></label>
    <label class="field">Estimasi nilai investasi (Rp)<input data-f="nilai" inputmode="numeric" value="${d.nilai ?? ''}" placeholder="mis. 9000000000"><span class="hint" id="nilai-fmt">${d.nilai ? rp(d.nilai) : 'Boleh dikosongkan kalau belum tahu'}</span></label>
  </div>`;
}
function step4() {
  const d = D.data; const pct = completeness(d, D.photos);
  return `<div class="stack">
    <div class="card stack-s"><div class="row between"><b>Kelengkapan data</b><b style="color:var(--teal)">${pct}%</b></div><div class="track"><i style="width:${pct}%"></i></div>
      <span class="xs muted">${missing(d).length ? 'Belum diisi: ' + missing(d).join(', ') : 'Semua isian penting sudah lengkap.'}</span></div>
    <div class="label">Foto lapangan (maks. 3, langsung dari kamera)</div>
    <div class="photos">${D.photos.map((p, i) => `<div class="photo"><img src="${p}" alt="Foto ${i + 1}"><button type="button" data-act="rmphoto" data-i="${i}" aria-label="Hapus foto ${i + 1}">${ic('close')}</button></div>`).join('')}
      ${D.photoBusy ? `<div class="photo add busy"><span class="spin">${ic('sync')}</span><br>Membaca lokasi…</div>` : D.photos.length < 3 ? `<label class="photo add">${ic('cam')}<br>Ambil foto<input type="file" accept="image/*" capture="environment" id="photo-in" class="sr-only"></label>` : ''}</div>
    ${fotoLokasi(D.data)}
    <p class="xs muted">Setiap foto otomatis diberi cap seperti kamera GPS: tanggal, arah kompas, nama jalan, kampung, distrik, kabupaten, provinsi, ketinggian, kecepatan, dan peta mini${S.settings.compress ? '. Foto lalu dikompres supaya hemat kuota' : ''}.</p>
    <div class="ai-box"><div class="row between"><b>${ic('spark')} Ringkasan otomatis Cenra</b>
      <div class="seg" style="background:rgba(255,255,255,.12)"><button type="button" data-act="lang" data-v="id" aria-selected="${D.lang === 'id'}" style="${D.lang === 'id' ? '' : 'color:#fff'}">ID</button><button type="button" data-act="lang" data-v="en" aria-selected="${D.lang === 'en'}" style="${D.lang === 'en' ? '' : 'color:#fff'}">EN</button></div></div>
      <p class="small" style="opacity:.9">${esc(ringkas(d, D.lang))}</p></div>
    <label class="check"><input type="checkbox" data-f="setuju" ${d.setuju ? 'checked' : ''}> Narahubung setuju kontaknya dihubungi DPMPTSP</label>
    <p class="xs muted">${S.online ? 'Data langsung dikirim ke DPMPTSP.' : 'Sedang offline: data disimpan di HP dan dikirim otomatis saat ada sinyal.'}</p>
  </div>`;
}
function fotoLokasi(d, compact) {
  const ms = (d.fotoMeta || []).filter((m) => m && m.lat != null);
  if (!ms.length) return '';
  const m = ms[ms.length - 1];
  const tag = m.sumber === 'osm' ? 'OpenStreetMap' : m.sumber === 'offline' ? 'daftar kampung offline' : 'GPS';
  return `<div class="geo-card${compact ? ' compact' : ''}"><span class="geo-pin">${ic('pin')}</span><div class="grow"><b>Lokasi foto terbaca</b>
    <p>${esc(m.alamat)}</p>
    <div class="geo-tags"><span>${ic('map')} ${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}</span>${m.alt != null ? `<span>Ketinggian ${m.alt} m</span>` : ''}${m.arah != null ? `<span>Arah ${m.arah}°</span>` : ''}<span>±${m.acc ?? '?'} m</span><span>${new Date(m.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
    <small>Nama tempat dari ${tag}${ms.length > 1 ? ` · ${ms.length} foto bercap` : ''}</small></div></div>`;
}
function missing(d) {
  const m = []; if (d.lat == null) m.push('lokasi GPS'); if (!d.sektor) m.push('sektor'); if (!d.nama) m.push('nama potensi'); if (!d.luas) m.push('luas'); if (!d.lahan) m.push('status lahan');
  if (!(d.infra || []).length) m.push('infrastruktur'); if (!D.photos.length) m.push('foto'); if (!d.kontak) m.push('narahubung'); if (!d.setuju) m.push('persetujuan narahubung');
  return m;
}
function stepValid(st) {
  const d = D.data;
  if (st === 1 && d.lat == null) return 'Kunci lokasi GPS dulu (atau pakai titik contoh untuk mencoba).';
  if (st === 2 && !d.sektor) return 'Pilih sektor dulu.';
  if (st === 2 && !d.nama.trim()) return 'Isi nama potensi, atau ceritakan lalu ketuk "Isi otomatis".';
  if (st === 3 && !d.lahan) return 'Pilih status lahan.';
  if (st === 4 && !D.photos.length) return 'Tambahkan minimal satu foto lapangan.';
  return null;
}
function startGPS(demo) {
  const d = D.data;
  if (demo) {
    const base = [[-2.6385, 140.1705], [-2.613, 140.586], [-2.861, 140.247], [-2.70, 139.985]][Math.floor(Math.random() * 4)];
    Object.assign(d, { lat: base[0] + (Math.random() - 0.5) * 0.004, lon: base[1] + (Math.random() - 0.5) * 0.004, akurasi: 4 });
    d.distrik = nearestDistrik(d.lat, d.lon).nama; D.locked = true; persistDraft(); return rerender();
  }
  if (!('geolocation' in navigator)) return toast('Perangkat ini tidak punya GPS. Pakai titik contoh untuk mencoba.', 'warn');
  if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch);
  D.locked = false; $('#gps-msg') && ($('#gps-msg').innerHTML = '<b>Mencari sinyal GPS…</b> GPS bekerja tanpa internet. Tunggu sampai akurasi di bawah 10 m.');
  const t0 = Date.now();
  geoWatch = navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude, accuracy } = pos.coords;
    Object.assign(d, { lat: latitude, lon: longitude, akurasi: Math.round(accuracy) });
    const good = accuracy <= 10 || (Date.now() - t0 > 25000 && accuracy <= 50);
    if (good) { navigator.geolocation.clearWatch(geoWatch); geoWatch = null; D.locked = true; if (inBox(latitude, longitude)) d.distrik = nearestDistrik(latitude, longitude).nama; persistDraft(); rerender(); toast('Lokasi terkunci ±' + Math.round(accuracy) + ' m', 'ok'); }
    else if ($('#gps-msg')) $('#gps-msg').innerHTML = `<b>Mengunci…</b> akurasi ±${Math.round(accuracy)} m (butuh di bawah 10 m)`;
  }, (err) => { geoWatch = null; toast(err.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi di browser.' : 'GPS belum dapat sinyal. Coba di tempat terbuka.', 'warn'); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
}
async function addPhoto(file) {
  if (!file) return;
  const d = D.data;
  if (!window.KStamp) return toast('Modul cap lokasi belum termuat. Muat ulang halaman.', 'warn');
  const tId = toast('Membaca lokasi dan memberi cap pada foto…', 'info');
  D.photoBusy = true; rerender();
  try {
    const idx = (LS.get('fotoIndex', 0) || 0) + 1; LS.set('fotoIndex', idx);
    const { url, meta } = await KStamp.stamp(file, { fallback: d.lat != null ? { lat: d.lat, lon: d.lon, acc: d.akurasi } : null, api,
      max: S.settings.compress ? 1280 : 1920, quality: S.settings.compress ? 0.66 : 0.85, index: idx });
    D.photos.push(url);
    d.fotoMeta = [...(d.fotoMeta || []).slice(0, D.photos.length - 1), meta];
    if (meta.lat != null) {
      d.lokasiFoto = meta.alamat;
      if (!d.kampung && meta.kampung) d.kampung = meta.kampung.replace(/^(sekitar|kampung|desa|kelurahan)\s+/i, '');
      const dn = (meta.distrik || '').replace(/^(distrik|kecamatan)\s+/i, '');
      if (DISTRIK.some((x) => x[0].toLowerCase() === dn.toLowerCase())) d.distrik = DISTRIK.find((x) => x[0].toLowerCase() === dn.toLowerCase())[0];
      if (d.lat == null) Object.assign(d, { lat: meta.lat, lon: meta.lon, akurasi: meta.acc });
    }
    persistDraft();
    toast(meta.lat != null ? `Foto diberi cap: ${meta.kampung || meta.distrik || 'lokasi'} terbaca` : 'Foto disimpan, tapi GPS belum dapat sinyal', meta.lat != null ? 'ok' : 'warn');
  } catch { toast('Foto tidak bisa dibaca. Coba ambil ulang.', 'warn'); }
  finally { D.photoBusy = false; rerender(); }
}
async function submitForm() {
  const err = [1, 2, 3, 4].map(stepValid).find(Boolean);
  if (err) return toast(err, 'warn');
  const d = D.data; d.distrik = d.distrik || nearestDistrik(d.lat, d.lon).nama; d.ringkasan = ringkas(d, 'id'); d.ringkasanEn = ringkas(d, 'en');
  const rec = { id: D.id, data: d, photos: D.photos, state: 'antre', updatedAt: Date.now(), version: D.baseVersion ?? null, server: null };
  await idb.put('mine', rec);
  await idb.put('outbox', { id: D.id, kind: 'potensi', data: d, photos: D.photos, baseVersion: D.baseVersion ?? null, t: Date.now() });
  const id = D.id; LS.set('draft', null); D = null;
  await loadLocal();
  location.hash = `#/pendata/data/${id}`;
  toast(S.online ? 'Data disimpan. Mengirim ke DPMPTSP…' : 'Tersimpan aman di HP. Dikirim otomatis saat ada sinyal.', S.online ? 'ok' : 'warn');
  if (S.online) sync();
}

function pRiwayat() {
  const f = new URLSearchParams(location.hash.split('?')[1] || '').get('f') || 'semua';
  const all = myItems();
  const groups = { semua: all, antre: all.filter((i) => ['Antre di HP', 'Draf'].includes(i.status)), perbaikan: all.filter((i) => ['Perlu perbaikan', 'Konflik'].includes(i.status)),
    menunggu: all.filter((i) => i.status === 'Menunggu verifikasi'), terbit: all.filter((i) => i.status === 'Terbit') };
  const list = groups[f] || all;
  return `<div class="page">
    <div class="head"><div class="grow"><h1>Data saya</h1><p class="small muted">${all.length} data · ${groups.terbit.length} terbit</p></div></div>
    <div class="chips scroll">${[['semua', 'Semua'], ['antre', 'Antre'], ['menunggu', 'Menunggu'], ['perbaikan', 'Perbaikan'], ['terbit', 'Terbit']].map(([k, l]) => `<a class="chip${f === k ? ' on' : ''}" href="#/pendata/data?f=${k}">${l} ${groups[k].length}</a>`).join('')}</div>
    ${list.length ? list.map((i) => `<a class="item" href="#/pendata/data/${esc(i.id)}" style="${i.status === 'Perlu perbaikan' ? 'border-color:#F1C6C1' : ''}">${secIcon(i.data.sektor, 40)}
      <span class="grow"><b>${esc(i.data.nama)}</b><small>${esc(i.data.distrik || '')} · ${ago(i.t)}</small></span>${statusBadge(i.status === 'Terbit' ? 'Terbit' : i.status)}</a>`).join('')
      : `<div class="card flat" style="text-align:center"><p class="muted">Belum ada data di sini.</p></div>`}
    ${groups.terbit.length ? cenraTip(`Kak ${esc(S.settings.nama.split(' ')[0])} sudah ${groups.terbit.length} data terbit. Terima kasih sudah mendata!`, 'senang') : ''}
  </div>`;
}
function pDetail(id) {
  const it = myItems().find((x) => x.id === id) || (byId(id) && { id, data: byId(id).data, status: byId(id).status, level: byId(id).level, catatan: byId(id).catatan, t: byId(id).updatedAt * 1000 });
  if (!it) return `<div class="page"><div class="head"><a class="back" href="#/pendata/data">${ic('back')}</a><h1>Data tidak ditemukan</h1></div></div>`;
  const d = it.data; const m = it.local;
  const steps = [['Tersimpan di HP', true], ['Terkirim ke server', !['Antre di HP', 'Draf'].includes(it.status)], ['Diverifikasi DPMPTSP', ['Terbit', 'Perlu perbaikan'].includes(it.status)], ['Terbit di peta investor', it.status === 'Terbit']];
  const now = steps.findIndex((s) => !s[1]);
  const sea = d.lat != null && isSea(d.lat, d.lon);
  return `<div class="page">
    <div class="head"><a class="back" href="#/pendata/data" aria-label="Kembali">${ic('back')}</a><div class="grow"><h1 style="font-size:21px">${esc(d.nama)}</h1><p class="small muted">${esc(d.sektor)} · ${esc(d.distrik)}${d.kampung ? ' · ' + esc(d.kampung) : ''}</p></div></div>
    ${it.status === 'Antre di HP' ? `<div class="card amber" style="text-align:center"><img src="${CENRA_IMG.berpikir}" alt="" style="width:90px;margin:0 auto 6px"><h2>Tersimpan aman di HP</h2><p class="small" style="color:var(--amberD)">Data tidak akan hilang. Khenambay mengirimnya otomatis begitu HP menemukan sinyal.</p></div>` : ''}
    ${it.status === 'Menunggu verifikasi' && m?.sentAt && Date.now() - m.sentAt < 600000 ? `<div class="card soft" style="text-align:center"><img src="${CENRA_IMG.senang}" alt="" style="width:90px;margin:0 auto 6px"><h2>Terkirim ke DPMPTSP</h2><p class="small muted">Admin akan memverifikasinya. Kakak dapat notifikasi saat data terbit.</p></div>` : ''}
    ${it.status === 'Perlu perbaikan' ? `<div class="card coral stack-s"><b style="color:var(--red)">${ic('alert')} Catatan dari admin DPMPTSP</b><p>"${esc(it.catatan || 'Mohon periksa kembali data ini.')}"</p></div>
      ${sea ? cenraTip(`Cenra cek: titik lama berada di laut, sekitar ${fmtNum((d.lat - coastLat(d.lon)) * 111000, 0)} m dari garis pantai. Kunci ulang GPS saat sudah di lokasi daratan, ya. Isian lain tidak perlu diulang.`, 'berpikir') : cenraTip('Perbaiki bagian yang disebut admin saja. Isian lain, foto, dan cerita suara tetap tersimpan.', 'berpikir')}
      <a class="btn block" href="#/pendata/ubah/${esc(id)}">Perbaiki data</a>` : ''}
    ${it.status === 'Konflik' ? `<div class="card coral stack-s"><b>Data ini diubah admin saat Kakak offline</b><p class="small">Pilih versi yang dipakai.</p>
      <div class="row wrap"><button type="button" class="btn sm" data-act="conflict-mine" data-id="${esc(id)}">Kirim versi saya</button><button type="button" class="btn sm ghost" data-act="conflict-server" data-id="${esc(id)}">Pakai versi admin</button></div></div>` : ''}
    <div class="card stack-s"><div class="label">Riwayat status</div>
      ${steps.map(([t, done], i) => `<div class="row" style="padding:6px 0"><span style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;background:${done ? 'var(--green)' : i === now ? 'var(--amber)' : '#fff'};border:${done || i === now ? '0' : '1px solid var(--line)'};color:#fff">${done ? ic('check', 'style="width:14px;height:14px"') : ''}</span>
        <span class="grow" style="font-weight:${done || i === now ? 700 : 500};color:${done || i === now ? 'var(--ink)' : 'var(--muted)'}">${t}</span>${i === now && i === 1 ? `<span class="xs mono" style="color:var(--amberD)">${S.online ? 'mengirim…' : 'menunggu sinyal'}</span>` : ''}</div>`).join('')}
      ${it.status === 'Terbit' ? `<div class="row"><span class="small muted">Tingkat kesiapan</span><span class="grow">${meter(it.level)}</span><b class="small">Level ${it.level}</b></div>` : ''}</div>
    <div class="card stack-s small"><div class="label">Ringkasan</div><p>${esc(d.ringkasan || ringkas(d))}</p>
      ${m?.photos?.length ? `<div class="photos">${m.photos.map((p) => `<div class="photo"><img src="${p}" alt=""></div>`).join('')}</div>` : ''}${fotoLokasi(m?.data || {}, true)}</div>
  </div>`;
}
function pNotif() {
  const list = notifList(); S.notifSeen = Date.now(); LS.set('notifSeen', S.notifSeen); setTimeout(updateChrome, 0);
  return `<div class="page"><h1>Notifikasi</h1>
    ${list.map((n) => `<button type="button" class="item" ${n.go ? `data-go="${n.go}"` : `data-open-cenra="chat" data-ask="${esc(n.ask || '')}"`}>
      ${n.cenra ? `<span class="avatar" style="width:42px;height:42px"><img src="${CENRA_IMG.menyapa}" alt="" style="width:48px"></span>` : `<span class="ic" style="background:color-mix(in srgb, ${n.col} 15%, white);color:${n.col}">${ic(n.icon)}</span>`}
      <span class="grow"><b>${esc(n.title)}</b><small>${esc(n.sub)}</small></span><span class="xs mono muted">${ago(n.t)}</span></button>`).join('') || '<p class="muted">Belum ada notifikasi.</p>'}
  </div>`;
}
function pProfil() {
  const s = S.settings;
  const tg = (k, t, d) => `<label class="row" style="padding:12px 0;border-bottom:1px solid var(--line)"><span class="grow"><b class="small">${t}</b><br><span class="xs muted">${d}</span></span><span class="toggle"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span></span></span></label>`;
  return `<div class="page">
    <div class="card hero row"><span class="avatar-txt" style="width:56px;height:56px;font-size:18px">${esc(initials(me().nama))}</span>
      <div><b style="font-size:18px">${esc(me().nama)}</b><div class="small muted">Pendata · ${esc(me().email)}</div></div></div>
    <div class="card stack"><label class="field">Distrik tugas<select data-set="distrik">${DISTRIK.map(([n]) => `<option${n === s.distrik ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <div class="label">Pengaturan</div>
    <div class="card" style="padding:4px 16px">${tg('wifiOnly', 'Kirim hanya lewat WiFi', 'Hemat kuota saat data besar')}${tg('compress', 'Kompres foto otomatis', 'Foto jadi sekitar 300–600 KB')}${tg('suara', 'Suara Cenra', 'Cenra membacakan jawabannya')}</div>
    <div class="label">Bantuan</div>
    <div class="stack-s">
      <button type="button" class="item" data-open-cenra="faq"><span class="ic" style="background:var(--soft);color:var(--teal)">${ic('spark')}</span><span class="grow"><b>Panduan & FAQ bersama Cenra</b></span>${ic('chev')}</button>
      <button type="button" class="item" data-act="sync-now"><span class="ic" style="background:var(--soft);color:var(--teal)">${ic('sync')}</span><span class="grow"><b>Kirim data sekarang</b><small>${S.outbox.length} perubahan menunggu</small></span>${ic('chev')}</button>
      <button type="button" class="item" data-act="pw"><span class="ic" style="background:var(--soft);color:var(--teal)">${ic('shield')}</span><span class="grow"><b>Ganti kata sandi</b><small>Perangkat lain otomatis dikeluarkan</small></span>${ic('chev')}</button>
      <button type="button" class="item" data-act="logout"><span class="ic" style="background:var(--coralS);color:var(--red)">${ic('logout')}</span><span class="grow"><b style="color:var(--red)">Keluar</b><small>Data yang belum terkirim tetap tersimpan di HP</small></span></button>
    </div>
    <p class="xs muted" style="text-align:center">Khenambay v1.0 · ${S.cacheTime ? 'data diperbarui ' + ago(S.cacheTime) : 'belum pernah sinkron'}</p>
  </div>`;
}

// =====================================================================
// INVESTOR
// =====================================================================
const t = (id, en) => (S.lang === 'en' ? en : id);
function filtered() {
  const f = S.f; const q = f.q.trim().toLowerCase();
  return pub().filter((p) => (f.sektor === 'Semua' || p.data.sektor === f.sektor) && (!q || `${p.data.nama} ${p.data.distrik} ${p.data.kampung} ${p.data.sektor}`.toLowerCase().includes(q))
    && (!f.maxNilai || (p.data.nilai && p.data.nilai <= f.maxNilai)) && p.level >= f.minLevel && (!f.lahan.length || f.lahan.includes(p.data.lahan)))
    .sort((a, b) => b.level - a.level || (b.data.nilai || 0) - (a.data.nilai || 0));
}
const langToggle = () => `<div class="seg" style="width:auto"><button type="button" data-act="ilang" data-v="id" aria-selected="${S.lang === 'id'}" style="padding:0 12px">ID</button><button type="button" data-act="ilang" data-v="en" aria-selected="${S.lang === 'en'}" style="padding:0 12px">EN</button></div>`;
const sectorChips = () => `<div class="chips scroll sx-chips">${['Semua', 'Perikanan', 'Perkebunan', 'Pariwisata', 'Pertanian'].map((k) => {
  const n = k === 'Semua' ? pub().length : pub().filter((p) => p.data.sektor === k).length;
  return `<button type="button" class="chip sx" aria-pressed="${S.f.sektor === k}" data-act="fsek" data-v="${k}" style="--sc:${k === 'Semua' ? 'var(--sun)' : sec(k).c}"><span class="sx-ic">${ic(k === 'Semua' ? 'spark' : sec(k).ic)}</span>${k === 'Semua' ? t('Semua', 'All') : t(k, sec(k).en)}<span class="sx-n">${n}</span></button>`;
}).join('')}</div>`;
function oppCard(p) {
  const sv = S.saved.includes(p.id);
  return `<div class="opp">${secIcon(p.data.sektor, 52)}
    <button type="button" class="open" data-go="#/investor/p/${esc(p.id)}"><span class="xs muted">${esc(t(p.data.sektor, sec(p.data.sektor).en))} · ${esc(p.data.distrik)}</span><b>${esc(p.data.nama)}</b>${meter(p.level)}
      <span class="row between small"><b style="color:var(--teal)">${rp(p.data.nilai)}</b><span class="xs" style="font-weight:700;color:${p.level >= 4 ? 'var(--green)' : 'var(--amberD)'}">Level ${p.level} · ${t(LEVELS[p.level], LEVELS_EN[p.level])}</span></span></button>
    <button type="button" class="save" aria-pressed="${sv}" data-act="save" data-id="${esc(p.id)}" aria-label="${sv ? 'Hapus dari disimpan' : 'Simpan peluang'}">${ic('save')}</button></div>`;
}
function iMap() {
  const list = filtered(); const W = 600, H = 470;
  const pins = list.map((p) => { const [x, y] = proj(p.data.lat, p.data.lon, W, H); return `<g class="pin" tabindex="0" role="button" aria-label="${esc(p.data.nama)}" data-go="#/investor/p/${esc(p.id)}"><circle cx="${x}" cy="${y}" r="${p.level >= 4 ? 11 : 8}" fill="${sec(p.data.sektor).hex}" stroke="#fff" stroke-width="3"/>${p.level >= 5 ? `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="${sec(p.data.sektor).hex}" stroke-opacity=".4" stroke-width="2"/>` : ''}</g>`; }).join('');
  return `<div class="page inv-page"><div class="inv-grid"><div class="inv-head">
    <section class="hi-banner">${window.KPapua ? KPapua.once('hbird', { w: 92, top: 6, span: '40vw', dur: 4.6 }) : ''}<h1>${me() ? `${t('Halo', 'Hi')}, ${esc(me().nama.split(' ')[0])} 👋` : t('Halo 👋', 'Hi 👋')}</h1>
      <p>${t('Mau cari peluang investasi apa hari ini di Tanah Tabi?', 'What opportunity are you looking for today in Tanah Tabi?')}</p>
      <div class="hb-stats"><span>${pub().length} ${t('peluang terverifikasi', 'verified')}</span><span>${pub().filter((p) => p.level >= 4).length} ${t('ada kajian', 'with study')}</span><span>19 ${t('distrik', 'districts')}</span></div></section>
    <div class="row"><label class="grow" style="position:relative"><span class="sr-only">Cari</span><input class="input" data-act="fq" value="${esc(S.f.q)}" placeholder="${t('Cari komoditas atau distrik', 'Search commodity or district')}" style="padding-left:40px"><span style="position:absolute;left:12px;top:14px;color:var(--muted)">${ic('search')}</span></label>${langToggle()}</div>
    ${sectorChips()}</div>
    <div class="inv-map">${map3dBlock('investor', baseMapSVG(W, H, pins, { fs: 9 }))}
    <div class="legend">${Object.keys(SECTORS).slice(0, 4).map((k) => `<span><i class="secdot" style="background:${sec(k).c}"></i>${t(k, sec(k).en)}</span>`).join('')}<span>${t('Cincin berdenyut = siap ditawarkan', 'Pulsing ring = ready to offer')}</span></div></div>
    <div class="inv-list">
    <div class="row between"><div><h2>${list.length} ${t('peluang terverifikasi', 'verified opportunities')}</h2><p class="xs muted">${t('Kabupaten Jayapura · diperbarui', 'Jayapura Regency · updated')} ${S.cacheTime ? dateID(S.cacheTime) : '—'}</p></div><a href="#/investor/daftar" class="small" style="font-weight:700">${t('Lihat semua', 'See all')}</a></div>
    <div class="stack opp-list">${list.slice(0, 8).map((p, i) => i >= 3 ? oppCard(p).replace('<div class="opp"', '<div class="opp more"') : oppCard(p)).join('')}</div>
    </div></div>
  </div>`;
}
function iList() {
  const list = filtered(); const f = S.f;
  const active = (f.maxNilai ? 1 : 0) + (f.minLevel > 1 ? 1 : 0) + f.lahan.length;
  return `<div class="page inv-page">
    <div class="row between"><div><h1>${t('Daftar peluang', 'Opportunities')}</h1><p class="xs muted">${list.length} ${t('terverifikasi · urut tingkat kesiapan', 'verified · sorted by readiness')}</p></div>${langToggle()}</div>
    <div class="row"><input class="input grow" data-act="fq" value="${esc(f.q)}" placeholder="${t('Cari komoditas atau distrik', 'Search commodity or district')}"><button type="button" class="btn dark" data-act="filter">${ic('filter')} Filter${active ? ` (${active})` : ''}</button></div>
    ${sectorChips()}
    <div class="stack opp-grid">${list.map(oppCard).join('') || `<div class="card flat" style="text-align:center"><p class="muted">${t('Tidak ada peluang yang cocok dengan filter.', 'No opportunities match the filter.')}</p><button type="button" class="btn sm ghost" data-act="freset" style="margin-top:8px">${t('Reset filter', 'Reset filter')}</button></div>`}</div>
  </div>`;
}
function filterSheet() {
  const f = S.f; const vals = [[0, t('Semua nilai', 'Any value')], [5e9, '≤ Rp 5 M'], [10e9, '≤ Rp 10 M'], [20e9, '≤ Rp 20 M']];
  openSheet(`<div class="row between"><h2>${t('Filter peluang', 'Filter opportunities')}</h2><button type="button" class="chip" data-act="freset">Reset</button></div>
    <div class="label">${t('Sektor', 'Sector')}</div>${sectorChips()}
    <div class="label">${t('Estimasi nilai investasi', 'Estimated investment')}</div>
    <div class="chips">${vals.map(([v, l]) => `<button type="button" class="chip" aria-pressed="${(f.maxNilai || 0) === v}" data-act="fnilai" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="label">${t('Tingkat kesiapan minimal', 'Minimum readiness level')}</div>
    <div class="levels">${[1, 2, 3, 4, 5].map((l) => `<button type="button" aria-pressed="${f.minLevel === l}" data-act="flevel" data-v="${l}"><b>${l}</b><small>${t(LEVELS[l], LEVELS_EN[l])}</small></button>`).join('')}</div>
    <div class="label">${t('Status lahan', 'Land status')}</div>
    <div class="chips">${LAHAN.map((x) => `<button type="button" class="chip" aria-pressed="${f.lahan.includes(x)}" data-act="flahan" data-v="${x}">${x}</button>`).join('')}</div>
    <button type="button" class="btn block" data-close>${t('Tampilkan', 'Show')} ${filtered().length} ${t('peluang', 'opportunities')}</button>`);
}
function iDetail(id) {
  const p = byId(id);
  if (!p || p.status !== 'Terbit') return `<div class="page"><div class="head"><a class="back" href="#/investor">${ic('back')}</a><h1>${t('Peluang tidak ditemukan', 'Opportunity not found')}</h1></div></div>`;
  const d = p.data; const fin = p.level >= 4; const sv = S.saved.includes(id);
  const W = 360, H = 200; const [x, y] = proj(d.lat, d.lon, W, H);
  return `<div class="page inv-page det-page">
    <div class="head"><a class="back" href="#/investor/daftar" aria-label="Kembali">${ic('back')}</a><div class="grow"></div>${langToggle()}
      <button type="button" class="save" aria-pressed="${sv}" data-act="save" data-id="${esc(id)}" aria-label="${t('Simpan', 'Save')}">${ic('save')}</button></div>
    <div class="det-grid"><div class="det-main">
    <div class="photo-hero" style="background:linear-gradient(135deg,#2A3410,${sec(d.sektor).hex})"><span class="badge">${esc(t(d.sektor, sec(d.sektor).en))} · ${esc(d.distrik)}</span><span class="badge" style="background:rgba(46,158,98,.9)">✓ ${t('Terverifikasi DPMPTSP', 'Verified by DPMPTSP')}</span></div>
    <h1>${esc(d.nama)}</h1>
    <div class="card stack-s"><div class="label">${t('Ringkasan', 'Summary')}</div><p class="small">${esc(ringkas(d, S.lang))}</p>
      <div class="chips">${(d.infra || []).map((i) => `<span class="badge b-t">${esc(i)}</span>`).join('')}</div></div>
    <div class="mapbox">${baseMapSVG(W, H, `<circle cx="${x}" cy="${y}" r="10" fill="${sec(d.sektor).hex}" stroke="#fff" stroke-width="3"/>`, { labels: false })}</div>
    ${fotoLokasi(d, true)}
    <p class="xs muted">${t('Sumber: data terverifikasi DPMPTSP Kabupaten Jayapura, diperbarui', 'Source: DPMPTSP Jayapura Regency verified data, updated')} ${dateID(p.updatedAt)}. ${t('Data contoh untuk prototipe.', 'Sample data for the prototype.')}</p>
    </div><aside class="det-side">
    <div class="card stack-s" style="background:${fin ? 'var(--greenS)' : 'var(--amberS)'};border:0"><div class="row between"><b class="small" style="color:${fin ? 'var(--green)' : 'var(--amberD)'}">${t('Tingkat kesiapan investasi', 'Investment readiness')}</b><b class="small">Level ${p.level} ${t('dari', 'of')} 5</b></div>
      ${meter(p.level)}<span class="xs" style="color:var(--ink2)">${t(LEVELS[p.level], LEVELS_EN[p.level])} · ${esc(d.lahan)}${d.lahan === 'Tanah adat' ? ` · ${t('musyawarah', 'consultation')} ${esc((d.musyawarah || '—').toLowerCase())}` : ''}</span></div>
    <div class="kv"><div><small>${t('Estimasi nilai', 'Estimated value')}</small><b>${rp(d.nilai)}</b></div><div><small>IRR</small><b>${fin && d.irr ? fmtNum(d.irr) + '%' : fin && !isRole('investor') ? `<a href="${loginHref('investor')}" class="small">🔒 ${t('Masuk', 'Sign in')}</a>` : '—'}</b></div>
      <div><small>${t('Balik modal', 'Payback')}</small><b>${fin && d.payback ? d.payback + t(' tahun', ' years') : fin && !isRole('investor') ? `<a href="${loginHref('investor')}" class="small">🔒 ${t('Masuk', 'Sign in')}</a>` : '—'}</b></div><div><small>${t('Luas / kapasitas', 'Size / capacity')}</small><b>${d.luas ? fmtNum(d.luas) + ' ' + d.satuan : '—'}</b></div></div>
    ${fin ? (isRole('investor') ? '' : `<p class="xs muted">${t('IRR dan balik modal hanya tampil untuk investor yang sudah masuk.', 'IRR and payback are shown to signed-in investors only.')}</p>`) : `<p class="xs muted">${t('Angka finansial tampil untuk peluang level 4–5 (sudah ada kajian).', 'Financial figures are shown for level 4–5 opportunities (study available).')}</p>`}
    <div class="actionbar"><button type="button" class="btn ghost grow" data-open-cenra="chat" data-ctx="${esc(id)}">${ic('spark')} ${t('Tanya Cenra', 'Ask Cenra')}</button><a class="btn grow" href="${!isRole('investor') ? loginHref('investor', `#/investor/minat/${id}`) : kycOK() ? `#/investor/minat/${esc(id)}` : '#/investor/verifikasi'}">${!isRole('investor') ? '🔒 ' + t('Masuk untuk berinvestasi', 'Sign in to invest') : kycOK() ? t('Ajukan minat', 'Express interest') : t('Verifikasi data diri untuk berinvestasi', 'Verify your identity to invest')}</a></div>
    </aside></div>
  </div>`;
}
function iMinat(id) {
  const p = byId(id); if (!p) return iDetail(id);
  const v = LS.get('minatForm', { nama: '', perusahaan: '', kontak: '', nilai: '', pesan: '' });
  return `<div class="page">
    <div class="head"><a class="back" href="#/investor/p/${esc(id)}" aria-label="Kembali">${ic('back')}</a><div class="grow"><h1 style="font-size:22px">${t('Ajukan minat', 'Express interest')}</h1><p class="small muted">${esc(p.data.nama)} · ${rp(p.data.nilai)} · Level ${p.level}</p></div></div>
    <p class="small muted">${t('Data Anda hanya diterima DPMPTSP Kabupaten Jayapura.', 'Your details go only to DPMPTSP Jayapura Regency.')}</p>
    <form id="minat-form" class="stack" novalidate>
      <div class="card soft row"><span class="avatar-txt" style="width:42px;height:42px;font-size:14px">${esc(initials(me().nama))}</span><div class="grow small"><b>${esc(me().nama)}</b><br><span class="muted">${esc(me().perusahaan || '')} · ${esc(me().email)}</span></div><span class="badge b-g">✓ ${t('Identitas terverifikasi', 'Identity verified')}</span></div>
      <input type="hidden" name="nama" value="${esc(me().nama)}"><input type="hidden" name="perusahaan" value="${esc(me().perusahaan || '')}">
      <label class="field">${t('Kontak yang bisa dihubungi', 'Best contact')} *<input name="kontak" required value="${esc(v.kontak || me().telepon || me().email)}"></label>
      <div class="label">${t('Rencana nilai investasi', 'Planned investment')}</div>
      <div class="chips">${['< Rp 10 M', 'Rp 10–20 M', '> Rp 20 M'].map((x) => `<button type="button" class="chip" aria-pressed="${v.nilai === x}" data-act="mnilai" data-v="${x}">${x}</button>`).join('')}</div>
      <label class="field">${t('Pesan untuk DPMPTSP', 'Message to DPMPTSP')}<textarea name="pesan" placeholder="${t('mis. rencana kapasitas, jadwal kunjungan', 'e.g. planned capacity, site-visit schedule')}">${esc(v.pesan)}</textarea></label>
      ${cenraTip(t('Cenra akan melampirkan profil peluang dan data pendukungnya otomatis ke pengajuan Anda.', 'Cenra will attach the opportunity profile and supporting data to your request automatically.'), 'senang')}
      <label class="check"><input type="checkbox" name="setuju" required> ${t('Saya setuju DPMPTSP menghubungi saya terkait peluang ini.', 'I agree that DPMPTSP may contact me about this opportunity.')}</label>
      <div class="actionbar"><button type="submit" class="btn block">${t('Kirim minat', 'Send interest')}</button></div>
    </form></div>`;
}
function iSent(mid) {
  const m = S.myMinat.find((x) => x.id === mid); const p = m && byId(m.potensiId);
  if (!m) return iSaved();
  return `<div class="page" style="text-align:center">
    <div style="position:relative;width:220px;height:200px;margin:10px auto 0"><div style="position:absolute;inset:10px 20px;border-radius:50%;background:rgba(242,179,61,.25)"></div><img src="${CENRA_IMG.senang}" alt="Cenra senang" style="position:absolute;left:30px;bottom:0;width:160px;animation:bob 2.6s infinite"></div>
    <h1>${t('Minat terkirim!', 'Interest sent!')}</h1>
    <p class="muted">${m.kode ? t(`Terima kasih, ${esc(m.nama)}. Petugas DPMPTSP akan menghubungi Anda paling lambat 2 hari kerja.`, `Thank you, ${esc(m.nama)}. DPMPTSP will contact you within 2 working days.`) : t('Anda sedang offline. Pengajuan tersimpan dan terkirim otomatis begitu ada sinyal.', 'You are offline. Your request is saved and will be sent automatically once connected.')}</p>
    <div class="card soft row between"><span class="small muted">${t('Nomor pengajuan', 'Request number')}</span><b class="mono" style="font-size:15px">${m.kode || t('menunggu sinyal…', 'waiting for signal…')}</b></div>
    <div class="card stack-s" style="text-align:left">${[[t('Minat diterima', 'Interest received'), !!m.kode], [t('Ditinjau DPMPTSP', 'Reviewed by DPMPTSP'), false], [t('Kunjungan lokasi', 'Site visit'), false]].map(([l, ok], i) => `<div class="row" style="padding:6px 0"><span style="width:24px;height:24px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;background:${ok ? 'var(--green)' : i === (m.kode ? 1 : 0) ? 'var(--amber)' : '#fff'};border:${ok || i === (m.kode ? 1 : 0) ? 0 : '1px solid var(--line)'}">${ok ? ic('check', 'style="width:14px;height:14px"') : ''}</span><b class="grow small">${l}</b></div>`).join('')}</div>
    <p class="xs muted">${p ? esc(p.data.nama) : ''}</p>
    <div class="row"><button type="button" class="btn ghost grow" data-open-cenra="chat">${t('Tanya Cenra', 'Ask Cenra')}</button><a class="btn grow" href="#/investor">${t('Kembali ke peta', 'Back to map')}</a></div>
  </div>`;
}
function iSaved() {
  if (!isRole('investor')) return `<div class="page"><h1>${t('Disimpan', 'Saved')}</h1>${lockCard(t('Masuk sebagai investor untuk menyimpan peluang dan memantau pengajuan minat Anda.', 'Sign in as an investor to save opportunities and track your requests.'), '#/investor/disimpan')}</div>`;
  const list = S.saved.map(byId).filter(Boolean);
  const mine = [...S.myMinat.filter((x) => !x.kode).map((x) => ({ ...x, status: t('Menunggu sinyal', 'Waiting for signal'), pending: true })), ...S.minat];
  return `<div class="page">
    <div class="card row"><span class="avatar-txt">${esc(initials(me().nama))}</span><div class="grow"><b>${esc(me().nama)}</b><br><span class="small muted">${esc(me().perusahaan || me().email)}</span></div><button type="button" class="btn sm ghost" data-act="logout">${t('Keluar', 'Sign out')}</button></div>
    <a class="card row kyc-card ${kycOK() ? 'ok' : ''}" href="#/investor/verifikasi" style="text-decoration:none"><span class="ic" style="background:var(--soft);color:var(--teal);width:42px;height:42px;border-radius:12px;display:grid;place-items:center">${ic('idcard')}</span><span class="grow"><b>${t('Verifikasi data diri', 'Identity verification')}</b><br><span class="small muted">${kycOK() ? t('Anda bisa mengajukan minat investasi', 'You can now express interest') : S.kyc?.status === 'Menunggu' ? t('Sedang ditinjau DPMPTSP', 'Under review') : S.kyc?.status === 'Ditolak' ? t('Perlu diperbaiki, buka untuk melihat alasannya', 'Needs changes') : t('Wajib sebelum mengajukan minat · ±5 menit', 'Required before expressing interest')}</span></span>${kycBadge(S.kyc?.status || 'Belum')}</a>
    <div class="row"><button type="button" class="btn sm ghost grow" data-act="pw">${ic('edit')} ${t('Ganti kata sandi', 'Change password')}</button><button type="button" class="btn sm ghost grow" data-act="logout-all">${ic('logout')} ${t('Keluar semua perangkat', 'Sign out everywhere')}</button></div>
    <h2>${t('Pengajuan minat saya', 'My interest requests')}</h2>
    ${mine.length ? mine.map((m) => { const p = byId(m.potensiId); return `<div class="item"><span class="ic" style="background:var(--soft);color:var(--teal)">${ic('send')}</span><span class="grow"><b>${esc(p ? p.data.nama : m.potensiId)}</b><small>${esc(m.kode || t('belum terkirim', 'not sent yet'))} · ${ago(m.createdAt || m.t)}</small></span><span class="badge ${m.pending ? 'b-a' : m.status === 'Baru' ? 'b-t' : 'b-g'}">${esc(m.status)}</span></div>`; }).join('') : `<p class="small muted">${t('Belum ada pengajuan.', 'No requests yet.')}</p>`}
    <div><h1>${t('Disimpan', 'Saved')}</h1><p class="xs muted">${list.length} ${t('peluang · tersimpan di perangkat ini, bisa dibuka offline', 'opportunities · stored on this device, available offline')}</p></div>
    ${list.length >= 2 ? `<button type="button" class="card hero row" style="text-align:left;cursor:pointer" data-open-cenra="chat" data-ask="${t('Bandingkan peluang yang saya simpan', 'Compare my saved opportunities')}">
      <span class="avatar"><img src="${CENRA_IMG.menyapa}" alt=""></span><span class="grow"><b>${t('Bandingkan bersama Cenra', 'Compare with Cenra')}</b><br><span class="small muted">${t('Nilai, kesiapan, IRR, dan lahan dalam satu tabel', 'Value, readiness, IRR and land in one table')}</span></span>${ic('chev')}</button>` : ''}
    <div class="stack">${list.map(oppCard).join('')}</div>
    <div class="card flat" style="text-align:center;border-style:dashed">${ic('save')}<p class="small muted">${t('Ketuk ikon simpan di peluang lain untuk menambahkannya.', 'Tap the save icon on any opportunity to add it here.')}</p></div>
  </div>`;
}

// =====================================================================
// ADMIN
// =====================================================================
const ANAV = [['#/admin', 'home', 'Ringkasan', 'Kerja hari ini'], ['#/admin/antrean', 'inbox', 'Antrean verifikasi', 'Kerja hari ini'], ['#/admin/investor', 'idcard', 'Verifikasi investor', 'Kerja hari ini'],
  ['#/admin/minat', 'users', 'Minat investor', 'Kerja hari ini'], ['#/admin/peta', 'map', 'Peta persebaran', 'Data & peta'], ['#/admin/kesiapan', 'star', 'Tingkat kesiapan', 'Data & peta'],
  ['#/admin/ekstraksi', 'doc', 'Ekstraksi dokumen AI', 'Data & peta'], ['#/admin/keamanan', 'shield', 'Keamanan', 'Sistem']];
function adminShell(route, inner) {
  const q = S.potensi.filter((p) => p.status === 'Menunggu verifikasi').length; const mi = S.minat.filter((m) => m.status === 'Baru').length; const kq = (S.akyc || []).filter((x) => x.status === 'Menunggu').length; if (!S.akyc) loadAkyc();
  const base = route.split('/').slice(0, 3).join('/').replace(/^#\/admin\/v$/, '#/admin/antrean');
  const base2 = route.startsWith('#/admin/investor') ? '#/admin/investor' : base;
  const badge = { 'Antrean verifikasi': q, 'Minat investor': mi, 'Verifikasi investor': kq };
  let grp = '';
  const links = ANAV.map(([h, i, l, g]) => {
    const head = g !== grp ? `<div class="sd-group">${g}</div>` : ''; grp = g;
    const cur = h === base2 || (base === '#/admin/v' && h === '#/admin/antrean');
    return `${head}<a href="${h}"${cur ? ' aria-current="page"' : ''}><span class="sd-ic">${ic(i)}</span><span class="grow">${l}</span>${badge[l] ? `<span class="badge">${badge[l]}</span>` : ''}</a>`;
  }).join('');
  return `<div class="admin"><nav class="side" aria-label="Menu admin">
    <div class="sd-brand"><img src="icons/logo-cenderawasih.png" alt=""><span><b>Ruang kerja</b><small>DPMPTSP Kab. Jayapura</small></span></div>
    ${links}
    <div class="me"><span class="avatar-txt">${esc(initials(me()?.nama))}</span><div class="grow"><b>${esc(me()?.nama || '')}</b><br><span style="opacity:.6">${esc(me()?.perusahaan || 'Admin')}</span></div><button type="button" class="icon-btn" data-act="logout" title="Keluar" aria-label="Keluar">${ic('logout')}</button></div></nav>
    <div class="amain">${inner}</div></div>`;
}
const aTop = (title2, sub, extra = '') => `<div class="row between wrap" style="gap:14px"><div><h1>${title2}</h1><p class="small muted">${sub}</p></div><div class="row">${extra}</div></div>`;
function aHome() {
  const all = S.potensi; const q = all.filter((p) => p.status === 'Menunggu verifikasi'); const terbit = pub();
  const week = all.filter((p) => days(p.createdAt) <= 7).length;
  const flagged = q.filter((p) => aiChecks(p).some((c) => !c.ok));
  const low = districtStats().sort((a, b) => a.n - b.n).slice(0, 2);
  const minatPer = {}; S.minat.forEach((m) => { const p = byId(m.potensiId); if (p) minatPer[p.data.sektor] = (minatPer[p.data.sektor] || 0) + 1; });
  const topSek = Object.entries(minatPer).sort((a, b) => b[1] - a[1])[0];
  const lv = [1, 2, 3, 4, 5].map((l) => terbit.filter((p) => p.level >= l).length);
  const hr = new Date().getHours(); const salam = hr < 11 ? 'Selamat pagi' : hr < 15 ? 'Selamat siang' : hr < 19 ? 'Selamat sore' : 'Selamat malam';
  return `<section class="a-banner">${window.KPapua ? KPapua.once('hbird', { w: 110, top: 10, span: '70vw', dur: 5 }) : ''}
      <div><div class="label" style="color:var(--gold-2)">Ruang kerja DPMPTSP Kabupaten Jayapura</div><h1>${salam}, ${esc((me()?.nama || '').split(' ')[0])}</h1>
        <p>${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · 19 distrik · data contoh</p>
        <div class="ab-chips"><a href="#/admin/antrean">${q.length} menunggu verifikasi</a><a href="#/admin/investor">Verifikasi investor</a><a href="#/admin/minat">${S.minat.filter((m) => m.status === 'Baru').length} minat baru</a></div></div>
      <button type="button" class="btn sm ghost" data-act="reset-demo">Reset data demo</button></section>` + `
    <div class="kpis">
      ${[['Potensi terdata', all.length, `+${week} minggu ini`, 'b-g', '#/admin/peta', 'map', 'clay-sand'], ['Siap ditawarkan', terbit.filter((p) => p.level === 5).length, `${terbit.length} terbit`, 'b-g', '#/admin/kesiapan', 'star', 'clay-olive'],
        ['Menunggu verifikasi', q.length, `${flagged.length} ditandai AI`, 'b-a', '#/admin/antrean', 'inbox', 'clay-sun'], ['Minat investor', S.minat.length, `${S.minat.filter((m) => m.status === 'Baru').length} belum dihubungi`, 'b-a', '#/admin/minat', 'users', 'clay-ember']]
        .map(([l, v, s, b, h, i, c]) => `<a class="kpi" href="${h}" style="text-decoration:none"><span class="kpi-ic ${c}">${ic(i)}</span><span class="small muted">${l}</span><b>${v}</b><span class="badge ${b}" style="justify-self:start">${s}</span></a>`).join('')}
    </div>
    <div class="two">
      <div class="table-wrap"><div class="row between" style="padding:16px 18px"><h2>Antrean verifikasi</h2><a class="btn sm ghost" href="#/admin/antrean">Lihat semua</a></div>${queueTable(q.slice(0, 6))}</div>
      <div class="stack">
        <div class="card stack-s"><h3>Corong kesiapan investasi</h3>${lv.map((n, i) => `<div class="stack-s" style="gap:4px"><div class="row between small"><span>${i + 1} · ${LEVELS[i + 1]}</span><span class="mono">${n}</span></div><div class="track"><i style="width:${terbit.length ? (n / terbit.length) * 100 : 0}%;background:${i === 4 ? 'var(--green)' : ''}"></i></div></div>`).join('')}</div>
        ${cenraTip(`${week} data baru minggu ini, ${flagged.length} ditandai untuk dicek. ${low.map((x) => x.nama).join(' dan ')} masih paling sedikit datanya.${topSek ? ` Minat investor terbanyak di sektor ${topSek[0].toLowerCase()}.` : ''}`, 'berpikir', true)}
      </div>
    </div>`;
}
function queueTable(list) {
  if (!list.length) return '<p class="muted" style="padding:16px 18px">Tidak ada data menunggu. Semua sudah diverifikasi.</p>';
  return `<table class="table"><thead><tr><th>Data potensi</th><th>Distrik</th><th>Pendata</th><th>Cek AI</th><th>Masuk</th></tr></thead><tbody>
    ${list.map((p) => { const bad = aiChecks(p).filter((c) => !c.ok); return `<tr class="click" data-go="#/admin/v/${esc(p.id)}" tabindex="0"><td><div class="row"><span class="secdot" style="background:${sec(p.data.sektor).c}"></span><div><b>${esc(p.data.nama)}</b><br><span class="xs muted">${esc(p.data.sektor)}</span></div></div></td>
      <td>${esc(p.data.distrik)}</td><td>${esc(p.data.pendata || '—')}</td><td>${bad.length ? `<span class="badge ${bad.some((b) => b.key === 'sea' || b.key === 'loc') ? 'b-r' : 'b-a'}">! ${esc(bad[0].t)}${bad.length > 1 ? ` +${bad.length - 1}` : ''}</span>` : '<span class="badge b-g">✓ Lolos semua cek</span>'}</td>
      <td class="mono" style="color:${days(p.createdAt) > 5 ? 'var(--red)' : 'var(--muted)'}">${ago(p.createdAt)}</td></tr>`; }).join('')}</tbody></table>`;
}
function aQueue() {
  const q = S.potensi.filter((p) => p.status === 'Menunggu verifikasi'); const f = S.aq;
  const list = q.filter((p) => f === 'Semua' || (f === 'Ditandai AI' && aiChecks(p).some((c) => !c.ok)) || (f === 'Lewat 5 hari' && days(p.createdAt) > 5) || p.data.sektor === f)
    .sort((a, b) => a.createdAt - b.createdAt);
  return aTop('Antrean verifikasi', `${q.length} data menunggu · ${q.filter((p) => aiChecks(p).some((c) => !c.ok)).length} ditandai AI · ${q.filter((p) => days(p.createdAt) > 5).length} lewat 5 hari`,
    `<button type="button" class="btn sm ghost" data-act="csv">${ic('download')} Ekspor CSV</button>`) + `
    <div class="chips">${['Semua', 'Ditandai AI', 'Lewat 5 hari', 'Perikanan', 'Perkebunan', 'Pariwisata', 'Pertanian'].map((x) => `<button type="button" class="chip" aria-pressed="${f === x}" data-act="aq" data-v="${x}">${x}</button>`).join('')}</div>
    <div class="table-wrap">${queueTable(list)}</div>
    <details class="card flat"><summary style="cursor:pointer;font-weight:700">Data yang sudah diverifikasi (${S.potensi.length - q.length})</summary><div class="table-wrap" style="margin-top:12px"><table class="table"><tbody>
      ${S.potensi.filter((p) => p.status !== 'Menunggu verifikasi').map((p) => `<tr class="click" data-go="#/admin/v/${esc(p.id)}"><td><b>${esc(p.data.nama)}</b></td><td>${esc(p.data.distrik)}</td><td>${statusBadge(p.status)}</td><td>Level ${p.level}</td></tr>`).join('')}</tbody></table></div></details>`;
}
let verifyPhotos = {};
function aVerify(id) {
  const p = byId(id); if (!p) return aTop('Data tidak ditemukan', '');
  const d = p.data; const checks = aiChecks(p); const bad = checks.filter((c) => !c.ok); const sug = suggestLevel(p, checks);
  const lvSel = verifyPhotos[id + ':lv'] ?? (p.status === 'Terbit' ? p.level : Math.max(sug, 2));
  if (verifyPhotos[id] === undefined && (S.online || LOCAL)) { verifyPhotos[id] = null; api('/api/potensi/' + encodeURIComponent(id)).then((r) => { verifyPhotos[id] = r.photos || []; rerenderLive(true); }).catch(() => { verifyPhotos[id] = []; }); }
  const photos = verifyPhotos[id] || [];
  const W = 420, H = 300; const [x, y] = d.lat != null ? proj(d.lat, d.lon, W, H) : [0, 0];
  const near = d.lat != null ? findDuplicates(d, id).slice(0, 3).map((n) => { const [a, b] = proj(n.p.data.lat, n.p.data.lon, W, H); return `<circle cx="${a}" cy="${b}" r="7" fill="#F2B33D" stroke="#fff" stroke-width="2"/>`; }).join('') : '';
  const fields = [['Sektor', d.sektor], ['Luas / produksi', `${d.luas ? fmtNum(d.luas) + ' ' + d.satuan : '—'}${d.produksi ? ' · ' + d.produksi : ''}`], ['Koordinat', d.lat != null ? `${d.lat.toFixed(4)}, ${d.lon.toFixed(4)} (±${d.akurasi ?? '?'} m)` : '—'],
    ['Status lahan', d.lahan + (d.adat ? ' · ' + d.adat : '')], ['Musyawarah', d.musyawarah || (d.lahan === 'Tanah adat' ? 'Belum dicatat' : 'Tidak perlu')], ['Infrastruktur', (d.infra || []).join(', ') || '—'],
    ['Estimasi nilai', rp(d.nilai)], ['Narahubung', d.kontak || '—'], ['IRR / balik modal', d.irr ? `${fmtNum(d.irr)}% · ${d.payback} tahun` : '—']];
  return `<a href="#/admin/antrean" class="small" style="font-weight:700;text-decoration:none">${ic('back', 'style="width:16px;height:16px;vertical-align:-3px"')} Antrean verifikasi</a>` +
    aTop(esc(d.nama), `${esc(d.distrik)} · ${esc(d.kampung || '')} · dikirim ${esc(d.pendata || '—')}, ${dateID(p.createdAt)}`, statusBadge(p.status) + (p.status === 'Terbit' ? ` <span class="badge b-t">Level ${p.level}</span>` : '')) + `
    <div class="two">
      <div class="stack">
        <div class="card"><h3 style="margin-bottom:10px">Data potensi</h3><div class="kv" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${fields.map(([k, v]) => `<div><small>${k}</small><b class="small">${esc(v)}</b></div>`).join('')}</div>
          <p class="small" style="margin-top:12px">${esc(d.ringkasan || ringkas(d))}</p></div>
        <div class="card stack-s"><h3>Foto lapangan & lokasi</h3><div class="grid2">
          <div class="photos" style="grid-template-columns:1fr 1fr">${photos.length ? photos.map((ph) => `<div class="photo"><img src="${ph}" alt="Foto lapangan"></div>`).join('') : (d.fotoContoh ? Array.from({ length: d.fotoContoh }, (_, i) => `<div class="photo" style="background:linear-gradient(160deg,${['#5E8B3A', '#3F6E4A'][i % 2]},#A7C26A);display:flex;align-items:flex-end;padding:8px"><span class="xs mono" style="background:rgba(11,31,36,.7);color:#fff;padding:3px 6px;border-radius:6px">${d.lat?.toFixed(4)}, ${d.lon?.toFixed(4)}</span></div>`).join('') : `<div class="card coral small" style="grid-column:1/-1">Belum ada foto.</div>`)}</div>
          ${fotoLokasi(d, true)}
          <div class="mapbox">${baseMapSVG(W, H, d.lat != null ? `${near}<circle cx="${x}" cy="${y}" r="26" fill="rgba(242,179,61,.12)" stroke="#E0A21E" stroke-dasharray="4 4"/><circle cx="${x}" cy="${y}" r="9" fill="#0E6C72" stroke="#fff" stroke-width="3"/>` : '', { labels: false })}</div></div>
          <p class="xs muted">Titik hijau tua: data ini · titik kuning: data lain di dekatnya · lingkaran: radius cek duplikat</p></div>
      </div>
      <div class="stack">
        <div class="card hero stack-s"><div class="row between"><b>${ic('spark')} Pemeriksaan Cenra</b><span class="small" style="color:var(--cyan);font-weight:700">${checks.length - bad.length} lolos · ${bad.length} dicek</span></div>
          <div class="checks">${checks.map((c) => `<div class="chk ${c.ok ? 'ok' : 'bad'}"><span class="d">${c.ok ? '✓' : '!'}</span><div><b>${esc(c.t)}</b><small>${esc(c.d)}</small></div></div>`).join('')}</div></div>
        <div class="card stack-s"><h3>Tetapkan tingkat kesiapan</h3>
          <div class="levels">${[1, 2, 3, 4, 5].map((l) => `<button type="button" aria-pressed="${lvSel === l}" data-act="vlv" data-id="${esc(id)}" data-v="${l}"><b>${l}</b><small>${LEVELS[l]}</small></button>`).join('')}</div>
          <p class="xs muted">Saran Cenra: <b>Level ${sug}</b>${bad.length ? ' (ada catatan yang perlu dicek dulu)' : ''}.</p>
          <label class="field"><span class="row between">Catatan untuk pendata ${bad.length ? `<button type="button" class="chip soft" data-act="vnote" data-id="${esc(id)}" style="padding:4px 10px;font-size:12px">${ic('spark', 'style="width:14px;height:14px"')} Tulis dengan Cenra</button>` : ''}</span><textarea id="vnote" placeholder="Opsional, wajib bila dikembalikan">${esc(verifyPhotos[id + ':note'] || p.catatan || '')}</textarea></label>
          <div class="row"><button type="button" class="btn ghost grow" data-act="vback" data-id="${esc(id)}">Kembalikan</button><button type="button" class="btn grow" data-act="vok" data-id="${esc(id)}">${p.status === 'Terbit' ? 'Simpan perubahan' : 'Terbitkan'}</button></div></div>
      </div>
    </div>`;
}
function aMap() {
  const ds = districtStats(); const W = 760, H = 600; const sel = S.amapSel;
  const circles = ds.map((x) => {
    const [, a, o] = DISTRIK.find(([n]) => n === x.nama); const [cx, cy] = proj(a, o, W, H); const r = 13 + x.n * 4;
    const dom = Object.entries(x.sek).sort((p, q) => q[1] - p[1])[0]; const col = dom ? sec(dom[0]).hex : '#9AA8AB'; const low = x.n <= 1;
    return `<g class="pin" tabindex="0" role="button" aria-label="Distrik ${esc(x.nama)}, ${x.n} potensi" data-act="amap" data-v="${esc(x.nama)}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" fill-opacity=".88" stroke="${low ? '#E8645A' : sel === x.nama ? '#0B1F24' : '#fff'}" stroke-width="3"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${x.n}</text></g>`;
  }).join('');
  const sk = {}; S.potensi.filter((p) => p.status !== 'Perlu perbaikan').forEach((p) => (sk[p.data.sektor] = (sk[p.data.sektor] || 0) + 1));
  const mx = Math.max(1, ...Object.values(sk)); const low = [...ds].sort((a, b) => a.n - b.n).slice(0, 3);
  const top2 = [...ds].sort((a, b) => b.n - a.n).slice(0, 2); const tot = ds.reduce((s, x) => s + x.n, 0);
  const selList = sel ? S.potensi.filter((p) => p.data.distrik === sel) : [];
  return aTop('Peta persebaran potensi', `${tot} potensi di 19 distrik · klik lingkaran distrik untuk melihat datanya`) + `
    <div class="two"><div class="stack">${map3dBlock('admin', baseMapSVG(W, H, circles, { fs: 9 }))}
      <div class="legend"><span>${use3D() ? 'Tinggi batang' : 'Ukuran lingkaran'} = jumlah potensi · warna = sektor terbanyak</span><span><i class="secdot" style="border:3px solid var(--coral);background:#fff"></i>Data masih sangat sedikit</span></div>
      ${sel ? `<div class="card stack-s"><div class="row between"><h3>Distrik ${esc(sel)}</h3><button type="button" class="chip" data-act="amap" data-v="">Tutup</button></div>${selList.length ? selList.map((p) => `<a class="item" href="#/admin/v/${esc(p.id)}">${secIcon(p.data.sektor, 36)}<span class="grow"><b>${esc(p.data.nama)}</b><small>${esc(p.data.sektor)}</small></span>${statusBadge(p.status)}</a>`).join('') : '<p class="small muted">Belum ada data dari distrik ini.</p>'}</div>` : ''}</div>
      <div class="stack"><div class="card stack-s"><h3>Potensi per sektor</h3>${Object.entries(sk).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stack-s" style="gap:4px"><div class="row between small"><span>${k}</span><span class="mono">${v}</span></div><div class="track"><i style="width:${(v / mx) * 100}%;background:${sec(k).c}"></i></div></div>`).join('')}</div>
        <div class="card hero stack-s"><div class="row"><span class="avatar"><img src="${CENRA_IMG.berpikir}" alt=""></span><b>Cenra memperhatikan</b></div>
          <p class="small" style="opacity:.88">${low.map((x) => `${x.nama} (${x.n})`).join(', ')} paling sedikit datanya. ${top2.map((x) => x.nama).join(' dan ')} menyumbang ${tot ? Math.round(((top2[0].n + top2[1].n) / tot) * 100) : 0}% seluruh potensi.</p>
          <p class="small" style="color:var(--cyan);font-weight:700">Saran: kirim tugas pendataan ke ${low.slice(0, 2).map((x) => x.nama).join(' dan ')} bulan ini.</p>
          <button type="button" class="btn amber" data-act="tugas" data-v="${esc(low.slice(0, 2).map((x) => x.nama).join(' dan '))}">Kirim tugas pendataan</button></div></div></div>`;
}
function aLevels() {
  const items = S.potensi.filter((p) => p.status === 'Terbit');
  const sug = items.filter((p) => suggestLevel(p) > p.level);
  return aTop('Tingkat kesiapan investasi', 'Naikkan level saat bukti lengkap · Cenra memberi saran dari data dan dokumen') + `
    ${sug.length ? `<div class="card hero row wrap"><span class="avatar"><img src="${CENRA_IMG.senang}" alt=""></span><div class="grow"><b>${sug.length} data siap naik level</b><p class="small muted">${sug.map((p) => esc(p.data.nama)).join(', ')}</p></div><button type="button" class="btn amber" data-act="apply-sug">Terapkan saran Cenra</button></div>`
      : `<div class="card hero row wrap"><span class="avatar"><img src="${CENRA_IMG.menyapa}" alt=""></span><div class="grow"><b>Belum ada saran naik level</b><p class="small muted">Unggah kajian kelayakan di Ekstraksi dokumen AI supaya Cenra bisa menilai.</p></div><a class="btn amber" href="#/admin/ekstraksi">Unggah dokumen</a></div>`}
    <div class="kanban">${[1, 2, 3, 4, 5].map((l) => { const col = items.filter((p) => p.level === l); return `<div class="kcol"><div class="row between"><b class="small">${l} · ${LEVELS[l]}</b><span class="badge b-n">${col.length}</span></div>${meter(l)}
      ${col.map((p) => { const s2 = suggestLevel(p); return `<div class="kcard${s2 > p.level ? ' sug' : ''}"><a href="#/admin/v/${esc(p.id)}" style="color:inherit;text-decoration:none"><b>${esc(p.data.nama)}</b></a><span class="xs muted">${esc(p.data.distrik)} · ${esc(p.data.sektor)}</span>
        ${s2 > p.level ? `<span class="badge b-a">${ic('spark', 'style="width:12px;height:12px"')} Cenra: naik ke level ${s2}</span>` : ''}
        <div class="mv"><button type="button" data-act="lvl" data-id="${esc(p.id)}" data-v="${l - 1}" ${l === 1 ? 'disabled' : ''} aria-label="Turunkan level">◀</button><button type="button" data-act="lvl" data-id="${esc(p.id)}" data-v="${l + 1}" ${l === 5 ? 'disabled' : ''} aria-label="Naikkan level">▶</button></div></div>`; }).join('')}</div>`; }).join('')}</div>`;
}
const EX = { stage: 'idle', text: '', name: '', res: null, target: '' };
function aExtract() {
  const items = S.potensi;
  let body = '';
  if (EX.stage === 'idle') {
    body = `<div class="two"><div class="stack"><label class="drop" id="drop">${ic('upload', 'style="width:34px;height:34px;color:var(--teal)"')}<b>Seret PDF atau teks ke sini, atau klik untuk memilih</b><span class="small muted">Kajian kelayakan, sertifikat lahan, atau surat pelepasan adat. Dibaca di perangkat ini, tidak dikirim ke luar.</span><input type="file" id="doc-in" accept=".pdf,.txt,application/pdf,text/plain" class="sr-only"></label>
      <button type="button" class="btn ghost" data-act="ex-sample">${ic('doc')} Coba dengan contoh dokumen kajian</button></div>
      ${cenraTip('Cenra membaca angka penting seperti nilai investasi, IRR, balik modal, kapasitas, status lahan, dan lokasi, lalu menyarankan tingkat kesiapan. Keputusan akhir tetap di verifikator.', 'menyapa', true)}</div>`;
  } else if (EX.stage === 'reading') {
    body = `<div class="card hero" style="text-align:center;display:grid;gap:14px;justify-items:center;padding:30px"><img src="${CENRA_IMG.berpikir}" alt="" style="width:150px;animation:bob 1.6s infinite"><h2>Sebentar ya, Cenra baca dokumennya…</h2><p class="small muted">${esc(EX.name)}</p>
      <div class="checks" style="width:min(420px,100%);text-align:left">${['Membaca isi dokumen', 'Mengenali angka keuangan', 'Mencocokkan dengan data potensi', 'Menyarankan tingkat kesiapan'].map((s, i) => `<div class="chk ${i < EX.prog ? 'ok' : 'bad'}"><span class="d">${i < EX.prog ? '✓' : '…'}</span><div><b>${s}</b></div></div>`).join('')}</div></div>`;
  } else {
    const r = EX.res; let html = esc(EX.text);
    r.fields.forEach((f) => { const m = esc(f.match); html = html.replace(m, `<mark>${m}</mark>`); });
    const lvSug = r.fields.some((f) => f.key === 'irr') && r.fields.some((f) => f.key === 'payback') ? 4 : 3;
    body = `<div class="two"><div class="stack"><div class="row between"><b>${ic('doc')} ${esc(EX.name)}</b><button type="button" class="btn sm ghost" data-act="ex-reset">${ic('upload')} Unggah lain</button></div><div class="docview">${html || '<span class="muted">Teks tidak terbaca.</span>'}</div></div>
      <div class="stack"><div class="card stack-s"><div class="row"><span class="avatar"><img src="${CENRA_IMG.senang}" alt=""></span><div><b>Hasil baca Cenra</b><br><span class="xs muted">${r.fields.length} isian ditemukan</span></div></div>
        ${r.fields.length ? r.fields.map((f) => `<div class="row" style="background:var(--bg);border-radius:12px;padding:9px 12px"><div class="grow"><span class="xs muted">${f.label}</span><br><b class="small">${esc(f.key === 'nilai' ? rp(f.value) : f.key === 'irr' ? fmtNum(f.value) + '%' : f.key === 'payback' ? f.value + ' tahun' : f.value)}</b></div><span class="badge ${f.conf >= 90 ? 'b-g' : 'b-a'} conf">${f.conf}%</span></div>`).join('')
          : '<p class="small muted">Cenra tidak menemukan angka penting. Pastikan PDF berisi teks (bukan hasil pindai gambar), atau coba berkas .txt.</p>'}</div>
        ${r.fields.length ? `<div class="card amber stack-s"><b style="color:var(--amberD)">${ic('spark')} Saran Cenra: Level ${lvSug}</b><p class="small">${lvSug === 4 ? 'Kajian kelayakan lengkap dengan analisis keuangan.' : 'Dokumen belum memuat IRR dan balik modal lengkap.'} Keputusan akhir tetap di verifikator.</p></div>
        <label class="field">Simpan ke data potensi<select id="ex-target">${items.map((p) => `<option value="${esc(p.id)}"${p.id === EX.target ? ' selected' : ''}>${esc(p.data.nama)} · ${esc(p.data.distrik)}</option>`).join('')}</select></label>
        <button type="button" class="btn" data-act="ex-save" data-v="${lvSug}">Simpan & naikkan ke Level ${lvSug}</button>` : ''}</div></div>`;
  }
  return aTop('Ekstraksi dokumen AI', 'Unggah kajian, sertifikat, atau surat. Cenra mengisi data potensi otomatis.') + body;
}
async function runExtract(name, text) {
  EX.name = name; EX.text = text; EX.stage = 'reading'; EX.prog = 0; rerender();
  for (let i = 1; i <= 4; i++) { await sleep(480); EX.prog = i; if (location.hash.startsWith('#/admin/ekstraksi')) rerender(); }
  EX.res = extractDoc(text);
  const judul = EX.res.judul || name; let best = null, bs = 0;
  S.potensi.forEach((p) => { const s = nameSim(judul, p.data.nama) + (EX.res.fields.find((f) => f.key === 'lokasi')?.value.includes(p.data.distrik) ? 0.3 : 0); if (s > bs) { bs = s; best = p; } });
  EX.target = best?.id || S.potensi[0]?.id; EX.stage = 'done'; rerender();
}
function aMinat() {
  const sel = S.minat.find((m) => m.id === S.minatSel) || S.minat[0];
  const p = sel && byId(sel.potensiId);
  return aTop('Minat investor', `${S.minat.length} pengajuan · ${S.minat.filter((m) => m.status === 'Baru').length} belum dihubungi`) + `
    <div class="two"><div class="table-wrap"><table class="table"><thead><tr><th>Investor</th><th>Peluang</th><th>Nilai</th><th>Status</th></tr></thead><tbody>
      ${S.minat.map((m) => { const pp = byId(m.potensiId); return `<tr class="click" data-act="msel" data-id="${esc(m.id)}" tabindex="0" style="${sel && sel.id === m.id ? 'background:rgba(25,163,155,.07)' : ''}"><td><b>${esc(m.nama)}</b><br><span class="xs muted">${esc(m.perusahaan || '')}</span></td><td>${esc(pp ? pp.data.nama : '—')}</td><td>${esc(m.nilai || '—')}</td>
        <td><span class="badge ${m.status === 'Baru' ? 'b-a' : m.status === 'Pertemuan' ? 'b-g' : 'b-t'}">${esc(m.status)}</span></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">Belum ada pengajuan.</td></tr>'}</tbody></table></div>
      ${sel ? `<div class="stack"><div class="card stack-s"><h2>${esc(sel.nama)}</h2><p class="small muted">${esc(sel.perusahaan || '')}</p>
        ${[['Peluang', p ? `${p.data.nama} · Level ${p.level}` : '—'], ['Rencana nilai', sel.nilai || '—'], ['Kontak', sel.kontak], ['Masuk', `${ago(sel.createdAt)} · ${sel.kode}`]].map(([k, v]) => `<div class="row between small"><span class="muted">${k}</span><b style="text-align:right">${esc(v)}</b></div>`).join('')}
        ${sel.pesan ? `<p class="small" style="color:var(--ink2)">"${esc(sel.pesan)}"</p>` : ''}
        <label class="field">Status<select data-act="mstatus" data-id="${esc(sel.id)}">${['Baru', 'Dihubungi', 'Pertemuan', 'Selesai'].map((s) => `<option${s === sel.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label></div>
        ${cenraTip(`${p && p.level >= 4 ? 'Investor serius: nilai sesuai peluang yang sudah punya kajian.' : 'Peluang masih di bawah level 4, siapkan data pendukung dulu.'} ${/listrik/i.test(sel.pesan || '') ? 'Ia menanyakan listrik, lampirkan data PLN setempat. ' : ''}Sarankan kunjungan lokasi minggu depan.`, 'berpikir', true)}
        <div class="card stack-s"><b class="small">Draf pesan dari Cenra</b><p class="small" id="draft-msg" style="color:var(--ink2)">${esc(draftPesan(sel))}</p>
          <div class="row wrap"><button type="button" class="btn sm ghost" data-act="copy-draft">${ic('copy')} Salin</button>
          ${/^\+?\d[\d\s-]{7,}$/.test(sel.kontak) ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${sel.kontak.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(draftPesan(sel))}">${ic('wa')} Kirim WhatsApp</a>` : `<a class="btn sm" href="mailto:${esc(sel.kontak)}?subject=${encodeURIComponent('Undangan kunjungan lokasi · DPMPTSP Kabupaten Jayapura')}&body=${encodeURIComponent(draftPesan(sel))}">${ic('send')} Kirim email</a>`}</div></div></div>` : ''}</div>`;
}

// =====================================================================
// Peta 3D (dimuat terpisah, jatuh ke peta 2D bila perangkat tidak mendukung WebGL)
// =====================================================================
let MAP = null; S.mapFull = false; S.loc = null;
const GEO = { box: BOX, coast: COAST, distrik: DISTRIK, lake: { lat: -2.618, lon: 140.50, rx: 0.12, ry: 0.022 } };
const REAL_BOUNDS = [[-3.22, 139.55], [-2.25, 140.80]];
const webglOK = (() => { let v; return () => { if (v === undefined) { try { const c = document.createElement('canvas'); v = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { v = false; } } return v; }; })();
// Jenis peta: sat (satelit, bawaan), road (jalan), 3d (diorama), 2d (skema ringan)
const MAPVIEWS = ['sat', 'road', '3d', '2d'];
const isReal = (v) => v === 'sat' || v === 'road';
const mapPref = () => { const v = LS.get('mapView', null); return MAPVIEWS.includes(v) ? v : 'sat'; };
function mapView() {
  let v = mapPref();
  if (isReal(v) && (S.online === false || S.realFail)) v = webglOK() ? '3d' : '2d';
  if (v === '3d' && !webglOK()) v = '2d';
  return v;
}
const use3D = () => mapView() === '3d';
function mapHome(mode) {
  // Investor: fokus ke kawasan yang paling banyak peluangnya (Sentani–Depapre–Nimboran) di layar kecil.
  if (mode === 'investor' && window.innerWidth < 700) return [[-2.75, 140.05], [-2.40, 140.65]];
  return null;
}
function map3dBlock(mode, svg) {
  const v = mapView(); const real = isReal(v); const pref = mapPref();
  const why = isReal(pref) && !real ? (S.online === false ? 'Sedang offline: peta satelit butuh internet, jadi tampil peta ' + v.toUpperCase() + '.' : 'Citra satelit tidak bisa dimuat. Menampilkan peta ' + v.toUpperCase() + '.') : '';
  const seg = `<div class="mapseg" role="group" aria-label="Jenis peta">${[['sat', 'Satelit'], ['road', 'Jalan'], ['3d', '3D'], ['2d', '2D']].filter(([k]) => k !== '3d' || webglOK())
    .map(([k, l]) => `<button type="button" data-act="mview" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div>`;
  const tools = real
    ? `<button type="button" data-act="m3" data-v="locate" class="${S.loc?.on ? 'on' : ''}" aria-pressed="${!!S.loc?.on}" aria-label="Lokasi saya" title="Lokasi saya">${ic('pin')}</button><button type="button" data-act="m3" data-v="reset" aria-label="Kembali ke seluruh kabupaten" title="Seluruh kabupaten">⟲</button><button type="button" data-act="m3" data-v="full" aria-label="Layar penuh" title="Layar penuh">⛶</button>`
    : v === '3d' ? `<button type="button" data-act="m3" data-v="reset" aria-label="Atur ulang tampilan" title="Atur ulang">⟲</button><button type="button" data-act="m3" data-v="in" aria-label="Perbesar">+</button><button type="button" data-act="m3" data-v="out" aria-label="Perkecil">−</button><button type="button" data-act="m3" data-v="full" aria-label="Layar penuh" title="Layar penuh">⛶</button>` : '';
  const loadTxt = real ? 'Memuat peta satelit…' : 'Menyiapkan peta 3D…';
  return `<div class="map3d ${mode}${real ? ' real' : ''}${S.mapFull ? ' full' : ''}" id="map3d" data-mode="${mode}" data-view="${v}">
    <div class="map3d-fallback">${svg}</div>
    ${v !== '2d' ? `<div class="map3d-load"><img src="${CENRA_IMG.berpikir}" alt=""><span>${loadTxt}</span></div>` : ''}
    ${seg}
    <div class="map3d-ui">${tools}</div>
    ${real ? `<div class="map3d-live" id="map-live"${S.loc?.on ? '' : ' hidden'}><i></i><span>${S.loc?.lat ? `Lokasi langsung · ±${Math.round(S.loc.acc)} m` : 'Mencari lokasi…'}</span></div>` : ''}
    ${v === '3d' ? '<div class="map3d-hint">Geser untuk memutar · cubit atau scroll untuk zoom · ketuk pin</div>' : ''}
    ${why ? `<div class="map3d-note">${esc(why)}</div>` : ''}</div>`;
}
function mapData(mode) {
  if (mode === 'admin') {
    return { bars: districtStats().map((x) => { const [, la, lo] = DISTRIK.find(([n]) => n === x.nama); const dom = Object.entries(x.sek).sort((a, b) => b[1] - a[1])[0];
      return { id: x.nama, label: `Distrik ${x.nama} · ${x.n} potensi`, lat: la, lon: lo, n: x.n, color: dom ? sec(dom[0]).hex : '#9AA8AB', low: x.n <= 1, selected: S.amapSel === x.nama }; }) };
  }
  return { pins: filtered().map((p) => ({ id: p.id, lat: p.data.lat, lon: p.data.lon, color: sec(p.data.sektor).hex, level: p.level, label: `${p.data.nama} · Level ${p.level}` })) };
}
function onMapPick(mode, id) {
  if (mode === 'admin') { S.amapSel = id; rerender(); return; }
  const p = byId(id); if (!p) return;
  openSheet(`${oppCard(p)}<div class="row"><button type="button" class="btn ghost grow" data-close>${t('Tutup', 'Close')}</button><button type="button" class="btn grow" data-go="#/investor/p/${esc(id)}">${t('Lihat detail', 'View details')}</button></div>`);
}
function onLocate(st) {
  S.loc = st.on ? { ...(S.loc || {}), ...st } : null;
  const live = $('#map-live'); const btn = $('#map3d [data-v="locate"]');
  if (btn) { btn.classList.toggle('on', !!st.on); btn.setAttribute('aria-pressed', String(!!st.on)); }
  if (live) { live.hidden = !st.on; live.querySelector('span').textContent = st.lat ? `Lokasi langsung · ±${Math.round(st.acc)} m` : 'Mencari lokasi…'; }
  if (st.error) toast(st.error, 'warn');
  if (st.lat && !S.locToast) { S.locToast = true; toast(st.inside ? 'Lokasi Anda tampil di peta dan ikut bergerak.' : 'Lokasi Anda di luar Kabupaten Jayapura.', 'ok'); }
  if (!st.on) S.locToast = false;
}
function attachMap() {
  const box = $('#map3d');
  if (!box) { if (MAP) { MAP.inst.destroy(); MAP = null; S.loc = null; } return; }
  const mode = box.dataset.mode; const view = box.dataset.view; const kind = isReal(view) ? 'real' : view === '3d' ? '3d' : null;
  if (!kind) { if (MAP) { MAP.inst.destroy(); MAP = null; S.loc = null; } return; }
  if (MAP && MAP.mode === mode && MAP.kind === kind) {
    box.prepend(MAP.inst.el); box.classList.add('ready');
    if (kind === 'real') MAP.inst.setBase(view);
    MAP.inst.update(mapData(mode)); requestAnimationFrame(() => MAP && MAP.inst.resize()); return;
  }
  if (MAP) { MAP.inst.destroy(); MAP = null; S.loc = null; }
  if (kind === 'real') {
    import('./realmap.js').then((mod) => mod.createRealMap(box, { mode, base: view, bounds: REAL_BOUNDS, home: mapHome(mode), ...mapData(mode),
      onPick: (id) => onMapPick(mode, id), onLocate,
      onTiles: (ok) => { const b = $('#map3d'); if (!b) return; if (ok) b.classList.add('tiles'); else if (!b.classList.contains('tiles')) { S.realFail = true; toast('Peta satelit tidak bisa dimuat dari jaringan ini. Menampilkan peta 3D.', 'warn'); if (MAP) { MAP.inst.destroy(); MAP = null; } rerender(); } } }))
      .then((inst) => {
        if (!box.isConnected) { inst.destroy(); return; }
        MAP = { mode, kind, inst }; box.classList.add('ready');
      })
      .catch((e) => { console.warn('Peta satelit gagal dimuat', e); S.realFail = true; rerender(); });
    return;
  }
  import('./map3d.js').then((mod) => {
    if (!box.isConnected) return;
    const inst = mod.createMap(box, { geo: GEO, mode, ...mapData(mode), onPick: (id) => onMapPick(mode, id) });
    MAP = { mode, kind, inst }; box.prepend(inst.el); box.classList.add('ready');
    setTimeout(() => MAP && MAP.inst === inst && inst.update(mapData(mode)), 300);
  }).catch((e) => { console.warn('Peta 3D gagal dimuat, memakai peta 2D', e); LS.set('mapView', '2d'); rerender(); });
}

// =====================================================================
// Lembar bawah (sheet)
// =====================================================================
function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; document.body.style.overflow = 'hidden'; $('#sheet-body button, #sheet-body input')?.focus(); }
function closeSheet() { $('#sheet').hidden = true; document.body.style.overflow = ''; }

// =====================================================================
// Verifikasi data diri investor (KYC) & keamanan akun
// =====================================================================
S.kyc = LS.get('kyc', null);
const KYC_LABEL = { Belum: 'Belum diverifikasi', Menunggu: 'Sedang ditinjau', Terverifikasi: 'Terverifikasi', Ditolak: 'Perlu diperbaiki' };
const kycBadge = (st) => `<span class="badge ${st === 'Terverifikasi' ? 'b-g' : st === 'Menunggu' ? 'b-a' : st === 'Ditolak' ? 'b-r' : 'b-n'}">${KYC_LABEL[st] || st}</span>`;
const tglID = (v) => (v ? new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const kycOK = () => S.kyc?.status === 'Terverifikasi';
function setKyc(k) { if (!k) return; S.kyc = k; LS.set('kyc', k); }
async function loadKyc() { if (!isRole('investor') || (!S.online && !LOCAL)) return; try { const r = await api('/api/kyc'); setKyc(r.status); S.kycSaved = r; } catch { /* offline */ } }

// Sama seperti pengecekan di server: 16 angka, kode provinsi, tanggal lahir DDMMYY (perempuan: tanggal + 40).
const PROV = '11 12 13 14 15 16 17 18 19 21 31 32 33 34 35 36 51 52 53 61 62 63 64 65 71 72 73 74 75 76 81 82 91 92 93 94 95 96'.split(' ');
function nikProblem(nik, tgl) {
  nik = String(nik || '').replace(/\D/g, '');
  if (nik.length !== 16) return 'NIK harus 16 angka';
  if (!PROV.includes(nik.slice(0, 2))) return 'Kode provinsi pada NIK tidak dikenal';
  if (!tgl) return null;
  let dd = +nik.slice(6, 8); const mm = +nik.slice(8, 10), yy = +nik.slice(10, 12); if (dd > 40) dd -= 40;
  const [y, m, d] = tgl.split('-').map(Number);
  return dd === d && mm === m && yy === y % 100 ? null : 'Tanggal lahir tidak cocok dengan NIK';
}
const KJ = { perorangan: ['Perorangan WNI', 'Warga negara Indonesia, memakai KTP', 'user'], asing: ['Perorangan WNA', 'Warga negara asing, memakai paspor', 'users'], badan: ['Badan usaha', 'PT, CV, koperasi, atau PT PMA', 'doc'] };
const KDOC = { identitas: ['Foto KTP / paspor', 'Seluruh kartu terlihat, tulisan terbaca, tanpa pantulan cahaya', 'environment'],
  selfie: ['Swafoto memegang identitas', 'Wajah dan kartu terlihat jelas dalam satu foto', 'user'],
  nib: ['Dokumen NIB (OSS)', 'Halaman pertama NIB dari oss.go.id, foto atau PDF', 'environment'],
  npwp: ['Kartu NPWP badan usaha', 'Foto kartu atau surat keterangan terdaftar', 'environment'] };
const kycSteps = (d) => ['Jenis', 'Data diri', ...(d.jenis === 'badan' ? ['Badan usaha'] : []), 'Rencana', 'Dokumen', 'Kirim'];
function kycNeedDocs(d) { return ['identitas', 'selfie', ...(d.jenis === 'badan' ? ['nib', 'npwp'] : [])]; }
function kycDraft() {
  if (!S.kf) {
    const prev = S.kycSaved?.data || {};
    S.kf = { step: 0, files: {}, data: { jenis: prev.jenis || '', nama: prev.nama || me()?.nama || '', idJenis: prev.idJenis || '', idNomor: '', tempatLahir: prev.tempatLahir || '', tglLahir: prev.tglLahir || '',
      kewarganegaraan: prev.kewarganegaraan || '', alamat: prev.alamat || '', telepon: prev.telepon || me()?.telepon || '', jabatan: prev.jabatan || '', usahaNama: prev.usahaNama || me()?.perusahaan?.split(' · ')[0] || '',
      usahaBentuk: prev.usahaBentuk || '', nib: prev.nib || '', npwp: '', usahaAlamat: prev.usahaAlamat || '', situs: prev.situs || '', sektor: prev.sektor || [], nilai: prev.nilai || '', dana: prev.dana || '' }, setuju1: false, setuju2: false };
  }
  return S.kf;
}
const kIn = (k, label, opt = {}) => `<label class="field">${label}${opt.req === false ? '' : ' *'}${opt.hint ? ` <span class="hint">${opt.hint}</span>` : ''}
  <input data-kf="${k}" value="${esc(S.kf.data[k] || '')}" ${opt.type ? `type="${opt.type}"` : ''} ${opt.mode ? `inputmode="${opt.mode}"` : ''} ${opt.ac ? `autocomplete="${opt.ac}"` : 'autocomplete="off"'} ${opt.max ? `maxlength="${opt.max}"` : ''} placeholder="${opt.ph || ''}"></label>`;
const kSel = (k, label, opts) => `<label class="field">${label} *<select data-kf="${k}"><option value="">Pilih…</option>${opts.map((o) => `<option${S.kf.data[k] === o ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`;

function kycValid(name) {
  const d = S.kf.data;
  if (name === 'Jenis') return d.jenis ? null : 'Pilih jenis investor';
  if (name === 'Data diri') {
    for (const [k, l] of [['nama', 'nama sesuai identitas'], ['idNomor', 'nomor identitas'], ['tempatLahir', 'tempat lahir'], ['tglLahir', 'tanggal lahir'], ['kewarganegaraan', 'kewarganegaraan'], ['alamat', 'alamat'], ['telepon', 'nomor HP']]) if (!String(d[k] || '').trim()) return 'Isi ' + l;
    const age = (Date.now() - new Date(d.tglLahir)) / 31557600000; if (!(age >= 17)) return 'Umur penanggung jawab harus 17 tahun atau lebih';
    if (d.idJenis === 'KTP') { const p = nikProblem(d.idNomor, d.tglLahir); if (p) return p; } else if (!/^[A-Za-z0-9]{6,9}$/.test(d.idNomor)) return 'Nomor paspor harus 6–9 huruf/angka';
    if (!/^\+?[\d\s-]{8,18}$/.test(d.telepon)) return 'Nomor HP tidak valid';
    if (d.jenis === 'badan' && !d.jabatan.trim()) return 'Isi jabatan Anda di badan usaha';
  }
  if (name === 'Badan usaha') {
    for (const [k, l] of [['usahaNama', 'nama badan usaha'], ['usahaBentuk', 'bentuk badan usaha'], ['nib', 'NIB'], ['npwp', 'NPWP'], ['usahaAlamat', 'alamat kantor']]) if (!String(d[k] || '').trim()) return 'Isi ' + l;
    if (d.nib.replace(/\D/g, '').length !== 13) return 'NIB harus 13 angka';
    if (![15, 16].includes(d.npwp.replace(/\D/g, '').length)) return 'NPWP harus 15 atau 16 angka';
  }
  if (name === 'Rencana') { if (!d.sektor.length) return 'Pilih minimal satu sektor'; if (!d.nilai) return 'Pilih kisaran nilai investasi'; if (!d.dana) return 'Pilih sumber dana'; }
  if (name === 'Dokumen') { const have = new Set([...Object.keys(S.kf.files), ...(S.kycSaved?.files || []).map((f) => f.jenis)]); const miss = kycNeedDocs(d).filter((x) => !have.has(x)); if (miss.length) return 'Belum diunggah: ' + miss.map((x) => KDOC[x][0]).join(', '); }
  return null;
}

function iVerif() {
  const st = S.kyc?.status || 'Belum';
  const head = `<div class="head"><a class="back" href="#/investor/disimpan" aria-label="Kembali">${ic('back')}</a><div class="grow"><h1 style="font-size:22px">Verifikasi data diri</h1><p class="small muted">Wajib sebelum mengajukan minat investasi</p></div>${kycBadge(st)}</div>`;
  if (st === 'Terverifikasi' && !S.kfEdit) return `<div class="page">${head}
    <div class="card hero stack-s" style="text-align:center;justify-items:center"><img src="${CENRA_IMG.senang}" alt="" style="width:110px"><h2>Data diri Anda sudah terverifikasi</h2>
      <p class="small muted">Diverifikasi DPMPTSP Kabupaten Jayapura${S.kyc.ditinjau ? ' pada ' + dateID(S.kyc.ditinjau) : ''}. Sekarang Anda bisa mengajukan minat pada peluang mana pun.</p>
      <a class="btn" href="#/investor/daftar">Cari peluang</a></div>
    ${kycSummary()}</div>`;
  if (st === 'Menunggu') return `<div class="page">${head}
    <div class="card amber stack-s" style="text-align:center;justify-items:center"><img src="${CENRA_IMG.berpikir}" alt="" style="width:100px"><h2>Data Anda sedang ditinjau</h2>
      <p class="small">Petugas DPMPTSP mencocokkan identitas dan dokumen Anda, biasanya 1–2 hari kerja. Anda akan melihat hasilnya di sini.</p></div>
    <div class="card stack-s">${[['Data dan dokumen terkirim', true, S.kyc.dikirim], ['Ditinjau petugas DPMPTSP', false], ['Siap mengajukan minat', false]].map(([t_, done, tm], i) => `<div class="row"><span class="kstep ${done ? 'done' : i === 1 ? 'now' : ''}">${done ? '✓' : i + 1}</span><span class="grow"><b class="small">${t_}</b>${tm ? `<br><span class="xs muted">${dateID(tm)}</span>` : ''}</span></div>`).join('')}</div>
    ${kycSummary()}</div>`;
  const f = kycDraft(); const steps = kycSteps(f.data); const cur = steps[f.step]; const d = f.data;
  let body = '';
  if (cur === 'Jenis') body = `<p class="small muted">Pilih yang sesuai. Untuk badan usaha, isi data penanggung jawab lalu data perusahaannya.</p>
    <div class="stack">${Object.entries(KJ).map(([k, [t_, s_, i]]) => `<button type="button" class="sector" aria-pressed="${d.jenis === k}" data-act="kjenis" data-v="${k}" style="display:flex;gap:12px;align-items:center"><span class="ic" style="background:var(--soft);color:var(--teal)">${ic(i)}</span><span class="grow"><b>${t_}</b><br><small class="muted" style="font-weight:500">${s_}</small></span></button>`).join('')}</div>`;
  if (cur === 'Data diri') {
    const nikP = d.idJenis === 'KTP' && d.idNomor.replace(/\D/g, '').length === 16 ? nikProblem(d.idNomor, d.tglLahir) : null;
    body = `${d.jenis === 'badan' ? '<p class="small muted">Isi data penanggung jawab (direktur atau orang yang diberi kuasa).</p>' : ''}
    ${kIn('nama', 'Nama lengkap sesuai identitas', { ac: 'name' })}
    ${d.jenis === 'badan' ? `<div class="field">Jenis identitas *<div class="chips">${['KTP', 'Paspor'].map((x) => `<button type="button" class="chip" aria-pressed="${d.idJenis === x}" data-act="kidj" data-v="${x}">${x}</button>`).join('')}</div></div>` : ''}
    ${kIn('idNomor', d.idJenis === 'Paspor' ? 'Nomor paspor' : 'NIK (16 angka)', { mode: d.idJenis === 'Paspor' ? 'text' : 'numeric', max: d.idJenis === 'Paspor' ? 9 : 16 })}
    <div class="grid2">${kIn('tempatLahir', 'Tempat lahir')}${kIn('tglLahir', 'Tanggal lahir', { type: 'date', ac: 'bday' })}</div>
    <div id="nik-hint">${nikP ? `<div class="card coral small">${nikP}. Periksa lagi NIK atau tanggal lahir.</div>` : d.idJenis === 'KTP' && d.idNomor.replace(/\D/g, '').length === 16 && d.tglLahir ? '<div class="cenra-tip"><span class="avatar"><img src="' + CENRA_IMG.senang + '" alt=""></span><div><b>Cenra</b><p>NIK cocok dengan tanggal lahir.</p></div></div>' : ''}</div>
    ${d.jenis === 'perorangan' ? '' : kIn('kewarganegaraan', 'Kewarganegaraan', { ph: 'mis. Indonesia, Jepang' })}
    ${kIn('alamat', 'Alamat sesuai identitas', { ac: 'street-address' })}
    ${kIn('telepon', 'Nomor HP / WhatsApp', { type: 'tel', ac: 'tel', ph: '08xx atau +kode negara' })}
    ${d.jenis === 'badan' ? kIn('jabatan', 'Jabatan di badan usaha', { ph: 'mis. Direktur Utama' }) : kIn('jabatan', 'Pekerjaan', { req: false })}`;
  }
  if (cur === 'Badan usaha') body = `${kIn('usahaNama', 'Nama badan usaha', { ac: 'organization' })}
    ${kSel('usahaBentuk', 'Bentuk badan usaha', ['PT', 'PT PMA', 'CV', 'Koperasi', 'BUMN/BUMD', 'Lainnya'])}
    <div class="grid2">${kIn('nib', 'NIB', { mode: 'numeric', max: 13, hint: '13 angka dari OSS' })}${kIn('npwp', 'NPWP badan usaha', { mode: 'numeric', max: 20, hint: '15/16 angka' })}</div>
    ${kIn('usahaAlamat', 'Alamat kantor')}${kIn('situs', 'Situs web perusahaan', { req: false, ph: 'mis. perusahaan.co.id' })}`;
  if (cur === 'Rencana') body = `<div class="field">Sektor yang diminati *<div class="chips">${['Perikanan', 'Perkebunan', 'Pariwisata', 'Pertanian'].map((x) => `<button type="button" class="chip" aria-pressed="${d.sektor.includes(x)}" data-act="ksek" data-v="${x}"><i style="background:${sec(x).c}"></i>${x}</button>`).join('')}</div></div>
    <div class="field">Kisaran nilai investasi *<div class="chips">${['< Rp 10 M', 'Rp 10–20 M', '> Rp 20 M'].map((x) => `<button type="button" class="chip" aria-pressed="${d.nilai === x}" data-act="knil" data-v="${x}">${x}</button>`).join('')}</div></div>
    ${kSel('dana', 'Sumber dana', ['Modal sendiri', 'Pinjaman bank', 'Mitra / investor lain', 'Campuran'])}
    <p class="xs muted">Sumber dana ditanyakan untuk mencegah pencucian uang, sesuai praktik layanan perizinan berusaha.</p>`;
  if (cur === 'Dokumen') {
    const saved = Object.fromEntries((S.kycSaved?.files || []).map((x) => [x.jenis, x]));
    body = `<p class="small muted">Foto langsung dari kamera atau pilih berkas. Foto dikecilkan otomatis di HP sebelum dikirim. PDF maks. 4 MB.</p>
    <div class="stack">${kycNeedDocs(d).map((j) => { const [t_, s_, cap] = KDOC[j]; const has = f.files[j]; const old = saved[j];
      return `<div class="kdoc ${has || old ? 'ok' : ''}"><div class="kdoc-prev">${has ? (has.startsWith('data:application/pdf') ? `<span class="pdf">PDF</span>` : `<img src="${has}" alt="">`) : ic(j === 'selfie' ? 'user' : 'doc')}</div>
        <div class="grow"><b>${t_}</b><small>${has ? 'Siap dikirim' : old ? 'Sudah diunggah sebelumnya. Ganti bila perlu.' : s_}</small></div>
        <label class="btn sm ${has || old ? 'ghost' : ''}">${ic('cam')} ${has || old ? 'Ganti' : 'Ambil'}<input type="file" hidden data-kdoc="${j}" accept="image/*${j === 'nib' || j === 'npwp' ? ',application/pdf' : ''}" capture="${cap}"></label></div>`; }).join('')}</div>
    <div class="cenra-tip"><span class="avatar"><img src="${CENRA_IMG.menyapa}" alt=""></span><div><b>Cenra</b><p>Dokumen hanya bisa dibuka petugas verifikasi DPMPTSP, disimpan terenkripsi, dan setiap kali dibuka tercatat di log keamanan.</p></div></div>`;
  }
  if (cur === 'Kirim') body = `${kycSummary(true)}
    <label class="check"><input type="checkbox" data-kchk="setuju1" ${f.setuju1 ? 'checked' : ''}> Saya menyatakan data dan dokumen ini benar dan milik saya atau badan usaha yang saya wakili.</label>
    <label class="check"><input type="checkbox" data-kchk="setuju2" ${f.setuju2 ? 'checked' : ''}> Saya setuju DPMPTSP Kabupaten Jayapura memproses data pribadi saya hanya untuk verifikasi investor dan tindak lanjut minat investasi, sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi. Saya bisa meminta data dihapus kapan saja.</label>`;
  return `<div class="page">${head}
    ${st === 'Ditolak' ? `<div class="card coral stack-s"><b>Verifikasi sebelumnya belum diterima</b><p class="small">Alasan dari petugas: ${esc(S.kyc.alasan || '-')}</p><p class="xs muted">Perbaiki data atau dokumen yang disebutkan, lalu kirim ulang.</p></div>` : ''}
    ${st === 'Belum' && f.step === 0 ? `<div class="cenra-tip"><span class="avatar"><img src="${CENRA_IMG.menyapa}" alt=""></span><div><b>Kenapa perlu verifikasi?</b><p>Supaya DPMPTSP hanya menindaklanjuti investor yang jelas identitasnya, dan data peluang serta kontak warga kampung tidak jatuh ke pihak yang salah. Butuh sekitar 5 menit.</p></div></div>` : ''}
    <div><div class="steps">${steps.map((_, i) => `<i class="${i <= f.step ? 'on' : ''}"></i>`).join('')}</div><p class="xs muted" style="margin-top:6px">Langkah ${f.step + 1} dari ${steps.length} · ${cur}</p></div>
    <div class="stack" id="kyc-body">${body}</div>
    <div id="kyc-err" class="card coral small" hidden></div>
    <div class="actionbar">${f.step ? '<button type="button" class="btn ghost" data-act="kstep" data-d="-1">Kembali</button>' : ''}
      <button type="button" class="btn grow" data-act="${cur === 'Kirim' ? 'ksend' : 'kstep'}" data-d="1">${cur === 'Kirim' ? 'Kirim untuk diverifikasi' : 'Lanjut'}</button></div></div>`;
}
function kycSummary(draft) {
  const d = draft ? S.kf.data : (S.kycSaved?.data || {}); if (!d.nama) return '';
  const rows = [['Jenis', KJ[d.jenis]?.[0]], ['Nama', d.nama], [d.idJenis || 'Identitas', d.idNomor ? (draft ? d.idNomor : d.idNomor) : ''], ['Lahir', [d.tempatLahir, d.tglLahir && tglID(d.tglLahir)].filter(Boolean).join(', ')],
    ['HP', d.telepon], ...(d.jenis === 'badan' ? [['Badan usaha', `${d.usahaBentuk || ''} ${d.usahaNama || ''}`.trim()], ['NIB', d.nib]] : []), ['Minat', (d.sektor || []).join(', ') + (d.nilai ? ' · ' + d.nilai : '')]];
  return `<div class="card stack-s"><b>${draft ? 'Periksa sebelum mengirim' : 'Data yang Anda kirim'}</b>${rows.filter((r) => r[1]).map(([k, v]) => `<div class="row between small"><span class="muted">${k}</span><b style="text-align:right">${esc(v)}</b></div>`).join('')}
    ${draft ? `<p class="xs muted">Dokumen: ${kycNeedDocs(d).map((j) => KDOC[j][0]).join(', ')}</p>` : ''}</div>`;
}
async function kycAddDoc(jenis, file) {
  if (!file) return;
  if (file.type === 'application/pdf') {
    if (file.size > 4 * 1024 * 1024) return toast('PDF terlalu besar (maks. 4 MB).', 'warn');
    S.kf.files[jenis] = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }); return rerender();
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
    c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    S.kf.files[jenis] = c.toDataURL('image/jpeg', 0.8); rerender();
  } catch { toast('Foto tidak bisa dibaca. Coba ambil ulang.', 'warn'); } finally { URL.revokeObjectURL(url); }
}
async function kycSend(btn) {
  const f = S.kf; const err = $('#kyc-err');
  if (!f.setuju1 || !f.setuju2) { err.hidden = false; err.textContent = 'Centang kedua pernyataan dulu.'; return; }
  if (!S.online && !LOCAL) { err.hidden = false; err.textContent = 'Pengiriman verifikasi butuh internet. Data Anda tetap di layar ini, kirim lagi saat ada sinyal.'; return; }
  btn.disabled = true; btn.textContent = 'Mengirim…';
  try {
    const r = await api('/api/kyc', { method: 'POST', body: { data: f.data, files: f.files, setuju: true }, timeout: 60000 });
    setKyc(r.status); S.kf = null; S.kfEdit = false; await loadKyc(); toast('Data terkirim. Petugas DPMPTSP akan meninjaunya.', 'ok'); rerender();
  } catch (x) { err.hidden = false; err.textContent = x.status ? x.message : 'Tidak bisa terhubung ke server. Coba lagi.'; btn.disabled = false; btn.textContent = 'Kirim untuk diverifikasi'; }
}

// ---------- admin: verifikasi investor ----------
async function loadAkyc(force) {
  if (S.akycLoading || (S.akyc && !force)) return; S.akycLoading = true;
  try { S.akyc = (await api('/api/admin/kyc')).items; } catch (x) { toast(x.message || 'Gagal memuat data investor', 'warn'); S.akyc = S.akyc || []; } finally { S.akycLoading = false; }
  if (location.hash.startsWith('#/admin')) rerender();
}
function aKyc() {
  if (!S.akyc) { loadAkyc(); return aTop('Verifikasi investor', 'Memuat…'); }
  const fl = S.akycF || 'Menunggu'; const items = S.akyc.filter((x) => fl === 'Semua' || x.status === fl);
  const n = (s) => S.akyc.filter((x) => x.status === s).length;
  return aTop('Verifikasi investor', 'Cocokkan identitas dan dokumen investor sebelum mereka bisa mengajukan minat', `<button type="button" class="btn sm ghost" data-act="akyc-reload">${ic('sync')} Muat ulang</button>`) + `
    <div class="chips">${['Menunggu', 'Terverifikasi', 'Ditolak', 'Belum', 'Semua'].map((s) => `<button type="button" class="chip" aria-pressed="${fl === s}" data-act="akycf" data-v="${s}">${s === 'Belum' ? 'Belum mengisi' : s}${s !== 'Semua' ? ` · ${n(s)}` : ''}</button>`).join('')}</div>
    <div class="table-wrap"><table class="table"><tr><th>Investor</th><th>Jenis</th><th>Identitas</th><th>Status</th><th>Dikirim</th></tr>
      ${items.map((x) => `<tr class="click" data-go="#/admin/investor/${x.id}"><td><b>${esc(x.nama)}</b><br><span class="xs muted">${esc(x.perusahaan || x.email)}</span></td><td class="small">${x.jenis ? KJ[x.jenis][0] : '—'}</td>
        <td class="mono">${x.idMasked ? `${esc(x.idJenis)} ${esc(x.idMasked)}` : '—'}</td><td>${kycBadge(x.status)}</td><td class="small muted">${x.dikirim ? ago(x.dikirim * 1000) : 'belum'}</td></tr>`).join('') || '<tr><td colspan="5" class="small muted" style="padding:20px">Tidak ada data pada filter ini.</td></tr>'}</table></div>`;
}
async function loadAkycDetail(uid, full) {
  try {
    const r = await api(`/api/admin/kyc/${uid}${full ? '?lengkap=1' : ''}`);
    for (const f of r.files) {
      const res = await fetch(apiUrl(`/api/kyc/berkas/${f.id}`), { headers: { Authorization: 'Bearer ' + S.auth.token, 'X-Auth-Token': S.auth.token }, cache: 'no-store' });
      f.url = URL.createObjectURL(await res.blob());
    }
    (S.akycD?.files || []).forEach((f) => f.url && URL.revokeObjectURL(f.url));
    S.akycD = { uid: +uid, full: !!full, ...r };
  } catch (x) { toast(x.message || 'Gagal memuat', 'warn'); S.akycD = { uid: +uid, error: true }; }
  if (location.hash === `#/admin/investor/${uid}`) rerender();
}
function aKycDetail(uid) {
  const D2 = S.akycD;
  if (!D2 || D2.uid !== +uid) { loadAkycDetail(uid); return aTop('Verifikasi investor', 'Memuat data…'); }
  if (D2.error) return aTop('Verifikasi investor', 'Data tidak bisa dimuat');
  const d = D2.data || {}; const st = D2.status.status;
  const row = (k, v, mono) => v ? `<div><small>${k}</small><b class="${mono ? 'mono' : ''}">${esc(v)}</b></div>` : '';
  const bad = D2.checks.filter((c) => !c.ok).length;
  return `<a href="#/admin/investor" class="small" style="font-weight:700;text-decoration:none">${ic('back', 'style="width:14px;height:14px"')} Verifikasi investor</a>` +
    aTop(esc(D2.user.nama), `${esc(d.usahaNama || D2.user.perusahaan || '')} · ${esc(D2.user.email)} · dikirim ${D2.status.dikirim ? dateID(D2.status.dikirim) : '—'}`, kycBadge(st)) + `
    <div class="two"><div class="stack">
      ${st === 'Belum' ? '<div class="card soft">Investor ini belum mengisi data diri.</div>' : `
      <div class="card stack-s"><div class="row between"><h3>Data penanggung jawab</h3><button type="button" class="btn sm ghost" data-act="akyc-full" data-id="${D2.uid}">${D2.full ? 'Sembunyikan nomor' : 'Tampilkan nomor lengkap'}</button></div>
        <div class="kv">${row('Jenis investor', KJ[d.jenis]?.[0])}${row('Nama sesuai identitas', d.nama)}${row(d.idJenis, d.idNomor, true)}${row('Kewarganegaraan', d.kewarganegaraan)}
          ${row('Tempat, tanggal lahir', `${d.tempatLahir}, ${d.tglLahir ? tglID(d.tglLahir) : ''}`)}${row('Nomor HP', d.telepon)}${row('Jabatan / pekerjaan', d.jabatan)}${row('Alamat', d.alamat)}</div>
        ${D2.full ? '<p class="xs muted">Nomor lengkap ditampilkan. Tindakan ini tercatat di log keamanan.</p>' : ''}</div>
      ${d.jenis === 'badan' ? `<div class="card stack-s"><h3>Badan usaha</h3><div class="kv">${row('Nama', `${d.usahaBentuk} ${d.usahaNama}`)}${row('NIB', d.nib, true)}${row('NPWP', d.npwp, true)}${row('Situs', d.situs)}${row('Alamat kantor', d.usahaAlamat)}</div></div>` : ''}
      <div class="card stack-s"><h3>Rencana investasi</h3><div class="kv">${row('Sektor', (d.sektor || []).join(', '))}${row('Kisaran nilai', d.nilai)}${row('Sumber dana', d.dana)}</div></div>
      <div class="card stack-s"><h3>Dokumen</h3><div class="kdocs">${D2.files.map((f) => `<a class="kdoc-big" href="${f.url}" target="_blank" rel="noopener">${f.mime === 'application/pdf' ? '<span class="pdf">PDF</span>' : `<img src="${f.url}" alt="${esc(KDOC[f.jenis]?.[0] || f.jenis)}">`}<span>${esc(KDOC[f.jenis]?.[0] || f.jenis)}</span></a>`).join('')}</div>
        <p class="xs muted">Setiap dokumen yang dibuka tercatat di log keamanan. Cocokkan wajah di swafoto dengan foto identitas.</p></div>`}
    </div><div class="stack">
      ${D2.checks.length ? `<div class="card hero stack-s"><div class="row between"><b>${ic('spark')} Pemeriksaan Cenra</b><span class="small">${D2.checks.length - bad} lolos · ${bad} dicek</span></div>
        <div class="checks">${D2.checks.map((c) => `<div class="chk ${c.ok ? 'ok' : 'bad'}"><span class="d">${c.ok ? '✓' : '!'}</span><div><b>${esc(c.t)}</b><small>${esc(c.d)}</small></div></div>`).join('')}</div>
        <p class="xs muted">Cenra hanya memeriksa format dan kecocokan data. Keaslian dokumen tetap dinilai petugas.</p></div>` : ''}
      ${st === 'Menunggu' ? `<div class="card stack-s"><h3>Keputusan</h3>
        <label class="field">Alasan bila ditolak<textarea id="akyc-alasan" placeholder="Tulis yang perlu diperbaiki investor"></textarea></label>
        <div class="chips">${['Foto identitas buram atau terpotong', 'Wajah di swafoto tidak sama dengan identitas', 'Nama tidak sama dengan identitas', 'NIB tidak ditemukan di OSS'].map((r) => `<button type="button" class="chip soft" data-act="akyc-r" data-v="${esc(r)}">${r}</button>`).join('')}</div>
        <div class="row"><button type="button" class="btn ghost grow" data-act="akyc-tolak" data-id="${D2.uid}">Tolak</button><button type="button" class="btn grow" data-act="akyc-ok" data-id="${D2.uid}">Setujui</button></div></div>`
        : st !== 'Belum' ? `<div class="card stack-s"><h3>Keputusan</h3><p class="small">${kycBadge(st)} ${D2.reviewer ? 'oleh ' + esc(D2.reviewer) : ''} ${D2.status.ditinjau ? 'pada ' + dateID(D2.status.ditinjau) : ''}</p>${D2.status.alasan ? `<p class="small muted">Alasan: ${esc(D2.status.alasan)}</p>` : ''}</div>` : ''}
    </div></div>`;
}
async function akycDecide(uid, aksi) {
  const alasan = $('#akyc-alasan')?.value || '';
  if (aksi === 'tolak' && alasan.trim().length < 10) return toast('Tulis alasan penolakan (minimal 10 karakter).', 'warn');
  if (aksi === 'setujui' && !confirm('Setujui verifikasi investor ini? Investor akan bisa mengajukan minat.')) return;
  try { await api(`/api/admin/kyc/${uid}`, { method: 'POST', body: { aksi, alasan } }); toast(aksi === 'setujui' ? 'Investor terverifikasi' : 'Verifikasi ditolak, investor diberi tahu alasannya', 'ok'); S.akycD = null; S.akyc = null; location.hash = '#/admin/investor'; }
  catch (x) { toast(x.message || 'Gagal menyimpan', 'warn'); }
}

// ---------- admin: log keamanan ----------
const AUDIT_LABEL = { login: 'Masuk', login_gagal: 'Gagal masuk', login_dikunci: 'Akun dikunci sementara', daftar_investor: 'Pendaftaran investor', kyc_dikirim: 'Data diri dikirim',
  kyc_disetujui: 'Verifikasi disetujui', kyc_ditolak: 'Verifikasi ditolak', kyc_identitas_ganda: 'Identitas dipakai akun lain', lihat_dokumen_kyc: 'Membuka dokumen KYC',
  lihat_nomor_identitas: 'Melihat nomor identitas lengkap', potensi_terbit: 'Menerbitkan potensi', potensi_kembalikan: 'Mengembalikan potensi', ubah_level: 'Mengubah level',
  ubah_data_potensi: 'Mengubah data potensi', status_minat: 'Mengubah status minat', reset_data_demo: 'Reset data demo', ganti_sandi: 'Ganti kata sandi', ganti_sandi_gagal: 'Gagal ganti kata sandi',
  keluar_semua_perangkat: 'Keluar dari semua perangkat' };
const AUDIT_WARN = new Set(['login_gagal', 'login_dikunci', 'kyc_identitas_ganda', 'ganti_sandi_gagal', 'lihat_nomor_identitas']);
async function loadAudit() {
  if (S.auditLoading) return; S.auditLoading = true;
  try { S.audit = await api('/api/admin/audit'); } catch (x) { toast(x.message || 'Gagal memuat log', 'warn'); S.audit = S.audit || { items: [], sesi: [] }; } finally { S.auditLoading = false; }
  if (location.hash === '#/admin/keamanan') rerender();
}
function aSecurity() {
  if (!S.audit) { loadAudit(); return aTop('Keamanan', 'Memuat…'); }
  const it = S.audit.items; const day = it.filter((x) => Date.now() / 1000 - x.t < 86400);
  const fails = day.filter((x) => x.aksi === 'login_gagal').length, locks = day.filter((x) => x.aksi === 'login_dikunci').length, docs = day.filter((x) => x.aksi.startsWith('lihat_')).length;
  return aTop('Keamanan', 'Log aktivitas, sesi yang aktif, dan pengaturan akun', `<button type="button" class="btn sm ghost" data-act="pw">${ic('edit')} Ganti kata sandi</button><button type="button" class="btn sm danger" data-act="logout-all">${ic('logout')} Keluar dari semua perangkat</button>`) + `
    <div class="kpis"><div class="kpi"><small class="muted">Gagal masuk (24 jam)</small><b>${fails}</b></div><div class="kpi"><small class="muted">Akun dikunci (24 jam)</small><b>${locks}</b></div>
      <div class="kpi"><small class="muted">Akses data pribadi (24 jam)</small><b>${docs}</b></div><div class="kpi"><small class="muted">Sesi aktif</small><b>${S.audit.sesi.length}</b></div></div>
    <div class="card stack-s"><h3>Perlindungan yang aktif</h3><div class="sec-list">${[
      ['Kata sandi di-hash', 'Disimpan dengan PBKDF2/scrypt (werkzeug), tidak bisa dibaca siapa pun'], ['Batas percobaan masuk', '5 kali salah dalam 15 menit, akun dikunci sementara'],
      ['Sesi berbatas waktu', 'Admin 12 jam dan keluar otomatis setelah 30 menit tidak aktif; investor 7 hari'], ['Token sesi di-hash', 'Bila basis data bocor, token tidak bisa dipakai'],
      ['Data KYC terenkripsi', 'Biodata dan dokumen dienkripsi (Fernet/AES) dan disimpan di luar folder publik'], ['Admin khusus komputer', 'Login admin dari HP ditolak server'],
      ['Header keamanan', 'CSP, anti-clickjacking, nosniff, izin kamera/lokasi hanya untuk situs ini'], ['Log audit', 'Setiap aksi admin dan akses data pribadi tercatat']].map(([a_, b_]) => `<div class="row"><span class="kstep done">✓</span><span class="grow small"><b>${a_}</b><br><span class="muted">${b_}</span></span></div>`).join('')}</div></div>
    <div class="two"><div class="table-wrap"><table class="table"><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Keterangan</th><th>IP</th></tr>
      ${it.slice(0, 120).map((x) => `<tr><td class="small muted" style="white-space:nowrap">${new Date(x.t * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td class="small">${esc(x.nama || '—')}${x.role ? `<br><span class="xs muted">${esc(x.role)}</span>` : ''}</td>
        <td><span class="badge ${AUDIT_WARN.has(x.aksi) ? 'b-r' : 'b-t'}">${esc(AUDIT_LABEL[x.aksi] || x.aksi)}</span></td><td class="small">${esc([x.target, x.detail].filter(Boolean).join(' · ')).slice(0, 90)}</td><td class="mono xs">${esc(x.ip || '')}</td></tr>`).join('')}</table></div>
      <div class="card stack-s"><h3>Sesi aktif</h3>${S.audit.sesi.map((x) => `<div class="item"><span class="avatar-txt" style="width:36px;height:36px;font-size:12px">${esc(initials(x.nama))}</span><span class="grow"><b>${esc(x.nama)}</b><small>${esc(x.role)} · ${/Mobile|Android|iPhone/.test(x.ua || '') ? 'HP' : 'Komputer'} · aktif ${ago((x.last_seen || x.created_at) * 1000)}</small></span></div>`).join('')}</div></div>`;
}

// ---------- ganti kata sandi & keluar dari semua perangkat (semua peran) ----------
function pwSheet() {
  openSheet(`<h2>Ganti kata sandi</h2><p class="small muted">Setelah diganti, akun ini otomatis keluar dari perangkat lain.</p>
    <form id="pw-form" class="stack" novalidate><label class="field">Kata sandi lama<input name="lama" type="password" autocomplete="current-password" required></label>
      <label class="field">Kata sandi baru <span class="hint">min. 8 karakter, huruf dan angka</span><input name="baru" type="password" autocomplete="new-password" required data-pwmeter></label>
      <div class="pwm"><i></i><i></i><i></i><i></i></div><div id="pw-err" class="card coral small" hidden></div>
      <div class="row"><button type="button" class="btn ghost grow" data-close>Batal</button><button type="submit" class="btn grow">Simpan</button></div></form>`);
  const f = $('#pw-form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('#pw-err'); err.hidden = true;
    try { await api('/api/auth/sandi', { method: 'POST', body: { lama: f.lama.value, baru: f.baru.value } }); closeSheet(); toast('Kata sandi diganti. Perangkat lain sudah dikeluarkan.', 'ok'); }
    catch (x) { err.hidden = false; err.textContent = x.status ? x.message : 'Butuh internet untuk mengganti kata sandi.'; }
  });
  pwMeters();
}
function pwScore(v) { return [v.length >= 8, /[a-z]/i.test(v) && /\d/.test(v), v.length >= 12, /[^A-Za-z0-9]/.test(v) || /[A-Z]/.test(v) && /[a-z]/.test(v)].filter(Boolean).length; }
function pwMeters() {
  $$('[data-pwmeter]').forEach((inp) => { const m = inp.closest('form').querySelector('.pwm'); if (!m) return;
    inp.addEventListener('input', () => { const s = pwScore(inp.value); m.dataset.s = inp.value ? s : 0; m.title = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][s]; }); });
}
async function logoutAll() {
  if (!confirm('Keluar dari semua perangkat, termasuk perangkat ini?')) return;
  try { await api('/api/auth/logout-semua', { method: 'POST' }); } catch { /* tetap keluar di perangkat ini */ }
  S.auth = null; LS.set('auth', null); LS.set('kyc', null); S.kyc = null; toast('Semua sesi sudah ditutup.', 'ok'); location.hash = '#/';
}

// ---------- admin keluar otomatis bila tidak aktif 30 menit ----------
let lastAct = Date.now();
['pointerdown', 'keydown', 'scroll'].forEach((ev) => addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
setInterval(() => {
  if (isRole('admin') && Date.now() - lastAct > 30 * 60 * 1000) {
    S.auth = null; LS.set('auth', null); toast('Demi keamanan, sesi admin ditutup karena 30 menit tidak aktif.', 'warn', 6000); location.hash = '#/masuk/admin';
  }
}, 60 * 1000);

// =====================================================================
// Router & render
// =====================================================================
const ROUTES = [
  [/^#\/?$/, vStart], [/^#\/masuk\/(\w+)(?:\?.*)?$/, vLogin], [/^#\/daftar(?:\?.*)?$/, vRegister], [/^#\/lupa\/(\w+)$/, vLupa], [/^#\/pendata$/, pHome], [/^#\/pendata\/baru$/, () => pForm(null)], [/^#\/pendata\/ubah\/(.+)$/, pForm], [/^#\/pendata\/data(\?.*)?$/, pRiwayat],
  [/^#\/pendata\/data\/([^?]+)$/, pDetail], [/^#\/pendata\/notif$/, pNotif], [/^#\/pendata\/profil$/, pProfil],
  [/^#\/investor$/, iMap], [/^#\/investor\/daftar$/, iList], [/^#\/investor\/p\/(.+)$/, iDetail], [/^#\/investor\/minat\/(.+)$/, iMinat], [/^#\/investor\/terkirim\/(.+)$/, iSent], [/^#\/investor\/disimpan$/, iSaved], [/^#\/investor\/verifikasi$/, iVerif],
  [/^#\/admin$/, aHome], [/^#\/admin\/antrean$/, aQueue], [/^#\/admin\/v\/(.+)$/, aVerify], [/^#\/admin\/peta$/, aMap], [/^#\/admin\/kesiapan$/, aLevels], [/^#\/admin\/ekstraksi$/, aExtract], [/^#\/admin\/minat$/, aMinat], [/^#\/admin\/investor$/, aKyc], [/^#\/admin\/investor\/(\d+)$/, aKycDetail], [/^#\/admin\/keamanan$/, aSecurity],
];
const LIVE = /^#\/(pendata(\/data.*|\/notif)?|investor(\/daftar|\/disimpan|\/p\/.+|\/terkirim\/.+)?|admin.*)$/;
let lastRoute = null;
function setDesk() { const on = IS_WEB() && innerWidth >= 900; document.body.classList.toggle('desk', on); return on; }
let lastDesk = null;
window.addEventListener('resize', () => { const on = setDesk(); if (lastDesk !== null && on !== lastDesk) { lastDesk = on; render(); } lastDesk = on; });
function render() {
  lastDesk = setDesk();
  const route = decodeURI(location.hash || '#/');
  if (route.startsWith('#/pendata/ubah') || route === '#/pendata/baru') { /* draf dipertahankan */ } else if (D && !route.startsWith('#/pendata/baru')) { if (geoWatch != null) { navigator.geolocation.clearWatch(geoWatch); geoWatch = null; } }
  if (IS_MOBILE && (route.startsWith('#/admin') || route.startsWith('#/masuk/admin'))) {
    if (isRole('admin')) { S.auth = null; LS.set('auth', null); }
    chrome('#/'); if (MAP) { MAP.inst.destroy(); MAP = null; }
    $('#app').innerHTML = vAdminPC(); document.body.classList.remove('has-action'); window.scrollTo(0, 0); lastRoute = route; return;
  }
  if (IS_WEB() && (route.startsWith('#/pendata') || route.startsWith('#/masuk/pendata'))) {
    if (isRole('pendata')) { S.auth = null; LS.set('auth', null); }
    chrome('#/'); if (MAP) { MAP.inst.destroy(); MAP = null; }
    $('#app').innerHTML = vPendataApp(); document.body.classList.remove('has-action'); window.scrollTo(0, 0); lastRoute = route; return;
  }
  const needRole = route.startsWith('#/pendata') ? 'pendata' : route.startsWith('#/admin') ? 'admin' : (route.startsWith('#/investor/minat/') || route === '#/investor/verifikasi') ? 'investor' : null;
  if (route.startsWith('#/investor/minat/') && isRole('investor') && !kycOK()) { toast('Verifikasi data diri dulu sebelum mengajukan minat.', 'warn'); location.replace('#/investor/verifikasi'); return; }
  if (needRole && !isRole(needRole)) { location.replace(loginHref(needRole, route)); return; }
  chrome(route);
  const hit = ROUTES.find(([re]) => re.test(route)) || ROUTES[0];
  const args = (route.match(hit[0]) || []).slice(1).map((x) => x && decodeURIComponent(x));
  let html = hit[1](...args);
  if (route.startsWith('#/admin')) html = adminShell(route, html);
  if (MAP) MAP.inst.el.remove();
  $('#app').innerHTML = html;
  attachMap();
  document.body.classList.toggle('has-action', !!$('#app .actionbar'));
  const changed = route !== lastRoute;
  if (changed) { window.scrollTo(0, 0); $('#app').focus({ preventScroll: true }); lastRoute = route; }
  mount(route);
  window.KMotion?.afterRender(changed);
}
const rerender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
function rerenderLive(force) {
  const r = location.hash || '#/';
  if (force || LIVE.test(r)) { const active = document.activeElement; if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) && !force) return updateChrome(); rerender(); } else updateChrome();
  if (!$('#cenra').hidden && S.ctab === 'faq') renderCenra();
}
function mount(route) {
  const lf = $('#login-form');
  if (lf) lf.addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('#auth-err'); err.hidden = true;
    if (!S.online && !LOCAL) { err.hidden = false; err.textContent = 'Masuk pertama kali butuh internet. Setelah itu aplikasi bisa dipakai offline.'; return; }
    const btn = lf.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Memeriksa…';
    try {
      const role = lf.dataset.role; const res = await api('/api/auth/login', { method: 'POST', body: { email: lf.email.value, password: lf.password.value, role }, noAuth: true });
      if (res.need_otp || res.setup_otp) return showOtp(res, role, lf.closest('.card'));
      await afterAuth(res, '#/' + role);
    }
    catch (x) { err.hidden = false; err.textContent = x.status ? x.message : 'Tidak bisa terhubung ke server. Coba lagi.'; btn.disabled = false; btn.textContent = 'Masuk'; }
  });
  const lpf = $('#lupa-form');
  if (lpf) { lpf.addEventListener('submit', (e) => { e.preventDefault(); lupaSubmit(lpf); }); if (lpf.querySelector('.otp')) wireOtp(lpf); }
  const rf = $('#reg-form');
  if (rf) rf.addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('#auth-err'); err.hidden = true;
    if (!rf.setuju.checked) { err.hidden = false; err.textContent = 'Centang persetujuan dulu.'; return; }
    const btn = rf.querySelector('button[type=submit]'); btn.disabled = true;
    try { const res = await api('/api/auth/register', { method: 'POST', noAuth: true, body: Object.fromEntries(['nama', 'perusahaan', 'email', 'telepon', 'password'].map((k) => [k, rf[k].value])) }); LS.set('next', null); await afterAuth(res, '#/investor/verifikasi', true); }
    catch (x) { err.hidden = false; err.textContent = x.status ? x.message : 'Tidak bisa terhubung ke server. Pendaftaran butuh internet.'; btn.disabled = false; }
  });
  pwMeters();
  $$('[data-kf]').forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { S.kf.data[el.dataset.kf] = el.value; if (['idNomor', 'tglLahir'].includes(el.dataset.kf)) { const d = S.kf.data; const h = $('#nik-hint'); if (h && d.idJenis === 'KTP') { const ok = d.idNomor.replace(/\D/g, '').length === 16; const p = ok ? nikProblem(d.idNomor, d.tglLahir) : null; h.innerHTML = p ? `<div class="card coral small">${p}. Periksa lagi NIK atau tanggal lahir.</div>` : ok && d.tglLahir ? `<div class="cenra-tip"><span class="avatar"><img src="${CENRA_IMG.senang}" alt=""></span><div><b>Cenra</b><p>NIK cocok dengan tanggal lahir.</p></div></div>` : ''; } } }));
  $$('[data-kdoc]').forEach((el) => el.addEventListener('change', (e) => { kycAddDoc(el.dataset.kdoc, e.target.files[0]); }));
  $$('[data-kchk]').forEach((el) => el.addEventListener('change', () => { S.kf[el.dataset.kchk] = el.checked; }));
  const pi = $('#photo-in'); if (pi) pi.onchange = (e) => { addPhoto(e.target.files[0]); e.target.value = ''; };
  $$('[data-f]').forEach((el) => {
    const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(ev, () => {
      const k = el.dataset.f; let v = el.type === 'checkbox' ? el.checked : el.value;
      if (k === 'luas' || k === 'nilai') v = num(v);
      D.data[k] = v; persistDraft();
      if (k === 'nilai' && $('#nilai-fmt')) $('#nilai-fmt').textContent = v ? rp(v) : 'Boleh dikosongkan kalau belum tahu';
      if (k === 'setuju') rerender();
    });
  });
  const story = $('#story'); if (story) story.addEventListener('input', () => { D.story = story.value; persistDraft(); });
  $$('[data-set]').forEach((el) => el.addEventListener('change', () => { S.settings[el.dataset.set] = el.type === 'checkbox' ? el.checked : el.value.trim() || S.settings[el.dataset.set]; LS.set('settings', S.settings); toast('Pengaturan disimpan', 'ok', 1600); if (el.dataset.set !== 'suara') rerender(); }));
  const fq = $('[data-act="fq"]'); if (fq) fq.addEventListener('input', () => { S.f.q = fq.value; clearTimeout(fq._t); fq._t = setTimeout(() => { const pos = fq.selectionStart; rerender(); const n = $('[data-act="fq"]'); n.focus(); n.setSelectionRange(pos, pos); }, 250); });
  const mf = $('#minat-form');
  if (mf) {
    const save = () => LS.set('minatForm', { ...LS.get('minatForm', {}), ...Object.fromEntries(['nama', 'perusahaan', 'kontak', 'pesan'].map((k) => [k, mf.elements[k].value])) });
    mf.addEventListener('input', save);
    mf.addEventListener('submit', async (e) => {
      e.preventDefault(); save();
      const v = LS.get('minatForm', {});
      if (!v.nama?.trim() || !v.kontak?.trim()) return toast(t('Nama dan kontak wajib diisi.', 'Name and contact are required.'), 'warn');
      if (!mf.elements.setuju.checked) return toast(t('Centang persetujuan dulu.', 'Please tick the consent box.'), 'warn');
      const id = uid(); const pid = route.split('/').pop();
      const payload = { id, potensiId: pid, nama: v.nama.trim(), perusahaan: v.perusahaan?.trim(), kontak: v.kontak.trim(), nilai: v.nilai || '', pesan: v.pesan?.trim() };
      S.myMinat.unshift({ id, potensiId: pid, nama: payload.nama, kode: null, t: Date.now() }); LS.set('myMinat', S.myMinat);
      await idb.put('outbox', { id, kind: 'minat', payload, t: Date.now() }); await loadLocal();
      LS.set('minatForm', { ...v, pesan: '' });
      location.hash = '#/investor/terkirim/' + id;
      if (S.online) sync();
    });
  }
  const drop = $('#drop'), din = $('#doc-in');
  if (drop && din) {
    din.onchange = () => readDoc(din.files[0]);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); readDoc(e.dataTransfer.files[0]); });
  }
  const ms = $('[data-act="mstatus"]');
  if (ms) ms.addEventListener('change', async () => {
    const m = S.minat.find((x) => x.id === ms.dataset.id); if (!m) return;
    m.status = ms.value; await idb.put('cache', { id: 'minat', items: S.minat });
    await adminAction(`/api/minat/${encodeURIComponent(m.id)}/status`, { status: ms.value }); toast('Status diperbarui', 'ok'); rerender();
  });
  const vn = $('#vnote'); if (vn) vn.addEventListener('input', () => { verifyPhotos[route.split('/').pop() + ':note'] = vn.value; });
}
async function readDoc(file) {
  if (!file) return;
  if (file.size > 15e6) return toast('Berkas terlalu besar (maks. 15 MB).', 'warn');
  let text = '';
  try {
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') text = await pdfText(await file.arrayBuffer());
    else text = await file.text();
  } catch { text = ''; }
  runExtract(file.name, text);
}

// =====================================================================
// Aksi (satu penangan klik untuk seluruh aplikasi)
// =====================================================================
document.addEventListener('click', async (e) => {
  const sc = e.target.closest('[data-scroll]');
  if (sc) { e.preventDefault(); document.getElementById(sc.dataset.scroll)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const el = e.target.closest('[data-go],[data-act],[data-open-cenra],[data-ask],[data-close],[data-ctab],[data-fb]');
  if (!el) return;
  if (el.dataset.close !== undefined) { if (el.closest('#cenra')) closeCenra(); else { closeSheet(); rerender(); } return; }
  if (el.dataset.ctab) { S.ctab = el.dataset.ctab; renderCenra(); return; }
  if (el.dataset.fb !== undefined) { el.parentElement.innerHTML = el.dataset.fb === '1' ? 'Terima kasih! Cenra senang bisa membantu.' : 'Terima kasih masukannya. Coba tanyakan lewat tab Chat.'; return; }
  if (el.dataset.openCenra) { e.preventDefault(); openCenra(el.dataset.openCenra, { ctx: el.dataset.ctx ?? null, ask: el.dataset.ask || undefined }); return; }
  if (el.dataset.ask && el.closest('#cenra')) { askCenra(el.dataset.ask); return; }
  if (el.dataset.go) { e.preventDefault(); if (el.closest('#cenra')) closeCenra(); if (el.closest('#sheet')) closeSheet(); location.hash = el.dataset.go; return; }
  const a = el.dataset.act; const v = el.dataset.v; const id = el.dataset.id;
  switch (a) {
    // ----- pendata -----
    case 'logout': e.preventDefault(); logout(); break;
    case 'app-server': e.preventDefault(); window.KhenambayNative?.openSettings(); break;
    // ----- verifikasi investor -----
    case 'kjenis': { const f = kycDraft(); f.data.jenis = v; f.data.idJenis = v === 'asing' ? 'Paspor' : f.data.idJenis === 'Paspor' && v !== 'badan' ? 'KTP' : f.data.idJenis || 'KTP'; if (f.data.idJenis === 'KTP') f.data.kewarganegaraan = 'Indonesia'; else if (f.data.kewarganegaraan === 'Indonesia') f.data.kewarganegaraan = ''; rerender(); break; }
    case 'kidj': S.kf.data.idJenis = v; S.kf.data.kewarganegaraan = v === 'KTP' ? 'Indonesia' : S.kf.data.kewarganegaraan === 'Indonesia' ? '' : S.kf.data.kewarganegaraan; rerender(); break;
    case 'ksek': { const a2 = S.kf.data.sektor; S.kf.data.sektor = a2.includes(v) ? a2.filter((x) => x !== v) : [...a2, v]; rerender(); break; }
    case 'knil': S.kf.data.nilai = v; rerender(); break;
    case 'kstep': { const f = S.kf; const d2 = +el.dataset.d; const steps = kycSteps(f.data);
      if (d2 > 0) { const p2 = kycValid(steps[f.step]); if (p2) { const er = $('#kyc-err'); er.hidden = false; er.textContent = p2; er.scrollIntoView({ block: 'center', behavior: 'smooth' }); break; } }
      f.step = clamp(f.step + d2, 0, kycSteps(f.data).length - 1); render(); break; }
    case 'ksend': kycSend(el); break;
    case 'kedit': S.kfEdit = true; rerender(); break;
    case 'akycf': S.akycF = v; rerender(); break;
    case 'akyc-reload': S.akyc = null; loadAkyc(true); rerender(); break;
    case 'akyc-full': loadAkycDetail(id, !S.akycD?.full); break;
    case 'akyc-r': { const ta = $('#akyc-alasan'); ta.value = (ta.value ? ta.value.trim() + '. ' : '') + v; ta.focus(); break; }
    case 'akyc-tolak': akycDecide(id, 'tolak'); break;
    case 'akyc-ok': akycDecide(id, 'setujui'); break;
    case 'pw': e.preventDefault(); pwSheet(); break;
    case 'logout-all': e.preventDefault(); logoutAll(); break;
    case 'mview': {
      if (!MAPVIEWS.includes(v)) break;
      if (isReal(v) && S.online === false) { toast('Peta satelit dan jalan butuh internet. Saat offline pakai 3D atau 2D.', 'warn'); break; }
      S.realFail = false; LS.set('mapView', v); rerender(); break;
    }
    case 'm3': {
      if (!MAP) break;
      if (v === 'reset') MAP.inst.reset(); else if (v === 'in') MAP.inst.zoom(0.78); else if (v === 'out') MAP.inst.zoom(1.28);
      else if (v === 'locate') MAP.inst.locate?.();
      else if (v === 'full') { S.mapFull = !S.mapFull; $('#map3d').classList.toggle('full', S.mapFull); document.body.style.overflow = S.mapFull ? 'hidden' : ''; setTimeout(() => MAP && MAP.inst.resize(), 60); }
      break;
    }
    case 'copy-key': copyText(v).then((ok) => toast(ok ? 'Kunci disalin' : 'Salin manual kunci di atas', ok ? 'ok' : 'warn')); break;
    case 'lupa-ulang': if (S.lupa) { S.lupa.step = 1; rerender(); } break;
    case 'reviewed': S.reviewed.push(id); LS.set('reviewed', S.reviewed); toast('Terima kasih, data ditandai masih sesuai', 'ok'); rerender(); break;
    case 'step': { const d2 = +el.dataset.d; if (d2 > 0) { const err = stepValid(D.step); if (err) return toast(err, 'warn'); } if (recog) { recog.stop(); recog = null; } D.step = clamp(D.step + d2, 1, 4); persistDraft(); render(); break; }
    case 'draft-reset': if (confirm('Hapus isian dan mulai dari awal?')) { LS.set('draft', null); D = null; render(); } break;
    case 'gps': startGPS(false); break;
    case 'gps-demo': startGPS(true); break;
    case 'sektor': D.data.sektor = v; persistDraft(); rerender(); break;
    case 'infra': { const s = new Set(D.data.infra); s.has(v) ? s.delete(v) : s.add(v); D.data.infra = [...s]; persistDraft(); el.setAttribute('aria-pressed', String(s.has(v))); break; }
    case 'lahan': D.data.lahan = v; persistDraft(); rerender(); break;
    case 'musy': D.data.musyawarah = v; persistDraft(); rerender(); break;
    case 'lang': D.lang = v; rerender(); break;
    case 'rmphoto': { const i = +el.dataset.i; D.photos.splice(i, 1); if (D.data.fotoMeta) D.data.fotoMeta.splice(i, 1); D.data.lokasiFoto = D.data.fotoMeta?.at(-1)?.alamat || ''; persistDraft(); rerender(); break; }
    case 'mic': {
      if (recog) { recog.stop(); recog = null; return; }
      const base = $('#story').value ? $('#story').value.trim() + ' ' : '';
      $('#wave').hidden = false;
      recog = listen((txt, done) => { const st = $('#story'); if (st) { st.value = base + txt; D.story = st.value; } if (done) { recog = null; const w = $('#wave'); if (w) w.hidden = true; persistDraft(); if (txt.trim()) $('[data-act="parse"]')?.click(); } }, el);
      if (!recog) $('#wave').hidden = true;
      break;
    }
    case 'parse': {
      const txt = ($('#story')?.value || '').trim();
      if (!txt) return toast('Ceritakan dulu potensinya (ketik atau rekam suara).', 'warn');
      D.story = txt; const msg = $('#parse-msg'); msg.innerHTML = `<div class="row" style="justify-content:center"><img src="${CENRA_IMG.berpikir}" alt="" style="width:44px"><span class="typing"><i></i><i></i><i></i></span><span class="small muted">Cenra membaca ceritanya…</span></div>`;
      await sleep(900);
      const { out, found } = parseStory(txt);
      Object.entries(out).forEach(([k, val]) => { if (k === 'infra') D.data.infra = [...new Set([...(D.data.infra || []), ...val])]; else if (val != null && val !== '') D.data[k] = val; });
      if (!D.data.catatan) D.data.catatan = txt.slice(0, 280);
      persistDraft(); rerender();
      $('#parse-msg').innerHTML = found.length ? `<div class="card soft small" style="text-align:left"><b style="color:var(--green)">✓ Cenra mengisi ${found.length} isian:</b> ${found.join(', ')}. Periksa lagi sebelum lanjut, ya.</div>`
        : '<div class="card amber small">Cenra belum menemukan isian. Coba sebut komoditas, luas (hektar), dan kondisi jalan atau listrik.</div>';
      break;
    }
    case 'submit': submitForm(); break;
    case 'conflict-mine': { const m = await idb.get('mine', id); await idb.put('outbox', { id, kind: 'potensi', data: m.data, photos: m.photos, force: true, t: Date.now() }); m.state = 'antre'; m.conflict = null; await idb.put('mine', m); await loadLocal(); sync(true); rerender(); break; }
    case 'conflict-server': { const m = await idb.get('mine', id); if (m.conflict) { m.data = m.conflict.data; m.version = m.conflict.version; m.server = { status: m.conflict.status, level: m.conflict.level, catatan: m.conflict.catatan }; } m.state = 'terkirim'; m.conflict = null; await idb.put('mine', m); await loadLocal(); rerender(); break; }
    case 'sync-now': sync(true); break;
    case 'reset-demo':
      if (!confirm('Kembalikan semua data ke data contoh? Data di perangkat ini juga dihapus.')) return;
      if (!S.online) return toast('Reset butuh koneksi ke server.', 'warn');
      await api('/api/reset', { method: 'POST' }); await Promise.all(['mine', 'outbox'].map((s) => idb.clear(s)));
      ['draft', 'reviewed', 'notifs', 'saved', 'myMinat', 'notifSeen'].forEach((k) => LS.set(k, null)); S.saved = []; S.myMinat = []; S.reviewed = []; D = null; verifyPhotos = {};
      await refresh(); await loadLocal(); toast('Data demo dikembalikan', 'ok'); rerender(); break;
    // ----- investor -----
    case 'ilang': S.lang = v; LS.set('lang', v); rerender(); break;
    case 'fsek': S.f.sektor = v; if (el.closest('#sheet')) { $$('#sheet [data-act="fsek"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('#sheet [data-close].btn').textContent = `${t('Tampilkan', 'Show')} ${filtered().length} ${t('peluang', 'opportunities')}`; } else rerender(); break;
    case 'save': { if (!isRole('investor')) { toast('Masuk sebagai investor untuk menyimpan peluang', 'warn'); location.hash = loginHref('investor'); return; } const i = S.saved.indexOf(id); i >= 0 ? S.saved.splice(i, 1) : S.saved.push(id); LS.set('saved', S.saved); toast(i >= 0 ? t('Dihapus dari disimpan', 'Removed from saved') : t('Disimpan, bisa dibuka offline', 'Saved, available offline'), 'ok', 1800); rerender(); break; }
    case 'filter': filterSheet(); break;
    case 'freset': S.f = { sektor: 'Semua', q: '', maxNilai: null, minLevel: 1, lahan: [] }; if (!$('#sheet').hidden) filterSheet(); else rerender(); break;
    case 'fnilai': S.f.maxNilai = +v || null; filterSheet(); break;
    case 'flevel': S.f.minLevel = +v; filterSheet(); break;
    case 'flahan': { const s = new Set(S.f.lahan); s.has(v) ? s.delete(v) : s.add(v); S.f.lahan = [...s]; filterSheet(); break; }
    case 'mnilai': { const f = LS.get('minatForm', {}); f.nilai = f.nilai === v ? '' : v; LS.set('minatForm', f); $$('[data-act="mnilai"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === f.nilai))); break; }
    // ----- admin -----
    case 'aq': S.aq = v; rerender(); break;
    case 'csv': {
      const rows = [['id', 'nama', 'sektor', 'distrik', 'kampung', 'lat', 'lon', 'luas', 'satuan', 'lahan', 'nilai', 'status', 'level', 'pendata', 'cek_ai']]
        .concat(S.potensi.map((p) => [p.id, p.data.nama, p.data.sektor, p.data.distrik, p.data.kampung, p.data.lat, p.data.lon, p.data.luas, p.data.satuan, p.data.lahan, p.data.nilai, p.status, p.level, p.data.pendata, aiChecks(p).filter((c) => !c.ok).map((c) => c.t).join('; ')]));
      const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      Object.assign(document.createElement('a'), { href: url, download: `khenambay-potensi-${new Date().toISOString().slice(0, 10)}.csv` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 2000); toast('Berkas CSV diunduh', 'ok'); break;
    }
    case 'vlv': verifyPhotos[id + ':lv'] = +v; rerender(); break;
    case 'vnote': { const p = byId(id); const bad = aiChecks(p).filter((c) => !c.ok); const txt = `Mohon diperiksa: ${bad.map((b) => b.t.toLowerCase() + ' (' + b.d + ')').join('; ')}.${bad.some((b) => b.key === 'sea') ? ' Kunci ulang GPS di lokasi daratan.' : ''}`; $('#vnote').value = txt; verifyPhotos[id + ':note'] = txt; break; }
    case 'vback': case 'vok': {
      const p = byId(id); const note = $('#vnote').value.trim(); const lv = verifyPhotos[id + ':lv'] ?? (p.status === 'Terbit' ? p.level : Math.max(suggestLevel(p), 2));
      if (a === 'vback' && !note) return toast('Tulis catatan untuk pendata dulu (atau klik "Tulis dengan Cenra").', 'warn');
      const aksi = a === 'vok' ? 'terbit' : 'kembalikan';
      const ok = await adminAction(`/api/potensi/${encodeURIComponent(id)}/verifikasi`, { aksi, catatan: note, level: lv }, () => { p.status = aksi === 'terbit' ? 'Terbit' : 'Perlu perbaikan'; p.catatan = note || null; p.level = lv; p.updatedAt = Date.now() / 1000; });
      if (ok) { toast(aksi === 'terbit' ? `Diterbitkan · Level ${lv}. Kini tampil di peta investor dan Cenra.` : 'Dikembalikan ke pendata dengan catatan', 'ok'); delete verifyPhotos[id + ':note']; location.hash = '#/admin/antrean'; if (S.online) refresh().then(() => rerenderLive()); }
      break;
    }
    case 'amap': S.amapSel = v || null; rerender(); break;
    case 'tugas': toast(`Tugas pendataan dikirim ke petugas di ${v}. Mereka mendapat notifikasi di HP.`, 'ok', 4000); break;
    case 'lvl': case 'apply-sug': {
      const list = a === 'lvl' ? [[id, +v]] : pub().filter((p) => suggestLevel(p) > p.level).map((p) => [p.id, suggestLevel(p)]);
      for (const [pid, lv] of list) { const p = byId(pid); await adminAction(`/api/potensi/${encodeURIComponent(pid)}/level`, { level: lv }, () => { p.level = lv; }); }
      toast(a === 'lvl' ? `Level diubah ke ${v}` : `${list.length} data naik level sesuai saran Cenra`, 'ok'); rerender(); break;
    }
    case 'ex-sample': runExtract('Kajian_Kelayakan_Keramba_Nila_Asei.txt', CONTOH_DOK); break;
    case 'ex-reset': EX.stage = 'idle'; rerender(); break;
    case 'ex-save': {
      const pid = $('#ex-target').value; const p = byId(pid); const fields = {};
      EX.res.fields.forEach((f) => { if (['nilai', 'irr', 'payback', 'produksi'].includes(f.key)) fields[f.key] = f.value; if (f.key === 'lahan') fields.catatan = (p.data.catatan ? p.data.catatan + ' ' : '') + 'Status lahan menurut kajian: ' + f.value + '.'; });
      await adminAction(`/api/potensi/${encodeURIComponent(pid)}/ubah`, { fields }, () => Object.assign(p.data, fields));
      await adminAction(`/api/potensi/${encodeURIComponent(pid)}/level`, { level: +v }, () => { p.level = Math.max(p.level, +v); });
      toast(`${p.data.nama} diperbarui dan naik ke Level ${v}`, 'ok', 4000); EX.stage = 'idle'; location.hash = '#/admin/kesiapan'; break;
    }
    case 'msel': S.minatSel = id; rerender(); break;
    case 'copy-draft': try { await navigator.clipboard.writeText($('#draft-msg').textContent); toast('Draf pesan disalin', 'ok'); } catch { toast('Tidak bisa menyalin otomatis. Pilih teksnya lalu salin.', 'warn'); } break;
    default: break;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.mapFull) { S.mapFull = false; $('#map3d')?.classList.remove('full'); document.body.style.overflow = ''; setTimeout(() => MAP && MAP.inst.resize(), 60); return; }
  if (e.key === 'Escape') { if (!$('#cenra').hidden) closeCenra(); else if (!$('#sheet').hidden) { closeSheet(); rerender(); } }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr.click, g.pin')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
$('#cenra-fab').addEventListener('click', () => openCenra(S.ctab || 'faq', { ctx: location.hash.match(/#\/investor\/p\/(.+)/)?.[1] ?? null }));
$('#cenra-form').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#cenra-in'); const v = i.value; i.value = ''; askCenra(v); });
$('#cenra-mic').addEventListener('click', (e) => {
  const btn = e.currentTarget; if (btn._r) { btn._r.stop(); btn._r = null; return; }
  btn._r = listen((txt, done) => { $('#cenra-in').value = txt; if (done) { btn._r = null; if (txt.trim()) $('#cenra-form').requestSubmit(); } }, btn, S.role === 'investor' && S.lang === 'en' ? 'en-US' : 'id-ID');
});
$('#btn-sync').addEventListener('click', () => { checkOnline().then(() => sync(true)); });
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); if (IN_APP) return; deferredInstall = e; $('#btn-install').hidden = false; });
$('#btn-install').addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#btn-install').hidden = true; });
window.addEventListener('online', checkOnline);
window.addEventListener('offline', () => setOnline(false));
window.addEventListener('hashchange', render);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkOnline(); });

// =====================================================================
// Mulai
// =====================================================================
(async function start() {
  if (!LOCAL && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* tetap jalan tanpa service worker */ });
  }
  await loadLocal();
  if (!location.hash && LS.get('role', null)) location.replace('#/' + LS.get('role', null));
  render();
  await checkOnline();
  if ((S.online && !S.potensi.length) || LOCAL) { try { await refresh(); } catch { /* biarkan */ } }
  rerenderLive(true);
  setInterval(checkOnline, 20000);
})();
})();
