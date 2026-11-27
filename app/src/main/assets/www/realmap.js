/* Peta asli Khenambay (citra satelit dan peta jalan) memakai Leaflet.
   - Satelit: Esri World Imagery + label nama tempat dan jalan (mirip tampilan satelit Google Maps).
   - Jalan: OpenStreetMap.
   - "Lokasi saya": titik biru yang mengikuti posisi GPS secara langsung (watchPosition).
   Ubin peta disimpan service worker sehingga area yang pernah dibuka tetap tampil saat sinyal lemah. */

let loading = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return (loading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'vendor/leaflet/leaflet.js';
    s.onload = () => res(window.L);
    s.onerror = () => { loading = null; rej(new Error('Leaflet gagal dimuat')); };
    document.head.appendChild(s);
  }));
}

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const BASES = {
  sat: (L) => L.layerGroup([
    L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 19, crossOrigin: 'anonymous',
      attribution: 'Citra &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics' }),
    L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 19, crossOrigin: 'anonymous', opacity: 0.85 }),
    L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 20, maxNativeZoom: 19, crossOrigin: 'anonymous' }),
  ]),
  road: (L) => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: 'anonymous',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">Kontributor OpenStreetMap</a>' }),
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function createRealMap(container, opts) {
  const L = await loadLeaflet();
  const el = document.createElement('div');
  el.className = 'realmap-canvas';
  container.prepend(el);

  const bounds = L.latLngBounds(opts.bounds);
  const map = L.map(el, { zoomControl: false, zoomSnap: 0.25, attributionControl: true, worldCopyJump: false, minZoom: 8, maxBounds: bounds.pad(0.6), maxBoundsViscosity: 0.7 });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  L.control.zoom({ position: 'bottomright', zoomInTitle: 'Perbesar', zoomOutTitle: 'Perkecil' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const fitHome = (animate = false) => map.fitBounds(opts.home || bounds, { padding: [12, 12], animate });
  fitHome();

  // ----- lapisan dasar -----
  let baseKey = null, baseLayer = null, tileErr = 0, tileOk = 0;
  function setBase(key) {
    if (key === baseKey) return;
    if (baseLayer) map.removeLayer(baseLayer);
    baseKey = key; baseLayer = BASES[key](L); tileErr = 0; tileOk = 0;
    const layers = baseLayer.getLayers ? baseLayer.getLayers() : [baseLayer];
    layers.forEach((t) => {
      t.on('tileload', () => { tileOk++; opts.onTiles?.(true); });
      t.on('tileerror', () => { tileErr++; if (tileErr >= 6 && tileOk === 0) opts.onTiles?.(false); });
    });
    baseLayer.addTo(map);
    el.dataset.base = key;
  }
  setBase(opts.base || 'sat');

  // ----- penanda data -----
  const markers = L.layerGroup().addTo(map);
  function update(data) {
    markers.clearLayers();
    if (data.pins) {
      data.pins.forEach((p) => {
        const size = p.level >= 4 ? 26 : 20;
        const icon = L.divIcon({ className: 'rm-pin-wrap', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
          html: `<span class="rm-pin${p.level >= 5 ? ' pulse' : ''}" style="--c:${p.color}"></span>` });
        L.marker([p.lat, p.lon], { icon, keyboard: true, title: p.label, riseOnHover: true })
          .bindTooltip(esc(p.label), { direction: 'top', offset: [0, -size / 2] })
          .on('click', () => opts.onPick?.(p.id)).addTo(markers);
      });
    }
    if (data.bars) {
      data.bars.forEach((b) => {
        const d = Math.round(30 + Math.min(b.n, 8) * 6);
        const icon = L.divIcon({ className: 'rm-pin-wrap', iconSize: [d, d], iconAnchor: [d / 2, d / 2],
          html: `<span class="rm-bubble${b.low ? ' low' : ''}${b.selected ? ' sel' : ''}" style="--c:${b.color}">${b.n}</span>` });
        L.marker([b.lat, b.lon], { icon, keyboard: true, title: b.label, riseOnHover: true })
          .bindTooltip(esc(b.id), { permanent: true, direction: 'bottom', offset: [0, d / 2 - 2], className: 'rm-label' })
          .on('click', () => opts.onPick?.(b.id)).addTo(markers);
      });
    }
  }
  update(opts);

  // ----- lokasi saya (langsung) -----
  let watch = null, meDot = null, meAcc = null, firstFix = false;
  function stopLocate() {
    if (watch != null) navigator.geolocation.clearWatch(watch);
    watch = null; firstFix = false;
    if (meDot) { map.removeLayer(meDot); map.removeLayer(meAcc); meDot = meAcc = null; }
    opts.onLocate?.({ on: false });
  }
  function locate() {
    if (watch != null) { stopLocate(); return false; }
    if (!('geolocation' in navigator)) { opts.onLocate?.({ on: false, error: 'Perangkat ini tidak mendukung GPS.' }); return false; }
    opts.onLocate?.({ on: true, waiting: true });
    watch = navigator.geolocation.watchPosition((pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude]; const acc = pos.coords.accuracy;
      if (!meDot) {
        meAcc = L.circle(ll, { radius: acc, color: '#1A73E8', weight: 1, fillColor: '#1A73E8', fillOpacity: 0.12, interactive: false }).addTo(map);
        meDot = L.marker(ll, { icon: L.divIcon({ className: 'rm-pin-wrap', iconSize: [22, 22], iconAnchor: [11, 11], html: '<span class="rm-me"></span>' }), zIndexOffset: 1000, keyboard: false })
          .bindTooltip('Lokasi Anda', { direction: 'top', offset: [0, -10] }).addTo(map);
      } else { meDot.setLatLng(ll); meAcc.setLatLng(ll).setRadius(acc); }
      if (!firstFix) { firstFix = true; map.flyTo(ll, Math.max(map.getZoom(), 15), { duration: 1 }); }
      opts.onLocate?.({ on: true, lat: ll[0], lon: ll[1], acc, inside: bounds.contains(ll) });
    }, (err) => {
      if (err.code === 1) { stopLocate(); opts.onLocate?.({ on: false, error: 'Izin lokasi ditolak. Aktifkan izin lokasi di browser.' }); return; }
      // Sinyal GPS putus sebentar: tetap dipantau, titik terakhir tetap tampil.
      if (!meDot) opts.onLocate?.({ on: true, waiting: true, error: 'Lokasi belum didapat. Coba di tempat terbuka.' });
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return true;
  }

  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(el);

  return {
    el, map, update, setBase, locate,
    get base() { return baseKey; },
    get locating() { return watch != null; },
    resize: () => map.invalidateSize(),
    reset: () => fitHome(true),
    focus: (lat, lon, z = 14) => map.flyTo([lat, lon], z, { duration: 0.8 }),
    destroy() { stopLocate(); ro.disconnect(); map.remove(); el.remove(); },
  };
}
