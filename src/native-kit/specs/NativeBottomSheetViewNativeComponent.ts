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