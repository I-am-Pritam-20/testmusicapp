import React, {useCallback, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';

export interface SeekBarProps {
  positionMs: number;
  durationMs: number;
  onSeek: (positionMs: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
}

/**
 * Built on react-native-gesture-handler rather than the legacy
 * PanResponder — PanResponder's locationX/dx reporting has known
 * inconsistencies under Fabric (New Architecture) that made dragging
 * left (negative x) unreliable here; Gesture.Pan()'s event.x is the
 * touch position directly in the view's own coordinate space on every
 * single event, with no delta-reconstruction math needed at all.
 */
export default function SeekBar({positionMs, durationMs, onSeek, onSeekStart, onSeekEnd}: SeekBarProps): React.JSX.Element {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  const trackWidthRef = useRef(0);
  const durationRef = useRef(durationMs);
  durationRef.current = durationMs;

  const committedRatio = durationMs > 0 ? positionMs / durationMs : 0;
  const ratio = dragRatio ?? committedRatio;

  const updateFromX = useCallback((x: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    setDragRatio(Math.max(0, Math.min(1, x / width)));
  }, []);

  const pan = Gesture.Pan()
    .onBegin(event => {
      onSeekStart?.();
      updateFromX(event.x);
    })
    .onUpdate(event => {
      updateFromX(event.x);
    })
    .onEnd(() => {
      setDragRatio(current => {
        if (current != null) onSeek(current * durationRef.current);
        return null;
      });
      onSeekEnd?.();
    })
    .onFinalize(() => {
      onSeekEnd?.();
    })
    .minDistance(0);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.track}
        onLayout={e => {
          trackWidthRef.current = e.nativeEvent.layout.width;
          setTrackWidth(e.nativeEvent.layout.width);
        }}>
        <View style={styles.trackLine} />
        <View style={[styles.fill, {width: trackWidth * ratio}]} />
        <View style={[styles.thumb, {left: Math.max(0, trackWidth * ratio - 6)}]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {height: 24, justifyContent: 'center'},
  trackLine: {height: 4, backgroundColor: '#ffffff33', borderRadius: 2},
  fill: {height: 4, backgroundColor: '#fff', borderRadius: 2, position: 'absolute', left: 0},
  thumb: {position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff'},
});
