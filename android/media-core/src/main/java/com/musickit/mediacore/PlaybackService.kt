package com.musickit.mediacore

import android.content.Intent
import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ShuffleOrder
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

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
 *
 * Notification custom buttons: the default MediaStyle notification only
 * gets play/pause/next/prev for free — shuffle and repeat are added as
 * custom session commands with their own icons (media-core's own
 * res/drawable, since a library module can't reference the app module's
 * resources), tinted to reflect current state exactly the way the
 * in-app FullPlayerScreen's icons do (dimmed = off). This is the correct
 * Media3-native way to add notification actions — not a workaround for
 * a player library missing the feature, which is what a similarly-named
 * module in the inotuneoffline reference this was ported from had to do
 * for react-native-track-player specifically; that doesn't apply here.
 */
class PlaybackService : MediaSessionService() {

  private lateinit var player: ExoPlayer
  private lateinit var mediaSession: MediaSession

  companion object {
    private const val COMMAND_TOGGLE_SHUFFLE = "com.musickit.TOGGLE_SHUFFLE"
    private const val COMMAND_CYCLE_REPEAT = "com.musickit.CYCLE_REPEAT"
  }

  /** Rebuilt on demand (connect, and whenever shuffle/repeat actually
   *  change) rather than kept as mutable state — a fresh list from
   *  current player state can never drift out of sync with it. */
  private fun buildCustomLayout(): ImmutableList<CommandButton> {
    val shuffleButton =
        CommandButton.Builder(if (player.shuffleModeEnabled) CommandButton.ICON_SHUFFLE_ON else CommandButton.ICON_SHUFFLE_OFF)
            .setDisplayName(if (player.shuffleModeEnabled) "Shuffle on" else "Shuffle off")
            .setIconResId(if (player.shuffleModeEnabled) R.drawable.ic_cmd_shuffle_on else R.drawable.ic_cmd_shuffle_off)
            .setSessionCommand(SessionCommand(COMMAND_TOGGLE_SHUFFLE, Bundle.EMPTY))
            .build()

    // Mirrors NativeMusicPlayerModule.setRepeatMode's own state mapping —
    // REPEAT_MODE_ALL is JS "off" (see the class doc above for why),
    // REPEAT_MODE_ONE is either JS "one" or "once" depending on the armed
    // flag. Reusing that exact mapping here (rather than re-deriving it
    // some other way) is what keeps the notification icon, the in-app
    // icon, and the actual repeat behavior from ever disagreeing.
    val repeatIcon =
        when {
          player.repeatMode == Player.REPEAT_MODE_ALL -> CommandButton.ICON_REPEAT_OFF
          PlayerControllerHolder.repeatOnceArmed -> CommandButton.ICON_REPEAT_ONE
          else -> CommandButton.ICON_REPEAT_ALL
        }
    val repeatIconRes =
        when {
          player.repeatMode == Player.REPEAT_MODE_ALL -> R.drawable.ic_cmd_repeat_off
          PlayerControllerHolder.repeatOnceArmed -> R.drawable.ic_cmd_repeat_once
          else -> R.drawable.ic_cmd_repeat_all
        }
    val repeatButton =
        CommandButton.Builder(repeatIcon)
            .setDisplayName("Cycle repeat mode")
            .setIconResId(repeatIconRes)
            .setSessionCommand(SessionCommand(COMMAND_CYCLE_REPEAT, Bundle.EMPTY))
            .build()

    return ImmutableList.of(shuffleButton, repeatButton)
  }

  private fun refreshCustomLayout() {
    if (!::mediaSession.isInitialized) return
    mediaSession.setCustomLayout(buildCustomLayout())
  }

  private val sessionCallback =
      object : MediaSession.Callback {
        override fun onConnect(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
        ): MediaSession.ConnectionResult {
          val availableSessionCommands =
              MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
                  .add(SessionCommand(COMMAND_TOGGLE_SHUFFLE, Bundle.EMPTY))
                  .add(SessionCommand(COMMAND_CYCLE_REPEAT, Bundle.EMPTY))
                  .build()
          return MediaSession.ConnectionResult.accept(
              availableSessionCommands,
              MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS,
          )
        }

        override fun onPostConnect(session: MediaSession, controller: MediaSession.ControllerInfo) {
          refreshCustomLayout()
        }

        override fun onCustomCommand(
            session: MediaSession,
            controller: MediaSession.ControllerInfo,
            customCommand: SessionCommand,
            args: Bundle,
        ): ListenableFuture<SessionResult> {
          when (customCommand.customAction) {
            COMMAND_TOGGLE_SHUFFLE -> player.shuffleModeEnabled = !player.shuffleModeEnabled
            COMMAND_CYCLE_REPEAT -> {
              // off -> one -> once -> off, matching the same three JS-
              // facing states setRepeatMode supports.
              when {
                player.repeatMode == Player.REPEAT_MODE_ALL -> {
                  PlayerControllerHolder.repeatOnceArmed = false
                  player.repeatMode = Player.REPEAT_MODE_ONE
                }
                !PlayerControllerHolder.repeatOnceArmed -> {
                  PlayerControllerHolder.repeatOnceArmed = true
                  player.repeatMode = Player.REPEAT_MODE_ONE
                }
                else -> {
                  PlayerControllerHolder.repeatOnceArmed = false
                  player.repeatMode = Player.REPEAT_MODE_ALL
                }
              }
            }
          }
          refreshCustomLayout()
          return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
        }
      }

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
          override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) = refreshCustomLayout()

          override fun onRepeatModeChanged(repeatMode: Int) = refreshCustomLayout()

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

    mediaSession = MediaSession.Builder(this, player).setCallback(sessionCallback).build()

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