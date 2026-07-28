package com.testmusicapp.widget

import android.app.AppOpsManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Central decision point for service lifecycle based on widget presence.
 *
 * Rules:
 *  - No widget on home screen → stop playback + remove notification entirely.
 *  - Widget present → keep a minimal-footprint "idle" foreground service that
 *    only holds a MediaSession listener. The heavy playback work only starts
 *    when the user taps a widget button (WidgetActionService wakes it up).
 *
 * Call checkAndApply() from:
 *   • PlayerWidget.onDeleted / onDisabled  (widget removed)
 *   • PlayerWidget.onEnabled               (widget added)
 *   • App launch / boot                    (restore correct state)
 */
object WidgetLifecycleManager {

    const val TAG = "WidgetLifecycleMgr"

    fun isWidgetAdded(context: Context): Boolean {
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, PlayerWidget::class.java))
        return ids.isNotEmpty()
    }

    /**
     * Called whenever widget add/remove is detected.
     *
     * @param context      Application context
     * @param widgetAdded  Pass true if a widget was just added; false if removed/none.
     */
    fun checkAndApply(context: Context, widgetAdded: Boolean = isWidgetAdded(context)) {
        Log.d(TAG, "checkAndApply: widgetAdded=$widgetAdded")
        if (widgetAdded) {
            startIdleService(context)
        } else {
            stopEverything(context)
        }
    }

    /** Start the minimal idle service (holds a wakelock + MediaSession, ~0 CPU). */
    fun startIdleService(context: Context) {
        val intent = Intent(context, WidgetIdleService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "startIdleService failed: ${e.message}")
        }
    }

    /**
     * Called when ALL widget instances are removed from the home screen.
     * Stops the idle service but does NOT stop playback — the user may still
     * want music playing. Playback only stops via explicit user action or
     * swipe-from-recents (handled by WidgetIdleService.onTaskRemoved).
     */
    fun stopEverything(context: Context) {
        // Stop the idle service — no widget means no need for it
        try {
            context.stopService(Intent(context, WidgetIdleService::class.java))
        } catch (_: Exception) {}

        // Do NOT send WIDGET_REMOVED broadcast — that was wrongly stopping
        // playback when the user simply removed the widget from the home screen.
        // Playback continues unaffected. The widget just stops receiving updates.
        Log.d(TAG, "stopEverything: idle service stopped, playback untouched")
    }
}