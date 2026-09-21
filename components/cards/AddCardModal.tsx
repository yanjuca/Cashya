import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '../../contexts/AlertContext';
import { useCards } from '../../contexts/CardsContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { CardBrand, CardType } from '../../types';

interface AddCardModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AddCardModal({ visible, onClose }: AddCardModalProps) {
  const { showAlert } = useAlert();
  const { addCard } = useCards();

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
      colorAccent: cardBrand === 'mastercard' ? '#ff9f0a' : COLORS.primary,
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
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Card</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Cardholder Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., JOHN DOE"
              placeholderTextColor={COLORS.textSecondary}
              value={cardHolder}
              onChangeText={setCardHolder}
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Card Type</Text>
            <View style={styles.pillRow}>
              {(['Credit', 'Debit'] as CardType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pillOption, cardType === t && styles.pillOptionActive]}
                  onPress={() => setCardType(t)}
                >
                  <Text
                    style={[styles.pillOptionText, cardType === t && styles.pillOptionTextActive]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Brand</Text>
            <View style={styles.pillRow}>
              {(['visa', 'mastercard', 'elo', 'generic'] as CardBrand[]).map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.pillOption, cardBrand === b && styles.pillOptionActive]}
                  onPress={() => setCardBrand(b)}
                >
                  <Text
                    style={[styles.pillOptionText, cardBrand === b && styles.pillOptionTextActive]}
                  >
                    {b.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Last 4 digits</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="1234"
                  placeholderTextColor={COLORS.textSecondary}
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
                  placeholderTextColor={COLORS.textSecondary}
                  value={cardExpiry}
                  onChangeText={setCardExpiry}
                  maxLength={5}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Total Limit ($)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., 5000"
              placeholderTextColor={COLORS.textSecondary}
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#16161a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#24242a',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.ndot || FONTS.system,
    color: '#ffffff',
    letterSpacing: 1,
  },
  inputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    fontFamily: FONTS.regular,
    backgroundColor: '#0e0e12',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
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
    backgroundColor: '#0e0e12',
    borderWidth: 1,
    borderColor: '#2a2a32',
  },
  pillOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillOptionText: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  pillOptionTextActive: {
    fontFamily: FONTS.bold,
    color: '#ffffff',
  },
  inputRow: {
    flexDirection: 'row',
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  modalSaveButtonText: {
    fontFamily: FONTS.bold,
    color: '#ffffff',
    fontSize: 15,
  },
});
