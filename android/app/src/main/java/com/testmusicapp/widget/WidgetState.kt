package com.testmusicapp.widget

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * WidgetState holds all player data the widget needs.
 * Written by the RN app via WidgetBridgeModule, read by PlayerWidget.
 * Stored in SharedPreferences so it survives process death.
 */
data class WidgetState(
    val title: String = "Not Playing",
    val artist: String = "",
    val artworkPath: String = "",
    val isPlaying: Boolean = false,
    val isShuffle: Boolean = false,
    val repeatMode: String = "none",        // "none" | "one" | "all"
    val progress: Float = 0f,               // 0.0 – 1.0
    val durationSec: Int = 0,               // total track duration in seconds
    val bgStyle: String = "dominant",       // "dominant" | "artwork" | "gradient"
    val dominantColor: Int = 0xFF335330.toInt()
) {
    companion object {
        private const val PREFS_NAME = "testmusicAppWidgetPrefs"
        private const val KEY_STATE  = "widget_state"

        fun save(context: Context, state: WidgetState) {
            val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val json = JSONObject().apply {
                put("title",         state.title)
                put("artist",        state.artist)
                put("artworkPath",   state.artworkPath)
                put("isPlaying",     state.isPlaying)
                put("isShuffle",     state.isShuffle)
                put("repeatMode",    state.repeatMode)
                put("progress",      state.progress.toDouble())
                put("durationSec",   state.durationSec)
                put("bgStyle",       state.bgStyle)
                put("dominantColor", state.dominantColor)
            }
            prefs.edit().putString(KEY_STATE, json.toString()).apply()
        }

        fun load(context: Context): WidgetState {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val raw   = prefs.getString(KEY_STATE, null) ?: return WidgetState()
            return try {
                val j = JSONObject(raw)
                WidgetState(
                    title         = j.optString("title",         "Not Playing"),
                    artist        = j.optString("artist",        ""),
                    artworkPath   = j.optString("artworkPath",   ""),
                    isPlaying     = j.optBoolean("isPlaying",    false),
                    isShuffle     = j.optBoolean("isShuffle",    false),
                    repeatMode    = j.optString("repeatMode",    "none"),
                    progress      = j.optDouble("progress",      0.0).toFloat(),
                    durationSec   = j.optInt("durationSec",      0),
                    bgStyle       = j.optString("bgStyle",       "dominant"),
                    dominantColor = j.optInt("dominantColor",    0xFF335330.toInt())
                )
            } catch (e: Exception) {
                WidgetState()
            }
        }
    }
}