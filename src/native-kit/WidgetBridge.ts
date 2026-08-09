import {NativeEventEmitter} from 'react-native';
import NativeInoWidgetBridge from './specs/NativeInoWidgetBridge';

export type WidgetRepeatMode = 'off' | 'one' | 'all';

export interface WidgetUpdateParams {
  title?: string;
  artist?: string;
  /** Only pass a data: URI or an existing local file:// path — the
   *  native side decodes this into a bitmap directly, and a remote
   *  https URL simply won't resolve to one (widgets can't do their own
   *  async network image loads). For a streamed track whose artwork is
   *  still just a remote URL, omit this field entirely rather than
   *  passing the URL — the widget keeps its previous artwork/falls back
   *  to the app's accent color, which reads as "no art yet", not broken. */
  artworkPath?: string;
  isPlaying?: boolean;
  isShuffle?: boolean;
  repeatMode?: WidgetRepeatMode;
  /** 0-1 */
  progress?: number;
  durationSec?: number;
}

export type WidgetEvent =
  | 'widgetPlayPause'
  | 'widgetSkipNext'
  | 'widgetSkipPrev'
  | 'widgetShuffleToggle'
  | 'widgetRepeatCycle'
  | 'widgetRemoved';

function isLocalArtwork(path: string | undefined): path is string {
  return !!path && (path.startsWith('data:') || path.startsWith('file://'));
}

/**
 * Thin wrapper around InoWidgetBridge (android/app/.../widget) — the home
 * screen "now playing" widget, ported from inotuneoffline. Native does the
 * actual rendering/dominant-color extraction; this only pushes state and
 * relays the widget's own button taps back as events.
 */
class WidgetBridge {
  private emitter = new NativeEventEmitter(NativeInoWidgetBridge as never);
  private listening = false;

  async getInitialAction(): Promise<string | null> {
    return NativeInoWidgetBridge.getInitialAction();
  }

  /** Silently drops artworkPath if it isn't in a format the native side
   *  can actually decode (see the field's own doc comment) rather than
   *  passing something that would just fail — every other field still
   *  goes through untouched. */
  update(params: WidgetUpdateParams): void {
    const safeParams: WidgetUpdateParams = isLocalArtwork(params.artworkPath)
      ? params
      : {...params, artworkPath: undefined};
    NativeInoWidgetBridge.updateWidget(safeParams as unknown as Object);
  }

  updateSettings(params: {bgStyle?: string}): void {
    NativeInoWidgetBridge.updateWidgetSettings(params as unknown as Object);
  }

  /** Call once, when the app starts — no-op if already listening. */
  startListening(): void {
    if (this.listening) return;
    this.listening = true;
    NativeInoWidgetBridge.startListeningToWidgetActions();
  }

  stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    NativeInoWidgetBridge.stopListeningToWidgetActions();
  }

  subscribe(event: WidgetEvent, listener: () => void): () => void {
    const subscription = this.emitter.addListener(event, listener);
    return () => subscription.remove();
  }
}

export default new WidgetBridge();
