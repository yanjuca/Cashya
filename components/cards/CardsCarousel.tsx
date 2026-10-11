import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemeColors } from '../../theme';
import CreditCardItem from './CreditCardItem';

interface CardsCarouselProps {
  cards: CreditCard[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onAddCard?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 44;
const SNAP_INTERVAL = CARD_WIDTH + 12;

export default function CardsCarousel({
  cards,
  activeIndex,
  onIndexChange,
}: CardsCarouselProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(activeIndex * SNAP_INTERVAL)).current;
  const currentOffsetRef = useRef(activeIndex * SNAP_INTERVAL);

  if (!cards || cards.length === 0) {
    return null;
  }

  // Smoothly scroll to activeIndex if changed programmatically
  useEffect(() => {
    const targetX = activeIndex * SNAP_INTERVAL;
    if (Math.abs(currentOffsetRef.current - targetX) > 10) {
      scrollViewRef.current?.scrollTo({ x: targetX, animated: true });
    }
  }, [activeIndex]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    currentOffsetRef.current = offsetX;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));
    if (clampedIndex !== activeIndex) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.selectionAsync();
        } catch {}
      }
      onIndexChange(clampedIndex);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
              currentOffsetRef.current = e.nativeEvent.contentOffset.x;
            },
          }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {cards.map((card, index) => {
          const inputRange = [
            (index - 1) * SNAP_INTERVAL,
            index * SNAP_INTERVAL,
            (index + 1) * SNAP_INTERVAL,
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.94, 1, 0.94],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.65, 1, 0.65],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={card.id}
              style={[
                styles.cardWrapper,
                { width: CARD_WIDTH },
                index < cards.length - 1 && { marginRight: 12 },
                {
                  transform: [{ scale }],
                  opacity,
                },
              ]}
            >
              <CreditCardItem card={card} isActive={index === activeIndex} />
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {/* Fluid Dynamic Pagination Dots */}
      {cards.length > 1 && (
        <View style={styles.dotsContainer}>
          {cards.map((_, i) => {
            const dotInputRange = [
              (i - 1) * SNAP_INTERVAL,
              i * SNAP_INTERVAL,
              (i + 1) * SNAP_INTERVAL,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange: dotInputRange,
              outputRange: [4, 14, 4],
              extrapolate: 'clamp',
            });

            const dotOpacity = scrollX.interpolate({
              inputRange: dotInputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                  },
                ]}
              />
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
    scrollContent: {
      paddingHorizontal: 22,
    },
    cardWrapper: {
      // Dynamic width and transforms
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
      backgroundColor: colors.text,
    },
  });
}
