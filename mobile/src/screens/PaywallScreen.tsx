import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  finishTransaction,
  requestPurchase,
  useIAP,
  validateReceiptIOS,
  type ProductSubscription,
  type Purchase,
} from 'react-native-iap';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

// lashlyai_salon_monthly (2026-07-24): the new Salon tier, $39.99/mo, monthly-only
// (no yearly SKU yet) — see hasSalonFeatureAccess in the backend for the gating.
const SUBSCRIPTION_SKUS = ['lashlyai_pro_monthly', 'lashlyai_pro_yearly', 'lashlyai_salon_monthly'];

// Kept in sync by hand with what's actually gated server-side — see
// backend/src/services/planLimits.service.ts FREE_LIMITS and the Pro-only checks in
// clients.routes.ts / lessons.routes.ts. Glue & humidity isn't its own bullet since
// that route was folded into retention troubleshooting.
const FREE_FEATURES = [
  '5 AI Lash Coach questions per day',
  '2 eye-shape scans per month',
  'Basic lash style recommendations',
  'Basic lash maps',
  '5 beginner lessons',
  'Save up to 2 client profiles',
  'Community forum',
];

// Shown first (collapsed state) — the most-asked-about Pro features.
const PRO_HIGHLIGHTS = [
  'Unlimited AI Lash Coach',
  'Unlimited eye scans & lash maps',
  'Advanced lash sets & styles',
];

// Only shown once "View All Features" is expanded. Inventory tracking moved to
// Salon-only 2026-07-24 (see SALON_FEATURES) — grandfathered Pro subscribers who
// already had it keep it (hasSalonFeatureAccess on the backend), new/renewing Pro
// subscribers from here on don't, which is why it's no longer listed as a Pro
// feature on this screen even though the server-side exception exists.
const PRO_REST = [
  'Retention troubleshooting, incl. glue & humidity guidance',
  'Full client photo history',
  'Before-and-after comparisons',
  'Unlimited saved clients',
  'AI social media captions & replies',
  'All 10 lessons',
  'Priority support',
];

// Salon tier (2026-07-24) — everything in Pro, plus these three. Existing Pro
// subscribers who already had Video Retouch/Face Deep Scan/Inventory keep them
// (grandfathered server-side); this list is what's exclusive to a *new* Salon
// subscription from here on.
const SALON_FEATURES = ['On-device Video Retouch', 'Face Deep Scan AR', 'Inventory tracking'];

type VerifiedSubscriptionResponse = {
  plan: string;
  status: string;
  verified: boolean;
};

function getProductLabel(product: ProductSubscription) {
  if (product.id === 'lashlyai_salon_monthly') return 'Salon Monthly';
  return product.id === 'lashlyai_pro_yearly' ? 'Pro Annual' : 'Pro Monthly';
}

function getProductFeatureCopy(product: ProductSubscription) {
  if (product.id === 'lashlyai_salon_monthly') {
    return 'Everything in Pro, plus Video Retouch, Face Deep Scan AR, and Inventory tracking.';
  }
  return product.id === 'lashlyai_pro_yearly'
    ? 'Best value for salons and established professionals.'
    : 'Flexible monthly access for active artists and teams.';
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Text style={[styles.featureMark, included ? styles.featureMarkFree : styles.featureMarkPro]}>
        {included ? '✓' : '✦'}
      </Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

// Apple guideline 2.1(b): the review build's subscription page spun on "Loading App
// Store products…" indefinitely — fetchProducts' onError DID fire (see below), but the
// Plans card only ever branched on subscriptions.length === 0, so an error never
// actually replaced the spinner. Fixed with an explicit loading/error/timeout state
// machine instead of inferring loading purely from an empty array.
const PRODUCT_FETCH_TIMEOUT_MS = 12000;

type ProductsState = 'loading' | 'loaded' | 'error';

export function PaywallScreen() {
  const isIOS = Platform.OS === 'ios';
  const [selectedSku, setSelectedSku] = useState<string>(SUBSCRIPTION_SKUS[0]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [productsState, setProductsState] = useState<ProductsState>('loading');
  const [productsError, setProductsError] = useState<string | null>(null);
  const [fetchAttempt, setFetchAttempt] = useState(0);

  const { connected, subscriptions, fetchProducts, restorePurchases } =
    useIAP({
      onError: (err) => {
        setError(err.message);
        setProductsError(err.message);
        setProductsState('error');
      },
      onPurchaseError: (purchaseError) => {
        setError(purchaseError.message);
        setSubmitting(false);
      },
    onPurchaseSuccess: (purchase) => {
      handlePurchaseSuccess(purchase).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to verify subscription');
        setSubmitting(false);
      });
      },
    });

  useEffect(() => {
    if (!isIOS) return;
    setProductsState('loading');
    setProductsError(null);

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setProductsState('error');
      setProductsError('Loading is taking longer than expected.');
    }, PRODUCT_FETCH_TIMEOUT_MS);

    fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' })
      .then(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        // subscriptions state updates via the hook itself; the effect below promotes
        // 'loading' to 'loaded' once it actually has entries, so a resolve with an
        // empty result (e.g. products not yet propagated on Apple's side) still shows
        // the error/retry state instead of silently reverting to an infinite spinner.
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        setProductsError(err instanceof Error ? err.message : 'Failed to load App Store products');
        setProductsState('error');
      });

    return () => {
      settled = true;
      clearTimeout(timeout);
    };
  }, [fetchProducts, isIOS, fetchAttempt]);

  useEffect(() => {
    if (subscriptions.length > 0) {
      setProductsState('loaded');
      setProductsError(null);
    }
  }, [subscriptions]);

  const retryFetchProducts = () => setFetchAttempt((n) => n + 1);

  const selectedProduct = subscriptions.find((product) => product.id === selectedSku) ?? null;

  const handlePurchaseSuccess = async (purchase: Purchase) => {
    try {
      const verification = await validateReceiptIOS({
        apple: { sku: purchase.productId },
      });

      if (!verification.isValid || !verification.receiptData) {
        throw new Error('Apple receipt verification failed');
      }

      const result = await api.post<VerifiedSubscriptionResponse>('/subscriptions/verify', {
        receipt_data: verification.receiptData,
      });

      await finishTransaction({
        purchase,
        isConsumable: false,
      });

      setStatus(`Subscription updated: ${result.plan} (${result.status})`);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProduct) {
      setError('Load a subscription product first.');
      return;
    }

    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      await requestPurchase({
        request: {
          apple: {
            sku: selectedSku,
            andDangerouslyFinishTransactionAutomatically: false,
          },
        },
        type: 'subs',
      });
      setStatus('Complete the App Store purchase prompt.');
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : 'Failed to start purchase');
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    setError(null);
    setStatus(null);
    setSubmitting(true);
    try {
      await restorePurchases({ onlyIncludeActiveItemsIOS: true });
      setStatus('Restore requested.');
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Failed to restore purchases');
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ResponsiveContainer maxWidth={640}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Upgrade path</Text>
        <Text style={styles.title}>Built for serious lash businesses</Text>
        <Text style={styles.subtitle}>
          Pick a plan, complete the App Store purchase, and the app will verify the
          receipt against the backend before unlocking access.
        </Text>
      </View>

      <View style={styles.featuresCard}>
        <Text style={styles.featuresCardLabel}>Free</Text>
        {FREE_FEATURES.map((label) => (
          <FeatureRow key={label} label={label} included />
        ))}

        <Text style={[styles.featuresCardLabel, styles.featuresCardLabelPro]}>Pro — everything in Free, plus</Text>
        {PRO_HIGHLIGHTS.map((label) => (
          <FeatureRow key={label} label={label} included={false} />
        ))}
        {featuresExpanded && PRO_REST.map((label) => <FeatureRow key={label} label={label} included={false} />)}

        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => setFeaturesExpanded((v) => !v)}
          activeOpacity={0.7}>
          <Text style={styles.viewAllButtonText}>
            {featuresExpanded ? 'Show less' : `View all ${PRO_HIGHLIGHTS.length + PRO_REST.length} Pro features`}
          </Text>
        </TouchableOpacity>

        {featuresExpanded && (
          <>
            <Text style={[styles.featuresCardLabel, styles.featuresCardLabelPro]}>Salon — everything in Pro, plus</Text>
            {SALON_FEATURES.map((label) => (
              <FeatureRow key={label} label={label} included={false} />
            ))}
          </>
        )}

        <TouchableOpacity
          style={styles.upgradeRow}
          onPress={handlePurchase}
          disabled={submitting || !isIOS || !connected || !selectedProduct}
          activeOpacity={0.7}>
          <Text style={styles.upgradeRowText}>
            {selectedProduct ? `Upgrade to ${getProductLabel(selectedProduct)}` : 'Upgrade'}
          </Text>
          <Text style={styles.upgradeRowArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Plans</Text>
        {!isIOS ? (
          <Text style={styles.loadingText}>Subscriptions are currently wired for iOS only.</Text>
        ) : productsState === 'loading' ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading App Store products…</Text>
          </View>
        ) : productsState === 'error' || subscriptions.length === 0 ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingErrorText}>
              {productsError ?? 'Unable to load App Store products.'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryFetchProducts} activeOpacity={0.7}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          subscriptions.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={[styles.planCard, selectedSku === product.id && styles.planCardSelected]}
              onPress={() => setSelectedSku(product.id)}
              activeOpacity={0.8}>
              <Text style={styles.planName}>{getProductLabel(product)}</Text>
              <Text style={styles.planPrice}>{product.displayPrice}</Text>
              <Text style={styles.planCopy}>{getProductFeatureCopy(product)}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Current state</Text>
        <Text style={styles.noticeBody}>
          {isIOS
            ? connected
              ? 'StoreKit is connected and ready.'
              : 'Connecting to the App Store…'
            : 'Subscriptions are currently wired for iOS only.'}
        </Text>
      </View>

      {status && <Text style={styles.status}>{status}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handlePurchase}
        disabled={submitting || !isIOS || !connected || !selectedProduct}>
        {submitting ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>{isIOS ? 'Subscribe' : 'iOS Only'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleRestore}
        disabled={submitting || !isIOS}>
        <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
      </TouchableOpacity>

      <View style={styles.enterpriseCard}>
        <Text style={styles.enterpriseTitle}>What happens after purchase</Text>
        <Text style={styles.enterpriseBody}>
          The app verifies the Apple receipt on the backend, stores the subscription
          entitlement, and keeps access tied to the verified status and expiry date.
        </Text>
      </View>
      </ResponsiveContainer>
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
  // "View All Features" list — kept visually separate from the dark hero / plan-card
  // section above (this screen's existing look), using the app's actual brand
  // palette (theme/colors.ts) for a calmer, more minimalistic feel: a soft card,
  // tight single-line rows, and small glyphs instead of heavy badges/borders per row.
  featuresCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    marginBottom: 16,
  },
  featuresCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  featuresCardLabelPro: { marginTop: 14 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  featureMark: { width: 20, fontSize: 13, fontWeight: '700' },
  featureMarkFree: { color: colors.success },
  featureMarkPro: { color: colors.accent },
  featureLabel: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  viewAllButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    marginBottom: 4,
  },
  viewAllButtonText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
  },
  upgradeRowText: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  upgradeRowArrow: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  cardLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  loadingText: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 10,
  },
  loadingErrorText: {
    color: '#B3261E',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  retryButtonText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  planCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FAFBFD',
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F4F7FF',
  },
  planName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  planPrice: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  planCopy: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
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
  status: {
    color: colors.text,
    fontSize: 13,
    marginBottom: 8,
  },
  error: {
    color: '#B3261E',
    fontSize: 13,
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
  },
  enterpriseCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE4F0',
    marginTop: 16,
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
