import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { Lesson } from '../types/api';
import { useDeviceClass } from '../hooks/useDeviceClass';

type Props = NativeStackScreenProps<RootStackParamList, 'LessonList'>;

export function LessonListScreen({ navigation }: Props) {
  const { isTablet } = useDeviceClass();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get<Lesson[]>('/lessons');
      setLessons(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const completedCount = lessons.filter((l) => l.completed).length;

  const openLesson = (lesson: Lesson) => {
    if (lesson.locked) {
      Alert.alert(
        'Pro lesson',
        `"${lesson.title}" is part of the full curriculum on Pro. Upgrade to unlock all 10 lessons.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Paywall') },
        ],
      );
      return;
    }
    navigation.navigate('LessonDetail', { lesson });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>
        {completedCount} / {lessons.length} lessons complete
      </Text>
      <Text style={styles.draftNote}>Lesson content is in draft — full curriculum coming soon</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={lessons}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, item.locked && styles.rowLocked]} onPress={() => openLesson(item)}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>
                {item.order_index}. {item.title}
                {item.locked && <Text style={styles.lockBadge}>  🔒 Pro</Text>}
              </Text>
              <Text style={styles.rowSummary}>{item.summary}</Text>
            </View>
            {item.completed && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    padding: 16,
    paddingBottom: 0,
  },
  draftNote: {
    fontSize: 11,
    color: '#7A5B00',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  error: { color: '#B3261E', paddingHorizontal: 16 },
  list: { padding: 16 },
  listTablet: { maxWidth: 700, width: '100%', alignSelf: 'center' },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLocked: { opacity: 0.6 },
  rowText: { flex: 1 },
  rowTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  lockBadge: { color: colors.accent, fontWeight: '700', fontSize: 11 },
  rowSummary: { color: colors.accent, fontSize: 12, marginTop: 4 },
  checkmark: { color: colors.primary, fontWeight: '700', fontSize: 18, marginLeft: 8 },
});
