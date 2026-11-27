import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, SPACING, ThemeColors } from '../../theme';
import Text from './AppText';

const { width } = Dimensions.get('window');

export type AlertType = 'default' | 'danger' | 'warning' | 'success' | 'info';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

export interface AlertConfig {
  title: string;
  message?: string;
  type?: AlertType;
  icon?: keyof typeof Ionicons.glyphMap;
  buttons?: AlertButton[];
  cancelable?: boolean;
}

interface CustomAlertModalProps {
  visible: boolean;
  config: AlertConfig | null;
  onClose: () => void;
}

export default function CustomAlertModal({ visible, config, onClose }: CustomAlertModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.92));

  // Resolve Alert Type
  const resolvedType: AlertType = React.useMemo(() => {
    if (!config) return 'default';
    if (config.type) return config.type;

    // Auto-detect based on buttons or title
    const hasDestructive = config.buttons?.some((b) => b.style === 'destructive');
    const lowerTitle = (config.title || '').toLowerCase();
    const lowerMsg = (config.message || '').toLowerCase();

    if (
      hasDestructive ||
      lowerTitle.includes('delete') ||
      lowerTitle.includes('reset') ||
      lowerTitle.includes('remove') ||
      lowerMsg.includes('delete') ||
      lowerMsg.includes('reset') ||
      lowerMsg.includes('permanently')
    ) {
      return 'danger';
    }
    if (
      lowerTitle.includes('warning') ||
      lowerTitle.includes('atenção') ||
      lowerTitle.includes('aviso') ||
      lowerMsg.includes('warning')
    ) {
      return 'warning';
    }
    if (
      lowerTitle.includes('success') ||
      lowerTitle.includes('complete') ||
      lowerTitle.includes('exported') ||
      lowerTitle.includes('sucesso')
    ) {
      return 'success';
    }
    return 'default';
  }, [config]);

  // Trigger animations & haptics on visibility change
  useEffect(() => {
    if (visible) {
      // Trigger Haptics
      if (Platform.OS !== 'web') {
        try {
          if (resolvedType === 'danger') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } else if (resolvedType === 'success') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else if (resolvedType === 'warning') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } catch {
          // Ignore haptic errors on unsupported devices
        }
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible, resolvedType, fadeAnim, scaleAnim]);

  if (!config) return null;

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handleButtonPress = async (button?: AlertButton) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Silently continue
      }
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(async () => {
      onClose();
      if (button?.onPress) {
        await button.onPress();
      }
    });
  };

  // Resolve Icon
  const getIconInfo = (): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string; border: string } => {
    if (config.icon) {
      return {
        name: config.icon,
        color: resolvedType === 'danger' ? colors.error : colors.text,
        bg: resolvedType === 'danger' ? 'rgba(255, 69, 58, 0.12)' : 'rgba(255, 255, 255, 0.08)',
        border: resolvedType === 'danger' ? 'rgba(255, 69, 58, 0.3)' : 'rgba(255, 255, 255, 0.18)',
      };
    }

    switch (resolvedType) {
      case 'danger':
        return {
          name: config.title.toLowerCase().includes('delete') || config.title.toLowerCase().includes('remove')
            ? 'trash-outline'
            : 'alert-circle-outline',
          color: colors.error,
          bg: 'rgba(255, 69, 58, 0.12)',
          border: 'rgba(255, 69, 58, 0.3)',
        };
      case 'warning':
        return {
          name: 'warning-outline',
          color: colors.warning,
          bg: 'rgba(255, 214, 10, 0.12)',
          border: 'rgba(255, 214, 10, 0.3)',
        };
      case 'success':
        return {
          name: 'checkmark-circle-outline',
          color: colors.success,
          bg: 'rgba(48, 209, 88, 0.12)',
          border: 'rgba(48, 209, 88, 0.3)',
        };
      default:
        return {
          name: 'information-circle-outline',
          color: colors.text,
          bg: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.18)',
        };
    }
  };

  const iconInfo = getIconInfo();
  const buttons = config.buttons && config.buttons.length > 0
    ? config.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const isTwoButtons = buttons.length === 2;
  const isMultiButtons = buttons.length > 2;

  // Touch backdrop behavior
  const handleBackdropPress = () => {
    if (config.cancelable) {
      handleDismiss();
      return;
    }
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    if (cancelBtn && buttons.length === 1) {
      handleButtonPress(cancelBtn);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.dialogCard,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* ICON BADGE */}
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: iconInfo.bg, borderColor: iconInfo.border },
                ]}
              >
                <Ionicons name={iconInfo.name} size={26} color={iconInfo.color} />
              </View>

              {/* TITLE */}
              <Text style={styles.title}>{config.title}</Text>

              {/* MESSAGE */}
              {config.message ? (
                <Text style={styles.message}>{config.message}</Text>
              ) : null}

              {/* BUTTONS */}
              {isTwoButtons ? (
                <View style={styles.buttonRow}>
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          styles.buttonFlex,
                          isCancel
                            ? styles.cancelButton
                            : isDestructive
                            ? styles.destructiveButton
                            : styles.confirmButton,
                        ]}
                        onPress={() => handleButtonPress(btn)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isCancel
                              ? styles.cancelButtonText
                              : isDestructive
                              ? styles.destructiveButtonText
                              : styles.confirmButtonText,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={isMultiButtons ? styles.buttonColumn : styles.singleButtonRow}>
                  {buttons.map((btn, index) => {
                    const isCancel = btn.style === 'cancel';
                    const isDestructive = btn.style === 'destructive';

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          isCancel
                            ? styles.cancelButton
                            : isDestructive
                            ? styles.destructiveButton
                            : resolvedType === 'danger'
                            ? styles.destructiveButton
                            : styles.confirmButton,
                        ]}
                        onPress={() => handleButtonPress(btn)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isCancel
                              ? styles.cancelButtonText
                              : isDestructive
                              ? styles.destructiveButtonText
                              : resolvedType === 'danger'
                              ? styles.destructiveButtonText
                              : styles.confirmButtonText,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.modalBackdrop,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
    },
    dialogCard: {
      width: Math.min(width - 48, 360),
      backgroundColor: colors.modalSheet,
      borderRadius: BORDER_RADIUS.xl,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 24,
        },
        android: {
          elevation: 12,
        },
      }),
    },
    iconBadge: {
      width: 54,
      height: 54,
      borderRadius: 27,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      marginBottom: 16,
    },
    title: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 17,
      letterSpacing: 1.2,
      color: colors.text,
      textAlign: 'center',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    message: {
      fontFamily: FONTS.regular,
      fontSize: 13.5,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 22,
      paddingHorizontal: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
      marginTop: 4,
    },
    singleButtonRow: {
      width: '100%',
      marginTop: 4,
    },
    buttonColumn: {
      flexDirection: 'column',
      gap: 8,
      width: '100%',
      marginTop: 4,
    },
    button: {
      height: 46,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonFlex: {
      flex: 1,
    },
    buttonText: {
      fontFamily: FONTS.bold,
      fontSize: 14,
      letterSpacing: 0.3,
    },
    cancelButton: {
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    confirmButton: {
      backgroundColor: colors.primary,
    },
    confirmButtonText: {
      color: colors.primaryText,
    },
    destructiveButton: {
      backgroundColor: colors.error,
      ...Platform.select({
        ios: {
          shadowColor: colors.error,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    destructiveButtonText: {
      color: '#ffffff',
    },
  });
}
