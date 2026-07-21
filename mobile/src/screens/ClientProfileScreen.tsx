import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ClientProfileView } from './ClientProfileView';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientProfile'>;

// Thin wrapper registered as the actual Stack.Screen — the real content lives in
// ClientProfileView so ClientListScreen's tablet split view can embed the exact same
// component directly (with a clientId prop instead of a route param) rather than
// duplicating this screen's logic.
export function ClientProfileScreen({ route, navigation }: Props) {
  return <ClientProfileView clientId={route.params.clientId} navigation={navigation} />;
}
