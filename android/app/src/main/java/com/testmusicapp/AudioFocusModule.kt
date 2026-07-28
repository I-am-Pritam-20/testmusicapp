package com.testmusicapp

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioManager.OnAudioFocusChangeListener
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * AudioFocusModule
 *
 * Handles audio focus changes natively to distinguish:
 *
 *   AUDIOFOCUS_LOSS              → permanent loss (another music app)
 *                                  → pause playback, do NOT auto-resume
 *   AUDIOFOCUS_LOSS_TRANSIENT    → transient loss (phone call, Assistant)
 *                                  → pause playback, auto-resume on gain
 *   AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK → notification / GPS prompt
 *                                  → duck volume to ~20% of current level
 *                                    (≈ 80% reduction), restore on gain
 *   AUDIOFOCUS_GAIN              → focus returned
 *                                  → restore volume and/or resume
 *
 * This app's Media3 PlaybackService registers granular listeners for each
 * of these distinct events (rather than collapsing transient-loss and
 * duck into one generic "duck" event the way some player libraries do).
 *
 * This module must be registered and startListening() called from JS
 * (PlaybackQueueContext) once the player is ready.
 *
 * JS events emitted:
 *   "audioFocusLost"       → permanent → pause
 *   "audioFocusTransient"  → transient → pause, will resume
 *   "audioFocusDuck"       → can-duck  → volume lowered natively, no pause
 *   "audioFocusGain"       → restored  → { resume: boolean }
 */
class AudioFocusModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "AudioFocusModule"
        // Volume during duck: 70% of current level (≈ 30% reduction as requested)
        const val DUCK_FACTOR = 0.70f
    }

    private val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val handler       = Handler(Looper.getMainLooper())

    private var _ducked        = false
    private var _transientPaused = false
    private var _preDuckVolume = -1
    private var _focusRequest: AudioFocusRequest? = null  // API 26+
    private var _listening     = false

    private val focusListener = OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                Log.d(TAG, "AUDIOFOCUS_LOSS — permanent")
                restoreVolumeIfDucked()
                _transientPaused = false
                emit("audioFocusLost", null)
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                Log.d(TAG, "AUDIOFOCUS_LOSS_TRANSIENT — pause")
                restoreVolumeIfDucked()        // clear any duck from before
                _transientPaused = true
                emit("audioFocusTransient", null)
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                Log.d(TAG, "AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK — duck volume")
                if (!_ducked) {
                    _ducked = true
                    _preDuckVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                    val ducked = (_preDuckVolume * DUCK_FACTOR).toInt().coerceAtLeast(0)
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, ducked, 0)
                    Log.d(TAG, "Volume ducked: $_preDuckVolume → $ducked")
                }
                emit("audioFocusDuck", null)
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                Log.d(TAG, "AUDIOFOCUS_GAIN — restore (ducked=$_ducked transientPaused=$_transientPaused)")
                restoreVolumeIfDucked()
                val shouldResume = _transientPaused
                _transientPaused = false
                val params = Arguments.createMap().apply { putBoolean("resume", shouldResume) }
                emit("audioFocusGain", params)
            }
        }
    }

    private fun restoreVolumeIfDucked() {
        if (_ducked && _preDuckVolume >= 0) {
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, _preDuckVolume, 0)
            Log.d(TAG, "Volume restored: $_preDuckVolume")
            _preDuckVolume = -1
        }
        _ducked = false
    }

    override fun getName() = "AudioFocusModule"

    /**
     * Request audio focus and register the listener.
     * Must be called from JS after the player is ready to receive commands.
     * Safe to call multiple times — no-op if already listening.
     */
    @ReactMethod
    fun startListening() {
        if (_listening) return
        _listening = true
        Log.d(TAG, "startListening — requesting audio focus")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setAcceptsDelayedFocusGain(false)
                .setWillPauseWhenDucked(false)   // we handle ducking ourselves
                .setOnAudioFocusChangeListener(focusListener, handler)
                .build()
            _focusRequest = req
            val result = audioManager.requestAudioFocus(req)
            Log.d(TAG, "requestAudioFocus (API 26+): $result")
        } else {
            @Suppress("DEPRECATION")
            val result = audioManager.requestAudioFocus(
                focusListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            )
            Log.d(TAG, "requestAudioFocus (legacy): $result")
        }
    }

    /**
     * Abandon audio focus and unregister the listener.
     */
    @ReactMethod
    fun stopListening() {
        if (!_listening) return
        _listening = false
        restoreVolumeIfDucked()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            _focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            _focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(focusListener)
        }
        Log.d(TAG, "stopListening — audio focus abandoned")
    }

    private fun emit(event: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(event, params)
        } catch (e: Exception) {
            Log.w(TAG, "emit $event failed: ${e.message}")
        }
    }
}