// In-memory fake keyed by `service` (falls back to a default key), so tests exercise
// the same persist/load/clear round-trip authService.ts relies on without touching a
// real OS keychain.
let store = {};

function keyFor(options) {
  return (options && options.service) || 'default';
}

module.exports = {
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
    AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  setGenericPassword: jest.fn((username, password, options) => {
    store[keyFor(options)] = { username, password, service: keyFor(options) };
    return Promise.resolve({ service: keyFor(options), storage: 'keychain' });
  }),
  getGenericPassword: jest.fn((options) => {
    const entry = store[keyFor(options)];
    return Promise.resolve(entry ? { ...entry, storage: 'keychain' } : false);
  }),
  resetGenericPassword: jest.fn((options) => {
    delete store[keyFor(options)];
    return Promise.resolve(true);
  }),
  __reset: () => {
    store = {};
  },
};
