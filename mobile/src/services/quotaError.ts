import { Alert } from 'react-native';
import { ApiError } from './api';

// Structural rather than the full NativeStackNavigationProp<RootStackParamList, RouteName>
// type — every screen's navigation prop is specialized to its own route name, and all
// this needs is the ability to navigate to Paywall.
interface PaywallNavigable {
  navigate: (screen: 'Paywall') => void;
}

// Every quota-gated backend route (coach, photo feedback, lash map generation, forum,
// marketing captions...) returns the same shape on quota exceeded: HTTP 403 with an
// { error } message telling the user to upgrade. This is the one place that decides
// "was this failure a quota wall", so screens don't each re-derive it from message text.
export function isQuotaExceededError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 403;
}

// Shared prompt used by every gated screen — confirms before bouncing to Paywall
// instead of silently redirecting, since the user is usually mid-task when they hit it.
export function showQuotaExceededAlert(err: ApiError, navigation: PaywallNavigable) {
  Alert.alert('Limit reached', err.message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Upgrade', onPress: () => navigation.navigate('Paywall') },
  ]);
}
