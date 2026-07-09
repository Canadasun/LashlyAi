/**
 * LashlyAI mobile app
 *
 * @format
 */

import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { setupGlobalErrorHandling } from './src/services/setupErrorHandling';

setupGlobalErrorHandling();

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        {showSplash ? (
          <SplashScreen />
        ) : (
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        )}
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
