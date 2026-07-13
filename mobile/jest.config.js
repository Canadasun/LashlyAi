module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^@react-native-firebase/crashlytics$': '<rootDir>/__mocks__/reactNativeFirebaseCrashlytics.js',
    '^react-native-iap$': '<rootDir>/__mocks__/reactNativeIap.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
