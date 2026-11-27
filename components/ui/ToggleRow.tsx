import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import Text from './AppText';

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

export default function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  style,
}: ToggleRowProps) {
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
    <TouchableOpacity style={[styles.row, style]} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={18} color={value ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.textBox}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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