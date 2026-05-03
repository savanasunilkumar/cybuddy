import React, { useEffect } from 'react';
import {
  NavigationContainer as RNNavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { useVoiceNavigation, setNavigationRef } from '../contexts/VoiceContext';
import { LoadingScreen } from '../screens/LoadingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { VoiceAssistantScreen } from '../screens/VoiceAssistantScreen';
import { WorkdayScreen } from '../screens/WorkdayScreen';
import { CanvasScreen } from '../screens/CanvasScreen';
import { MainTabNavigator } from './MainTabNavigator';
import { palette } from '../theme/tokens';

// Navigation ref for programmatic navigation
export const navigationRef = createNavigationContainerRef();

const Stack = createStackNavigator();

export const NavigationContainer: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { startWakeWordListener, stopWakeWordListener } = useVoiceNavigation();

  // Set navigation ref for voice context
  useEffect(() => {
    setNavigationRef(navigationRef);
  }, []);

  // Start wake word listener when authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Give a moment for the app to settle
      const timer = setTimeout(() => {
        startWakeWordListener();
      }, 2000);

      return () => {
        clearTimeout(timer);
        stopWakeWordListener();
      };
    }
  }, [isAuthenticated, isLoading, startWakeWordListener, stopWakeWordListener]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: palette.background,
      card: palette.surface,
      text: palette.textPrimary,
      border: palette.border,
      primary: palette.brand,
    },
  };

  return (
    <RNNavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="Workday"
              component={WorkdayScreen}
              options={{
                animationEnabled: true,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="Canvas"
              component={CanvasScreen}
              options={{
                animationEnabled: true,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="VoiceAssistant"
              component={VoiceAssistantScreen}
              options={{
                presentation: 'modal',
                animationEnabled: true,
                gestureEnabled: true,
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </RNNavigationContainer>
  );
};
