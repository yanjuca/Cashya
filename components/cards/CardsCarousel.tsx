import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import CreditCardItem from './CreditCardItem';

interface CardsCarouselProps {
  cards: CreditCard[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onAddCard?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 45;
const CARD_HEIGHT = 190;
const STACK_OFFSET_X = 30;
const FRONT_SCALE = 1;
const STACK_SCALE_STEP = 0.1;
const MAX_VISIBLE_DEPTH = 1;

export default function CardsCarousel({
  cards,
  activeIndex,
  onIndexChange,
  onAddCard,
}: CardsCarouselProps) {
  const animatedDepths = useRef<Record<string, Animated.Value>>({}).current;
  const animatedDots = useRef<Record<string, Animated.Value>>({}).current;

  cards.forEach((card, index) => {
    const total = cards.length;
    const depth = (index - activeIndex + total) % total;
    if (!animatedDepths[card.id]) {
      animatedDepths[card.id] = new Animated.Value(depth);
    }
    if (!animatedDots[card.id]) {
      animatedDots[card.id] = new Animated.Value(index === activeIndex ? 1 : 0);
    }
  });

  useEffect(() => {
    const total = cards.length;
    const animations = cards.map((card, index) => {
      const depth = (index - activeIndex + total) % total;
      return Animated.timing(animatedDepths[card.id], {
        toValue: depth,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    });
    const dotAnimations = cards.map((card, index) =>
      Animated.timing(animatedDots[card.id], {
        toValue: index === activeIndex ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      })
    );
    Animated.parallel([...animations, ...dotAnimations]).start();
  }, [activeIndex, cards.length]);

  if (cards.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <TouchableOpacity
            style={styles.addCardPlaceholder}
            onPress={onAddCard}
            activeOpacity={0.7}
          >
            <View style={styles.addCardIconCircle}>
              <Ionicons name="add" size={22} color="#ffffff" />
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

  const goToNext = () => {
    onIndexChange((activeIndex + 1) % cards.length);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={goToNext}
        style={[styles.stackArea, { height: CARD_HEIGHT + 20 }]}
      >
        {cards.map((card, index) => {
          const total = cards.length;
          const depthValue = animatedDepths[card.id];
          const targetDepth = (index - activeIndex + total) % total;

          const translateX = depthValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [-2, STACK_OFFSET_X * 0.6, STACK_OFFSET_X],
          });

          const translateY = 0;

          const scale = depthValue.interpolate({
            inputRange: [0, 1],
            outputRange: [FRONT_SCALE, FRONT_SCALE - STACK_SCALE_STEP],
          });

          const opacity = depthValue.interpolate({
            inputRange: [0, MAX_VISIBLE_DEPTH, MAX_VISIBLE_DEPTH + 1],
            outputRange: [1, 1, 0],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={card.id}
              style={[
                styles.stackCard,
                {
                  width: CARD_WIDTH,
                  zIndex: total - targetDepth,
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
            >
              <CreditCardItem card={card} isActive={targetDepth === 0} />
            </Animated.View>
          );
        })}
      </Pressable>

      {/* Pagination Dots */}
      {cards.length > 1 && (
        <View style={styles.dotsContainer}>
          {cards.map((card, i) => {
            const dotValue = animatedDots[card.id];
            return (
              <TouchableOpacity key={card.id} onPress={() => onIndexChange(i)} hitSlop={8}>
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      width: dotValue.interpolate({ inputRange: [0, 1], outputRange: [4, 12] }),
                      backgroundColor: dotValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['#303038', '#ffffff'],
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

const styles = StyleSheet.create({
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
    marginTop: 8,
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
    backgroundColor: '#141418',
    borderWidth: 1,
    borderColor: '#262630',
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
    backgroundColor: '#20202a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardTextContainer: {
    flex: 1,
  },
  addCardTitle: {
    fontFamily: FONTS.medium,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 2,
  },
  addCardSubtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});