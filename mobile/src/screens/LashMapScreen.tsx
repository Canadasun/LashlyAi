import { useRef, useState } from 'react';
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
import ViewShot, { ViewShotRef } from 'react-native-view-shot';
import { LashMapZoneDiagram } from '../components/LashMapZoneDiagram';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { useDeviceClass } from '../hooks/useDeviceClass';
import { api, authenticatedImageSource } from '../services/api';
import { saveImageToDevice, saveLocalImageToDevice } from '../services/saveToDevice';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ResponsiveContainer } from '../components/ResponsiveContainer';
import { AiConsentCheckbox } from '../components/AiConsentCheckbox';

type Props = NativeStackScreenProps<RootStackParamList, 'LashMap'>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const ANGLE_LABELS: Record<string, string> = { open_eye: 'Eyes Open', closed_eye: 'Eyes Closed' };

const SYMPTOM_OPTIONS = [
  'excess oil',
  'rubbing eyes',
  'poor aftercare',
  'premature shedding',
  'sleeping on face',
  'humid environment',
];

export function LashMapScreen({ route, navigation }: Props) {
  const { clientId, lashMap } = route.params;
  const { isTablet } = useDeviceClass();
  // Phone: tabbed (screen isn't wide enough for both at once). iPad: shown side by
  // side instead — see the split-view render below.
  const [texturedTab, setTexturedTab] = useState<'base' | 'spike'>('spike');
  const [showRetentionCheck, setShowRetentionCheck] = useState(false);
  const [days, setDays] = useState('');
  const [retentionPct, setRetentionPct] = useState('');
  const [humidityPct, setHumidityPct] = useState('');
  const [glueUsed, setGlueUsed] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [advice, setAdvice] = useState<{ advice: string; mock: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDiagram, setSavingDiagram] = useState(false);
  const diagramRef = useRef<ViewShotRef>(null);
  const [consented, setConsented] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // Multi-angle batch: one Pro action returns both an open-eye and a closed-eye
  // preview (see clients.routes.ts's lash-preview route) — both edits of the same
  // base photo, not a true side-profile (this app only ever has a straight-on eye
  // close-up to edit from).
  const [previews, setPreviews] = useState<{ angle: string; url: string; mock: boolean }[]>([]);
  const [savingPreviewAngle, setSavingPreviewAngle] = useState<string | null>(null);

  const saveDiagram = async () => {
    if (!diagramRef.current?.capture) {
      return;
    }
    setSavingDiagram(true);
    try {
      const uri = await diagramRef.current.capture();
      const result = await saveLocalImageToDevice(uri);
      if (result.success) {
        Alert.alert('Saved', 'Lash map diagram saved to your photo library.');
      } else {
        Alert.alert('Could not save diagram', result.error);
      }
    } catch (err) {
      Alert.alert(
        'Could not save diagram',
        err instanceof Error ? err.message : 'Failed to capture diagram.',
      );
    } finally {
      setSavingDiagram(false);
    }
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms((prev) =>
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom],
    );
  };

  const checkRetention = async () => {
    const daysNum = Number(days);
    const pctNum = Number(retentionPct);
    if (!days || !retentionPct || Number.isNaN(daysNum) || Number.isNaN(pctNum)) {
      setError('Enter days since application and retention % as numbers');
      return;
    }
    const humidityNum = humidityPct ? Number(humidityPct) : undefined;
    if (humidityPct && Number.isNaN(humidityNum)) {
      setError('Humidity must be a number between 0 and 100');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ advice: string; mock: boolean }>(
        `/clients/${clientId}/lash-maps/${lashMap.id}/retention-check`,
        {
          days_since_application: daysNum,
          retention_pct: pctNum,
          symptoms,
          humidity_pct: humidityNum,
          glue_used: glueUsed || undefined,
        },
      );
      setAdvice(result);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to get retention advice');
      }
    } finally {
      setLoading(false);
    }
  };

  const createAiPreview = async () => {
    if (!consented) {
      setPreviewError('Confirm the client consented before generating a preview.');
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await api.post<{
        previews: { angle: string; preview_url: string; mock: boolean }[];
      }>(`/clients/${clientId}/lash-preview`, {
        lash_set_label: lashMap.lash_set_label ?? lashMap.style_label,
        lash_style_label: lashMap.lash_style_label,
        consented: true,
        angles: ['open_eye', 'closed_eye'],
      });
      setPreviews(result.previews.map((p) => ({ angle: p.angle, url: p.preview_url, mock: p.mock })));
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const savePreview = async (angle: string, url: string) => {
    setSavingPreviewAngle(angle);
    const result = await saveImageToDevice(url);
    setSavingPreviewAngle(null);
    if (result.success) {
      Alert.alert('Saved', 'AI preview saved to your photo library.');
    } else {
      Alert.alert('Could not save preview', result.error);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={640}>
      <Text style={styles.title}>Lash Map</Text>
      <Text style={styles.savedNote}>Saved to this client's history</Text>

      {isTablet && (
        <TouchableOpacity
          style={styles.chairsideButton}
          onPress={() => navigation.navigate('ChairsideMode', { clientId, lashMap })}>
          <Text style={styles.chairsideButtonText}>Chairside Mode</Text>
        </TouchableOpacity>
      )}

      {lashMap.difficulty_label && (
        <View style={styles.difficultyRow}>
          <DifficultyBadge label={lashMap.difficulty_label} estimatedMinutes={lashMap.estimated_minutes} />
        </View>
      )}

      <ViewShot ref={diagramRef} options={{ format: 'png', quality: 1 }}>
        <View style={styles.diagramCard}>
          <LashMapZoneDiagram zones={lashMap.visual_map.zones} />
        </View>
      </ViewShot>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={saveDiagram}
        disabled={savingDiagram}>
        {savingDiagram ? (
          <ActivityIndicator color={colors.text} size="small" />
        ) : (
          <Text style={styles.secondaryButtonText}>Save Diagram to Photos</Text>
        )}
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <Stat label="Style" value={lashMap.style_label} />
        <Stat label="Curl" value={lashMap.curl_label} />
        <Stat label="Diameter" value={lashMap.diameter} />
      </View>
      <View style={styles.statsRow}>
        <Stat label="Fan Type" value={lashMap.fan_type} />
      </View>
      {(lashMap.lash_set_label || lashMap.lash_style_label) && (
        <View style={styles.statsRow}>
          {lashMap.lash_set_label && <Stat label="Lash Set" value={lashMap.lash_set_label} />}
          {lashMap.lash_style_label && <Stat label="Lash Style" value={lashMap.lash_style_label} />}
        </View>
      )}

      {lashMap.textured_map && (
        <View style={styles.texturedCard}>
          <Text style={styles.texturedTitle}>Base Layer + Spike Map</Text>
          <Text style={styles.texturedPattern}>{lashMap.textured_map.spike_layer.pattern}</Text>
          {isTablet ? (
            <View style={styles.texturedSplit}>
              <View style={styles.texturedSplitPane}>
                <Text style={styles.texturedTabLabel}>Base Layer</Text>
                <LashMapZoneDiagram zones={lashMap.textured_map.base_layer.zones} />
              </View>
              <View style={styles.texturedSplitPane}>
                <Text style={styles.texturedTabLabel}>Spike Layer</Text>
                <LashMapZoneDiagram zones={lashMap.textured_map.spike_layer.zones} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.texturedTabs}>
                <TouchableOpacity
                  style={[styles.texturedTabButton, texturedTab === 'base' && styles.texturedTabButtonActive]}
                  onPress={() => setTexturedTab('base')}>
                  <Text
                    style={[styles.texturedTabButtonText, texturedTab === 'base' && styles.texturedTabButtonTextActive]}>
                    Base Layer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.texturedTabButton, texturedTab === 'spike' && styles.texturedTabButtonActive]}
                  onPress={() => setTexturedTab('spike')}>
                  <Text
                    style={[
                      styles.texturedTabButtonText,
                      texturedTab === 'spike' && styles.texturedTabButtonTextActive,
                    ]}>
                    Spike Layer
                  </Text>
                </TouchableOpacity>
              </View>
              <LashMapZoneDiagram
                zones={
                  texturedTab === 'base'
                    ? lashMap.textured_map.base_layer.zones
                    : lashMap.textured_map.spike_layer.zones
                }
              />
            </>
          )}
        </View>
      )}

      <View style={styles.mappingCard}>
        <Text style={styles.mappingTitle}>Mapping</Text>
        <View style={styles.mappingRow}>
          <Text style={styles.mappingLabel}>Inner</Text>
          <Text style={styles.mappingValue}>
            {lashMap.zone_summary.inner.min}-{lashMap.zone_summary.inner.max}
          </Text>
        </View>
        <View style={styles.mappingRow}>
          <Text style={styles.mappingLabel}>Middle</Text>
          <Text style={styles.mappingValue}>
            {lashMap.zone_summary.middle.min}-{lashMap.zone_summary.middle.max}
          </Text>
        </View>
        <View style={styles.mappingRow}>
          <Text style={styles.mappingLabel}>Outer</Text>
          <Text style={styles.mappingValue}>
            {lashMap.zone_summary.outer.min}-{lashMap.zone_summary.outer.max}
          </Text>
        </View>
        {lashMap.spike_lengths && (
          <Text style={styles.spikeLengths}>
            Spike lengths: {lashMap.spike_lengths.join(', ')}
          </Text>
        )}
      </View>

      <View style={styles.retentionCard}>
        <Text style={styles.mappingTitle}>AI After-Look Preview</Text>
        <Text style={styles.previewHint}>
          Generate a realistic preview of the finished lash look on this client's own
          eye photo.
        </Text>

        <AiConsentCheckbox
          checked={consented}
          onToggle={() => setConsented((v) => !v)}
          purpose="generate a realistic after-look preview of the finished lash set"
        />

        {previewError && <Text style={styles.error}>{previewError}</Text>}

        <TouchableOpacity
          style={[styles.button, (!consented || previewLoading) && styles.buttonDisabled]}
          onPress={createAiPreview}
          disabled={!consented || previewLoading}>
          {previewLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Create</Text>
          )}
        </TouchableOpacity>

        {previews.length > 0 && (
          isTablet ? (
            // iPad: room to show every angle at once, no swiping needed.
            <View style={styles.previewSplit}>
              {previews.map((item) => (
                <View key={item.angle} style={styles.previewSplitPane}>
                  <Text style={styles.previewAngleLabel}>{ANGLE_LABELS[item.angle] ?? item.angle}</Text>
                  {item.mock && <Text style={styles.mockTag}>MOCK PREVIEW</Text>}
                  <Image source={authenticatedImageSource(item.url)} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => savePreview(item.angle, item.url)}
                    disabled={savingPreviewAngle === item.angle}>
                    {savingPreviewAngle === item.angle ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Save to Photos</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            // Phone: not enough width for both at once — swipe between angles instead.
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {previews.map((item) => (
                <View key={item.angle} style={styles.previewCarouselPane}>
                  <Text style={styles.previewAngleLabel}>{ANGLE_LABELS[item.angle] ?? item.angle}</Text>
                  {item.mock && <Text style={styles.mockTag}>MOCK PREVIEW</Text>}
                  <Image source={authenticatedImageSource(item.url)} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => savePreview(item.angle, item.url)}
                    disabled={savingPreviewAngle === item.angle}>
                    {savingPreviewAngle === item.angle ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Save to Photos</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )
        )}
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setShowRetentionCheck((v) => !v)}>
        <Text style={styles.secondaryButtonText}>
          {showRetentionCheck ? 'Hide Retention Check (Pro)' : 'Retention Check (Pro)'}
        </Text>
      </TouchableOpacity>

      {showRetentionCheck && (
        <View style={styles.retentionCard}>
          <TextInput
            style={styles.input}
            placeholder="Days since application"
            keyboardType="number-pad"
            value={days}
            onChangeText={setDays}
          />
          <TextInput
            style={styles.input}
            placeholder="Retention remaining (%)"
            keyboardType="number-pad"
            value={retentionPct}
            onChangeText={setRetentionPct}
          />
          <TextInput
            style={styles.input}
            placeholder="Humidity at application % (optional)"
            keyboardType="number-pad"
            value={humidityPct}
            onChangeText={setHumidityPct}
          />
          <TextInput
            style={styles.input}
            placeholder="Glue used (optional)"
            value={glueUsed}
            onChangeText={setGlueUsed}
          />
          <View style={styles.chipRow}>
            {SYMPTOM_OPTIONS.map((symptom) => (
              <TouchableOpacity
                key={symptom}
                style={[styles.chip, symptoms.includes(symptom) && styles.chipSelected]}
                onPress={() => toggleSymptom(symptom)}>
                <Text
                  style={[
                    styles.chipText,
                    symptoms.includes(symptom) && styles.chipTextSelected,
                  ]}>
                  {symptom}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={checkRetention} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Get Advice</Text>
            )}
          </TouchableOpacity>

          {advice && (
            <View style={styles.adviceBox}>
              {advice.mock && <Text style={styles.mockTag}>MOCK ADVICE</Text>}
              <Text style={styles.adviceText}>{advice.advice}</Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ClientProfile', { clientId })}>
        <Text style={styles.buttonText}>Back to Client</Text>
      </TouchableOpacity>
      </ResponsiveContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, alignSelf: 'flex-start' },
  savedNote: {
    fontSize: 12,
    color: colors.accent,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  difficultyRow: { alignSelf: 'flex-start', marginBottom: 16 },
  chairsideButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  chairsideButtonText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  diagramCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  texturedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  texturedTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
  texturedPattern: { fontSize: 12, color: colors.muted, marginBottom: 12, fontStyle: 'italic' },
  texturedTabs: { flexDirection: 'row', marginBottom: 8 },
  texturedTabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  texturedTabButtonActive: { backgroundColor: colors.primary },
  texturedTabButtonText: { fontSize: 12, fontWeight: '600', color: colors.text },
  texturedTabButtonTextActive: { color: colors.background },
  // iPad only — screen is wide enough to show both layers at once instead of tabbing.
  texturedSplit: { flexDirection: 'row' },
  texturedSplitPane: { flex: 1 },
  texturedTabLabel: { fontSize: 12, fontWeight: '600', color: colors.accent, marginBottom: 4, textAlign: 'center' },
  mappingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    width: '100%',
  },
  mappingTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 },
  mappingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mappingLabel: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  mappingValue: { fontSize: 12, color: colors.text, fontWeight: '600' },
  spikeLengths: { fontSize: 11, color: colors.accent, marginTop: 6 },
  statsRow: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  statLabel: { fontSize: 11, color: colors.accent, marginTop: 4 },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  retentionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    width: '100%',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: 11, color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: colors.background },
  error: { color: '#B3261E', marginBottom: 8, fontSize: 13 },
  adviceBox: { marginTop: 12, backgroundColor: colors.background, borderRadius: 10, padding: 12 },
  mockTag: { fontSize: 10, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  adviceText: { fontSize: 13, color: colors.text },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.5 },
  previewHint: { fontSize: 12, color: colors.text, opacity: 0.7, marginBottom: 12 },
  previewImage: { width: '100%', height: 260, borderRadius: 12 },
  previewAngleLabel: { fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: 16, marginBottom: 6 },
  // iPad: both angles side by side, no swiping needed.
  previewSplit: { flexDirection: 'row', width: '100%' },
  previewSplitPane: { flex: 1, alignItems: 'center', paddingHorizontal: 6 },
  // Phone: each pane fills the carousel's own width so pagingEnabled snaps cleanly.
  previewCarouselPane: { width: '100%', alignItems: 'center' },
});
