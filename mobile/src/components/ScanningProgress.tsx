import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

// Purely cosmetic pacing, not real progress events — analyzeEye() is a single
// request/response, so there's no actual per-stage progress to report. Cycling
// through these keeps the wait from feeling like a frozen spinner.
const STAGES = [
  'Detecting eye shape…',
  'Measuring lash density…',
  'Checking symmetry…',
  'Consulting the lash rules engine…',
  'Almost there…',
];

const STAGE_INTERVAL_MS = 1600;

export function ScanningProgress() {
  const [stageIndex, setStageIndex] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.icon, { transform: [{ rotate }] }]}>👁️</Animated.Text>
      <Text style={styles.stageText}>{STAGES[stageIndex]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  stageText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
