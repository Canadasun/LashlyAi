/**
 * @format
 */

// Must be imported before anything else uses it — see react-native-reanimated's setup docs.
import 'react-native-reanimated';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
