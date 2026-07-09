import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LessonDetail'>;

export function LessonDetailScreen({ route }: Props) {
  const { lesson } = route.params;
  const [completed, setCompleted] = useState(lesson.completed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
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
