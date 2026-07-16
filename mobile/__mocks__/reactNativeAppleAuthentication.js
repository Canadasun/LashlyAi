// Native-bridge module (real Sign in with Apple can only run on-device) — mocked like
// react-native-keychain/react-native-iap above rather than transformed, since there's
// no meaningful native behavior to exercise in a Jest environment anyway.
function AppleButton() {
  return null;
}
AppleButton.Style = { WHITE: 'white', WHITE_OUTLINE: 'whiteOutline', BLACK: 'black' };
AppleButton.Type = { SIGN_IN: 'signIn', CONTINUE: 'continue', DEFAULT: 'default' };

const appleAuth = {
  Operation: { LOGIN: 'LOGIN', LOGOUT: 'LOGOUT' },
  Scope: { EMAIL: 'EMAIL', FULL_NAME: 'FULL_NAME' },
  Error: { CANCELED: '1001' },
  performRequest: jest.fn(),
};

module.exports = { appleAuth, AppleButton };
