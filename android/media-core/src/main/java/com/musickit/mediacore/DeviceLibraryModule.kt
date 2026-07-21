package com.musickit.mediacore

import android.app.Activity
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import java.io.File
import java.io.FileOutputStream

/**
 * User-picked folder access (Storage Access Framework) — deliberately
 * separate from NativeMusicPlayerModule, which stays focused on playback.
 * No default/enforced folder: the app only ever sees what the user
 * explicitly picks via pickAudioFolder(), and access can be revoked later
 * via releaseFolderAccess().
 *
 * Manual TurboModule (not extending a generated Spec), same reasoning as
 * NativeMusicPlayerModule — see that file's comment.
 */
class DeviceLibraryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TurboModule, ActivityEventListener {

  private var pickFolderPromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  /** Launches the system folder picker. Resolves null if the user cancels. */
  @ReactMethod
  fun pickAudioFolder(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No current activity to launch the folder picker from")
      return
    }
    pickFolderPromise = promise
    val intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
    activity.startActivityForResult(intent, PICK_FOLDER_REQUEST_CODE)
  }

  override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != PICK_FOLDER_REQUEST_CODE) return
    val promise = pickFolderPromise ?: return
    pickFolderPromise = null

    val treeUri = data?.data
    if (resultCode != Activity.RESULT_OK || treeUri == null) {
      promise.resolve(null) // user cancelled — not an error
      return
    }

    reactApplicationContext.contentResolver.takePersistableUriPermission(
        treeUri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
    )

    val doc = DocumentFile.fromTreeUri(reactApplicationContext, treeUri)
    promise.resolve(
        Arguments.createMap().apply {
          putString("uri", treeUri.toString())
          putString("name", doc?.name ?: treeUri.lastPathSegment ?: "Folder")
        },
    )
  }

  override fun onNewIntent(intent: Intent?) {
    // Not used — folder picking is a plain startActivityForResult round trip.
  }

  /** Recursively scans a previously-picked folder tree for audio files,
   *  extracting title/artist/duration and — if present — embedded artwork
   *  (written to a cache file, since passing raw bytes over the bridge for
   *  every track would be wasteful). Runs on a background thread. */
  @ReactMethod
  fun scanFolder(treeUri: String, promise: Promise) {
    Thread {
      try {
        val uri = Uri.parse(treeUri)
        val root = DocumentFile.fromTreeUri(reactApplicationContext, uri)
        val results = Arguments.createArray()
        if (root != null) {
          collectAudioFiles(root, treeUri, results)
        }
        promise.resolve(results)
      } catch (e: Exception) {
        promise.reject("SCAN_ERROR", e.message, e)
      }
    }.start()
  }

  private fun collectAudioFiles(dir: DocumentFile, rootUriString: String, out: WritableArray) {
    for (file in dir.listFiles()) {
      if (file.isDirectory) {
        collectAudioFiles(file, rootUriString, out)
        continue
      }
      val mime = file.type ?: continue
      if (!mime.startsWith("audio/")) continue

      val retriever = MediaMetadataRetriever()
      var title: String? = null
      var artist: String? = null
      var durationMs = 0L
      var thumbnailPath: String? = null
      try {
        retriever.setDataSource(reactApplicationContext, file.uri)
        title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)
        artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)
        durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        val art = retriever.embeddedPicture
        if (art != null) {
          val thumbFile = File(reactApplicationContext.cacheDir, "thumb_${file.uri.hashCode()}.jpg")
          FileOutputStream(thumbFile).use { it.write(art) }
          thumbnailPath = Uri.fromFile(thumbFile).toString()
        }
      } catch (_: Exception) {
        // Unreadable metadata shouldn't drop the file entirely — still
        // list it using its filename.
      } finally {
        retriever.release()
      }

      out.pushMap(
          Arguments.createMap().apply {
            putString("id", "device-${file.uri}")
            putString("url", file.uri.toString())
            putString("title", title ?: (file.name ?: "Unknown"))
            putString("artist", artist ?: "Unknown Artist")
            putDouble("durationMs", durationMs.toDouble())
            putString("folderUri", rootUriString)
            if (thumbnailPath != null) putString("thumbnailUri", thumbnailPath) else putNull("thumbnailUri")
          },
      )
    }
  }

  /** Call when a folder is removed from the app's tracked list — releases
   *  the persisted permission Android granted at pick-time. */
  @ReactMethod
  fun releaseFolderAccess(treeUri: String) {
    try {
      reactApplicationContext.contentResolver.releasePersistableUriPermission(
          Uri.parse(treeUri),
          Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    } catch (_: Exception) {
      // Already released, or never actually held — fine either way.
    }
  }

  companion object {
    const val NAME = "DeviceLibraryModule"
    private const val PICK_FOLDER_REQUEST_CODE = 7391
  }
}