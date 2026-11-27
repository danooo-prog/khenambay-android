package id.khenambay.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import org.json.JSONObject

/**
 * Pengenal suara bawaan HP untuk halaman web (WebView tidak punya webkitSpeechRecognition).
 * Dipakai pendata untuk "ceritakan potensinya" dan untuk bertanya ke Cenra.
 */
class NativeSpeech(private val ctx: Context, private val emit: (String) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private var sr: SpeechRecognizer? = null
    private var lang = "id-ID"
    private var interim = true
    private var continuous = false
    private var stopping = false
    private var running = false

    fun available(): Boolean = SpeechRecognizer.isRecognitionAvailable(ctx)

    fun start(lang: String, interim: Boolean, continuous: Boolean) {
        if (!available()) {
            js("error", err = "service-not-allowed")
            js("end")
            return
        }
        release()
        this.lang = lang
        this.interim = interim
        this.continuous = continuous
        stopping = false
        running = true
        sr = SpeechRecognizer.createSpeechRecognizer(ctx).also { it.setRecognitionListener(listener) }
        js("start")
        listen()
    }

    fun stop() {
        if (!running) return
        stopping = true
        sr?.stopListening()
        // Bila mesin suara tidak mengirim hasil lagi, tutup sesi setelah 1,5 detik.
        main.postDelayed({ if (running) finish() }, 1500)
    }

    fun release() {
        sr?.destroy()
        sr = null
    }

    private fun listen() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, interim)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, ctx.packageName)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
        }
        sr?.startListening(intent)
    }

    private fun finish() {
        if (!running) return
        running = false
        release()
        js("end")
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onPartialResults(partialResults: Bundle?) {
            first(partialResults)?.takeIf { it.isNotBlank() }?.let { js("result", it, false) }
        }

        override fun onResults(results: Bundle?) {
            first(results)?.takeIf { it.isNotBlank() }?.let { js("result", it, true) }
            // Mode bercerita panjang: dengarkan lagi sampai petugas menekan tombol berhenti.
            if (continuous && !stopping && running) listen() else finish()
        }

        override fun onError(error: Int) {
            val quiet = error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
            if (quiet && continuous && !stopping && running) {
                listen()
                return
            }
            if (!quiet && !stopping) {
                val code = when (error) {
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
                    SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
                    SpeechRecognizer.ERROR_CLIENT -> "aborted"
                    else -> "no-speech"
                }
                js("error", err = code)
            }
            finish()
        }
    }

    private fun first(b: Bundle?): String? = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()

    private fun js(type: String, text: String = "", isFinal: Boolean = false, err: String = "") {
        emit("window.__khSpeech&&__khSpeech(${JSONObject.quote(type)},${JSONObject.quote(text)},$isFinal,${JSONObject.quote(err)})")
    }
}
