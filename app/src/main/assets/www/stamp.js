/* Khenambay · cap lokasi pada foto lapangan (seperti aplikasi GPS Map Camera).
   Saat pendata memotret, foto otomatis diberi:
     - kompas arah kamera (kiri atas),
     - peta mini dengan penanda lokasi (kiri bawah),
     - tanggal & jam, arah (derajat + mata angin), nama jalan, kampung/desa, distrik/kecamatan,
       kabupaten, provinsi, ketinggian, kecepatan, koordinat, akurasi, dan nomor urut foto (kanan bawah).
   Nama lokasi:
     1. online  -> server PHP (api geo/reverse) menerjemahkan koordinat lewat OpenStreetMap, hasilnya disimpan,
     2. offline -> daftar kampung & distrik Kabupaten Jayapura yang ada di aplikasi (jalan tanpa sinyal).
   Hasil alamat juga dikembalikan agar bisa dimasukkan ke deskripsi data potensi. */
(function () {
  'use strict';

  // ---------- daftar tempat untuk mode tanpa sinyal (Kabupaten Jayapura, perkiraan titik tengah) ----------
  const KAMPUNG = [
    ['Sentani Kota', 'Sentani', -2.566, 140.513], ['Hinekombe', 'Sentani', -2.574, 140.494], ['Dobonsolo', 'Sentani', -2.571, 140.505],
    ['Ifar Besar', 'Sentani', -2.583, 140.52], ['Yobeh', 'Sentani', -2.584, 140.505], ['Hobong', 'Sentani', -2.588, 140.538],
    ['Asei Besar', 'Sentani Timur', -2.612, 140.585], ['Ayapo', 'Sentani Timur', -2.627, 140.632], ['Nolokla', 'Sentani Timur', -2.588, 140.596],
    ['Doyo Baru', 'Waibu', -2.565, 140.445], ['Doyo Lama', 'Waibu', -2.600, 140.400], ['Sosiri', 'Waibu', -2.638, 140.386],
    ['Ebungfauw', 'Ebungfauw', -2.656, 140.440], ['Simporo', 'Ebungfauw', -2.648, 140.462], ['Babrongko', 'Ebungfauw', -2.637, 140.478],
    ['Dosay', 'Sentani Barat', -2.556, 140.370], ['Maribu', 'Sentani Barat', -2.541, 140.350], ['Waibron', 'Sentani Barat', -2.575, 140.338],
    ['Depapre', 'Depapre', -2.480, 140.370], ['Tablanusu', 'Depapre', -2.445, 140.290], ['Tablasupa', 'Depapre', -2.458, 140.318], ['Kendate', 'Depapre', -2.468, 140.352],
    ['Kampung Harapan', 'Sentani Timur', -2.596, 140.572], ['Yongsu Spari', 'Ravenirara', -2.430, 140.450], ['Ormu Wari', 'Ravenirara', -2.448, 140.488],
    ['Demta', 'Demta', -2.380, 140.130], ['Yaugapsa', 'Demta', -2.402, 140.168],
    ['Yokari', 'Yokari', -2.360, 139.950], ['Meukisi', 'Yokari', -2.338, 139.912],
    ['Sabron Yaru', 'Kemtuk', -2.620, 140.270], ['Mamda', 'Kemtuk', -2.600, 140.233], ['Sekori', 'Kemtuk', -2.646, 140.250],
    ['Hyansip', 'Kemtuk Gresi', -2.710, 140.220], ['Bring', 'Kemtuk Gresi', -2.692, 140.195],
    ['Bundru', 'Gresi Selatan', -2.860, 140.240], ['Iwon', 'Gresi Selatan', -2.832, 140.262],
    ['Genyem', 'Nimboran', -2.640, 140.160], ['Imsar', 'Nimboran', -2.660, 140.130], ['Singgri', 'Nimboran', -2.628, 140.142],
    ['Benyom', 'Nimbokrang', -2.700, 139.980], ['Nimbokrang', 'Nimbokrang', -2.684, 140.010],
    ['Karya Bumi', 'Namblong', -2.610, 140.070], ['Sanggai', 'Namblong', -2.596, 140.086],
    ['Garusa', 'Unurum Guay', -2.920, 139.720], ['Sawoy', 'Kaureh', -3.050, 139.820], ['Lapua', 'Kaureh', -3.030, 139.860],
    ['Kamikaro', 'Airu', -3.100, 140.060], ['Bumi Sahaja', 'Yapsi', -2.960, 139.950], ['Taqwa Bangun', 'Yapsi', -2.945, 139.975],
  ];
  const BOX = { s: -3.4, n: -2.2, w: 139.4, e: 140.9 }; // kira-kira wilayah Kabupaten Jayapura

  function km(a1, o1, a2, o2) {
    const r = Math.PI / 180, dA = (a2 - a1) * r, dO = (o2 - o1) * r;
    const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }
  function offlinePlace(lat, lon) {
    if (lat < BOX.s || lat > BOX.n || lon < BOX.w || lon > BOX.e) {
      return { jalan: '', kampung: '', distrik: '', kabupaten: '', provinsi: '', sumber: 'luar', catatan: 'Di luar Kabupaten Jayapura (nama tempat muncul saat online)' };
    }
    let best = null, bd = 1e9;
    for (const k of KAMPUNG) { const d = km(lat, lon, k[2], k[3]); if (d < bd) { bd = d; best = k; } }
    const near = bd <= 2.5;
    return { jalan: '', kampung: near ? best[0] : 'sekitar ' + best[0], distrik: best[1], kabupaten: 'Kabupaten Jayapura', provinsi: 'Papua',
      sumber: 'offline', jarakKm: Math.round(bd * 10) / 10 };
  }

  // ---------- alamat dari koordinat ----------
  const CK = 'khenambay.geo';
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CK) || '{}'); } catch { return {}; } })();
  const keyOf = (lat, lon) => lat.toFixed(4) + ',' + lon.toFixed(4);
  async function reverse(lat, lon, apiFn) {
    const k = keyOf(lat, lon);
    if (cache[k]) return cache[k];
    if (navigator.onLine !== false && apiFn) {
      try {
        const r = await apiFn(`/api/geo/reverse?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`, { timeout: 7000 });
        if (r && (r.kampung || r.distrik || r.kabupaten)) {
          cache[k] = r;
          try { const ks = Object.keys(cache); if (ks.length > 300) delete cache[ks[0]]; localStorage.setItem(CK, JSON.stringify(cache)); } catch { /* penuh */ }
          return r;
        }
      } catch { /* jatuh ke offline */ }
    }
    return offlinePlace(lat, lon);
  }

  // ---------- arah kompas dari sensor HP ----------
  let heading = null;
  function onOri(e) {
    if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') heading = (360 - e.alpha) % 360;
  }
  function startCompass() {
    if (startCompass.on) return; startCompass.on = true;
    if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOri);
    else window.addEventListener('deviceorientation', onOri);
  }
  const ARAH = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const arahOf = (deg) => ARAH[Math.round(deg / 45) % 8];

  // ---------- posisi saat memotret ----------
  function position(fallback) {
    return new Promise((res) => {
      if (!('geolocation' in navigator)) return res(fallback);
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res(fallback); } }, 7000);
      navigator.geolocation.getCurrentPosition((p) => {
        if (done) return; done = true; clearTimeout(t);
        const c = p.coords;
        res({ lat: c.latitude, lon: c.longitude, acc: Math.round(c.accuracy), alt: c.altitude, spd: c.speed, head: c.heading, live: true });
      }, () => { if (!done) { done = true; clearTimeout(t); res(fallback); } }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 6500 });
    });
  }

  // ---------- peta mini ----------
  function tileXY(lat, lon, z) {
    const n = 2 ** z, x = ((lon + 180) / 360) * n;
    const r = (lat * Math.PI) / 180, y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    return [x, y];
  }
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; setTimeout(rej, 4000); });
  }
  async function miniMap(lat, lon, size) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const z = 16, [fx, fy] = tileXY(lat, lon, z), tx = Math.floor(fx), ty = Math.floor(fy);
    const px = (fx - tx) * 256, py = (fy - ty) * 256, scale = size / 256;
    let ok = 0;
    const jobs = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      jobs.push(loadImg(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${ty + dy}/${tx + dx}`)
        .then((im) => { g.drawImage(im, (dx * 256 - px) * scale + size / 2, (dy * 256 - py) * scale + size / 2, 256 * scale, 256 * scale); ok++; })
        .catch(() => {}));
    }
    await Promise.all(jobs);
    if (!ok) { // tanpa sinyal: peta gambar sederhana
      g.fillStyle = '#ECE6D6'; g.fillRect(0, 0, size, size);
      g.strokeStyle = '#FFFFFF'; g.lineWidth = size / 28; g.lineCap = 'round';
      let s = Math.abs(Math.sin(lat * 999 + lon * 77)) * 1000;
      const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(rnd() * size, 0); g.bezierCurveTo(rnd() * size, size * .3, rnd() * size, size * .7, rnd() * size, size); g.stroke(); }
      g.strokeStyle = '#9CC7DA'; g.lineWidth = size / 18; g.beginPath(); g.moveTo(0, size * rnd()); g.quadraticCurveTo(size / 2, size * rnd(), size, size * rnd()); g.stroke();
    }
    // penanda lokasi
    const cx = size / 2, cy = size / 2, r = size / 13;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(cx, cy + r * 0.2, r * 0.7, r * 0.25, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#E53935'; g.beginPath(); g.arc(cx, cy - r * 1.4, r, Math.PI, 0); g.lineTo(cx, cy); g.closePath(); g.fill();
    g.fillStyle = '#7F1D1D'; g.beginPath(); g.arc(cx, cy - r * 1.4, r * 0.38, 0, Math.PI * 2); g.fill();
    return { canvas: c, sumber: ok ? 'Peta © Esri, OpenStreetMap' : 'Peta sketsa (offline)' };
  }

  // ---------- kompas ----------
  function compass(g, x, y, R, deg) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = R * 0.18; g.strokeStyle = '#4A4F4C'; g.beginPath(); g.arc(0, 0, R * 0.86, 0, Math.PI * 2); g.stroke();
    g.rotate(-((deg || 0) * Math.PI) / 180);
    g.fillStyle = '#FFFFFF'; g.font = `700 ${R * 0.2}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([t, a]) => { g.save(); g.rotate((a * Math.PI) / 180); g.fillText(t, 0, -R * 0.86); g.restore(); });
    g.restore();
    g.save(); g.translate(x, y); // jarum tetap menunjuk arah kamera (atas)
    g.fillStyle = '#1F8FBF'; g.beginPath(); g.moveTo(0, -R * 0.62); g.lineTo(R * 0.09, 0); g.lineTo(-R * 0.09, 0); g.closePath(); g.fill();
    g.fillStyle = '#9AA0A6'; g.beginPath(); g.moveTo(0, R * 0.45); g.lineTo(R * 0.07, 0); g.lineTo(-R * 0.07, 0); g.closePath(); g.fill();
    g.restore();
  }

  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  const fmtCoord = (v, pos, neg) => `${Math.abs(v).toFixed(6)}° ${v >= 0 ? pos : neg}`;

  /** Gabungkan alamat menjadi satu kalimat untuk deskripsi data. */
  function alamatText(a, lat, lon) {
    const p = [a.jalan, a.kampung && (/^(kampung|desa|kelurahan|sekitar)\b/i.test(a.kampung) ? a.kampung : 'Kampung ' + a.kampung),
      a.distrik && (/^(distrik|kecamatan)\b/i.test(a.distrik) ? a.distrik : 'Distrik ' + a.distrik), a.kabupaten, a.provinsi].filter(Boolean);
    return (p.length ? p.join(', ') : a.catatan || 'Lokasi tanpa nama') + ` (${lat.toFixed(6)}, ${lon.toFixed(6)})`;
  }

  /**
   * Beri cap lokasi pada foto.
   * @param {File} file  foto dari kamera
   * @param {object} o   { fallback: {lat, lon, acc}, api: fungsi api aplikasi, max: sisi terpanjang, quality, index }
   * @returns {Promise<{url: string, meta: object}>}
   */
  async function stamp(file, o = {}) {
    startCompass();
    const src = URL.createObjectURL(file);
    try {
      const [img, pos] = await Promise.all([
        new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }),
        position(o.fallback && o.fallback.lat != null ? { ...o.fallback, live: false } : null),
      ]);
      const sc = Math.min(1, (o.max || 1600) / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const W = c.width, H = c.height, u = Math.min(W, H) / 100; // satuan relatif ukuran foto
      const now = new Date();
      const head = heading ?? (pos && Number.isFinite(pos.head) ? pos.head : null);
      const addr = pos ? await reverse(pos.lat, pos.lon, o.api) : null;

      // kompas kiri atas
      compass(g, u * 15, u * 15, u * 12, head ?? 0);

      // peta mini kiri bawah
      let mapSrc = '';
      if (pos) {
        const ms = Math.round(u * 34); const m = await miniMap(pos.lat, pos.lon, ms); mapSrc = m.sumber;
        g.save(); g.globalAlpha = 0.92; g.drawImage(m.canvas, 0, H - ms); g.restore();
        g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, H - u * 3.4, ms, u * 3.4);
        g.fillStyle = '#3B3B3B'; g.font = `600 ${u * 1.9}px sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('Khenambay', u * 1, H - u * 1.7);
      }

      // teks kanan bawah
      const idx = o.index || 1;
      const lines = [fmtDate(now)];
      lines.push(head != null ? `${Math.round(head)}° ${arahOf(head)}` : 'Arah: —');
      if (pos) {
        if (addr.jalan) lines.push(addr.jalan); else if (addr.sumber === 'osm') lines.push('Jalan Tanpa Nama');
        if (addr.kampung) lines.push(/^(kampung|desa|kelurahan|sekitar)\b/i.test(addr.kampung) ? addr.kampung : 'Kampung ' + addr.kampung);
        if (addr.distrik) lines.push(/^(distrik|kecamatan)\b/i.test(addr.distrik) ? addr.distrik : 'Distrik ' + addr.distrik);
        if (addr.kabupaten) lines.push(addr.kabupaten);
        if (addr.provinsi) lines.push(addr.provinsi);
        if (!addr.kampung && !addr.distrik && addr.catatan) lines.push(addr.catatan);
        lines.push(`${fmtCoord(pos.lat, 'N', 'S')}  ${fmtCoord(pos.lon, 'E', 'W')}`);
        lines.push(`Altitude:${Number.isFinite(pos.alt) && pos.alt !== null ? pos.alt.toFixed(1) + 'm' : ' —'}  ±${pos.acc ?? '?'}m`);
        lines.push(`Speed:${Number.isFinite(pos.spd) && pos.spd !== null ? (pos.spd * 3.6).toFixed(1) : '0.0'}km/h`);
      } else {
        lines.push('Lokasi belum terbaca (GPS mati)');
      }
      lines.push(`Index number: ${idx}`);
      const fs = u * 3.5, lh = fs * 1.14;
      g.font = `500 ${fs}px Roboto, "Segoe UI", Arial, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
      const x = W - u * 1.6; let y = H - u * 1.8 - (lines.length - 1) * lh;
      for (const t of lines) {
        g.lineWidth = fs * 0.16; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineJoin = 'round'; g.strokeText(t, x, y);
        g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = fs * 0.25; g.fillStyle = '#FFFFFF'; g.fillText(t, x, y); g.shadowBlur = 0;
        y += lh;
      }
      const url = c.toDataURL('image/jpeg', o.quality || 0.82);
      const meta = pos ? {
        lat: +pos.lat.toFixed(6), lon: +pos.lon.toFixed(6), acc: pos.acc ?? null, alt: Number.isFinite(pos.alt) ? +pos.alt.toFixed(1) : null,
        spd: Number.isFinite(pos.spd) ? +(pos.spd * 3.6).toFixed(1) : 0, arah: head != null ? Math.round(head) : null, waktu: now.getTime(), langsung: !!pos.live,
        jalan: addr.jalan || '', kampung: addr.kampung || '', distrik: addr.distrik || '', kabupaten: addr.kabupaten || '', provinsi: addr.provinsi || '',
        sumber: addr.sumber, peta: mapSrc, alamat: alamatText(addr, pos.lat, pos.lon), index: idx,
      } : { waktu: now.getTime(), alamat: 'Lokasi belum terbaca', index: idx };
      return { url, meta };
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  window.KStamp = { stamp, reverse, offlinePlace, alamatText, startCompass };
})();
