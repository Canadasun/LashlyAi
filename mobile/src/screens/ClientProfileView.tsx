import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, authenticatedImageSource } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ClientProfile, ClientRetentionInsights, LashMap } from '../types/api';

interface ClientProfileViewProps {
  clientId: string;
  navigation: NativeStackNavigationProp<RootStackParamList>;
  // Split-view mode (tablet ClientListScreen embeds this in a detail pane) calls this
  // instead of navigating to Dashboard after a delete, since there's no "back" to go
  // to — the list pane is already on screen right next to this one.
  onDeleted?: () => void;
}

/**
 * The actual client-detail content, extracted out of ClientProfileScreen so it can be
 * rendered two ways: as a normal full-screen pushed route (ClientProfileScreen.tsx,
 * phone and tablet alike when reached via search/deep-link) and embedded directly in
 * ClientListScreen's tablet split-view detail pane (no navigation involved — just a
 * clientId prop and a re-render when the list selection changes).
 */
export function ClientProfileView({ clientId, navigation, onDeleted }: ClientProfileViewProps) {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [lashMaps, setLashMaps] = useState<LashMap[]>([]);
  const [retentionInsights, setRetentionInsights] = useState<ClientRetentionInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = () => {
    Alert.alert(
      'Delete client?',
      'This permanently deletes the client profile, photos, analyses and lash maps.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/clients/${clientId}`);
              if (onDeleted) {
                onDeleted();
              } else {
                navigation.navigate('Dashboard');
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete client');
            }
          },
        },
      ],
    );
  };

  const load = useCallback(async () => {
    try {
      setError(null);
      const [clientResult, mapsResult] = await Promise.all([
        api.get<ClientProfile>(`/clients/${clientId}`),
        api.get<LashMap[]>(`/clients/${clientId}/lash-maps`),
      ]);
      setClient(clientResult);
      setLashMaps(mapsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setLoading(false);
    }

    // Separate from the load above: a free-tier 403 here shouldn't break the rest of
    // the screen, so this section just stays empty rather than surfacing an error.
    try {
      const insights = await api.get<ClientRetentionInsights>(`/clients/${clientId}/retention-insights`);
      setRetentionInsights(insights);
    } catch {
      setRetentionInsights(null);
    }
  }, [clientId]);

  // clientId changing is the split-view case (a new list selection while this
  // component stays mounted) — reset to a loading state so the previous client's
  // content doesn't linger under the new selection. The pushed-route case only ever
  // mounts with one clientId for its whole lifetime, so this simply matches the
  // original mount-time loading=true there, with no extra flicker.
  useEffect(() => {
    setClient(null);
    setLoading(true);
  }, [clientId]);

  // Refetches on every focus (e.g. returning from CameraUpload having added a new
  // lash map) WITHOUT resetting loading — deliberately keeps showing the current data
  // while refreshing in the background instead of flashing back to a spinner.
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{client.name}</Text>
      {client.notes ? <Text style={styles.notes}>{client.notes}</Text> : null}

      {client.photos.length > 0 && (
        <>
          <Image
            source={authenticatedImageSource(client.photos[client.photos.length - 1])}
            style={styles.photo}
          />
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate('PhotoEditor', {
                clientId,
                photoUri: client.photos[client.photos.length - 1],
              })
            }>
            <Text style={styles.secondaryButtonText}>Edit Photo (Pro)</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('CameraUpload', { clientId })}>
        <Text style={styles.primaryButtonText}>New Eye Photo + Lash Map</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('PhotoFeedback', { clientId })}>
        <Text style={styles.secondaryButtonText}>Score My Work</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('BeforeAfter', { clientId })}>
        <Text style={styles.secondaryButtonText}>Before & After</Text>
      </TouchableOpacity>

      {client.eye_analysis && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('EyeAnalysisResult', { clientId })}>
          <Text style={styles.secondaryButtonText}>View Latest Full Scan</Text>
        </TouchableOpacity>
      )}

      {retentionInsights && retentionInsights.checks.length > 0 && (
        <View style={styles.retentionCard}>
          <Text style={styles.retentionTitle}>Retention Trend</Text>
          {retentionInsights.next_fill_estimate && (
            <Text style={styles.retentionFillEstimate}>
              {retentionInsights.next_fill_estimate.estimated_days_remaining === 0
                ? 'Likely due for a fill now (estimate)'
                : `Next fill in ~${retentionInsights.next_fill_estimate.estimated_days_remaining} days (estimate)`}
            </Text>
          )}
          {retentionInsights.checks
            .slice(-3)
            .reverse()
            .map((check) => (
              <View key={check.id} style={styles.retentionRow}>
                <Text style={styles.retentionRowText}>
                  Day {check.days_since_application} · {Math.round(Number(check.retention_pct))}% retained
                  {check.glue_used ? ` · ${check.glue_used}` : ''}
                </Text>
                <Text style={styles.retentionRowDate}>{new Date(check.created_at).toLocaleDateString()}</Text>
              </View>
            ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Lash Map History</Text>
      {lashMaps.length === 0 ? (
        <Text style={styles.empty}>No lash maps saved yet.</Text>
      ) : (
        <FlatList
          data={lashMaps}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.mapRow}
              onPress={() => navigation.navigate('LashMap', { clientId, lashMap: item })}>
              <Text style={styles.mapStyle}>
                {item.style} · {item.curl} curl
              </Text>
              <Text style={styles.mapDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
        <Text style={styles.deleteButtonText}>Delete client and photos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  error: { color: '#B3261E' },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  notes: { fontSize: 13, color: colors.accent, marginTop: 4, fontStyle: 'italic' },
  photo: { width: '100%', height: 200, borderRadius: 12, marginTop: 16 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 28, marginBottom: 10 },
  empty: { color: colors.text, opacity: 0.6 },
  retentionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  retentionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8 },
  retentionFillEstimate: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  retentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  retentionRowText: { fontSize: 12, color: colors.text, flex: 1, marginRight: 8 },
  retentionRowDate: { fontSize: 11, color: colors.muted },
  mapRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mapStyle: { color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  mapDate: { color: colors.accent, fontSize: 12 },
  deleteButton: { alignItems: 'center', paddingVertical: 14, marginTop: 20 },
  deleteButtonText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
