package com.musickit.bottomsheet

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * Fabric ViewGroupManager for <NativeBottomSheetView />. Uses @ReactProp
 * and a String-keyed receiveCommand override (both fine under Fabric
 * without a generated ViewManagerDelegate) rather than codegen — see the
 * comment in the .ts spec for why commands are dispatched by name.
 *
 * NOTE: `receiveCommand(root, commandId: String, args)` is the modern
 * Fabric-era signature. If your RN version's ViewManager base class still
 * expects `commandId: Int` (pre-New-Architecture-only projects), switch
 * this back to the older int-based `receiveCommand`/`getCommandsMap()`
 * pair — worth a quick check against your installed react-native version.
 */
class NativeBottomSheetManager : ViewGroupManager<NativeBottomSheetView>() {

  override fun getName(): String = "NativeBottomSheetView"

  override fun createViewInstance(reactContext: ThemedReactContext): NativeBottomSheetView {
    val view = NativeBottomSheetView(reactContext)

    view.onStateChange = { state ->
      val event = Arguments.createMap().apply { putString("state", state.name.lowercase()) }
      reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(view.id, "onSheetStateChange", event)
    }
    view.onSlide = { progress ->
      val event = Arguments.createMap().apply { putDouble("progress", progress.toDouble()) }
      reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(view.id, "onSlide", event)
    }

    return view
  }

  @ReactProp(name = "collapsedHeight")
  fun setCollapsedHeight(view: NativeBottomSheetView, collapsedHeight: Float) {
    val density = view.resources.displayMetrics.density
    view.collapsedHeightPx = (collapsedHeight * density).toInt()
  }

  @ReactProp(name = "initialState")
  fun setInitialState(view: NativeBottomSheetView, initialState: String?) {
    view.setInitialState(initialState ?: "collapsed")
  }

  override fun receiveCommand(root: NativeBottomSheetView, commandId: String, args: ReadableArray?) {
    when (commandId) {
      "expand" -> root.expand()
      "collapse" -> root.collapse()
      "hide" -> root.hide()
      "snapTo" -> root.snapTo(args?.getString(0) ?: "collapsed")
    }
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
      MapBuilder.of(
          "onSheetStateChange",
          MapBuilder.of("registrationName", "onSheetStateChange"),
          "onSlide",
          MapBuilder.of("registrationName", "onSlide"),
      )
}
