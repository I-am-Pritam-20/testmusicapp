import React, {useMemo, useRef, useState} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';

export interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
  /** Fires the instant a touch lands on the bar (tap or the start of a
   *  drag) and again the instant it's released — the parent full-player
   *  sheet uses these to disable its own native drag-to-close gesture
   *  for the duration, since a slightly-off-horizontal seek drag would
   *  otherwise sometimes get misread as a sheet-dismiss swipe. */
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

export default function SeekBar({positionMs, durationMs, onSeek, onSeekStart, onSeekEnd}: SeekBarProps): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const trackWidthRef = useRef(0);
  const touchStartXRef = useRef(0);

  const committedRatio = durationMs > 0 ? positionMs / durationMs : 0;
  const ratio = dragRatio ?? committedRatio;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evt => {
          // Fires on the very first touch-down, before any drag distance
          // has accumulated — this is deliberately as early as possible
          // so the parent sheet's own gesture is disabled before there's
          // enough movement for it to consider claiming the touch itself.
          onSeekStart?.();
          const width = trackWidthRef.current;
          const x = evt.nativeEvent.locationX;
          touchStartXRef.current = x;
          if (width > 0) {
            setDragRatio(Math.max(0, Math.min(1, x / width)));
          }
        },
        onPanResponderMove: (_evt, gesture) => {
          const width = trackWidthRef.current;
          if (width === 0) return;
          const newRatio = (touchStartXRef.current + gesture.dx) / width;
          setDragRatio(Math.max(0, Math.min(1, newRatio)));
        },
        onPanResponderRelease: () => {
          setDragRatio(current => {
            if (current != null) onSeek(current * durationMs);
            return null;
          });
          onSeekEnd?.();
        },
        onPanResponderTerminate: () => {
          setDragRatio(null);
          onSeekEnd?.();
        },
      }),
    [durationMs, onSeek, onSeekStart, onSeekEnd],
  );

  return (
    <View
      style={styles.track}
      onLayout={e => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        setTrackWidth(e.nativeEvent.layout.width);
      }}
      {...panResponder.panHandlers}>
      <View style={styles.trackLine} />
      <View style={[styles.fill, {width: trackWidth * ratio}]} />
      <View style={[styles.thumb, {left: Math.max(0, trackWidth * ratio - 6)}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {height: 24, justifyContent: 'center'},
  trackLine: {
    height: 4,
    backgroundColor: '#ffffff33',
    borderRadius: 2,
  },
  fill: {
    height: 4,
    backgroundColor: '#fff',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
  },
});
