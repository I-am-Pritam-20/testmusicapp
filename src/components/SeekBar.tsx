import React, {useMemo, useRef, useState} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';

export interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
}

/**
 * Plain custom seek bar (View + PanResponder) — no external slider
 * dependency, matching the "build core interaction pieces from scratch"
 * approach used elsewhere.
 */
export default function SeekBar({positionMs, durationMs, onSeek}: SeekBarProps): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const trackWidthRef = useRef(0);
  const dragStartRatioRef = useRef(0);

  const committedRatio = durationMs > 0 ? positionMs / durationMs : 0;
  const ratio = dragRatio ?? committedRatio;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStartRatioRef.current = committedRatio;
        },
        onPanResponderMove: (_evt, gesture) => {
          if (trackWidthRef.current === 0) return;
          const newRatio = dragStartRatioRef.current + gesture.dx / trackWidthRef.current;
          setDragRatio(Math.max(0, Math.min(1, newRatio)));
        },
        onPanResponderRelease: () => {
          setDragRatio(current => {
            if (current != null) onSeek(current * durationMs);
            return null;
          });
        },
        onPanResponderTerminate: () => setDragRatio(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [durationMs, onSeek],
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
