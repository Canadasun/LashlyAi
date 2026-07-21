import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { Feedback } from '../types/api';
import { useDeviceClass } from '../hooks/useDeviceClass';

export function FeedbackScreen() {
  const { isTablet } = useDeviceClass();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPriorityPlan, setIsPriorityPlan] = useState(false);
  const [history, setHistory] = useState<Feedback[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const [usage, feedback] = await Promise.all([
        api.get<{ plan: string }>('/users/me/usage'),
        api.get<Feedback[]>('/feedback'),
      ]);
      setIsPriorityPlan(usage.plan !== 'free');
      setHistory(feedback);
    } catch {
      // History is a nice-to-have here — a failed load shouldn't block submitting a
      // new report, so this fails silently rather than surfacing an error banner.
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const submit = async () => {
    if (!message.trim()) {
      setError('Please describe the issue first');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.post('/feedback', {
        message: message.trim(),
        context: { platform: Platform.OS, platformVersion: Platform.Version },
      });
      setMessage('');
      Alert.alert('Thanks!', 'Your report has been sent.');
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
      data={history}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.title}>Report an Issue</Text>
          <Text style={styles.subtitle}>
            Tell us what happened — a crash, something confusing, a wrong-looking lash map.
          </Text>
          {isPriorityPlan && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityBadgeText}>⭐ Priority Support — Pro plan</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="What went wrong?"
            multiline
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={submit} disabled={sending}>
            {sending ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>Send Report</Text>
            )}
          </TouchableOpacity>

          {history.length > 0 && <Text style={styles.historyTitle}>Your reports</Text>}
          {loadingHistory && <ActivityIndicator style={styles.historyLoader} color={colors.primary} />}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.historyCard}>
          <Text style={styles.historyMessage}>{item.message}</Text>
          <Text style={styles.historyMeta}>{new Date(item.created_at).toLocaleDateString()}</Text>
          {item.replies.map((reply) => (
            <View key={reply.id} style={styles.replyCard}>
              <Text style={styles.replyLabel}>Support replied</Text>
              <Text style={styles.replyMessage}>{reply.message}</Text>
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  contentTablet: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.accent, marginTop: 6, marginBottom: 12 },
  priorityBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  priorityBadgeText: { color: colors.background, fontWeight: '700', fontSize: 12 },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  error: { color: '#B3261E', marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  historyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 32, marginBottom: 12 },
  historyLoader: { marginTop: 20 },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  historyMessage: { fontSize: 13, color: colors.text },
  historyMeta: { fontSize: 11, color: colors.accent, marginTop: 6 },
  replyCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  replyLabel: { fontSize: 10, fontWeight: '700', color: colors.primaryDark, marginBottom: 4 },
  replyMessage: { fontSize: 13, color: colors.text },
});
