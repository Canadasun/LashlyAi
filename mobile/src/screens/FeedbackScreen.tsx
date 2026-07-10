import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';

export function FeedbackScreen() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPriorityPlan, setIsPriorityPlan] = useState(false);

  useEffect(() => {
    api
      .get<{ plan: string }>('/users/me/usage')
      .then((usage) => setIsPriorityPlan(usage.plan !== 'free'))
      .catch(() => setIsPriorityPlan(false));
  }, []);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
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
});
