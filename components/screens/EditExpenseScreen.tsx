import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Dimensions,
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
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { Expense } from '../../types';

const { height } = Dimensions.get('window');

interface EditExpenseScreenProps {
  expense: Expense;
  onClose: () => void;
}

export default function EditExpenseScreen({ expense, onClose }: EditExpenseScreenProps) {
  const { showAlert } = useAlert();
  const { editExpense, removeExpense } = useExpenses();
  const { cards } = useCards();

  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [person, setPerson] = useState(expense.person);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(expense.cardId);
  const [date, setDate] = useState(new Date(expense.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(expense.tags);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
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

    try {
      await editExpense(expense.id, {
        description: description.trim(),
        amount: parsedAmount,
        person: person.trim(),
        date: date,
        tags: tags,
        cardId: selectedCardId,
      });

      showAlert({
        title: 'Success',
        message: 'Expense updated successfully!',
        type: 'success',
        buttons: [{ text: 'OK', onPress: onClose }],
      });
    } catch {
      showAlert({
        title: 'Error',
        message: 'Unable to update expense.',
        type: 'danger',
      });
    }
  };

  const handleDelete = () => {
    showAlert({
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense permanently?',
      type: 'danger',
      icon: 'trash-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeExpense(expense.id);
            showAlert({
              title: 'Deleted',
              message: 'Expense removed successfully.',
              type: 'success',
              buttons: [{ text: 'OK', onPress: onClose }],
            });
          },
        },
      ],
    });
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundGradientStart} />

      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={styles.gradient}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Expense</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Dinner, Grocery store..."
            placeholderTextColor={COLORS.textSecondary}
            value={description}
            onChangeText={setDescription}
            autoCapitalize="sentences"
          />
        </View>

        {/* Amount Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Card Selector */}
        {cards.length > 0 && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Card / Account</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.cardSelectorPill,
                  !selectedCardId && styles.cardSelectorPillActive,
                ]}
                onPress={() => setSelectedCardId(undefined)}
              >
                <Ionicons
                  name="cash-outline"
                  size={14}
                  color={!selectedCardId ? '#ffffff' : COLORS.textSecondary}
                />
                <Text
                  style={[
                    styles.cardSelectorText,
                    !selectedCardId && styles.cardSelectorTextActive,
                  ]}
                >
                  General / Cash
                </Text>
              </TouchableOpacity>

              {cards.map((c) => {
                const isSelected = selectedCardId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.cardSelectorPill,
                      isSelected && styles.cardSelectorPillActive,
                    ]}
                    onPress={() => setSelectedCardId(c.id)}
                  >
                    <Ionicons
                      name="card-outline"
                      size={14}
                      color={isSelected ? '#ffffff' : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.cardSelectorText,
                        isSelected && styles.cardSelectorTextActive,
                      ]}
                    >
                      {c.holderName} (•••• {c.lastDigits})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Person Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Who should pay / Responsible</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., John, Mary, House..."
            placeholderTextColor={COLORS.textSecondary}
            value={person}
            onChangeText={setPerson}
            autoCapitalize="words"
          />
        </View>

        {/* Date Picker */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <MaterialIcons name="calendar-today" size={20} color={COLORS.textSecondary} />
            <Text style={styles.dateText}>
              {date.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
          />
        )}

        {/* Tags Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tags (optional)</Text>
          <View style={styles.tagInputContainer}>
            <TextInput
              style={styles.tagInput}
              placeholder="Add tag..."
              placeholderTextColor={COLORS.textSecondary}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addTagButton} onPress={handleAddTag}>
              <MaterialIcons name="add" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Tags Display */}
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.tag}
                  onPress={() => handleRemoveTag(tag)}
                >
                  <Text style={styles.tagText}>{tag}</Text>
                  <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Hints */}
        <View style={styles.hintsContainer}>
          <Text style={styles.hintText}>Tap a tag to remove it</Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: height,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 5,
  },
  deleteButton: {
    padding: 5,
  },
  headerTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 18,
    color: COLORS.text,
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    fontFamily: FONTS.regular,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
  },
  currencySymbol: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 20,
    color: COLORS.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 18,
    fontFamily: FONTS.ndot || FONTS.system,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    gap: 10,
  },
  dateText: {
    fontFamily: FONTS.regular,
    color: COLORS.text,
    fontSize: 15,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingRight: 8,
  },
  tagInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
  },
  addTagButton: {
    padding: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackgroundLight,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  tagText: {
    fontFamily: FONTS.medium,
    color: COLORS.text,
    fontSize: 13,
  },
  hintsContainer: {
    marginTop: 10,
  },
  cardSelectorRow: {
    gap: 8,
    paddingVertical: 2,
  },
  cardSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardSelectorPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cardSelectorText: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  cardSelectorTextActive: {
    fontFamily: FONTS.bold,
    color: '#ffffff',
  },
  hintText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontSize: 16,
    letterSpacing: 0.5,
  },
});