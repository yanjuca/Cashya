import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
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
import { useCards } from '../../contexts/CardsContext';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { formatCurrency } from '../../utils/formatters';
import CardsCarousel from '../cards/CardsCarousel';
import MetricCard from '../dashboard/MetricCard';
import EditExpenseScreen from './EditExpenseScreen';

import AddCardModal from '../cards/AddCardModal';

export default function WalletHomeScreen() {
  const insets = useSafeAreaInsets();
  const { cards, activeCardIndex, setActiveCardIndex, activeCard } = useCards();
  const { expenses, togglePaid } = useExpenses();
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);

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
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>cash</Text>
          <Text style={styles.subtitle}>Your cards and accounts in one place.</Text>
        </View>

        {/* Scrollable content for the top elements and transactions */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. BOTÃO DO MÊS + MÉTRICAS E TOTAIS NO TOPO */}
          <View style={styles.metricsContainer}>
            <TouchableOpacity style={styles.monthButton}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.monthButtonText}>Current Month</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <MetricCard
              label="Available limit"
              value={hasCard ? formatCurrency(limiteDisponivel) : '—'}
              subtitle={hasCard ? `of ${formatCurrency(cardLimit)}` : 'No card selected'}
              badge={hasCard ? `${percentage}%` : undefined}
            />

            <MetricCard
              label="Total spent"
              value={formatCurrency(totalGasto)}
              subtitle={hasCard ? `of ${formatCurrency(cardLimit)}` : 'This month'}
              badge={hasCard ? `${percentage}%` : undefined}
            />

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

          {/* 2. CARDS CAROUSEL */}
          <View style={styles.carouselWrapper}>
            <CardsCarousel
              cards={cards}
              activeIndex={activeCardIndex}
              onIndexChange={setActiveCardIndex}
              onAddCard={() => setShowAddCard(true)}
            />
          </View>

          {/* 3. TRANSACTIONS SECTION */}
          <View style={styles.transactionsSection}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.transactionsTitle}>TRANSACTIONS</Text>
              <Text style={styles.transactionsCount}>
                {sortedExpenses.length} {sortedExpenses.length === 1 ? 'item' : 'items'}
              </Text>
            </View>

            <View style={styles.transactionsListContainer}>
              {sortedExpenses.length === 0 ? null : (
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
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Add Card Modal */}
      <AddCardModal
        visible={showAddCard}
        onClose={() => setShowAddCard(false)}
      />

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
  scrollContent: {
    paddingBottom: 110,
  },
  titleSection: {
    paddingHorizontal: 22,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161a',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  monthButtonText: {
    fontFamily: FONTS.system,
    fontSize: 13,
    color: '#ffffff',
    marginHorizontal: 8,
  },
  carouselWrapper: {
    marginBottom: 16,
  },
  metricsContainer: {
    paddingHorizontal: 22,
    marginBottom: 16,
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
  transactionsListContainer: {
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
});