import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CreditCard } from '../../contexts/CardsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';

interface CreditCardItemProps {
  card: CreditCard;
  isActive?: boolean;
}

export default function CreditCardItem({ card, isActive = true }: CreditCardItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const accentColor = card.colorAccent || colors.primary;

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
          <Text style={styles.expiryDate}>Exp: {card.expiryDate}</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardContainer: {
      height: 68,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      position: 'relative',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
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
      color: colors.text,
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
      fontFamily: FONTS.bold,
      fontSize: 13,
      color: colors.text,
    },
    cardNumber: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 15,
      color: colors.text,
      letterSpacing: 1.5,
    },
    cardType: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    rightColumn: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    holderName: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    expiryDate: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
  });
}
