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
import { useDeviceClass } from '../hooks/useDeviceClass';
import { ClientProfileView } from './ClientProfileView';
import { DifficultyBadge } from '../components/DifficultyBadge';

// Most recent lash map that has a difficulty score — older maps predate this feature
// and have no score, so they're skipped rather than treated as a 0 (Quick).
function latestDifficulty(client: ClientProfile) {
  const scored = client.lash_history.filter((entry) => entry.difficulty_label);
  return scored.length ? scored[scored.length - 1] : undefined;
}

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

interface ToolChip {
  label: string;
  screen: keyof RootStackParamList;
  params?: { pickerMode: 'photoEdit' };
  // Tablet-only entry points: the bigger iPad screen has room for cross-client
  // analytics views a phone-sized tool row doesn't (see the retention-insights audit).
  tabletOnly?: boolean;
}

const TOOLS: ToolChip[] = [
  { label: 'Ask the Coach', screen: 'Coach' },
  { label: 'Photo Editor', screen: 'ClientList', params: { pickerMode: 'photoEdit' } },
  { label: 'Lessons', screen: 'LessonList' },
  { label: 'Community', screen: 'ForumList' },
  { label: 'Inventory', screen: 'Inventory' },
  { label: 'Marketing', screen: 'MarketingTools' },
  { label: 'Retention Analytics', screen: 'RetentionAnalytics', tabletOnly: true },
  { label: 'Report Issue', screen: 'Feedback' },
  { label: 'Upgrade', screen: 'Paywall' },
];

export function ClientListScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { isTablet } = useDeviceClass();
  const pickerMode = route.params?.pickerMode === 'photoEdit';
  // Split view only makes sense for normal browsing — picker mode already has its own
  // tap behavior (import/use-last-photo prompt), so it keeps pushing PhotoEditor
  // full-screen exactly as on phone regardless of device size.
  const splitView = isTablet && !pickerMode;
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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
  // iPad-only: the phone list stays a plain recency-ordered list (matches the server's
  // default ORDER BY created_at DESC) — the bigger iPad screen has room for a client
  // triage view sorted by how technical their next appointment is likely to be.
  const [sortByDifficulty, setSortByDifficulty] = useState(false);

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
      // Split view: land on the first client instead of an empty detail pane, but
      // only if nothing is already selected — a search that narrows the list must
      // not yank the user away from whoever they already have open.
      if (splitView) {
        setSelectedClientId((prev) => prev ?? result[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [splitView]);

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

  const displayedClients =
    isTablet && sortByDifficulty
      ? [...clients].sort((a, b) => {
          const scoreA = latestDifficulty(a)?.difficulty_score;
          const scoreB = latestDifficulty(b)?.difficulty_score;
          if (scoreA == null && scoreB == null) return 0;
          if (scoreA == null) return 1; // unscored clients sort to the end
          if (scoreB == null) return -1;
          return scoreB - scoreA;
        })
      : clients;

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
    if (splitView) {
      setSelectedClientId(client.id);
      return;
    }
    navigation.navigate('ClientProfile', { clientId: client.id });
  };

  return (
    <View style={[styles.container, splitView && styles.containerSplit]}>
      <View style={splitView ? styles.listPaneSplit : styles.listPaneFull}>
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

      {isTablet && !pickerMode && (
        <TouchableOpacity
          style={styles.sortToggle}
          onPress={() => setSortByDifficulty((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel="Toggle sort by service difficulty">
          <Text style={[styles.sortToggleText, sortByDifficulty && styles.sortToggleTextActive]}>
            {sortByDifficulty ? '✓ Sorted by difficulty' : 'Sort by difficulty'}
          </Text>
        </TouchableOpacity>
      )}

      {!pickerMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.toolsRow}
          contentContainerStyle={styles.toolsRowContent}>
          {TOOLS.filter((tool) => !tool.tabletOnly || isTablet).map((tool) => (
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
          data={displayedClients}
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
            const difficulty = latestDifficulty(item);
            return (
              <TouchableOpacity
                style={[
                  styles.clientRow,
                  disabledInPicker && styles.clientRowMuted,
                  splitView && item.id === selectedClientId && styles.clientRowSelected,
                ]}
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
                  {!pickerMode && difficulty?.difficulty_label && (
                    <DifficultyBadge label={difficulty.difficulty_label} compact />
                  )}
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

      {splitView && (
        <View style={styles.detailPane}>
          {selectedClientId ? (
            <ClientProfileView
              key={selectedClientId}
              clientId={selectedClientId}
              navigation={navigation}
              onDeleted={() => {
                setSelectedClientId(null);
                loadClients(debouncedQuery);
              }}
            />
          ) : (
            <View style={styles.detailEmpty}>
              <Text style={styles.detailEmptyText}>Select a client to view their profile.</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  containerSplit: { flexDirection: 'row' },
  listPaneFull: { flex: 1 },
  // Fixed-width list column (not flex:1) so the detail pane on its right gets the
  // rest of the iPad's width instead of a 50/50 split — mirrors Mail/Notes-style
  // master-detail proportions.
  listPaneSplit: { width: 380, borderRightWidth: 1, borderRightColor: colors.border },
  detailPane: { flex: 1, backgroundColor: colors.background },
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  detailEmptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  clientRowSelected: { borderColor: colors.primary, borderWidth: 2 },
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
  sortToggle: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginLeft: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortToggleText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  sortToggleTextActive: { color: colors.primary },
  toolsRow: { marginTop: 12, paddingLeft: 16 },
  // Without this, the ScrollView's inner content container has no cross-axis
  // constraint, so each chip's default alignItems:'stretch' pulls it to fill the
  // full available row height instead of staying a compact pill — the actual bug.
  toolsRowContent: { alignItems: 'flex-start', paddingRight: 16 },
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
