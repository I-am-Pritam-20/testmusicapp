package com.musickit.mediacore

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Batched audio-metadata extraction for device-scanned files.
 *
 * Folder picking and directory traversal live entirely on the JS side
 * now (@react-native-documents/picker + react-native-fs) — this module
 * only ever sees real filesystem paths, already resolved on the JS side.
 * That split (rather than doing SAF DocumentFile traversal natively)
 * mirrors inotuneoffline's proven FileScanner.ts/MediaMetadataModule.kt:
 * react-native-fs's own content:// URI support is unreliable for
 * directory listing, so the JS side resolves a picked tree URI to a
 * real /storage/emulated/0/... path first and walks that normally —
 * this module is only responsible for the part that has to be native
 * regardless (MediaMetadataRetriever), batched to cut down on bridge
 * round trips for a large library.
 */
class DeviceLibraryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule {

  override fun getName(): String = NAME

  /** Metadata for many files in one bridge round trip. Artwork comes
   *  back as a downscaled (200x200) base64 JPEG data URI rather than a
   *  cache-file path — small enough per track that even a few hundred
   *  at once is fine, and it avoids managing a native thumbnail cache
   *  directory at all. */
  @ReactMethod
  fun getBatchMetadata(paths: ReadableArray, promise: Promise) {
    val results = Arguments.createArray()
    val retriever = MediaMetadataRetriever()

    for (i in 0 until paths.size()) {
      val filePath = paths.getString(i) ?: continue
      try {
        retriever.setDataSource(filePath)

        val duration =
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        val title =
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
                ?: File(filePath).nameWithoutExtension
        val artist =
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
                ?: retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST)
                ?: "Unknown Artist"
        val album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM) ?: "Unknown Album"

        var artworkDataUri: String? = null
        val artBytes = retriever.embeddedPicture
        if (artBytes != null) {
          try {
            val raw = BitmapFactory.decodeByteArray(artBytes, 0, artBytes.size)
            if (raw != null) {
              val size = 200
              val scaled = Bitmap.createScaledBitmap(raw, size, size, true)
              val out = ByteArrayOutputStream()
              scaled.compress(Bitmap.CompressFormat.JPEG, 80, out)
              artworkDataUri = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
              if (scaled !== raw) raw.recycle()
              scaled.recycle()
            }
          } catch (_: Exception) {
            // No usable embedded artwork — fine, track just has none.
          }
        }

        results.pushMap(
            Arguments.createMap().apply {
              putString("path", filePath)
              putString("title", title)
              putString("artist", artist)
              putString("album", album)
              putDouble("duration", duration.toDouble())
              if (artworkDataUri != null) putString("artwork", artworkDataUri) else putNull("artwork")
            },
        )
      } catch (e: Exception) {
        // Skip bad files silently — still return a stub so the JS-side
        // index count matches what it sent.
        results.pushMap(
            Arguments.createMap().apply {
              putString("path", filePath)
              putNull("artwork")
              putDouble("duration", 0.0)
            },
        )
      }
    }

    retriever.release()
    promise.resolve(results)
  }

  companion object {
    const val NAME = "DeviceLibraryModule"
  }
}
