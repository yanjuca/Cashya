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
import AddExpenseScreen from './AddExpenseScreen';
import EditExpenseScreen from './EditExpenseScreen';
import StatisticsScreen from './StatisticsScreen';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const { expenses, togglePaid, loading } = useExpenses();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Filter expenses by month, person, and tag
  const filteredExpenses = expenses.filter((expense) => {
    const monthMatch = 
      expense.date.getMonth() === currentMonth.getMonth() &&
      expense.date.getFullYear() === currentMonth.getFullYear();
    
    const personMatch = !filterPerson || expense.person === filterPerson;
    const tagMatch = !filterTag || expense.tags.includes(filterTag);
    
    return monthMatch && personMatch && tagMatch;
  });

  // Get unique persons and tags for filters
  const allPersons = Array.from(new Set(expenses.map(e => e.person))).sort();
  const allTags = Array.from(
    new Set(expenses.flatMap(e => e.tags))
  ).sort();

  // Calculate totals
  const totalAmount = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const pendingAmount = filteredExpenses
    .filter((e) => !e.paid)
    .reduce((acc, e) => acc + e.amount, 0);

  // Navigate between months
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Format month name
  const getMonthName = () => {
    return currentMonth.toLocaleDateString('en-US', { 
      month: 'short',
      year: 'numeric'
    });
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
  };

  if (loading) {
    return (
      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={[styles.container, styles.loadingContainer]}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading expenses...</Text>
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
        <Text style={styles.amount}>
          ${item.amount.toFixed(2)}
        </Text>
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
      
      {/* Gradient Background */}
      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={styles.gradient}
      />
      
      {/* Top Section - App Name */}
      <View style={styles.header}>
        <Text style={styles.appName}>cashya</Text>
        
        {/* Stats Button */}
        <TouchableOpacity
          style={styles.statsButton}
          onPress={() => setShowStatistics(true)}
        >
          <Ionicons name="stats-chart" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      {(allPersons.length > 0 || allTags.length > 0) && (
        <View style={styles.filterBar}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {/* Filter by Person */}
            {allPersons.length > 0 && (
              <>
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
              </>
            )}

            {/* Filter by Tag */}
            {allTags.length > 0 && (
              <>
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
              </>
            )}

            {/* Clear Filters */}
            {(filterPerson || filterTag) && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.text} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No expenses this month</Text>
          </View>
        }
      />

      {/* Bottom Section - Fixed */}
      <View style={styles.bottomSection}>
        {/* Month Navigator */}
        <View style={styles.monthCard}>
          <TouchableOpacity 
            style={styles.chevronButton}
            onPress={previousMonth}
          >
            <MaterialIcons name="chevron-left" size={28} color={COLORS.text} />
          </TouchableOpacity>
          
          <Text style={styles.monthText}>{getMonthName()}</Text>
          
          <TouchableOpacity 
            style={styles.chevronButton}
            onPress={nextMonth}
          >
            <MaterialIcons name="chevron-right" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Totals Section */}
        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>month total</Text>
            <Text style={styles.totalValue}>${totalAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>pending</Text>
            <Text style={styles.totalValue}>${pendingAmount.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Add Button (FAB) */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setShowAddExpense(true)}
      >
        <MaterialIcons name="add" size={32} color={COLORS.text} />
      </TouchableOpacity>

      {/* Modals */}
      <Modal
        visible={showAddExpense}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <AddExpenseScreen onClose={() => setShowAddExpense(false)} />
      </Modal>

      <Modal
        visible={showEditExpense}
        animationType="slide"
        presentationStyle="fullScreen"
      >
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

      <Modal
        visible={showStatistics}
        animationType="slide"
        presentationStyle="fullScreen"
      >
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
    fontSize: 16,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontFamily: FONTS.ndot,
    color: COLORS.text,
    letterSpacing: 2,
  },
  statsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
  },
  filterBar: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  filterScrollContent: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  filterChipTextActive: {
    color: COLORS.text,
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 280,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontFamily: FONTS.system,
    color: COLORS.text,
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  statusDotPaid: {
    backgroundColor: COLORS.success,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  person: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  amount: {
    fontSize: 18,
    fontFamily: FONTS.system,
    fontWeight: '600',
    color: COLORS.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontFamily: FONTS.system,
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chevronButton: {
    padding: 8,
  },
  monthText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: FONTS.system,
    color: COLORS.text,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  totalCard: {
    flex: 1,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontFamily: FONTS.system,
  },
  totalValue: {
    fontSize: 18,
    fontFamily: FONTS.system,
    fontWeight: '600',
    color: COLORS.text,
  },
  fab: {
    position: 'absolute',
    bottom: 250,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});