import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import CreditCardItem from './CreditCardItem';

interface CardsCarouselProps {
  cards: CreditCard[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onAddCard?: () => void;
  onCardPress?: (card: CreditCard) => void;
}

const { width: PAGE_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = PAGE_WIDTH - 45;
const CARD_HEIGHT = 190;
const STACK_OFFSET_X = 30;
const STACK_SCALE = 0.9;

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    try {
      Haptics.selectionAsync();
    } catch {}
  }
};

export default function CardsCarousel({
  cards,
  activeIndex,
  onIndexChange,
  onAddCard,
  onCardPress,
}: CardsCarouselProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const total = cards.length;
  const loop = total > 1;
  const baseOffset = loop ? total : 0;
  const scrollX = useRef(new Animated.Value((baseOffset + activeIndex) * PAGE_WIDTH)).current;
  const currentOffsetRef = useRef((baseOffset + activeIndex) * PAGE_WIDTH);
  const lengthRef = useRef(total);
  const needsRepositionRef = useRef(true);

  const virtualCards = useMemo(() => {
    const copies = loop ? 3 : 1;
    const list: { card: CreditCard; virtualIndex: number; realIndex: number }[] = [];
    for (let copy = 0; copy < copies; copy++) {
      cards.forEach((card, realIndex) => {
        list.push({ card, virtualIndex: copy * total + realIndex, realIndex });
      });
    }
    return list;
  }, [cards, loop, total]);

  useEffect(() => {
    if (total === 0) {
      scrollX.setValue(0);
      currentOffsetRef.current = 0;
      lengthRef.current = 0;
      needsRepositionRef.current = true;
      return;
    }

    if (lengthRef.current !== total) {
      lengthRef.current = total;
      needsRepositionRef.current = true;
    }

    if (needsRepositionRef.current) {
      const targetX = (baseOffset + activeIndex) * PAGE_WIDTH;
      scrollX.setValue(targetX);
      scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
      currentOffsetRef.current = targetX;
      setTimeout(() => {
        needsRepositionRef.current = false;
      }, 250);
      return;
    }

    const currentV = Math.round(currentOffsetRef.current / PAGE_WIDTH);
    const realCurrent = ((currentV % total) + total) % total;
    let delta = activeIndex - realCurrent;
    if (loop) {
      if (delta > total / 2) delta -= total;
      else if (delta < -total / 2) delta += total;
    }
    if (delta === 0) return;

    const targetX = (currentV + delta) * PAGE_WIDTH;
    scrollViewRef.current?.scrollTo({ x: targetX, animated: true });
    currentOffsetRef.current = targetX;
  }, [activeIndex, total, loop, baseOffset, scrollX]);

  if (!cards || cards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <TouchableOpacity
            style={styles.addCardPlaceholder}
            onPress={() => {
              triggerHaptic();
              onAddCard?.();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.addCardIconCircle}>
              <Ionicons name="add" size={22} color={colors.text} />
            </View>
            <View style={styles.addCardTextContainer}>
              <Text style={styles.addCardTitle}>Add your card</Text>
              <Text style={styles.addCardSubtitle}>Track limits, spend and accounts</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleContentSizeChange = () => {
    if (!needsRepositionRef.current) return;
    const targetX = (baseOffset + activeIndex) * PAGE_WIDTH;
    scrollX.setValue(targetX);
    scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
    currentOffsetRef.current = targetX;
    needsRepositionRef.current = false;
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const maxV = loop ? total * 3 - 1 : total - 1;
    const virtualIndex = Math.max(0, Math.min(Math.round(offsetX / PAGE_WIDTH), maxV));
    const realIndex = virtualIndex % total;

    if (loop && (virtualIndex < total || virtualIndex >= total * 2)) {
      const targetX = (total + realIndex) * PAGE_WIDTH;
      scrollViewRef.current?.scrollTo({ x: targetX, animated: false });
      currentOffsetRef.current = targetX;
    } else {
      currentOffsetRef.current = virtualIndex * PAGE_WIDTH;
    }

    if (realIndex !== activeIndex) {
      triggerHaptic();
      onIndexChange(realIndex);
    }
  };

  const dotPoints = (i: number) => {
    const copies = loop ? 3 : 1;
    const xs: number[] = [];
    const active: number[] = [];
    for (let copy = 0; copy < copies; copy++) {
      const center = i + copy * total;
      xs.push((center - 1) * PAGE_WIDTH, center * PAGE_WIDTH, (center + 1) * PAGE_WIDTH);
      active.push(0, 1, 0);
    }
    return { xs, active };
  };

  const goToIndex = (index: number) => {
    if (index === activeIndex) return;
    triggerHaptic();
    onIndexChange(index);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.stackArea, { height: CARD_HEIGHT + 4 }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {virtualCards.map(({ card, virtualIndex, realIndex }) => {
            const inputRange = [
              (virtualIndex - 2) * PAGE_WIDTH,
              (virtualIndex - 1) * PAGE_WIDTH,
              virtualIndex * PAGE_WIDTH,
              (virtualIndex + 1) * PAGE_WIDTH,
            ];

            const translateX = scrollX.interpolate({
              inputRange,
              outputRange: [STACK_OFFSET_X, STACK_OFFSET_X, 0, -CARD_WIDTH * 0.4],
              extrapolate: 'clamp',
            });

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [STACK_SCALE, STACK_SCALE, 1, 1],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0, 1, 1, 0],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={`${virtualIndex}-${card.id}`}
                style={[
                  styles.stackCard,
                  {
                    width: CARD_WIDTH,
                    zIndex: virtualCards.length - virtualIndex,
                    opacity,
                    transform: [{ translateX }, { scale }],
                  },
                ]}
              >
                <CreditCardItem card={card} isActive={realIndex === activeIndex} />
              </Animated.View>
            );
          })}
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          bounces={false}
          overScrollMode="never"
          contentOffset={{ x: (baseOffset + activeIndex) * PAGE_WIDTH, y: 0 }}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onContentSizeChange={handleContentSizeChange}
          style={StyleSheet.absoluteFill}
        >
          {virtualCards.map(({ card, virtualIndex }) => (
            <Pressable
              key={`${virtualIndex}-${card.id}`}
              style={{ width: PAGE_WIDTH, height: CARD_HEIGHT + 4 }}
              onPress={() => {
                triggerHaptic();
                onCardPress?.(card);
              }}
            />
          ))}
        </Animated.ScrollView>
      </View>

      {cards.length > 1 && (
        <View style={styles.dotsContainer}>
          {cards.map((card, i) => {
            const { xs, active } = dotPoints(i);
            return (
              <TouchableOpacity
                key={card.id}
                onPress={() => goToIndex(i)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      width: scrollX.interpolate({
                        inputRange: xs,
                        outputRange: active.map((v) => 4 + v * 8),
                        extrapolate: 'clamp',
                      }),
                      backgroundColor: scrollX.interpolate({
                        inputRange: xs,
                        outputRange: active.map((v) => (v ? colors.text : colors.borderLight)),
                        extrapolate: 'clamp',
                      }),
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginVertical: 2,
    },
    stackArea: {
      position: 'relative',
    },
    stackCard: {
      position: 'absolute',
      left: 22,
      top: 0,
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    dot: {
      height: 4,
      borderRadius: 2,
    },
    emptyContainer: {
      paddingHorizontal: 22,
    },
    addCardPlaceholder: {
      height: 68,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderStyle: 'dashed',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 14,
    },
    addCardIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.cardBackgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addCardTextContainer: {
      flex: 1,
    },
    addCardTitle: {
      fontFamily: FONTS.medium,
      color: colors.text,
      fontSize: 14,
      marginBottom: 2,
    },
    addCardSubtitle: {
      fontFamily: FONTS.regular,
      color: colors.textSecondary,
      fontSize: 11,
    },
  });
}