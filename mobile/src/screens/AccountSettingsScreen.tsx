import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const DELETE_CONFIRM_WORD = 'DELETE';

// Apple guideline 5.1.1(v): apps that support account creation must also offer
// in-app account deletion. No Alert.prompt here (iOS-only) since this app also ships
// on Android — a plain TextInput confirmation works on both.
export function AccountSettingsScreen() {
  const { session, signOut, deleteAccount } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign back in to access your clients and lash maps.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const submitDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount();
      // On success, AuthContext.session becomes null and RootNavigator swaps to
      // AuthScreen on its own — nothing left to navigate here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email}>{session?.email}</Text>
        </View>

        <TouchableOpacity style={styles.rowButton} onPress={confirmSignOut}>
          <Text style={styles.rowButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Danger zone</Text>
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerText}>
            This permanently deletes your account, client profiles, photos, and lash maps.
            This cannot be undone.
          </Text>

          {!confirmingDelete ? (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => setConfirmingDelete(true)}>
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.confirmLabel}>
                Type {DELETE_CONFIRM_WORD} to confirm
              </Text>
              <TextInput
                style={styles.input}
                placeholder={DELETE_CONFIRM_WORD}
                placeholderTextColor="#9b8f8c"
                autoCapitalize="characters"
                autoCorrect={false}
                value={confirmText}
                onChangeText={setConfirmText}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity
                style={[
                  styles.dangerButton,
                  (confirmText !== DELETE_CONFIRM_WORD || deleting) && styles.dangerButtonDisabled,
                ]}
                disabled={confirmText !== DELETE_CONFIRM_WORD || deleting}
                onPress={submitDelete}>
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.dangerButtonText}>Permanently Delete Account</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                disabled={deleting}
                onPress={() => {
                  setConfirmingDelete(false);
                  setConfirmText('');
                  setError(null);
                }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  email: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 6 },
  rowButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 12,
  },
  rowButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dangerCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: 16,
  },
  dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  dangerText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 14,
  },
  confirmLabel: { color: colors.text, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, marginBottom: 8, fontSize: 13 },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonDisabled: { opacity: 0.5 },
  dangerButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  cancelText: { color: colors.muted, textAlign: 'center', marginTop: 12, fontSize: 13 },
});
