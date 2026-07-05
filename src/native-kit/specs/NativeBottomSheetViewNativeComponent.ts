/**
 * Fabric component spec for the native draggable bottom sheet container
 * (android/native-bottom-sheet). This is a generic, RN-agnostic-on-the-
 * native-side sheet — it just hosts whatever RN children you give it and
 * handles the vertical drag/fling/snap animation entirely natively, so the
 * "slide" motion never depends on the JS thread. It has no music-specific
 * logic at all, and can be reused for any other bottom-sheet UI.
 *
 * Commands (expand/collapse/hide) are dispatched from
 * src/native-kit/NativeBottomSheet.tsx via
 * UIManager.dispatchViewManagerCommand(node, commandName, args) rather than
 * codegenNativeCommands, since this project is Fabric-only (newArchEnabled)
 * and dispatch-by-name works directly against the native
 * receiveCommand(view, commandId: String, args) override — see that file's
 * comment if you ever need old-architecture (bridge) support too.
 */
import type {HostComponent, ViewProps} from 'react-native';
import type {DirectEventHandler, Double, Int32, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export type SheetState = 'collapsed' | 'expanded' | 'hidden' | 'dragging';

export interface SheetStateChangeEvent {
  state: string;
}

export interface SheetSlideEvent {
  progress: Double; // 0 = fully collapsed, 1 = fully expanded
}

export interface NativeProps extends ViewProps {
  // dp height of the "peek" area visible when collapsed (e.g. mini player bar height)
  collapsedHeight: Int32;
  initialState?: WithDefault<string, 'collapsed'>;
  onSheetStateChange?: DirectEventHandler<SheetStateChangeEvent>;
  onSlide?: DirectEventHandler<SheetSlideEvent>;
}

export type NativeBottomSheetViewType = HostComponent<NativeProps>;

export default codegenNativeComponent<NativeProps>(
  'NativeBottomSheetView',
) as NativeBottomSheetViewType;
