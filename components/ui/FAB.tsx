import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';

export interface SpeedDialAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

export interface FABProps {
  actions?: SpeedDialAction[];
  onPress?: () => void;
  visible?: boolean;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
}

export default function FAB({
  actions,
  onPress,
  visible = true,
  bottomOffset = 95,
  style,
}: FABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const expandAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const visibilityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Animate visibility (e.g. when changing tabs)
  useEffect(() => {
    Animated.timing(visibilityAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 350 : 250,
      easing: visible ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();

    if (!visible && isOpen) {
      setIsOpen(false);
    }
  }, [visible]);

  // Handle Android back button to dismiss speed dial
  useEffect(() => {
    if (!isOpen) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSpeedDial();
      return true;
    });

    return () => backHandler.remove();
  }, [isOpen]);

  // Open/close animations
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(expandAnim, {
          toValue: 1,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(expandAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rotationAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen]);

  const closeSpeedDial = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Silently continue
      }
    }
    setIsOpen(false);
  };

  const handleMainPress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(
          isOpen
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium
        );
      } catch {
        // Silently continue
      }
    }

    if (actions && actions.length > 0) {
      setIsOpen((prev) => !prev);
    } else if (onPress) {
      onPress();
    }
  };

  const handleActionPress = (action: SpeedDialAction) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Silently continue
      }
    }
    setIsOpen(false);
    action.onPress();
  };

  const hasActions = actions && actions.length > 0;

  return (
    <View
      style={[
        styles.rootOverlay,
        {
          zIndex: isOpen ? 30 : 5,
          elevation: isOpen ? 30 : 5,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Dim backdrop when speed dial is open */}
      {hasActions && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
          pointerEvents={isOpen ? 'auto' : 'none'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSpeedDial} />
        </Animated.View>
      )}

      {/* Speed Dial Actions Container */}
      {hasActions && (
        <View
          style={[
            styles.actionsContainer,
            {
              bottom: bottomOffset + 68,
            },
          ]}
          pointerEvents={isOpen ? 'box-none' : 'none'}
        >
          {actions.map((action, index) => {
            const itemTranslateY = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [24 * (actions.length - index), 0],
            });
            const itemScale = expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.7, 1],
            });
            const itemOpacity = expandAnim.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.3, 1],
            });

            return (
              <Animated.View
                key={action.id}
                style={[
                  styles.actionRow,
                  {
                    opacity: itemOpacity,
                    transform: [{ translateY: itemTranslateY }, { scale: itemScale }],
                  },
                ]}
                pointerEvents={isOpen ? 'auto' : 'none'}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.labelChip}
                  onPress={() => handleActionPress(action)}
                >
                  <Text style={styles.labelText}>{action.label}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.actionButton}
                  onPress={() => handleActionPress(action)}
                >
                  <Ionicons name={action.icon} size={20} color="#ffffff" />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Main Floating Action Button */}
      <Animated.View
        style={[
          styles.mainButtonWrapper,
          {
            bottom: bottomOffset,
            opacity: visibilityAnim,
            transform: [
              {
                translateY: visibilityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [90, 0],
                }),
              },
            ],
          },
          style,
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.mainButton}
          onPress={handleMainPress}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: hasActions
                    ? rotationAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '45deg'],
                      })
                    : '0deg',
                },
              ],
            }}
          >
            <Ionicons name="add" size={30} color="#ffffff" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  actionsContainer: {
    position: 'absolute',
    right: 22,
    alignItems: 'flex-end',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  labelChip: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  labelText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6, // Centers 44px button with 56px main button (56 - 44) / 2 = 6
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  mainButtonWrapper: {
    position: 'absolute',
    right: 22,
    width: 56,
    height: 56,
  },
  mainButton: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
});
