package id.khenambay.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File

/**
 * Khenambay untuk Android: aplikasi yang berdiri sendiri.
 * Tampilan dan "server" Khenambay ada di dalam APK (folder assets/www) dan datanya tersimpan di HP,
 * jadi tidak perlu XAMPP, alamat IP, atau port. Internet hanya dipakai untuk peta satelit dan nama tempat.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        val LOCATION_PERMS = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        /** Alamat khusus WebViewAssetLoader: berkas di assets dibuka lewat https sehingga semua fitur web aman dipakai. */
        private const val HOST = "appassets.androidplatform.net"
        const val APP_URL = "https://$HOST/www/index.html"
    }

    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var bridge: NativeBridge
    private lateinit var bridgeJs: String
    private lateinit var assetLoader: WebViewAssetLoader
    private var docStartScript = false
    private var pageReady = false
    private val startedAt = SystemClock.elapsedRealtime()

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private var onGranted: (() -> Unit)? = null
    private var onDenied: (() -> Unit)? = null

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val ok = result.values.any { it }
            val action = if (ok) onGranted else onDenied
            onGranted = null
            onDenied = null
            action?.invoke()
        }

    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = cameraUri
        deliverFiles(if (ok && uri != null) arrayOf(uri) else null)
    }

    private val openDocument = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        deliverFiles(uri?.let { arrayOf(it) })
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // Layar pembuka (logo cenderawasih) tampil sampai halaman siap, paling lama 4 detik.
        installSplashScreen().setKeepOnScreenCondition {
            !pageReady && SystemClock.elapsedRealtime() - startedAt < 4000
        }
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0F1408")) }
        web = WebView(this).apply { setBackgroundColor(Color.parseColor("#0F1408")) }
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            isIndeterminate = false
            progressTintList = ColorStateList.valueOf(Color.parseColor("#F2B635"))
        }
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(progress, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)).apply { gravity = Gravity.TOP })
        setContentView(root)

        // Android 15 menggambar sampai ke bawah status bar: beri jarak agar tampilan tidak tertutup.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        setupWebView()

        onBackPressedDispatcher.addCallback(this) {
            if (web.canGoBack()) {
                web.goBack()
            } else {
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
            }
        }

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            loadApp()
        } else {
            pageReady = true
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(false)
            userAgentString = "$userAgentString KhenambayAndroid/${BuildConfig.VERSION_NAME}"
        }

        // Semua berkas tampilan diambil dari dalam APK (assets/www), bukan dari server.
        assetLoader = WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        bridge = NativeBridge(this, web)
        web.addJavascriptInterface(bridge, "KhenambayNative")
        bridgeJs = assets.open("bridge.js").bufferedReader().use { it.readText() }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, bridgeJs, setOf("https://$HOST"))
            docStartScript = true
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                progress.visibility = View.VISIBLE
                if (!docStartScript) view.evaluateJavascript(bridgeJs, null)
            }

            override fun onPageFinished(view: WebView, url: String?) {
                progress.visibility = View.GONE
                pageReady = true
                if (!docStartScript) view.evaluateJavascript(bridgeJs, null)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == HOST) return false
                // Aktivasi Google Authenticator di HP yang sama: kode QR tidak bisa dipindai dari layar sendiri,
                // jadi tautan otpauth:// langsung membuka Google Authenticator dengan akun yang sudah terisi.
                if (url.scheme == "otpauth") {
                    openAuthenticator(url)
                    return true
                }
                // WhatsApp, email, telepon, dan situs lain dibuka di aplikasi yang sesuai.
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: ActivityNotFoundException) {
                    true
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                progress.progress = newProgress
            }

            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: android.webkit.GeolocationPermissions.Callback) {
                withPermissions(LOCATION_PERMS,
                    granted = { callback.invoke(origin, true, true) },
                    denied = { callback.invoke(origin, false, false) })
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                // Kamera dipakai lewat pemilih berkas, bukan getUserMedia.
                request.deny()
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: WebChromeClient.FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val accept = fileChooserParams.acceptTypes
                    .flatMap { it.split(",") }
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                val mimes = accept.map { if (it.startsWith(".")) mimeFromExtension(it) else it }.distinct()
                val imagesOnly = mimes.isNotEmpty() && mimes.all { it.startsWith("image/") }
                val acceptsImages = mimes.isEmpty() || mimes.any { it.startsWith("image/") }
                when {
                    // Foto lapangan harus dari kamera langsung (anti foto lama/galeri).
                    fileChooserParams.isCaptureEnabled && imagesOnly -> launchCamera()
                    fileChooserParams.isCaptureEnabled && acceptsImages -> askCameraOrFile(mimes)
                    else -> openDocument.launch(if (mimes.isEmpty()) arrayOf("*/*") else mimes.toTypedArray())
                }
                return true
            }
        }
    }

    fun loadApp() {
        web.loadUrl(APP_URL)
    }

    /** Buka Google Authenticator. Bila belum terpasang, arahkan ke Play Store. */
    private fun openAuthenticator(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: ActivityNotFoundException) {
            AlertDialog.Builder(this)
                .setTitle("Google Authenticator belum terpasang")
                .setMessage("Pasang Google Authenticator dari Play Store, lalu kembali ke Khenambay dan ketuk lagi \"Buka di Google Authenticator\".")
                .setPositiveButton("Buka Play Store") { _, _ ->
                    val pkg = "com.google.android.apps.authenticator2"
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")))
                    } catch (e2: ActivityNotFoundException) {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
                    }
                }
                .setNegativeButton("Nanti", null)
                .show()
        }
    }

    /** Minta izin bila belum ada, lalu jalankan salah satu aksi. */
    fun withPermissions(perms: Array<String>, granted: () -> Unit, denied: () -> Unit) {
        if (perms.any { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }) {
            granted()
            return
        }
        onGranted = granted
        onDenied = denied
        permissionLauncher.launch(perms)
    }

    private fun launchCamera() {
        try {
            val dir = File(cacheDir, "kamera").apply { mkdirs() }
            val file = File(dir, "foto-${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
            cameraUri = uri
            takePicture.launch(uri)
        } catch (e: Exception) {
            deliverFiles(null)
        }
    }

    private fun askCameraOrFile(mimes: List<String>) {
        AlertDialog.Builder(this)
            .setTitle("Tambah dokumen")
            .setItems(arrayOf("Ambil foto dengan kamera", "Pilih berkas (foto atau PDF)")) { _, which ->
                if (which == 0) launchCamera() else openDocument.launch(mimes.toTypedArray())
            }
            .setOnCancelListener { deliverFiles(null) }
            .show()
    }

    private fun deliverFiles(uris: Array<Uri>?) {
        val cb = fileCallback
        fileCallback = null
        cb?.onReceiveValue(uris)
    }

    private fun mimeFromExtension(ext: String): String = when (ext.lowercase()) {
        ".pdf" -> "application/pdf"
        ".txt" -> "text/plain"
        ".jpg", ".jpeg" -> "image/jpeg"
        ".png" -> "image/png"
        else -> "*/*"
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        bridge.release()
        web.destroy()
        super.onDestroy()
    }
}
