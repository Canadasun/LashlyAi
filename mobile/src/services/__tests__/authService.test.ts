import AsyncStorage from '@react-native-async-storage/async-storage';
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
    jest.clearAllMocks();
  });

  it('returns null when nothing has been persisted yet', async () => {
    expect(await loadPersistedSession()).toBeNull();
  });

  it('round-trips a session through persist/load/clear', async () => {
    await persistSession({ email: 'artist@example.com', token: 'abc.def.ghi' });

    expect(await loadPersistedSession()).toEqual({
      email: 'artist@example.com',
      token: 'abc.def.ghi',
    });

    await clearPersistedSession();
    expect(await loadPersistedSession()).toBeNull();
  });

  it('ignores corrupted storage instead of throwing', async () => {
    await AsyncStorage.setItem('lashlyai.session', 'not valid json');
    expect(await loadPersistedSession()).toBeNull();
  });

  it('signUp calls /auth/register and returns a session from the response', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      token: 'new-token',
      user: { email: 'new@example.com' },
    });

    const session = await signUp('New@Example.com', 'correcthorse');

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      password: 'correcthorse',
    });
    expect(session).toEqual({ email: 'new@example.com', token: 'new-token' });
  });

  it('signIn calls /auth/login and returns a session from the response', async () => {
    (api.post as jest.Mock).mockResolvedValue({
      token: 'existing-token',
      user: { email: 'existing@example.com' },
    });

    const session = await signIn('existing@example.com', 'correcthorse');

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'existing@example.com',
      password: 'correcthorse',
    });
    expect(session).toEqual({ email: 'existing@example.com', token: 'existing-token' });
  });
});
