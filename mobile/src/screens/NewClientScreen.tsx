import { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { ClientProfile } from '../types/api';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'NewClient'>;

export function NewClientScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = await api.post<ClientProfile>('/clients', { name: name.trim(), notes });
      navigation.replace('CameraUpload', { clientId: client.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ResponsiveContainer maxWidth={440}>
      <Text style={styles.label}>Client name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Jane Doe" />

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="First visit, sensitive lashes, etc."
        multiline
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Continue to Photo</Text>
        )}
      </TouchableOpacity>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  label: { fontSize: 13, color: colors.text, marginBottom: 6, marginTop: 12, fontWeight: '600' },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#B3261E', marginTop: 12, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
