/* Khenambay — peta 3D bergaya diorama untuk Kabupaten Jayapura.
   Medan dibuat secara prosedural dari garis pantai, Pegunungan Cycloop, Danau Sentani,
   sungai, dan perbukitan selatan. Ini peta ilustratif, bukan peta berskala.
   Dipakai di halaman investor (pin peluang) dan admin (batang jumlah potensi per distrik). */
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './vendor/CSS2DRenderer.js';

// ---------- noise ----------
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const polyDist = (px, py, pts) => { let m = Infinity; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segDist(px, py, ...pts[i], ...pts[i + 1])); return m; };

const RIVERS = [
  [[139.93, -3.06], [140.0, -2.95], [140.06, -2.84], [140.11, -2.74], [140.15, -2.66], [140.13, -2.56], [140.08, -2.47], [140.03, -2.40], [140.0, -2.33]],
  [[139.58, -3.13], [139.72, -3.08], [139.86, -3.04], [140.02, -3.11], [140.18, -3.08], [140.36, -3.13]],
  [[140.62, -2.62], [140.66, -2.70], [140.72, -2.78], [140.80, -2.82]],
];
const RIDGES = [ // Pegunungan Cycloop dan perbukitan selatan: [ax, ay, bx, by, lebar°, tinggi]
  [140.40, -2.505, 140.72, -2.535, 0.045, 11],
  [139.70, -3.00, 139.95, -3.17, 0.07, 6.5],
  [140.20, -2.95, 140.55, -3.05, 0.06, 5],
  [139.60, -2.75, 139.80, -2.85, 0.05, 4],
];

export function createMap(container, opts) {
  const { box, coast, distrik, lake } = opts.geo;
  const K = 100; // satuan dunia per derajat
  const midLon = (box.w + box.e) / 2, midLat = (box.n + box.s) / 2;
  const W = (box.e - box.w) * K, D = (box.n - box.s) * K;
  const toX = (lon) => (lon - midLon) * K, toZ = (lat) => -(lat - midLat) * K;
  const coastLat = (lon) => {
    for (let i = 0; i < coast.length - 1; i++) { const [x1, y1] = coast[i], [x2, y2] = coast[i + 1]; if (lon >= x1 && lon <= x2) return y1 + (y2 - y1) * (lon - x1) / (x2 - x1); }
    return lon < coast[0][0] ? coast[0][1] : coast[coast.length - 1][1];
  };
  function info(lon, lat) {
    const sea = (lat - coastLat(lon)) * K; // >0 di laut (satuan dunia)
    const ld = Math.hypot((lon - lake.lon) / lake.rx, (lat - lake.lat) / lake.ry);
    let river = Infinity; for (const r of RIVERS) river = Math.min(river, polyDist(lon, lat, r));
    let h = 0.5 + 2.2 * fbm(lon * 7, lat * 7) - 0.6;
    for (const [ax, ay, bx, by, w, H] of RIDGES) {
      const d = segDist(lon, lat, ax, ay, bx, by); const r = Math.exp(-(d * d) / (w * w));
      const ridged = 1 - Math.abs(fbm(lon * 22, lat * 22, 3) * 2 - 1);
      h += r * H * (0.55 + 0.6 * ridged);
    }
    h = Math.max(h, 0.25);
    h *= smooth(-1.2, -6, sea); // pantai landai
    if (sea > -1.2) h = 0.15 - Math.min(2.5, sea + 1.2) * 0.8;
    const lakeEdge = smooth(1.25, 0.9, ld); if (lakeEdge > 0) h = h * (1 - lakeEdge) + -0.6 * lakeEdge;
    const rw = 0.006, rv = smooth(rw * 2.2, rw, river); if (rv > 0 && sea < 0) h = h * (1 - rv) + -0.25 * rv;
    return { h, sea, lakeD: ld, river, rv };
  }

  // ---------- renderer & scene ----------
  const root = document.createElement('div'); root.className = 'map3d-root';
  container.appendChild(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  root.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer(); labels.domElement.className = 'map3d-labels'; root.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F3D9A4');   // langit senja Sentani
  scene.fog = new THREE.Fog('#F0C98A', 150, 330);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 800);
  const HOME = { pos: new THREE.Vector3(0, 92, 105), target: new THREE.Vector3(0, 0, 4) };
  const narrow = () => (container.clientWidth || 400) / Math.max(1, container.clientHeight || 400) < 0.95;
  function homeFor() {
    if (!narrow()) {
      const w = container.clientWidth || 800, h = container.clientHeight || 500; const vf = camera.fov * Math.PI / 180;
      const hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h)); const dist = Math.min(230, Math.max(140, (W * 0.74) / Math.tan(hf / 2)));
      return { target: HOME.target, pos: HOME.target.clone().add(new THREE.Vector3(0, 92, 105).normalize().multiplyScalar(dist)) };
    }
    const tg = new THREE.Vector3(toX(140.28), 0, toZ(-2.62)); return { target: tg, pos: tg.clone().add(new THREE.Vector3(0, 78, 74)) };
  }
  camera.position.copy(homeFor().pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeFor().target); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 25; controls.maxDistance = 220; controls.maxPolarAngle = 1.32; controls.screenSpacePanning = false;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  let touched = false; controls.addEventListener('start', () => { touched = true; });

  scene.add(new THREE.HemisphereLight('#FFFFFF', '#6E8B5A', 1.25));
  const sun = new THREE.DirectionalLight('#FFF4DC', 2.1); sun.position.set(-60, 110, 70);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 70, bottom: -70, near: 10, far: 320 }); sun.shadow.bias = -0.0008;
  scene.add(sun);

  const disposables = [];
  const keep = (o) => (disposables.push(o), o);

  // ---------- medan ----------
  const SX = 230, SZ = Math.round(SX * D / W);
  const geo = keep(new THREE.PlaneGeometry(W, D, SX, SZ)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3);
  const cSea = new THREE.Color('#7DB7C2'), cSand = new THREE.Color('#E6CF98'), cG1 = new THREE.Color('#B4DD72'), cG2 = new THREE.Color('#7DBE55'),
    cG3 = new THREE.Color('#5E9E46'), cRock = new THREE.Color('#9C8C76'), cTop = new THREE.Color('#E9E5DA'), cRiver = new THREE.Color('#78B9C9'), tmp = new THREE.Color();
  const H = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const lon = midLon + pos.getX(i) / K, lat = midLat - pos.getZ(i) / K; const r = info(lon, lat);
    pos.setY(i, r.h); H[i] = r.h;
    if (r.h < 0) tmp.copy(r.rv > 0.3 || r.lakeD < 1.2 ? cRiver : cSea);
    else if (r.sea > -3.2 && r.h < 1.1) tmp.copy(cSand);
    else if (r.h < 2.2) tmp.copy(cG1).lerp(cG2, smooth(0.4, 2.2, r.h));
    else if (r.h < 5.5) tmp.copy(cG2).lerp(cG3, smooth(2.2, 5.5, r.h));
    else if (r.h < 8.5) tmp.copy(cG3).lerp(cRock, smooth(5.5, 8.5, r.h));
    else tmp.copy(cRock).lerp(cTop, smooth(8.5, 11.5, r.h));
    const n = (hash(i, 7) - 0.5) * 0.06; cols[i * 3] = tmp.r + n; cols[i * 3 + 1] = tmp.g + n; cols[i * 3 + 2] = tmp.b + n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })));
  terrain.receiveShadow = true; scene.add(terrain);

  // dinding diorama (lapisan tanah di tepi)
  const wallMat = keep(new THREE.MeshStandardMaterial({ color: '#8A6A48', roughness: 1, flatShading: true }));
  const wallMat2 = keep(new THREE.MeshStandardMaterial({ color: '#6E523A', roughness: 1 }));
  const deep = keep(new THREE.MeshStandardMaterial({ color: '#2F86B5', roughness: 0.6 }));
  const base = new THREE.Mesh(keep(new THREE.BoxGeometry(W, 6, D)), [wallMat, wallMat, deep, wallMat2, wallMat, wallMat]); base.position.y = -3.06; scene.add(base);
  const wg = keep(new THREE.PlaneGeometry(W, D)); wg.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(wg, keep(new THREE.MeshStandardMaterial({ color: '#58B6E0', roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.82 })));
  water.position.y = 0.02; water.receiveShadow = true; scene.add(water);

  // ---------- pepohonan ----------
  const pine = keep(new THREE.ConeGeometry(0.42, 1.5, 7)); pine.translate(0, 1.05, 0);
  const round = keep(new THREE.IcosahedronGeometry(0.55, 0)); round.translate(0, 1.0, 0);
  const trunk = keep(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 5)); trunk.translate(0, 0.25, 0);
  const leafMat = keep(new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }));
  const N = 2600; const pines = new THREE.InstancedMesh(pine, leafMat, N), rounds = new THREE.InstancedMesh(round, leafMat, N), trunks = new THREE.InstancedMesh(trunk, keep(new THREE.MeshStandardMaterial({ color: '#7A5534' })), N * 2);
  [pines, rounds, trunks].forEach((m) => { m.castShadow = true; m.count = 0; });
  const greens = ['#3F7F3A', '#4E9442', '#2F6B36', '#6BA84A', '#8DBB4C', '#C7B347', '#3B8A5A'].map((c) => new THREE.Color(c));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000 && pines.count + rounds.count < N * 1.6; i++) {
    const lon = box.w + rnd() * (box.e - box.w), lat = box.s + rnd() * (box.n - box.s); const r = info(lon, lat);
    if (r.h < 0.45 || r.h > 9 || r.sea > -2.5 || r.lakeD < 1.35 || r.river < 0.015) continue;
    const forest = fbm(lon * 9 + 3, lat * 9 - 2, 3); if (forest < 0.47 + (r.h > 5 ? -0.08 : 0)) continue;
    const isPine = r.h > 3.5 ? rnd() < 0.75 : rnd() < 0.4; const tgt = isPine ? pines : rounds; if (tgt.count >= N) continue;
    const sc = 0.65 + rnd() * 0.7; p3.set(toX(lon), r.h - 0.05, toZ(lat)); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); s3.set(sc, sc * (0.85 + rnd() * 0.4), sc);
    m4.compose(p3, q, s3); tgt.setMatrixAt(tgt.count, m4); tgt.setColorAt(tgt.count, greens[Math.floor(rnd() * greens.length)]); tgt.count++;
    trunks.setMatrixAt(trunks.count++, m4);
  }
  [pines, rounds, trunks].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; scene.add(m); });

  // ---------- label distrik ----------
  const labelObjs = [];
  const heightAt = (lon, lat) => Math.max(0, info(lon, lat).h);
  const tagByName = {};
  for (const [nama, lat, lon] of distrik) {
    const el = document.createElement('div'); el.className = 'map3d-tag'; el.textContent = nama; tagByName[nama] = el;
    const o = new CSS2DObject(el); const adm = opts.mode === 'admin';
    o.position.set(toX(lon), heightAt(lon, lat) + (adm ? 2.2 : 0.4), toZ(lat)); o.center.set(0.5, adm ? 1 : -0.15); if (!adm) el.classList.add('ground');
    scene.add(o); labelObjs.push(o);
  }
  const deco = [['Samudra Pasifik', -2.30, 140.25], ['Danau Sentani', -2.64, 140.50], ['Peg. Cycloop', -2.50, 140.58]];
  for (const [t, lat, lon] of deco) { const el = document.createElement('div'); el.className = 'map3d-tag water'; el.textContent = t; const o = new CSS2DObject(el); o.position.set(toX(lon), heightAt(lon, lat) + 1, toZ(lat)); scene.add(o); labelObjs.push(o); }

  // ---------- penanda (pin peluang / batang distrik) ----------
  const markers = new THREE.Group(); scene.add(markers);
  let pickables = []; let tipObj = null;
  const stemGeo = keep(new THREE.CylinderGeometry(0.13, 0.13, 4.6, 8)); stemGeo.translate(0, 2.3, 0);
  const headGeo = keep(new THREE.SphereGeometry(1.15, 20, 14));
  const ringGeo = keep(new THREE.RingGeometry(1.6, 2.1, 36)); ringGeo.rotateX(-Math.PI / 2);
  const hitGeo = keep(new THREE.SphereGeometry(2.4, 8, 6));
  const barGeo = keep(new THREE.CylinderGeometry(1.25, 1.25, 1, 20)); barGeo.translate(0, 0.5, 0);
  const hitMat = keep(new THREE.MeshBasicMaterial({ visible: false }));
  const stemMat = keep(new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 }));
  const matCache = {};
  const mat = (c) => matCache[c] || (matCache[c] = keep(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.05, emissive: c, emissiveIntensity: 0.12 })));
  function clearMarkers() {
    markers.children.slice().forEach((g) => { g.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); }); markers.remove(g); });
    pickables = [];
  }
  function setData(o) {
    clearMarkers(); opts = { ...opts, ...o };
    if (opts.mode === 'admin') {
      for (const d of opts.bars || []) {
        const h0 = heightAt(d.lon, d.lat); const g = new THREE.Group(); g.position.set(toX(d.lon), h0, toZ(d.lat));
        const hgt = 0.6 + d.n * 2.2; const bar = new THREE.Mesh(barGeo, mat(d.color)); bar.scale.y = hgt; bar.castShadow = true; g.add(bar);
        if (d.low) { const ring = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: '#E8645A', transparent: true, opacity: 0.9, side: THREE.DoubleSide }))); ring.position.y = 0.12; ring.scale.setScalar(1.4); g.add(ring); }
        if (d.selected) { const ring = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: '#0B1F24', side: THREE.DoubleSide }))); ring.position.y = 0.14; ring.scale.setScalar(1.8); g.add(ring); }
        const tag = tagByName[d.id];
        if (tag) { tag.innerHTML = ''; tag.append(d.id + ' '); const c = document.createElement('b'); c.className = 'map3d-count' + (d.low ? ' low' : ''); c.textContent = d.n; tag.append(c); tag.parentObj = null; }
        const to = labelObjs.find((o) => o.element === tag); if (to) to.position.y = h0 + hgt + 1.4;
        const hit = new THREE.Mesh(hitGeo, hitMat); hit.scale.set(1.1, Math.max(1, hgt / 2.5), 1.1); hit.position.y = hgt / 2; hit.userData = { id: d.id, name: d.label }; g.add(hit); pickables.push(hit);
        g.userData.bob = false; markers.add(g);
      }
    } else {
      for (const p of opts.pins || []) {
        const h0 = heightAt(p.lon, p.lat); const g = new THREE.Group(); g.position.set(toX(p.lon), h0, toZ(p.lat));
        const stem = new THREE.Mesh(stemGeo, stemMat); stem.castShadow = true; g.add(stem);
        const head = new THREE.Mesh(headGeo, mat(p.color)); head.position.y = 5.3; head.castShadow = true; head.scale.setScalar(p.level >= 4 ? 1.15 : 0.9); g.add(head);
        if (p.level >= 5) { const ring = new THREE.Mesh(ringGeo, keep(new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }))); ring.position.y = 0.15; g.add(ring); g.userData.ring = ring; }
        const hit = new THREE.Mesh(hitGeo, hitMat); hit.position.y = 4.6; hit.userData = { id: p.id, name: p.label }; g.add(hit); pickables.push(hit);
        g.userData.head = head; g.userData.phase = Math.random() * 6; markers.add(g);
      }
    }
  }
  setData(opts);

  // ---------- interaksi ----------
  const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let downAt = null;
  function pick(ev) {
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); const hit = ray.intersectObjects(pickables, false)[0]; return hit ? hit.object : null;
  }
  function showTip(obj) {
    if (tipObj) { tipObj.element.remove(); tipObj.parent?.remove(tipObj); tipObj = null; }
    if (!obj) return;
    const el = document.createElement('div'); el.className = 'map3d-tip'; el.textContent = obj.userData.name;
    tipObj = new CSS2DObject(el); tipObj.position.set(0, opts.mode === 'admin' ? obj.position.y * 2 + 2.6 : 7.2, 0); tipObj.center.set(0.5, 1); obj.parent.add(tipObj);
  }
  const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; downAt = null;
    const o = pick(e); if (o) { showTip(o); opts.onPick?.(o.userData.id); }
  };
  let hoverObj = null;
  const onMove = (e) => { if (e.pointerType !== 'mouse') return; const o = pick(e); if (o !== hoverObj) { hoverObj = o; renderer.domElement.style.cursor = o ? 'pointer' : 'grab'; showTip(o); } };
  renderer.domElement.addEventListener('pointerdown', onDown); renderer.domElement.addEventListener('pointerup', onUp); renderer.domElement.addEventListener('pointermove', onMove);

  // ---------- ukuran & loop ----------
  function resize() {
    const w = root.clientWidth || container.clientWidth, h = root.clientHeight || container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); labels.setSize(w, h); camera.aspect = w / h;
    camera.fov = w < 520 ? 50 : 42; camera.updateProjectionMatrix();
    if (!touched) { const hm = homeFor(); camera.position.copy(hm.pos); controls.target.copy(hm.target); }
  }
  const ro = new ResizeObserver(resize); ro.observe(root); resize();
  let raf = 0, running = true; const clock = new THREE.Clock();
  const io = new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running && !raf) loop(); }); io.observe(root);
  function loop() {
    raf = 0; if (!running) return;
    const t = clock.getElapsedTime();
    controls.update();
    const ps = opts.mode === 'admin' ? 1 : Math.min(2.4, Math.max(0.9, camera.position.distanceTo(controls.target) / 85));
    for (const g of markers.children) {
      if (opts.mode !== 'admin') g.scale.setScalar(ps);
      if (g.userData.head) g.userData.head.position.y = 5.3 + Math.sin(t * 2 + g.userData.phase) * 0.3;
      if (g.userData.ring) { const s = 1 + ((t * 0.8 + g.userData.phase) % 1) * 1.2; g.userData.ring.scale.setScalar(s); g.userData.ring.material.opacity = 0.8 * (1 - (s - 1) / 1.2); }
    }
    water.material.opacity = 0.8 + Math.sin(t * 0.8) * 0.04;
    const far = camera.position.distanceTo(controls.target) > 150; labelObjs.forEach((o, i) => { if (i < distrik.length) o.visible = opts.mode === 'admin' || !far || i % 2 === 0; });
    renderer.render(scene, camera); labels.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return {
    el: root,
    update(o) { setData(o); }, get count() { return markers.children.length + ':' + markers.children.map((g) => g.visible && g.scale.x.toFixed(2)).join(','); },
    get count() { return markers.children.length; },
    resize,
    reset() { const h = homeFor(); camera.position.copy(h.pos); controls.target.copy(h.target); },
    zoom(f) { const v = camera.position.clone().sub(controls.target).multiplyScalar(f); if (v.length() > controls.minDistance && v.length() < controls.maxDistance) camera.position.copy(controls.target).add(v); },
    focus(lon, lat) { const tgt = new THREE.Vector3(toX(lon), heightAt(lon, lat), toZ(lat)); const off = camera.position.clone().sub(controls.target).setLength(55); controls.target.copy(tgt); camera.position.copy(tgt).add(off); },
    destroy() {
      running = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); clearMarkers();
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointermove', onMove);
      [pines, rounds, trunks].forEach((m) => m.dispose());
      disposables.forEach((d) => d.dispose?.()); Object.values(matCache).forEach((m) => m.dispose());
      renderer.dispose(); renderer.forceContextLoss?.(); root.remove();
    },
  };
}
