import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
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
const CARD_WIDTH = SCREEN_WIDTH - 44;
const SNAP_INTERVAL = CARD_WIDTH + 12;

export default function CardsCarousel({
  cards,
  activeIndex,
  onIndexChange,
  onAddCard,
}: CardsCarouselProps) {
  const scrollViewRef = useRef<ScrollView>(null);

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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  addCardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});
