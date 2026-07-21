import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput, useVideoOutput } from 'react-native-vision-camera';
import { useImageFaceDetector } from 'react-native-vision-camera-face-detector';
import { Canvas, Image as SkiaImage, ImageFormat, Path, Skia, useImage } from '@shopify/react-native-skia';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Video from 'react-native-video';
import { api } from '../services/api';
import { applyMaskedVideoRetouch, VideoRetouchUnavailableError } from '../services/videoRetouchNative';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { expandPolygonFromCentroid, isPointInPolygon, Point2D } from '../utils/polygon';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoRetouch'>;

type Phase =
  | 'checking_access'
  | 'locked'
  | 'permission'
  | 'no_camera'
  | 'capture'
  | 'paint'
  | 'record'
  | 'processing'
  | 'preview'
  | 'uploading';

const PREVIEW_WIDTH = 340;
// The eye contour ML Kit detects is the eyelid edge itself — a technician's actual
// lash line sits a little outside that, so the "never paintable" zone is padded out
// from the raw contour rather than matching it exactly.
const EXCLUSION_PADDING_FACTOR = 1.6;
const DEFAULT_BRUSH_RADIUS = 16;

export function VideoRetouchScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [phase, setPhase] = useState<Phase>('checking_access');
  const [error, setError] = useState<string | null>(null);
  const [brushRadius, setBrushRadius] = useState(DEFAULT_BRUSH_RADIUS);
  const [referencePhotoPath, setReferencePhotoPath] = useState<string | null>(null);
  const [excludedPolygons, setExcludedPolygons] = useState<Point2D[][]>([]);
  const [recordedVideoPath, setRecordedVideoPath] = useState<string | null>(null);
  const [processedVideoPath, setProcessedVideoPath] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({});
  const videoOutput = useVideoOutput({ enableAudio: false });
  const imageFaceDetector = useImageFaceDetector({ runContours: true, performanceMode: 'accurate' });
  const cameraRecorderRef = useRef<{ stopRecording(): Promise<void> } | null>(null);

  // strokesRef holds paint-stroke points in PREVIEW-canvas coordinate space (not the
  // reference photo's native resolution) — a single uniform scale factor is applied
  // once at export time (see buildMaskPngPath) rather than converting every touch
  // point on the fly.
  const strokesRef = useRef<Point2D[][]>([]);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    api
      .get<{ plan: string }>('/users/me/usage')
      .then((usage) => setPhase(usage.plan === 'free' ? 'locked' : hasPermission ? 'capture' : 'permission'))
      .catch(() => setPhase(hasPermission ? 'capture' : 'permission'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const referenceImage = useImage(referencePhotoPath ? `file://${referencePhotoPath}` : undefined);
  const previewHeight = referenceImage
    ? PREVIEW_WIDTH * (referenceImage.height() / referenceImage.width())
    : PREVIEW_WIDTH;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const point = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
          const excluded = excludedPolygons.some((polygon) => isPointInPolygon(point, polygon));
          strokesRef.current = [...strokesRef.current, excluded ? [] : [point]];
          forceRender();
        },
        onPanResponderMove: (evt) => {
          const point = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
          const excluded = excludedPolygons.some((polygon) => isPointInPolygon(point, polygon));
          const strokes = strokesRef.current;
          const current = strokes[strokes.length - 1];
          if (excluded) {
            // Lifting into the excluded zone ends this stroke — re-entering paintable
            // area starts a fresh disconnected one, rather than drawing a straight
            // line across the protected lash region.
            if (current && current.length > 0) strokesRef.current = [...strokes, []];
          } else {
            const updated = [...strokes];
            updated[updated.length - 1] = [...current, point];
            strokesRef.current = updated;
          }
          forceRender();
        },
        onPanResponderRelease: () => {},
      }),
    [excludedPolygons],
  );

  const undoStroke = () => {
    const nonEmpty = strokesRef.current.filter((s) => s.length > 0);
    nonEmpty.pop();
    strokesRef.current = nonEmpty;
    forceRender();
  };

  const clearStrokes = () => {
    strokesRef.current = [];
    forceRender();
  };

  const capturedFaceExclusionZones = (photoPath: string): Point2D[][] => {
    const faces = imageFaceDetector.detectFaces({ uri: `file://${photoPath}` });
    if (faces.length === 0) return [];
    const face = faces[0];
    const scaleX = PREVIEW_WIDTH / face.frameWidth;
    const scaleY = previewHeightFor(face) / face.frameHeight;
    const contours = [face.contours?.LEFT_EYE, face.contours?.RIGHT_EYE].filter(
      (c): c is { x: number; y: number }[] => Boolean(c && c.length >= 3),
    );
    return contours.map((contour) =>
      expandPolygonFromCentroid(
        contour.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
        EXCLUSION_PADDING_FACTOR,
      ),
    );

    function previewHeightFor(f: { frameWidth: number; frameHeight: number }) {
      return PREVIEW_WIDTH * (f.frameHeight / f.frameWidth);
    }
  };

  const handleCaptureReferenceFrame = async () => {
    try {
      const photo = await photoOutput.capturePhotoToFile({}, {});
      setReferencePhotoPath(photo.filePath);
      setExcludedPolygons(capturedFaceExclusionZones(photo.filePath));
      strokesRef.current = [];
      setPhase('paint');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture reference frame');
    }
  };

  const handleStartRecording = async () => {
    try {
      const recorder = await videoOutput.createRecorder({});
      setIsRecording(true);
      await recorder.startRecording(
        (filePath) => {
          setIsRecording(false);
          setRecordedVideoPath(filePath);
          setPhase('processing');
        },
        (err) => {
          setIsRecording(false);
          setError(err.message);
        },
      );
      cameraRecorderRef.current = recorder;
    } catch (err) {
      setIsRecording(false);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      await cameraRecorderRef.current?.stopRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  };

  const buildMaskPngPath = async (): Promise<string> => {
    if (!referenceImage) throw new Error('Reference photo has not finished loading yet.');
    const width = referenceImage.width();
    const height = referenceImage.height();
    const scale = width / PREVIEW_WIDTH;
    const surface = Skia.Surface.Make(width, height);
    if (!surface) throw new Error('Could not allocate a render surface for the mask.');
    const canvas = surface.getCanvas();

    const background = Skia.Paint();
    background.setColor(Skia.Color('black'));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), background);

    const strokePaint = Skia.Paint();
    strokePaint.setColor(Skia.Color('white'));
    strokePaint.setStyle(1); // PaintStyle.Stroke
    strokePaint.setStrokeWidth(brushRadius * 2 * scale);
    strokePaint.setStrokeCap(1); // StrokeCap.Round
    strokePaint.setStrokeJoin(1); // StrokeJoin.Round
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      const path = Skia.Path.Make();
      path.moveTo(stroke[0].x * scale, stroke[0].y * scale);
      for (const point of stroke.slice(1)) {
        path.lineTo(point.x * scale, point.y * scale);
      }
      canvas.drawPath(path, strokePaint);
    }

    // Defense in depth: guarantee the excluded (lash) region is black in the exported
    // mask regardless of the touch-time gating above.
    const exclusionPaint = Skia.Paint();
    exclusionPaint.setColor(Skia.Color('black'));
    for (const polygon of excludedPolygons) {
      if (polygon.length < 3) continue;
      const path = Skia.Path.Make();
      path.moveTo(polygon[0].x * scale, polygon[0].y * scale);
      for (const point of polygon.slice(1)) {
        path.lineTo(point.x * scale, point.y * scale);
      }
      path.close();
      canvas.drawPath(path, exclusionPaint);
    }

    const snapshot = surface.makeImageSnapshot();
    const base64 = snapshot.encodeToBase64(ImageFormat.PNG, 100);
    const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/lashlyai-mask-${Date.now()}.png`;
    await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
    return path;
  };

  const runProcessing = async () => {
    if (!recordedVideoPath) return;
    setError(null);
    try {
      const maskPath = await buildMaskPngPath();
      const outputPath = await applyMaskedVideoRetouch(recordedVideoPath, maskPath);
      setProcessedVideoPath(outputPath);
      setPhase('preview');
    } catch (err) {
      if (err instanceof VideoRetouchUnavailableError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process video');
      }
      setPhase('record');
    }
  };

  // Kick off processing as soon as we enter that phase — no separate trigger needed.
  useEffect(() => {
    if (phase === 'processing') runProcessing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleUpload = async () => {
    if (!processedVideoPath) return;
    setPhase('uploading');
    setError(null);
    try {
      const form = new FormData();
      form.append('video', {
        uri: `file://${processedVideoPath}`,
        name: 'retouched.mp4',
        type: 'video/mp4',
      } as unknown as Blob);
      await api.postForm(`/clients/${clientId}/video-retouch`, form);
      Alert.alert('Saved', "Retouched video added to this client's profile.");
      navigation.goBack();
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to upload video');
      }
      setPhase('preview');
    }
  };

  if (phase === 'checking_access') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (phase === 'locked') {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Video Retouch is a Pro feature</Text>
        <Text style={styles.lockedText}>
          Mark blemish spots on a freeze-frame and export a retouched video, entirely on-device — the
          lash area is always protected and never touched.
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

  if (phase === 'permission' || !hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Camera access needed</Text>
        <Text style={styles.lockedText}>Video Retouch needs your camera to record the client.</Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={async () => {
            const granted = await requestPermission();
            if (granted) setPhase('capture');
          }}>
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

  if (phase === 'capture') {
    return (
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          outputs={[photoOutput, videoOutput]}
        />
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>
            Frame the client, then capture a reference photo to mark retouch spots on.
          </Text>
        </View>
        <TouchableOpacity style={styles.shutterButton} onPress={handleCaptureReferenceFrame}>
          <Text style={styles.shutterButtonText}>Capture Reference Frame</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
          <Text style={styles.exitButtonText}>✕ Cancel</Text>
        </TouchableOpacity>
        {error && <Text style={styles.errorBanner}>{error}</Text>}
      </View>
    );
  }

  if (phase === 'paint') {
    return (
      <ScrollView style={styles.paintContainer} contentContainerStyle={styles.paintContent}>
        <Text style={styles.title}>Mark Retouch Areas</Text>
        <Text style={styles.subtitle}>
          Drag over blemish spots to clean up. The lash/eye area (outlined in red) can never be marked
          — it always stays natural.
        </Text>
        <View style={styles.canvasCard}>
          <View style={{ width: PREVIEW_WIDTH, height: previewHeight }} {...panResponder.panHandlers}>
            <Canvas style={{ width: PREVIEW_WIDTH, height: previewHeight }}>
              {referenceImage && (
                <SkiaImage
                  image={referenceImage}
                  x={0}
                  y={0}
                  width={PREVIEW_WIDTH}
                  height={previewHeight}
                  fit="contain"
                />
              )}
              {excludedPolygons.map((polygon, i) => {
                const path = Skia.Path.Make();
                path.moveTo(polygon[0].x, polygon[0].y);
                polygon.slice(1).forEach((p) => path.lineTo(p.x, p.y));
                path.close();
                return (
                  <Path key={`excl-${i}`} path={path} style="stroke" strokeWidth={2} color="rgba(220,50,50,0.9)" />
                );
              })}
              {strokesRef.current
                .filter((stroke) => stroke.length >= 2)
                .map((stroke, i) => {
                  const path = Skia.Path.Make();
                  path.moveTo(stroke[0].x, stroke[0].y);
                  stroke.slice(1).forEach((p) => path.lineTo(p.x, p.y));
                  return (
                    <Path
                      key={`stroke-${i}`}
                      path={path}
                      style="stroke"
                      strokeWidth={brushRadius * 2}
                      strokeCap="round"
                      strokeJoin="round"
                      color="rgba(255,255,255,0.55)"
                    />
                  );
                })}
            </Canvas>
          </View>
        </View>

        <View style={styles.brushRow}>
          <Text style={styles.sliderLabel}>Brush size</Text>
          <Slider
            style={styles.slider}
            minimumValue={6}
            maximumValue={40}
            value={brushRadius}
            onValueChange={setBrushRadius}
            minimumTrackTintColor={colors.primary}
            thumbTintColor={colors.primary}
          />
        </View>

        <View style={styles.paintActionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={undoStroke}>
            <Text style={styles.secondaryButtonText}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={clearStrokes}>
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={() => setPhase('record')}>
          <Text style={styles.buttonText}>Continue to Record</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'record') {
    return (
      <View style={styles.container}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          outputs={[photoOutput, videoOutput]}
        />
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>
            {isRecording ? 'Recording…' : 'Same framing as your reference photo. Record when ready.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.shutterButton, isRecording && styles.shutterButtonRecording]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}>
          <Text style={styles.shutterButtonText}>{isRecording ? 'Stop Recording' : 'Start Recording'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
          <Text style={styles.exitButtonText}>✕ Cancel</Text>
        </TouchableOpacity>
        {error && <Text style={styles.errorBanner}>{error}</Text>}
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.lockedText}>Applying retouch on-device…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.paintContainer} contentContainerStyle={styles.paintContent}>
      <Text style={styles.title}>Preview</Text>
      {processedVideoPath && (
        <Video
          source={{ uri: `file://${processedVideoPath}` }}
          style={styles.videoPreview}
          controls
          resizeMode="contain"
          paused={false}
        />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleUpload} disabled={phase === 'uploading'}>
        {phase === 'uploading' ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Upload to Client Profile</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
        <Text style={styles.backLinkText}>Discard</Text>
      </TouchableOpacity>
    </ScrollView>
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
  upgradeButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  upgradeButtonText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  backLink: { marginTop: 16, padding: 8, alignItems: 'center' },
  backLinkText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  hintBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 12,
  },
  hintText: { color: '#fff', fontSize: 13, textAlign: 'center' },
  shutterButton: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    backgroundColor: colors.primary,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shutterButtonRecording: { backgroundColor: '#B3261E' },
  shutterButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  exitButton: { position: 'absolute', top: 56, right: 20 },
  exitButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorBanner: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    color: '#fff',
    backgroundColor: '#B3261E',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    textAlign: 'center',
  },
  paintContainer: { flex: 1, backgroundColor: colors.background },
  paintContent: { padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, alignSelf: 'flex-start', marginBottom: 8 },
  subtitle: { fontSize: 13, color: colors.text, opacity: 0.75, marginBottom: 16, lineHeight: 19 },
  canvasCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 8, marginBottom: 16 },
  brushRow: { width: '100%', marginBottom: 8 },
  sliderLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 2 },
  slider: { width: '100%', height: 36 },
  paintActionsRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 16 },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', width: '100%' },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  videoPreview: { width: PREVIEW_WIDTH, height: PREVIEW_WIDTH, backgroundColor: '#000', marginBottom: 16 },
  error: { color: '#B3261E', marginBottom: 12, fontSize: 13 },
});
