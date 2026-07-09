import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { AuthScreen } from '../screens/AuthScreen';
import { CameraUploadScreen } from '../screens/CameraUploadScreen';
import { ClientListScreen } from '../screens/ClientListScreen';
import { ClientProfileScreen } from '../screens/ClientProfileScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { EyeAnalysisResultScreen } from '../screens/EyeAnalysisResultScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { LashMapScreen } from '../screens/LashMapScreen';
import { NewClientScreen } from '../screens/NewClientScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { PhotoFeedbackScreen } from '../screens/PhotoFeedbackScreen';
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
            <Stack.Screen
              name="ClientList"
              component={ClientListScreen}
              options={{ title: 'Clients' }}
            />
            <Stack.Screen
              name="NewClient"
              component={NewClientScreen}
              options={{ title: 'New Client' }}
            />
            <Stack.Screen
              name="ClientProfile"
              component={ClientProfileScreen}
              options={{ title: 'Client' }}
            />
            <Stack.Screen
              name="CameraUpload"
              component={CameraUploadScreen}
              options={{ title: 'Photograph Eye' }}
            />
            <Stack.Screen
              name="EyeAnalysisResult"
              component={EyeAnalysisResultScreen}
              options={{ title: 'Eye Analysis' }}
            />
            <Stack.Screen name="LashMap" component={LashMapScreen} options={{ title: 'Lash Map' }} />
            <Stack.Screen name="Coach" component={CoachScreen} options={{ title: 'AI Lash Coach' }} />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
              options={{ title: 'Report an Issue' }}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{ title: 'Subscription' }}
            />
            <Stack.Screen
              name="PhotoFeedback"
              component={PhotoFeedbackScreen}
              options={{ title: 'Score My Work' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
