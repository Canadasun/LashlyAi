module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
      },
    ],
    // Reanimated 4 moved its Babel plugin into react-native-worklets — must stay last.
    'react-native-worklets/plugin',
  ],
};
