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
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import Text from './AppText';

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
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [isOpen, setIsOpen] = useState(false);

  const rotationAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const visibilityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const mainBtnScale = useRef(new Animated.Value(1)).current;

  // Staggered animated values for each speed dial action
  const actionAnimsMap = useRef<Map<string, Animated.Value>>(new Map());

  // Ensure an animated value exists for each action
  (actions || []).forEach((action) => {
    if (!actionAnimsMap.current.has(action.id)) {
      actionAnimsMap.current.set(action.id, new Animated.Value(0));
    }
  });

  // Animate visibility (e.g. when changing tabs)
  useEffect(() => {
    Animated.timing(visibilityAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 350 : 250,
      easing: visible ? Easing.bezier(0.16, 1, 0.3, 1) : Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();

    if (!visible && isOpen) {
      setIsOpen(false);
    }
  }, [visible, isOpen, visibilityAnim]);

  // Handle Android back button to dismiss speed dial
  useEffect(() => {
    if (!isOpen) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSpeedDial();
      return true;
    });

    return () => backHandler.remove();
  }, [isOpen]);

  // Staggered open/close animations
  useEffect(() => {
    if (!actions || actions.length === 0) return;

    if (isOpen) {
      const openAnims = actions.map((action) => {
        const anim = actionAnimsMap.current.get(action.id)!;
        return Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 52,
          useNativeDriver: true,
        });
      });

      Animated.parallel([
        Animated.stagger(45, openAnims),
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      const closeAnims = actions
        .slice()
        .reverse()
        .map((action) => {
          const anim = actionAnimsMap.current.get(action.id)!;
          return Animated.timing(anim, {
            toValue: 0,
            duration: 200,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          });
        });

      Animated.parallel([
        Animated.stagger(30, closeAnims),
        Animated.timing(rotationAnim, {
          toValue: 0,
          duration: 240,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
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
  }, [isOpen, actions, rotationAnim, backdropAnim]);

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

  const handleMainPressIn = () => {
    Animated.spring(mainBtnScale, {
      toValue: 0.92,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handleMainPressOut = () => {
    Animated.spring(mainBtnScale, {
      toValue: 1,
      tension: 70,
      friction: 7,
      useNativeDriver: true,
    }).start();
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
            const anim = actionAnimsMap.current.get(action.id) || new Animated.Value(0);

            const itemTranslateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [20 * (actions.length - index), 0],
            });
            const itemScale = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.75, 1],
            });
            const itemOpacity = anim.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0, 0.4, 1],
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
                  <Ionicons name={action.icon} size={20} color={colors.text} />
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
        <Animated.View style={{ transform: [{ scale: mainBtnScale }] }}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.mainButton}
            onPress={handleMainPress}
            onPressIn={handleMainPressIn}
            onPressOut={handleMainPressOut}
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
              <Ionicons name="add" size={30} color={colors.primaryText} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      backgroundColor: colors.modalBackdrop,
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
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginRight: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    labelText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.text,
      letterSpacing: 0.3,
    },
    actionButton: {
      width: 44,
      height: 44,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
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
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
  });
}
