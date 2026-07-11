import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const featureRows = [
  ['Client management', 'Free: 5 profiles', 'Pro: unlimited'],
  ['AI Lash Coach', 'Free: 5 questions/day', 'Pro: unlimited'],
  ['Eye scans', 'Free: 3/month', 'Pro: unlimited'],
  ['Priority support', 'Not included', 'Included'],
];

export function PaywallScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Upgrade path</Text>
        <Text style={styles.title}>Built for serious lash businesses</Text>
        <Text style={styles.subtitle}>
          This build does not have StoreKit wired yet, so subscription purchase is
          intentionally disabled instead of pretending to work.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>What the app already supports</Text>
        {featureRows.map(([label, freeValue, proValue]) => (
          <View key={label} style={styles.featureRow}>
            <Text style={styles.featureName}>{label}</Text>
            <Text style={styles.featureValue}>{freeValue}</Text>
            <Text style={[styles.featureValue, styles.featureValueStrong]}>{proValue}</Text>
          </View>
        ))}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Purchase flow status</Text>
        <Text style={styles.noticeBody}>
          Real subscriptions now require Apple receipt verification on the backend.
          Until a native purchase flow is added, the app should keep this screen read
          only so users are not led into a dead-end flow.
        </Text>
      </View>

      <View style={styles.enterpriseCard}>
        <Text style={styles.enterpriseTitle}>Enterprise-ready next step</Text>
        <Text style={styles.enterpriseBody}>
          Connect StoreKit, pass the signed receipt to the API, and let the server
          determine access from receipt status and expiry.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  hero: {
    backgroundColor: '#101827',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  kicker: {
    color: '#C7D2FE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  cardLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  featureRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  featureName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureValue: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
  },
  featureValueStrong: {
    color: colors.primary,
    fontWeight: '700',
  },
  notice: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
    marginBottom: 16,
  },
  noticeTitle: {
    color: '#9A3412',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  noticeBody: {
    color: '#9A3412',
    fontSize: 13,
    lineHeight: 19,
  },
  enterpriseCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE4F0',
    marginBottom: 8,
  },
  enterpriseTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  enterpriseBody: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 19,
  },
});
