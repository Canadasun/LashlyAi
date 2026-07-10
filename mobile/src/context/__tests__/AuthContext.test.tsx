import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../AuthContext';

function Probe() {
  const { session, restoringSession } = useAuth();
  return (
    <Text>
      {restoringSession ? 'restoring' : session ? `signed-in:${session.email}` : 'signed-out'}
    </Text>
  );
}

describe('AuthProvider session restore', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts in restoringSession=true, then signed-out when nothing was persisted', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    expect(renderer!.root.findByType(Text).props.children).toBe('signed-out');
  });

  it('restores a session that was persisted before the app launched', async () => {
    await AsyncStorage.setItem(
      'lashlyai.session',
      JSON.stringify({ email: 'restored@example.com', token: 'restored-token' }),
    );

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    expect(renderer!.root.findByType(Text).props.children).toBe(
      'signed-in:restored@example.com',
    );
  });
});
