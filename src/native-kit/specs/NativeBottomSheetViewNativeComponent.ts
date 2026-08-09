/**
 * Fabric component spec for the native sheet container
 * (android/native-bottom-sheet) — one reusable implementation for every
 * sheet in the app (full player, Queue, Sleep Timer, context menu,
 * Create Playlist), each passing its own RN content as children.
 * Slides between fully hidden (off the bottom of the screen) and
 * expanded, where "expanded" is either the full screen (default,
 * expandedHeightFraction=1) or a shorter panel
 * (expandedHeightFraction<1) with a drag-to-close gesture built in.
 * Opening happens via commands dispatched from JS
 * (src/native-kit/NativeBottomSheet.tsx), typically triggered by a tap
 * on a mini player or a menu action; it has no music-specific logic.
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
  /** 0.1-1 — how much of the screen height counts as "expanded". 1
   *  (default) is full screen; e.g. 0.5 leaves the top half as backdrop. */
  expandedHeightFraction?: WithDefault<number, 1.0>;
  onSheetStateChange?: DirectEventHandler<SheetStateChangeEvent>;
}

export type NativeBottomSheetViewType = HostComponent<NativeProps>;

export default codegenNativeComponent<NativeProps>(
  'NativeBottomSheetView',
) as NativeBottomSheetViewType;
