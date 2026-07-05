package com.musickit.bottomsheet

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.ViewConfiguration
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import kotlin.math.abs

/**
 * A self-contained, RN-agnostic draggable bottom sheet container. Hosts
 * arbitrary child views — in practice, one RN-rendered view tree wired up
 * via NativeBottomSheetManager — and handles vertical drag/fling/snap
 * entirely natively. There are no React Native imports in this class; it
 * could be reused in a plain Android app too.
 *
 * Geometry: this view is expected to be laid out at the FULL expanded
 * height (e.g. the RN side gives it `StyleSheet.absoluteFill` against a
 * full-screen parent). `collapsedHeightPx` is just the "peek" height
 * visible at the bottom of the screen when collapsed; collapsing is
 * implemented by translating the whole view down by
 * (height - collapsedHeightPx), so only its top `collapsedHeightPx` region
 * remains on-screen. RN content should put its "mini" UI in that same top
 * region and its "full" UI filling the whole view, crossfaded by opacity
 * via the onSlide progress callback — see PlayerScreen.tsx.
 */
class NativeBottomSheetView(context: Context, attrs: AttributeSet? = null) :
    FrameLayout(context, attrs) {

  enum class SheetState { COLLAPSED, EXPANDED, HIDDEN, DRAGGING }

  var collapsedHeightPx: Int = 0
  var onStateChange: ((SheetState) -> Unit)? = null
  var onSlide: ((Float) -> Unit)? = null

  private var state: SheetState = SheetState.COLLAPSED
  private var pendingInitialState: SheetState = SheetState.COLLAPSED
  private var laidOut = false

  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var velocityTracker: VelocityTracker? = null
  private var downX = 0f
  private var downY = 0f
  private var startTranslationY = 0f
  private var dragging = false
  private var animator: ValueAnimator? = null

  private fun maxTranslationY(): Float = (height - collapsedHeightPx).coerceAtLeast(0).toFloat()

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (!laidOut && h > 0) {
      laidOut = true
      applyState(pendingInitialState, animate = false)
    }
  }

  fun setInitialState(stateName: String) {
    pendingInitialState = parseState(stateName)
    if (laidOut) applyState(pendingInitialState, animate = false)
  }

  fun expand() = applyState(SheetState.EXPANDED, animate = true)
  fun collapse() = applyState(SheetState.COLLAPSED, animate = true)
  fun hide() = applyState(SheetState.HIDDEN, animate = true)
  fun snapTo(stateName: String) = applyState(parseState(stateName), animate = true)

  private fun parseState(name: String): SheetState =
      when (name) {
        "expanded" -> SheetState.EXPANDED
        "hidden" -> SheetState.HIDDEN
        else -> SheetState.COLLAPSED
      }

  private fun targetTranslationFor(target: SheetState): Float =
      when (target) {
        SheetState.EXPANDED -> 0f
        SheetState.HIDDEN -> height.toFloat()
        else -> maxTranslationY()
      }

  private fun applyState(target: SheetState, animate: Boolean) {
    val targetY = targetTranslationFor(target)
    if (animate) {
      animateTo(targetY, target)
    } else {
      translationY = targetY
      state = target
      emitSlide()
      onStateChange?.invoke(state)
    }
  }

  private fun animateTo(targetY: Float, finalState: SheetState) {
    animator?.cancel()
    animator =
        ValueAnimator.ofFloat(translationY, targetY).apply {
          duration = 260
          interpolator = DecelerateInterpolator()
          addUpdateListener {
            translationY = it.animatedValue as Float
            emitSlide()
          }
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

  private fun emitSlide() {
    val max = maxTranslationY()
    val progress = if (max <= 0f) 1f else (1f - (translationY / max)).coerceIn(0f, 1f)
    onSlide?.invoke(progress)
  }

  // --- Drag handling -------------------------------------------------------
  // Uses a touch-slop-based interception: plain taps on children (buttons,
  // the seek bar, etc.) pass through untouched. Only once a vertical drag
  // exceeds the slop AND is more vertical than horizontal does this view
  // start consuming the gesture — the standard pattern for a draggable
  // container that also hosts tappable content.

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    when (ev.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        downX = ev.rawX
        downY = ev.rawY
        startTranslationY = translationY
        dragging = false
        animator?.cancel()
      }
      MotionEvent.ACTION_MOVE -> {
        val dx = ev.rawX - downX
        val dy = ev.rawY - downY
        if (!dragging && abs(dy) > touchSlop && abs(dy) > abs(dx)) {
          dragging = true
          state = SheetState.DRAGGING
          onStateChange?.invoke(state)
          return true
        }
      }
    }
    return false
  }

  override fun onTouchEvent(ev: MotionEvent): Boolean {
    if (velocityTracker == null) velocityTracker = VelocityTracker.obtain()
    velocityTracker?.addMovement(ev)

    when (ev.actionMasked) {
      MotionEvent.ACTION_MOVE -> {
        if (!dragging) {
          val dy = ev.rawY - downY
          if (abs(dy) > touchSlop) dragging = true
        }
        if (dragging) {
          val dy = ev.rawY - downY
          val newY = (startTranslationY + dy).coerceIn(0f, maxTranslationY())
          translationY = newY
          emitSlide()
        }
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (dragging) {
          velocityTracker?.computeCurrentVelocity(1000)
          val velocityY = velocityTracker?.yVelocity ?: 0f
          val max = maxTranslationY()
          val progress = if (max <= 0f) 1f else 1f - (translationY / max)
          val target =
              when {
                velocityY < -1000f -> SheetState.EXPANDED
                velocityY > 1000f -> SheetState.COLLAPSED
                progress >= 0.5f -> SheetState.EXPANDED
                else -> SheetState.COLLAPSED
              }
          applyState(target, animate = true)
        }
        dragging = false
        velocityTracker?.recycle()
        velocityTracker = null
      }
    }
    return true
  }
}
