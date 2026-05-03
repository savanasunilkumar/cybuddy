import React from 'react';
import {
  View, Text, Pressable, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, shadows, spacing } from '../theme/tokens';

interface DashboardCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  data: {
    primary: string;
    secondary: string;
    tertiary?: string;
  };
  onPress: () => void;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  icon,
  accentColor,
  data,
  onPress,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { borderColor: accentColor },
        pressed && styles.cardPressed
      ]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${accentColor}1A` }]}>
          <Ionicons name={icon} size={20} color={accentColor} />
        </View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Ionicons name="chevron-forward-outline" size={18} color={palette.textMuted} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.primaryText}>{data.primary}</Text>
        <Text style={styles.secondaryText}>{data.secondary}</Text>
        {data.tertiary ? <Text style={styles.tertiaryText}>{data.tertiary}</Text> : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardPressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    letterSpacing: 0.1,
  },
  content: {
    paddingLeft: 46,
  },
  primaryText: {
    fontSize: 15,
    color: palette.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  secondaryText: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  tertiaryText: {
    marginTop: 4,
    fontSize: 12,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
