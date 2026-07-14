import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  ScrollView,
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

type Mode = 'caption' | 'reply';

export function MarketingToolsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<Mode>('caption');
  const [input, setInput] = useState('');
  const [caption, setCaption] = useState<{ caption: string; hashtags: string[] } | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!input.trim()) {
      setError('Please enter some text first');
      return;
    }
    setLoading(true);
    setError(null);
    setCaption(null);
    setReply(null);
    try {
      if (mode === 'caption') {
        const result = await api.post<{ caption: string; hashtags: string[] }>(
          '/marketing/caption',
          { post_description: input.trim() },
        );
        setCaption(result);
      } else {
        const result = await api.post<{ reply: string }>('/marketing/reply', {
          client_message: input.trim(),
        });
        setReply(result.reply);
      }
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Marketing Tools</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, mode === 'caption' && styles.tabSelected]}
          onPress={() => setMode('caption')}>
          <Text style={[styles.tabText, mode === 'caption' && styles.tabTextSelected]}>
            Social Caption
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'reply' && styles.tabSelected]}
          onPress={() => setMode('reply')}>
          <Text style={[styles.tabText, mode === 'reply' && styles.tabTextSelected]}>
            Client Reply
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder={
          mode === 'caption'
            ? "Describe the post (e.g. 'mega volume set, dramatic cat-eye')"
            : "Paste the client's message"
        }
        value={input}
        onChangeText={setInput}
        multiline
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={generate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Generate</Text>
        )}
      </TouchableOpacity>

      {caption && (
        <View style={styles.resultCard}>
          <Text selectable style={styles.resultText}>
            {caption.caption}
          </Text>
          <Text selectable style={styles.hashtags}>
            {caption.hashtags.join(' ')}
          </Text>
        </View>
      )}
      {reply && (
        <View style={styles.resultCard}>
          <Text selectable style={styles.resultText}>
            {reply}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  tabRow: { flexDirection: 'row', marginBottom: 16 },
  tab: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  tabSelected: { backgroundColor: colors.primary },
  tabText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  tabTextSelected: { color: colors.background },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    minHeight: 90,
    textAlignVertical: 'top',
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
  resultCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginTop: 20 },
  resultText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  hashtags: { fontSize: 13, color: colors.accent, marginTop: 10 },
});
