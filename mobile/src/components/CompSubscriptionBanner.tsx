import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';

interface CompSubscriptionNotification {
  id: string;
  type: 'comp_subscription_grant' | 'comp_subscription_revoked';
  payload: { plan: string; expires_at?: string };
}

function formatCountdown(expiresAt: string): string {
  const msRemaining = new Date(expiresAt).getTime() - Date.now();
  if (msRemaining <= 0) {
    return 'expired';
  }
  const days = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
  if (days >= 1) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  const hours = Math.max(1, Math.floor(msRemaining / (1000 * 60 * 60)));
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

// Polls for a pending comp-subscription grant (see admin.routes.ts POST /admin/grants)
// on mount and every time the app returns to the foreground, since there's no push
// infra wired up yet to deliver this instantly.
export function CompSubscriptionBanner() {
  const [notification, setNotification] = useState<CompSubscriptionNotification | null>(null);
  const dismissingRef = useRef(false);

  const checkForNotification = useCallback(async () => {
    try {
      const notifications = await api.get<CompSubscriptionNotification[]>(
        '/users/me/notifications',
      );
      const next = notifications.find(
        (n) => n.type === 'comp_subscription_grant' || n.type === 'comp_subscription_revoked',
      );
      if (next && !dismissingRef.current) {
        setNotification(next);
      }
    } catch {
      // Silently ignore — this is a nice-to-have banner, not a critical path.
    }
  }, []);

  useEffect(() => {
    checkForNotification();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkForNotification();
      }
    });
    return () => subscription.remove();
  }, [checkForNotification]);

  const dismiss = async () => {
    if (!notification) {
      return;
    }
    dismissingRef.current = true;
    setNotification(null);
    try {
      await api.post(`/users/me/notifications/${notification.id}/seen`);
    } catch {
      // Already dismissed client-side; a failed seen-call just means it may show
      // again next foreground, which is an acceptable fallback.
    } finally {
      dismissingRef.current = false;
    }
  };

  if (!notification) {
    return null;
  }

  const isRevoked = notification.type === 'comp_subscription_revoked';

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {isRevoked ? 'Your complimentary access has ended' : "You've got complimentary Pro access! 🎉"}
          </Text>
          <Text style={styles.body}>
            {isRevoked
              ? `Your complimentary ${notification.payload.plan} access is no longer active.`
              : `You've been gifted ${notification.payload.plan} access, expiring in ${formatCountdown(notification.payload.expires_at!)}.`}
          </Text>
          <TouchableOpacity style={styles.button} onPress={dismiss}>
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 43, 43, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
  body: { fontSize: 14, color: colors.text, marginBottom: 20, lineHeight: 20 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
