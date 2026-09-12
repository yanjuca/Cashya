import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';

interface CreditCardItemProps {
  card: CreditCard;
  isActive?: boolean;
}

export default function CreditCardItem({ card, isActive = true }: CreditCardItemProps) {
  const accentColor = card.colorAccent || COLORS.primary;

  return (
    <View style={styles.cardContainer}>
      {/* Left glowing accent line */}
      {isActive && <View style={[styles.glowLine, { backgroundColor: accentColor }]} />}

      <View style={styles.cardInner}>
        {/* Left Side: Brand, Digits & Type */}
        <View style={styles.leftColumn}>
          <View style={styles.brandNumberRow}>
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
            <Text style={styles.cardNumber}>•••• {card.lastDigits}</Text>
          </View>

          <Text style={styles.cardType}>{card.type}</Text>
        </View>

        {/* Right Side: Holder & Expiration */}
        <View style={styles.rightColumn}>
          <Text style={styles.holderName} numberOfLines={1}>
            {card.holderName.toUpperCase()}
          </Text>
          <Text style={styles.expiryDate}>Val: {card.expiryDate}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    height: 68,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#16161a',
    borderWidth: 1,
    borderColor: '#24242a',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  glowLine: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3.5,
    borderRadius: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    zIndex: 2,
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  leftColumn: {
    justifyContent: 'center',
  },
  brandNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  visaText: {
    fontSize: 16,
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
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  genericBrand: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardNumber: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  cardType: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  holderName: {
    fontSize: 11,
    color: '#b0b0b8',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  expiryDate: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
});
