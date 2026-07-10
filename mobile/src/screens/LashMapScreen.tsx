import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LashMapZoneDiagram } from '../components/LashMapZoneDiagram';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LashMap'>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

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
  const [showRetentionCheck, setShowRetentionCheck] = useState(false);
  const [days, setDays] = useState('');
  const [retentionPct, setRetentionPct] = useState('');
  const [humidityPct, setHumidityPct] = useState('');
  const [glueUsed, setGlueUsed] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [advice, setAdvice] = useState<{ advice: string; mock: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to get retention advice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lash Map</Text>
      <Text style={styles.savedNote}>Saved to this client's history</Text>

      <View style={styles.diagramCard}>
        <LashMapZoneDiagram zones={lashMap.visual_map.zones} />
      </View>

      <View style={styles.statsRow}>
        <Stat label="Style" value={lashMap.style} />
        <Stat label="Curl" value={lashMap.curl} />
        <Stat label="Diameter" value={lashMap.diameter} />
      </View>
      <View style={styles.statsRow}>
        <Stat label="Fan Type" value={lashMap.fan_type} />
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
  diagramCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
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
});
