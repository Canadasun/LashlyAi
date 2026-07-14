import { useEffect, useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Canvas, ColorMatrix, Image as SkiaImage, ImageFormat, Skia, useImage } from '@shopify/react-native-skia';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { api, authenticatedImageSource } from '../services/api';
import { generateCaption } from '../services/marketing';
import { saveLocalImageToDevice } from '../services/saveToDevice';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import {
  Adjustments,
  buildColorMatrix,
  FILTER_PRESETS,
  NEUTRAL_ADJUSTMENTS,
} from '../services/colorMatrix';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoEditor'>;

const PREVIEW_SIZE = 320;

function AdjustmentSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={-1}
        maximumValue={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

export function PhotoEditorScreen({ route, navigation }: Props) {
  const { clientId, photoUri } = route.params;
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const [captionDescription, setCaptionDescription] = useState('');
  const [caption, setCaption] = useState<{ caption: string; hashtags: string[] } | null>(null);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Free tier gets zero access to this feature (not a reduced quota) — check plan
  // before loading the photo at all rather than letting a free user in and only
  // blocking on export.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const usage = await api.get<{ plan: string }>('/users/me/usage');
        if (cancelled) return;
        if (usage.plan === 'free') {
          Alert.alert(
            'Pro feature',
            'The photo editor is available on paid plans. Upgrade to Pro to use it.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
              { text: 'Upgrade', onPress: () => navigation.replace('Paywall') },
            ],
          );
          return;
        }
        setCheckingAccess(false);
      } catch {
        // Fail open on the client-side gate — the backend still enforces the quota
        // on export, so this is just avoiding an unnecessary paywall prompt on a
        // transient network error.
        setCheckingAccess(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (checkingAccess) return;
    let cancelled = false;
    (async () => {
      try {
        const { uri, headers } = authenticatedImageSource(photoUri);
        const response = await fetch(uri, { headers });
        if (!response.ok) {
          throw new Error('Failed to load photo');
        }
        const buffer = await response.arrayBuffer();
        if (!cancelled) {
          setImageBytes(new Uint8Array(buffer));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load photo');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoUri, checkingAccess]);

  const image = useImage(imageBytes ?? undefined);
  const matrix = useMemo(() => buildColorMatrix(adjustments), [adjustments]);

  // High-res export, rendered at the source image's native resolution rather than the
  // on-screen preview size, using a CPU-backed offscreen surface (no GPU context
  // lifecycle to manage for a one-shot render).
  const renderExportBase64 = (): string => {
    if (!image) {
      throw new Error('Photo has not finished loading yet.');
    }
    const width = image.width();
    const height = image.height();
    const surface = Skia.Surface.Make(width, height);
    if (!surface) {
      throw new Error('Could not allocate a render surface for export.');
    }
    const canvas = surface.getCanvas();
    const paint = Skia.Paint();
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
    canvas.drawImage(image, 0, 0, paint);
    const snapshot = surface.makeImageSnapshot();
    return snapshot.encodeToBase64(ImageFormat.JPEG, 92);
  };

  const writeExportToTempFile = async (): Promise<string> => {
    const base64 = renderExportBase64();
    const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/lashlyai-edit-${Date.now()}.jpg`;
    await ReactNativeBlobUtil.fs.writeFile(path, base64, 'base64');
    return path;
  };

  const handleSaveToPhotos = async () => {
    setSaving(true);
    setError(null);
    try {
      const path = await writeExportToTempFile();
      const result = await saveLocalImageToDevice(`file://${path}`);
      if (result.success) {
        Alert.alert('Saved', 'Edited photo saved to your photo library.');
      } else {
        Alert.alert('Could not save photo', result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export photo');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAsClientPhoto = async () => {
    setUploading(true);
    setError(null);
    try {
      const path = await writeExportToTempFile();
      const form = new FormData();
      form.append('photo', {
        uri: `file://${path}`,
        name: 'edited.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);
      await api.postForm(`/clients/${clientId}/photo-edit`, form);
      Alert.alert('Saved', 'Edited photo added to this client\'s profile.');
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to upload edited photo');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!captionDescription.trim()) {
      setError('Describe the post to generate a caption (e.g. "mega volume set, dramatic cat-eye")');
      return;
    }
    setCaptionLoading(true);
    setError(null);
    try {
      const result = await generateCaption(captionDescription.trim());
      setCaption(result);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate caption');
      }
    } finally {
      setCaptionLoading(false);
    }
  };

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{loadError}</Text>
      </View>
    );
  }

  if (!image) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Photo Editor</Text>

      <View style={styles.canvasCard}>
        <Canvas style={styles.canvas}>
          <SkiaImage
            image={image}
            x={0}
            y={0}
            width={PREVIEW_SIZE}
            height={PREVIEW_SIZE}
            fit="contain">
            <ColorMatrix matrix={matrix} />
          </SkiaImage>
        </Canvas>
      </View>

      <View style={styles.presetRow}>
        {FILTER_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={styles.presetChip}
            onPress={() => setAdjustments(preset.adjustments)}>
            <Text style={styles.presetChipText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <AdjustmentSlider
        label="Brightness"
        value={adjustments.brightness}
        onChange={(brightness) => setAdjustments((prev) => ({ ...prev, brightness }))}
      />
      <AdjustmentSlider
        label="Contrast"
        value={adjustments.contrast}
        onChange={(contrast) => setAdjustments((prev) => ({ ...prev, contrast }))}
      />
      <AdjustmentSlider
        label="Saturation"
        value={adjustments.saturation}
        onChange={(saturation) => setAdjustments((prev) => ({ ...prev, saturation }))}
      />

      <View style={styles.captionCard}>
        <Text style={styles.sectionTitle}>Caption</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe the post (e.g. 'mega volume set, dramatic cat-eye')"
          value={captionDescription}
          onChangeText={setCaptionDescription}
          multiline
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleGenerateCaption}
          disabled={captionLoading}>
          {captionLoading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.secondaryButtonText}>Generate Caption</Text>
          )}
        </TouchableOpacity>
        {caption && (
          <View style={styles.resultCard}>
            <Text selectable style={styles.resultText}>
              {caption.caption}
            </Text>
            <Text selectable style={styles.hashtags}>
              {caption.hashtags.join(' ')}
            </Text>
          </View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={handleSaveToPhotos} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Save to Photos</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleUploadAsClientPhoto}
        disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Text style={styles.secondaryButtonText}>Upload as Client Photo</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, alignSelf: 'flex-start', marginBottom: 16 },
  canvasCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 16,
  },
  canvas: { width: PREVIEW_SIZE, height: PREVIEW_SIZE },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 16 },
  presetChip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  presetChipText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  sliderRow: { width: '100%', marginBottom: 8 },
  sliderLabel: { fontSize: 12, fontWeight: '600', color: colors.text, marginBottom: 2 },
  slider: { width: '100%', height: 36 },
  captionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    width: '100%',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  resultCard: { backgroundColor: colors.background, borderRadius: 10, padding: 12, marginTop: 10 },
  resultText: { fontSize: 13, color: colors.text, lineHeight: 19 },
  hashtags: { fontSize: 12, color: colors.accent, marginTop: 8 },
  error: { color: '#B3261E', marginTop: 12, marginBottom: 4, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    width: '100%',
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
});
