import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '../../contexts/AlertContext';
import { useCards } from '../../contexts/CardsContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { BackupService } from '../../services/backup';
import { StorageService } from '../../services/storage';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { CreditCard } from '../../types';
import { formatCurrency } from '../../utils/formatters';

import AddCardModal from '../cards/AddCardModal';

export default function SettingsScreen() {
  const { showAlert } = useAlert();
  const { cards, removeCard, reloadCards, resetCards } = useCards();
  const { expenses, reloadExpenses, resetExpenses } = useExpenses();

  // Modal State for Add Card
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  // Modal State for Restore
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');

  // Handle Remove Card
  const handleRemoveCard = (card: CreditCard) => {
    showAlert({
      title: 'Remove Card',
      message: `Are you sure you want to remove the card ending in ${card.lastDigits} (${card.holderName})?`,
      type: 'danger',
      icon: 'trash-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeCard(card.id);
          },
        },
      ],
    });
  };

  // Handle Export Backup
  const handleExportBackup = async () => {
    const success = await BackupService.shareBackup();
    if (success) {
      showAlert({
        title: 'Backup Exported',
        message: 'Your backup file has been generated and shared successfully!',
        type: 'success',
      });
    }
  };

  // Handle Restore Backup
  const handleRestoreBackup = async () => {
    if (!restoreJsonInput.trim()) {
      showAlert({
        title: 'Warning',
        message: 'Please paste the backup JSON content to restore.',
        type: 'warning',
      });
      return;
    }

    const result = await BackupService.restoreFromJson(restoreJsonInput.trim());
    if (result.success) {
      await reloadExpenses();
      await reloadCards();
      setShowRestoreModal(false);
      setRestoreJsonInput('');
      showAlert({
        title: 'Restore Complete',
        message: `Successfully restored ${result.count?.expenses || 0} expenses and ${result.count?.cards || 0} cards.`,
        type: 'success',
      });
    } else {
      showAlert({
        title: 'Restore Error',
        message: result.message,
        type: 'danger',
      });
    }
  };

  // Handle Clear All Data
  const handleClearAllData = () => {
    showAlert({
      title: 'Reset All Data',
      message: 'WARNING: All expenses and cards will be permanently deleted. Do you wish to continue?',
      type: 'danger',
      icon: 'trash-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearAllData();
            await resetExpenses([]);
            await resetCards([]);
            showAlert({
              title: 'Complete',
              message: 'The database has been reset.',
              type: 'success',
            });
          },
        },
      ],
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

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
            {cards.length === 0 ? (
              <View style={styles.emptyCardsContainer}>
                <Ionicons name="card-outline" size={32} color="#444" />
                <Text style={styles.emptyCardsText}>No cards registered yet</Text>
              </View>
            ) : (
              cards.map((card) => (
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
                    <TouchableOpacity
                      onPress={() => handleRemoveCard(card)}
                      style={styles.cardDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff5252" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
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
      <AddCardModal
        visible={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
      />

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
    </View>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: 1.5,
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
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
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
  emptyCardsContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#24242a',
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyCardsText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  cardItem: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
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
    borderRadius: BORDER_RADIUS.xs,
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
    borderRadius: BORDER_RADIUS.lg,
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
    borderRadius: BORDER_RADIUS.lg,
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
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: 1,
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
