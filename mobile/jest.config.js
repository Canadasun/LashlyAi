module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock',
    '^@react-native-firebase/crashlytics$': '<rootDir>/__mocks__/reactNativeFirebaseCrashlytics.js',
    '^@react-native-camera-roll/camera-roll$': '<rootDir>/__mocks__/cameraRoll.js',
    '^react-native-blob-util$': '<rootDir>/__mocks__/reactNativeBlobUtil.js',
    '^react-native-view-shot$': '<rootDir>/__mocks__/reactNativeViewShot.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
