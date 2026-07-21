import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
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
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { PhotoFeedback } from '../types/api';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'PhotoFeedback'>;

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreLabelRow}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{score}</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${score}%` }]} />
      </View>
    </View>
  );
}

export function PhotoFeedbackScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [feedback, setFeedback] = useState<PhotoFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (fromCamera: boolean) => {
    setError(null);
    setFeedback(null);
    const result = fromCamera
      ? await launchCamera({ mediaType: 'photo', quality: 0.8 })
      : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });

    if (result.didCancel) return;
    if (result.errorMessage) {
      setError(result.errorMessage);
      return;
    }
    const asset = result.assets?.[0];
    if (asset) setPhoto(asset);
  };

  const score = async () => {
    if (!photo?.uri) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', {
        uri: photo.uri,
        name: photo.fileName ?? 'work.jpg',
        type: photo.type ?? 'image/jpeg',
      } as unknown as Blob);

      const result = await api.postForm<PhotoFeedback>(
        `/clients/${clientId}/photo-feedback`,
        form,
      );
      setFeedback(result);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Scoring failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={520}>
      <Text style={styles.title}>Score My Work</Text>
      <Text style={styles.subtitle}>
        Photograph the completed lash application to get AI feedback on isolation,
        direction, and styling.
      </Text>

      {photo?.uri ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo yet</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => pick(true)}>
        <Text style={styles.secondaryButtonText}>Take Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => pick(false)}>
        <Text style={styles.secondaryButtonText}>Choose from Library</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryButton, !photo && styles.disabledButton]}
        onPress={score}
        disabled={!photo || loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.primaryButtonText}>Score This Work</Text>
        )}
      </TouchableOpacity>

      {feedback && (
        <View style={styles.resultsCard}>
          {feedback.mock && (
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>
                MOCK FEEDBACK — no OpenAI key configured on the backend yet
              </Text>
            </View>
          )}
          <ScoreBar label="Isolation" score={feedback.isolation_score} />
          <ScoreBar label="Direction" score={feedback.direction_score} />
          <ScoreBar label="Styling" score={feedback.styling_score} />
          <ScoreBar label="Overall" score={feedback.overall_score} />
          {feedback.notes ? <Text style={styles.notes}>{feedback.notes}</Text> : null}
        </View>
      )}
      </ResponsiveContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.accent, marginTop: 6, marginBottom: 16 },
  preview: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16 },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderText: { color: colors.accent },
  error: { color: '#B3261E', marginBottom: 12, fontSize: 13 },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  resultsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  mockBadge: { backgroundColor: '#FFF3CD', borderRadius: 8, padding: 10, marginBottom: 12 },
  mockBadgeText: { color: '#7A5B00', fontSize: 12, fontWeight: '600' },
  scoreRow: { marginBottom: 14 },
  scoreLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  scoreLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  scoreValue: { fontSize: 13, fontWeight: '700', color: colors.primary },
  scoreTrack: { height: 8, borderRadius: 4, backgroundColor: '#f0e5e0', overflow: 'hidden' },
  scoreFill: { height: 8, backgroundColor: colors.primary },
  notes: { fontSize: 13, color: colors.text, marginTop: 8, fontStyle: 'italic' },
});
