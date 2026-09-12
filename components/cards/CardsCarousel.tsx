import React, { useRef } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import CreditCardItem from './CreditCardItem';

interface CardsCarouselProps {
  cards: CreditCard[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 44;
const SNAP_INTERVAL = CARD_WIDTH + 12;

export default function CardsCarousel({
  cards,
  activeIndex,
  onIndexChange,
}: CardsCarouselProps) {
  const scrollViewRef = useRef<ScrollView>(null);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    const clampedIndex = Math.max(0, Math.min(index, cards.length - 1));
    if (clampedIndex !== activeIndex) {
      onIndexChange(clampedIndex);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        contentContainerStyle={styles.scrollContent}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {cards.map((card, index) => (
          <View
            key={card.id}
            style={[
              styles.cardWrapper,
              { width: CARD_WIDTH },
              index < cards.length - 1 && { marginRight: 12 },
            ]}
          >
            <CreditCardItem card={card} isActive={index === activeIndex} />
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      {cards.length > 1 && (
        <View style={styles.dotsContainer}>
          {cards.map((_, i) => {
            const isActive = i === activeIndex;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
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
  scrollContent: {
    paddingHorizontal: 22,
  },
  cardWrapper: {
    // Dynamic width
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
  dotActive: {
    width: 12,
    backgroundColor: '#ffffff',
  },
  dotInactive: {
    width: 4,
    backgroundColor: '#303038',
  },
});
