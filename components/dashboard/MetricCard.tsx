import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  badge?: string;
  variant?: 'full' | 'compact';
}

export default function MetricCard({
  label,
  value,
  subtitle,
  badge,
  variant = 'full',
}: MetricCardProps) {
  if (variant === 'compact') {
    return (
      <View style={styles.compactCard}>
        <Text style={styles.compactLabel}>{label}</Text>
        <Text style={styles.compactValue}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={styles.fullCard}>
      <View style={styles.contentLeft}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {badge !== undefined && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullCard: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#24242a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contentLeft: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 3,
    fontWeight: '500',
  },
  value: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 23,
    color: '#ffffff',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  badgeContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#1d1d23',
    borderWidth: 1,
    borderColor: '#2d2d35',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  badgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  compactCard: {
    flex: 1,
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  compactLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  compactValue: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 1,
  },
});
