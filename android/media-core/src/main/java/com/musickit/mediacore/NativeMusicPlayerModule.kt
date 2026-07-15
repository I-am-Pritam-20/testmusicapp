package com.musickit.mediacore

import android.content.ComponentName
import android.content.ContentUris
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
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
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executor

class NativeMusicPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule {

  private var controller: MediaController? = null
  private val pendingActions = mutableListOf<(MediaController) -> Unit>()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val mainExecutor = Executor { command -> mainHandler.post(command) }

  private val tracksById = LinkedHashMap<String, Track>()
  private var tickerStarted = false

  init {
    mainHandler.post {
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
          mainExecutor,
      )
    }
  }

  override fun getName(): String = NAME

  private fun withController(action: (MediaController) -> Unit) {
    mainHandler.post {
      val current = controller
      if (current != null) action(current) else pendingActions.add(action)
    }
  }

  // --- Queue -------------------------------------------------------------

  @ReactMethod
  fun setQueue(tracks: ReadableArray, startIndex: Double) {
    val trackList =
        (0 until tracks.size()).map { index ->
          val map = tracks.getMap(index) ?: error("Track at index $index in setQueue is null")
          MediaItemFactory.trackFromMap(map)
        }
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
      withController { c ->
        // "off" -> normal queue looping (see PlaybackService for why this
        // is REPEAT_MODE_ALL, not OFF). "one" -> current track repeats
        // forever. "once" -> current track repeats exactly one more time,
        // then automatically resumes normal queue looping — implemented
        // as a self-consuming REPEAT_MODE_ONE, see PlaybackService.
        when (mode) {
          "one" -> {
            PlayerControllerHolder.repeatOnceArmed = false
            c.repeatMode = Player.REPEAT_MODE_ONE
          }
          "once" -> {
            PlayerControllerHolder.repeatOnceArmed = true
            c.repeatMode = Player.REPEAT_MODE_ONE
          }
          else -> {
            PlayerControllerHolder.repeatOnceArmed = false
            c.repeatMode = Player.REPEAT_MODE_ALL
          }
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

  // --- Sleep timer ---------------------------------------------------------
  // A native Handler-based countdown (not a JS setInterval), so it's immune
  // to JS-thread throttling/GC pauses. It's tied to this TurboModule's own
  // lifetime (same as playback-state tracking already is) — not backed by
  // an OS-level alarm, so it won't survive the whole app process being
  // killed, but that's the same lifetime as the MediaController connection
  // itself already has.

  private var sleepTimerRunnable: Runnable? = null
  private var sleepTimerRemainingSeconds: Int = 0

  @ReactMethod
  fun startSleepTimer(seconds: Double) {
    cancelSleepTimerInternal()
    val total = seconds.toInt()
    if (total <= 0) return
    sleepTimerRemainingSeconds = total
    val runnable =
        object : Runnable {
          override fun run() {
            emitSleepTimerTick(sleepTimerRemainingSeconds)
            if (sleepTimerRemainingSeconds <= 0) {
              withController { it.pause() }
              sleepTimerRunnable = null
              return
            }
            sleepTimerRemainingSeconds -= 1
            mainHandler.postDelayed(this, 1000L)
          }
        }
    sleepTimerRunnable = runnable
    mainHandler.post(runnable)
  }

  @ReactMethod
  fun cancelSleepTimer() {
    cancelSleepTimerInternal()
  }

  private fun cancelSleepTimerInternal() {
    sleepTimerRunnable?.let { mainHandler.removeCallbacks(it) }
    sleepTimerRunnable = null
    sleepTimerRemainingSeconds = 0
    emitSleepTimerTick(null)
  }

  private fun emitSleepTimerTick(remainingSeconds: Int?) {
    emit(
        "onSleepTimerTick",
        Arguments.createMap().apply {
          if (remainingSeconds != null) putInt("remainingSeconds", remainingSeconds) else putNull("remainingSeconds")
        },
    )
  }

  override fun invalidate() {
    cancelSleepTimerInternal()
    super.invalidate()
  }

  // --- Offline: device audio scan + downloads ------------------------------
  // Both run on a plain background Thread (Promise.resolve/reject are safe
  // to call from any thread) — no coroutines dependency needed for this.

  /**
   * Queries MediaStore for locally-stored audio files. Requires
   * READ_MEDIA_AUDIO to be granted at runtime first (see
   * native-kit/permissions.ts) — returns an empty list otherwise rather
   * than throwing, since "no results" and "no permission" look the same
   * to the query.
   */
  @ReactMethod
  fun scanDeviceAudio(promise: Promise) {
    Thread {
      try {
        val results = Arguments.createArray()
        val projection =
            arrayOf(
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
            )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        reactApplicationContext.contentResolver
            .query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, null, "${MediaStore.Audio.Media.TITLE} ASC")
            ?.use { cursor ->
              val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
              val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
              val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
              val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
              val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
              while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                results.pushMap(
                    Arguments.createMap().apply {
                      putString("id", "local-$id")
                      putString("url", contentUri.toString())
                      putString("title", cursor.getString(titleCol) ?: "Unknown")
                      putString("artist", cursor.getString(artistCol) ?: "Unknown Artist")
                      putString("album", cursor.getString(albumCol))
                      putDouble("durationMs", cursor.getLong(durationCol).toDouble())
                    },
                )
              }
            }
        promise.resolve(results)
      } catch (e: Exception) {
        promise.reject("SCAN_ERROR", e.message, e)
      }
    }.start()
  }

  /**
   * Downloads `url` into this app's own external files directory (no
   * storage permission needed — app-scoped storage is always writable)
   * and resolves with a file:// URI on completion. Basic v1: no progress
   * events, no resume-on-failure. If you need reliable large background
   * downloads that survive the app being killed mid-download, Android's
   * DownloadManager system service would be the natural next step.
   */
  @ReactMethod
  fun downloadTrack(url: String, fileName: String, promise: Promise) {
    Thread {
      var connection: HttpURLConnection? = null
      try {
        val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val destDir = reactApplicationContext.getExternalFilesDir("downloads") ?: reactApplicationContext.filesDir
        if (!destDir.exists()) destDir.mkdirs()
        val destFile = File(destDir, safeName)

        connection = URL(url).openConnection() as HttpURLConnection
        connection.connect()
        if (connection.responseCode !in 200..299) {
          promise.reject("DOWNLOAD_ERROR", "HTTP ${connection.responseCode} downloading $url")
          return@Thread
        }
        connection.inputStream.use { input -> FileOutputStream(destFile).use { output -> input.copyTo(output) } }
        promise.resolve(Uri.fromFile(destFile).toString())
      } catch (e: Exception) {
        promise.reject("DOWNLOAD_ERROR", e.message, e)
      } finally {
        connection?.disconnect()
      }
    }.start()
  }

  @ReactMethod
  fun deleteDownloadedFile(localPath: String, promise: Promise) {
    Thread {
      try {
        val file = Uri.parse(localPath).path?.let { File(it) }
        promise.resolve(file?.exists() == true && file.delete())
      } catch (e: Exception) {
        promise.reject("DELETE_ERROR", e.message, e)
      }
    }.start()
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
        // Deliberately NOT derived from c.isPlaying (which is false during
        // buffering, e.g. right after a seek) — that caused the play/pause
        // button to visually flip to "paused" every time the user
        // scrubbed the seek bar, even though they never touched play/pause.
        // playWhenReady reflects actual user intent and stays true through
        // a seek-induced buffer, only flipping when pause()/stop() is
        // explicitly called.
        putBoolean("isPlaying", c.playWhenReady)
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
      when {
        mode == Player.REPEAT_MODE_ONE && PlayerControllerHolder.repeatOnceArmed -> "once"
        mode == Player.REPEAT_MODE_ONE -> "one"
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