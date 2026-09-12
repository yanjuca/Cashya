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
import AddExpenseScreen from './AddExpenseScreen';
import EditExpenseScreen from './EditExpenseScreen';
import { Expense, useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { formatCurrency } from '../../utils/formatters';

export default function ExpensesTabScreen() {
  const { expenses, togglePaid } = useExpenses();

  const [searchText, setSearchText] = useState('');
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Extract unique persons and tags
  const allPersons = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.person))).filter(Boolean).sort();
  }, [expenses]);

  const allTags = useMemo(() => {
    return Array.from(new Set(expenses.flatMap((e) => e.tags))).filter(Boolean).sort();
  }, [expenses]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
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
        <View>
          <Text style={styles.person}>{item.person}</Text>
          <Text style={styles.dateText}>
            {item.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </Text>
        </View>
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

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DESPESAS</Text>
        <Text style={styles.countText}>
          {filteredExpenses.length} {filteredExpenses.length === 1 ? 'registro' : 'registros'}
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar despesa..."
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

      {/* Filter Chips Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* Status filters */}
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'all' && styles.filterChipTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'pending' && styles.filterChipActive]}
            onPress={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === 'pending' && styles.filterChipTextActive,
              ]}
            >
              Pendentes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, filterStatus === 'paid' && styles.filterChipActive]}
            onPress={() => setFilterStatus(filterStatus === 'paid' ? 'all' : 'paid')}
          >
            <Text
              style={[
                styles.filterChipText,
                filterStatus === 'paid' && styles.filterChipTextActive,
              ]}
            >
              Pagas
            </Text>
          </TouchableOpacity>

          {/* Person filters */}
          {allPersons.map((person) => (
            <TouchableOpacity
              key={person}
              style={[styles.filterChip, filterPerson === person && styles.filterChipActive]}
              onPress={() => setFilterPerson(filterPerson === person ? null : person)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterPerson === person && styles.filterChipTextActive,
                ]}
              >
                {person}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Tag filters */}
          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.filterChip, filterTag === tag && styles.filterChipActive]}
              onPress={() => setFilterTag(filterTag === tag ? null : tag)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterTag === tag && styles.filterChipTextActive,
                ]}
              >
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}

          {(filterPerson || filterTag || filterStatus !== 'all' || searchText) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Limpar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
            <Ionicons name="receipt-outline" size={54} color="#303036" />
            <Text style={styles.emptyText}>Nenhuma despesa encontrada</Text>
          </View>
        }
      />

      {/* Add FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setShowAddExpense(true)}
      >
        <MaterialIcons name="add" size={30} color="#ffffff" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 24,
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161b',
    borderWidth: 1,
    borderColor: '#24242a',
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: 20,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
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
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#16161b',
    borderWidth: 1,
    borderColor: '#24242a',
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
    color: '#ffffff',
    fontWeight: 'bold',
  },
  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 160,
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
    alignItems: 'flex-end',
  },
  person: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  dateText: {
    fontSize: 11,
    color: '#666670',
    marginTop: 2,
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
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
