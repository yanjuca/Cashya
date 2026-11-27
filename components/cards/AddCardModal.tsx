import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '../../contexts/AlertContext';
import { useCards } from '../../contexts/CardsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import { CardBrand, CardType, CreditCard } from '../../types';
import BottomSheetModal from '../ui/BottomSheetModal';
import Text from '../ui/AppText';
import TextInput from '../ui/AppTextInput';

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
  card?: CreditCard | null;
}

export default function AddCardModal({ visible, onClose, card }: AddCardModalProps) {
  const { showAlert } = useAlert();
  const { addCard, updateCard } = useCards();
  const isEditing = !!card;
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

  useEffect(() => {
    if (!visible) return;
    if (card) {
      setCardHolder(card.holderName);
      setCardType(card.type);
      setCardBrand(card.brand);
      setCardLastDigits(card.lastDigits);
      setCardExpiry(card.expiryDate);
      setCardLimit(String(card.limit));
    } else {
      resetForm();
    }
  }, [visible, card]);

  const handleLastDigitsChange = (text: string) => {
    setCardLastDigits(text.replace(/\D/g, '').slice(0, 4));
  };

  const handleExpiryChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    const isDeleting = text.length < cardExpiry.length;

    if (digits.length === 1 && Number(digits) > 1 && !isDeleting) {
      setCardExpiry(`0${digits}/`);
      return;
    }
    if (digits.length > 2) {
      setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
      return;
    }
    if (digits.length === 2 && !isDeleting) {
      setCardExpiry(`${digits}/`);
      return;
    }
    setCardExpiry(digits);
  };

  const isExpiryValid = (value: string) => {
    if (!/^\d{2}\/\d{2}$/.test(value)) return false;
    const month = Number(value.slice(0, 2));
    return month >= 1 && month <= 12;
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
    if (cardExpiry.trim() && !isExpiryValid(cardExpiry.trim())) {
      showAlert({
        title: 'Warning',
        message: 'Please enter a valid expiry date (MM/YY).',
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

    if (card) {
      await updateCard(card.id, {
        holderName: cardHolder.trim().toUpperCase(),
        brand: cardBrand,
        type: cardType,
        lastDigits: cardLastDigits.trim(),
        expiryDate: cardExpiry.trim() || '12/29',
        limit: limitNum,
      });

      onClose();
      showAlert({
        title: 'Success',
        message: 'Card updated successfully!',
        type: 'success',
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
      title={isEditing ? 'Edit Card' : 'New Card'}
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
            onChangeText={handleLastDigitsChange}
            keyboardType="number-pad"
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
            onChangeText={handleExpiryChange}
            keyboardType="number-pad"
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
        <Text style={styles.modalSaveButtonText}>{isEditing ? 'Save Changes' : 'Save Card'}</Text>
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