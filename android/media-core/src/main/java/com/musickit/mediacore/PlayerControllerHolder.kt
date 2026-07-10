package com.musickit.mediacore

import androidx.media3.session.MediaController

object PlayerControllerHolder {
  var controller: MediaController? = null
    private set

  var repeatOnceArmed: Boolean = false

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