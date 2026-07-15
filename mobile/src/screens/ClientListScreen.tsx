import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { api, authenticatedImageSource } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ClientProfile } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientList'>;

interface QuotaField {
  used: number;
  limit: number | null;
}

interface UsageSummary {
  plan: string;
  enforced: boolean;
  client_profiles: QuotaField;
  coach_questions_today: QuotaField;
  eye_scans_this_month: QuotaField;
}

function quotaLabel(field: QuotaField) {
  return field.limit === null ? `${field.used}` : `${field.used}/${field.limit}`;
}

const TOOLS: { label: string; screen: keyof RootStackParamList; params?: { pickerMode: 'photoEdit' } }[] = [
  { label: 'Ask the Coach', screen: 'Coach' },
  { label: 'Photo Editor', screen: 'ClientList', params: { pickerMode: 'photoEdit' } },
  { label: 'Lessons', screen: 'LessonList' },
  { label: 'Community', screen: 'ForumList' },
  { label: 'Inventory', screen: 'Inventory' },
  { label: 'Marketing', screen: 'MarketingTools' },
  { label: 'Report Issue', screen: 'Feedback' },
  { label: 'Upgrade', screen: 'Paywall' },
];

export function ClientListScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const pickerMode = route.params?.pickerMode === 'photoEdit';

  const confirmSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign back in to access your clients and lash maps.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(queryInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [queryInput]);

  const loadClients = useCallback(async (search: string) => {
    try {
      setError(null);
      const suffix = search ? `?q=${encodeURIComponent(search)}` : '';
      const result = await api.get<ClientProfile[]>(`/clients${suffix}`);
      setClients(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const result = await api.get<UsageSummary>('/users/me/usage');
      setUsage(result);
    } catch {
      // Non-critical for this screen — the client list itself still loads.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClients(debouncedQuery);
      loadUsage();
    }, [loadClients, loadUsage, debouncedQuery]),
  );

  // Photo Editor picker mode: a client may already have photos from the eye-scan
  // flow, but the editor should also work on any photo imported fresh from the
  // library — not just the most recently captured one.
  const importPhotoFor = async (client: ClientProfile) => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.didCancel) return;
    if (result.errorMessage) {
      Alert.alert('Could not import photo', result.errorMessage);
      return;
    }
    const asset = result.assets?.[0];
    if (asset?.uri) {
      navigation.navigate('PhotoEditor', { clientId: client.id, photoUri: asset.uri });
    }
  };

  const openClient = (client: ClientProfile) => {
    if (pickerMode) {
      if (client.photos.length > 0) {
        Alert.alert(
          'Choose a Photo',
          `Edit ${client.name}'s most recent photo, or import a different one from your library.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import New Photo', onPress: () => importPhotoFor(client) },
            {
              text: 'Use Last Photo',
              onPress: () =>
                navigation.navigate('PhotoEditor', {
                  clientId: client.id,
                  photoUri: client.photos[client.photos.length - 1],
                }),
            },
          ],
        );
      } else {
        importPhotoFor(client);
      }
      return;
    }
    navigation.navigate('ClientProfile', { clientId: client.id });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          {!pickerMode && (
            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => navigation.navigate('Dashboard')}
              accessibilityLabel="Go to Home">
              <Text style={styles.homeButtonText}>‹ Home</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{pickerMode ? 'Photo Editor' : 'LashlyAI'}</Text>
          {pickerMode && <Text style={styles.headerSubtitle}>Choose a client to edit a photo</Text>}
        </View>
        <TouchableOpacity onPress={pickerMode ? () => navigation.goBack() : confirmSignOut}>
          <Text style={styles.link}>{pickerMode ? 'Cancel' : 'Sign out'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients by name"
          placeholderTextColor={colors.muted}
          value={queryInput}
          onChangeText={setQueryInput}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {!pickerMode && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolsRow}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.label}
              style={styles.toolChip}
              onPress={() => (navigation.navigate as (screen: string, params?: object) => void)(tool.screen, tool.params)}>
              <Text style={styles.toolChipText}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!pickerMode && usage && (
        <View style={styles.usageBanner}>
          <Text style={styles.usageText}>
            {usage.plan.toUpperCase()} plan{usage.enforced ? '' : ' (limits not enforced yet)'}
            {'  ·  '}
            {quotaLabel(usage.client_profiles)} clients
            {'  ·  '}
            {quotaLabel(usage.coach_questions_today)} coach Qs today
            {'  ·  '}
            {quotaLabel(usage.eye_scans_this_month)} scans this month
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {debouncedQuery ? `No clients match "${debouncedQuery}".` : 'No clients yet — add your first one.'}
            </Text>
          }
          renderItem={({ item }) => {
            const hasPhoto = item.photos.length > 0;
            const disabledInPicker = pickerMode && !hasPhoto;
            return (
              <TouchableOpacity
                style={[styles.clientRow, disabledInPicker && styles.clientRowMuted]}
                onPress={() => openClient(item)}>
                {hasPhoto ? (
                  <Image
                    source={authenticatedImageSource(item.photos[item.photos.length - 1])}
                    style={styles.avatarPhoto}
                  />
                ) : (
                  <View style={styles.avatarInitial}>
                    <Text style={styles.avatarInitialText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.clientCopy}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientMeta}>
                    {disabledInPicker
                      ? 'No photo yet — tap to add one'
                      : item.eye_analysis
                      ? `${item.eye_analysis.eye_shape} eye profile`
                      : 'Profile ready for analysis'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {!pickerMode && (
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewClient')}>
          <Text style={styles.fabText}>+ New Client</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerLeft: { flex: 1 },
  homeButton: { marginBottom: 4, alignSelf: 'flex-start' },
  homeButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  headerSubtitle: { fontSize: 12, color: colors.muted, marginTop: 3 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13, paddingTop: 2 },
  searchRow: { paddingHorizontal: 16, marginTop: 14 },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  toolsRow: { marginTop: 12, paddingLeft: 16 },
  toolChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  toolChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  usageBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  usageText: { fontSize: 11, color: colors.text },
  loading: { marginTop: 40 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
  list: { padding: 16 },
  clientRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientRowMuted: { opacity: 0.6 },
  avatarPhoto: { width: 44, height: 44, borderRadius: 13, marginRight: 12 },
  avatarInitial: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitialText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  clientCopy: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  clientMeta: { fontSize: 11, color: colors.muted, marginTop: 3, textTransform: 'capitalize' },
  chevron: { color: colors.primary, fontSize: 22, fontWeight: '400' },
  fab: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fabText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
