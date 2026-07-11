import { useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { authenticatedImageSource } from '../services/api';

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  height?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Drag-to-compare slider: "after" image sits full-bleed underneath, "before" image
 * sits on top clipped to a draggable width. Built on core Animated + PanResponder
 * (no native gesture library) since this environment has no iOS Simulator to verify
 * a native-linked dependency against.
 */
export function BeforeAfterSlider({ beforeUri, afterUri, height = 280 }: BeforeAfterSliderProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const clipWidth = useRef(new Animated.Value(0)).current;
  const containerWidthRef = useRef(0);
  const clipWidthRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const initializedRef = useRef(false);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    containerWidthRef.current = width;
    setContainerWidth(width);
    if (!initializedRef.current && width > 0) {
      initializedRef.current = true;
      const half = width / 2;
      clipWidthRef.current = half;
      clipWidth.setValue(half);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartWidthRef.current = clipWidthRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const next = clamp(dragStartWidthRef.current + gestureState.dx, 0, containerWidthRef.current);
        clipWidthRef.current = next;
        clipWidth.setValue(next);
      },
    }),
  ).current;

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {containerWidth > 0 && (
        <>
          <Image
            source={authenticatedImageSource(afterUri)}
            style={{ width: containerWidth, height }}
            resizeMode="cover"
          />
          <Animated.View style={[styles.beforeClip, { width: clipWidth, height }]}>
            <Image
              source={authenticatedImageSource(beforeUri)}
              style={{ width: containerWidth, height }}
              resizeMode="cover"
            />
          </Animated.View>
          <View style={styles.labelRow} pointerEvents="none">
            <Text style={styles.label}>BEFORE</Text>
            <Text style={styles.label}>AFTER</Text>
          </View>
          <Animated.View
            style={[styles.handle, { left: Animated.subtract(clipWidth, 20) }]}
            {...panResponder.panHandlers}>
            <View style={styles.handleKnob}>
              <Text style={styles.handleArrows}>{'<>'}</Text>
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  beforeClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  labelRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  label: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  handle: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleKnob: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  handleArrows: { color: colors.text, fontWeight: '800', fontSize: 12 },
});
