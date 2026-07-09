import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';

interface PlanCardProps {
  name: string;
  price: string;
  features: string[];
  selected: boolean;
  onSelect: () => void;
}

function PlanCard({ name, price, features, selected, onSelect }: PlanCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.8}>
      <Text style={styles.cardName}>{name}</Text>
      <Text style={styles.cardPrice}>{price}</Text>
      {features.map((feature) => (
        <Text key={feature} style={styles.cardFeature}>
          • {feature}
        </Text>
      ))}
    </TouchableOpacity>
  );
}

export function PaywallScreen() {
  const [plan, setPlan] = useState<'free' | 'pro'>('pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const subscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      // Placeholder purchase flow: no real App Store Connect subscription products
      // exist yet, so this calls the backend's dev-mode fallback directly instead of
      // going through a real StoreKit purchase. Once real products exist, replace
      // this with a native IAP library purchase call that returns a receipt, then
      // POST { receipt_data } here instead of { plan }.
      const result = await api.post<{ plan: string; mock: boolean }>('/subscriptions/verify', {
        plan,
      });
      setConfirmed(result.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Plan</Text>
      <Text style={styles.notice}>
        Purchases aren't live yet — real App Store subscriptions require an Apple
        Developer account and App Store Connect setup that hasn't happened. This screen
        is wired to the backend's dev-mode subscription endpoint for now.
      </Text>

      <PlanCard
        name="Free"
        price="$0"
        features={['1 client profile', 'Basic lash maps']}
        selected={plan === 'free'}
        onSelect={() => setPlan('free')}
      />
      <PlanCard
        name="Pro"
        price="$—/mo"
        features={['Unlimited clients', 'AI Lash Coach', 'Full lash map history']}
        selected={plan === 'pro'}
        onSelect={() => setPlan('pro')}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {confirmed && <Text style={styles.confirmed}>Subscription set to: {confirmed}</Text>}

      <TouchableOpacity style={styles.button} onPress={subscribe} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Confirm {plan === 'pro' ? 'Pro' : 'Free'} Plan</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  notice: { fontSize: 12, color: colors.accent, marginBottom: 20, lineHeight: 17 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: colors.primary },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardPrice: { fontSize: 14, color: colors.accent, marginTop: 2, marginBottom: 8 },
  cardFeature: { fontSize: 13, color: colors.text, marginTop: 2 },
  error: { color: '#B3261E', marginTop: 8, fontSize: 13 },
  confirmed: { color: colors.text, marginTop: 8, fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
