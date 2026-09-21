import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { Expense } from '../../types';
import { formatCurrency, formatMonthYear, toDateKey } from '../../utils/formatters';
import FAB from '../ui/FAB';
import AddExpenseScreen from './AddExpenseScreen';
import CalendarView from './CalendarView';
import EditExpenseScreen from './EditExpenseScreen';

type ViewMode = 'list' | 'calendar';

export default function TransactionsScreen() {
  const { expenses, togglePaid } = useExpenses();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Filters for List Mode
  const [searchText, setSearchText] = useState('');
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');

  // State for Calendar Mode
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Extract unique persons and tags
  const allPersons = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.person))).filter(Boolean).sort();
  }, [expenses]);

  const allTags = useMemo(() => {
    return Array.from(new Set(expenses.flatMap((e) => e.tags))).filter(Boolean).sort();
  }, [expenses]);

  // Filtered expenses for List Mode
  const listExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        !searchText.trim() ||
        expense.description.toLowerCase().includes(searchText.toLowerCase().trim());
      const matchesPerson = !filterPerson || expense.person === filterPerson;
      const matchesTag = !filterTag || expense.tags.includes(filterTag);
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'pending' && !expense.paid) ||
        (filterStatus === 'paid' && expense.paid);

      return matchesSearch && matchesPerson && matchesTag && matchesStatus;
    });
  }, [expenses, searchText, filterPerson, filterTag, filterStatus]);

  // Filtered expenses for Calendar Mode
  const monthExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      return (
        expense.date.getMonth() === currentMonth.getMonth() &&
        expense.date.getFullYear() === currentMonth.getFullYear()
      );
    });
  }, [expenses, currentMonth]);

  const calendarExpenses = useMemo(() => {
    if (!selectedDate) return monthExpenses;
    return monthExpenses.filter((expense) => toDateKey(expense.date) === toDateKey(selectedDate));
  }, [monthExpenses, selectedDate]);

  const totalCalendarMonth = useMemo(() => {
    return monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [monthExpenses]);

  const pendingCalendarMonth = useMemo(() => {
    return monthExpenses.filter((e) => !e.paid).reduce((acc, e) => acc + e.amount, 0);
  }, [monthExpenses]);

  const handleEditExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowEditExpense(true);
  };

  const clearFilters = () => {
    setFilterPerson(null);
    setFilterTag(null);
    setFilterStatus('all');
    setSearchText('');
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const renderExpenseItem: ListRenderItem<Expense> = ({ item }) => (
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

      <View style={styles.cardRow}>
        <View style={styles.cardSubDetails}>
          <Text style={styles.person}>{item.person}</Text>
          <Text style={styles.date}>
            {item.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
      </View>

      {item.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {item.tags.map((tag, idx) => (
            <View key={idx} style={styles.tagBadge}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header with Title and Mode Toggle */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>transactions</Text>
          <Text style={styles.headerSubtitle}>
            {viewMode === 'list'
              ? `${listExpenses.length} ${listExpenses.length === 1 ? 'record' : 'records'}`
              : formatMonthYear(currentMonth)}
          </Text>
        </View>

        {/* View Mode Toggle Switch */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="list"
              size={18}
              color={viewMode === 'list' ? '#ffffff' : COLORS.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleButtonActive]}
            onPress={() => setViewMode('calendar')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={18}
              color={viewMode === 'calendar' ? '#ffffff' : COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* VIEW MODE: LIST */}
      {viewMode === 'list' && (
        <View style={styles.contentFlex}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search description..."
              placeholderTextColor={COLORS.textSecondary}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips Scroll */}
          <View style={styles.filtersWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContent}
            >
              {/* Status Chips */}
              <TouchableOpacity
                style={[styles.chip, filterStatus === 'all' && styles.chipActive]}
                onPress={() => setFilterStatus('all')}
              >
                <Text style={[styles.chipText, filterStatus === 'all' && styles.chipTextActive]}>
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, filterStatus === 'pending' && styles.chipActive]}
                onPress={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
              >
                <View style={[styles.miniDot, { backgroundColor: COLORS.primary }]} />
                <Text style={[styles.chipText, filterStatus === 'pending' && styles.chipTextActive]}>
                  Pending
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, filterStatus === 'paid' && styles.chipActive]}
                onPress={() => setFilterStatus(filterStatus === 'paid' ? 'all' : 'paid')}
              >
                <View style={[styles.miniDot, { backgroundColor: COLORS.success }]} />
                <Text style={[styles.chipText, filterStatus === 'paid' && styles.chipTextActive]}>
                  Paid
                </Text>
              </TouchableOpacity>

              {/* Persons */}
              {allPersons.map((person) => (
                <TouchableOpacity
                  key={person}
                  style={[styles.chip, filterPerson === person && styles.chipActive]}
                  onPress={() => setFilterPerson(filterPerson === person ? null : person)}
                >
                  <Text style={[styles.chipText, filterPerson === person && styles.chipTextActive]}>
                    {person}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Tags */}
              {allTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, filterTag === tag && styles.chipActive]}
                  onPress={() => setFilterTag(filterTag === tag ? null : tag)}
                >
                  <Text style={[styles.chipText, filterTag === tag && styles.chipTextActive]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Clear button */}
              {(filterPerson || filterTag || filterStatus !== 'all' || searchText) && (
                <TouchableOpacity style={styles.chipClear} onPress={clearFilters}>
                  <Text style={styles.chipClearText}>✕ Clear</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* List of Expenses */}
          <FlatList
            data={listExpenses}
            keyExtractor={(item) => item.id}
            renderItem={renderExpenseItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#303038" />
                <Text style={styles.emptyTitle}>No expenses found</Text>
                <Text style={styles.emptySubtitle}>Try adjusting filters or add a new expense.</Text>
              </View>
            }
          />
        </View>
      )}

      {/* VIEW MODE: CALENDAR */}
      {viewMode === 'calendar' && (
        <View style={styles.contentFlex}>
          {/* Month Switcher Header */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={previousMonth} style={styles.monthNavBtn}>
              <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
            </TouchableOpacity>

            <Text style={styles.monthNavTitle}>{formatMonthYear(currentMonth)}</Text>

            <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn}>
              <MaterialIcons name="chevron-right" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Month Summary Bar */}
          <View style={styles.calendarSummaryBar}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>MONTH TOTAL</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalCalendarMonth)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>PENDING</Text>
              <Text style={[styles.summaryValue, { color: COLORS.primary }]}>
                {formatCurrency(pendingCalendarMonth)}
              </Text>
            </View>
          </View>

          {/* Dot-matrix Calendar View */}
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

          {/* Selected Date Filter Badge */}
          {selectedDate && (
            <View style={styles.dateFilterChipRow}>
              <Text style={styles.dateFilterChipText}>
                Showing: {selectedDate.toLocaleDateString('en-US', { day: '2-digit', month: 'long' })}
              </Text>
              <TouchableOpacity onPress={() => setSelectedDate(null)}>
                <Ionicons name="close-circle" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Calendar Expenses List */}
          <FlatList
            data={calendarExpenses}
            keyExtractor={(item) => item.id}
            renderItem={renderExpenseItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptySubtitle}>
                  {selectedDate ? 'No expenses for this day.' : 'No expenses this month.'}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Floating Action Button (+) */}
      <FAB onPress={() => setShowAddExpense(true)} />

      {/* Add Expense Modal */}
      <Modal visible={showAddExpense} animationType="slide" presentationStyle="fullScreen">
        <AddExpenseScreen onClose={() => setShowAddExpense(false)} />
      </Modal>

      {/* Edit Expense Modal */}
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
  contentFlex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 26,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#16161c',
    borderRadius: BORDER_RADIUS.full,
    padding: 3,
    borderWidth: 1,
    borderColor: '#262630',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141418',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    height: 42,
    borderWidth: 1,
    borderColor: '#22222a',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  filtersWrapper: {
    marginBottom: 10,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#16161c',
    borderWidth: 1,
    borderColor: '#262630',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#281a1c',
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipClear: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#26181a',
  },
  chipClearText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.xl,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  statusDotPaid: {
    backgroundColor: COLORS.success,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSubDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  person: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#555560',
  },
  amount: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 18,
    color: '#ffffff',
    letterSpacing: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagBadge: {
    backgroundColor: '#1f1f26',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    color: '#a0a0ab',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  monthNavBtn: {
    padding: 8,
    backgroundColor: '#16161c',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: '#262630',
  },
  monthNavTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 17,
    color: '#ffffff',
    letterSpacing: 1,
  },
  calendarSummaryBar: {
    flexDirection: 'row',
    backgroundColor: '#141418',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#202028',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#262630',
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: '600',
  },
  summaryValue: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  dateFilterChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#201316',
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  dateFilterChipText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
