import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { AdminOverview, AdminSubscriptionGrant } from '../types/api';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

const GRANTABLE_PLANS = ['pro', 'educator', 'salon', 'enterprise'] as const;
const REFUND_REASONS = ['requested_by_customer', 'duplicate', 'fraudulent'] as const;
const REFUND_REASON_LABELS: Record<(typeof REFUND_REASONS)[number], string> = {
  requested_by_customer: 'Customer request',
  duplicate: 'Duplicate charge',
  fraudulent: 'Fraudulent',
};

// Every action here that creates/destroys subscription value goes through this same
// request-a-code -> prompt -> retry-with-code dance, matching the backend's
// two_factor_code contract (see admin.routes.ts's requireTwoFactorCode).
async function withTwoFactorCode<T>(submit: (code: string) => Promise<T>): Promise<T | null> {
  try {
    await api.post('/admin/2fa/request-code', {});
  } catch (err) {
    Alert.alert('Failed to send code', err instanceof Error ? err.message : 'Please try again.');
    return null;
  }

  return new Promise((resolve) => {
    Alert.prompt(
      'Verification code',
      'Enter the 6-digit code just emailed to you — it expires in 10 minutes.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        {
          text: 'Confirm',
          onPress: async (code?: string) => {
            if (!code?.trim()) {
              resolve(null);
              return;
            }
            try {
              resolve(await submit(code.trim()));
            } catch (err) {
              Alert.alert('Failed', err instanceof Error ? err.message : 'Please try again.');
              resolve(null);
            }
          },
        },
      ],
      'plain-text',
    );
  });
}

export function AdminScreen() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState<(typeof GRANTABLE_PLANS)[number]>('pro');
  const [grantDays, setGrantDays] = useState('30');
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [refundEmail, setRefundEmail] = useState('');
  const [refundReason, setRefundReason] = useState<(typeof REFUND_REASONS)[number]>('requested_by_customer');
  const [cancelSubscriptionToo, setCancelSubscriptionToo] = useState(true);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setError(null);
      const result = await api.get<AdminOverview>('/admin/overview');
      setOverview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submitGrant = async () => {
    const email = grantEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Enter a valid email address');
      return;
    }
    const days = Number(grantDays);
    if (!Number.isFinite(days) || days <= 0) {
      Alert.alert('Enter a valid number of days');
      return;
    }
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    setGranting(true);
    const result = await withTwoFactorCode((code) =>
      api.post('/admin/grants', {
        email,
        plan: grantPlan,
        expires_at: expiresAt,
        two_factor_code: code,
      }),
    );
    setGranting(false);
    if (result) {
      Alert.alert('Granted', `${email} now has ${grantPlan} access for ${days} days.`);
      setGrantEmail('');
      load();
    }
  };

  const revokeGrant = (grant: AdminSubscriptionGrant) => {
    Alert.alert('Revoke this grant?', `${grant.grantee_email} will lose ${grant.plan} access immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          setRevokingId(grant.id);
          const result = await withTwoFactorCode((code) =>
            api.post(`/admin/grants/${grant.id}/revoke`, { two_factor_code: code }),
          );
          setRevokingId(null);
          if (result) {
            Alert.alert('Revoked', `${grant.grantee_email}'s ${grant.plan} grant was revoked.`);
            load();
          }
        },
      },
    ]);
  };

  const submitRefund = () => {
    const email = refundEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Enter a valid email address');
      return;
    }

    Alert.alert(
      'Issue this refund?',
      `Refunds ${email}'s most recent payment${cancelSubscriptionToo ? ' and cancels their subscription immediately' : ', leaving their subscription active'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          style: 'destructive',
          onPress: async () => {
            setRefunding(true);
            const result = await withTwoFactorCode((code) =>
              api.post<{ amount: number; currency: string }>('/admin/billing/refund', {
                email,
                reason: refundReason,
                cancel_subscription: cancelSubscriptionToo,
                two_factor_code: code,
              }),
            );
            setRefunding(false);
            if (result) {
              Alert.alert(
                'Refunded',
                `${(result.amount / 100).toFixed(2)} ${result.currency.toUpperCase()} refunded to ${email}.`,
              );
              setRefundEmail('');
              load();
            }
          },
        },
      ],
    );
  };

  const replyToFeedback = (id: string) => {
    Alert.prompt(
      'Reply to this feedback',
      'This will be emailed to the sender.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async (message?: string) => {
            if (!message?.trim()) return;
            try {
              await api.post(`/admin/feedback/${id}/reply`, { message: message.trim() });
              Alert.alert('Reply sent');
              load();
            } catch (err) {
              Alert.alert('Failed to send', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
      'plain-text',
    );
  };

  const contactUser = (id: string, email: string) => {
    Alert.prompt(
      `Message ${email}`,
      'Sent by email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async (message?: string) => {
            if (!message?.trim()) return;
            try {
              await api.post(`/admin/users/${id}/contact`, { message: message.trim() });
              Alert.alert('Message sent');
            } catch (err) {
              Alert.alert('Failed to send', err instanceof Error ? err.message : 'Please try again.');
            }
          },
        },
      ],
      'plain-text',
    );
  };

  const resolveReport = async (id: string, hide: boolean) => {
    try {
      await api.post(`/admin/forum-reports/${id}/resolve`, { hide_content: hide });
      load();
    } catch (err) {
      Alert.alert('Failed to resolve', err instanceof Error ? err.message : 'Please try again.');
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
      <ResponsiveContainer maxWidth={900}>
      {error && <Text style={styles.error}>{error}</Text>}

      {overview && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{overview.totalUsers}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, overview.errorCountLast24h > 0 && styles.statValueAlert]}>
              {overview.errorCountLast24h}
            </Text>
            <Text style={styles.statLabel}>Errors (24h)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, overview.openForumReports.length > 0 && styles.statValueAlert]}>
              {overview.openForumReports.length}
            </Text>
            <Text style={styles.statLabel}>Open Reports</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Grant Subscription</Text>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="artist@example.com"
          placeholderTextColor="#9b8f8c"
          autoCapitalize="none"
          keyboardType="email-address"
          value={grantEmail}
          onChangeText={setGrantEmail}
        />
        <View style={styles.chipRow}>
          {GRANTABLE_PLANS.map((plan) => (
            <TouchableOpacity
              key={plan}
              style={[styles.chip, grantPlan === plan && styles.chipActive]}
              onPress={() => setGrantPlan(plan)}>
              <Text style={[styles.chipText, grantPlan === plan && styles.chipTextActive]}>{plan}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.daysRow}>
          <Text style={styles.daysLabel}>Days:</Text>
          <TextInput
            style={styles.daysInput}
            keyboardType="number-pad"
            value={grantDays}
            onChangeText={setGrantDays}
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={submitGrant} disabled={granting}>
          {granting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Grant Subscription</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Complimentary Grants</Text>
      {overview?.recentSubscriptionGrants.length ? (
        overview.recentSubscriptionGrants.map((grant) => {
          const expired = new Date(grant.expires_at).getTime() <= Date.now();
          const revoked = Boolean(grant.revoked_at);
          return (
            <View key={grant.id} style={styles.card}>
              <Text style={styles.rowTitle}>
                {grant.grantee_email} · {grant.plan}
              </Text>
              <Text style={styles.rowMeta}>
                {revoked
                  ? `Revoked ${new Date(grant.revoked_at!).toLocaleDateString()}`
                  : expired
                    ? `Expired ${new Date(grant.expires_at).toLocaleDateString()}`
                    : `Expires ${new Date(grant.expires_at).toLocaleDateString()}`}
                {grant.granter_email ? ` · granted by ${grant.granter_email}` : ''}
              </Text>
              {!revoked && !expired && (
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => revokeGrant(grant)} disabled={revokingId === grant.id}>
                    {revokingId === grant.id ? (
                      <ActivityIndicator color={colors.danger} size="small" />
                    ) : (
                      <Text style={[styles.actionText, styles.actionTextDanger]}>Revoke</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })
      ) : (
        <Text style={styles.empty}>No grants yet.</Text>
      )}

      <Text style={styles.sectionTitle}>Refund Payment</Text>
      <View style={styles.card}>
        <Text style={styles.cardHint}>
          Stripe-billed subscribers only — Apple/StoreKit subscribers must be refunded through
          App Store Connect.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="artist@example.com"
          placeholderTextColor="#9b8f8c"
          autoCapitalize="none"
          keyboardType="email-address"
          value={refundEmail}
          onChangeText={setRefundEmail}
        />
        <View style={styles.chipRow}>
          {REFUND_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[styles.chip, refundReason === reason && styles.chipActive]}
              onPress={() => setRefundReason(reason)}>
              <Text style={[styles.chipText, refundReason === reason && styles.chipTextActive]}>
                {REFUND_REASON_LABELS[reason]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setCancelSubscriptionToo((prev) => !prev)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: cancelSubscriptionToo }}>
          <View style={[styles.checkbox, cancelSubscriptionToo && styles.checkboxChecked]}>
            {cancelSubscriptionToo && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>Also cancel their subscription immediately</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryButton, styles.dangerButton]} onPress={submitRefund} disabled={refunding}>
          {refunding ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Issue Refund</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Open Forum Reports</Text>
      {overview?.openForumReports.length ? (
        overview.openForumReports.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.rowTitle}>{r.target_type}</Text>
            <Text style={styles.rowBody}>{r.reason}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => resolveReport(r.id, false)}>
                <Text style={styles.actionText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => resolveReport(r.id, true)}>
                <Text style={styles.actionText}>Hide content</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No open reports.</Text>
      )}

      <Text style={styles.sectionTitle}>Recent Feedback</Text>
      {overview?.recentFeedback.length ? (
        overview.recentFeedback.map((f) => (
          <View key={f.id} style={styles.card}>
            {f.is_priority && <Text style={styles.priorityBadge}>⭐ Priority</Text>}
            <Text style={styles.rowMeta}>{f.user_email ?? 'account deleted'}</Text>
            <Text style={styles.rowBody}>{f.message}</Text>
            {f.reply_count > 0 && <Text style={styles.repliedBadge}>✓ replied ({f.reply_count})</Text>}
            {f.user_id && (
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => replyToFeedback(f.id)}>
                  <Text style={styles.actionText}>Reply</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No feedback yet.</Text>
      )}

      <Text style={styles.sectionTitle}>Recent Signups</Text>
      {overview?.recentUsers.length ? (
        overview.recentUsers.map((u) => (
          <View key={u.id} style={styles.card}>
            <Text style={styles.rowTitle}>{u.email}</Text>
            <Text style={styles.rowMeta}>
              {u.role} · {new Date(u.created_at).toLocaleDateString()}
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={() => contactUser(u.id, u.email)}>
                <Text style={styles.actionText}>Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No users yet.</Text>
      )}
      </ResponsiveContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  error: { color: '#B3261E', marginBottom: 12, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  statValueAlert: { color: colors.danger },
  statLabel: { fontSize: 10, color: colors.muted, marginTop: 4, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 24, marginBottom: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#FFFFFF' },
  daysRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  daysLabel: { fontSize: 13, color: colors.muted, marginRight: 8 },
  daysInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    width: 70,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 11, color: colors.accent, marginTop: 4 },
  rowBody: { fontSize: 13, color: colors.text, marginTop: 6 },
  priorityBadge: { fontSize: 10, fontWeight: '700', color: colors.accent },
  repliedBadge: { fontSize: 11, color: colors.success, marginTop: 6, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  actionText: { fontSize: 12, color: colors.primaryDark, fontWeight: '700' },
  actionTextDanger: { color: colors.danger },
  empty: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  cardHint: { fontSize: 11, color: colors.muted, marginBottom: 10, lineHeight: 16 },
  dangerButton: { backgroundColor: colors.danger },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  checkboxLabel: { fontSize: 12, color: colors.text, flex: 1 },
});
