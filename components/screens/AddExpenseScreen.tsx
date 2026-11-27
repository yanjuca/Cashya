import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '../../contexts/AlertContext';
import { useCards } from '../../contexts/CardsContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import BottomSheetModal from '../ui/BottomSheetModal';
import RecurringToggle from '../ui/RecurringToggle';
import Text from '../ui/AppText';
import TextInput from '../ui/AppTextInput';
import { useLanguage } from '../../contexts/LanguageContext';

interface AddExpenseScreenProps {
  visible?: boolean;
  onClose: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
export const MIN_ALLOWED_DATE = new Date(CURRENT_YEAR - 5, 0, 1);
export const MAX_ALLOWED_DATE = new Date(CURRENT_YEAR + 5, 11, 31, 23, 59, 59);

export default function AddExpenseScreen({ visible = true, onClose }: AddExpenseScreenProps) {
  const { locale } = useLanguage();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const { addExpense } = useExpenses();
  const { cards, activeCard } = useCards();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [person, setPerson] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(activeCard?.id);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedCardId(activeCard?.id);
    }
  }, [visible, activeCard?.id]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setPerson('');
    setSelectedCardId(activeCard?.id);
    setDate(new Date());
    setTagInput('');
    setTags([]);
    setRecurring(false);
    setRecurringMonths('');
  };

  const handleSave = async () => {
    if (!description.trim()) {
      showAlert({
        title: 'Warning',
        message: 'Please enter a description.',
        type: 'warning',
      });
      return;
    }
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) {
      showAlert({
        title: 'Warning',
        message: 'Please enter a valid amount.',
        type: 'warning',
      });
      return;
    }
    if (!person.trim()) {
      showAlert({
        title: 'Warning',
        message: 'Please enter who should pay / responsible.',
        type: 'warning',
      });
      return;
    }

    if (date < MIN_ALLOWED_DATE || date > MAX_ALLOWED_DATE) {
      showAlert({
        title: 'Invalid Date',
        message: `Please select a date between ${MIN_ALLOWED_DATE.getFullYear()} and ${MAX_ALLOWED_DATE.getFullYear()}.`,
        type: 'warning',
      });
      return;
    }

    try {
      await addExpense({
        description: description.trim(),
        amount: parsedAmount,
        person: person.trim(),
        date: date,
        tags: tags,
        paid: false,
        recurring: recurring,
        recurringMonths: recurring && recurringMonths ? parseInt(recurringMonths, 10) : undefined,
        cardId: selectedCardId,
        source: 'manual',
      });

      resetForm();
      onClose();
      showAlert({
        title: 'Success',
        message: 'Expense recorded successfully!',
        type: 'success',
      });
    } catch {
      showAlert({
        title: 'Error',
        message: 'Unable to save expense.',
        type: 'danger',
      });
    }
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="New Expense"
    >
      <Text style={styles.inputLabel}>Description</Text>
      <TextInput
        style={styles.modalInput}
        placeholder="e.g., Dinner, Grocery store..."
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        autoCapitalize="sentences"
      />

      <Text style={styles.inputLabel}>Amount ($)</Text>
      <TextInput
        style={[styles.modalInput, styles.amountInput]}
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <Text style={styles.inputLabel}>Responsible / Who Pays</Text>
      <TextInput
        style={styles.modalInput}
        placeholder="e.g., You, John, Split..."
        placeholderTextColor={colors.textMuted}
        value={person}
        onChangeText={setPerson}
        autoCapitalize="words"
      />

      {cards.length > 0 && (
        <>
          <Text style={styles.inputLabel}>Payment Method</Text>
          <View style={styles.pillRow}>
            <TouchableOpacity
              style={[
                styles.pillOption,
                selectedCardId === undefined && styles.pillOptionActive,
              ]}
              onPress={() => setSelectedCardId(undefined)}
            >
              <Text
                style={[
                  styles.pillOptionText,
                  selectedCardId === undefined && styles.pillOptionTextActive,
                ]}
              >
                Cash / Other
              </Text>
            </TouchableOpacity>

            {cards.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.pillOption,
                  selectedCardId === c.id && styles.pillOptionActive,
                ]}
                onPress={() => setSelectedCardId(c.id)}
              >
                <Text
                  style={[
                    styles.pillOptionText,
                    selectedCardId === c.id && styles.pillOptionTextActive,
                  ]}
                >
                  {c.brand.toUpperCase()} •• {c.lastDigits}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.inputLabel}>Date</Text>
      <TouchableOpacity
        style={styles.modalInputRow}
        onPress={() => setShowDatePicker(true)}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.dateText}>
          {date.toLocaleDateString(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          themeVariant={isDark ? 'dark' : 'light'}
          minimumDate={MIN_ALLOWED_DATE}
          maximumDate={MAX_ALLOWED_DATE}
        />
      )}

      <Text style={styles.inputLabel}>Tags</Text>
      <View style={styles.tagInputWrapper}>
        <TextInput
          style={styles.tagInput}
          placeholder="Add tag (e.g., Food, Travel)..."
          placeholderTextColor={colors.textMuted}
          value={tagInput}
          onChangeText={setTagInput}
          onSubmitEditing={handleAddTag}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.tagAddBtn} onPress={handleAddTag}>
          <Ionicons name="add" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {tags.length > 0 && (
        <View style={styles.tagsDisplayRow}>
          {tags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.tagChip}
              onPress={() => handleRemoveTag(tag)}
            >
              <Text style={styles.tagChipText}>#{tag}</Text>
              <Ionicons name="close-circle" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <RecurringToggle
        value={recurring}
        onChange={setRecurring}
        months={recurringMonths}
        onMonthsChange={setRecurringMonths}
      />

      <TouchableOpacity
        style={styles.modalSaveButton}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <Text style={styles.modalSaveButtonText}>Save Expense</Text>
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
    amountInput: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 20,
      letterSpacing: 1,
      color: colors.text,
    },
    modalInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dateText: {
      fontFamily: FONTS.regular,
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
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
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
    tagInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingRight: 8,
    },
    tagInput: {
      flex: 1,
      fontFamily: FONTS.regular,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 14,
    },
    tagAddBtn: {
      width: 32,
      height: 32,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.cardBackgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagsDisplayRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    tagChipText: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.text,
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