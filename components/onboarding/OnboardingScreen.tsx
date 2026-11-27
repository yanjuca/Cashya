import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import Text from '../ui/AppText';

type IconName = keyof typeof Ionicons.glyphMap;

interface Tip {
  icon: IconName;
  text: string;
}

interface Slide {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  tips: Tip[];
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    icon: 'wallet-outline',
    title: 'WELCOME TO CASH',
    body: 'A private place to keep track of what you spend. Start right away, no sign-up needed.',
    tips: [
      { icon: 'lock-closed-outline', text: 'Everything is stored on your device' },
      { icon: 'cloud-offline-outline', text: 'Works fully offline' },
      { icon: 'hand-left-outline', text: 'Swipe left or right to move between tabs' },
    ],
  },
  {
    key: 'cards',
    icon: 'card-outline',
    title: 'YOUR CARDS',
    body: 'Home shows your cards and the expenses linked to each one.',
    tips: [
      { icon: 'swap-horizontal-outline', text: 'Swipe the carousel to switch cards' },
      { icon: 'add-circle-outline', text: 'Tap + to add a card or log an expense' },
    ],
  },
  {
    key: 'transactions',
    icon: 'receipt-outline',
    title: 'TRANSACTIONS',
    body: 'Every expense in one place, as a list or on a calendar.',
    tips: [
      { icon: 'calendar-outline', text: 'Use the toggle at the top to switch views' },
      { icon: 'people-outline', text: 'Track who owes what and mark expenses as paid' },
      { icon: 'repeat-outline', text: 'Make an expense recurring so it repeats monthly' },
      { icon: 'checkmark-done-outline', text: 'Press and hold to select several and delete them' },
    ],
  },
  {
    key: 'analytics',
    icon: 'pie-chart-outline',
    title: 'ANALYTICS',
    body: 'Understand where your money goes.',
    tips: [
      { icon: 'stats-chart-outline', text: 'Overview of total, paid and pending amounts' },
      { icon: 'pricetags-outline', text: 'Breakdown by person and by category' },
      { icon: 'calendar-number-outline', text: 'Recent months side by side' },
    ],
  },
  {
    key: 'settings',
    icon: 'settings-outline',
    title: 'MAKE IT YOURS',
    body: 'Fine-tune CASH from the Settings tab.',
    tips: [
      { icon: 'color-palette-outline', text: 'Pick a theme and an accent color' },
      { icon: 'share-outline', text: 'Export a backup and restore it any time' },
      { icon: 'finger-print-outline', text: 'Optionally add a login with biometric unlock' },
    ],
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { visible: authVisible } = useAuth();
  const { visible, finish } = useOnboarding();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scrollRef = useRef<{ scrollTo: (options: { x: number; animated: boolean }) => void } | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  const isOpen = visible && !authVisible;
  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    if (!isOpen) return;
    setIndex(0);
    scrollX.setValue(0);
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [isOpen, fade, scrollX]);

  const tap = useCallback(() => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  }, []);

  const goTo = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    },
    [width]
  );

  const handleNext = () => {
    tap();
    if (isLast) {
      finish();
      return;
    }
    goTo(index + 1);
  };

  const handleSkip = () => {
    tap();
    finish();
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) {
        goTo(index - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isOpen, index, goTo]);

  if (!isOpen) return null;

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <StatusBar barStyle={colors.statusBar} />
      <LinearGradient
        colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>cash</Text>
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.skipButton, isLast && styles.skipHidden]}
            disabled={isLast}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Animated.ScrollView
          ref={scrollRef as any}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          onMomentumScrollEnd={handleMomentumEnd}
          style={styles.pager}
        >
          {SLIDES.map((slide) => (
            <View key={slide.key} style={{ width }}>
              <ScrollView
                contentContainerStyle={styles.slideContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={slide.icon} size={44} color={colors.primary} />
                </View>

                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>

                <View style={styles.tipsCard}>
                  {slide.tips.map((tip, i) => (
                    <View
                      key={tip.text}
                      style={[styles.tipRow, i < slide.tips.length - 1 && styles.tipRowDivider]}
                    >
                      <View style={styles.tipIcon}>
                        <Ionicons name={tip.icon} size={16} color={colors.primary} />
                      </View>
                      <Text style={styles.tipText}>{tip.text}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => {
              const range = [(i - 1) * width, i * width, (i + 1) * width];
              return (
                <Animated.View
                  key={slide.key}
                  style={[
                    styles.dot,
                    {
                      opacity: scrollX.interpolate({
                        inputRange: range,
                        outputRange: [0.25, 1, 0.25],
                        extrapolate: 'clamp',
                      }),
                      transform: [
                        {
                          scale: scrollX.interpolate({
                            inputRange: range,
                            outputRange: [1, 1.5, 1],
                            extrapolate: 'clamp',
                          }),
                        },
                      ],
                    },
                  ]}
                />
              );
            })}
          </View>

          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
            <Ionicons
              name={isLast ? 'checkmark' : 'arrow-forward'}
              size={18}
              color={colors.primaryText}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      zIndex: 90,
      elevation: 90,
    },
    safeArea: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 6,
      minHeight: 56,
    },
    brand: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 28,
      color: colors.text,
      letterSpacing: 1.5,
    },
    skipButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    skipHidden: {
      opacity: 0,
    },
    skipText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    pager: {
      flex: 1,
    },
    slideContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: BORDER_RADIUS.xxl,
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      marginBottom: 28,
    },
    title: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 28,
      color: colors.text,
      letterSpacing: 1,
      marginBottom: 10,
    },
    body: {
      fontFamily: FONTS.regular,
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    tipsCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    tipRowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    tipIcon: {
      width: 30,
      height: 30,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tipText: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
      gap: 20,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 54,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.primary,
    },
    nextText: {
      fontFamily: FONTS.bold,
      fontSize: 15,
      color: colors.primaryText,
    },
  });
}