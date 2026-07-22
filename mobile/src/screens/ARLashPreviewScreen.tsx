import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { Face, useFaceDetectorOutput } from 'react-native-vision-camera-face-detector';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ARLashPreview'>;

const TICK_LENGTH = 18;

// Draws a fringe of short outward-radiating strokes around an eye contour — the same
// "fan of strokes" visual language as LashMapZoneDiagram, adapted to a live, moving
// contour instead of a fixed 5-zone diagram. Not a photorealistic per-lash-set render
// (see screen doc comment) — a stylized live indicator that the eye is being tracked
// and where a finished set would sit.
function EyeOverlay({ contour, color }: { contour: { x: number; y: number }[]; color: string }) {
  if (contour.length < 3) return null;

  const cx = contour.reduce((sum, p) => sum + p.x, 0) / contour.length;
  const cy = contour.reduce((sum, p) => sum + p.y, 0) / contour.length;

  return (
    <>
      <Polygon
        points={contour.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      {contour
        .filter((_, i) => i % 2 === 0)
        .map((p, i) => {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const length = Math.sqrt(dx * dx + dy * dy) || 1;
          const tipX = p.x + (dx / length) * TICK_LENGTH;
          const tipY = p.y + (dy / length) * TICK_LENGTH;
          return <Line key={i} x1={p.x} y1={p.y} x2={tipX} y2={tipY} stroke={color} strokeWidth={2} />;
        })}
    </>
  );
}

/**
 * Live "AR-style" lash preview (Pro tier, EXPERIMENTAL). Detects the client's eye
 * contour in real time via on-device ML Kit face detection
 * (react-native-vision-camera-face-detector, itself built on react-native-vision-camera) and
 * overlays a stylized lash-fringe graphic that tracks the eye as the device moves —
 * a live 2D overlay, not a true ARKit 3D face mesh.
 *
 * Why not ARKit: full ARKit face-anchor tracking requires a TrueDepth front camera and
 * would only make sense pointed at the artist's own face, not the client's — the
 * existing AI after-look preview (lash-preview route) already covers the photorealistic
 * "client's actual eye" case. This live overlay is the genuinely-real-time complement to
 * that: point the device at the client mid-consultation and see lash placement tracked
 * live, no photo capture needed.
 *
 * Verification status: unlike every other feature in this build, this one could not be
 * visually verified end-to-end in this dev environment — ARKit-adjacent camera/ML
 * pipelines of this kind are only meaningfully testable on a real physical device with
 * a real camera pointed at a real face. Typecheck/lint/build are clean and the same
 * native-dependency-install pattern that worked for voice logging was followed, but a
 * TestFlight/real-device pass is the real verification point for this screen.
 */
export function ARLashPreviewScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [faces, setFaces] = useState<Face[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [checkingPlan, setCheckingPlan] = useState(true);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Re-checks on every focus, not just mount — a user who hits the Pro lock below,
  // upgrades on Paywall (pushed on top of this still-mounted screen), and backs out
  // needs the lock to lift immediately rather than showing stale "free" state until a
  // full remount.
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
        <Text style={styles.lockedTitle}>AR Lash Preview is a Pro feature</Text>
        <Text style={styles.lockedText}>
          Point your device at a client and see lash placement tracked live, before any
          extensions go on.
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
        <Text style={styles.lockedText}>
          AR Lash Preview needs your camera to track the client's eye live.
        </Text>
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

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive outputs={[scannerOutput]} />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        {faces.flatMap((face, faceIndex) => {
          const contours = face.contours;
          if (!contours) return [];
          return [
            contours.LEFT_EYE && (
              <EyeOverlay key={`${faceIndex}-left`} contour={contours.LEFT_EYE} color={colors.accent} />
            ),
            contours.RIGHT_EYE && (
              <EyeOverlay key={`${faceIndex}-right`} contour={contours.RIGHT_EYE} color={colors.accent} />
            ),
          ].filter(Boolean);
        })}
      </Svg>

      <View style={styles.betaBadge}>
        <Text style={styles.betaBadgeText}>AR Preview · Beta</Text>
      </View>

      <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
        <Text style={styles.exitButtonText}>✕ Exit AR Preview</Text>
      </TouchableOpacity>

      {faces.length === 0 && (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>Point the camera at the client's face to track their eyes.</Text>
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
});
