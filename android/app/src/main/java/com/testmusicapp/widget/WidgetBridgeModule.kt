package com.testmusicapp.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.BitmapFactory
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule

/**
 * Native module "InoWidgetBridge" — exposes widget control to React Native.
 *
 * New in this version:
 *  • Listens for "com.testmusicapp.WIDGET_REMOVED" broadcast (sent by
 *    WidgetLifecycleManager.stopEverything when the last widget is removed).
 *    Emits "widgetRemoved" event to JS so PlaybackQueueContext can stop
 *    playback and clear the notification.
 */
class WidgetBridgeModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext), TurboModule {

    override fun getName(): String = "InoWidgetBridge"

    /**
     * Returns the action string of the Intent that launched MainActivity, or
     * null if launched normally. Used by PlayerContext to detect widget-play
     * cold-start and auto-resume the last session.
     */
    @ReactMethod
    fun getInitialAction(promise: Promise) {
        try {
            val action = reactApplicationContext.currentActivity?.intent?.action
            promise.resolve(action)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun updateWidget(params: ReadableMap) {
        val ctx     = reactApplicationContext
        val current = WidgetState.load(ctx)

        val artworkPath   = params.safeString("artworkPath") ?: current.artworkPath
        var dominantColor = current.dominantColor

        if (artworkPath.isNotBlank() && artworkPath != current.artworkPath) {
            try {
                val bmp = when {
                    artworkPath.startsWith("data:") -> {
                        val ci = artworkPath.indexOf(',')
                        if (ci >= 0) BitmapFactory.decodeByteArray(
                            android.util.Base64.decode(artworkPath.substring(ci + 1), android.util.Base64.DEFAULT),
                            0, android.util.Base64.decode(artworkPath.substring(ci + 1), android.util.Base64.DEFAULT).size
                        ) else null
                    }
                    artworkPath.startsWith("file://") ->
                        BitmapFactory.decodeFile(android.net.Uri.parse(artworkPath).path)
                    else -> BitmapFactory.decodeFile(artworkPath)
                }
                if (bmp != null) { dominantColor = WidgetRenderer.extractDominantColor(bmp); bmp.recycle() }
            } catch (_: Exception) {}
        }

        // Resolve data: URI → stable per-song cache file so the widget (and the
        // media notification) can read artwork via a plain file path.
        //
        // FIX: Use a hash of BOTH the artwork data AND a sanitised combination
        // of title+artist from the params map to avoid hash collisions between
        // different songs whose data URIs happen to share the same 32-bit
        // hashCode(). Also always re-write the file if it is missing or empty
        // (it can be evicted by the OS cache cleaner between writes and reads,
        // which caused ENOENT in MediaDataManager logs).
        val resolvedArtwork = if (artworkPath.startsWith("data:")) {
            try {
                val ci    = artworkPath.indexOf(',')
                val bytes = if (ci >= 0)
                    android.util.Base64.decode(artworkPath.substring(ci + 1), android.util.Base64.DEFAULT)
                else null
                if (bytes != null && bytes.isNotEmpty()) {
                    // Mix artwork hash with title+artist for a collision-resistant key
                    val titleArtist = "${params.safeString("title").orEmpty()}|${params.safeString("artist").orEmpty()}"
                    val hashLong    = (artworkPath.hashCode().toLong() and 0xFFFFFFFFL) xor
                                     (titleArtist.hashCode().toLong() and 0xFFFFFFFFL)
                    val file = java.io.File(ctx.cacheDir, "widget_art_${hashLong}.jpg")
                    // Always re-write if missing or empty — cache dir can be purged by OS
                    if (!file.exists() || file.length() == 0L) {
                        file.writeBytes(bytes)
                    }
                    if (file.exists() && file.length() > 0L) file.absolutePath
                    else artworkPath  // fallback: keep data: URI (WidgetRenderer handles it)
                } else artworkPath
            } catch (_: Exception) { artworkPath }
        } else artworkPath

        WidgetState.save(ctx, current.copy(
            title         = params.safeString("title")      ?: current.title,
            artist        = params.safeString("artist")     ?: current.artist,
            artworkPath   = resolvedArtwork,
            isPlaying     = params.safeBool("isPlaying")    ?: current.isPlaying,
            isShuffle     = params.safeBool("isShuffle")    ?: current.isShuffle,
            repeatMode    = params.safeString("repeatMode") ?: current.repeatMode,
            progress      = params.safeDouble("progress")?.toFloat()  ?: current.progress,
            durationSec   = params.safeInt("durationSec")             ?: current.durationSec,
            dominantColor = dominantColor
        ))
        PlayerWidget.requestUpdate(ctx)
    }

    @ReactMethod
    fun updateWidgetSettings(params: ReadableMap) {
        val ctx     = reactApplicationContext
        val current = WidgetState.load(ctx)
        WidgetState.save(ctx, current.copy(
            bgStyle = params.safeString("bgStyle") ?: current.bgStyle
        ))
        PlayerWidget.requestUpdate(ctx)
    }

    // ── Action listeners (all widget actions + widget removed) ────────────────
    // FIX: Previously only shuffle/repeat used broadcasts; play/pause/next/prev
    // used AudioManager media keys which are unreliable when the app is in the
    // foreground. Now ALL 5 actions use explicit broadcasts → JS events so
    // PlayerContext handles them deterministically regardless of app state.
    private var playPauseReceiver:  BroadcastReceiver? = null
    private var nextReceiver:       BroadcastReceiver? = null
    private var prevReceiver:       BroadcastReceiver? = null
    private var shuffleReceiver:    BroadcastReceiver? = null
    private var repeatReceiver:     BroadcastReceiver? = null
    private var removedReceiver:    BroadcastReceiver? = null

    @ReactMethod
    fun startListeningToWidgetActions() {
        val ctx  = reactApplicationContext
        val flag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            Context.RECEIVER_NOT_EXPORTED else 0

        playPauseReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { emit("widgetPlayPause", null) }
        }
        nextReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { emit("widgetSkipNext", null) }
        }
        prevReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { emit("widgetSkipPrev", null) }
        }
        shuffleReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { emit("widgetShuffleToggle", null) }
        }
        repeatReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { emit("widgetRepeatCycle", null) }
        }
        removedReceiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { emit("widgetRemoved", null) }
        }

        ctx.registerReceiver(playPauseReceiver, IntentFilter("com.testmusicapp.TOGGLE_PLAY_PAUSE"), flag)
        ctx.registerReceiver(nextReceiver,      IntentFilter("com.testmusicapp.SKIP_NEXT"),         flag)
        ctx.registerReceiver(prevReceiver,      IntentFilter("com.testmusicapp.SKIP_PREV"),         flag)
        ctx.registerReceiver(shuffleReceiver,   IntentFilter("com.testmusicapp.TOGGLE_SHUFFLE"),    flag)
        ctx.registerReceiver(repeatReceiver,    IntentFilter("com.testmusicapp.CYCLE_REPEAT"),      flag)
        ctx.registerReceiver(removedReceiver,   IntentFilter("com.testmusicapp.WIDGET_REMOVED"),    flag)
    }

    @ReactMethod
    fun stopListeningToWidgetActions() {
        listOf(playPauseReceiver, nextReceiver, prevReceiver,
               shuffleReceiver, repeatReceiver, removedReceiver).forEach { r ->
            try { reactApplicationContext.unregisterReceiver(r) } catch (_: Exception) {}
        }
        playPauseReceiver = null; nextReceiver = null; prevReceiver = null
        shuffleReceiver   = null; repeatReceiver = null; removedReceiver = null
    }

    private fun emit(event: String, data: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, data)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Double) {}

    private fun ReadableMap.safeString(key: String): String? =
        if (hasKey(key) && !isNull(key)) getString(key) else null
    private fun ReadableMap.safeBool(key: String): Boolean? =
        if (hasKey(key) && !isNull(key)) getBoolean(key) else null
    private fun ReadableMap.safeDouble(key: String): Double? =
        if (hasKey(key) && !isNull(key)) getDouble(key) else null
    private fun ReadableMap.safeInt(key: String): Int? =
        if (hasKey(key) && !isNull(key)) getInt(key) else null
}