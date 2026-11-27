/* Jembatan Khenambay Android.
   Dijalankan di setiap halaman sebelum app.js. Menyediakan:
   - navigator.geolocation dari GPS HP (WebView memblokir GPS di alamat http biasa seperti 10.0.2.2 atau IP WiFi)
   - webkitSpeechRecognition dari pengenal suara bawaan HP (WebView tidak punya fitur ini)
   Semua pemanggilan diteruskan ke objek KhenambayNative milik aplikasi. */
(function () {
  if (window.__khBridge) return;
  window.__khBridge = true;
  var N = window.KhenambayNative;
  if (!N) return;

  // ---------- Lokasi ----------
  if (!window.isSecureContext) {
    var cbs = {}, seq = 0;
    var ERR = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    function fail(c, code, msg) { if (c && c.e) c.e({ code: code, message: msg, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); }
    window.__khGeo = function (id, ok, lat, lon, acc, code, msg) {
      var c = cbs[id]; if (!c) return;
      if (ok) {
        if (c.t) { clearTimeout(c.t); c.t = null; }
        c.s({ coords: { latitude: lat, longitude: lon, accuracy: acc, altitude: null, altitudeAccuracy: null, heading: null, speed: null }, timestamp: Date.now() });
        if (c.once) { delete cbs[id]; N.geoStop(id); }
      } else {
        fail(c, code, msg);
        if (c.once || code === 1) { delete cbs[id]; N.geoStop(id); }
      }
    };
    var geo = {
      getCurrentPosition: function (s, e, o) {
        var id = ++seq; var c = cbs[id] = { s: s, e: e, once: true };
        if (o && o.timeout && isFinite(o.timeout)) c.t = setTimeout(function () { if (cbs[id]) { delete cbs[id]; N.geoStop(id); fail(c, 3, 'Waktu habis'); } }, o.timeout);
        N.geoStart(id, true);
      },
      watchPosition: function (s, e) { var id = ++seq; cbs[id] = { s: s, e: e }; N.geoStart(id, false); return id; },
      clearWatch: function (id) { if (cbs[id]) { delete cbs[id]; N.geoStop(id); } }
    };
    try { Object.defineProperty(Navigator.prototype, 'geolocation', { get: function () { return geo; }, configurable: true }); } catch (x) {}
    try { Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true }); } catch (x) {}
  }

  // ---------- Suara ----------
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition && N.speechAvailable()) {
    var active = null;
    function KhSR() { this.lang = 'id-ID'; this.interimResults = false; this.continuous = false; this.onresult = null; this.onend = null; this.onerror = null; this.onstart = null; }
    KhSR.prototype.start = function () { active = this; this._final = []; N.speechStart(this.lang || 'id-ID', !!this.interimResults, !!this.continuous); };
    KhSR.prototype.stop = function () { N.speechStop(); };
    KhSR.prototype.abort = function () { N.speechStop(); };
    window.__khSpeech = function (type, text, isFinal, err) {
      var r = active; if (!r) return;
      if (type === 'start') { if (r.onstart) r.onstart({}); return; }
      if (type === 'result') {
        var item = [{ transcript: text, confidence: 0.9 }]; item.isFinal = !!isFinal;
        var list = r._final.slice(); list.push(item);
        if (isFinal) r._final.push(item);
        if (r.onresult) r.onresult({ resultIndex: list.length - 1, results: list });
        return;
      }
      if (type === 'error') { if (r.onerror) r.onerror({ error: err }); return; }
      if (type === 'end') { active = null; if (r.onend) r.onend({}); }
    };
    window.SpeechRecognition = window.webkitSpeechRecognition = KhSR;
  }
})();
