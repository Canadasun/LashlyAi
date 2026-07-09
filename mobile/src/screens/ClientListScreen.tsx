import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
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

const TOOLS: { label: string; screen: keyof RootStackParamList }[] = [
  { label: 'Ask the Coach', screen: 'Coach' },
  { label: 'Lessons', screen: 'LessonList' },
  { label: 'Community', screen: 'ForumList' },
  { label: 'Inventory', screen: 'Inventory' },
  { label: 'Marketing', screen: 'MarketingTools' },
  { label: 'Glue Guide', screen: 'GlueRecommendation' },
  { label: 'Report Issue', screen: 'Feedback' },
  { label: 'Upgrade', screen: 'Paywall' },
];

export function ClientListScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [clientsResult, usageResult] = await Promise.all([
        api.get<ClientProfile[]>('/clients'),
        api.get<UsageSummary>('/users/me/usage'),
      ]);
      setClients(clientsResult);
      setUsage(usageResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LashlyAI</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolsRow}>
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.screen}
            style={styles.toolChip}
            onPress={() => navigation.navigate(tool.screen as never)}>
            <Text style={styles.toolChipText}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {usage && (
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
          ListEmptyComponent={<Text style={styles.empty}>No clients yet — add your first one.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.clientRow}
              onPress={() => navigation.navigate('ClientProfile', { clientId: item.id })}>
              <Text style={styles.clientName}>{item.name}</Text>
              {item.eye_analysis && (
                <Text style={styles.clientMeta}>{item.eye_analysis.eye_shape} eyes</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewClient')}>
        <Text style={styles.fabText}>+ New Client</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  toolsRow: { marginTop: 12, paddingLeft: 16 },
  toolChip: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  toolChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  usageBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
  },
  usageText: { fontSize: 11, color: colors.text },
  loading: { marginTop: 40 },
  error: { color: '#B3261E', textAlign: 'center', marginTop: 24 },
  empty: { color: colors.text, textAlign: 'center', marginTop: 40, opacity: 0.6 },
  list: { padding: 16 },
  clientRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
  },
  clientName: { fontSize: 16, fontWeight: '600', color: colors.text },
  clientMeta: { fontSize: 13, color: colors.accent, marginTop: 2 },
  fab: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fabText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
