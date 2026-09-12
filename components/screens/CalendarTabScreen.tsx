import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarView from './CalendarView';
import EditExpenseScreen from './EditExpenseScreen';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { formatCurrency, formatMonthYear, toDateKey } from '../../utils/formatters';

export default function CalendarTabScreen() {
  const { expenses, togglePaid } = useExpenses();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);

  // Filter expenses by active month
  const monthExpenses = expenses.filter((expense) => {
    return (
      expense.date.getMonth() === currentMonth.getMonth() &&
      expense.date.getFullYear() === currentMonth.getFullYear()
    );
  });

  // Filter expenses by selected calendar day
  const filteredExpenses = monthExpenses.filter((expense) => {
    if (!selectedDate) return true;
    return toDateKey(expense.date) === toDateKey(selectedDate);
  });

  const totalAmount = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  const pendingAmount = monthExpenses
    .filter((e) => !e.paid)
    .reduce((acc, e) => acc + e.amount, 0);

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const renderExpense: ListRenderItem<Expense> = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleEditExpense(item)}
      onLongPress={() => togglePaid(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.description}>{item.description}</Text>
        <View style={[styles.statusDot, item.paid && styles.statusDotPaid]} />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.person}>{item.person}</Text>
        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
      </View>

      {item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header with Month Selector */}
      <View style={styles.monthHeader}>
        <TouchableOpacity style={styles.chevronButton} onPress={previousMonth}>
          <MaterialIcons name="chevron-left" size={26} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>{formatMonthYear(currentMonth)}</Text>

        <TouchableOpacity style={styles.chevronButton} onPress={nextMonth}>
          <MaterialIcons name="chevron-right" size={26} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <CalendarView
        currentMonth={currentMonth}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          if (selectedDate && toDateKey(selectedDate) === toDateKey(date)) {
            setSelectedDate(null);
          } else {
            setSelectedDate(date);
          }
        }}
        expenses={monthExpenses}
      />

      {/* Daily/Monthly Breakdown Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedDate
            ? `Movimentações de ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
            : 'Todas as movimentações do mês'}
        </Text>
        <Text style={styles.sectionCount}>
          {filteredExpenses.length} {filteredExpenses.length === 1 ? 'item' : 'itens'}
        </Text>
      </View>

      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhuma despesa para esta data</Text>
          </View>
        }
      />

      {/* Summary Footer */}
      <View style={styles.summaryFooter}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>TOTAL DO MÊS</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalAmount)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PENDENTE</Text>
          <Text style={[styles.summaryValue, { color: COLORS.error }]}>
            {formatCurrency(pendingAmount)}
          </Text>
        </View>
      </View>

      {/* Edit Modal */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chevronButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#18181d',
    borderWidth: 1,
    borderColor: '#26262e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#222228',
  },
  sectionTitle: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
  },
  statusDotPaid: {
    backgroundColor: COLORS.success,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  person: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  amount: {
    fontSize: 15,
    color: '#ffffff',
    fontFamily: FONTS.ndot || FONTS.system,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  summaryFooter: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#222228',
    marginBottom: 88,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#26262e',
    marginVertical: 4,
  },
  summaryLabel: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  summaryValue: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 15,
    color: '#ffffff',
  },
});
