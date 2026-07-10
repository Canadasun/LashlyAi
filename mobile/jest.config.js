module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^firebase/app$': '<rootDir>/__mocks__/firebaseApp.js',
    '^firebase/auth$': '<rootDir>/__mocks__/firebaseAuth.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
