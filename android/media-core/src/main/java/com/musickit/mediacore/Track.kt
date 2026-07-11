package com.musickit.mediacore

/** Internal domain model — the native-side counterpart of TrackPayload in TS. */
data class Track(
  val id: String,
  val url: String,
  val sourceType: String, // "jiosaavn" | "local"
  val title: String,
  val artist: String,
  val artworkUrl: String?,
  val durationMs: Long?,
)
