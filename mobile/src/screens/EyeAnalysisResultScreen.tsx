import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { LashMap } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'EyeAnalysisResult'>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function EyeAnalysisResultScreen({ route, navigation }: Props) {
  const { clientId, eyeAnalysis, photoUrl } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLashMap = async () => {
    setLoading(true);
    setError(null);
    try {
      const lashMap = await api.post<LashMap>(`/clients/${clientId}/lash-map`);
      navigation.replace('LashMap', { clientId, lashMap });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate lash map');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image source={{ uri: photoUrl }} style={styles.photo} />

      {eyeAnalysis.mock && (
        <View style={styles.mockBadge}>
          <Text style={styles.mockBadgeText}>
            MOCK ANALYSIS — no OpenAI key configured on the backend yet
          </Text>
        </View>
      )}

      <Text style={styles.title}>Eye Analysis</Text>
      <Row label="Eye shape" value={eyeAnalysis.eye_shape} />
      <Row label="Lash density" value={eyeAnalysis.lash_density} />
      <Row label="Natural lash length" value={eyeAnalysis.lash_length_natural} />
      {eyeAnalysis.notes ? <Text style={styles.notes}>{eyeAnalysis.notes}</Text> : null}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={generateLashMap} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Generate Lash Map</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  photo: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16 },
  mockBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  mockBadgeText: { color: '#7A5B00', fontSize: 12, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
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
  error: { color: '#B3261E', marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
