package com.musickit.mediacore

import android.content.ComponentName
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.Timeline
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import com.google.common.util.concurrent.MoreExecutors

/**
 * Implemented as a plain ReactContextBaseJavaModule + TurboModule marker
 * (rather than extending a codegen-generated Spec base class) so this
 * module — and the :media-core Gradle module it lives in — has zero
 * build-time dependency on any particular app's codegen output. Drop this
 * module into another RN project and it works as-is; the New Architecture
 * interop layer resolves plain TurboModule-marked native modules via
 * TurboModuleRegistry the same as codegen'd ones, at the cost of losing
 * compile-time signature checking against src/native-kit/specs/*.ts on
 * Android. If you later extract this into its own versioned npm package,
 * switching to a generated Spec base class is a straightforward change.
 *
 * Binds a MediaController to PlaybackService's MediaSession and forwards
 * standard Player-interface calls to it — Media3's MediaController already
 * implements Player, so queue/transport/mode commands don't need any
 * custom IPC of our own.
 */
class NativeMusicPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule {

  private var controller: MediaController? = null
  private val pendingActions = mutableListOf<(MediaController) -> Unit>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val tracksById = LinkedHashMap<String, Track>()
  private var tickerStarted = false

  init {
    val token = SessionToken(reactContext, ComponentName(reactContext, PlaybackService::class.java))
    val future = MediaController.Builder(reactContext, token).buildAsync()
    future.addListener(
        {
          val readyController = future.get()
          controller = readyController
          PlayerControllerHolder.setController(readyController)
          readyController.addListener(playerListener)
          pendingActions.forEach { it(readyController) }
          pendingActions.clear()
          startPositionTickerIfNeeded()
        },
        MoreExecutors.directExecutor(),
    )
  }

  override fun getName(): String = NAME

  private fun withController(action: (MediaController) -> Unit) {
    val current = controller
    if (current != null) action(current) else pendingActions.add(action)
  }

  // --- Queue -------------------------------------------------------------

  @ReactMethod
  fun setQueue(tracks: ReadableArray, startIndex: Double) {
    val trackList = (0 until tracks.size()).map { MediaItemFactory.trackFromMap(tracks.getMap(it)) }
    trackList.forEach { tracksById[it.id] = it }
    val mediaItems = trackList.map { MediaItemFactory.toMediaItem(it) }
    withController { c ->
      val safeIndex = startIndex.toInt().coerceIn(0, (mediaItems.size - 1).coerceAtLeast(0))
      c.setMediaItems(mediaItems, safeIndex, 0L)
      c.prepare()
      c.playWhenReady = true
      emitQueueChanged(c)
    }
  }

  @ReactMethod
  fun addToQueue(track: ReadableMap) {
    val parsed = MediaItemFactory.trackFromMap(track)
    tracksById[parsed.id] = parsed
    withController { c ->
      c.addMediaItem(MediaItemFactory.toMediaItem(parsed))
      emitQueueChanged(c)
    }
  }

  @ReactMethod
  fun removeFromQueue(trackId: String) {
    withController { c ->
      val index = (0 until c.mediaItemCount).firstOrNull { c.getMediaItemAt(it).mediaId == trackId }
      if (index != null) c.removeMediaItem(index)
      tracksById.remove(trackId)
      emitQueueChanged(c)
    }
  }

  // --- Transport -----------------------------------------------------------

  @ReactMethod fun play() = withController { it.play() }
  @ReactMethod fun pause() = withController { it.pause() }
  @ReactMethod fun resume() = withController { it.play() }
  @ReactMethod fun stop() = withController { it.stop() }
  @ReactMethod fun seekTo(positionMs: Double) = withController { it.seekTo(positionMs.toLong()) }
  @ReactMethod fun skipToNext() = withController { it.seekToNextMediaItem() }
  @ReactMethod fun skipToPrevious() = withController { it.seekToPreviousMediaItem() }

  // --- Modes -----------------------------------------------------------

  @ReactMethod
  fun setShuffleEnabled(enabled: Boolean) = withController { it.shuffleModeEnabled = enabled }

  @ReactMethod
  fun setRepeatMode(mode: String) =
      withController {
        it.repeatMode =
            when (mode) {
              "one" -> Player.REPEAT_MODE_ONE
              "all" -> Player.REPEAT_MODE_ALL
              else -> Player.REPEAT_MODE_OFF
            }
      }

  @ReactMethod
  fun setPlaybackSpeed(speed: Double) = withController { it.setPlaybackSpeed(speed.toFloat()) }

  @ReactMethod
  fun updateTheme(themeJson: String) {
    // Reserved: forward to native chrome if/when it needs theme info. No-op for now.
  }

  @ReactMethod
  fun getCurrentState(promise: Promise) {
    withController { promise.resolve(buildStateMap(it)) }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by RN's NativeEventEmitter contract on Android; no bookkeeping needed.
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    // Required by RN's NativeEventEmitter contract on Android; no bookkeeping needed.
  }

  // --- Player -> JS events -------------------------------------------------

  private val playerListener =
      object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) = emitPlaybackState()
        override fun onPlaybackStateChanged(playbackState: Int) = emitPlaybackState()
        override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) = emitPlaybackState()
        override fun onRepeatModeChanged(repeatMode: Int) = emitPlaybackState()
        override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) = emitPlaybackState()

        override fun onTimelineChanged(timeline: Timeline, reason: Int) {
          controller?.let { emitQueueChanged(it) }
        }

        override fun onPlayerError(error: PlaybackException) {
          emitError("PLAYBACK_ERROR", error.message ?: "Unknown playback error")
        }
      }

  private fun startPositionTickerIfNeeded() {
    if (tickerStarted) return
    tickerStarted = true
    val ticker =
        object : Runnable {
          override fun run() {
            emitPlaybackState()
            mainHandler.postDelayed(this, 500L)
          }
        }
    mainHandler.post(ticker)
  }

  private fun buildStateMap(c: MediaController): WritableMap =
      Arguments.createMap().apply {
        putString("status", statusFor(c))
        putDouble("positionMs", c.currentPosition.toDouble())
        putDouble("durationMs", c.duration.coerceAtLeast(0).toDouble())
        putString("currentTrackId", c.currentMediaItem?.mediaId)
        putBoolean("isShuffleEnabled", c.shuffleModeEnabled)
        putString("repeatMode", repeatModeString(c.repeatMode))
        putDouble("speed", c.playbackParameters.speed.toDouble())
      }

  private fun statusFor(c: MediaController): String =
      when {
        c.playbackState == Player.STATE_BUFFERING -> "buffering"
        c.playbackState == Player.STATE_IDLE -> "idle"
        c.playbackState == Player.STATE_ENDED -> "stopped"
        c.isPlaying -> "playing"
        else -> "paused"
      }

  private fun repeatModeString(mode: Int): String =
      when (mode) {
        Player.REPEAT_MODE_ONE -> "one"
        Player.REPEAT_MODE_ALL -> "all"
        else -> "off"
      }

  private fun emitPlaybackState() {
    val c = controller ?: return
    emit("onPlaybackState", buildStateMap(c))
  }

  private fun emitQueueChanged(c: MediaController) {
    val queue = Arguments.createArray()
    for (i in 0 until c.mediaItemCount) {
      val id = c.getMediaItemAt(i).mediaId
      val track = tracksById[id]
      queue.pushMap(
          Arguments.createMap().apply {
            putString("id", id)
            putString("title", track?.title ?: "")
            putString("artist", track?.artist ?: "")
            putString("artworkUrl", track?.artworkUrl)
          },
      )
    }
    emit(
        "onQueueChanged",
        Arguments.createMap().apply {
          putArray("queue", queue)
          putInt("currentIndex", c.currentMediaItemIndex)
        },
    )
  }

  private fun emitError(code: String, message: String) {
    emit(
        "onError",
        Arguments.createMap().apply {
          putString("code", code)
          putString("message", message)
        },
    )
  }

  private fun emit(eventName: String, params: WritableMap) {
    reactApplicationContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
  }

  companion object {
    const val NAME = "NativeMusicPlayerModule"
  }
}
