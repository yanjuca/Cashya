import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  Modal,
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
import FAB from '../ui/FAB';
import AddExpenseScreen from './AddExpenseScreen';
import EditExpenseScreen from './EditExpenseScreen';
import { useCards } from '../../contexts/CardsContext';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { formatCurrency } from '../../utils/formatters';

export default function WalletHomeScreen() {
  const insets = useSafeAreaInsets();
  const { cards, activeCardIndex, setActiveCardIndex, activeCard } = useCards();
  const { expenses, togglePaid } = useExpenses();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Month expenses
  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter(
      (e) =>
        e.date.getMonth() === now.getMonth() &&
        e.date.getFullYear() === now.getFullYear()
    );
  }, [expenses]);

  // Expenses for the active card (or fallback to all expenses if no card assigned)
  const cardExpenses = useMemo(() => {
    if (!activeCard) return currentMonthExpenses;
    const assigned = currentMonthExpenses.filter((e) => e.cardId === activeCard.id);
    if (assigned.length > 0) return assigned;
    // If active card is index 0 and no expenses have cardId, treat unassigned as activeCard expenses
    const unassigned = currentMonthExpenses.filter((e) => !e.cardId);
    return activeCardIndex === 0 ? unassigned : [];
  }, [currentMonthExpenses, activeCard, activeCardIndex]);

  // Sort card expenses by date descending
  const sortedExpenses = useMemo(() => {
    return [...cardExpenses].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [cardExpenses]);

  const cardLimit = activeCard?.limit || 3000;
  const totalGasto = cardExpenses.reduce((acc, e) => acc + e.amount, 0);
  const limiteDisponivel = Math.max(0, cardLimit - totalGasto);
  const pendente = cardExpenses.filter((e) => !e.paid).reduce((acc, e) => acc + e.amount, 0);
  const pago = cardExpenses.filter((e) => e.paid).reduce((acc, e) => acc + e.amount, 0);
  const percentage = cardLimit > 0 ? Math.min(100, Math.round((totalGasto / cardLimit) * 100)) : 0;

  const handleExpensePress = (item: Expense) => {
    setSelectedExpense(item);
    setShowEditExpense(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Ambient background glow */}
      <LinearGradient
        colors={['rgba(255, 69, 58, 0.08)', 'rgba(0, 0, 0, 0.95)', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.mainContent,
          {
            paddingTop: Math.max(insets.top, 20) + 8,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>cash</Text>
          <Text style={styles.subtitle}>Your cards and accounts in one place.</Text>
        </View>

        {/* Cards Carousel */}
        <View style={styles.carouselWrapper}>
          <CardsCarousel
            cards={cards}
            activeIndex={activeCardIndex}
            onIndexChange={setActiveCardIndex}
          />
        </View>

        {/* Metrics Section */}
        <View style={styles.metricsContainer}>
          {/* Available limit */}
          <MetricCard
            label="Available limit"
            value={formatCurrency(limiteDisponivel)}
            subtitle={`of ${formatCurrency(cardLimit)}`}
            badge={`${percentage}%`}
          />

          {/* Total spent */}
          <MetricCard
            label="Total spent"
            value={formatCurrency(totalGasto)}
            subtitle={`of ${formatCurrency(cardLimit)}`}
            badge={`${percentage}%`}
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

          <View style={styles.transactionsListContainer}>
            <ScrollView
              style={styles.transactionsScrollView}
              contentContainerStyle={styles.transactionsScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {sortedExpenses.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={32} color="#303038" />
                  <Text style={styles.emptyText}>No transactions on this card</Text>
                </View>
              ) : (
                sortedExpenses.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.expenseItem}
                    activeOpacity={0.7}
                    onPress={() => handleExpensePress(item)}
                    onLongPress={() => togglePaid(item.id)}
                  >
                    <View style={styles.expenseHeaderRow}>
                      <Text style={styles.expenseDescription} numberOfLines={1}>
                        {item.description}
                      </Text>
                      <View
                        style={[
                          styles.statusDot,
                          item.paid ? styles.statusDotPaid : styles.statusDotPending,
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
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* Gradient Overlay Fade out on bottom */}
            {sortedExpenses.length > 1 && (
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(0, 0, 0, 0.4)',
                  'rgba(0, 0, 0, 0.85)',
                  '#000000',
                ]}
                locations={[0, 0.35, 0.7, 1]}
                pointerEvents="none"
                style={styles.gradientOverlay}
              />
            )}
          </View>
        </View>
      </View>

      {/* Floating Action Button (+) */}
      <FAB onPress={() => setShowAddExpense(true)} />

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} animationType="slide" presentationStyle="fullScreen">
        <AddExpenseScreen onClose={() => setShowAddExpense(false)} />
      </Modal>

      {/* Edit / Details Modal */}
      <Modal visible={showEditExpense} animationType="slide" presentationStyle="fullScreen">
        {selectedExpense && (
          <EditExpenseScreen
            expense={selectedExpense}
            onClose={() => {
              setShowEditExpense(false);
              setSelectedExpense(null);
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
  mainContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  titleSection: {
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 32,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  carouselWrapper: {
    marginBottom: 16,
  },
  metricsContainer: {
    paddingHorizontal: 22,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  transactionsSection: {
    flex: 1,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
  },
  transactionsCount: {
    fontSize: 11,
    color: '#666672',
  },
  transactionsListContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  transactionsScrollView: {
    flex: 1,
  },
  transactionsScrollContent: {
    paddingBottom: 110,
    gap: 8,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
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
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  expenseDate: {
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
    borderRadius: 4,
  },
  tagText: {
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
});
