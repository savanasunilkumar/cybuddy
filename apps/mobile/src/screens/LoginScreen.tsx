import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { palette, radii, shadows, spacing } from '../theme/tokens';

const FEATURES = [
  { label: 'Canvas coursework', icon: 'school-outline' as const },
  { label: 'Outlook priorities', icon: 'mail-outline' as const },
  { label: 'Workday tasks', icon: 'briefcase-outline' as const },
  { label: 'CyRide schedules', icon: 'bus-outline' as const },
];

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      await login();
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert(
        'Sign-in failed',
        'Authentication could not be completed. Check backend connectivity and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="rocket-outline" size={14} color={palette.brand} />
            <Text style={styles.heroBadgeText}>Cybuddy</Text>
          </View>
          <Text style={styles.title}>Iowa State Student Workspace</Text>
          <Text style={styles.subtitle}>
            One place for coursework, communication, campus operations, and transit.
          </Text>
        </View>

        <View style={styles.featuresCard}>
          {FEATURES.map((item) => (
            <View key={item.label} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={item.icon} size={18} color={palette.brand} />
              </View>
              <Text style={styles.featureText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            (isLoading || pressed) && styles.loginButtonPressed,
          ]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.loginButtonText}>
            {isLoading ? 'Signing in...' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF" />
        </Pressable>

        <Text style={styles.disclaimer}>
          Use your Iowa State account. No personal credentials are stored locally.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  wrapper: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  heroCard: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    ...shadows.card,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.brandMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  heroBadgeText: {
    fontSize: 12,
    color: palette.brand,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: palette.textSecondary,
  },
  featuresCard: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceMuted,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.border,
  },
  featureText: {
    fontSize: 15,
    color: palette.textPrimary,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: radii.md,
    backgroundColor: palette.brand,
    paddingVertical: 15,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loginButtonPressed: {
    opacity: 0.9,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: palette.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});

