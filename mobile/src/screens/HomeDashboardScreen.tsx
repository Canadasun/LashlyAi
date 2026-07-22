import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { api, ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { ClientProfile, InventoryItem } from '../types/api';
import { ResponsiveContainer } from '../components/ResponsiveContainer';
import { useDeviceClass } from '../hooks/useDeviceClass';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

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

const QUICK_ACTIONS: {
  title: string;
  caption: string;
  symbol: string;
  screen: 'NewClient' | 'Coach' | 'MarketingTools' | 'ClientList' | 'FaceDeepScan';
  params?: { pickerMode: 'photoEdit' | 'videoRetouch' };
}[] = [
  { title: 'Add client', caption: 'Start a profile', symbol: '+', screen: 'NewClient' },
  { title: 'Ask AI coach', caption: 'Get guidance', symbol: 'AI', screen: 'Coach' },
  { title: 'Create content', caption: 'Caption or reply', symbol: 'Aa', screen: 'MarketingTools' },
  {
    title: 'Photo editor',
    caption: 'Retouch a photo',
    symbol: '✎',
    screen: 'ClientList',
    params: { pickerMode: 'photoEdit' },
  },
  {
    title: 'Video retouch',
    caption: 'Clean up a clip',
    symbol: '▶',
    screen: 'ClientList',
    params: { pickerMode: 'videoRetouch' },
  },
  { title: 'Face deep scan', caption: 'Live face analysis', symbol: '◎', screen: 'FaceDeepScan' },
];

// Even count on phone (2x3) — an odd count instead falls back to actionCard's flex:1
// stretching the last row's single tile to full width, which still works but this is
// the cleaner layout when it divides evenly.
const QUICK_ACTION_ROWS_PHONE = [
  QUICK_ACTIONS.slice(0, 2),
  QUICK_ACTIONS.slice(2, 4),
  QUICK_ACTIONS.slice(4, 6),
];
// One row of 6 instead of stacked pairs — makes real use of a tablet's extra width
// instead of leaving the same cramped phone grid centered in a lot of empty space.
const QUICK_ACTION_ROWS_TABLET = [QUICK_ACTIONS];

function quotaText(field?: QuotaField) {
  if (!field) return '—';
  return field.limit === null ? `${field.used}` : `${field.used} / ${field.limit}`;
}

export function HomeDashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { session, signOut, verifyEmail, resendVerification } = useAuth();
  const { isTablet } = useDeviceClass();
  const quickActionRows = isTablet ? QUICK_ACTION_ROWS_TABLET : QUICK_ACTION_ROWS_PHONE;

  const confirmSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign back in to access your clients and lash maps.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const promptVerifyEmail = () => {
    Alert.prompt(
      'Verify your email',
      `Enter the code sent to ${session?.email}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async (code?: string) => {
            if (!code?.trim()) return;
            try {
              await verifyEmail(code.trim());
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Invalid or expired code.');
            }
          },
        },
        {
          text: 'Resend code',
          onPress: async () => {
            try {
              await resendVerification();
              Alert.alert('Code sent', 'Check your email for a new code.');
            } catch (err) {
              Alert.alert('Failed to resend', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
      'plain-text',
    );
  };
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientsError, setClientsError] = useState(false);
  const [inventoryError, setInventoryError] = useState(false);
  // Inventory tracking is Pro-only (see backend inventory.routes.ts) — a free-tier
  // user's fetch fails with a 403 by design, not a transient network error, so it
  // needs its own copy ("Pro feature") instead of the generic "Unable to load /
  // pull to refresh", which is actively misleading since refreshing will never fix it.
  const [inventoryLocked, setInventoryLocked] = useState(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setError(null);
      const results = await Promise.allSettled([
        api.get<ClientProfile[]>('/clients'),
        api.get<UsageSummary>('/users/me/usage'),
        api.get<InventoryItem[]>('/inventory'),
      ]);

      setClientsError(results[0].status === 'rejected');
      const inventoryRejected = results[2].status === 'rejected';
      const inventoryReason = inventoryRejected ? (results[2] as PromiseRejectedResult).reason : null;
      const inventoryForbidden = inventoryReason instanceof ApiError && inventoryReason.status === 403;
      setInventoryLocked(inventoryForbidden);
      setInventoryError(inventoryRejected && !inventoryForbidden);
      if (results[0].status === 'fulfilled') setClients(results[0].value);
      if (results[1].status === 'fulfilled') setUsage(results[1].value);
      if (results[2].status === 'fulfilled') setInventory(results[2].value);

      if (results.every((result) => result.status === 'rejected')) {
        const firstFailure = results[0] as PromiseRejectedResult;
        throw firstFailure.reason;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your dashboard could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const recentClients = useMemo(
    () =>
      [...clients]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3),
    [clients],
  );
  const stockAlerts = inventory.filter(
    (item) => item.is_low_stock || item.is_expired || item.is_expiring_soon,
  );
  const firstName = session?.email.split('@')[0].split(/[._-]/)[0] || 'there';
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            tintColor={colors.primary}
          />
        }>
        <ResponsiveContainer maxWidth={900}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>L</Text></View>
            <Text style={styles.brand}>Lashly<Text style={styles.brandAccent}>AI</Text></Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={confirmSignOut} style={styles.avatar}>
            <Text style={styles.avatarText}>{displayName.charAt(0)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.welcomeRow}>
          <View style={styles.welcomeCopy}>
            <Text style={styles.eyebrow}>YOUR BUSINESS, AT A GLANCE</Text>
            <Text style={styles.greeting}>Good to see you, {displayName}.</Text>
          </View>
          <Text style={styles.planPill}>{usage?.plan?.toUpperCase() || 'MY STUDIO'}</Text>
        </View>

        {error && (
          <TouchableOpacity style={styles.errorBanner} onPress={() => loadDashboard()}>
            <Text style={styles.errorText}>{error}  Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {session && !session.emailVerified && (
          <TouchableOpacity style={styles.verifyBanner} onPress={promptVerifyEmail}>
            <Text style={styles.verifyBannerText}>Verify your email  →</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <TouchableOpacity style={[styles.metricCard, styles.metricCardPrimary]} onPress={() => navigation.navigate('ClientList')}>
                <Text style={styles.metricLabelLight}>CLIENT RELATIONSHIPS</Text>
                {clientsError ? (
                  <Text style={styles.metricUnavailableLight}>Unable to load</Text>
                ) : (
                  <Text style={styles.metricValueLight}>{clients.length}</Text>
                )}
                <Text style={styles.metricCaptionLight}>active profiles  →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.metricCard}
                onPress={() => navigation.navigate(inventoryLocked ? 'Paywall' : 'Inventory')}>
                <Text style={styles.metricLabel}>STOCK ATTENTION</Text>
                {inventoryLocked ? (
                  <Text style={styles.metricUnavailable}>Pro feature</Text>
                ) : inventoryError ? (
                  <Text style={styles.metricUnavailable}>Unable to load</Text>
                ) : (
                  <Text style={[styles.metricValue, stockAlerts.length > 0 && styles.alertValue]}>{stockAlerts.length}</Text>
                )}
                <Text style={styles.metricCaption}>
                  {inventoryLocked
                    ? 'upgrade to unlock'
                    : inventoryError
                    ? 'pull to refresh'
                    : stockAlerts.length === 1
                    ? 'item needs action'
                    : 'items need action'}
                  {'  →'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Run your day</Text>
            <Text style={styles.sectionSubtitle}>The things you reach for most, one tap away.</Text>
            <View style={styles.actionGrid}>
              {quickActionRows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.actionRow}>
                  {row.map((action) => (
                    <TouchableOpacity
                      key={action.title}
                      accessibilityRole="button"
                      style={styles.actionCard}
                      onPress={() => (navigation.navigate as (screen: string, params?: object) => void)(action.screen, action.params)}>
                      <View style={styles.actionIcon}><Text style={styles.actionIconText}>{action.symbol}</Text></View>
                      <View style={styles.actionCopy}>
                        <Text style={styles.actionTitle}>{action.title}</Text>
                        <Text style={styles.actionCaption}>{action.caption}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Recent clients</Text>
                <Text style={styles.sectionSubtitle}>Continue where you left off.</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('ClientList')}>
                <Text style={styles.seeAll}>View all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.clientCard}>
              {recentClients.length === 0 ? (
                <TouchableOpacity style={styles.emptyState} onPress={() => navigation.navigate('NewClient')}>
                  <Text style={styles.emptyTitle}>Build your client book</Text>
                  <Text style={styles.emptyText}>Add your first client to save notes, photos and lash maps.</Text>
                </TouchableOpacity>
              ) : recentClients.map((client, index) => (
                <TouchableOpacity
                  key={client.id}
                  style={[styles.clientRow, index < recentClients.length - 1 && styles.clientDivider]}
                  onPress={() => navigation.navigate('ClientProfile', { clientId: client.id })}>
                  <View style={styles.clientInitial}><Text style={styles.clientInitialText}>{client.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={styles.clientCopy}>
                    <Text style={styles.clientName}>{client.name}</Text>
                    <Text style={styles.clientMeta}>{client.eye_analysis ? `${client.eye_analysis.eye_shape} eye profile` : 'Profile ready for analysis'}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.usageCard}>
              <View style={styles.usageHeading}>
                <View>
                  <Text style={styles.usageEyebrow}>THIS PERIOD</Text>
                  <Text style={styles.usageTitle}>AI workspace usage</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Paywall')}><Text style={styles.managePlan}>Manage plan</Text></TouchableOpacity>
              </View>
              <View style={styles.usageStats}>
                <View style={styles.usageStat}><Text style={styles.usageValue}>{quotaText(usage?.eye_scans_this_month)}</Text><Text style={styles.usageLabel}>eye scans</Text></View>
                <View style={styles.usageRule} />
                <View style={styles.usageStat}><Text style={styles.usageValue}>{quotaText(usage?.coach_questions_today)}</Text><Text style={styles.usageLabel}>coach questions</Text></View>
              </View>
            </View>

            <View style={styles.growRow}>
              <TouchableOpacity style={styles.growLink} onPress={() => navigation.navigate('LessonList')}><Text style={styles.growText}>Learn & improve</Text></TouchableOpacity>
              <TouchableOpacity style={styles.growLink} onPress={() => navigation.navigate('ForumList')}><Text style={styles.growText}>Community</Text></TouchableOpacity>
              <TouchableOpacity style={styles.growLink} onPress={() => navigation.navigate('ReferenceGuide')}><Text style={styles.growText}>Reference guide</Text></TouchableOpacity>
              <TouchableOpacity style={styles.growLink} onPress={() => navigation.navigate('AccountSettings')}><Text style={styles.growText}>Settings</Text></TouchableOpacity>
              {session?.isAdmin && (
                <TouchableOpacity style={styles.growLink} onPress={() => navigation.navigate('Admin')}><Text style={styles.growText}>Admin</Text></TouchableOpacity>
              )}
            </View>
          </>
        )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  brandMarkText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  brand: { color: colors.ink, fontWeight: '800', fontSize: 19, letterSpacing: -0.4 },
  brandAccent: { color: colors.primary },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primaryDark, fontWeight: '800', fontSize: 14 },
  welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28, marginBottom: 20 },
  welcomeCopy: { flex: 1, minWidth: 0, marginRight: 12 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },
  greeting: { color: colors.ink, fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  planPill: { color: colors.accent, backgroundColor: colors.accentSoft, fontSize: 9, fontWeight: '800', letterSpacing: 0.7, overflow: 'hidden', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  errorBanner: { backgroundColor: '#FBE8E8', borderRadius: 12, padding: 12, marginBottom: 14 },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  verifyBanner: { backgroundColor: colors.accentSoft, borderRadius: 12, padding: 12, marginBottom: 14 },
  verifyBannerText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  loader: { marginVertical: 70 },
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, minWidth: 0, minHeight: 138, padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metricCardPrimary: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  metricLabelLight: { color: '#E9C8D3', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  metricValue: { color: colors.ink, fontSize: 38, fontWeight: '700', marginTop: 12, letterSpacing: -1 },
  metricValueLight: { color: '#FFFFFF', fontSize: 38, fontWeight: '700', marginTop: 12, letterSpacing: -1 },
  alertValue: { color: colors.danger },
  metricUnavailable: { color: colors.danger, fontSize: 14, fontWeight: '700', marginTop: 16 },
  metricUnavailableLight: { color: '#F6D9DF', fontSize: 14, fontWeight: '700', marginTop: 16 },
  metricCaption: { color: colors.muted, fontSize: 11, marginTop: 3 },
  metricCaptionLight: { color: '#F2DCE3', fontSize: 11, marginTop: 3 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', letterSpacing: -0.25, marginTop: 28 },
  sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  actionGrid: { marginTop: 12, gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, minWidth: 0, minHeight: 76, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center' },
  actionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  actionIconText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  actionCaption: { color: colors.muted, fontSize: 9, marginTop: 3 },
  chevron: { color: colors.primary, fontSize: 22, fontWeight: '400' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  seeAll: { color: colors.primary, fontSize: 12, fontWeight: '700', paddingBottom: 1 },
  clientCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15 },
  clientRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  clientDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  clientInitial: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  clientInitialText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  clientCopy: { flex: 1 },
  clientName: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  clientMeta: { color: colors.muted, fontSize: 10, marginTop: 4, textTransform: 'capitalize' },
  emptyState: { paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  usageCard: { backgroundColor: '#F1ECE8', borderRadius: 18, padding: 17, marginTop: 28 },
  usageHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usageEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  usageTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 4 },
  managePlan: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  usageStats: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  usageStat: { flex: 1 },
  usageValue: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  usageLabel: { color: colors.muted, fontSize: 10, marginTop: 3 },
  usageRule: { width: 1, height: 31, backgroundColor: '#D8CECA', marginHorizontal: 15 },
  growRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 23 },
  growLink: { paddingHorizontal: 16, paddingVertical: 8 },
  growText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});
