import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'LessonDetail'>;

export function LessonDetailScreen({ route, navigation }: Props) {
  const { lesson } = route.params;
  const [completed, setCompleted] = useState(lesson.completed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defensive backstop — LessonListScreen already stops a locked lesson from
  // navigating here, but a deep link or a plan change mid-session could still land
  // on this screen with no content (the backend never sends locked-lesson content).
  if (lesson.locked || !lesson.content) {
    return (
      <View style={styles.centered}>
        <ResponsiveContainer maxWidth={520}>
        <Text style={styles.title}>{lesson.title}</Text>
        <Text style={styles.summary}>{lesson.summary}</Text>
        <Text style={styles.lockedText}>This lesson is part of the full curriculum on Pro.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Paywall')}>
          <Text style={styles.buttonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
        </ResponsiveContainer>
      </View>
    );
  }

  const markComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/lessons/${lesson.id}/complete`);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={640}>
      <View style={styles.draftBadge}>
        <Text style={styles.draftBadgeText}>DRAFT — full lesson content coming soon</Text>
      </View>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.summary}>{lesson.summary}</Text>
      <Text style={styles.body}>{lesson.content}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, completed && styles.buttonDone]}
        onPress={markComplete}
        disabled={loading || completed}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>{completed ? '✓ Completed' : 'Mark as Complete'}</Text>
        )}
      </TouchableOpacity>
      </ResponsiveContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  centered: { flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center' },
  lockedText: { fontSize: 14, color: colors.text, marginTop: 16, marginBottom: 20, textAlign: 'center' },
  draftBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  draftBadgeText: { fontSize: 10, fontWeight: '700', color: '#7A5B00' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  summary: { fontSize: 13, color: colors.accent, marginTop: 8, marginBottom: 16 },
  body: { fontSize: 14, color: colors.text, lineHeight: 22 },
  error: { color: '#B3261E', marginTop: 16, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDone: { backgroundColor: '#9BBF9B' },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
