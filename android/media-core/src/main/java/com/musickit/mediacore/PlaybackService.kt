package com.musickit.mediacore

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ShuffleOrder
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Owns the ExoPlayer instance and MediaSession for the whole app.
 * MediaSessionService gives us, for free:
 *  - a MediaStyle notification with artwork + play/pause/next/prev
 *  - lock screen controls
 *  - Bluetooth/headset/wearable transport control routing
 *  - background playback survival while the app is backgrounded
 *
 * Repeat-mode policy (see NativeMusicPlayerModule.setRepeatMode for the
 * JS-facing side of this):
 *  - JS "off": player.repeatMode = REPEAT_MODE_ALL. The queue never just
 *    stops at the end — it loops back to the start automatically, with a
 *    fresh shuffle order if shuffle is on. This is also why the
 *    notification's next/previous buttons never disappear: Media3 hides
 *    those when the player reports no next/previous item, which never
 *    happens while permanently in REPEAT_MODE_ALL.
 *  - JS "one": player.repeatMode = REPEAT_MODE_ONE, permanently — the
 *    current track repeats forever until the mode is changed.
 *  - JS "once": player.repeatMode = REPEAT_MODE_ONE too, but with
 *    PlayerControllerHolder.repeatOnceArmed = true. The very next repeat
 *    transition (the current track looping via ONE-mode) consumes that
 *    flag and reverts repeatMode to ALL, so it only repeats that one
 *    extra time before continuing with the rest of the queue.
 */
class PlaybackService : MediaSessionService() {

  private lateinit var player: ExoPlayer
  private lateinit var mediaSession: MediaSession

  override fun onCreate() {
    super.onCreate()

    val audioAttributes =
        AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build()

    player =
        ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            .build()
            .apply { repeatMode = Player.REPEAT_MODE_ALL }

    player.addListener(
        object : Player.Listener {
          override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            if (reason != Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) return

            if (PlayerControllerHolder.repeatOnceArmed) {
              // The single extra repeat (from "once") just happened —
              // consume it and fall back to normal whole-queue looping.
              PlayerControllerHolder.repeatOnceArmed = false
              player.repeatMode = Player.REPEAT_MODE_ALL
              return
            }

            // A genuine whole-queue wraparound (last item -> first item)
            // only happens here when repeatMode is ALL — REPEAT_MODE_ONE
            // "repeats" also hit this reason, but are excluded above by
            // the armed-flag check or simply don't need reshuffling.
            if (player.repeatMode == Player.REPEAT_MODE_ALL && player.shuffleModeEnabled) {
              player.setShuffleOrder(
                  ShuffleOrder.DefaultShuffleOrder(player.mediaItemCount, System.currentTimeMillis()),
              )
            }
          }
        },
    )

    mediaSession = MediaSession.Builder(this, player).build()

    setMediaNotificationProvider(DefaultMediaNotificationProvider.Builder(this).build())
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession = mediaSession

  override fun onTaskRemoved(rootIntent: Intent?) {
    val currentPlayer = mediaSession.player
    if (!currentPlayer.playWhenReady || currentPlayer.mediaItemCount == 0) {
      stopSelf()
    }
  }

  override fun onDestroy() {
    mediaSession.release()
    player.release()
    super.onDestroy()
  }
}