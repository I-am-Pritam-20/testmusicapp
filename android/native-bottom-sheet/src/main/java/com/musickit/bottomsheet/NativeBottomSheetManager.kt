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
 * without a generated ViewManagerDelegate).
 *
 * NOTE: `receiveCommand(root, commandId: String, args)` is the modern
 * Fabric-era signature; if your RN version's ViewManager base class still
 * expects `commandId: Int`, switch to the older int-based
 * receiveCommand/getCommandsMap() pair.
 */
class NativeBottomSheetManager : ViewGroupManager<NativeBottomSheetView>() {

  override fun getName(): String = "NativeBottomSheetView"

  override fun createViewInstance(reactContext: ThemedReactContext): NativeBottomSheetView {
    val view = NativeBottomSheetView(reactContext)
    view.onStateChange = { state ->
      val event = Arguments.createMap().apply { putString("state", state.name.lowercase()) }
      reactContext.getJSModule(RCTEventEmitter::class.java).receiveEvent(view.id, "onSheetStateChange", event)
    }
    return view
  }

  @ReactProp(name = "initialState")
  fun setInitialState(view: NativeBottomSheetView, initialState: String?) {
    view.setInitialState(initialState ?: "hidden")
  }

  override fun receiveCommand(root: NativeBottomSheetView, commandId: String, args: ReadableArray?) {
    when (commandId) {
      "expand" -> root.expand()
      "collapse" -> root.collapse()
      "hide" -> root.hide()
      "snapTo" -> root.snapTo(args?.getString(0) ?: "hidden")
    }
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
      MapBuilder.of("onSheetStateChange", MapBuilder.of("registrationName", "onSheetStateChange"))
}
