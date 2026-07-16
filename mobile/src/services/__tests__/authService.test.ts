import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  clearPersistedSession,
  loadPersistedSession,
  persistSession,
  signIn,
  signUp,
} from '../authService';
import { api } from '../api';

jest.mock('../api', () => ({
  api: { post: jest.fn() },
}));

describe('authService session persistence', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
    (Keychain as unknown as { __reset: () => void }).__reset();
    jest.clearAllMocks();
  });

  it('returns null when nothing has been persisted yet', async () => {
    expect(await loadPersistedSession()).toBeNull();
  });

  it('round-trips a session through persist/load/clear using Keychain, not AsyncStorage', async () => {
    await persistSession({
      email: 'artist@example.com',
      token: 'abc.def.ghi',
      mustChangePassword: false,
      isAdmin: false,
    });

    expect(await loadPersistedSession()).toEqual({
      email: 'artist@example.com',
      token: 'abc.def.ghi',
      mustChangePassword: false,
      isAdmin: false,
    });
    // The session token is a bearer credential — it must live in the OS-backed
    // Keychain, not plain unencrypted AsyncStorage.
    expect(await AsyncStorage.getItem('lashlyai.session')).toBeNull();

    await clearPersistedSession();
    expect(await loadPersistedSession()).toBeNull();
  });

  it('ignores corrupted Keychain storage instead of throwing', async () => {
    await Keychain.setGenericPassword('artist@example.com', 'not valid json', {
      service: 'com.lashlyai.session',
    });
    expect(await loadPersistedSession()).toBeNull();
  });

  it('fails closed to null instead of throwing when the native Keychain call itself rejects', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockRejectedValueOnce(
      new Error('native keychain error'),
    );
    await expect(loadPersistedSession()).resolves.toBeNull();
  });

  it('migrates a pre-upgrade session from legacy AsyncStorage into Keychain, then clears it', async () => {
    await AsyncStorage.setItem(
      'lashlyai.session',
      JSON.stringify({
        email: 'legacy@example.com',
        token: 'legacy-token',
        mustChangePassword: false,
      }),
    );

    const session = await loadPersistedSession();

    expect(session).toEqual({
      email: 'legacy@example.com',
      token: 'legacy-token',
      mustChangePassword: false,
      isAdmin: false,
    });
    expect(await AsyncStorage.getItem('lashlyai.session')).toBeNull();
    // Migrated into Keychain, so a second load doesn't need AsyncStorage at all.
    expect(await loadPersistedSession()).toEqual(session);
  });

  it('ignores corrupted legacy AsyncStorage storage instead of throwing', async () => {
    await AsyncStorage.setItem('lashlyai.session', 'not valid json');
    expect(await loadPersistedSession()).toBeNull();
  });

  it('signUp calls /auth/register and returns a session from the response', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      token: 'new-token',
      user: { email: 'new@example.com', must_change_password: false, is_admin: false },
    });

    const session = await signUp('New@Example.com', 'correcthorse');

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      password: 'correcthorse',
    });
    expect(session).toEqual({
      email: 'new@example.com',
      token: 'new-token',
      mustChangePassword: false,
      isAdmin: false,
    });
  });

  it('signIn calls /auth/login and returns a session from the response', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      token: 'existing-token',
      user: { email: 'existing@example.com', must_change_password: true, is_admin: false },
    });

    const session = await signIn('existing@example.com', 'correcthorse');

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'existing@example.com',
      password: 'correcthorse',
    });
    expect(session).toEqual({
      email: 'existing@example.com',
      token: 'existing-token',
      mustChangePassword: true,
      isAdmin: false,
    });
  });
});
