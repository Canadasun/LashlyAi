import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
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
import { ForumPost } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ForumList'>;

export function ForumListScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get<ForumPost[]>('/forum/posts');
      setPosts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forum');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const createPost = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    try {
      await api.post('/forum/posts', { title: title.trim(), body: body.trim() });
      setTitle('');
      setBody('');
      setShowNewPost(false);
      load();
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create post');
      }
    }
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
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No posts yet — start the conversation.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ForumPostDetail', { postId: item.id })}>
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowMeta}>
              {item.author_email} · {item.comment_count} comment
              {item.comment_count === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        )}
      />

      {showNewPost && (
        <View style={styles.newPostForm}>
          <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
          <TextInput
            style={[styles.input, styles.bodyInput]}
            placeholder="What's on your mind?"
            value={body}
            onChangeText={setBody}
            multiline
          />
          <TouchableOpacity style={styles.saveButton} onPress={createPost}>
            <Text style={styles.saveButtonText}>Post</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowNewPost((v) => !v)}>
        <Text style={styles.fabText}>{showNewPost ? 'Cancel' : '+ New Post'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { color: '#B3261E', paddingHorizontal: 16 },
  empty: { color: colors.text, opacity: 0.6, textAlign: 'center', marginTop: 40 },
  list: { padding: 16 },
  row: { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, marginBottom: 8 },
  rowTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  rowMeta: { color: colors.accent, fontSize: 12, marginTop: 4 },
  newPostForm: { backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
    color: colors.text,
  },
  bodyInput: { minHeight: 70, textAlignVertical: 'top' },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: colors.background, fontWeight: '700' },
  fab: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fabText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
