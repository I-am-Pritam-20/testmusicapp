package com.musickit.mediacore

import androidx.media3.session.MediaController

/**
 * Shares the single MediaController instance (bound to PlaybackService)
 * app-wide. Handy if you ever add another native surface (widgets, Auto,
 * Wear) that needs direct player access without going through JS.
 */
object PlayerControllerHolder {
  var controller: MediaController? = null
    private set

  private val readyCallbacks = mutableListOf<() -> Unit>()

  fun setController(controller: MediaController) {
    this.controller = controller
    readyCallbacks.forEach { it() }
    readyCallbacks.clear()
  }

  fun onReady(action: () -> Unit) {
    val current = controller
    if (current != null) action() else readyCallbacks.add(action)
  }
}
