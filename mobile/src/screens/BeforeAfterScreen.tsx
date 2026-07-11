import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, authenticatedImageSource } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ClientProfile, PhotoFeedback } from '../types/api';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';

type Props = NativeStackScreenProps<RootStackParamList, 'BeforeAfter'>;

export function BeforeAfterScreen({ route }: Props) {
  const { clientId } = route.params;
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [photoFeedback, setPhotoFeedback] = useState<PhotoFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [clientResult, feedbackResult] = await Promise.all([
        api.get<ClientProfile>(`/clients/${clientId}`),
        api.get<PhotoFeedback[]>(`/clients/${clientId}/photo-feedback`),
      ]);
      setClient(clientResult);
      setPhotoFeedback(feedbackResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !client) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Client not found'}</Text>
      </View>
    );
  }

  const beforePhoto = client.photos[client.photos.length - 1];
  const afterPhoto = photoFeedback[0]?.photo_url;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Before & After</Text>
      <Text style={styles.subtitle}>{client.name}</Text>

      {beforePhoto && afterPhoto ? (
        <>
          <BeforeAfterSlider beforeUri={beforePhoto} afterUri={afterPhoto} />
          <Text style={styles.hint}>Drag the handle to compare.</Text>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Before</Text>
              {beforePhoto ? (
                <Image source={authenticatedImageSource(beforePhoto)} style={styles.photo} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>No eye photo yet</Text>
                </View>
              )}
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>After</Text>
              {afterPhoto ? (
                <Image source={authenticatedImageSource(afterPhoto)} style={styles.photo} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>No completed-work photo yet</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.hint}>
            Upload an eye photo (New Eye Photo + Lash Map) and a completed-work photo
            (Score My Work) for this client to see a full drag-to-compare view.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { color: '#B3261E' },
  content: { padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.accent, marginTop: 4, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  column: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', color: colors.accent, marginBottom: 8, textAlign: 'center' },
  photo: { width: '100%', height: 220, borderRadius: 12 },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  placeholderText: { color: colors.accent, fontSize: 11, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.text, opacity: 0.7, marginTop: 20, textAlign: 'center' },
});
