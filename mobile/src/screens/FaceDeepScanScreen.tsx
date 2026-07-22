import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Contours, Face, useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { api } from '../services/api';
import { computeFaceMetrics } from '../utils/faceMetrics';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'FaceDeepScan'>;

type ContourKey = keyof Contours;

// Each entry draws as its own colored region, and the legend below uses the same
// colors/labels — one source of truth for both.
const CONTOUR_GROUPS: { keys: ContourKey[]; color: string; label: string; closed: boolean }[] = [
  { keys: ['FACE'], color: 'rgba(201,164,92,0.9)', label: 'Face outline', closed: true },
  { keys: ['LEFT_EYEBROW_TOP', 'LEFT_EYEBROW_BOTTOM', 'RIGHT_EYEBROW_TOP', 'RIGHT_EYEBROW_BOTTOM'], color: 'rgba(217,143,175,0.95)', label: 'Brows', closed: false },
  { keys: ['LEFT_EYE', 'RIGHT_EYE'], color: 'rgba(255,255,255,0.95)', label: 'Eyes', closed: true },
  { keys: ['NOSE_BRIDGE', 'NOSE_BOTTOM'], color: 'rgba(180,210,255,0.85)', label: 'Nose', closed: false },
  { keys: ['UPPER_LIP_TOP', 'UPPER_LIP_BOTTOM', 'LOWER_LIP_TOP', 'LOWER_LIP_BOTTOM'], color: 'rgba(255,180,180,0.85)', label: 'Lips', closed: false },
  { keys: ['LEFT_CHEEK', 'RIGHT_CHEEK'], color: 'rgba(170,255,200,0.7)', label: 'Cheeks', closed: false },
];

// See utils/faceMetrics.ts for the actual math (kept there, not here, so it's
// verifiable with plain Jest tests — no camera or device needed).
function computeMetrics(face: Face) {
  const leftEyeContour = face.contours?.LEFT_EYE;
  const rightEyeContour = face.contours?.RIGHT_EYE;
  if (!leftEyeContour || !rightEyeContour) return null;
  return computeFaceMetrics({
    leftEyeContour,
    rightEyeContour,
    rollAngleDeg: face.rollAngle,
    leftEyeOpenProbability: face.leftEyeOpenProbability,
    rightEyeOpenProbability: face.rightEyeOpenProbability,
  });
}

/**
 * Face Deep Scan (Pro tier) — its own category, distinct from AR Lash Preview
 * (eye-contour-only, styled for a lash placement preview) and from the trained AI Eye
 * Analysis in the core client loop (a photo sent to the server for a real vision-model
 * classification). This screen draws every facial region ML Kit's on-device detector
 * tracks — face outline, brows, eyes, nose, lips, cheeks — live, in real time, and
 * surfaces a handful of honestly-derived geometric measurements (eye symmetry, eye
 * spacing, levelness) as a consultation tool: something to show a client while talking
 * through their features, not a diagnosis.
 *
 * Deliberately does not attempt to classify eye shape (round/almond/hooded/monolid/
 * etc.) from this live 2D geometry — that classification already exists, done
 * properly, by a trained vision model server-side (ai.service.ts's eye-analysis,
 * reached via a client's "Photograph Eye" flow) using real training data, not a
 * hand-rolled on-device heuristic. Overclaiming that distinction here would mean a
 * lash artist could get a wrong classification for a real client. "Run Full AI Eye
 * Analysis" below routes to that existing, tested pipeline instead of duplicating it.
 *
 * Verification status: like ARLashPreviewScreen, this could not be visually verified
 * end-to-end in this dev environment — no physical camera available. Typecheck/lint
 * are clean and it follows the same native-dependency pattern already proven to work
 * for the live camera + face detector elsewhere in this app; a TestFlight/real-device
 * pass is the real verification point.
 */
export function FaceDeepScanScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  // Back camera, matching AR Lash Preview's convention — the artist points the device
  // at the client (a professional consultation stance), not a front-facing selfie view.
  const device = useCameraDevice('back');
  const [faces, setFaces] = useState<Face[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!hasPermission) {
        requestPermission();
      }
    }, [hasPermission, requestPermission]),
  );

  // Re-checks on every focus, not just mount — a user who hits the Pro lock,
  // upgrades on Paywall (pushed on top of this still-mounted screen), and backs out
  // needs the lock to lift immediately rather than showing stale "free" state.
  useFocusEffect(
    useCallback(() => {
      setCheckingPlan(true);
      api
        .get<{ plan: string }>('/users/me/usage')
        .then((result) => setPlan(result.plan))
        .catch(() => setPlan('free'))
        .finally(() => setCheckingPlan(false));
    }, []),
  );

  const scannerOutput = useFaceDetectorOutput({
    runContours: true,
    runLandmarks: true,
    runClassifications: true,
    autoMode: true,
    windowWidth: width,
    windowHeight: height,
    cameraFacing: 'back',
    onFacesDetected: (scannedFaces) => setFaces(scannedFaces),
    onError: () => setFaces([]),
  });

  if (checkingPlan) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (plan === 'free') {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Face Deep Scan is a Pro feature</Text>
        <Text style={styles.lockedText}>
          Point your device at a client and see every facial region tracked live —
          face shape, brows, eyes, nose, and lips — with real-time symmetry and spacing
          measurements. A consultation tool to walk clients through their own features.
        </Text>
        <TouchableOpacity style={styles.upgradeButton} onPress={() => navigation.navigate('Paywall')}>
          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Camera access needed</Text>
        <Text style={styles.lockedText}>Face Deep Scan needs your camera to track the client's face live.</Text>
        <TouchableOpacity style={styles.upgradeButton} onPress={requestPermission}>
          <Text style={styles.upgradeButtonText}>Allow Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>No camera available</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const face = faces[0];
  const metrics = face ? computeMetrics(face) : null;

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[scannerOutput]} />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        {faces.flatMap((f, faceIndex) =>
          CONTOUR_GROUPS.flatMap((group) =>
            group.keys.map((key) => {
              const points = f.contours?.[key];
              if (!points || points.length < 2) return null;
              const coords = points.map((p) => `${p.x},${p.y}`).join(' ');
              const elementKey = `${faceIndex}-${key}`;
              return group.closed ? (
                <Polygon key={elementKey} points={coords} fill="none" stroke={group.color} strokeWidth={2} />
              ) : (
                <Polyline key={elementKey} points={coords} fill="none" stroke={group.color} strokeWidth={2} />
              );
            }),
          ),
        )}
        {faces.flatMap((f, faceIndex) => {
          const landmarks = f.landmarks;
          if (!landmarks) return [];
          return Object.entries(landmarks)
            .filter((entry): entry is [string, { x: number; y: number }] => Boolean(entry[1]))
            .map(([key, point]) => (
              <Circle key={`${faceIndex}-landmark-${key}`} cx={point.x} cy={point.y} r={3} fill="rgba(255,255,255,0.9)" />
            ));
        })}
      </Svg>

      <View style={styles.betaBadge}>
        <Text style={styles.betaBadgeText}>Face Deep Scan · Beta</Text>
      </View>

      <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
        <Text style={styles.exitButtonText}>✕ Exit</Text>
      </TouchableOpacity>

      {faces.length === 0 && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>Point the device at a face to begin scanning.</Text>
        </View>
      )}

      {metrics && (
        <View style={styles.statsPanel}>
          <View style={styles.legendRow}>
            {CONTOUR_GROUPS.map((group) => (
              <View key={group.label} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: group.color }]} />
                <Text style={styles.legendText}>{group.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricValue}>{metrics.eyeSymmetryPct}%</Text>
              <Text style={styles.metricLabel}>Eye symmetry (est.)</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricValue}>{metrics.eyeSpacingLabel}</Text>
              <Text style={styles.metricLabel}>Eye spacing (est.)</Text>
            </View>
            <View style={styles.metricCell}>
              <Text style={styles.metricValue}>{metrics.levelness}</Text>
              <Text style={styles.metricLabel}>Head level</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.analysisButton} onPress={() => navigation.navigate('ClientList')}>
            <Text style={styles.analysisButtonText}>Run Full AI Eye Analysis for a Client →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  lockedTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lockedText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 19,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  upgradeButtonText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  backLink: { marginTop: 16, padding: 8 },
  backLinkText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  exitButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  exitButtonText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  betaBadge: {
    position: 'absolute',
    top: 56,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  betaBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  hintBanner: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 14,
  },
  hintText: { color: colors.background, fontSize: 13, textAlign: 'center' },
  statsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 28,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metricCell: { alignItems: 'center', flex: 1 },
  metricValue: { color: colors.background, fontSize: 18, fontWeight: '800', textTransform: 'capitalize' },
  metricLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    marginTop: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  analysisButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  analysisButtonText: { color: colors.background, fontWeight: '700', fontSize: 13 },
});
