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


class NativeBottomSheetView(context: Context, attrs: AttributeSet? = null) :
    FrameLayout(context, attrs) {

  enum class SheetState { HIDDEN, EXPANDED }

  var onStateChange: ((SheetState) -> Unit)? = null

  private var state: SheetState = SheetState.HIDDEN
  private var pendingCommand: SheetState = SheetState.HIDDEN
  private var laidOut = false
  private var animator: ValueAnimator? = null

  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var velocityTracker: VelocityTracker? = null
  private var downX = 0f
  private var downY = 0f
  private var startTranslationY = 0f
  private var dragging = false

  init {
    clipChildren = false
    clipToPadding = false
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (!laidOut && h > 0) {
      laidOut = true
      applyState(pendingCommand, animate = false)
    }
  }

  fun setInitialState(stateName: String) {
    val target = parseState(stateName)
    pendingCommand = target
    if (laidOut) applyState(target, animate = false)
  }

  fun expand() = requestState(SheetState.EXPANDED)
  fun hide() = requestState(SheetState.HIDDEN)
  fun collapse() = hide()
  fun snapTo(stateName: String) = requestState(parseState(stateName))

  private fun requestState(target: SheetState) {
    if (!laidOut) {
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

  // --- Drag-to-close only --------------------------------------------

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    if (state != SheetState.EXPANDED) return false
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
        if (!dragging && dy > touchSlop && dy > abs(dx)) {
          dragging = true
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
          if (dy > touchSlop) dragging = true
        }
        if (dragging) {
          val dy = ev.rawY - downY
          translationY = (startTranslationY + dy).coerceIn(0f, height.toFloat())
        }
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (dragging) {
          velocityTracker?.computeCurrentVelocity(1000)
          val velocityY = velocityTracker?.yVelocity ?: 0f
          val progress = if (height > 0) translationY / height else 0f
          val target = if (velocityY > 1000f || progress > 0.4f) SheetState.HIDDEN else SheetState.EXPANDED
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