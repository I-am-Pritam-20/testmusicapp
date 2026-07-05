package com.musickit.mediacore

import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import com.facebook.react.bridge.ReadableMap

object MediaItemFactory {

  fun trackFromMap(map: ReadableMap): Track =
      Track(
          id = map.getString("id") ?: error("Track.id is required"),
          url = map.getString("url") ?: error("Track.url is required"),
          sourceType = if (map.hasKey("sourceType")) map.getString("sourceType") ?: "jiosaavn" else "jiosaavn",
          title = if (map.hasKey("title")) map.getString("title") ?: "" else "",
          artist = if (map.hasKey("artist")) map.getString("artist") ?: "" else "",
          artworkUrl = if (map.hasKey("artworkUrl")) map.getString("artworkUrl") else null,
          durationMs = if (map.hasKey("durationMs")) map.getDouble("durationMs").toLong() else null,
      )

  /**
   * Builds a Media3 MediaItem regardless of whether `track.url` is a
   * resolved JioSaavn stream URL or a local file/content URI — ExoPlayer's
   * default DataSource.Factory resolves both transparently, so the queue
   * can freely mix sources.
   */
  fun toMediaItem(track: Track): MediaItem {
    val metadata =
        MediaMetadata.Builder()
            .setTitle(track.title)
            .setArtist(track.artist)
            .apply { track.artworkUrl?.let { setArtworkUri(Uri.parse(it)) } }
            .build()

    return MediaItem.Builder()
        .setMediaId(track.id)
        .setUri(Uri.parse(track.url))
        .setMediaMetadata(metadata)
        .build()
  }
}
