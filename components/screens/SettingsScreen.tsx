import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Platform,
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
import { useTheme } from '../../contexts/ThemeContext';
import { BackupService } from '../../services/backup';
import { StorageService } from '../../services/storage';
import { BORDER_RADIUS, FONTS, ThemeColors, ThemeMode } from '../../theme';
import { CreditCard } from '../../types';
import { formatCurrency } from '../../utils/formatters';

import AddCardModal from '../cards/AddCardModal';
import BottomSheetModal from '../ui/BottomSheetModal';

export interface SettingsScreenProps {
  onScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
}

export default function SettingsScreen({ onScroll }: SettingsScreenProps = {}) {
  const { showAlert } = useAlert();
  const { cards, removeCard, reloadCards } = useCards();
  const { reloadExpenses, resetExpenses } = useExpenses();
  const { resetCards } = useCards();
  const { colors, themeMode, accentColor, setThemeMode, setAccentColor, accentList } = useTheme();

  // Modal State for Add Card
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  // Modal State for Restore
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');

  const styles = useMemo(() => createStyles(colors), [colors]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  const handleSelectThemeMode = (mode: ThemeMode) => {
    if (mode === themeMode) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setThemeMode(mode);
  };

  const handleSelectAccentColor = (colorValue: string) => {
    if (colorValue === accentColor) return;
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setAccentColor(colorValue);
  };

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
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* SECTION 1: APPEARANCE & THEME SWITCHER */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APPEARANCE</Text>

          <View style={styles.appearanceCard}>
            {/* Theme Mode Segmented Picker */}
            <Text style={styles.subSectionTitle}>THEME MODE</Text>
            <View style={styles.themeModeRow}>
              <TouchableOpacity
                style={[
                  styles.themeModeBtn,
                  themeMode === 'dark' && styles.themeModeBtnActive,
                ]}
                onPress={() => handleSelectThemeMode('dark')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="moon"
                  size={16}
                  color={themeMode === 'dark' ? colors.primaryText : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeModeBtnText,
                    themeMode === 'dark' && styles.themeModeBtnTextActive,
                  ]}
                >
                  DARK
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.themeModeBtn,
                  themeMode === 'light' && styles.themeModeBtnActive,
                ]}
                onPress={() => handleSelectThemeMode('light')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="sunny"
                  size={16}
                  color={themeMode === 'light' ? colors.primaryText : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeModeBtnText,
                    themeMode === 'light' && styles.themeModeBtnTextActive,
                  ]}
                >
                  LIGHT
                </Text>
              </TouchableOpacity>
            </View>

            {/* Accent Color Palette Picker */}
            <View style={styles.accentDivider} />
            <Text style={styles.subSectionTitle}>ACCENT COLOR</Text>
            <View style={styles.accentColorsGrid}>
              {accentList.map((item) => {
                const isSelected = accentColor.toUpperCase() === item.value.toUpperCase();
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.accentItem}
                    onPress={() => handleSelectAccentColor(item.value)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.accentCircleOuter,
                        isSelected && { borderColor: item.value },
                      ]}
                    >
                      <View
                        style={[
                          styles.accentCircle,
                          { backgroundColor: item.value },
                        ]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={item.contrastText}
                          />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION 2: CARDS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY CARDS</Text>
            <TouchableOpacity
              style={styles.actionBtnSmall}
              onPress={() => setShowAddCardModal(true)}
            >
              <Ionicons name="add" size={16} color={colors.text} />
              <Text style={styles.actionBtnSmallText}>New Card</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardsList}>
            {cards.length === 0 ? (
              <View style={styles.emptyCardsContainer}>
                <Ionicons name="card-outline" size={32} color={colors.textMuted} />
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
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* SECTION 3: BACKUP & OFFLINE-FIRST */}
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
                <Ionicons name="share-outline" size={18} color={colors.primaryText} />
                <Text style={styles.backupBtnPrimaryText}>Export Backup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backupBtnSecondary}
                onPress={() => setShowRestoreModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={18} color={colors.text} />
                <Text style={styles.backupBtnSecondaryText}>Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* RESET DATABASE BUTTON */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleClearAllData}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.dangerButtonText}>Reset Database</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 5: ABOUT */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutTitle}>cashya</Text>
          <Text style={styles.aboutVersion}>Version 0.6</Text>
          <Text style={styles.aboutTagline}>
            offline-first • nothing os aesthetic
          </Text>
        </View>
      </ScrollView>

      {/* MODAL: ADD CARD */}
      <AddCardModal
        visible={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
      />

      {/* MODAL: RESTORE BACKUP */}
      <BottomSheetModal
        visible={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title="Restore Backup"
      >
        <Text style={styles.restoreDesc}>
          Paste below the exported Cashya JSON backup to restore your transactions and cards.
        </Text>

        <TextInput
          style={styles.restoreTextArea}
          placeholder='Paste JSON here: {"version":"1.0.0", "expenses": [...]}'
          placeholderTextColor={colors.textMuted}
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
      </BottomSheetModal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 110,
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
      color: colors.textSecondary,
      letterSpacing: 1,
      marginBottom: 12,
    },
    subSectionTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    appearanceCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeModeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    themeModeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 8,
    },
    themeModeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    themeModeBtnText: {
      fontFamily: FONTS.bold,
      fontSize: 12,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    themeModeBtnTextActive: {
      color: colors.primaryText,
    },
    accentDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    accentColorsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    accentItem: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentCircleOuter: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    accentCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    actionBtnSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackgroundLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 4,
    },
    actionBtnSmallText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.text,
      fontWeight: '600',
    },
    cardsList: {
      gap: 10,
    },
    emptyCardsContainer: {
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: 8,
    },
    emptyCardsText: {
      fontFamily: FONTS.regular,
      color: colors.textSecondary,
      fontSize: 13,
    },
    cardItem: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
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
      backgroundColor: colors.cardBackgroundLight,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: BORDER_RADIUS.xs,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cardBrandText: {
      fontFamily: FONTS.bold,
      fontSize: 10,
      fontWeight: '700',
      color: colors.text,
    },
    cardDigits: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 15,
      color: colors.text,
      letterSpacing: 1,
    },
    cardHolder: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
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
      color: colors.text,
    },
    cardDeleteBtn: {
      padding: 6,
    },
    backupCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backupCardDesc: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
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
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.lg,
      gap: 6,
    },
    backupBtnPrimaryText: {
      fontFamily: FONTS.medium,
      color: colors.primaryText,
      fontWeight: '600',
      fontSize: 13,
    },
    backupBtnSecondary: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.cardBackgroundLight,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 6,
    },
    backupBtnSecondaryText: {
      fontFamily: FONTS.medium,
      color: colors.text,
      fontWeight: '600',
      fontSize: 13,
    },
    dangerButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.cardBackground,
      gap: 8,
    },
    dangerButtonText: {
      fontFamily: FONTS.bold,
      color: colors.error,
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
      color: colors.text,
      letterSpacing: 2,
      marginBottom: 4,
    },
    aboutVersion: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    aboutTagline: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    modalSaveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 20,
    },
    modalSaveButtonText: {
      fontFamily: FONTS.bold,
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 15,
    },
    restoreDesc: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    restoreTextArea: {
      backgroundColor: colors.inputBackground,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      color: colors.text,
      fontSize: 12,
      height: 140,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: FONTS.regular,
    },
  });
}
