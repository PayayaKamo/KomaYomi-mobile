import React, { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

type Transform = { x: number; y: number; scale: number };

/**
 * Pan/pinch surface shared by the compare, original and panel views. The
 * transform is driven by Animated values updated synchronously in the gesture
 * callbacks, so the page follows the finger without waiting for a React
 * re-render.
 */
export function ZoomPanView({
  children,
  resetKey,
  panEnabled = true,
  onZoomChange,
  onScaleChange,
  onDoubleTap,
  onSingleTap,
}: {
  children: ReactNode;
  resetKey: string;
  panEnabled?: boolean;
  onZoomChange?: (zoomed: boolean) => void;
  /** Current scale, reported at two decimals so parents can show the ratio. */
  onScaleChange?: (scale: number) => void;
  /** Replaces the default double-tap-to-reset, e.g. to open the panel detail. */
  onDoubleTap?: () => void;
  /** Runs after a single tap; double-tap actions always take priority. */
  onSingleTap?: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const start = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const current = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const zoomedRef = useRef(false);
  const reportedScale = useRef(1);
  const doubleTapRef = useRef(onDoubleTap);
  const singleTapRef = useRef(onSingleTap);
  doubleTapRef.current = onDoubleTap;
  singleTapRef.current = onSingleTap;

  const reportZoom = (zoomed: boolean) => {
    if (zoomedRef.current === zoomed) return;
    zoomedRef.current = zoomed;
    onZoomChange?.(zoomed);
  };

  const reportScale = (next: number) => {
    const rounded = Math.round(next * 100) / 100;
    if (reportedScale.current === rounded) return;
    reportedScale.current = rounded;
    onScaleChange?.(rounded);
  };

  const apply = (next: Transform) => {
    current.current = next;
    translateX.setValue(next.x);
    translateY.setValue(next.y);
    scale.setValue(next.scale);
    reportZoom(next.scale > 1.01);
    reportScale(next.scale);
  };

  useEffect(() => {
    apply({ x: 0, y: 0, scale: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const pan = usePanGesture({
    enabled: panEnabled,
    minDistance: 4,
    maxPointers: 1,
    onBegin: () => {
      start.current = { ...current.current };
    },
    onUpdate: event => {
      apply({
        x: start.current.x + event.translationX,
        y: start.current.y + event.translationY,
        scale: current.current.scale,
      });
    },
  });

  const pinch = usePinchGesture({
    onBegin: () => {
      start.current = { ...current.current };
    },
    onUpdate: event => {
      apply({
        x: current.current.x,
        y: current.current.y,
        scale: Math.min(6, Math.max(1, start.current.scale * event.scale)),
      });
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      if (doubleTapRef.current) {
        doubleTapRef.current();
        return;
      }
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        current.current = { x: 0, y: 0, scale: 1 };
        reportZoom(false);
        reportScale(1);
      });
    },
  });

  const singleTap = useTapGesture({
    numberOfTaps: 1,
    onActivate: () => singleTapRef.current?.(),
  });
  const taps = useExclusiveGestures(doubleTap, singleTap);
  const transform = useSimultaneousGestures(pan, pinch);

  return (
    <GestureDetector gesture={transform}>
      <View style={styles.clip}>
        <GestureDetector gesture={taps}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX }, { translateY }, { scale }] },
            ]}
          >
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: { flex: 1, overflow: 'hidden' },
});
