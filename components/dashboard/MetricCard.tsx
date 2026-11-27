import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import Text from '../ui/AppText';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  badge?: string;
  variant?: 'full' | 'compact';
  onPress?: () => void;
}

export default function MetricCard({
  label,
  value,
  subtitle,
  badge,
  variant = 'full',
  onPress,
}: MetricCardProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [displayValue, setDisplayValue] = useState(value);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  // Odometer-like smooth glide transition on value updates
  useEffect(() => {
    if (value !== displayValue) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: -5,
          duration: 120,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setDisplayValue(value);
        translateYAnim.setValue(5);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 280,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 280,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [value, displayValue, fadeAnim, translateYAnim]);

  const handlePressIn = () => {
    Animated.timing(pressScale, {
      toValue: 0.975,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 70,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  if (variant === 'compact') {
    return (
      <Animated.View style={[{ flex: 1, transform: [{ scale: pressScale }] }]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.compactCard}
        >
          <Text style={styles.compactLabel}>{label}</Text>
          <Animated.Text
            style={[
              styles.compactValue,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateYAnim }],
              },
            ]}
          >
            {displayValue}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale: pressScale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fullCard}
      >
        <View style={styles.contentLeft}>
          <Text style={styles.label}>{label}</Text>
          <Animated.Text
            style={[
              styles.value,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateYAnim }],
              },
            ]}
          >
            {displayValue}
          </Animated.Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {badge !== undefined && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    fullCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 18,
      paddingVertical: 13,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    contentLeft: {
      flex: 1,
    },
    label: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 3,
    },
    value: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 23,
      color: colors.text,
      letterSpacing: 1.2,
      marginBottom: 2,
    },
    subtitle: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    badgeContainer: {
      width: 40,
      height: 40,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.badgeBackground,
      borderWidth: 1,
      borderColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
    },
    badgeText: {
      fontFamily: FONTS.bold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    compactCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    compactLabel: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    compactValue: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 20,
      color: colors.text,
      letterSpacing: 1,
    },
  });
}
