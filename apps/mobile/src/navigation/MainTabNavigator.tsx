import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { DashboardScreen } from '../screens/DashboardScreen';
import { AcademicsScreen } from '../screens/AcademicsScreen';
import { OutlookScreen } from '../screens/OutlookScreen';
import { CyRideScreen } from '../screens/CyRideScreen';
import { VisionScreen } from '../screens/VisionScreen';
import { useVoiceNavigation } from '../contexts/VoiceContext';
import { palette, radii } from '../theme/tokens';

const Tab = createBottomTabNavigator();

// Prism theme colors for voice button
const prismColors = {
  outer: '#D8F7F0',
  outerBorder: '#A4EBDD',
  middle: '#B5EFE3',
  inner: '#0C9F85',
  dotA: '#3FD8C0',
  dotB: '#6BC7FF',
  dotC: '#88EA88',
  dotD: '#9BE2FF',
};

// Voice button component - tap to open voice assistant
const VoiceButton: React.FC = () => {
  const { openVoiceAssistant, isWakeWordActive } = useVoiceNavigation();

  // Idle pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.voiceButtonContainer}>
      {/* Wake word indicator */}
      {isWakeWordActive && (
        <View style={styles.wakeWordIndicator}>
          <View style={styles.wakeWordDot} />
          <Text style={styles.wakeWordText}>Say "Jarvis"</Text>
        </View>
      )}

      <Pressable
        onPress={openVoiceAssistant}
        accessibilityRole="button"
        accessibilityLabel="Voice Assistant - Tap to open"
        style={styles.voicePressable}
      >
        <Animated.View
          style={[
            styles.voiceButtonOuter,
            { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <View style={styles.voiceButtonMiddle}>
            <View style={styles.voiceButtonInner}>
              <View style={styles.siriGlyphWrap}>
                <View style={[styles.siriDot, styles.siriDotA]} />
                <View style={[styles.siriDot, styles.siriDotB]} />
                <View style={[styles.siriDot, styles.siriDotC]} />
                <View style={[styles.siriDot, styles.siriDotD]} />
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
};

export const MainTabNavigator: React.FC = () => {
  return (
    <View style={styles.container}>
      <Tab.Navigator
        sceneContainerStyle={styles.scene}
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case 'Dashboard':
                iconName = focused ? 'home' : 'home-outline';
                break;
              case 'Academics':
                iconName = focused ? 'school' : 'school-outline';
                break;
              case 'Outlook':
                iconName = focused ? 'mail' : 'mail-outline';
                break;
              case 'CyRide':
                iconName = focused ? 'bus' : 'bus-outline';
                break;
              case 'Vision':
                iconName = focused ? 'eye' : 'eye-outline';
                break;
              default:
                iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          headerShown: false,
          tabBarActiveTintColor: palette.brand,
          tabBarInactiveTintColor: '#6B7280',
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
        })}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: 'Home' }}
        />
        <Tab.Screen
          name="Outlook"
          component={OutlookScreen}
          options={{ title: 'Mail' }}
        />
        <Tab.Screen
          name="Academics"
          component={AcademicsScreen}
          options={{ title: 'Academics' }}
        />
        <Tab.Screen
          name="CyRide"
          component={CyRideScreen}
          options={{ title: 'CyRide' }}
        />
        <Tab.Screen
          name="Vision"
          component={VisionScreen}
          options={{
            title: 'Vision',
            tabBarAccessibilityLabel: 'Vision mode. Cy describes what is in front of you out loud.',
          }}
        />
      </Tab.Navigator>

      {/* Floating Voice Button */}
      <View style={styles.voiceButtonWrapper}>
        <VoiceButton />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scene: {
    backgroundColor: palette.background,
  },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    height: 72,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingTop: 10,
    paddingBottom: 8,
    overflow: 'visible',
  },
  tabItem: {
    borderRadius: radii.lg,
  },
  voiceButtonWrapper: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  voiceButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  voicePressable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonOuter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: prismColors.outer,
    borderWidth: 2,
    borderColor: prismColors.outerBorder,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0C9F85',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceButtonMiddle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: prismColors.middle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: prismColors.inner,
    justifyContent: 'center',
    alignItems: 'center',
  },
  siriGlyphWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siriDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  siriDotA: {
    backgroundColor: prismColors.dotA,
    top: 2,
    left: 9,
  },
  siriDotB: {
    backgroundColor: prismColors.dotB,
    right: 2,
    top: 9,
  },
  siriDotC: {
    backgroundColor: prismColors.dotC,
    left: 2,
    top: 9,
  },
  siriDotD: {
    backgroundColor: prismColors.dotD,
    bottom: 2,
    left: 9,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Wake word indicator
  wakeWordIndicator: {
    position: 'absolute',
    bottom: 85,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    gap: 6,
  },
  wakeWordDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  wakeWordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F6E68',
  },
});
