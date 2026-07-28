package com.testmusicapp.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.os.Build
import android.util.Log
import android.widget.RemoteViews
import com.testmusicapp.MainActivity
import com.testmusicapp.R

class PlayerWidget : AppWidgetProvider() {

    companion object {
        const val TAG = "PlayerWidget"

        const val ACTION_PLAY_PAUSE = "com.testmusicapp.widget.PLAY_PAUSE"
        const val ACTION_NEXT       = "com.testmusicapp.widget.NEXT"
        const val ACTION_PREV       = "com.testmusicapp.widget.PREV"
        const val ACTION_SHUFFLE    = "com.testmusicapp.widget.SHUFFLE"
        const val ACTION_REPEAT     = "com.testmusicapp.widget.REPEAT"

        fun requestUpdate(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, PlayerWidget::class.java))
            if (ids.isNotEmpty()) {
                context.sendBroadcast(
                    Intent(context, PlayerWidget::class.java).apply {
                        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                    }
                )
            }
        }

        fun formatTime(seconds: Int): String {
            val s = seconds.coerceAtLeast(0)
            return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
        }
    }

    // ── Widget added to home screen ───────────────────────────────────────────
    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        Log.d(TAG, "Widget added to home screen → starting idle service")
        WidgetLifecycleManager.checkAndApply(context, widgetAdded = true)
    }

    // ── Last widget instance removed ──────────────────────────────────────────
    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        Log.d(TAG, "All widgets removed → stopping services + notification")
        WidgetLifecycleManager.checkAndApply(context, widgetAdded = false)
    }

    // ── Individual widget instance deleted ────────────────────────────────────
    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        // onDisabled fires when ALL are gone; here we just re-check
        val remaining = AppWidgetManager.getInstance(context)
            .getAppWidgetIds(ComponentName(context, PlayerWidget::class.java))
        if (remaining.isEmpty()) {
            WidgetLifecycleManager.checkAndApply(context, widgetAdded = false)
        }
    }

    // ── Normal update cycle ───────────────────────────────────────────────────
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        // Run on background thread — bitmap ops (blur, resize) are too slow for
        // the main thread and cause ANR which Android shows as "error loading widget"
        Thread {
            for (id in ids) updateWidget(context, mgr, id)
        }.start()
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_PLAY_PAUSE, ACTION_NEXT, ACTION_PREV,
            ACTION_SHUFFLE, ACTION_REPEAT -> {
                context.startService(
                    Intent(context, WidgetActionService::class.java).apply {
                        action = intent.action
                    }
                )
            }
        }
    }

    private fun updateWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
        try {
            drawWidget(context, mgr, widgetId)
        } catch (e: Exception) {
            Log.e(TAG, "updateWidget failed for id=$widgetId: ${e.message}", e)
            // Show a minimal safe fallback so the widget doesn't show "error loading"
            try {
                val views = RemoteViews(context.packageName, R.layout.widget_player)
                views.setTextViewText(R.id.widget_title, "TestMusicApp")
                views.setTextViewText(R.id.widget_artist, "Tap to open")
                views.setOnClickPendingIntent(
                    R.id.widget_root,
                    PendingIntent.getActivity(
                        context, 99,
                        Intent(context, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        },
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                )
                mgr.updateAppWidget(widgetId, views)
            } catch (_: Exception) {}
        }
    }

    private fun drawWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
        val state  = WidgetState.load(context)
        val views  = RemoteViews(context.packageName, R.layout.widget_player)

        val opts     = mgr.getAppWidgetOptions(widgetId)
        val density  = context.resources.displayMetrics.density
        val minW     = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
        val minH     = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
        val widthPx  = (minW * density + 0.5f).toInt().coerceAtLeast(400)
        val heightPx = (minH * density + 0.5f).toInt().coerceAtLeast(180)

        // Background — corner radius hardcoded to 28dp (no longer from settings)
        try {
            val cornerPx = 28f * context.resources.displayMetrics.density
            val bgBmp    = WidgetRenderer.buildBackground(context, state, widthPx, heightPx)
            val clipped  = clipToRoundRect(bgBmp, cornerPx)
            bgBmp.recycle()
            views.setImageViewBitmap(R.id.widget_bg_image, clipped)
        } catch (e: Exception) {
            Log.w(TAG, "Background render failed: ${e.message}")
        }

        // Artwork — 14dp corner radius, fallback = black bg + app foreground icon
        val artCornerPx = 14f * context.resources.displayMetrics.density
        try {
            val artBmp = WidgetRenderer.loadArtwork(state.artworkPath, 180, 180)
            if (artBmp != null) {
                val rounded = clipToRoundRect(artBmp, artCornerPx)
                artBmp.recycle()
                views.setImageViewBitmap(R.id.widget_artwork, rounded)
            } else {
                views.setImageViewBitmap(R.id.widget_artwork, buildFallbackArtwork(context, artCornerPx))
            }
        } catch (_: Exception) {
            views.setImageViewBitmap(R.id.widget_artwork, buildFallbackArtwork(context, artCornerPx))
        }

        // App Icon — 10dp corner radius
        // Exception scenario: clipToRoundRect() throws OutOfMemoryError (Throwable,
        // not Exception) if the device is critically low on memory during Bitmap.createBitmap().
        // Fallback: use the unclipped raw launcher icon — still correct, just not rounded.
        // If even decodeResource failed (null), fall back to the resource ID directly.
        var rawIconBmp: Bitmap? = null
        try {
            val appIconCornerPx = 10f * context.resources.displayMetrics.density
            rawIconBmp = BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
            if (rawIconBmp != null) {
                val roundedIcon = clipToRoundRect(rawIconBmp, appIconCornerPx)
                rawIconBmp.recycle()
                rawIconBmp = null
                views.setImageViewBitmap(R.id.widget_app_icon, roundedIcon)
            } else {
                views.setImageViewResource(R.id.widget_app_icon, R.mipmap.ic_launcher)
            }
        } catch (e: Exception) {
            Log.w(TAG, "App icon rounding failed, using raw bitmap: ${e.message}")
            if (rawIconBmp != null) {
                views.setImageViewBitmap(R.id.widget_app_icon, rawIconBmp)
            } else {
                views.setImageViewResource(R.id.widget_app_icon, R.mipmap.ic_launcher)
            }
        }

        // Text
        views.setTextViewText(R.id.widget_title,  state.title.ifBlank { "Not Playing" })
        views.setTextViewText(R.id.widget_artist, state.artist)

        // Progress bar
        views.setProgressBar(R.id.widget_progress, 1000, (state.progress * 1000).toInt(), false)
        // FIX: Tapping the progress bar opens the app so the user can seek from
        // the full player. RemoteViews ProgressBar does not support position-aware
        // tap events, so there is no way to determine WHERE on the bar was tapped
        // from inside a widget. Opening the app is the standard pattern (Spotify,
        // YT Music etc. do the same). The full sheet player's SeekBar supports
        // precise drag-and-tap seeking.
        views.setOnClickPendingIntent(
            R.id.widget_progress,
            PendingIntent.getActivity(
                context, 98,
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )

        // Time labels
        val totalSec   = state.durationSec.coerceAtLeast(0)
        val currentSec = (state.progress * totalSec).toInt()
        views.setTextViewText(R.id.widget_time_current, formatTime(currentSec))
        views.setTextViewText(R.id.widget_time_total,   formatTime(totalSec))

        // Play/Pause icon
        views.setImageViewResource(
            R.id.widget_btn_play,
            if (state.isPlaying) R.drawable.ic_widget_pause else R.drawable.ic_widget_play
        )

        // Shuffle tint (API 31+)
        // if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        //     val c = if (state.isShuffle) 0xFFFFFFFF.toInt() else 0xFFAAAAAA.toInt()
        //     views.setColorInt(R.id.widget_btn_shuffle, "setColorFilter", c, c)
        // }

        val shuffleColor = if (state.isShuffle) 0xFFFFFFFF.toInt() else 0xFFAAAAAA.toInt()
        views.setInt(R.id.widget_btn_shuffle, "setColorFilter", shuffleColor)

        // Repeat icon + tint
        views.setImageViewResource(
            R.id.widget_btn_repeat,
            if (state.repeatMode == "one") R.drawable.ic_widget_repeat_one
            else R.drawable.ic_widget_repeat
        )
        // if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        //     val c = if (state.repeatMode != "none") 0xFFFFFFFF.toInt() else 0xFFAAAAAA.toInt()
        //     views.setColorInt(R.id.widget_btn_repeat, "setColorFilter", c, c)
        // }

        val repeatColor = if (state.repeatMode != "none") 0xFFFFFFFF.toInt() else 0xFFAAAAAA.toInt()
        views.setInt(R.id.widget_btn_repeat, "setColorFilter", repeatColor)

        // Button PendingIntents
        views.setOnClickPendingIntent(R.id.widget_btn_play,    pi(context, ACTION_PLAY_PAUSE, 0))
        views.setOnClickPendingIntent(R.id.widget_btn_prev,    pi(context, ACTION_PREV,        1))
        views.setOnClickPendingIntent(R.id.widget_btn_next,    pi(context, ACTION_NEXT,        2))
        views.setOnClickPendingIntent(R.id.widget_btn_shuffle, pi(context, ACTION_SHUFFLE,     3))
        views.setOnClickPendingIntent(R.id.widget_btn_repeat,  pi(context, ACTION_REPEAT,      4))

        // Tap to open app
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getActivity(
                context, 99,
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        )

        mgr.updateAppWidget(widgetId, views)
    }

    private fun pi(context: Context, action: String, requestCode: Int): PendingIntent =
        PendingIntent.getBroadcast(
            context, requestCode,
            Intent(context, PlayerWidget::class.java).apply { this.action = action },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

    /**
     * Fallback artwork: black rounded square with the app's adaptive foreground
     * icon centered on it. Used when no song is playing or artwork is missing.
     */
    private fun buildFallbackArtwork(context: Context, cornerPx: Float): Bitmap {
        val size   = 180
        val bmp    = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val paint  = Paint(Paint.ANTI_ALIAS_FLAG)

        // Black background
        paint.color = Color.BLACK
        canvas.drawRoundRect(
            RectF(0f, 0f, size.toFloat(), size.toFloat()),
            cornerPx, cornerPx, paint
        )

        // Centered app foreground icon
        try {
            val fg = BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher)
            if (fg != null) {
                val iconSize  = (size * 0.65f).toInt()
                val iconOff   = (size - iconSize) / 2
                val scaled    = Bitmap.createScaledBitmap(fg, iconSize, iconSize, true)
                fg.recycle()
                canvas.drawBitmap(scaled, iconOff.toFloat(), iconOff.toFloat(), null)
                scaled.recycle()
            }
        } catch (_: Exception) {}

        return bmp
    }

    private fun clipToRoundRect(src: Bitmap, radiusPx: Float): Bitmap {
        val out    = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(out)
        val paint  = Paint(Paint.ANTI_ALIAS_FLAG)
        val rect   = RectF(0f, 0f, src.width.toFloat(), src.height.toFloat())
        paint.color = Color.WHITE
        canvas.drawRoundRect(rect, radiusPx, radiusPx, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(src, 0f, 0f, paint)
        return out
    }

    private fun Int.dpToPx(context: Context): Int =
        (this * context.resources.displayMetrics.density + 0.5f).toInt()
}