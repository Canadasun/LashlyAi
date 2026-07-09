import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function AuthScreen() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signUp') {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>LashlyAI</Text>
      <Text style={styles.subtitle}>
        {mode === 'signIn' ? 'Sign in to your account' : 'Create your artist account'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#9b8f8c"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#9b8f8c"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.primaryButtonText}>
            {mode === 'signIn' ? 'Sign In' : 'Sign Up'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        disabled
        accessibilityLabel="Apple Sign In — requires a paid Apple Developer account, not yet configured">
        <Text style={styles.secondaryButtonText}>Sign in with Apple</Text>
        <Text style={styles.secondaryButtonSubtext}>
          Requires an Apple Developer account — not configured yet
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
        <Text style={styles.switchModeText}>
          {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  error: {
    color: '#B3261E',
    marginBottom: 8,
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#e9e9e9',
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButtonSubtext: {
    color: '#7a7a7a',
    fontSize: 11,
    marginTop: 2,
  },
  switchModeText: {
    color: colors.accent,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
  },
});
