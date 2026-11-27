package id.khenambay.app

import android.Manifest
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView

/** Objek "KhenambayNative" yang bisa dipanggil halaman web (lihat assets/bridge.js). */
class NativeBridge(private val act: MainActivity, private val web: WebView) {
    private val main = Handler(Looper.getMainLooper())
    private val location = NativeLocation(act) { post(it) }
    private val speech = NativeSpeech(act) { post(it) }

    private fun post(js: String) {
        main.post { web.evaluateJavascript(js, null) }
    }

    @JavascriptInterface
    fun geoStart(id: Int, once: Boolean) {
        main.post {
            act.withPermissions(MainActivity.LOCATION_PERMS,
                granted = { location.start(id, once) },
                denied = { location.fail(id, 1, "Izin lokasi ditolak. Izinkan lokasi untuk Khenambay di pengaturan HP.") })
        }
    }

    @JavascriptInterface
    fun geoStop(id: Int) {
        main.post { location.stop(id) }
    }

    @JavascriptInterface
    fun speechAvailable(): Boolean = speech.available()

    @JavascriptInterface
    fun speechStart(lang: String, interim: Boolean, continuous: Boolean) {
        main.post {
            act.withPermissions(arrayOf(Manifest.permission.RECORD_AUDIO),
                granted = { speech.start(lang, interim, continuous) },
                denied = { post("window.__khSpeech&&(__khSpeech('error','',false,'not-allowed'),__khSpeech('end'))") })
        }
    }

    @JavascriptInterface
    fun speechStop() {
        main.post { speech.stop() }
    }

    @JavascriptInterface
    fun retry() {
        main.post { act.loadApp() }
    }

    @JavascriptInterface
    fun appVersion(): String = BuildConfig.VERSION_NAME

    fun release() {
        location.stopAll()
        speech.release()
    }
}
