# Jembatan JavaScript dipanggil dari halaman web lewat refleksi.
-keepclassmembers class id.khenambay.app.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
