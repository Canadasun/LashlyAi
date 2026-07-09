import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
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

export function ClientListScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api.get<ClientProfile[]>('/clients');
      setClients(result);
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
        <TouchableOpacity onPress={() => navigation.navigate('Coach')}>
          <Text style={styles.link}>Ask the Coach</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.link}>Sign out</Text>
        </TouchableOpacity>
      </View>

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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  link: { color: colors.accent, fontWeight: '600', fontSize: 13 },
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
