module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^firebase/app$': '<rootDir>/__mocks__/firebaseApp.js',
    '^firebase/auth$': '<rootDir>/__mocks__/firebaseAuth.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
};
