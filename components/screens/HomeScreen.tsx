import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ListRenderItem,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { COLORS, FONTS } from '../../theme';
import { formatCurrency, formatMonthYear, toDateKey } from '../../utils/formatters';
import AddExpenseScreen from './AddExpenseScreen';
import CalendarView from './CalendarView';
import EditExpenseScreen from './EditExpenseScreen';
import StatisticsScreen from './StatisticsScreen';

const { height } = Dimensions.get('window');

export default function HomeScreen() {
  const { expenses, togglePaid, loading } = useExpenses();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Default view is 'calendar' as requested!
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Month-filtered expenses
  const monthExpenses = expenses.filter((expense) => {
    return (
      expense.date.getMonth() === currentMonth.getMonth() &&
      expense.date.getFullYear() === currentMonth.getFullYear()
    );
  });

  // Filter expenses by month, person, tag, and optional selected calendar date
  const filteredExpenses = monthExpenses.filter((expense) => {
    const personMatch = !filterPerson || expense.person === filterPerson;
    const tagMatch = !filterTag || expense.tags.includes(filterTag);
    const dateMatch = !selectedDate || toDateKey(expense.date) === toDateKey(selectedDate);
    return personMatch && tagMatch && dateMatch;
  });

  // Unique persons and tags for the active month
  const allPersons = Array.from(new Set(monthExpenses.map((e) => e.person))).sort();
  const allTags = Array.from(new Set(monthExpenses.flatMap((e) => e.tags))).sort();

  // Totals of current month
  const totalAmount = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  const pendingAmount = monthExpenses
    .filter((e) => !e.paid)
    .reduce((acc, e) => acc + e.amount, 0);

  // Navigate between months
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handleTogglePaid = async (id: string) => {
    await togglePaid(id);
  };

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const clearFilters = () => {
    setFilterPerson(null);
    setFilterTag(null);
    setSelectedDate(null);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={[styles.container, styles.loadingContainer]}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando despesas...</Text>
      </LinearGradient>
    );
  }

  const renderExpense: ListRenderItem<Expense> = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleEditExpense(item)}
      onLongPress={() => handleTogglePaid(item.id)}
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundGradientStart} />

      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={styles.gradient}
      />

      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.appName}>cashya</Text>

        <View style={styles.headerActions}>
          {/* Toggle View Mode: Calendar vs List */}
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.7}
            onPress={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
          >
            <Ionicons
              name={viewMode === 'calendar' ? 'list-outline' : 'calendar-outline'}
              size={22}
              color={COLORS.text}
            />
          </TouchableOpacity>

          {/* Stats Button */}
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.7}
            onPress={() => setShowStatistics(true)}
          >
            <Ionicons name="stats-chart" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Chips Bar */}
      {(allPersons.length > 0 || allTags.length > 0 || selectedDate) && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {/* Selected Date Filter Chip */}
            {selectedDate && (
              <TouchableOpacity
                style={[styles.filterChip, styles.filterChipActive]}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={[styles.filterChipText, styles.filterChipTextActive]}>
                  Dia {selectedDate.getDate()} ✕
                </Text>
              </TouchableOpacity>
            )}

            {/* Filter by Person */}
            {allPersons.map((person) => (
              <TouchableOpacity
                key={person}
                style={[styles.filterChip, filterPerson === person && styles.filterChipActive]}
                onPress={() => setFilterPerson(person === filterPerson ? null : person)}
              >
                <Text style={[styles.filterChipText, filterPerson === person && styles.filterChipTextActive]}>
                  {person}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Filter by Tag */}
            {allTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.filterChip, filterTag === tag && styles.filterChipActive]}
                onPress={() => setFilterTag(tag === filterTag ? null : tag)}
              >
                <Text style={[styles.filterChipText, filterTag === tag && styles.filterChipTextActive]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}

            {(filterPerson || filterTag || selectedDate) && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Ionicons name="close-circle" size={18} color={COLORS.text} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Main Content: Calendar View vs List View */}
      {viewMode === 'calendar' ? (
        <View style={styles.calendarContainer}>
          <CalendarView
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              if (selectedDate && toDateKey(selectedDate) === toDateKey(date)) {
                setSelectedDate(null); // Unselect if already selected
              } else {
                setSelectedDate(date);
              }
            }}
            expenses={monthExpenses}
          />

          {/* Sub-list for selected day or recent expenses in calendar view */}
          <View style={styles.calendarExpensesContainer}>
            <View style={styles.calendarSectionHeader}>
              <Text style={styles.calendarSectionTitle}>
                {selectedDate
                  ? `Despesas de ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
                  : 'Todas as despesas do mês'}
              </Text>
              <Text style={styles.calendarSectionCount}>
                {filteredExpenses.length} {filteredExpenses.length === 1 ? 'item' : 'itens'}
              </Text>
            </View>

            <FlatList
              data={filteredExpenses}
              renderItem={renderExpense}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainerSmall}>
                  <Text style={styles.emptyTextSmall}>Nenhuma movimentação para esta seleção</Text>
                </View>
              }
            />
          </View>
        </View>
      ) : (
        /* Full List View */
        <FlatList
          data={filteredExpenses}
          renderItem={renderExpense}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nenhuma despesa neste mês</Text>
            </View>
          }
        />
      )}

      {/* Bottom Section - Month Selector and Totals */}
      <View style={styles.bottomSection}>
        <View style={styles.monthCard}>
          <TouchableOpacity style={styles.chevronButton} onPress={previousMonth}>
            <MaterialIcons name="chevron-left" size={28} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.monthText}>{formatMonthYear(currentMonth)}</Text>

          <TouchableOpacity style={styles.chevronButton} onPress={nextMonth}>
            <MaterialIcons name="chevron-right" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>total do mês</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalAmount)}</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>pendente</Text>
            <Text style={styles.totalValue}>{formatCurrency(pendingAmount)}</Text>
          </View>
        </View>
      </View>

      {/* Add Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setShowAddExpense(true)}
      >
        <MaterialIcons name="add" size={32} color={COLORS.text} />
      </TouchableOpacity>

      {/* Modals */}
      <Modal visible={showAddExpense} animationType="slide" presentationStyle="fullScreen">
        <AddExpenseScreen onClose={() => setShowAddExpense(false)} />
      </Modal>

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

      <Modal visible={showStatistics} animationType="slide" presentationStyle="fullScreen">
        <StatisticsScreen onClose={() => setShowStatistics(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: height,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  appName: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 32,
    color: COLORS.text,
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBar: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  filterScrollContent: {
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  filterChipTextActive: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  clearFiltersButton: {
    padding: 4,
  },
  calendarContainer: {
    flex: 1,
  },
  calendarExpensesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  calendarSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 4,
  },
  calendarSectionTitle: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  calendarSectionCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 160,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  description: {
    fontSize: 16,
    color: COLORS.text,
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
    fontSize: 16,
    color: COLORS.text,
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
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainerSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyTextSmall: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 25,
    paddingTop: 10,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  monthCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chevronButton: {
    padding: 4,
  },
  monthText: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 15,
    color: COLORS.text,
    letterSpacing: 1,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  totalCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalLabel: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 16,
    color: COLORS.text,
    fontFamily: FONTS.ndot || FONTS.system,
  },
  fab: {
    position: 'absolute',
    bottom: 155,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
});
