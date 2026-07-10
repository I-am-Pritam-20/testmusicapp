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
            // Fires exactly when a repeat-mode wraparound happens (last
            // item -> first item). If shuffle is on, generate a fresh
            // shuffle order for the new lap instead of replaying the same
            // sequence every time.
            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT && player.shuffleModeEnabled) {
              player.setShuffleOrder(ShuffleOrder.DefaultShuffleOrder(player.mediaItemCount, System.currentTimeMillis()))
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