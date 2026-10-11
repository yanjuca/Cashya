import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '../../contexts/AlertContext';
import { useCards } from '../../contexts/CardsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import { CardBrand, CardType } from '../../types';
import BottomSheetModal from '../ui/BottomSheetModal';

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddCardModal({ visible, onClose }: AddCardModalProps) {
  const { showAlert } = useAlert();
  const { addCard } = useCards();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cardHolder, setCardHolder] = useState('');
  const [cardType, setCardType] = useState<CardType>('Credit');
  const [cardBrand, setCardBrand] = useState<CardBrand>('visa');
  const [cardLastDigits, setCardLastDigits] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardLimit, setCardLimit] = useState('');

  const resetForm = () => {
    setCardHolder('');
    setCardLastDigits('');
    setCardExpiry('');
    setCardLimit('');
    setCardType('Credit');
    setCardBrand('visa');
  };

  const handleCreateCard = async () => {
    if (!cardHolder.trim()) {
      showAlert({
        title: 'Warning',
        message: 'Please enter the cardholder name.',
        type: 'warning',
      });
      return;
    }
    if (cardLastDigits.trim().length !== 4) {
      showAlert({
        title: 'Warning',
        message: 'Please enter the last 4 digits of the card.',
        type: 'warning',
      });
      return;
    }
    const limitNum = parseFloat(cardLimit);
    if (isNaN(limitNum) || limitNum <= 0) {
      showAlert({
        title: 'Warning',
        message: 'Please enter a valid limit greater than zero.',
        type: 'warning',
      });
      return;
    }

    await addCard({
      holderName: cardHolder.trim().toUpperCase(),
      brand: cardBrand,
      type: cardType,
      lastDigits: cardLastDigits.trim(),
      expiryDate: cardExpiry.trim() || '12/29',
      limit: limitNum,
      colorAccent: cardBrand === 'mastercard' ? '#ff9f0a' : colors.primary,
    });

    resetForm();
    onClose();
    showAlert({
      title: 'Success',
      message: 'Card added successfully!',
      type: 'success',
    });
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="New Card"
    >
      <Text style={styles.inputLabel}>Cardholder Name</Text>
      <TextInput
        style={styles.modalInput}
        placeholder="e.g., JOHN DOE"
        placeholderTextColor={colors.textMuted}
        value={cardHolder}
        onChangeText={setCardHolder}
        autoCapitalize="characters"
      />

      <Text style={styles.inputLabel}>Card Type</Text>
      <View style={styles.pillRow}>
        {(['Credit', 'Debit'] as CardType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.pillOption,
              cardType === t && styles.pillOptionActive,
            ]}
            onPress={() => setCardType(t)}
          >
            <Text
              style={[
                styles.pillOptionText,
                cardType === t && styles.pillOptionTextActive,
              ]}
            >
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Card Network</Text>
      <View style={styles.pillRow}>
        {(['visa', 'mastercard', 'amex'] as CardBrand[]).map((b) => (
          <TouchableOpacity
            key={b}
            style={[
              styles.pillOption,
              cardBrand === b && styles.pillOptionActive,
            ]}
            onPress={() => setCardBrand(b)}
          >
            <Text
              style={[
                styles.pillOptionText,
                cardBrand === b && styles.pillOptionTextActive,
              ]}
            >
              {b.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.inputLabel}>Last 4 Digits</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="1234"
            placeholderTextColor={colors.textMuted}
            value={cardLastDigits}
            onChangeText={setCardLastDigits}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.inputLabel}>Expiry (MM/YY)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="12/29"
            placeholderTextColor={colors.textMuted}
            value={cardExpiry}
            onChangeText={setCardExpiry}
            maxLength={5}
          />
        </View>
      </View>

      <Text style={styles.inputLabel}>Monthly Limit (USD)</Text>
      <TextInput
        style={styles.modalInput}
        placeholder="5000"
        placeholderTextColor={colors.textMuted}
        value={cardLimit}
        onChangeText={setCardLimit}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={styles.modalSaveButton}
        onPress={handleCreateCard}
        activeOpacity={0.8}
      >
        <Text style={styles.modalSaveButtonText}>Save Card</Text>
      </TouchableOpacity>
    </BottomSheetModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    inputLabel: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    modalInput: {
      fontFamily: FONTS.regular,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    pillRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    pillOption: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    pillOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillOptionText: {
      fontFamily: FONTS.medium,
      color: colors.textSecondary,
      fontSize: 12,
    },
    pillOptionTextActive: {
      fontFamily: FONTS.bold,
      color: colors.primaryText,
    },
    inputRow: {
      flexDirection: 'row',
    },
    modalSaveButton: {
      backgroundColor: colors.primary,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 10,
    },
    modalSaveButtonText: {
      fontFamily: FONTS.bold,
      color: colors.primaryText,
      fontSize: 15,
    },
  });
}
