import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardsCarousel from '../cards/CardsCarousel';
import MetricCard from '../dashboard/MetricCard';
import AddCardModal from '../cards/AddCardModal';
import EditExpenseScreen from './EditExpenseScreen';
import TransactionDetailsModal from './TransactionDetailsModal';
import { CreditCard, useCards } from '../../contexts/CardsContext';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import { formatCurrency } from '../../utils/formatters';

export interface WalletHomeScreenProps {
  onScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  isEditMode?: boolean;
  selectedExpenseIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onStartEditMode?: (id: string) => void;
}

interface TactileExpenseRowProps {
  item: Expense;
  isEditMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onToggleSelect: () => void;
  onEditPress: () => void;
}

const TactileExpenseRow = React.memo(({
  item,
  isEditMode,
  isSelected,
  onPress,
  onLongPress,
  onToggleSelect,
  onEditPress,
}: TactileExpenseRowProps) => {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const editAnim = useRef(new Animated.Value(isEditMode ? 1 : 0)).current;
  const selectAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(editAnim, {
      toValue: isEditMode ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [isEditMode, editAnim]);

  useEffect(() => {
    Animated.timing(selectAnim, {
      toValue: isSelected ? 1 : 0,
      duration: 260,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [isSelected, selectAnim]);

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const animatedBorderColor = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isEditMode ? colors.borderLight : colors.border, colors.primary],
  });

  const animatedBackgroundColor = selectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.cardBackground, isDark ? '#1c1214' : colors.cardBackgroundLight],
  });

  const checkboxWidth = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 34],
  });

  const checkboxOpacity = editAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0, 1],
  });

  const checkboxScale = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const pencilWidth = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 48],
  });

  const pencilOpacity = editAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [0, 0, 1],
  });

  const pencilScale = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const statusDotOpacity = editAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [1, 0, 0],
  });

  const statusDotScale = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Animated.View
        style={[
          styles.expenseItem,
          {
            borderColor: animatedBorderColor,
            backgroundColor: animatedBackgroundColor,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={onLongPress}
          delayLongPress={300}
        >
          <View style={styles.cardMainRow}>
            <Animated.View
              style={{
                width: checkboxWidth,
                opacity: checkboxOpacity,
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'flex-start',
              }}
              pointerEvents={isEditMode ? 'auto' : 'none'}
            >
              <Animated.View style={{ transform: [{ scale: checkboxScale }] }}>
                <TouchableOpacity
                  style={[styles.checkbox, { marginRight: 0 }]}
                  onPress={onToggleSelect}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.8}
                >
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: selectAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['transparent', colors.primary],
                        }),
                        borderColor: selectAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [colors.borderLight, colors.primary],
                        }),
                        borderWidth: 1.5,
                        borderRadius: BORDER_RADIUS.full,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    <Animated.View
                      style={{
                        opacity: selectAnim.interpolate({
                          inputRange: [0, 0.3, 1],
                          outputRange: [0, 0, 1],
                        }),
                        transform: [
                          {
                            scale: selectAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.4, 1],
                            }),
                          },
                        ],
                      }}
                    >
                      <Ionicons name="checkmark" size={13} color={colors.primaryText} />
                    </Animated.View>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>

            <View style={styles.cardContent}>
              <View style={styles.expenseHeaderRow}>
                <Text style={styles.expenseDescription} numberOfLines={1}>
                  {item.description}
                </Text>
                <Animated.View
                  style={[
                    styles.statusDot,
                    item.paid ? styles.statusDotPaid : styles.statusDotPending,
                    {
                      opacity: statusDotOpacity,
                      transform: [{ scale: statusDotScale }],
                    },
                  ]}
                />
              </View>

              <View style={styles.expenseDetailsRow}>
                <View style={styles.expenseSubDetails}>
                  <Text style={styles.expensePerson}>{item.person}</Text>
                  <Text style={styles.expenseDate}>
                    {item.date.toLocaleDateString('en-US', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>

              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {item.tags.map((tag, idx) => (
                    <View key={idx} style={styles.tagBadge}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Animated.View
              style={{
                width: pencilWidth,
                opacity: pencilOpacity,
                overflow: 'hidden',
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
              pointerEvents={isEditMode ? 'auto' : 'none'}
            >
              <Animated.View style={{ transform: [{ scale: pencilScale }] }}>
                <TouchableOpacity
                  style={[styles.cardEditPencilBtn, { marginLeft: 0 }]}
                  onPress={onEditPress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="pencil-sharp" size={15} color={colors.text} />
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

export default function WalletHomeScreen({
  onScroll,
  isEditMode: externalIsEditMode,
  selectedExpenseIds: externalSelectedExpenseIds,
  onToggleSelect: externalOnToggleSelect,
  onStartEditMode: externalOnStartEditMode,
}: WalletHomeScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { cards, activeCardIndex, setActiveCardIndex, activeCard } = useCards();
  const { expenses } = useExpenses();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [localIsEditMode, setLocalIsEditMode] = useState(false);
  const [localSelectedExpenseIds, setLocalSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const isEditMode = externalIsEditMode !== undefined ? externalIsEditMode : localIsEditMode;
  const selectedExpenseIds =
    externalSelectedExpenseIds !== undefined ? externalSelectedExpenseIds : localSelectedExpenseIds;

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter(
      (e) =>
        e.date.getMonth() === now.getMonth() &&
        e.date.getFullYear() === now.getFullYear()
    );
  }, [expenses]);

  const cardExpenses = useMemo(() => {
    if (!cards || cards.length === 0) return currentMonthExpenses;
    if (!activeCard) return [];
    return currentMonthExpenses.filter((e) => e.cardId === activeCard.id);
  }, [currentMonthExpenses, cards, activeCard]);

  const sortedExpenses = useMemo(() => {
    return [...cardExpenses].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [cardExpenses]);

  const hasCard = !!activeCard;
  const cardLimit = activeCard?.limit || 0;
  const totalSpent = cardExpenses.reduce((acc, e) => acc + e.amount, 0);
  const availableLimit = hasCard ? Math.max(0, cardLimit - totalSpent) : 0;
  const pending = cardExpenses.filter((e) => !e.paid).reduce((acc, e) => acc + e.amount, 0);
  const paid = cardExpenses.filter((e) => e.paid).reduce((acc, e) => acc + e.amount, 0);
  const percentage = hasCard && cardLimit > 0 ? Math.min(100, Math.round((totalSpent / cardLimit) * 100)) : 0;

  const handleExpensePress = (item: Expense) => {
    if (isEditMode) {
      if (externalOnToggleSelect) {
        externalOnToggleSelect(item.id);
      } else {
        toggleExpenseSelection(item.id);
      }
    } else {
      setSelectedExpense(item);
      setShowDetailsModal(true);
    }
  };

  const handleExpenseLongPress = (item: Expense) => {
    if (!isEditMode) {
      if (externalOnStartEditMode) {
        externalOnStartEditMode(item.id);
      } else {
        if (Platform.OS !== 'web') {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
        }
        setLocalIsEditMode(true);
        setLocalSelectedExpenseIds(new Set([item.id]));
      }
    } else {
      if (externalOnToggleSelect) {
        externalOnToggleSelect(item.id);
      } else {
        toggleExpenseSelection(item.id);
      }
    }
  };

  const toggleExpenseSelection = (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setLocalSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setLocalIsEditMode(false);
      }
      return next;
    });
  };

  const handleEditButtonPress = (item: Expense) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setEditingExpense(item);
    setShowEditExpense(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.statusBar} />

      <LinearGradient
        colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd, colors.background]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.75, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainScrollContent,
          {
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 10) + 140,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.carouselWrapper}>
          <CardsCarousel
            cards={cards}
            activeIndex={activeCardIndex}
            onIndexChange={setActiveCardIndex}
            onAddCard={() => setShowAddCard(true)}
            onCardPress={(card) => setEditingCard(card)}
          />
        </View>

        <View style={styles.metricsContainer}>
          {hasCard && (
            <MetricCard
              label="Available limit"
              value={formatCurrency(availableLimit)}
              subtitle={`of ${formatCurrency(cardLimit)}`}
              badge={`${percentage}%`}
            />
          )}

          <MetricCard
            label="Total spent"
            value={formatCurrency(totalSpent)}
            subtitle={hasCard ? `of ${formatCurrency(cardLimit)}` : 'This month'}
            badge={hasCard ? `${percentage}%` : undefined}
          />

          <View style={styles.splitRow}>
            <MetricCard
              label="Pending"
              value={formatCurrency(pending)}
              variant="compact"
            />
            <View style={{ width: 12 }} />
            <MetricCard
              label="Paid"
              value={formatCurrency(paid)}
              variant="compact"
            />
          </View>
        </View>

        <View style={styles.transactionsSection}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsTitle}>TRANSACTIONS</Text>
            <Text style={styles.transactionsCount}>
              {sortedExpenses.length} {sortedExpenses.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          <View style={styles.transactionsList}>
            {sortedExpenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="reorder-two-outline" size={32} color="#22222a" />
              </View>
            ) : (
              sortedExpenses.map((item) => (
                <TactileExpenseRow
                  key={item.id}
                  item={item}
                  isEditMode={isEditMode}
                  isSelected={selectedExpenseIds.has(item.id)}
                  onPress={() => handleExpensePress(item)}
                  onLongPress={() => handleExpenseLongPress(item)}
                  onToggleSelect={() => {
                    if (externalOnToggleSelect) {
                      externalOnToggleSelect(item.id);
                    } else {
                      toggleExpenseSelection(item.id);
                    }
                  }}
                  onEditPress={() => handleEditButtonPress(item)}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <AddCardModal visible={showAddCard} onClose={() => setShowAddCard(false)} />

      <AddCardModal
        visible={!!editingCard}
        card={editingCard}
        onClose={() => setEditingCard(null)}
      />

      <TransactionDetailsModal
        visible={showDetailsModal}
        expense={selectedExpense}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedExpense(null);
        }}
        onEdit={(exp) => {
          setEditingExpense(exp);
          setShowEditExpense(true);
        }}
      />

      <EditExpenseScreen
        visible={showEditExpense}
        expense={editingExpense}
        onClose={() => {
          setShowEditExpense(false);
          setEditingExpense(null);
        }}
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mainScroll: {
      flex: 1,
    },
    mainScrollContent: {
      paddingTop: 4,
    },
    titleSection: {
      paddingHorizontal: 22,
      marginBottom: 16,
    },
    title: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 28,
      color: colors.text,
      letterSpacing: 1.5,
    },
    carouselWrapper: {
      marginBottom: 2,
    },
    metricsContainer: {
      paddingHorizontal: 22,
      paddingTop: 10,
    },
    splitRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    transactionsSection: {
      marginTop: 18,
      paddingHorizontal: 22,
    },
    transactionsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    transactionsTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    transactionsCount: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
    },
    transactionsList: {
      gap: 8,
    },
    expenseItem: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: colors.border,
    },
    expenseHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    expenseDescription: {
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      marginRight: 12,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 0.5,
      borderColor: colors.borderLight,
    },
    statusDotPaid: {
      backgroundColor: colors.success,
    },
    statusDotPending: {
      backgroundColor: colors.primary,
    },
    expenseDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    expenseSubDetails: {
      flex: 1,
    },
    expensePerson: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    expenseDate: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    expenseAmount: {
      fontSize: 14,
      color: colors.text,
      fontFamily: FONTS.ndot || FONTS.system,
      letterSpacing: 0.8,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
    },
    tagBadge: {
      backgroundColor: colors.badgeBackground,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.xs,
    },
    tagText: {
      fontFamily: FONTS.regular,
      fontSize: 10,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    cardMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardContent: {
      flex: 1,
    },
    cardEditMode: {
      borderColor: colors.borderLight,
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.cardBackgroundLight,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1.5,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    checkboxActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    cardEditPencilBtn: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
  });
}