/**
 * Fabric component spec for the native full-player sheet container
 * (android/native-bottom-sheet). This only ever slides between fully
 * hidden (off the bottom of the screen) and fully expanded (covering the
 * whole screen) — there is no drag gesture and no partial/peek state.
 * Opening/closing happens purely via commands dispatched from JS
 * (src/native-kit/NativeBottomSheet.tsx), typically triggered by a tap on
 * a separately-rendered, always-visible mini player that sits underneath
 * this view in z-order. It has no music-specific logic and can be reused
 * for any other "slide a screen up over everything" UI.
 *
 * Commands (expand/collapse/hide) are dispatched via
 * UIManager.dispatchViewManagerCommand(node, commandName, args) rather
 * than codegenNativeCommands, since this project is Fabric-only
 * (newArchEnabled) and dispatch-by-name works directly against the
 * native receiveCommand(view, commandId: String, args) override.
 */
import type {HostComponent, ViewProps} from 'react-native';
import type {DirectEventHandler, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export type SheetState = 'hidden' | 'expanded';

export interface SheetStateChangeEvent {
  state: string;
}

export interface NativeProps extends ViewProps {
  initialState?: WithDefault<string, 'hidden'>;
  onSheetStateChange?: DirectEventHandler<SheetStateChangeEvent>;
}

export type NativeBottomSheetViewType = HostComponent<NativeProps>;

export default codegenNativeComponent<NativeProps>(
  'NativeBottomSheetView',
) as NativeBottomSheetViewType;
