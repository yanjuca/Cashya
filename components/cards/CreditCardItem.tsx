import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import { COLORS, FONTS } from '../../theme';

interface CreditCardItemProps {
  card: CreditCard;
  isActive?: boolean;
}

export default function CreditCardItem({ card, isActive = true }: CreditCardItemProps) {
  const accentColor = card.colorAccent || COLORS.primary;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.dotGrid} pointerEvents="none">
        {Array.from({ length: 14 }).map((_, row) => (
          <View key={row} style={styles.dotRow}>
            {Array.from({ length: 26 }).map((_, col) => (
              <View key={col} style={styles.dot} />
            ))}
          </View>
        ))}
      </View>

      {isActive && <View style={[styles.glowLine, { backgroundColor: accentColor }]} />}

      <View style={styles.topRow}>
        {card.brand === 'visa' ? (
          <Text style={styles.visaText}>VISA</Text>
        ) : card.brand === 'mastercard' ? (
          <View style={styles.mcRow}>
            <View style={[styles.mcCircle, { backgroundColor: '#EB001B' }]} />
            <View style={[styles.mcCircle, { backgroundColor: '#F79E1B', marginLeft: -6 }]} />
          </View>
        ) : (
          <Text style={styles.genericBrand}>{card.brand.toUpperCase()}</Text>
        )}

        <View style={styles.chip}>
          <Ionicons name="hardware-chip-outline" size={20} color="#4a3a12" />
        </View>
      </View>

      <Text style={styles.cardNumber}>•••• {card.lastDigits}</Text>
      <Text style={styles.cardType}>{card.type}</Text>

      <View style={styles.bottomRow}>
        <Text style={styles.holderName} numberOfLines={1}>
          {card.holderName.toUpperCase()}
        </Text>
        <View style={styles.expiryBlock}>
          <Text style={styles.expiryLabel}>Válido até</Text>
          <Text style={styles.expiryDate}>{card.expiryDate}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    height: 190,
    borderRadius: 28,
    backgroundColor: '#0d0d10',
    borderWidth: 1,
    borderColor: '#24242a',
    overflow: 'hidden',
    position: 'relative',
    paddingHorizontal: 22,
    paddingVertical: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  dotGrid: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: -22,
    right: -22,
    justifyContent: 'space-evenly',
    paddingVertical: 16,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  glowLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    zIndex: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  visaText: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  mcRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mcCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  genericBrand: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: '#ffffff',
  },
  chip: {
    width: 40,
    height: 30,
    borderRadius: 6,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNumber: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: 2,
    marginTop: 8,
  },
  cardType: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  holderName: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#e2e2e6',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  expiryBlock: {
    alignItems: 'flex-end',
  },
  expiryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  expiryDate: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});