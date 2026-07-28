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
 * A self-contained, RN-agnostic sheet container that slides between
 * fully HIDDEN (translated off the bottom of the screen) and EXPANDED
 * (its configured height, from the bottom — the full screen by default,
 * or a fraction of it via expandedHeightFraction, so the exact same
 * native view serves the full player, Queue, Sleep Timer, the context
 * menu, and Create Playlist alike — one implementation, reused by
 * whatever RN children are passed in as content).
 *
 * Opening only ever happens via expand(), called from JS (tapping a
 * separately-rendered mini player, or a menu action). Closing can
 * happen either via hide()/collapse() from JS (a button/handle tap), OR
 * via a drag gesture while already EXPANDED — see the touch-handling
 * section below for how that's scoped to avoid interfering with normal
 * taps and the seek bar's horizontal drag.
 *
 * clipChildren/clipToPadding are disabled: Android ViewGroups clip
 * children to their bounds by default (unlike React Native's own view
 * classes, which don't), which silently breaks things like RN's `boxShadow`
 * style on nested content whenever their shadow extends past its own
 * bounds — that only shows up once content lives inside a raw native
 * ViewGroup like this one.
 */
class NativeBottomSheetView(context: Context, attrs: AttributeSet? = null) :
    FrameLayout(context, attrs) {

  enum class SheetState { HIDDEN, EXPANDED }

  var onStateChange: ((SheetState) -> Unit)? = null
  /** Fraction (0-1] of the view's own height that counts as "expanded" —
   *  1f (default) means full screen, like the original full-player-only
   *  behavior. 0.45f means the sheet only rises 45% of the way up,
   *  leaving the rest as backdrop over the screen behind it. */
  var expandedHeightFraction: Float = 1f
    private set

  fun setExpandedHeightFraction(fraction: Float) {
    if (fraction == expandedHeightFraction) return
    expandedHeightFraction = fraction
    if (laidOut && state == SheetState.EXPANDED) {
      animateTo(expandedTranslationY(), SheetState.EXPANDED)
    }
  }

  /** When a sheet contains its own scrollable content (the queue list),
   *  JS disables this while that content isn't scrolled to the top —
   *  otherwise a downward drag partway through the list is ambiguous
   *  between "scroll the list up" and "drag the sheet closed", and
   *  Android's touch dispatch would let this view win that race before
   *  the nested list ever gets a chance to claim it for itself. Sheets
   *  with no meaningful internal scrolling just leave this true always. */
  var dismissGestureEnabled: Boolean = true

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
  // Kept for API compatibility with call sites written as "collapse" —
  // this sheet has no separate collapsed/peek state, so it just hides.
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

  /** Where translationY sits when fully expanded — 0 (top of this view)
   *  for the full-height default, or partway down for a shorter sheet. */
  private fun expandedTranslationY(): Float = height.toFloat() * (1f - expandedHeightFraction)

  private fun targetTranslationFor(target: SheetState): Float =
      if (target == SheetState.EXPANDED) expandedTranslationY() else height.toFloat()

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
  // Only active while EXPANDED. Only claims the gesture once a MOVE is
  // clearly vertical AND downward (dy > touchSlop && dy > abs(dx)) — a
  // plain tap never accumulates enough dy to trigger this, and the seek
  // bar's horizontal drag never satisfies dy > abs(dx). This is what lets
  // buttons and the seek bar keep working normally while still allowing a
  // swipe-down-to-close gesture from anywhere else on the sheet.

  override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
    if (state != SheetState.EXPANDED || !dismissGestureEnabled) return false
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

    val expandedY = expandedTranslationY()

    when (ev.actionMasked) {
      MotionEvent.ACTION_MOVE -> {
        if (!dragging) {
          val dy = ev.rawY - downY
          if (dy > touchSlop) dragging = true
        }
        if (dragging) {
          val dy = ev.rawY - downY
          translationY = (startTranslationY + dy).coerceIn(expandedY, height.toFloat())
        }
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        if (dragging) {
          velocityTracker?.computeCurrentVelocity(1000)
          val velocityY = velocityTracker?.yVelocity ?: 0f
          val sheetOwnHeight = (height.toFloat() - expandedY).coerceAtLeast(1f)
          val progress = (translationY - expandedY) / sheetOwnHeight
          // Lowered thresholds: a quick, small flick should close it, not
          // require a large drag distance.
          val target = if (velocityY > 400f || progress > 0.2f) SheetState.HIDDEN else SheetState.EXPANDED
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
