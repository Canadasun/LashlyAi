import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ForumComment, ForumPostDetail } from '../types/api';
import { useDeviceClass } from '../hooks/useDeviceClass';

type Props = NativeStackScreenProps<RootStackParamList, 'ForumPostDetail'>;

export function ForumPostDetailScreen({ navigation, route }: Props) {
  const { postId } = route.params;
  const { isTablet } = useDeviceClass();
  const [post, setPost] = useState<ForumPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get<ForumPostDetail>(`/forum/posts/${postId}`);
      setPost(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await api.post(`/forum/posts/${postId}/comments`, { body: comment.trim() });
      setComment('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add comment');
    } finally {
      setSending(false);
    }
  };

  const promptReport = (kind: 'post' | 'comment', id: string) => {
    Alert.prompt(
      'Report this content',
      'Tell us what’s wrong with it — an admin will review.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (reason?: string) => {
            if (!reason?.trim()) return;
            try {
              const path = kind === 'post' ? `/forum/posts/${id}/report` : `/forum/comments/${id}/report`;
              await api.post(path, { reason: reason.trim() });
              Alert.alert('Reported', 'Thanks — an admin will take a look.');
            } catch (err) {
              Alert.alert('Failed to report', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
      'plain-text',
    );
  };

  const confirmBlock = (userId: string, displayName: string) => {
    Alert.alert(
      `Block ${displayName}?`,
      "You won't see their posts or comments anymore.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/forum/block/${userId}`, {});
              navigation.goBack();
            } catch (err) {
              Alert.alert('Failed to block', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Post not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList<ForumComment>
        data={post.comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
        ListHeaderComponent={
          <View style={styles.postCard}>
            <Text style={styles.title}>{post.title}</Text>
            <Text style={styles.meta}>{post.author_display_name}</Text>
            <Text style={styles.body}>{post.body}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => promptReport('post', post.id)}>
                <Text style={styles.actionText}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmBlock(post.user_id, post.author_display_name)}>
                <Text style={styles.actionText}>Block {post.author_display_name}</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Text style={styles.commentAuthor}>{item.author_display_name}</Text>
            <Text style={styles.commentBody}>{item.body}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => promptReport('comment', item.id)}>
                <Text style={styles.actionTextSmall}>Report</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmBlock(item.user_id, item.author_display_name)}>
                <Text style={styles.actionTextSmall}>Block {item.author_display_name}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={[styles.commentInputRow, isTablet && styles.commentInputRowTablet]}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          value={comment}
          onChangeText={setComment}
        />
        <TouchableOpacity style={styles.sendButton} onPress={addComment} disabled={sending}>
          {sending ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { color: '#B3261E' },
  list: { padding: 16 },
  listTablet: { maxWidth: 700, width: '100%', alignSelf: 'center' },
  postCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 16, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.accent, marginTop: 4, marginBottom: 10 },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  actionText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  actionTextSmall: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  commentRow: { backgroundColor: '#ffffff', borderRadius: 10, padding: 12, marginBottom: 8 },
  commentAuthor: { fontSize: 11, color: colors.accent, fontWeight: '600' },
  commentBody: { fontSize: 13, color: colors.text, marginTop: 4 },
  commentInputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: colors.background,
  },
  commentInputRowTablet: { maxWidth: 700, width: '100%', alignSelf: 'center' },
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
