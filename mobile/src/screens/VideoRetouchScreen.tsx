import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { launchImageLibrary } from 'react-native-image-picker';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput, useVideoOutput } from 'react-native-vision-camera';
import { useImageFaceDetector } from 'react-native-vision-camera-face-detector';
import { Canvas, Image as SkiaImage, ImageFormat, Path, Skia, useImage } from '@shopify/react-native-skia';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Video from 'react-native-video';
import { api } from '../services/api';
import {
  applyMaskedVideoRetouch,
  extractVideoFrame,
  NormalizedFaceBounds,
  TrackingData,
  TrackingSample,
  VideoRetouchUnavailableError,
} from '../services/videoRetouchNative';
import { saveLocalVideoToDevice } from '../services/saveToDevice';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { expandPolygonFromCentroid, isPointInPolygon, Point2D } from '../utils/polygon';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoRetouch'>;

type Phase =
  | 'checking_access'
  | 'locked'
  | 'capture'
  | 'permission'
  | 'live_reference'
  | 'no_camera'
  | 'importing'
  | 'paint'
  | 'record'
  | 'processing'
  | 'preview'
  | 'uploading';

type VideoSource = 'live' | 'library';
type ProcessingStage = 'analyzing' | 'applying';

const PREVIEW_WIDTH = 340;
// The eye contour ML Kit detects is the eyelid edge itself — a technician's actual
// lash line sits a little outside that, so the "never paintable" zone is padded out
// from the raw contour rather than matching it exactly.
const EXCLUSION_PADDING_FACTOR = 1.6;
const DEFAULT_BRUSH_RADIUS = 16;
// Keeps both the tracking-sample pass (one native seek+detect per sample) and the
// final export itself bounded to a reasonable processing time on-device — this tool
// is for short chairside documentation clips, not long-form video.
const MAX_VIDEO_DURATION_MS = 90_000;
// How often to sample face position across the clip for tracking. Lower = smoother
// tracking but more native seek+detect round trips before export can start.
const TRACKING_SAMPLE_INTERVAL_MS = 300;

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
  const [videoSource, setVideoSource] = useState<VideoSource>('live');
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('analyzing');
  const [savingToPhotos, setSavingToPhotos] = useState(false);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({});
  const videoOutput = useVideoOutput({ enableAudio: false });
  // Contour-accurate — this is the one detection that actually gates painting (draws
  // the visible protected lash zone), so precision matters here.
  const imageFaceDetector = useImageFaceDetector({ runContours: true, performanceMode: 'accurate' });
  // Bounds-only, fast mode — used for the tracking-sample pass below, which only ever
  // needs a bounding box + roll angle for a rigid transform, run many times over a
  // clip, so trading contour precision for speed is the right call there.
  const trackingFaceDetector = useImageFaceDetector({ runContours: false, performanceMode: 'fast' });
  const cameraRecorderRef = useRef<{ stopRecording(): Promise<void> } | null>(null);
  // The reference frame's own face position/size/roll, normalized — the anchor every
  // tracking sample below is measured against. Not React state: never rendered,
  // needed only at export time.
  const referenceBoundsRef = useRef<NormalizedFaceBounds | null>(null);

  // strokesRef holds paint-stroke points in PREVIEW-canvas coordinate space (not the
  // reference photo's native resolution) — a single uniform scale factor is applied
  // once at export time (see buildMaskPngPath) rather than converting every touch
  // point on the fly.
  const strokesRef = useRef<Point2D[][]>([]);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  // Guards runProcessing's async setState calls below — on-device retouch has no
  // native cancellation hook, so backing out mid-processing can't stop the work
  // itself, but it must stop touching state once this screen is gone.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Re-checks on every focus, but only while still gated ('checking_access' or
  // 'locked') — a user who hits the Pro lock, upgrades on Paywall (pushed on top of
  // this still-mounted screen), and backs out needs the lock to lift immediately
  // instead of showing stale "free" state. Once past the gate, leaves an in-progress
  // capture/paint/record in place rather than resetting it on every refocus.
  //
  // Always lands on 'capture' (a choice screen, no camera preview) rather than
  // branching on hasPermission here — importing from the library needs no camera
  // access at all, so camera permission is only requested lazily, the moment the
  // user actually chooses the live-record path (see handleGoLive below). Gating the
  // whole screen behind camera permission would force it on a user who only ever
  // wants to import an existing clip.
  useFocusEffect(
    useCallback(() => {
      api
        .get<{ plan: string }>('/users/me/usage')
        .then((usage) => {
          setPhase((current) =>
            current === 'checking_access' || current === 'locked' ? (usage.plan === 'free' ? 'locked' : 'capture') : current,
          );
        })
        .catch(() => {
          setPhase((current) => (current === 'checking_access' ? 'capture' : current));
        });
    }, []),
  );

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

  // Detects the reference frame's face once, returning both the paintable exclusion
  // polygons (preview-canvas pixel space, as before) and the face's normalized
  // bounds/roll — the anchor every video tracking sample gets measured against later.
  // One detection, two derived results, rather than detecting twice.
  const detectReferenceFace = (photoPath: string): { polygons: Point2D[][]; bounds: NormalizedFaceBounds | null } => {
    const faces = imageFaceDetector.detectFaces({ uri: `file://${photoPath}` });
    if (faces.length === 0) return { polygons: [], bounds: null };
    const face = faces[0];
    // Scale from the face detector's own frame space into the *actual* rendered
    // preview space (previewHeight, derived from the decoded reference photo below) —
    // deriving a height from the face frame's own aspect ratio here instead would
    // silently misalign this "never paintable" zone whenever the detector's frame
    // aspect ratio differs from the captured photo's real aspect ratio (e.g. rotation/
    // crop differences between what the detector processed and the saved file).
    const scaleX = PREVIEW_WIDTH / face.frameWidth;
    const scaleY = previewHeight / face.frameHeight;
    const contours = [face.contours?.LEFT_EYE, face.contours?.RIGHT_EYE].filter(
      (c): c is { x: number; y: number }[] => Boolean(c && c.length >= 3),
    );
    const polygons = contours.map((contour) =>
      expandPolygonFromCentroid(
        contour.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
        EXCLUSION_PADDING_FACTOR,
      ),
    );
    const bounds: NormalizedFaceBounds = {
      cx: (face.bounds.x + face.bounds.width / 2) / face.frameWidth,
      cy: (face.bounds.y + face.bounds.height / 2) / face.frameHeight,
      w: face.bounds.width / face.frameWidth,
      h: face.bounds.height / face.frameHeight,
      rollDeg: face.rollAngle,
    };
    return { polygons, bounds };
  };

  // Recomputes once the reference photo has actually finished decoding (referenceImage
  // is populated asynchronously by useImage) rather than synchronously right after
  // capture — computing eagerly would use last render's previewHeight (still reflecting
  // the *previous* or default image), the same class of source-mismatch bug as above.
  useEffect(() => {
    if (!referencePhotoPath || !referenceImage) return;
    const { polygons, bounds } = detectReferenceFace(referencePhotoPath);
    setExcludedPolygons(polygons);
    referenceBoundsRef.current = bounds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referencePhotoPath, referenceImage]);

  const handleCaptureReferenceFrame = async () => {
    try {
      const photo = await photoOutput.capturePhotoToFile({}, {});
      setVideoSource('live');
      // Clears any duration left over from a library import the user started and
      // then abandoned in favor of recording live instead — without this,
      // runProcessing would skip probing the *actual* recorded video's duration and
      // use the abandoned import's stale one, throwing off both the length cap and
      // the tracking sample loop's range.
      setVideoDurationMs(null);
      setReferencePhotoPath(photo.filePath);
      strokesRef.current = [];
      setPhase('paint');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture reference frame');
    }
  };

  const handleChooseVideoFromLibrary = async () => {
    const result = await launchImageLibrary({ mediaType: 'video' });
    if (result.didCancel) return;
    const pickedUri = result.assets?.[0]?.uri;
    if (!pickedUri) {
      setError(result.errorMessage ?? 'Could not read the selected video.');
      return;
    }

    setError(null);
    setPhase('importing');
    const videoPath = pickedUri.replace(/^file:\/\//, '');
    try {
      const { path: framePath, durationMs } = await extractVideoFrame(videoPath, 0);
      if (durationMs > MAX_VIDEO_DURATION_MS) {
        setError(`That clip is ${Math.round(durationMs / 1000)}s — please choose one under ${MAX_VIDEO_DURATION_MS / 1000}s.`);
        setPhase('capture');
        return;
      }
      setVideoSource('library');
      setRecordedVideoPath(videoPath);
      setVideoDurationMs(durationMs);
      setReferencePhotoPath(framePath);
      strokesRef.current = [];
      setPhase('paint');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import that video.');
      setPhase('capture');
    }
  };

  // Camera permission is only ever requested here — the moment the user actually
  // chooses to record live, not as a blanket gate on the whole screen (see the
  // useFocusEffect above).
  const handleGoLive = async () => {
    setError(null);
    if (hasPermission) {
      setPhase('live_reference');
      return;
    }
    const granted = await requestPermission();
    setPhase(granted ? 'live_reference' : 'permission');
  };

  const handleStartRecording = async () => {
    try {
      const recorder = await videoOutput.createRecorder({});
      setIsRecording(true);
      await recorder.startRecording(
        (filePath) => {
          setIsRecording(false);
          setRecordedVideoPath(filePath);
          // Every completed recording is a genuinely new file — including a retry
          // after a previous attempt hit the duration cap or a processing error — so
          // its duration always needs a fresh probe, never inherited from whatever
          // attempt came before it.
          setVideoDurationMs(null);
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

  // Samples face position across the actual recorded/imported video at a fixed
  // interval, so the retouch mask (and the lash exclusion baked into it) can track
  // real head movement instead of staying frozen at the reference frame's position —
  // see VideoRetouch.swift's per-frame interpolation. A failed individual sample
  // (blink, motion blur, a seek that lands on a bad frame) is simply skipped, not
  // fatal — interpolation across the surrounding good samples covers the gap.
  const buildTrackingSamples = async (videoPath: string, durationMs: number): Promise<TrackingSample[]> => {
    const samples: TrackingSample[] = [];
    for (let t = 0; t <= durationMs; t += TRACKING_SAMPLE_INTERVAL_MS) {
      let framePath: string | null = null;
      try {
        const extracted = await extractVideoFrame(videoPath, t);
        framePath = extracted.path;
        const faces = trackingFaceDetector.detectFaces({ uri: `file://${framePath}` });
        if (faces.length > 0) {
          const face = faces[0];
          samples.push({
            timeMs: t,
            cx: (face.bounds.x + face.bounds.width / 2) / face.frameWidth,
            cy: (face.bounds.y + face.bounds.height / 2) / face.frameHeight,
            w: face.bounds.width / face.frameWidth,
            h: face.bounds.height / face.frameHeight,
            rollDeg: face.rollAngle,
          });
        }
      } catch {
        // See doc comment above — one bad sample doesn't abort the pass.
      } finally {
        if (framePath) {
          ReactNativeBlobUtil.fs.unlink(framePath).catch(() => undefined);
        }
      }
    }
    return samples;
  };

  const runProcessing = async () => {
    if (!recordedVideoPath) return;
    setError(null);
    setProcessingStage('analyzing');
    try {
      // Live-recorded video's duration isn't known yet (only library imports probe it
      // up front, since that's also when the import-length cap is checked) — probe it
      // here so both sources reach the sampling loop with a known duration.
      let durationMs = videoDurationMs;
      if (durationMs === null) {
        const probe = await extractVideoFrame(recordedVideoPath, 0);
        durationMs = probe.durationMs;
        ReactNativeBlobUtil.fs.unlink(probe.path).catch(() => undefined);
        if (isMountedRef.current) setVideoDurationMs(durationMs);
        if (durationMs > MAX_VIDEO_DURATION_MS) {
          throw new Error(
            `This recording is ${Math.round(durationMs / 1000)}s — Video Retouch supports clips up to ${MAX_VIDEO_DURATION_MS / 1000}s.`,
          );
        }
      }

      const samples = await buildTrackingSamples(recordedVideoPath, durationMs);
      if (!isMountedRef.current) return;

      const maskPath = await buildMaskPngPath();
      const tracking: TrackingData | undefined =
        referenceBoundsRef.current && samples.length > 0
          ? { referenceBounds: referenceBoundsRef.current, samples }
          : undefined;

      setProcessingStage('applying');
      const outputPath = await applyMaskedVideoRetouch(recordedVideoPath, maskPath, tracking);
      if (!isMountedRef.current) return;
      setProcessedVideoPath(outputPath);
      setPhase('preview');
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err instanceof VideoRetouchUnavailableError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to process video');
      }
      // A library-imported video has no live recording to fall back into — 'record'
      // renders a live Camera, which isn't the right recovery step for that source.
      setPhase(videoSource === 'library' ? 'paint' : 'record');
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

  const handleSaveToPhotos = async () => {
    if (!processedVideoPath) return;
    setSavingToPhotos(true);
    const result = await saveLocalVideoToDevice(`file://${processedVideoPath}`);
    setSavingToPhotos(false);
    if (result.success) {
      Alert.alert('Saved', 'The retouched video was saved to your Photos.');
    } else {
      Alert.alert('Could not save', result.error);
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

  // Entry choice screen — deliberately no camera preview and no device/permission
  // requirement here: importing an existing clip needs no camera access at all, so
  // permission is only requested lazily by handleGoLive, the moment the user actually
  // chooses to record live (see the useFocusEffect above for why).
  if (phase === 'capture') {
    return (
      <View style={styles.choiceContainer}>
        <Text style={styles.title}>Video Retouch</Text>
        <Text style={styles.subtitle}>
          Record a new clip, or import one you've already shot on your phone.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleGoLive}>
          <Text style={styles.buttonText}>Record Live</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButtonFull} onPress={handleChooseVideoFromLibrary}>
          <Text style={styles.secondaryButtonText}>Choose Video from Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Cancel</Text>
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  if (phase === 'importing') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.lockedText}>Importing video…</Text>
      </View>
    );
  }

  if (phase === 'permission') {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Camera access needed</Text>
        <Text style={styles.lockedText}>Recording live needs your camera — or choose a video from your library instead, which doesn't.</Text>
        <TouchableOpacity style={styles.upgradeButton} onPress={handleGoLive}>
          <Text style={styles.upgradeButtonText}>Allow Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => setPhase('capture')}>
          <Text style={styles.backLinkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'live_reference') {
    if (!device) {
      return (
        <View style={styles.centered}>
          <Text style={styles.lockedTitle}>No camera available</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => setPhase('capture')}>
            <Text style={styles.backLinkText}>Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
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
        <TouchableOpacity style={styles.exitButton} onPress={() => setPhase('capture')}>
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

        <TouchableOpacity
          style={styles.button}
          onPress={() => setPhase(videoSource === 'library' ? 'processing' : 'record')}>
          <Text style={styles.buttonText}>{videoSource === 'library' ? 'Apply Retouch' : 'Continue to Record'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'record' && !device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>No camera available</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'record' && device) {
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
        <Text style={styles.lockedText}>
          {processingStage === 'analyzing'
            ? 'Tracking motion across the clip…'
            : 'Applying retouch on-device…'}
        </Text>
        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Cancel</Text>
        </TouchableOpacity>
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
      <TouchableOpacity style={styles.secondaryButtonFull} onPress={handleSaveToPhotos} disabled={savingToPhotos}>
        {savingToPhotos ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.secondaryButtonText}>Save to Photos</Text>
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
  choiceContainer: {
    flex: 1,
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
  // Same look as secondaryButton, but width: '100%' instead of flex: 1 — for a
  // standalone button (not sharing a flexDirection: 'row' with a sibling), flex: 1
  // stretches to fill the parent's remaining main-axis space instead of just sizing
  // to content, which is wrong when the parent itself is a full-height flex: 1 view
  // (e.g. the capture choice screen below).
  secondaryButtonFull: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  button: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', width: '100%' },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  videoPreview: { width: PREVIEW_WIDTH, height: PREVIEW_WIDTH, backgroundColor: '#000', marginBottom: 16 },
  error: { color: '#B3261E', marginBottom: 12, fontSize: 13 },
});
