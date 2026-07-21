import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, authenticatedImageSource } from '../services/api';
import { saveImageToDevice } from '../services/saveToDevice';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ClientProfile, EyeAnalysis, LashMap } from '../types/api';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'EyeAnalysisResult'>;

function formatValue(value: string): string {
  return value.replace(/_/g, ' ');
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{formatValue(value)}</Text>
    </View>
  );
}

const EYE_FIELDS: { label: string; key: keyof EyeAnalysis }[] = [
  { label: 'Eye shape', key: 'eye_shape' },
  { label: 'Eye size', key: 'eye_size' },
  { label: 'Eye width', key: 'eye_width' },
  { label: 'Eye spacing', key: 'eye_spacing' },
  { label: 'Canthal tilt', key: 'canthal_tilt' },
  { label: 'Lid exposure', key: 'lid_exposure' },
  { label: 'Under-eye condition', key: 'under_eye_condition' },
  { label: 'Eye symmetry', key: 'eye_symmetry' },
  { label: 'Lash density', key: 'lash_density' },
  { label: 'Natural lash length', key: 'lash_length_natural' },
  { label: 'Natural lash curl', key: 'natural_lash_curl' },
];

const BROW_FIELDS: { label: string; key: keyof EyeAnalysis }[] = [
  { label: 'Brow shape', key: 'brow_shape' },
  { label: 'Brow spacing', key: 'brow_spacing' },
  { label: 'Brow tail length', key: 'brow_tail_length' },
  { label: 'Brow gap', key: 'brow_gap' },
  { label: 'Brow hair direction', key: 'brow_hair_direction' },
];

// "(Pro)" suffix mirrors the existing 'Retention Check (Pro)' convention below and the
// backend's ADVANCED_LASH_SETS gate (see lashMapRules.data.ts / planLimits.service.ts's
// checkAdvancedLashSetAccess) — labeled here too so a free-tier artist sees the gate
// before tapping Generate, instead of only finding out from a 403 after submitting.
// Sentinel, not a real LashSetOption — selecting it switches the screen into the
// custom-builder form below instead of sending requested_lash_set to the backend.
const CUSTOM_LASH_SET = '__custom__';

const LASH_SETS: { label: string; value: string | null }[] = [
  { label: 'Auto (from eye shape)', value: null },
  { label: 'Classic', value: 'classic' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Volume', value: 'volume' },
  { label: 'Megavolume (Pro)', value: 'megavolume' },
  { label: 'Wet Set (Pro)', value: 'wet_set' },
  { label: 'Wet Wispy Set (Pro)', value: 'wet_wispy_set' },
  { label: 'Medusa Set (Pro)', value: 'medusa_set' },
  { label: 'Anime Set (Pro)', value: 'anime_set' },
  { label: 'Angel Set', value: 'angel_set' },
  { label: 'YY Set', value: 'yy_set' },
  { label: 'Build Your Own (Pro)', value: CUSTOM_LASH_SET },
];

const CURL_OPTIONS: ('C' | 'CC' | 'D')[] = ['C', 'CC', 'D'];

const CUSTOM_ZONE_FIELDS: { key: keyof CustomZoneLengths; label: string }[] = [
  { key: 'inner', label: 'Inner (mm)' },
  { key: 'inner_mid', label: 'Inner-mid (mm)' },
  { key: 'center', label: 'Center (mm)' },
  { key: 'outer_mid', label: 'Outer-mid (mm)' },
  { key: 'outer', label: 'Outer (mm)' },
];

interface CustomZoneLengths {
  inner: string;
  inner_mid: string;
  center: string;
  outer_mid: string;
  outer: string;
}

const EMPTY_CUSTOM_LENGTHS: CustomZoneLengths = {
  inner: '',
  inner_mid: '',
  center: '',
  outer_mid: '',
  outer: '',
};

const LASH_STYLES: { label: string; value: string | null }[] = [
  { label: 'Auto (from eye shape)', value: null },
  { label: 'Cat Eye', value: 'cateye' },
  { label: 'Kitten Eye', value: 'kitten_eye' },
  { label: 'Doll Eye', value: 'doll_eye' },
  { label: 'Open Eye', value: 'open_eye' },
  { label: 'Squirrel Eye', value: 'squirrel_eye' },
  { label: 'Fox Eye', value: 'fox_eye' },
  { label: 'Natural Eye', value: 'natural_eye' },
];

export function EyeAnalysisResultScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [requestedLashSet, setRequestedLashSet] = useState<string | null>(null);
  const [requestedLashStyle, setRequestedLashStyle] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customCurl, setCustomCurl] = useState<'C' | 'CC' | 'D'>('CC');
  const [customDiameter, setCustomDiameter] = useState('');
  const [customLengths, setCustomLengths] = useState<CustomZoneLengths>(EMPTY_CUSTOM_LENGTHS);
  const isCustom = requestedLashSet === CUSTOM_LASH_SET;
  const [loading, setLoading] = useState(true);
  const [eyeAnalysis, setEyeAnalysis] = useState<EyeAnalysis | null>(route.params.eyeAnalysis ?? null);
  const [photoUrl, setPhotoUrl] = useState(route.params.photoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);

  const handleSavePhoto = async () => {
    if (!photoUrl) {
      return;
    }
    setSavingPhoto(true);
    const result = await saveImageToDevice(photoUrl);
    setSavingPhoto(false);
    if (result.success) {
      Alert.alert('Saved', 'Photo saved to your photo library.');
    } else {
      Alert.alert('Could not save photo', result.error);
    }
  };

  const loadClient = useCallback(async () => {
    try {
      setError(null);
      const clientResult = await api.get<ClientProfile>(`/clients/${clientId}`);
      setEyeAnalysis(route.params.eyeAnalysis ?? clientResult.eye_analysis);
      setPhotoUrl(route.params.photoUrl ?? clientResult.photos.at(-1) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan');
    } finally {
      setLoading(false);
    }
  }, [clientId, route.params.eyeAnalysis, route.params.photoUrl]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  const buildCustomLashMap = (): { label: string; curl: string; diameter: string; lengths: Record<string, number> } | null => {
    if (!customLabel.trim()) {
      setError('Name your custom lash set.');
      return null;
    }
    if (!customDiameter.trim()) {
      setError('Enter a diameter for your custom lash set (e.g. 0.15mm).');
      return null;
    }
    const lengths: Record<string, number> = {};
    for (const field of CUSTOM_ZONE_FIELDS) {
      const value = Number(customLengths[field.key]);
      if (!customLengths[field.key] || Number.isNaN(value) || value < 4 || value > 20) {
        setError(`${field.label} must be a number between 4mm and 20mm.`);
        return null;
      }
      lengths[field.key] = value;
    }
    return { label: customLabel.trim(), curl: customCurl, diameter: customDiameter.trim(), lengths };
  };

  const generateLashMap = async () => {
    if (!eyeAnalysis) {
      return;
    }
    let customLashMap: ReturnType<typeof buildCustomLashMap> = null;
    if (isCustom) {
      setError(null);
      customLashMap = buildCustomLashMap();
      if (!customLashMap) return;
    }
    setLoading(true);
    setError(null);
    try {
      const lashMap = await api.post<LashMap>(`/clients/${clientId}/lash-map`, {
        requested_lash_set: isCustom ? undefined : requestedLashSet ?? undefined,
        requested_lash_style: requestedLashStyle ?? undefined,
        eye_analysis: eyeAnalysis,
        custom_lash_map: customLashMap ?? undefined,
      });
      navigation.replace('LashMap', { clientId, lashMap });
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate lash map');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && !eyeAnalysis) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!eyeAnalysis) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'No eye analysis available for this client yet.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={640}>
      {photoUrl ? (
        <>
          <Image source={authenticatedImageSource(photoUrl)} style={styles.photo} />
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSavePhoto}
            disabled={savingPhoto}>
            {savingPhoto ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save to Photos</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      {eyeAnalysis.mock && (
        <View style={styles.mockBadge}>
          <Text style={styles.mockBadgeText}>
            MOCK ANALYSIS - no OpenAI key configured on the backend yet
          </Text>
        </View>
      )}

      <View style={styles.scoreBadge}>
        <Text style={styles.scoreValue}>{eyeAnalysis.balance_score}</Text>
        <Text style={styles.scoreLabel}>Balance Score</Text>
      </View>

      <Text style={styles.title}>Full Analysis - Eye</Text>
      {EYE_FIELDS.map(({ label, key }) => (
        <Row key={key} label={label} value={String(eyeAnalysis[key])} />
      ))}

      <Text style={styles.title}>Full Analysis - Brow</Text>
      {BROW_FIELDS.map(({ label, key }) => (
        <Row key={key} label={label} value={String(eyeAnalysis[key])} />
      ))}
      {eyeAnalysis.notes ? <Text style={styles.notes}>{eyeAnalysis.notes}</Text> : null}

      <Text style={styles.styleLabel}>Lash Sets</Text>
      <View style={styles.styleChips}>
        {LASH_SETS.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[styles.chip, requestedLashSet === option.value && styles.chipSelected]}
            onPress={() => setRequestedLashSet(option.value)}>
            <Text
              style={[
                styles.chipText,
                requestedLashSet === option.value && styles.chipTextSelected,
              ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isCustom && (
        <View style={styles.customCard}>
          <Text style={styles.customTitle}>Build Your Own Lash Set</Text>
          <TextInput
            style={styles.customInput}
            placeholder="Name this set (e.g. Sarah's signature wispy)"
            placeholderTextColor={colors.muted}
            value={customLabel}
            onChangeText={setCustomLabel}
          />
          <TextInput
            style={styles.customInput}
            placeholder="Diameter (e.g. 0.07mm)"
            placeholderTextColor={colors.muted}
            value={customDiameter}
            onChangeText={setCustomDiameter}
          />
          <Text style={styles.customSubLabel}>Curl</Text>
          <View style={styles.styleChips}>
            {CURL_OPTIONS.map((curl) => (
              <TouchableOpacity
                key={curl}
                style={[styles.chip, customCurl === curl && styles.chipSelected]}
                onPress={() => setCustomCurl(curl)}>
                <Text style={[styles.chipText, customCurl === curl && styles.chipTextSelected]}>
                  {curl}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.customSubLabel}>Zone lengths</Text>
          {CUSTOM_ZONE_FIELDS.map((field) => (
            <View key={field.key} style={styles.customZoneRow}>
              <Text style={styles.customZoneLabel}>{field.label}</Text>
              <TextInput
                style={styles.customZoneInput}
                placeholder="10"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={customLengths[field.key]}
                onChangeText={(value) => setCustomLengths((prev) => ({ ...prev, [field.key]: value }))}
              />
            </View>
          ))}
        </View>
      )}

      <Text style={styles.styleLabel}>Lash Styles</Text>
      <View style={styles.styleChips}>
        {LASH_STYLES.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[styles.chip, requestedLashStyle === option.value && styles.chipSelected]}
            onPress={() => setRequestedLashStyle(option.value)}>
            <Text
              style={[
                styles.chipText,
                requestedLashStyle === option.value && styles.chipTextSelected,
              ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={generateLashMap}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Generate Lash Map</Text>
        )}
      </TouchableOpacity>
      </ResponsiveContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  photo: { width: '100%', height: 220, borderRadius: 12 },
  saveButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  saveButtonText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  mockBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  mockBadgeText: { color: '#7A5B00', fontSize: 12, fontWeight: '600' },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  scoreValue: { fontSize: 32, fontWeight: '800', color: colors.background },
  scoreLabel: { fontSize: 12, fontWeight: '600', color: colors.background, marginTop: 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowLabel: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, textTransform: 'capitalize' },
  notes: { color: colors.text, fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  styleLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 20, marginBottom: 8 },
  styleChips: { flexDirection: 'row', flexWrap: 'wrap' },
  customCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  customTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  customInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
  },
  customSubLabel: { fontSize: 12, fontWeight: '600', color: colors.accent, marginTop: 4, marginBottom: 8 },
  customZoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  customZoneLabel: { fontSize: 12, color: colors.text },
  customZoneInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    width: 70,
    textAlign: 'center',
  },
  chip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: colors.background },
  error: { color: '#B3261E', marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
