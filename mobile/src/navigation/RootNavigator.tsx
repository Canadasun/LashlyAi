import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { AuthScreen } from '../screens/AuthScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="ClientList" options={{ title: 'Clients' }}>
              {() => <PlaceholderScreen label="Client list — coming next" />}
            </Stack.Screen>
            <Stack.Screen name="NewClient" options={{ title: 'New Client' }}>
              {() => <PlaceholderScreen label="New client — coming next" />}
            </Stack.Screen>
            <Stack.Screen name="ClientProfile" options={{ title: 'Client' }}>
              {() => <PlaceholderScreen label="Client profile — coming next" />}
            </Stack.Screen>
            <Stack.Screen name="CameraUpload" options={{ title: 'Photograph Eye' }}>
              {() => <PlaceholderScreen label="Camera upload — coming next" />}
            </Stack.Screen>
            <Stack.Screen name="EyeAnalysisResult" options={{ title: 'Eye Analysis' }}>
              {() => <PlaceholderScreen label="Eye analysis — coming next" />}
            </Stack.Screen>
            <Stack.Screen name="LashMap" options={{ title: 'Lash Map' }}>
              {() => <PlaceholderScreen label="Lash map — coming next" />}
            </Stack.Screen>
            <Stack.Screen name="Coach" options={{ title: 'AI Lash Coach' }}>
              {() => <PlaceholderScreen label="Coach chat — coming next" />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
