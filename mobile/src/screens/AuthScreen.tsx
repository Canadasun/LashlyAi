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
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Mode = 'signIn' | 'signUp' | 'forgotPassword' | 'resetPassword';

export function AuthScreen() {
  const { signUp, signIn, signInWithApple, forgotPassword, resetPassword, sessionExpiredMessage } =
    useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const submitApple = async () => {
    setError(null);
    setAppleLoading(true);
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      if (!response.identityToken) {
        throw new Error('Apple did not return a sign-in token. Please try again.');
      }
      await signInWithApple(
        response.identityToken,
        response.fullName
          ? { givenName: response.fullName.givenName, familyName: response.fullName.familyName }
          : null,
      );
    } catch (err) {
      // Apple's native cancel path throws a specific error code, not an exception
      // message worth surfacing — the user just tapped away from the sheet.
      const code2 = (err as { code?: string })?.code;
      if (code2 === appleAuth.Error.CANCELED) {
        return;
      }
      setError(err instanceof Error ? err.message : 'Apple sign-in failed');
    } finally {
      setAppleLoading(false);
    }
  };

  const submit = async () => {
    setError(null);

    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signUp') {
        await signUp(trimmedEmail, password);
      } else {
        await signIn(trimmedEmail, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const submitForgotPassword = async () => {
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(trimmedEmail);
      setMode('resetPassword');
      setInfo(`If ${trimmedEmail} is registered, a reset code has been sent — it expires in 15 minutes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const submitResetPassword = async () => {
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const subtitle = {
    signIn: 'Sign in to your account',
    signUp: 'Create your artist account',
    forgotPassword: 'Enter your email and we’ll send you a reset code',
    resetPassword: 'Enter the code and your new password',
  }[mode];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>LashlyAI</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {sessionExpiredMessage && <Text style={styles.sessionExpired}>{sessionExpiredMessage}</Text>}
      {info && <Text style={styles.info}>{info}</Text>}

      {mode !== 'resetPassword' && (
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9b8f8c"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      )}

      {(mode === 'signIn' || mode === 'signUp') && (
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9b8f8c"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      )}

      {mode === 'resetPassword' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor="#9b8f8c"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor="#9b8f8c"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {(mode === 'signIn' || mode === 'signUp') && (
        <TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === 'signIn' ? 'Sign In' : 'Sign Up'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {mode === 'forgotPassword' && (
        <TouchableOpacity style={styles.primaryButton} onPress={submitForgotPassword} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Send Reset Code</Text>
          )}
        </TouchableOpacity>
      )}

      {mode === 'resetPassword' && (
        <TouchableOpacity style={styles.primaryButton} onPress={submitResetPassword} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>Reset Password</Text>
          )}
        </TouchableOpacity>
      )}

      {mode === 'signIn' && Platform.OS === 'ios' && (
        <AppleButton
          buttonStyle={AppleButton.Style.WHITE_OUTLINE}
          buttonType={AppleButton.Type.SIGN_IN}
          style={styles.appleButton}
          onPress={submitApple}
        />
      )}
      {appleLoading && <ActivityIndicator style={styles.appleLoading} color={colors.primary} />}

      {mode === 'signIn' && (
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setInfo(null);
            setMode('forgotPassword');
          }}>
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>
      )}

      {(mode === 'signIn' || mode === 'signUp') && (
        <TouchableOpacity onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text style={styles.switchModeText}>
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      )}

      {(mode === 'forgotPassword' || mode === 'resetPassword') && (
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setInfo(null);
            setMode('signIn');
          }}>
          <Text style={styles.switchModeText}>Back to sign in</Text>
        </TouchableOpacity>
      )}
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
  sessionExpired: {
    color: '#7A5B00',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    fontSize: 13,
    textAlign: 'center',
  },
  info: {
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    fontSize: 13,
    textAlign: 'center',
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
  appleButton: {
    height: 46,
    borderRadius: 10,
    marginTop: 12,
  },
  appleLoading: {
    marginTop: 12,
  },
  forgotPasswordText: {
    color: colors.accent,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
  switchModeText: {
    color: colors.accent,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
  },
});
