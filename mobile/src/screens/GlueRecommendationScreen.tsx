import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';

interface GlueRecommendation {
  band: 'low' | 'ideal' | 'high';
  recommended_viscosity: string;
  approx_bonding_time: string;
  notes: string;
}

export function GlueRecommendationScreen() {
  const [humidity, setHumidity] = useState('');
  const [result, setResult] = useState<GlueRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    const humidityNum = Number(humidity);
    if (!humidity || Number.isNaN(humidityNum) || humidityNum < 0 || humidityNum > 100) {
      setError('Enter humidity as a number between 0 and 100');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const recommendation = await api.post<GlueRecommendation>('/tools/glue-recommendation', {
        humidity_pct: humidityNum,
      });
      setResult(recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recommendation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Glue & Humidity Guide</Text>
      <Text style={styles.subtitle}>
        Enter the current room humidity to get a glue viscosity and bonding-time
        recommendation.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Room humidity (%)"
        keyboardType="number-pad"
        value={humidity}
        onChangeText={setHumidity}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={check} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Get Recommendation</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultBand}>{result.band.toUpperCase()} HUMIDITY</Text>
          <Text style={styles.resultLabel}>Recommended viscosity</Text>
          <Text style={styles.resultValue}>{result.recommended_viscosity}</Text>
          <Text style={styles.resultLabel}>Approx. bonding time</Text>
          <Text style={styles.resultValue}>{result.approx_bonding_time}</Text>
          <Text style={styles.resultNotes}>{result.notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.accent, marginTop: 6, marginBottom: 20 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: '#B3261E', marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  resultCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginTop: 24 },
  resultBand: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  resultLabel: { fontSize: 11, color: colors.accent, marginTop: 8 },
  resultValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  resultNotes: { fontSize: 12, color: colors.text, marginTop: 10, fontStyle: 'italic' },
});
