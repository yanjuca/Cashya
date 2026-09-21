import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_CARDS, useCards } from '../../contexts/CardsContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { BackupService } from '../../services/backup';
import { StorageService } from '../../services/storage';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { CardBrand, CardType, CreditCard } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export default function SettingsScreen() {
  const { cards, addCard, removeCard, reloadCards, resetCards } = useCards();
  const { expenses, reloadExpenses, resetExpenses } = useExpenses();

  // Modal State for Add Card
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [cardHolder, setCardHolder] = useState('');
  const [cardType, setCardType] = useState<CardType>('Credit');
  const [cardBrand, setCardBrand] = useState<CardBrand>('visa');
  const [cardLastDigits, setCardLastDigits] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardLimit, setCardLimit] = useState('');

  // Modal State for Restore
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');

  // Handle Add Card
  const handleCreateCard = async () => {
    if (!cardHolder.trim()) {
      Alert.alert('Warning', 'Please enter the cardholder name.');
      return;
    }
    if (cardLastDigits.trim().length !== 4) {
      Alert.alert('Warning', 'Please enter the last 4 digits of the card.');
      return;
    }
    const limitNum = parseFloat(cardLimit);
    if (isNaN(limitNum) || limitNum <= 0) {
      Alert.alert('Warning', 'Please enter a valid limit greater than zero.');
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

    // Reset Form
    setCardHolder('');
    setCardLastDigits('');
    setCardExpiry('');
    setCardLimit('');
    setShowAddCardModal(false);
    Alert.alert('Success', 'New card added successfully!');
  };

  // Handle Remove Card
  const handleRemoveCard = (card: CreditCard) => {
    if (cards.length <= 1) {
      Alert.alert('Notice', 'You must keep at least one card registered.');
      return;
    }

    Alert.alert(
      'Remove Card',
      `Are you sure you want to remove the card ending in ${card.lastDigits} (${card.holderName})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeCard(card.id);
          },
        },
      ]
    );
  };

  // Handle Export Backup
  const handleExportBackup = async () => {
    const success = await BackupService.shareBackup();
    if (success) {
      Alert.alert('Backup Exported', 'Your backup file has been generated and shared successfully!');
    }
  };

  // Handle Restore Backup
  const handleRestoreBackup = async () => {
    if (!restoreJsonInput.trim()) {
      Alert.alert('Warning', 'Please paste the backup JSON content to restore.');
      return;
    }

    const result = await BackupService.restoreFromJson(restoreJsonInput.trim());
    if (result.success) {
      await reloadExpenses();
      await reloadCards();
      setShowRestoreModal(false);
      setRestoreJsonInput('');
      Alert.alert(
        'Restore Complete',
        `Successfully restored ${result.count?.expenses || 0} expenses and ${result.count?.cards || 0} cards.`
      );
    } else {
      Alert.alert('Restore Error', result.message);
    }
  };

  // Handle Clear All Data
  const handleClearAllData = () => {
    Alert.alert(
      'Reset All Data',
      'WARNING: All expenses and cards will be permanently deleted. Do you wish to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearAllData();
            await resetExpenses([]);
            await resetCards(DEFAULT_CARDS);
            Alert.alert('Complete', 'The database has been reset to its initial state.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>settings</Text>
          <Text style={styles.headerSubtitle}>backup, cards and preferences</Text>
        </View>

        {/* SECTION 1: CARDS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY CARDS</Text>
            <TouchableOpacity
              style={styles.actionBtnSmall}
              onPress={() => setShowAddCardModal(true)}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.actionBtnSmallText}>New Card</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardsList}>
            {cards.map((card) => (
              <View key={card.id} style={styles.cardItem}>
                <View style={styles.cardInfoLeft}>
                  <View style={styles.cardBrandBadge}>
                    <Text style={styles.cardBrandText}>{card.brand.toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardDigits}>•••• {card.lastDigits}</Text>
                    <Text style={styles.cardHolder}>
                      {card.holderName} • {card.type}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardInfoRight}>
                  <Text style={styles.cardLimit}>{formatCurrency(card.limit)}</Text>
                  {cards.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveCard(card)}
                      style={styles.cardDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff5252" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* SECTION 2: BACKUP & OFFLINE-FIRST */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BACKUP & RESTORE (OFFLINE-FIRST)</Text>

          <View style={styles.backupCard}>
            <Text style={styles.backupCardDesc}>
              Your data never leaves your device without your action. Periodically export a backup copy
              to WhatsApp, Google Drive, or Files.
            </Text>

            <View style={styles.backupBtnRow}>
              <TouchableOpacity
                style={styles.backupBtnPrimary}
                onPress={handleExportBackup}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={18} color="#ffffff" />
                <Text style={styles.backupBtnPrimaryText}>Export Backup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backupBtnSecondary}
                onPress={() => setShowRestoreModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={18} color="#ffffff" />
                <Text style={styles.backupBtnSecondaryText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SECTION 3: STORAGE STATS & DANGER ZONE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATA & STORAGE</Text>

          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total Expenses Recorded</Text>
              <Text style={styles.statValue}>{expenses.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Registered Cards</Text>
              <Text style={styles.statValue}>{cards.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Operation Mode</Text>
              <Text style={[styles.statValue, { color: COLORS.success }]}>100% Offline</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleClearAllData}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#ff453a" />
            <Text style={styles.dangerButtonText}>Reset Database</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 4: ABOUT */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>cashya</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0 (Offline-First Edition)</Text>
          <Text style={styles.aboutTagline}>
            Minimalism & Nothing OS aesthetic for noise-free financial tracking.
          </Text>
        </View>
      </ScrollView>

      {/* MODAL: ADD CARD */}
      <Modal visible={showAddCardModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Card</Text>
              <TouchableOpacity onPress={() => setShowAddCardModal(false)}>
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
                activeOpacity={0.85}
              >
                <Text style={styles.modalSaveButtonText}>Save Card</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: RESTORE BACKUP */}
      <Modal visible={showRestoreModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Restore Backup</Text>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.restoreDesc}>
              Paste below the exported Cashya JSON backup to restore your transactions and cards.
            </Text>

            <TextInput
              style={styles.restoreTextArea}
              placeholder='Paste JSON here: {"version":"1.0.0", "expenses": [...]}'
              placeholderTextColor={COLORS.textSecondary}
              value={restoreJsonInput}
              onChangeText={setRestoreJsonInput}
              multiline
              numberOfLines={8}
            />

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleRestoreBackup}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveButtonText}>Validate & Restore</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    paddingTop: 10,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 10,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f26',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: '#2e2e38',
    gap: 4,
  },
  actionBtnSmallText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },
  cardsList: {
    gap: 10,
  },
  cardItem: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: '#24242a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardBrandBadge: {
    backgroundColor: '#202028',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  cardBrandText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardDigits: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 1,
  },
  cardHolder: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardLimit: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 14,
    color: '#ffffff',
  },
  cardDeleteBtn: {
    padding: 6,
  },
  backupCard: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  backupCardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  backupBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backupBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
    gap: 6,
  },
  backupBtnPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  backupBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#202028',
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#30303a',
    gap: 6,
  },
  backupBtnSecondaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  statsCard: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: '#24242a',
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statValue: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 15,
    color: '#ffffff',
  },
  statDivider: {
    height: 1,
    backgroundColor: '#22222a',
    marginVertical: 4,
  },
  dangerButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#3a1a1c',
    backgroundColor: '#1f1012',
    gap: 8,
  },
  dangerButtonText: {
    color: '#ff453a',
    fontSize: 13,
    fontWeight: '600',
  },
  aboutSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  aboutTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  aboutVersion: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  aboutTagline: {
    fontSize: 11,
    color: '#555560',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#141418',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#2a2a34',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: '#1a1a20',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#262630',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  pillOption: {
    flex: 1,
    backgroundColor: '#1a1a20',
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262630',
  },
  pillOptionActive: {
    backgroundColor: '#2c181a',
    borderColor: COLORS.primary,
  },
  pillOptionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  pillOptionTextActive: {
    color: '#ffffff',
  },
  inputRow: {
    flexDirection: 'row',
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  restoreDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  restoreTextArea: {
    backgroundColor: '#1a1a20',
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    color: '#ffffff',
    fontSize: 12,
    height: 140,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#262630',
    fontFamily: FONTS.system,
  },
});
