import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../theme';

interface FABProps {
  onPress: () => void;
  bottomOffset?: number;
}

export default function FAB({ onPress, bottomOffset = 95 }: FABProps) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Silently continue if haptics is not available
      }
    }
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.container, { bottom: bottomOffset }]}
      onPress={handlePress}
    >
      <Ionicons name="add" size={30} color="#ffffff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 99,
  },
});
