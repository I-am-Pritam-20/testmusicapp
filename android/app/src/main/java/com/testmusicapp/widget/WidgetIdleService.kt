package com.testmusicapp.widget

import android.app.*
import android.content.*
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.testmusicapp.R

/**
 * WidgetIdleService — minimal foreground service kept alive only when a widget
 * is pinned to the home screen.
 *
 * Design goals:
 *  • CPU usage ≤ 1%: no polling loops, no timers — purely event-driven.
 *  • Holds a silent FOREGROUND_SERVICE notification so Android won't kill it.
 *  • onTaskRemoved() is on Service (NOT on Activity) — this is the correct
 *    place to intercept swipe-from-recents. MainActivity delegates to here.
 *
 * Task-removed behaviour:
 *   Case 1 — no widget: MainActivity calls ensureRunning() on resume, but
 *     WidgetLifecycleManager never started this service if no widget is added,
 *     so onTaskRemoved may not fire. MainActivity's onResume + this service
 *     together cover both cases.
 *   Case 2 — widget present: service is already running (START_STICKY).
 *     onTaskRemoved fires reliably → stops PlaybackService, keeps self alive
 *     as a dormant listener for widget button events.
 */
class WidgetIdleService : Service() {

    companion object {
        const val TAG            = "WidgetIdleService"
        const val CHANNEL_ID     = "testmusicapp_widget_idle"
        const val NOTIF_ID       = 9_001
        const val ACTION_WAKE    = "com.testmusicapp.widget.WAKE_FULL_SERVICE"

        /** Called by WidgetActionService after dispatching a widget action. */
        fun wakeFullService(context: Context) {
            context.startService(
                Intent(context, WidgetIdleService::class.java).apply {
                    action = ACTION_WAKE
                }
            )
        }

        /**
         * Called from MainActivity.onResume() to ensure the service is running
         * even when no widget is present — so onTaskRemoved fires for Case 1
         * (no widget → full process kill on swipe).
         */
        fun ensureRunning(context: Context) {
            try {
                val intent = Intent(context, WidgetIdleService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    context.startForegroundService(intent)
                else
                    context.startService(intent)
            } catch (e: Exception) {
                Log.w(TAG, "ensureRunning failed: ${e.message}")
            }
        }
    }

    private val handler  = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null

    private val wakeReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action == ACTION_WAKE) {
                Log.d(TAG, "Widget action received — refreshing widget")
                PlayerWidget.requestUpdate(ctx)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(NOTIF_ID, buildNotification())

        wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$TAG:lock")
            .also { it.acquire(10 * 60 * 1000L) }

        val filter = IntentFilter(ACTION_WAKE)
        val flag   = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            RECEIVER_NOT_EXPORTED else 0
        registerReceiver(wakeReceiver, filter, flag)
        Log.d(TAG, "WidgetIdleService started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // FIX: 7-day idle auto-cleanup.
        // If the app hasn't been used in 7 days: stop the widget service and
        // clear the session/recent/song caches. Playlist data, folder prefs,
        // widget prefs, and thumbnail caches are deliberately preserved.
        val idlePrefs = applicationContext
            .getSharedPreferences("testmusicapp_idle_prefs", Context.MODE_PRIVATE)
        val lastUsed = idlePrefs.getLong("last_used_ms", System.currentTimeMillis())
        val sevenDaysMs = 7L * 24 * 60 * 60 * 1000
        if (System.currentTimeMillis() - lastUsed > sevenDaysMs) {
            Log.d(TAG, "7-day idle threshold reached — clearing session caches")
            clearIdleCaches()
            stopSelf()
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_WAKE) {
            if (wakeLock?.isHeld == false) wakeLock?.acquire(30_000L)
            PlayerWidget.requestUpdate(this)
        }
        return START_STICKY
    }

    /**
     * Clears session/recent/songs caches but keeps:
     *  - playlists (@inotune_playlists_v1)
     *  - settings  (@inotune_settings_v1)
     *  - widget prefs (@inotune_widget_prefs_v1)
     *  - artwork thumbnail cache files
     */
    private fun clearIdleCaches() {
        try {
            val sp = applicationContext.getSharedPreferences(
                "com.testmusicapp.preferences", Context.MODE_PRIVATE
            )
            // Only remove volatile keys — leave playlists, settings, widget prefs
            sp.edit()
                .remove("@testmusicapp_session_v1")
                .remove("@testmusicapp_recent_v1")
                .remove("@testmusicapp_songs_v1")
                .remove("@testmusicapp_prefs_v1")
                .apply()
            // Clear widget state display
            WidgetState.save(applicationContext, WidgetState())
            PlayerWidget.requestUpdate(applicationContext)
        } catch (e: Exception) {
            Log.w(TAG, "clearIdleCaches failed: ${e.message}")
        }
    }

    /**
     * onTaskRemoved — fires when the user swipes the app away from recents.
     * This is a Service method, NOT an Activity method — hence it compiles here
     * but not in MainActivity (which extends Activity, not Service).
     *
     * Case 1 — no widget (service started by ensureRunning from MainActivity):
     *   Stop PlaybackService → kills playback + removes notification.
     *   Stop self → no persistent listener needed.
     *   Android GC collects the process since nothing holds it alive.
     *
     * Case 2 — widget present (service started by WidgetLifecycleManager):
     *   Stop PlaybackService → kills playback + removes notification.
     *   Do NOT stop self → stays alive as dormant widget listener.
     *   When user taps widget play, WidgetActionService relaunches the app.
     */
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        val widgetPresent = WidgetLifecycleManager.isWidgetAdded(applicationContext)
        Log.d(TAG, "onTaskRemoved: widgetPresent=$widgetPresent")

        // FIX: Mark playback as paused in WidgetState BEFORE stopping PlaybackService.
        // Previously PlaybackService was stopped while WidgetState.isPlaying was still
        // true — so the widget kept showing the "playing" icon after the app was killed.
        // We also ensure bgStyle is preserved (not reset to default).
        val current = WidgetState.load(applicationContext)
        WidgetState.save(
            applicationContext,
            current.copy(isPlaying = false),
        )
        // Immediately force a widget redraw so the icon flips to "paused"
        PlayerWidget.requestUpdate(applicationContext)

        // Always stop PlaybackService — removes playback + notification
        try {
            stopService(
                Intent().setClassName(
                    packageName,
                    "com.musickit.mediacore.PlaybackService"
                )
            )
        } catch (e: Exception) {
            Log.w(TAG, "stopService PlaybackService failed: ${e.message}")
        }

        // Record last-used timestamp for 7-day idle cleanup
        applicationContext
            .getSharedPreferences("testmusicapp_idle_prefs", Context.MODE_PRIVATE)
            .edit()
            .putLong("last_used_ms", System.currentTimeMillis())
            .apply()

        if (!widgetPresent) {
            stopSelf()
        }
        // Widget present — keep running as dormant listener (≤ 1% CPU, < 60 MB RAM)
    }

    override fun onDestroy() {
        try { unregisterReceiver(wakeReceiver) } catch (_: Exception) {}
        try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
        handler.removeCallbacksAndMessages(null)
        Log.d(TAG, "WidgetIdleService destroyed")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        NotificationChannel(
            CHANNEL_ID,
            "Widget service",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
            description = "Keeps the music widget responsive"
            nm.createNotificationChannel(this)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Music widget active")
            .setContentText("Tap the widget to control playback")
            .setSmallIcon(R.drawable.ic_widget_play)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setSilent(true)
            .setOngoing(true)
            .build()
}