package com.testmusicapp.widget

import android.app.ActivityManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import com.testmusicapp.MainActivity

/**
 * Handles widget button taps.
 *
 * All 5 actions (play/pause, next, prev, shuffle, repeat) send explicit
 * broadcasts that WidgetBridgeModule forwards to JS via DeviceEventEmitter.
 * JS PlaybackQueueContext then calls the appropriate MusicPlayer action.
 *
 * PLAY/PAUSE special case — app may be dead:
 * If this app's Media3 PlaybackService is not running (app was killed from
 * recents), a broadcast to a dead JS context would be lost. Instead we launch
 * MainActivity with ACTION_WIDGET_PLAY so the app restarts and
 * PlaybackQueueContext auto-resumes the last session on startup. All other
 * actions (next/prev/shuffle/repeat) only make sense when the app is alive,
 * so they send broadcasts as normal — if the app is dead they're simply
 * ignored (no harm done).
 */
class WidgetActionService : Service() {

    companion object {
        const val TAG = "WidgetActionService"
        /** Intent action passed to MainActivity to trigger auto-resume on launch. */
        const val ACTION_WIDGET_PLAY = "com.testmusicapp.WIDGET_PLAY_RESUME"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            PlayerWidget.ACTION_PLAY_PAUSE -> handlePlayPause()
            PlayerWidget.ACTION_NEXT ->
                sendBroadcast(Intent("com.testmusicapp.SKIP_NEXT").setPackage(packageName))
            PlayerWidget.ACTION_PREV ->
                sendBroadcast(Intent("com.testmusicapp.SKIP_PREV").setPackage(packageName))
            PlayerWidget.ACTION_SHUFFLE ->
                sendBroadcast(Intent("com.testmusicapp.TOGGLE_SHUFFLE").setPackage(packageName))
            PlayerWidget.ACTION_REPEAT ->
                sendBroadcast(Intent("com.testmusicapp.CYCLE_REPEAT").setPackage(packageName))
        }

        WidgetIdleService.wakeFullService(this)
        stopSelf()
        return START_NOT_STICKY
    }

    /**
     * Play/pause handling:
     * - App alive → broadcast to JS (PlayerContext handles it).
     * - App dead  → launch MainActivity with ACTION_WIDGET_PLAY so it restores
     *               the last session and starts playback. The app opens in the
     *               background (FLAG_ACTIVITY_NO_USER_ACTION keeps it behind the
     *               home screen so the user doesn't get pulled into the app).
     */
    private fun handlePlayPause() {
        if (isAppAlive()) {
            sendBroadcast(Intent("com.testmusicapp.TOGGLE_PLAY_PAUSE").setPackage(packageName))
        } else {
            Log.d(TAG, "App is dead — launching MainActivity with WIDGET_PLAY_RESUME")
            startActivity(
                Intent(this, MainActivity::class.java).apply {
                    action = ACTION_WIDGET_PLAY
                    flags  = Intent.FLAG_ACTIVITY_NEW_TASK or
                             Intent.FLAG_ACTIVITY_SINGLE_TOP or
                             Intent.FLAG_ACTIVITY_NO_USER_ACTION
                }
            )
        }
    }

    /**
     * Returns true if the RN JS context is alive, i.e. this app's Media3
     * PlaybackService is running. We check for our own package's running
     * services rather than process state, which is more reliable after a
     * task-kill.
     */
    private fun isAppAlive(): Boolean {
        return try {
            val am = getSystemService(ACTIVITY_SERVICE) as ActivityManager
            @Suppress("DEPRECATION")
            am.getRunningServices(50).any { svc ->
                svc.service.packageName == packageName &&
                svc.service.className.contains("PlaybackService")
            }
        } catch (e: Exception) {
            Log.w(TAG, "isAppAlive check failed: ${e.message}")
            false
        }
    }
}