module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./node_modules/@shopify/react-native-skia/jestSetup.js'],
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^@react-native-firebase/crashlytics$': '<rootDir>/__mocks__/reactNativeFirebaseCrashlytics.js',
    '^@react-native-camera-roll/camera-roll$': '<rootDir>/__mocks__/cameraRoll.js',
    '^react-native-blob-util$': '<rootDir>/__mocks__/reactNativeBlobUtil.js',
    '^react-native-view-shot$': '<rootDir>/__mocks__/reactNativeViewShot.js',
    '^react-native-iap$': '<rootDir>/__mocks__/reactNativeIap.js',
    '^react-native-keychain$': '<rootDir>/__mocks__/reactNativeKeychain.js',
    '^@invertase/react-native-apple-authentication$':
      '<rootDir>/__mocks__/reactNativeAppleAuthentication.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@shopify/react-native-skia|react-native-.*)/)',
  ],
};
