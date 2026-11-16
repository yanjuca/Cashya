import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  customHeader?: React.ReactNode;
  children: React.ReactNode;
  cardStyle?: ViewStyle;
}

export default function BottomSheetModal({
  visible,
  onClose,
  title,
  headerLeft,
  headerRight,
  customHeader,
  children,
  cardStyle,
}: BottomSheetModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToY = (y: number, animated: boolean) => {
    const node = scrollViewRef.current as unknown as {
      scrollTo?: (options: { y: number; animated: boolean }) => void;
    } | null;
    node?.scrollTo?.({ y, animated });
  };
  const isClosingRef = useRef(false);
  const isUserDraggingRef = useRef(false);
  const hasOpenedRef = useRef(false);

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    isClosingRef.current = false;
    isUserDraggingRef.current = false;
    onClose();
  };

  // Dynamic card height measured from content layout
  const [cardHeight, setCardHeight] = useState(Math.round(SCREEN_HEIGHT * 0.75));
  const cardHeightRef = useRef(cardHeight);
  cardHeightRef.current = cardHeight;

  // Entrance & Exit animation value (starts at SCREEN_HEIGHT, animates to 0)
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // Scroll tracking value for native drag
  const scrollY = useRef(new Animated.Value(cardHeight)).current;
  const hasAnimatedOpenRef = useRef(false);

  const startEntranceAnimation = () => {
    if (hasAnimatedOpenRef.current) return;
    hasAnimatedOpenRef.current = true;

    isClosingRef.current = false;
    hasOpenedRef.current = false;
    isUserDraggingRef.current = false;

    // Start offscreen
    slideAnim.setValue(SCREEN_HEIGHT);
    scrollY.setValue(cardHeightRef.current);

    requestAnimationFrame(() => {
      scrollToY(cardHeightRef.current, false);
    });

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 380,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start(() => {
      hasOpenedRef.current = true;
    });
  };

  // Smooth slide-in from bottom to top using signature Nothing OS cubic bezier
  useEffect(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (visible) {
      hasAnimatedOpenRef.current = false;
      slideAnim.setValue(SCREEN_HEIGHT);
      scrollY.setValue(cardHeightRef.current);

      requestAnimationFrame(() => {
        startEntranceAnimation();
      });
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
      hasOpenedRef.current = false;
      hasAnimatedOpenRef.current = false;
      isClosingRef.current = false;
      isUserDraggingRef.current = false;
    }

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [visible, slideAnim, scrollY]);

  // Programmatic dismiss that smoothly slides down to bottom
  const handleClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start(() => {
      triggerClose();
    });
  };

  const handleCardLayout = (e: LayoutChangeEvent) => {
    const measured = Math.round(e.nativeEvent.layout.height);
    if (measured > 80 && Math.abs(measured - cardHeight) > 8) {
      cardHeightRef.current = measured;
      setCardHeight(measured);
    }
  };

  const handleScrollBeginDrag = () => {
    isUserDraggingRef.current = true;
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const vy = e.nativeEvent.velocity?.y ?? 0;
    const target = cardHeightRef.current;

    // If dragged down past threshold (25% down) or flicked downward with velocity
    if (y < target * 0.75 || vy < -0.3) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.selectionAsync();
        } catch {
          // Silently ignore
        }
      }
      isClosingRef.current = true;
      scrollToY(0, true);
      closeTimeoutRef.current = setTimeout(() => {
        triggerClose();
      }, 300);
    } else {
      // Snap back up to open position
      scrollToY(target, true);
      isUserDraggingRef.current = false;
    }
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // Only close if we are explicitly closing OR the user dragged down to the bottom
    if (y <= 5 && (isClosingRef.current || (hasOpenedRef.current && isUserDraggingRef.current))) {
      triggerClose();
    }
  };

  const snapOffsets = useMemo(() => [0, cardHeight], [cardHeight]);

  // Backdrop opacity during entrance / programmatic exit
  const entranceBackdropOpacity = slideAnim.interpolate({
    inputRange: [0, SCREEN_HEIGHT * 0.7, SCREEN_HEIGHT],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  // Backdrop opacity during scroll drag
  const scrollBackdropOpacity = scrollY.interpolate({
    inputRange: [0, Math.max(cardHeight, 1)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Combined backdrop opacity on native driver
  const backdropOpacity = Animated.multiply(entranceBackdropOpacity, scrollBackdropOpacity);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      onShow={startEntranceAnimation}
    >
      {/* Backdrop: Fixed behind the ScrollView, animated opacity on native driver */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdropBackground,
          { opacity: backdropOpacity },
        ]}
        pointerEvents="none"
      />

      {/* Native ScrollView: Handles 100% of gestures at 120 FPS natively */}
      <Animated.ScrollView
        ref={scrollViewRef as any}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={styles.scrollContentContainer}
        contentOffset={{ x: 0, y: cardHeight }}
        bounces={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapOffsets}
        snapToEnd={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {/* Top Spacer: Tapping above the card dismisses the sheet */}
        <Pressable
          style={{ height: SCREEN_HEIGHT }}
          onPress={handleClose}
        />

        {/* Modal Card with slideAnim entrance transform */}
        <Animated.View
          onLayout={handleCardLayout}
          style={[
            styles.modalCard,
            cardStyle,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Minimal Nothing OS Drag Handle */}
          <View style={styles.dragHandleArea}>
            <View style={styles.dragHandleBar} />
          </View>

          {/* Header */}
          {customHeader ? (
            customHeader
          ) : (
            <View style={styles.modalHeader}>
              <View style={styles.headerLeftContainer}>
                {headerLeft}
                {title && <Text style={styles.modalTitle}>{title}</Text>}
              </View>
              <View style={styles.headerRightContainer}>
                {headerRight}
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Content */}
          {children}
        </Animated.View>
      </Animated.ScrollView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdropBackground: {
      backgroundColor: colors.modalBackdrop,
    },
    scrollContentContainer: {
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: colors.modalSheet,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
    },
    dragHandleArea: {
      width: '100%',
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 14,
    },
    dragHandleBar: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeftContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerRightContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: FONTS.ndot || FONTS.system,
      color: colors.text,
      letterSpacing: 1,
    },
  });
}
