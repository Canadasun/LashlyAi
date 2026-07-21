import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api, ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { RetentionAggregateRow, RetentionInsightsSummary } from '../types/api';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'RetentionAnalytics'>;

function AggregateRow({ row }: { row: RetentionAggregateRow }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{row.label}</Text>
      <Text style={styles.rowValue}>
        {row.average_retention_pct}% avg · {row.sample_size} check{row.sample_size === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

/**
 * iPad-only entry point (not surfaced on phone — see ClientListScreen's TOOLS filter):
 * cross-client "which lash set/glue held up best" aggregate, built for the bigger
 * screen a tech has propped up at the front desk, not a single client's own trend
 * (that's the compact card on ClientProfileView instead).
 */
export function RetentionAnalyticsScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<RetentionInsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLocked(false);
      const result = await api.get<RetentionInsightsSummary>('/users/me/retention-insights');
      setSummary(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLocked(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load retention analytics');
      }
    } finally {
      setLoading(false);
    }
  }, []);

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

  if (locked) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Retention Intelligence is a Pro feature</Text>
        <Text style={styles.lockedText}>
          See which lash sets and glues hold up best across every client, and get a next-fill
          estimate per client, on Pro.
        </Text>
        <TouchableOpacity style={styles.upgradeButton} onPress={() => navigation.navigate('Paywall')}>
          <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'No data available'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={720}>
        {summary.total_checks === 0 ? (
          <Text style={styles.empty}>
            No retention checks logged yet — run a Retention Check from any client's Lash Map
            screen to start building this data.
          </Text>
        ) : (
          <>
            <Text style={styles.hint}>
              Based on {summary.total_checks} logged retention check{summary.total_checks === 1 ? '' : 's'}{' '}
              across all your clients.
            </Text>

            <Text style={styles.sectionTitle}>By Lash Set</Text>
            {summary.by_lash_set.map((row) => (
              <AggregateRow key={row.label} row={row} />
            ))}

            {summary.by_glue.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>By Glue</Text>
                {summary.by_glue.map((row) => (
                  <AggregateRow key={row.label} row={row} />
                ))}
              </>
            )}
          </>
        )}
      </ResponsiveContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  hint: { fontSize: 12, color: colors.muted, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 20, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 13, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  rowValue: { fontSize: 12, color: colors.muted },
  empty: { color: colors.text, textAlign: 'center', marginTop: 40, opacity: 0.6 },
  error: { color: '#B3261E', textAlign: 'center' },
  lockedTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lockedText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 19,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  upgradeButtonText: { color: colors.background, fontWeight: '700', fontSize: 14 },
});
