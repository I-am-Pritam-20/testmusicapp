package com.musickit.mediacore

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
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
