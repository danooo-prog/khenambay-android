package id.khenambay.app

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper

/**
 * GPS dari HP untuk halaman web. WebView memblokir navigator.geolocation di alamat http biasa
 * (10.0.2.2 atau IP WiFi), jadi bridge.js meneruskan permintaan lokasi ke sini.
 */
class NativeLocation(private val ctx: Context, private val emit: (String) -> Unit) {
    private val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val listeners = HashMap<Int, LocationListener>()

    @SuppressLint("MissingPermission")
    fun start(id: Int, once: Boolean) {
        stop(id)
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter { p ->
            lm.allProviders.contains(p) && runCatching { lm.isProviderEnabled(p) }.getOrDefault(false)
        }
        if (providers.isEmpty()) {
            fail(id, 2, "Lokasi HP mati. Nyalakan lokasi di pengaturan HP.")
            return
        }
        // Posisi terakhir yang masih segar (di bawah 2 menit) langsung dikirim agar peta cepat tampil.
        val recent = providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .filter { System.currentTimeMillis() - it.time < 120_000 }
            .minByOrNull { if (it.hasAccuracy()) it.accuracy else Float.MAX_VALUE }
        if (recent != null) {
            send(id, recent)
            if (once) return
        }
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                send(id, location)
                if (once) stop(id)
            }

            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}

            @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
        listeners[id] = listener
        providers.forEach { lm.requestLocationUpdates(it, 1000L, 0f, listener, Looper.getMainLooper()) }
    }

    fun stop(id: Int) {
        listeners.remove(id)?.let { lm.removeUpdates(it) }
    }

    fun stopAll() {
        listeners.keys.toList().forEach { stop(it) }
    }

    fun fail(id: Int, code: Int, msg: String) {
        emit("window.__khGeo&&__khGeo($id,false,0,0,0,$code,${org.json.JSONObject.quote(msg)})")
    }

    private fun send(id: Int, loc: Location) {
        val acc = if (loc.hasAccuracy()) loc.accuracy else 50f
        emit("window.__khGeo&&__khGeo($id,true,${loc.latitude},${loc.longitude},$acc,0,'')")
    }
}
