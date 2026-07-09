/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  // Flushes the splash-screen timer so the auth/navigation tree renders too.
  await ReactTestRenderer.act(() => {
    jest.runAllTimers();
  });

  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
  jest.useRealTimers();
});
