package com.musickit.bottomsheet

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.util.AttributeSet
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout


class NativeBottomSheetView(context: Context, attrs: AttributeSet? = null) :
    FrameLayout(context, attrs) {

  enum class SheetState { HIDDEN, EXPANDED }

  var onStateChange: ((SheetState) -> Unit)? = null

  private var state: SheetState = SheetState.HIDDEN
  private var pendingCommand: SheetState = SheetState.HIDDEN
  private var laidOut = false
  private var animator: ValueAnimator? = null

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (!laidOut && h > 0) {
      laidOut = true
      applyState(pendingCommand, animate = false)
    }
  }

  /** Sets the state to show once layout completes; a no-op re-trigger if layout already happened. */
  fun setInitialState(stateName: String) {
    val target = parseState(stateName)
    pendingCommand = target
    if (laidOut) applyState(target, animate = false)
  }

  fun expand() = requestState(SheetState.EXPANDED)
  fun hide() = requestState(SheetState.HIDDEN)
  // Kept for API compatibility with call sites written as "collapse" —
  // this sheet has no separate collapsed/peek state, so it just hides.
  fun collapse() = hide()
  fun snapTo(stateName: String) = requestState(parseState(stateName))

  private fun requestState(target: SheetState) {
    if (!laidOut) {
      // Layout hasn't happened yet (e.g. a command fired immediately on
      // mount) — remember it and apply once onSizeChanged runs.
      pendingCommand = target
      return
    }
    applyState(target, animate = true)
  }

  private fun parseState(name: String): SheetState =
      if (name == "expanded") SheetState.EXPANDED else SheetState.HIDDEN

  private fun targetTranslationFor(target: SheetState): Float =
      if (target == SheetState.EXPANDED) 0f else height.toFloat()

  private fun applyState(target: SheetState, animate: Boolean) {
    val targetY = targetTranslationFor(target)
    if (animate) {
      animateTo(targetY, target)
    } else {
      translationY = targetY
      state = target
      onStateChange?.invoke(state)
    }
  }

  private fun animateTo(targetY: Float, finalState: SheetState) {
    animator?.cancel()
    animator =
        ValueAnimator.ofFloat(translationY, targetY).apply {
          duration = 300
          interpolator = DecelerateInterpolator()
          addUpdateListener { translationY = it.animatedValue as Float }
          addListener(
              object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                  state = finalState
                  onStateChange?.invoke(state)
                }
              },
          )
          start()
        }
  }
}