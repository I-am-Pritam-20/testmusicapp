import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';
import { Double } from 'react-native/Libraries/Types/CodegenTypes';

export interface Spec extends TurboModule {
  /** Action string of the Intent that launched MainActivity, or null for a
   *  normal launch — used to detect a widget-triggered cold start
   *  (ACTION_WIDGET_PLAY) so playback can auto-resume immediately. */
  getInitialAction(): Promise<string | null>;

  /** Any field omitted keeps its previously-pushed value — callers only
   *  need to send what changed. artworkPath accepts a data: URI (written
   *  to a stable local cache file by the native side) or an existing
   *  local file:// path; a remote https URL won't resolve to a bitmap
   *  here, so don't pass one — see WidgetBridge.ts. */
  updateWidget(params: Object): void;
  updateWidgetSettings(params: Object): void;

  startListeningToWidgetActions(): void;
  stopListeningToWidgetActions(): void;

  addListener(eventName: string): void;
  removeListeners(count: Double): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('InoWidgetBridge');
