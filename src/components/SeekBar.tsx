import React, {useMemo, useRef, useState} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';

export interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
}

export default function SeekBar({positionMs, durationMs, onSeek}: SeekBarProps): React.JSX.Element {
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
        },
        onPanResponderTerminate: () => setDragRatio(null),
      }),
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