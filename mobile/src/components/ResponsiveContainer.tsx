import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useDeviceClass } from '../hooks/useDeviceClass';

interface ResponsiveContainerProps {
  children: ReactNode;
  maxWidth?: number;
  style?: ViewStyle;
}

/**
 * Caps content at a readable max width and centers it on tablet, where the phone
 * layouts this app was built for would otherwise stretch full-bleed edge to edge
 * (giant full-width text inputs, cards, etc.) — the single most common "this doesn't
 * feel like an iPad app" symptom. A no-op passthrough on phone (never mounts the
 * wrapping Views), so it can't change phone behavior even by a pixel.
 */
export function ResponsiveContainer({ children, maxWidth = 720, style }: ResponsiveContainerProps) {
  const { isTablet } = useDeviceClass();

  if (!isTablet) {
    return <>{children}</>;
  }

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center' },
  inner: { width: '100%' },
});
