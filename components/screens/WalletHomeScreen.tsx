import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Modal,
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
import EditExpenseScreen from './EditExpenseScreen';
import TransactionDetailsModal from './TransactionDetailsModal';
import { useAlert } from '../../contexts/AlertContext';
import { useCards } from '../../contexts/CardsContext';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { formatCurrency } from '../../utils/formatters';

export interface WalletHomeScreenProps {
  onScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
}

export default function WalletHomeScreen({ onScroll, onEditModeChange }: WalletHomeScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const { cards, activeCardIndex, setActiveCardIndex, activeCard } = useCards();
  const { expenses, removeExpenses } = useExpenses();
  const { showAlert } = useAlert();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const editBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(editBarAnim, {
      toValue: isEditMode ? 1 : 0,
      tension: 65,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [isEditMode, editBarAnim]);

  useEffect(() => {
    onEditModeChange?.(isEditMode);
  }, [isEditMode, onEditModeChange]);

  useEffect(() => {
    if (!isEditMode) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsEditMode(false);
      setSelectedExpenseIds(new Set());
      return true;
    });
    return () => backHandler.remove();
  }, [isEditMode]);

  // Month expenses
  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter(
      (e) =>
        e.date.getMonth() === now.getMonth() &&
        e.date.getFullYear() === now.getFullYear()
    );
  }, [expenses]);

  // Expenses for the active card (or all monthly expenses if no cards registered)
  const cardExpenses = useMemo(() => {
    if (!cards || cards.length === 0) return currentMonthExpenses;
    if (!activeCard) return [];
    return currentMonthExpenses.filter((e) => e.cardId === activeCard.id);
  }, [currentMonthExpenses, cards, activeCard]);

  // Sort card expenses by date descending
  const sortedExpenses = useMemo(() => {
    return [...cardExpenses].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [cardExpenses]);

  const hasCard = !!activeCard;
  const cardLimit = activeCard?.limit || 0;
  const totalGasto = cardExpenses.reduce((acc, e) => acc + e.amount, 0);
  const limiteDisponivel = hasCard ? Math.max(0, cardLimit - totalGasto) : 0;
  const pendente = cardExpenses.filter((e) => !e.paid).reduce((acc, e) => acc + e.amount, 0);
  const pago = cardExpenses.filter((e) => e.paid).reduce((acc, e) => acc + e.amount, 0);
  const percentage = hasCard && cardLimit > 0 ? Math.min(100, Math.round((totalGasto / cardLimit) * 100)) : 0;

  const handleExpensePress = (item: Expense) => {
    if (isEditMode) {
      toggleExpenseSelection(item.id);
    } else {
      setSelectedExpense(item);
      setShowDetailsModal(true);
    }
  };

  const handleExpenseLongPress = (item: Expense) => {
    if (!isEditMode) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
      setIsEditMode(true);
      setSelectedExpenseIds(new Set([item.id]));
    } else {
      toggleExpenseSelection(item.id);
    }
  };

  const toggleExpenseSelection = (id: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsEditMode(false);
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

  const handleDeleteSelected = () => {
    const count = selectedExpenseIds.size;
    if (count === 0) return;

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    showAlert({
      title: 'Delete Transactions',
      message: `Are you sure you want to delete ${count} ${
        count === 1 ? 'transaction' : 'transactions'
      }? This action cannot be undone.`,
      type: 'danger',
      icon: 'trash-outline',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idsToDelete = Array.from(selectedExpenseIds);
            await removeExpenses(idsToDelete);
            setIsEditMode(false);
            setSelectedExpenseIds(new Set());
            showAlert({
              title: 'Deleted',
              message: `${count} ${
                count === 1 ? 'transaction' : 'transactions'
              } deleted successfully.`,
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

      {/* Top Batch Selection & Action Bar (slides in during Edit Mode, pushing content down) */}
      <Animated.View
        style={[
          styles.editModeBarWrapper,
          {
            maxHeight: editBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 68],
            }),
            opacity: editBarAnim,
            transform: [
              {
                translateY: editBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={isEditMode ? 'auto' : 'none'}
      >
        <View style={styles.editModeBar}>
          <View style={styles.editModeLeft}>
            <TouchableOpacity
              style={styles.editModeCloseBtn}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                }
                setIsEditMode(false);
                setSelectedExpenseIds(new Set());
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={16} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.editModeCountText}>
              {selectedExpenseIds.size} SELECTED
            </Text>
          </View>

          <View style={styles.editModeRight}>
            <TouchableOpacity
              style={[
                styles.editModeDeleteBtn,
                selectedExpenseIds.size === 0 && styles.editModeDeleteBtnDisabled,
              ]}
              onPress={handleDeleteSelected}
              disabled={selectedExpenseIds.size === 0}
              activeOpacity={0.8}
            >
              <Ionicons
                name="trash-outline"
                size={14}
                color={selectedExpenseIds.size > 0 ? '#ffffff' : '#665555'}
              />
              <Text
                style={[
                  styles.editModeDeleteText,
                  selectedExpenseIds.size === 0 && styles.editModeDeleteTextDisabled,
                ]}
              >
                DELETE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Ambient background glow */}
      <LinearGradient
        colors={['rgba(255, 69, 58, 0.08)', 'rgba(0, 0, 0, 0.95)', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[
          styles.mainScrollContent,
          {
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 10) + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Cards Carousel */}
        {cards && cards.length > 0 && (
          <View style={styles.carouselWrapper}>
            <CardsCarousel
              cards={cards}
              activeIndex={activeCardIndex}
              onIndexChange={setActiveCardIndex}
            />
          </View>
        )}

        {/* Metrics Section */}
        <View style={styles.metricsContainer}>
          {/* Available limit */}
          {hasCard && (
            <MetricCard
              label="Available limit"
              value={formatCurrency(limiteDisponivel)}
              subtitle={`of ${formatCurrency(cardLimit)}`}
              badge={`${percentage}%`}
            />
          )}

          {/* Total spent */}
          <MetricCard
            label="Total spent"
            value={formatCurrency(totalGasto)}
            subtitle={hasCard ? `of ${formatCurrency(cardLimit)}` : 'This month'}
            badge={hasCard ? `${percentage}%` : undefined}
          />

          {/* Split Row: Pending & Paid */}
          <View style={styles.splitRow}>
            <MetricCard
              label="Pending"
              value={formatCurrency(pendente)}
              variant="compact"
            />
            <View style={{ width: 12 }} />
            <MetricCard
              label="Paid"
              value={formatCurrency(pago)}
              variant="compact"
            />
          </View>
        </View>

        {/* Transactions Section */}
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
                <Ionicons name="receipt-outline" size={36} color="#262630" />
                <Text style={styles.emptyText}>No transactions this month</Text>
              </View>
            ) : (
              sortedExpenses.map((item) => {
                const isSelected = selectedExpenseIds.has(item.id);

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.expenseItem,
                      isEditMode && styles.cardEditMode,
                      isSelected && styles.cardSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => handleExpensePress(item)}
                    onLongPress={() => handleExpenseLongPress(item)}
                    delayLongPress={300}
                  >
                    <View style={styles.cardMainRow}>
                      {/* Checkbox (visible in edit mode) */}
                      {isEditMode && (
                        <TouchableOpacity
                          style={[styles.checkbox, isSelected && styles.checkboxActive]}
                          onPress={() => toggleExpenseSelection(item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.8}
                        >
                          {isSelected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                        </TouchableOpacity>
                      )}

                      <View style={styles.cardContent}>
                        <View style={styles.expenseHeaderRow}>
                          <Text style={styles.expenseDescription} numberOfLines={1}>
                            {item.description}
                          </Text>
                          {!isEditMode && (
                            <View
                              style={[
                                styles.statusDot,
                                item.paid ? styles.statusDotPaid : styles.statusDotPending,
                              ]}
                            />
                          )}
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

                      {/* Edit Pencil Button (visible in edit mode) */}
                      {isEditMode && (
                        <TouchableOpacity
                          style={styles.cardEditPencilBtn}
                          onPress={() => handleEditButtonPress(item)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="pencil-sharp" size={15} color="#ffffff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        visible={showDetailsModal}
        expense={selectedExpense}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedExpense(null);
        }}
      />

      {/* Edit Expense Modal */}
      <Modal visible={showEditExpense} animationType="slide" presentationStyle="fullScreen">
        {editingExpense && (
          <EditExpenseScreen
            expense={editingExpense}
            onClose={() => {
              setShowEditExpense(false);
              setEditingExpense(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  carouselWrapper: {
    marginBottom: 16,
  },
  metricsContainer: {
    paddingHorizontal: 22,
    paddingTop: 22,
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
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  transactionsCount: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#666672',
  },
  transactionsList: {
    gap: 8,
  },
  expenseItem: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#24242a',
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
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  statusDotPaid: {
    backgroundColor: COLORS.success,
  },
  statusDotPending: {
    backgroundColor: COLORS.error,
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
    color: COLORS.textSecondary,
  },
  expenseDate: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#666672',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 14,
    color: '#ffffff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  tagText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    color: '#666672',
    fontSize: 12,
  },
  editModeBarWrapper: {
    zIndex: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  editModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16161c',
    marginHorizontal: 22,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#262630',
  },
  editModeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editModeCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#22222a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModeCountText: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 1,
  },
  editModeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editModeDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  editModeDeleteBtnDisabled: {
    backgroundColor: '#26181a',
  },
  editModeDeleteText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  editModeDeleteTextDisabled: {
    color: '#664448',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardEditMode: {
    borderColor: '#2e2e38',
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#1c1214',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    borderColor: '#444452',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  cardEditPencilBtn: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#202028',
    borderWidth: 1,
    borderColor: '#30303c',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
