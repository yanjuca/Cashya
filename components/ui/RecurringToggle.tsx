import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';

interface RecurringToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  subtitle?: string;
  months?: string;
  onMonthsChange?: (value: string) => void;
}

export default function RecurringToggle({
  value,
  onChange,
  subtitle = 'Repeats every month',
  months = '',
  onMonthsChange,
}: RecurringToggleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 240,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    onChange(!value);
  };

  const handleMonthsChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    const parsed = parseInt(digits, 10);
    if (!parsed) {
      onMonthsChange?.('');
      return;
    }
    onMonthsChange?.(String(Math.min(parsed, 120)));
  };

  const monthsCount = parseInt(months, 10);
  const durationSubtitle = monthsCount
    ? `Total of ${monthsCount} ${monthsCount === 1 ? 'month' : 'months'}, including this one`
    : 'Repeats until you stop it';

  const trackBackground = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.cardBackgroundLight, colors.primary],
  });
  const trackBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderLight, colors.primary],
  });
  const thumbTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });
  const thumbBackground = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.primaryText],
  });

  return (
    <>
    <TouchableOpacity style={styles.row} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.iconBox}>
        <Ionicons name="repeat" size={18} color={value ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>Recurring expense</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Animated.View
        style={[styles.track, { backgroundColor: trackBackground, borderColor: trackBorder }]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbBackground,
              transform: [{ translateX: thumbTranslate }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>

    {value && onMonthsChange && (
      <View style={[styles.row, styles.durationRow]}>
        <View style={styles.iconBox}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.textBox}>
          <Text style={styles.title}>Duration</Text>
          <Text style={styles.subtitle}>{durationSubtitle}</Text>
        </View>
        <View style={styles.monthsBox}>
          <TextInput
            style={styles.monthsInput}
            value={months}
            onChangeText={handleMonthsChange}
            placeholder="∞"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={3}
            selectTextOnFocus
          />
          <Text style={styles.monthsSuffix}>mo</Text>
        </View>
      </View>
    )}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 18,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    durationRow: {
      marginTop: 10,
    },
    monthsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 10,
      height: 36,
    },
    monthsInput: {
      minWidth: 30,
      padding: 0,
      textAlign: 'center',
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 16,
      letterSpacing: 1,
      color: colors.text,
    },
    monthsSuffix: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    textBox: {
      flex: 1,
    },
    title: {
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.text,
    },
    subtitle: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    track: {
      width: 44,
      height: 26,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    thumb: {
      width: 18,
      height: 18,
      borderRadius: BORDER_RADIUS.full,
    },
  });
}