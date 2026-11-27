/* Khenambay · server lokal di dalam aplikasi Android.
   Dipakai hanya di aplikasi (index-app.html). Semua rute API PHP yang dibutuhkan pendata dan investor
   dijalankan di HP, dengan database IndexedDB, jadi aplikasi tidak perlu XAMPP, alamat IP, atau port.

   Keamanan dibuat sama dengan versi PHP:
   - kata sandi: PBKDF2-SHA256 (WebCrypto), tidak pernah disimpan polos
   - token sesi disimpan sebagai hash SHA-256, punya masa berlaku per peran
   - Google Authenticator (TOTP RFC 6238) untuk pendata, satu kode tidak bisa dipakai dua kali
   - data diri investor (KYC) dan berkasnya dienkripsi AES-256-GCM; kuncinya CryptoKey yang tidak bisa diekspor
   - kunci 15 menit setelah 5 kali salah kata sandi
   Admin DPMPTSP tetap hanya lewat website di komputer. */
(function () {
  'use strict';
  const JAM = 3600, HARI = 86400;
  const S_MENUNGGU = 'Menunggu verifikasi', S_TERBIT = 'Terbit';
  const SESSION_TTL = { investor: 7 * HARI, pendata: 30 * HARI };
  const LOGIN_MAX_FAIL = 5, LOGIN_WINDOW = 15 * 60, TICKET_TTL = 5 * 60, RESET_TTL = 15 * 60, CODE_MAX_TRY = 5, RESET_MAX_SEND = 3;
  const ADMIN_PC_ONLY = 'Akun admin hanya bisa dipakai dari komputer (website di PC atau laptop), bukan dari HP.';
  const COMMON_PW = ['password', '12345678', '123456789', 'qwerty123', 'password1', 'admin123', 'jayapura', 'indonesia', '11111111', 'abc12345'];
  const PBKDF2_ITER = 60000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const now = () => Date.now() / 1000;

  class HttpErr extends Error { constructor(msg, status = 400, code) { super(msg); this.status = status; this.code = code; } }
  const fail = (m, s = 400, c) => { throw new HttpErr(m, s, c); };

  // ---------------------------------------------------------------- penyimpanan
  let dbp = null;
  function idb() {
    return dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('khenambay-server', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('blob'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  }
  async function kvGet(store, k) { const d = await idb(); return new Promise((res, rej) => { const q = d.transaction(store).objectStore(store).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function kvPut(store, k, v) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(store, 'readwrite'); t.objectStore(store).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
  async function kvDel(store, k) { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(store, 'readwrite'); t.objectStore(store).delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }

  /** Seluruh tabel kecil disimpan sebagai satu dokumen; foto dan berkas KYC disimpan terpisah di 'blob'. */
  let DB = null, key = null, ready = null;
  const save = () => kvPut('kv', 'db', DB);

  // ---------------------------------------------------------------- kriptografi
  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const b64 = (buf) => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
  const hex = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s));

  async function pwHash(pw) {
    const salt = rnd(16);
    const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, k, 256);
    return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(bits)}`;
  }
  async function pwVerify(pw, stored) {
    const [alg, it, s, h] = String(stored || '').split('$');
    if (alg !== 'pbkdf2') return false;
    const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(s), iterations: +it }, k, 256));
    let diff = bits.length ^ h.length; for (let i = 0; i < Math.min(bits.length, h.length); i++) diff |= bits.charCodeAt(i) ^ h.charCodeAt(i);
    return diff === 0;
  }
  async function sealBytes(bytes) {
    const iv = rnd(12);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    const out = new Uint8Array(12 + ct.byteLength); out.set(iv); out.set(new Uint8Array(ct), 12); return out;
  }
  async function unsealBytes(buf) {
    const a = new Uint8Array(buf);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: a.subarray(0, 12) }, key, a.subarray(12)));
  }
  const seal = async (s) => 'KB1' + b64(await sealBytes(enc.encode(s)));
  const unseal = async (s) => (s && s.startsWith('KB1') ? dec.decode(await unsealBytes(unb64(s.slice(3)))) : null);

  // ---------------------------------------------------------------- TOTP (Google Authenticator)
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32enc(bytes) { let bits = '', out = ''; for (const b of bytes) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; }
  function b32dec(s) { let bits = ''; for (const c of s.toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0'); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return new Uint8Array(out); }
  async function totpAt(secret, step) {
    const k = await crypto.subtle.importKey('raw', b32dec(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const msg = new DataView(new ArrayBuffer(8)); msg.setUint32(0, Math.floor(step / 2 ** 32)); msg.setUint32(4, step >>> 0);
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg.buffer));
    const o = h[19] & 15;
    const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % 1e6).padStart(6, '0');
  }
  async function totpCheck(secret, code, last = 0) {
    code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return null;
    const st0 = Math.floor(now() / 30);
    for (const d of [0, -1, 1]) { const st = st0 + d; if (st <= last) continue; if (await totpAt(secret, st) === code) return st; }
    return null;
  }
  const totpUri = (secret, email) => { const iss = 'Khenambay DPMPTSP'; return `otpauth://totp/${encodeURIComponent(iss + ':' + email)}?secret=${secret}&issuer=${encodeURIComponent(iss)}&algorithm=SHA1&digits=6&period=30`; };

  // ---------------------------------------------------------------- data awal (sama dengan app/schema.php)
  const P = (nama, sektor, distrik, kampung, lat, lon, luas, satuan, lahan, infra, nilai, catatan, o = {}) => ({
    nama, sektor, distrik, kampung, lat, lon, akurasi: o.akurasi ?? 5, luas, satuan, produksi: o.produksi ?? '', lahan, adat: o.adat ?? '',
    musyawarah: o.musyawarah ?? '', infra, nilai, irr: o.irr ?? null, payback: o.payback ?? null, kontak: o.kontak ?? '', catatan,
    pendata: o.pendata ?? 'Markus Yoku', fotoContoh: o.foto ?? 2 });
  const SEED_POTENSI = () => [
    [S_TERBIT, 5, 6 * HARI, P('Cold Storage dan Pangkalan Perikanan Tangkap', 'Perikanan', 'Depapre', 'Pusat distrik', -2.503, 140.385, 50, 'ton', 'Aset pemda', ['Jalan aspal', 'Listrik PLN', 'Sinyal 4G', 'Dermaga'], 18e9, 'Fasilitas pendingin dan pendaratan ikan untuk nelayan Teluk Tanah Merah.', { irr: 14.2, payback: 6, kontak: 'Kantor Distrik Depapre', pendata: 'Selvi Wally' })],
    [S_TERBIT, 4, 16 * HARI, P('Keramba Jaring Apung Ikan Nila', 'Perikanan', 'Sentani Timur', 'Asei', -2.612, 140.585, 60, 'unit', 'Milik pribadi', ['Listrik PLN', 'Sinyal 4G'], 6.5e9, 'Budidaya nila di perairan Danau Sentani dengan pakan lokal.', { irr: 16.8, payback: 5, kontak: 'Kelompok pembudidaya ikan Asei', pendata: 'Yakob Tokoro', produksi: '120 ton/tahun' })],
    [S_TERBIT, 4, 20 * HARI, P('Kebun Kopi Arabika Rakyat', 'Perkebunan', 'Gresi Selatan', 'Bundru', -2.86, 140.24, 150, 'ha', 'Tanah adat', ['Jalan tanah', 'Sinyal SMS'], 4e9, 'Kebun kopi kemitraan beserta unit pascapanen.', { adat: 'Kepala suku Bundru', musyawarah: 'Sudah disepakati', irr: 12.5, payback: 7, kontak: 'Kantor Distrik Gresi Selatan', pendata: 'Rina Sawaki' })],
    [S_TERBIT, 3, 9 * HARI, P('Dermaga Wisata dan Homestay Danau Sentani', 'Pariwisata', 'Ebungfauw', 'Ebungfauw', -2.656, 140.44, 20, 'kamar', 'Tanah adat', ['Jalan aspal', 'Listrik PLN', 'Sinyal 4G', 'Air bersih'], 12e9, 'Penginapan berbasis kampung dan dermaga wisata danau.', { adat: 'Ondoafi Ebungfauw', musyawarah: 'Sudah disepakati', kontak: 'Pokdarwis Ebungfauw' })],
    [S_TERBIT, 3, 25 * HARI, P('Perkebunan dan Fermentasi Kakao', 'Perkebunan', 'Nimboran', 'Genyem', -2.64, 140.16, 300, 'ha', 'Tanah adat', ['Jalan aspal', 'Listrik PLN'], 9e9, 'Kemitraan kebun kakao rakyat dengan unit fermentasi biji.', { adat: 'Ondoafi Genyem', musyawarah: 'Sedang berjalan', kontak: 'Koperasi petani kakao', produksi: '120 ton/tahun' })],
    [S_TERBIT, 2, 30 * HARI, P('Sentra Padi dan Jagung', 'Pertanian', 'Unurum Guay', 'Pusat distrik', -2.92, 139.72, 500, 'ha', 'Aset pemda', ['Jalan tanah', 'Listrik PLN'], 22e9, 'Lahan pangan beserta penggilingan dan gudang.', { kontak: 'Kantor Distrik Unurum Guay' })],
    [S_TERBIT, 2, 33 * HARI, P('Ekowisata Pantai Tablanusu', 'Pariwisata', 'Depapre', 'Tablanusu', -2.445, 140.29, 12, 'unit', 'Tanah adat', ['Jalan aspal', 'Listrik PLN', 'Air bersih'], 6e9, 'Cottage dan fasilitas snorkeling dikelola bersama kampung.', { adat: 'Ondoafi Tablanusu', musyawarah: 'Sedang berjalan', kontak: 'Pokdarwis Tablanusu', pendata: 'Selvi Wally' })],
    [S_TERBIT, 2, 40 * HARI, P('Budidaya Ikan Air Tawar', 'Perikanan', 'Nimbokrang', 'Benyom', -2.70, 139.98, 40, 'kolam', 'Milik pribadi', ['Jalan aspal', 'Listrik PLN', 'Air bersih'], 3.2e9, 'Kolam lele dan nila untuk kebutuhan pangan lokal.', { kontak: 'Kelompok tani ikan', pendata: 'Yakob Tokoro' })],
    [S_TERBIT, 1, 45 * HARI, P('Sentra Sagu Waibu', 'Pertanian', 'Waibu', 'Doyo Lama', -2.60, 140.40, 80, 'ha', 'Tanah adat', ['Jalan aspal'], 2.5e9, 'Pengolahan pati sagu skala kampung.', { adat: 'Ondoafi Doyo', musyawarah: 'Belum dimulai', pendata: 'Rina Sawaki' })],
    [S_MENUNGGU, 1, 2 * JAM, P('Kebun Kakao Rakyat Genyem', 'Perkebunan', 'Nimboran', 'Genyem', -2.6412, 140.1615, 280, 'ha', 'Tanah adat', ['Jalan aspal'], null, 'Dikirim petugas lain (contoh data ganda).', { adat: 'Ondoafi Genyem', musyawarah: 'Sedang berjalan', pendata: 'Markus Yoku' })],
    [S_MENUNGGU, 1, 6 * HARI, P('Wisata Pantai Pasir Putih', 'Pariwisata', 'Depapre', 'Pesisir', -2.40, 140.33, 8, 'unit', 'Tanah adat', ['Jalan tanah'], 2.5e9, 'Contoh koordinat yang jatuh di laut.', { adat: 'Ondoafi kampung setempat', musyawarah: 'Belum dimulai', kontak: 'Kepala kampung', pendata: 'Selvi Wally' })],
    [S_MENUNGGU, 1, HARI, P('Madu Hutan Kemtuk', 'Pertanian', 'Kemtuk', 'Sabron', -2.62, 140.27, 9000, 'ha', 'Tanah adat', ['Jalan tanah'], 1.5e9, 'Contoh angka luas yang tidak wajar.', { adat: 'Ondoafi Sabron', pendata: 'Yakob Tokoro', foto: 0 })],
    [S_MENUNGGU, 1, HARI + 3 * JAM, P('Homestay Tepi Kali', 'Pariwisata', 'Nimboran', 'Imsar', -2.66, 140.13, 6, 'kamar', 'Milik pribadi', ['Jalan aspal', 'Listrik PLN'], 9e8, 'Penginapan sederhana dekat sungai.', { pendata: 'Markus Yoku', foto: 0 })],
  ];
  const SEED_USERS = [
    ['admin@jayapurakab.go.id', 'admin123', 'admin', 'Yohana Mebri', 'Verifikator DPMPTSP', '', ''],
    ['markus@jayapurakab.go.id', 'pendata123', 'pendata', 'Markus Yoku', 'Pendata lapangan', '', 'Nimboran'],
    ['selvi@jayapurakab.go.id', 'pendata123', 'pendata', 'Selvi Wally', 'Pendata lapangan', '', 'Depapre'],
    ['investor@demo.id', 'investor123', 'investor', 'Daniel Tanaka', 'PT Samudra Biru Nusantara · Jakarta', '0812-4800-1100', ''],
    ['kenji@demo.id', 'investor123', 'investor', 'Kenji Morita', 'Kyoto Fisheries Co. · Jepang', '+81 75 555 0142', ''],
    ['baru@demo.id', 'investor123', 'investor', 'Rahel Ohee', '', '0821-9900-3311', ''],
  ];
  const SEED_MINAT = [
    ['seed-01', 'Daniel Tanaka', 'PT Samudra Biru Nusantara · Jakarta', 'daniel@samudrabiru.co.id', 'Rp 10–20 M', 'Kami tertarik membangun cold storage 50 ton. Mohon info pasokan listrik dan jadwal kunjungan lokasi.', 'Baru', 3 * JAM],
    ['seed-02', 'Kenji Morita', 'Kyoto Fisheries Co. · Jepang', 'k.morita@kyotofish.jp', '> Rp 20 M', 'Interested in a joint venture for tilapia farming and export processing.', 'Baru', 20 * JAM],
    ['seed-04', 'Pieter de Vries', 'Green Cacao B.V. · Belanda', 'pieter@greencacao.nl', 'Rp 10–20 M', 'Kami mencari pemasok biji kakao fermentasi bersertifikat.', 'Pertemuan', 4 * HARI],
    ['seed-03', 'Maria Wenda', 'CV Kopi Lembah Grime · Jayapura', '0812-4800-1122', '< Rp 10 M', 'Ingin bermitra dengan petani kopi Gresi Selatan.', 'Dihubungi', 2 * HARI],
  ];
  const SEED_KYC = {
    'investor@demo.id': ['Terverifikasi', { jenis: 'badan', nama: 'Daniel Tanaka', idJenis: 'KTP', idNomor: '3171061507850004', tempatLahir: 'Jakarta', tglLahir: '1985-07-15', kewarganegaraan: 'Indonesia', alamat: 'Jl. Senopati No. 18, Kebayoran Baru, Jakarta Selatan', telepon: '0812-4800-1100', jabatan: 'Direktur Pengembangan Usaha', usahaNama: 'PT Samudra Biru Nusantara', usahaBentuk: 'PT', nib: '9120001234567', npwp: '0123456789012345', usahaAlamat: 'Gedung Samudra Lt. 5, Jakarta', situs: 'samudrabiru.co.id', sektor: ['Perikanan'], nilai: 'Rp 10–20 M', dana: 'Modal sendiri' }],
    'kenji@demo.id': ['Menunggu', { jenis: 'asing', nama: 'Kenji Morita', idJenis: 'Paspor', idNomor: 'TK8812045', tempatLahir: 'Kyoto', tglLahir: '1979-03-02', kewarganegaraan: 'Jepang', alamat: '2-14 Shimogyo-ku, Kyoto, Japan', telepon: '+81 75 555 0142', jabatan: 'Managing Director', usahaNama: 'Kyoto Fisheries Co., Ltd.', usahaBentuk: 'PMA', nib: '9120007654321', npwp: '', usahaAlamat: 'Kyoto, Jepang (rencana PT PMA di Jayapura)', situs: 'kyotofish.jp', sektor: ['Perikanan'], nilai: '> Rp 20 M', dana: 'Modal sendiri' }],
  };

  async function install() {
    const t = now();
    DB = { v: 1, seq: 0, users: [], sessions: [], fails: [], tickets: [], resets: [], potensi: [], minat: [], kyc: [], files: [], geo: {}, audit: [] };
    for (const [email, pw, role, nama, perusahaan, telepon, distrik] of SEED_USERS) {
      DB.users.push({ id: ++DB.seq, email, password: await pwHash(pw), role, nama, perusahaan, telepon, distrik, created_at: t, totp_secret: null, totp_on: 0, totp_last: 0 });
    }
    SEED_POTENSI().forEach(([status, level, age, data], i) => {
      DB.potensi.push({ id: 'seed-' + String(i + 1).padStart(2, '0'), data, version: 1, status, level, catatan: null, created_at: t - age, updated_at: t - age, updated_by: 'seed' });
    });
    const demo = DB.users.find((u) => u.email === 'investor@demo.id');
    SEED_MINAT.forEach(([pid, nama, perusahaan, kontak, nilai, pesan, status, age], k) => {
      const i = 138 + k;
      DB.minat.push({ id: 'minat-seed-' + i, kode: 'MIN-2026-' + String(i).padStart(4, '0'), potensi_id: pid, nama, perusahaan, kontak, nilai, pesan, status, created_at: t - age, user_id: nama === 'Daniel Tanaka' ? demo.id : null });
    });
    for (const [email, [status, data]] of Object.entries(SEED_KYC)) {
      const u = DB.users.find((x) => x.email === email);
      const ok = status === 'Terverifikasi';
      DB.kyc.push({ user_id: u.id, data: await seal(JSON.stringify(data)), status, alasan: null, id_hash: await idHash(data.idNomor), submitted_at: t - 2 * HARI, reviewed_at: ok ? t - HARI : null, reviewed_by: ok ? 'Yohana Mebri' : null });
      for (const jenis of ['identitas', 'selfie', ...(data.jenis === 'badan' ? ['nib', 'npwp'] : [])]) {
        try { const r = await fetch(`database/contoh/${jenis}-contoh.jpg`); if (r.ok) await saveKycFile(u.id, jenis, new Uint8Array(await r.arrayBuffer()), 'image/jpeg'); } catch { /* contoh berkas tidak wajib */ }
      }
    }
    await save();
  }

  async function init() {
    let k = await kvGet('kv', 'key');
    if (!k) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await kvPut('kv', 'key', k); }
    key = k;
    DB = await kvGet('kv', 'db');
    if (!DB || DB.v !== 1) await install();
  }
  const boot = () => ready || (ready = init());

  // ---------------------------------------------------------------- bantuan
  const str = (v, max = 2000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  const userPublic = (u) => ({ id: u.id, email: u.email, role: u.role, nama: u.nama, perusahaan: u.perusahaan, telepon: u.telepon, distrik: u.distrik });
  const idHash = (n) => sha256('khenambay|' + String(n || '').replace(/[^\p{L}\p{N}_]/gu, '').toUpperCase());
  function audit(aksi, target = '', detail = '', u = null) {
    DB.audit.unshift({ t: now(), user_id: u?.id ?? null, nama: u?.nama ?? null, role: u?.role ?? null, aksi, target: String(target).slice(0, 120), detail: String(detail).slice(0, 400), ip: 'aplikasi' });
    DB.audit.length = Math.min(DB.audit.length, 300);
  }
  function passwordProblem(pw, email = '') {
    if (pw.length < 8) return 'Kata sandi minimal 8 karakter';
    if (pw.length > 128) return 'Kata sandi terlalu panjang';
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Kata sandi harus berisi huruf dan angka';
    const low = pw.toLowerCase();
    if (COMMON_PW.includes(low) || (email && low === email.split('@')[0].toLowerCase())) return 'Kata sandi terlalu mudah ditebak. Pakai gabungan kata dan angka yang tidak umum';
    return null;
  }
  async function newSession(u) {
    const tok = b64u(rnd(32));
    DB.sessions.push({ token: await sha256(tok), user_id: u.id, created_at: now(), last_seen: now() });
    return tok;
  }
  async function currentUser(token) {
    if (!token) return null;
    const h = await sha256(token);
    const s = DB.sessions.find((x) => x.token === h); if (!s) return null;
    const u = DB.users.find((x) => x.id === s.user_id); if (!u) return null;
    if (now() - s.created_at > (SESSION_TTL[u.role] || HARI)) { DB.sessions = DB.sessions.filter((x) => x !== s); return null; }
    s.last_seen = now();
    return u;
  }
  async function need(token, ...roles) {
    const u = await currentUser(token);
    if (!u) fail('Silakan masuk dulu', 401);
    if (u.role === 'admin') fail(ADMIN_PC_ONLY, 403, 'admin_pc_only');
    if (roles.length && !roles.includes(u.role)) fail('Akun Anda tidak punya akses ke fitur ini', 403);
    return u;
  }
  function kycStatus(uid) {
    const r = DB.kyc.find((x) => x.user_id === uid);
    if (!r) return { status: 'Belum' };
    return { status: r.status, alasan: r.alasan, dikirim: r.submitted_at, ditinjau: r.reviewed_at };
  }
  async function finishLogin(u, how) {
    DB.fails = DB.fails.filter((f) => f.k !== 'e:' + u.email);
    const token = await newSession(u);
    audit('login', u.email, how + ' · aplikasi Android', u);
    return { token, user: userPublic(u), kyc: u.role === 'investor' ? kycStatus(u.id) : null };
  }
  function rate(k, max, win) {
    DB.fails = DB.fails.filter((f) => !(f.k === k && f.t < now() - win));
    if (DB.fails.filter((f) => f.k === k).length >= max) return false;
    DB.fails.push({ k, t: now() }); return true;
  }
  async function newTicket(uid, kind) {
    const t = b64u(rnd(24));
    DB.tickets = DB.tickets.filter((x) => now() - x.created_at <= TICKET_TTL);
    DB.tickets.push({ id: await sha256(t), user_id: uid, kind, created_at: now(), tries: 0 });
    return t;
  }
  async function takeTicket(ticket, kind) {
    const h = await sha256(str(ticket, 100));
    const r = DB.tickets.find((x) => x.id === h && x.kind === kind);
    if (!r || now() - r.created_at > TICKET_TTL) fail('Waktu verifikasi habis. Masukkan email dan kata sandi lagi.', 401, 'ticket_expired');
    if (r.tries >= CODE_MAX_TRY) { DB.tickets = DB.tickets.filter((x) => x !== r); fail('Terlalu banyak kode salah. Ulangi dari awal.', 429, 'ticket_locked'); }
    return r;
  }
  function ticketWrong(t) {
    t.tries++;
    const left = CODE_MAX_TRY - t.tries;
    fail('Kode salah' + (left > 0 ? `. Sisa ${left} percobaan.` : '. Ulangi dari awal.'), 401, 'otp_wrong');
  }
  const totpSecret = async (u) => (u.totp_secret ? await unseal(u.totp_secret) : null);

  // ---------------------------------------------------------------- potensi
  const PRIVATE_FIELDS = ['kontak', 'pendata', 'fotoContoh'], FINANCE_FIELDS = ['irr', 'payback'];
  async function potDict(r, withPhotos = false) {
    const photos = (await kvGet('blob', 'ph:' + r.id)) || [];
    const o = { id: r.id, data: { ...r.data }, version: r.version, status: r.status, level: r.level, catatan: r.catatan, createdAt: r.created_at, updatedAt: r.updated_at, updatedBy: r.updated_by, photoCount: photos.length };
    if (withPhotos) o.photos = photos;
    return o;
  }
  function visibleFor(item, u) {
    if (u && u.role === 'pendata') return item;
    if (item.status !== S_TERBIT) return null;
    const d = { ...item.data };
    PRIVATE_FIELDS.forEach((k) => delete d[k]);
    if (!u || item.level < 4) FINANCE_FIELDS.forEach((k) => delete d[k]);
    return { ...item, data: d, catatan: null, updatedBy: null };
  }

  // ---------------------------------------------------------------- KYC
  const KYC_JENIS = ['identitas', 'selfie', 'nib', 'npwp', 'akta'];
  function sniff(a) {
    if (a[0] === 0xff && a[1] === 0xd8 && a[2] === 0xff) return 'image/jpeg';
    if (a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4e && a[3] === 0x47) return 'image/png';
    if (a[0] === 0x25 && a[1] === 0x50 && a[2] === 0x44 && a[3] === 0x46) return 'application/pdf';
    if (dec.decode(a.subarray(0, 4)) === 'RIFF' && dec.decode(a.subarray(8, 12)) === 'WEBP') return 'image/webp';
    return null;
  }
  async function saveKycFile(uid, jenis, raw, mime) {
    const fid = hex(rnd(16));
    for (const old of DB.files.filter((f) => f.user_id === uid && f.jenis === jenis)) await kvDel('blob', 'kyc:' + old.id);
    DB.files = DB.files.filter((f) => !(f.user_id === uid && f.jenis === jenis));
    await kvPut('blob', 'kyc:' + fid, await sealBytes(raw));
    DB.files.push({ id: fid, user_id: uid, jenis, mime, size: raw.length, sha256: await sha256(raw), created_at: now() });
    return fid;
  }
  const KODE_PROV = ['11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '31', '32', '33', '34', '35', '36', '51', '52', '53', '61', '62', '63', '64', '65', '71', '72', '73', '74', '75', '76', '81', '82', '91', '92', '93', '94', '95', '96'];
  function validDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? m : null; }
  function nikCheck(nik, tgl) {
    if (!/^\d{16}$/.test(nik)) return 'NIK harus 16 angka';
    if (!KODE_PROV.includes(nik.slice(0, 2))) return 'Kode provinsi pada NIK tidak dikenal';
    let dd = +nik.slice(6, 8); const mm = +nik.slice(8, 10), yy = +nik.slice(10, 12);
    if (dd > 40) dd -= 40;
    const m = validDate(tgl); if (!m) return 'Tanggal lahir tidak valid';
    if (dd !== +m[3] || mm !== +m[2] || yy !== +m[1] % 100) return 'Tanggal lahir tidak cocok dengan NIK';
    return null;
  }
  function umur(tgl) { const m = validDate(tgl); if (!m) return null; const b = new Date(+m[1], +m[2] - 1, +m[3]); return Math.floor((Date.now() - b) / (365 * 864e5)); }
  function kycValidate(d) {
    for (const k of ['jenis', 'nama', 'idJenis', 'idNomor', 'tempatLahir', 'tglLahir', 'kewarganegaraan', 'alamat', 'telepon', 'nilai', 'dana']) if (!str(d[k]).trim()) return 'Lengkapi semua isian wajib';
    if (!['perorangan', 'asing', 'badan'].includes(d.jenis)) return 'Jenis investor tidak dikenal';
    const u = umur(d.tglLahir);
    if (u === null) return 'Tanggal lahir tidak valid';
    if (u < 17 || u > 100) return 'Umur penanggung jawab harus 17 tahun atau lebih';
    if (d.idJenis === 'KTP') { const p = nikCheck(str(d.idNomor).replace(/\D/g, ''), d.tglLahir); if (p) return p; }
    else if (d.idJenis === 'Paspor') { if (!/^[A-Za-z0-9]{6,9}$/.test(d.idNomor)) return 'Nomor paspor harus 6–9 huruf/angka'; }
    else return 'Jenis identitas harus KTP atau Paspor';
    if (!/^\+?[\d\s-]{8,18}$/.test(d.telepon)) return 'Nomor HP tidak valid';
    if (d.jenis === 'badan') for (const [k, l] of Object.entries({ usahaNama: 'nama badan usaha', usahaBentuk: 'bentuk badan usaha', nib: 'NIB', npwp: 'NPWP badan usaha', jabatan: 'jabatan' })) if (!str(d[k]).trim()) return 'Isi ' + l;
    if (d.nib && !/^\d{13}$/.test(str(d.nib).replace(/\D/g, ''))) return 'NIB harus 13 angka';
    if (d.npwp && !/^\d{15,16}$/.test(str(d.npwp).replace(/\D/g, ''))) return 'NPWP harus 15 atau 16 angka';
    return null;
  }
  const kycFiles = (uid) => DB.files.filter((f) => f.user_id === uid).map(({ id, jenis, mime, size, created_at }) => ({ id, jenis, mime, size, created_at }));

  // ---------------------------------------------------------------- rute
  const R = {};
  R['GET ping'] = () => { if (!navigator.onLine) fail('Tidak ada sinyal', 503); return { ok: true, time: now(), lokal: true }; };

  R['POST auth/login'] = async (b) => {
    const email = str(b.email, 160).trim().toLowerCase();
    const since = now() - LOGIN_WINDOW;
    DB.fails = DB.fails.filter((f) => f.t >= since);
    const mine = DB.fails.filter((f) => f.k === 'e:' + email);
    if (mine.length >= LOGIN_MAX_FAIL) {
      const wait = Math.max(1, Math.floor((mine[0].t + LOGIN_WINDOW - now()) / 60) + 1);
      fail(`Terlalu banyak percobaan masuk. Demi keamanan, coba lagi dalam ${wait} menit.`, 429, 'locked');
    }
    const u = DB.users.find((x) => x.email === email);
    if (!u || !(await pwVerify(str(b.password, 128), u.password))) {
      DB.fails.push({ k: 'e:' + email, t: now() });
      const left = LOGIN_MAX_FAIL - DB.fails.filter((f) => f.k === 'e:' + email).length;
      audit('login_gagal', email);
      let msg = 'Email atau kata sandi salah';
      if (left > 0 && left <= 2) msg += `. Sisa ${left} percobaan sebelum dikunci 15 menit.`;
      fail(msg, 401);
    }
    if (b.role && b.role !== u.role) {
      const label = { admin: 'admin DPMPTSP', pendata: 'pendata lapangan', investor: 'investor' }[u.role];
      fail(`Akun ini terdaftar sebagai ${label}. Masuk lewat pilihan peran yang sesuai.`, 403);
    }
    if (u.role === 'admin') fail(ADMIN_PC_ONLY, 403, 'admin_pc_only');
    DB.fails = DB.fails.filter((f) => f.k !== 'e:' + email);
    if (u.role === 'pendata') {
      const pub = { nama: u.nama, role: u.role, email: u.email };
      if (u.totp_on === 1) return { need_otp: true, ticket: await newTicket(u.id, 'otp'), user: pub };
      const secret = b32enc(rnd(20));
      u.totp_secret = await seal(secret); u.totp_on = 0;
      return { setup_otp: true, ticket: await newTicket(u.id, 'setup'), secret, uri: totpUri(secret, u.email), user: pub };
    }
    return finishLogin(u, 'kata sandi');
  };
  R['POST auth/otp'] = async (b) => {
    const t = await takeTicket(b.ticket, 'otp');
    const u = DB.users.find((x) => x.id === t.user_id);
    const sec = u ? await totpSecret(u) : null;
    if (!sec) fail('Google Authenticator belum aktif untuk akun ini');
    const st = await totpCheck(sec, b.kode, u.totp_last);
    if (st === null) { audit('otp_salah', u.email, '', u); ticketWrong(t); }
    u.totp_last = st;
    DB.tickets = DB.tickets.filter((x) => x !== t);
    return finishLogin(u, 'kata sandi + Google Authenticator');
  };
  R['POST auth/otp-setup'] = async (b) => {
    const t = await takeTicket(b.ticket, 'setup');
    const u = DB.users.find((x) => x.id === t.user_id);
    const sec = u ? await totpSecret(u) : null;
    if (!sec) fail('Ulangi dari awal');
    const st = await totpCheck(sec, b.kode);
    if (st === null) ticketWrong(t);
    u.totp_on = 1; u.totp_last = st;
    DB.tickets = DB.tickets.filter((x) => x !== t);
    audit('authenticator_aktif', u.email, '', u);
    return finishLogin(u, 'aktivasi Google Authenticator');
  };
  R['POST auth/register'] = async (b) => {
    const email = str(b.email).trim().toLowerCase(), nama = str(b.nama).trim(), pw = str(b.password);
    if (!nama || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Isi nama dan email yang benar');
    const p = passwordProblem(pw, email); if (p) fail(p);
    if (DB.users.some((x) => x.email === email)) fail('Email ini sudah terdaftar. Silakan masuk.', 409);
    const u = { id: ++DB.seq, email, password: await pwHash(pw), role: 'investor', nama: nama.slice(0, 120), perusahaan: str(b.perusahaan, 160), telepon: str(b.telepon, 40), distrik: '', created_at: now(), totp_secret: null, totp_on: 0, totp_last: 0 };
    DB.users.push(u);
    audit('daftar_investor', email, '', u);
    return { token: await newSession(u), user: userPublic(u), kyc: kycStatus(u.id) };
  };
  R['GET auth/me'] = async (b, q, tok) => { const u = await need(tok); return { user: userPublic(u), kyc: u.role === 'investor' ? kycStatus(u.id) : null }; };
  R['POST auth/logout'] = async (b, q, tok) => { if (tok) { const h = await sha256(tok); DB.sessions = DB.sessions.filter((s) => s.token !== h); } return { ok: true }; };
  R['POST auth/logout-semua'] = async (b, q, tok) => { const u = await need(tok); const n = DB.sessions.filter((s) => s.user_id === u.id).length; DB.sessions = DB.sessions.filter((s) => s.user_id !== u.id); audit('keluar_semua_perangkat', u.email, n + ' sesi', u); return { ok: true, sesi: n }; };
  R['POST auth/sandi'] = async (b, q, tok) => {
    const u = await need(tok);
    const lama = str(b.lama, 128), baru = str(b.baru);
    if (!(await pwVerify(lama, u.password))) { audit('ganti_sandi_gagal', u.email, '', u); fail('Kata sandi lama salah'); }
    const p = passwordProblem(baru, u.email); if (p) fail(p);
    if (baru === lama) fail('Kata sandi baru harus berbeda dari yang lama');
    u.password = await pwHash(baru);
    const h = await sha256(tok); DB.sessions = DB.sessions.filter((s) => s.user_id !== u.id || s.token === h);
    audit('ganti_sandi', u.email, '', u);
    return { ok: true };
  };
  R['POST auth/lupa'] = async (b) => {
    const email = str(b.email, 160).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Tulis email yang benar');
    if (!rate('r:' + email, RESET_MAX_SEND, RESET_TTL)) fail('Kode sudah dikirim beberapa kali. Tunggu 15 menit lalu coba lagi.', 429, 'reset_limit');
    const res = { ok: true, pesan: 'Bila email terdaftar sebagai investor, kode 6 angka sudah dikirim. Cek kotak masuk atau folder spam.' };
    const u = DB.users.find((x) => x.email === email && x.role === 'investor');
    if (u) {
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
      DB.resets.forEach((r) => { if (r.email === email) r.used = 1; });
      DB.resets.push({ id: ++DB.seq, email, code_hash: await pwHash(code), created_at: now(), tries: 0, used: 0 });
      audit('reset_diminta', email, 'mode demo aplikasi', u);
      // Aplikasi tanpa server email: kode ditampilkan di layar (mode demo), sama seperti website saat SMTP belum diatur.
      Object.assign(res, { demo: true, demo_kode: code, catatan: 'Mode demo aplikasi: belum tersambung ke server email, jadi kode ditampilkan di layar.' });
    }
    return res;
  };
  R['POST auth/reset'] = async (b) => {
    const email = str(b.email, 160).trim().toLowerCase(), baru = str(b.baru);
    const r = DB.resets.filter((x) => x.email === email && !x.used).pop();
    if (!r || now() - r.created_at > RESET_TTL) fail('Kode sudah kedaluwarsa. Minta kode baru.', 400, 'code_expired');
    if (r.tries >= CODE_MAX_TRY) fail('Terlalu banyak kode salah. Minta kode baru.', 429, 'code_locked');
    if (!(await pwVerify(str(b.kode).replace(/\D/g, ''), r.code_hash))) { r.tries++; fail(`Kode salah. Sisa ${Math.max(0, CODE_MAX_TRY - r.tries)} percobaan.`, 400, 'code_wrong'); }
    const u = DB.users.find((x) => x.email === email && x.role === 'investor');
    if (!u) fail('Akun tidak ditemukan', 404);
    const p = passwordProblem(baru, email); if (p) fail(p);
    u.password = await pwHash(baru);
    DB.resets.forEach((x) => { if (x.email === email) x.used = 1; });
    DB.sessions = DB.sessions.filter((s) => s.user_id !== u.id);
    audit('reset_sandi', email, 'lewat kode email', u);
    return { ok: true };
  };
  R['POST auth/reset-otp'] = async (b) => {
    const email = str(b.email, 160).trim().toLowerCase();
    if (!rate('rt:' + email, CODE_MAX_TRY, RESET_TTL)) fail('Terlalu banyak percobaan. Tunggu 15 menit.', 429, 'reset_limit');
    const u = DB.users.find((x) => x.email === email && x.role === 'pendata');
    const sec = u ? await totpSecret(u) : null;
    if (!u || u.totp_on !== 1 || !sec) fail('Akun belum mengaktifkan Google Authenticator. Hubungi admin DPMPTSP untuk reset kata sandi.', 400, 'no_totp');
    const st = await totpCheck(sec, b.kode, u.totp_last);
    if (st === null) fail('Kode Google Authenticator salah', 400, 'otp_wrong');
    const p = passwordProblem(str(b.baru), email); if (p) fail(p);
    u.password = await pwHash(str(b.baru)); u.totp_last = st;
    DB.sessions = DB.sessions.filter((s) => s.user_id !== u.id);
    audit('reset_sandi', email, 'lewat Google Authenticator', u);
    return { ok: true };
  };

  R['POST sync'] = async (b, q, tok) => {
    const u = await need(tok, 'pendata');
    const results = [];
    for (const it of b.items || []) {
      const pid = str(it.id, 64), data = it.data;
      const photos = (it.photos || []).slice(0, 3);
      if (!pid || !data || typeof data !== 'object' || !str(data.nama).trim()) { results.push({ id: pid, error: 'Data tidak lengkap' }); continue; }
      const r = DB.potensi.find((x) => x.id === pid), t = now();
      if (!r) {
        data.pendata = u.nama;
        DB.potensi.push({ id: pid, data, version: 1, status: S_MENUNGGU, level: 1, catatan: null, created_at: t, updated_at: t, updated_by: 'pendata' });
        await kvPut('blob', 'ph:' + pid, photos);
        results.push({ id: pid, ok: true, version: 1, status: S_MENUNGGU });
      } else if (it.force || r.version === +(it.baseVersion ?? -1)) {
        Object.assign(r, { data, version: r.version + 1, status: S_MENUNGGU, catatan: null, updated_at: t, updated_by: 'pendata' });
        if (photos.length) await kvPut('blob', 'ph:' + pid, photos);
        results.push({ id: pid, ok: true, version: r.version, status: S_MENUNGGU });
      } else {
        results.push({ id: pid, conflict: true, server: await potDict(r) });
      }
    }
    return { results };
  };
  R['GET potensi'] = async (b, q, tok) => {
    const u = await currentUser(tok);
    const items = [];
    for (const r of [...DB.potensi].sort((x, y) => y.updated_at - x.updated_at)) { const x = visibleFor(await potDict(r), u); if (x) items.push(x); }
    return { items, time: now(), role: u?.role || 'tamu' };
  };
  R['GET potensi/:id'] = async (b, q, tok, pid) => {
    const r = DB.potensi.find((x) => x.id === pid);
    const item = r ? visibleFor(await potDict(r, true), await currentUser(tok)) : null;
    if (!item) fail('Data tidak ditemukan', 404);
    return item;
  };

  const minatDict = (r) => ({ ...r, potensiId: r.potensi_id, createdAt: r.created_at });
  R['GET minat/saya'] = async (b, q, tok) => { const u = await need(tok, 'investor'); return { items: DB.minat.filter((m) => m.user_id === u.id).sort((x, y) => y.created_at - x.created_at).map(minatDict) }; };
  R['POST minat'] = async (b, q, tok) => {
    const u = await need(tok, 'investor');
    const mid = str(b.id, 64);
    if (!mid || !b.potensiId) fail('Peluang wajib dipilih');
    if (kycStatus(u.id).status !== 'Terverifikasi') fail('Data diri Anda belum diverifikasi DPMPTSP. Lengkapi verifikasi data diri sebelum mengajukan minat.', 403, 'kyc_required');
    const old = DB.minat.find((m) => m.id === mid); if (old) return { ok: true, kode: old.kode, id: mid };
    const kode = 'MIN-2026-' + String(DB.minat.length + 138).padStart(4, '0');
    DB.minat.push({ id: mid, kode, potensi_id: str(b.potensiId, 64), nama: (str(b.nama).trim() || u.nama).slice(0, 120), perusahaan: str(b.perusahaan || u.perusahaan, 160),
      kontak: (str(b.kontak).trim() || u.email).slice(0, 160), nilai: str(b.nilai, 40), pesan: str(b.pesan, 2000), status: 'Baru', created_at: now(), user_id: u.id });
    return { ok: true, kode, id: mid };
  };

  R['GET kyc'] = async (b, q, tok) => {
    const u = await need(tok, 'investor');
    const r = DB.kyc.find((x) => x.user_id === u.id);
    const d = r?.data ? JSON.parse(await unseal(r.data) || '{}') : {};
    return { status: kycStatus(u.id), data: d, files: kycFiles(u.id) };
  };
  R['POST kyc'] = async (b, q, tok) => {
    const u = await need(tok, 'investor');
    const d = {};
    for (const [k, v] of Object.entries(b.data || {})) d[k] = typeof v === 'string' ? v.trim().slice(0, 300) : v;
    d.sektor = (Array.isArray(d.sektor) ? d.sektor : []).map((x) => str(x, 30)).slice(0, 6);
    if (!b.setuju) fail('Centang pernyataan dan persetujuan pemrosesan data pribadi');
    const p = kycValidate(d); if (p) fail(p);
    const r = DB.kyc.find((x) => x.user_id === u.id);
    if (r && ['Menunggu', 'Terverifikasi'].includes(r.status)) fail('Data Anda sedang ditinjau atau sudah terverifikasi', 409);
    const ih = await idHash(d.idNomor);
    if (DB.kyc.some((x) => x.id_hash === ih && x.user_id !== u.id && x.status !== 'Ditolak')) { audit('kyc_identitas_ganda', u.id, '', u); fail('Nomor identitas ini sudah dipakai akun lain. Hubungi DPMPTSP bila ini keliru.', 409); }
    for (const [jenis, url] of Object.entries(b.files || {})) {
      if (!KYC_JENIS.includes(jenis) || typeof url !== 'string' || !url) continue;
      const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(url); if (!m) fail(`Berkas ${jenis} tidak terbaca`);
      let raw; try { raw = unb64(m[2]); } catch { fail(`Berkas ${jenis} rusak`); }
      const mime = sniff(raw); if (!mime) fail(`Berkas ${jenis} harus foto JPG/PNG/WebP atau PDF`);
      if (raw.length > 4 * 1024 * 1024) fail(`Berkas ${jenis} terlalu besar (maks. 4 MB)`);
      await saveKycFile(u.id, jenis, raw, mime);
    }
    const have = DB.files.filter((f) => f.user_id === u.id).map((f) => f.jenis);
    const missing = ['identitas', 'selfie', ...(d.jenis === 'badan' ? ['nib', 'npwp'] : [])].filter((x) => !have.includes(x)).sort();
    if (missing.length) { const L = { identitas: 'foto KTP/paspor', selfie: 'swafoto dengan identitas', nib: 'dokumen NIB', npwp: 'kartu NPWP' }; fail('Unggah ' + missing.map((x) => L[x]).join(', ')); }
    const blob = await seal(JSON.stringify(d)), t = now();
    if (r) Object.assign(r, { data: blob, status: 'Menunggu', alasan: null, id_hash: ih, submitted_at: t, reviewed_at: null, reviewed_by: null });
    else DB.kyc.push({ user_id: u.id, data: blob, status: 'Menunggu', alasan: null, id_hash: ih, submitted_at: t, reviewed_at: null, reviewed_by: null });
    Object.assign(u, { nama: d.nama.slice(0, 120), telepon: d.telepon.slice(0, 40), perusahaan: (d.usahaNama || u.perusahaan || '').slice(0, 160) });
    audit('kyc_dikirim', u.id, d.jenis, u);
    return { ok: true, status: kycStatus(u.id) };
  };

  // Nama tempat dari koordinat: langsung ke OpenStreetMap dari HP, hasilnya disimpan di perangkat.
  R['GET geo/reverse'] = async (b, q, tok) => {
    await need(tok, 'pendata');
    const lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) fail('Koordinat tidak valid');
    const k = lat.toFixed(4) + ',' + lon.toFixed(4);
    if (DB.geo[k]) return { ...DB.geo[k], cache: true };
    let j = null;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 7000);
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=id`, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(tm); if (r.ok) j = await r.json();
    } catch { j = null; }
    if (!j || !j.address) fail('Nama tempat belum bisa dibaca (tidak ada internet)', 502, 'geo_offline');
    const a = j.address, pick = (ks) => { for (const x of ks) if (a[x]) return String(a[x]); return ''; };
    const res = { jalan: pick(['road', 'pedestrian', 'footway', 'path', 'track']), kampung: pick(['village', 'hamlet', 'suburb', 'neighbourhood', 'quarter', 'isolated_dwelling']),
      distrik: pick(['city_district', 'municipality', 'district', 'subdistrict', 'town']), kabupaten: pick(['county', 'regency', 'city']),
      provinsi: pick(['state', 'province', 'region']), negara: pick(['country']), label: String(j.display_name || ''), sumber: 'osm' };
    if (res.kabupaten && !/^(kabupaten|kota)\b/i.test(res.kabupaten)) res.kabupaten = 'Kabupaten ' + res.kabupaten;
    DB.geo[k] = res;
    return res;
  };

  const ADMIN_ONLY = () => fail(ADMIN_PC_ONLY, 403, 'admin_pc_only');
  ['GET minat', 'POST reset', 'GET admin/kyc', 'GET admin/kyc/:id', 'POST admin/kyc/:id', 'GET admin/audit',
   'POST potensi/:id/verifikasi', 'POST potensi/:id/level', 'POST potensi/:id/ubah', 'POST minat/:id/status'].forEach((k) => { R[k] = ADMIN_ONLY; });

  function route(method, p) {
    if (R[method + ' ' + p]) return [R[method + ' ' + p], []];
    for (const k of Object.keys(R)) {
      const [m, pat] = k.split(' ');
      if (m !== method || !pat.includes(':')) continue;
      const re = new RegExp('^' + pat.replace(/:\w+/g, '([^/]+)') + '$');
      const mm = re.exec(p); if (mm) return [R[k], mm.slice(1).map(decodeURIComponent)];
    }
    return [null, []];
  }

  // antrean agar dua permintaan tidak mengubah database bersamaan
  let chain = Promise.resolve();
  async function request(path, opts = {}) {
    const run = async () => {
      await boot();
      const [p, qs] = path.replace(/^\/api\//, '').split('?');
      const method = (opts.method || 'GET').toUpperCase();
      const [fn, params] = route(method, p);
      if (!fn) fail('Alamat API tidak ditemukan', 404);
      const body = opts.body ? JSON.parse(JSON.stringify(opts.body)) : {};
      const out = await fn(body, new URLSearchParams(qs || ''), opts.token || '', ...params);
      if (method !== 'GET' || p === 'potensi' || p.startsWith('auth/')) await save();
      return JSON.parse(JSON.stringify(out));
    };
    const res = chain.then(run, run);
    chain = res.catch(() => {});
    return res;
  }

  /** Berkas KYC milik investor yang sedang masuk, sebagai Blob (dibuka dari layar verifikasi data diri). */
  async function file(fid, token) {
    await boot();
    const u = await need(token, 'investor');
    const f = DB.files.find((x) => x.id === fid && x.user_id === u.id);
    if (!f) fail('Berkas tidak ditemukan', 404);
    const raw = await unsealBytes(await kvGet('blob', 'kyc:' + fid));
    return new Blob([raw], { type: f.mime });
  }

  /** Hapus seluruh data di HP dan kembali ke data contoh. */
  async function resetAll() { await boot(); for (const f of DB.files) await kvDel('blob', 'kyc:' + f.id); for (const p of DB.potensi) await kvDel('blob', 'ph:' + p.id); await install(); }

  window.KLocal = { request, file, resetAll, ready: boot, _totpAt: totpAt };
  boot().catch((e) => console.error('[khenambay] server lokal gagal disiapkan', e));
})();
