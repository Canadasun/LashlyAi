import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

interface Message {
  id: string;
  role: 'user' | 'coach';
  text: string;
  mock?: boolean;
}

interface QuotaField {
  used: number;
  limit: number | null;
}

let nextId = 0;

export function CoachScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [quota, setQuota] = useState<QuotaField | null>(null);
  // TouchableOpacity's `disabled={sending}` only takes effect after the state update
  // re-renders — a fast double-tap in the same tick can slip both calls through
  // before that happens. This ref closes that gap synchronously.
  const sendingRef = useRef(false);

  const loadQuota = useCallback(async () => {
    try {
      const usage = await api.get<{ coach_questions_today: QuotaField }>('/users/me/usage');
      setQuota(usage.coach_questions_today);
    } catch {
      // Non-critical — quota display just won't show.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadQuota();
    }, [loadQuota]),
  );

  const send = async () => {
    const trimmed = question.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    const userMessage: Message = { id: String(nextId++), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setSending(true);

    try {
      const result = await api.post<{ answer: string; mock: boolean }>('/coach/ask', {
        question: trimmed,
      });
      setMessages((prev) => [
        ...prev,
        { id: String(nextId++), role: 'coach', text: result.answer, mock: result.mock },
      ]);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        // Drop the failed question out of the transcript rather than leaving it
        // sitting there with no answer — the Paywall prompt explains why.
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        showQuotaExceededAlert(err, navigation);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: String(nextId++),
            role: 'coach',
            text: err instanceof Error ? err.message : 'Something went wrong',
          },
        ]);
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      loadQuota();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}>
      {quota && quota.limit !== null && (
        <Text style={styles.quotaText}>
          {quota.used}/{quota.limit} questions used today
        </Text>
      )}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Ask the AI Lash Coach a troubleshooting question.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.coachBubble]}>
            {item.mock && <Text style={styles.mockTag}>MOCK</Text>}
            <Text style={item.role === 'user' ? styles.userText : styles.coachText}>{item.text}</Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Why are my fans closing?"
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={send}
        />
        <TouchableOpacity style={styles.sendButton} onPress={send} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  quotaText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 10,
  },
  list: { padding: 16, flexGrow: 1 },
  empty: { color: colors.text, opacity: 0.6, textAlign: 'center', marginTop: 40 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 10, maxWidth: '85%' },
  userBubble: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  coachBubble: { backgroundColor: '#ffffff', alignSelf: 'flex-start' },
  userText: { color: colors.background },
  coachText: { color: colors.text },
  mockTag: { fontSize: 9, color: colors.accent, fontWeight: '700', marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendButtonText: { color: colors.background, fontWeight: '700' },
});
