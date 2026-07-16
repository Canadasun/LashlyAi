import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { AdminScreen } from '../screens/AdminScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { BeforeAfterScreen } from '../screens/BeforeAfterScreen';
import { CameraUploadScreen } from '../screens/CameraUploadScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { ClientListScreen } from '../screens/ClientListScreen';
import { ClientProfileScreen } from '../screens/ClientProfileScreen';
import { CoachScreen } from '../screens/CoachScreen';
import { CompSubscriptionBanner } from '../components/CompSubscriptionBanner';
import { EyeAnalysisResultScreen } from '../screens/EyeAnalysisResultScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { HomeDashboardScreen } from '../screens/HomeDashboardScreen';
import { ForumListScreen } from '../screens/ForumListScreen';
import { ForumPostDetailScreen } from '../screens/ForumPostDetailScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { LashMapScreen } from '../screens/LashMapScreen';
import { LessonDetailScreen } from '../screens/LessonDetailScreen';
import { LessonListScreen } from '../screens/LessonListScreen';
import { MarketingToolsScreen } from '../screens/MarketingToolsScreen';
import { NewClientScreen } from '../screens/NewClientScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { PhotoEditorScreen } from '../screens/PhotoEditorScreen';
import { PhotoFeedbackScreen } from '../screens/PhotoFeedbackScreen';
import { ReferenceGuideScreen } from '../screens/ReferenceGuideScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, restoringSession } = useAuth();

  if (restoringSession) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Full gate — nothing else in the app (including the comp-subscription banner) is
  // reachable until a temporary/default password has been changed.
  if (session?.mustChangePassword) {
    return <ChangePasswordScreen />;
  }

  return (
    <>
      {session && <CompSubscriptionBanner />}
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {!session ? (
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen
                name="Dashboard"
                component={HomeDashboardScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="ClientList"
                component={ClientListScreen}
                options={{ headerShown: false }}
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
              <Stack.Screen
                name="LashMap"
                component={LashMapScreen}
                options={{ title: 'Lash Map' }}
              />
              <Stack.Screen
                name="Coach"
                component={CoachScreen}
                options={{ title: 'AI Lash Coach' }}
              />
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
              <Stack.Screen
                name="Inventory"
                component={InventoryScreen}
                options={{ title: 'Inventory' }}
              />
              <Stack.Screen
                name="MarketingTools"
                component={MarketingToolsScreen}
                options={{ title: 'Marketing Tools' }}
              />
              <Stack.Screen
                name="LessonList"
                component={LessonListScreen}
                options={{ title: 'Lessons' }}
              />
              <Stack.Screen
                name="LessonDetail"
                component={LessonDetailScreen}
                options={{ title: 'Lesson' }}
              />
              <Stack.Screen
                name="ForumList"
                component={ForumListScreen}
                options={{ title: 'Community' }}
              />
              <Stack.Screen
                name="ForumPostDetail"
                component={ForumPostDetailScreen}
                options={{ title: 'Post' }}
              />
              <Stack.Screen
                name="BeforeAfter"
                component={BeforeAfterScreen}
                options={{ title: 'Before & After' }}
              />
              <Stack.Screen
                name="PhotoEditor"
                component={PhotoEditorScreen}
                options={{ title: 'Photo Editor' }}
              />
              <Stack.Screen
                name="ReferenceGuide"
                component={ReferenceGuideScreen}
                options={{ title: 'Reference Guide' }}
              />
              <Stack.Screen
                name="Admin"
                component={AdminScreen}
                options={{ title: 'Admin' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
