import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  FlatList,
  LayoutAnimation,
  ListRenderItem,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useAlert } from '../../contexts/AlertContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Expense } from '../../types';
import { formatCurrency, formatMonthYear, toDateKey } from '../../utils/formatters';
import CalendarView from './CalendarView';
import EditExpenseScreen from './EditExpenseScreen';
import TransactionDetailsModal from './TransactionDetailsModal';

export type ViewMode = 'list' | 'calendar';

export interface TransactionsScreenProps {
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  onCalendarGestureActive?: (active: boolean) => void;
  onScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
}

export default function TransactionsScreen({
  viewMode = 'calendar',
  onCalendarGestureActive,
  onScroll,
  onEditModeChange,
}: TransactionsScreenProps = {}) {
  const { expenses, removeExpenses } = useExpenses();
  const { showAlert } = useAlert();
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);

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

  // Filters for List Mode
  const [searchText, setSearchText] = useState('');
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');

  // State for Calendar Mode
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const onMonthDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowMonthPicker(false);
    }
    if (event.type === 'set' && selected) {
      triggerButtonHaptic();
      setCurrentMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
      setSelectedDate(null);
      if (Platform.OS === 'ios') {
        setShowMonthPicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowMonthPicker(false);
    }
  };

  // Handle hardware back on Android to exit edit mode
  useEffect(() => {
    if (!isEditMode) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsEditMode(false);
      setSelectedExpenseIds(new Set());
      return true;
    });

    return () => backHandler.remove();
  }, [isEditMode]);

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

  // Grouping structure
  interface ExpenseGroup {
    type: 'group';
    key: string;
    title: string;
    expenses: Expense[];
    totalAmount: number;
    hasPending: boolean;
    hasPaid: boolean;
  }

  type ExpenseItemOrGroup = { type: 'single'; expense: Expense } | ExpenseGroup;

  const groupExpenses = (list: Expense[]): ExpenseItemOrGroup[] => {
    const map = new Map<string, Expense[]>();
    const order: string[] = [];

    list.forEach((expense) => {
      const key = expense.description.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(expense);
    });

    return order.map((key) => {
      const items = map.get(key)!;
      if (items.length === 1) {
        return { type: 'single', expense: items[0] };
      }
      const totalAmount = items.reduce((acc, curr) => acc + curr.amount, 0);
      const hasPending = items.some((item) => !item.paid);
      const hasPaid = items.some((item) => item.paid);
      return {
        type: 'group',
        key,
        title: items[0].description.trim(),
        expenses: items,
        totalAmount,
        hasPending,
        hasPaid,
      };
    });
  };

  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  const toggleGroupExpand = (key: string) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const groupedListExpenses = useMemo(() => groupExpenses(listExpenses), [listExpenses]);

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

  const groupedCalendarExpenses = useMemo(
    () => groupExpenses(calendarExpenses),
    [calendarExpenses]
  );

  const totalCalendarMonth = useMemo(() => {
    return monthExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [monthExpenses]);

  const pendingCalendarMonth = useMemo(() => {
    return monthExpenses.filter((e) => !e.paid).reduce((acc, e) => acc + e.amount, 0);
  }, [monthExpenses]);

  const handleCardPress = (expense: Expense) => {
    if (isEditMode) {
      toggleExpenseSelection(expense.id);
    } else {
      setDetailsExpense(expense);
      setShowDetailsModal(true);
    }
  };

  const handleCardLongPress = (expense: Expense) => {
    if (!isEditMode) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
      setIsEditMode(true);
      setSelectedExpenseIds(new Set([expense.id]));
    } else {
      toggleExpenseSelection(expense.id);
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

  const handleEditButtonPress = (expense: Expense) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setSelectedExpense(expense);
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

  const clearFilters = () => {
    setFilterPerson(null);
    setFilterTag(null);
    setFilterStatus('all');
    setSearchText('');
  };

  const triggerButtonHaptic = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  };

  const changeToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const changeToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const handlePreviousMonthBtn = () => {
    triggerButtonHaptic();
    changeToPreviousMonth();
  };

  const handleNextMonthBtn = () => {
    triggerButtonHaptic();
    changeToNextMonth();
  };

  const renderExpenseCard = (item: Expense, isSubItem: boolean = false) => {
    const isSelected = selectedExpenseIds.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.card,
          isSubItem && styles.subCard,
          isEditMode && styles.cardEditMode,
          isSelected && styles.cardSelected,
        ]}
        activeOpacity={0.7}
        onPress={() => handleCardPress(item)}
        onLongPress={() => handleCardLongPress(item)}
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
            <View style={styles.cardHeader}>
              <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
              {!isEditMode && (
                <View style={[styles.statusDot, item.paid && styles.statusDotPaid]} />
              )}
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
  };

  const AnimatedGroupCard = React.memo(({ group }: { group: ExpenseGroup }) => {
    const isExpanded = expandedGroupKeys.has(group.key);
    const allSelected = group.expenses.every((e) => selectedExpenseIds.has(e.id));
    const someSelected = group.expenses.some((e) => selectedExpenseIds.has(e.id));

    // Animation values
    const animValue = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
    const [contentHeight, setContentHeight] = useState(0);

    useEffect(() => {
      Animated.timing(animValue, {
        toValue: isExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }, [isExpanded, animValue]);

    const chevronRotation = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const handleGroupPress = () => {
      if (isEditMode) {
        if (Platform.OS !== 'web') {
          try {
            Haptics.selectionAsync();
          } catch {}
        }
        setSelectedExpenseIds((prev) => {
          const next = new Set(prev);
          if (allSelected) {
            group.expenses.forEach((e) => next.delete(e.id));
          } else {
            group.expenses.forEach((e) => next.add(e.id));
          }
          if (next.size === 0) {
            setIsEditMode(false);
          }
          return next;
        });
      } else {
        toggleGroupExpand(group.key);
      }
    };

    return (
      <View style={styles.groupWrapper}>
        <TouchableOpacity
          style={[
            styles.card,
            styles.groupCardHeader,
            isEditMode && styles.cardEditMode,
            allSelected && styles.cardSelected,
          ]}
          activeOpacity={0.7}
          onPress={handleGroupPress}
          onLongPress={() => {
            if (!isEditMode) {
              if (Platform.OS !== 'web') {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                } catch {}
              }
              setIsEditMode(true);
              const next = new Set<string>();
              group.expenses.forEach((e) => next.add(e.id));
              setSelectedExpenseIds(next);
            }
          }}
          delayLongPress={300}
        >
          <View style={styles.cardMainRow}>
            {/* Edit mode checkbox to select all in group */}
            {isEditMode && (
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  allSelected && styles.checkboxActive,
                  !allSelected && someSelected && styles.checkboxPartial,
                ]}
                onPress={handleGroupPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.8}
              >
                {allSelected && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                {!allSelected && someSelected && (
                  <View style={styles.checkboxPartialDot} />
                )}
              </TouchableOpacity>
            )}

            <View style={styles.cardContent}>
              <View style={styles.groupMainRow}>
                <View style={styles.groupInfoCol}>
                  <Text style={styles.description} numberOfLines={1}>{group.title}</Text>
                  <Text style={styles.groupSubLabel}>
                    {group.expenses.length} {group.expenses.length === 1 ? 'TRANSACTION' : 'TRANSACTIONS'}
                  </Text>
                </View>
                <Text style={styles.groupAmount}>{formatCurrency(group.totalAmount)}</Text>
              </View>
            </View>

            {/* Expand / Collapse Chevron with rotation animation */}
            <TouchableOpacity
              style={styles.groupChevronBtn}
              onPress={() => toggleGroupExpand(group.key)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Animated Collapsible Sub-expenses list with Filetree branch lines */}
        <Animated.View
          style={[
            styles.collapsibleContent,
            contentHeight > 0
              ? {
                  maxHeight: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, contentHeight],
                  }),
                  opacity: animValue,
                }
              : !isExpanded
              ? { maxHeight: 0, opacity: 0 }
              : undefined,
          ]}
        >
          <View
            style={styles.subExpensesContainer}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0 && Math.abs(h - contentHeight) > 1) {
                setContentHeight(h);
              }
            }}
          >
            <View style={styles.subExpensesList}>
              {group.expenses.map((expense, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === group.expenses.length - 1;

                return (
                  <View key={expense.id} style={styles.treeItemWrapper}>
                    {/* Filetree vertical trunk line segment */}
                    <View
                      style={[
                        styles.treeTrunkSegment,
                        isFirst && styles.treeTrunkFirst,
                        isLast && styles.treeTrunkLast,
                      ]}
                    />

                    {/* Filetree horizontal branch line leading into the card */}
                    <View style={styles.treeBranchLine} />

                    {/* Sub-expense card */}
                    <View style={styles.treeCardContainer}>
                      {renderExpenseCard(expense, true)}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    );
  });

  const renderGroupedCard = (item: ExpenseItemOrGroup) => {
    if (item.type === 'single') {
      return renderExpenseCard(item.expense);
    }
    return <AnimatedGroupCard key={`group-${item.key}`} group={item} />;
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
                triggerButtonHaptic();
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

      {/* VIEW MODE: LIST */}
      {viewMode === 'list' && (
        <ScrollView
          style={styles.contentFlex}
          contentContainerStyle={styles.scrollContainerContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
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
          <View style={styles.itemsWrapper}>
            {listExpenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="receipt-outline" size={48} color="#303038" />
                <Text style={styles.emptyTitle}>No expenses found</Text>
                <Text style={styles.emptySubtitle}>Try adjusting filters or add a new expense.</Text>
              </View>
            ) : (
              groupedListExpenses.map((item) => renderGroupedCard(item))
            )}
          </View>
        </ScrollView>
      )}

      {/* VIEW MODE: CALENDAR */}
      {viewMode === 'calendar' && (
        <ScrollView
          style={styles.contentFlex}
          contentContainerStyle={styles.scrollContainerContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* Collapsible Calendar Section (hides with smooth animation in edit mode) */}
          <Animated.View
            style={[
              styles.collapsibleCalendarWrapper,
              {
                maxHeight: editBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [500, 0],
                }),
                opacity: editBarAnim.interpolate({
                  inputRange: [0, 0.4, 1],
                  outputRange: [1, 0, 0],
                }),
                transform: [
                  {
                    translateY: editBarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -40],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={isEditMode ? 'none' : 'auto'}
          >
            {/* Month Switcher Header */}
            <View style={styles.monthNavRow}>
              <TouchableOpacity onPress={handlePreviousMonthBtn} style={styles.monthNavBtn}>
                <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerButtonHaptic();
                  setShowMonthPicker((prev) => !prev);
                }}
                activeOpacity={0.7}
                style={styles.monthNavTitleBtn}
              >
                <Text style={styles.monthNavTitle}>{formatMonthYear(currentMonth)}</Text>
                <MaterialIcons
                  name={showMonthPicker ? 'arrow-drop-up' : 'arrow-drop-down'}
                  size={18}
                  color={COLORS.textSecondary}
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNextMonthBtn} style={styles.monthNavBtn}>
                <MaterialIcons name="chevron-right" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {showMonthPicker && (
              <DateTimePicker
                value={currentMonth}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onMonthDateChange}
              />
            )}

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

            {/* Dot-matrix Calendar View (Horizontal paginated carousel) */}
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
              expenses={expenses}
              onChangeMonth={(nextMonth) => {
                triggerButtonHaptic();
                setCurrentMonth(nextMonth);
                setSelectedDate(null);
              }}
              onGestureActive={onCalendarGestureActive}
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
          </Animated.View>

          {/* Section Divider & Header */}
          <View style={styles.calendarTransactionsHeader}>
            <View style={styles.calendarDividerLine} />
            <View style={styles.calendarHeaderInfoRow}>
              <View style={styles.calendarTitleAndToggleRow}>
                <Text style={styles.calendarTransactionsTitle}>TRANSACTIONS</Text>
              </View>

              <Text style={styles.calendarTransactionsCount}>
                {calendarExpenses.length} {calendarExpenses.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
          </View>

          {/* Calendar Expenses List */}
          <View style={styles.itemsWrapper}>
            {calendarExpenses.length === 0 ? (
              <View style={styles.calendarEmptyContainer}>
                <Ionicons name="receipt-outline" size={36} color="#262630" />
                <Text style={styles.calendarEmptyText}>No transactions for this date</Text>
              </View>
            ) : (
              groupedCalendarExpenses.map((item) => renderGroupedCard(item))
            )}
          </View>
        </ScrollView>
      )}

      {/* Transaction Details Modal (default tap outside edit mode) */}
      <TransactionDetailsModal
        visible={showDetailsModal}
        expense={detailsExpense}
        onClose={() => {
          setShowDetailsModal(false);
          setDetailsExpense(null);
        }}
      />

      {/* Edit Expense Modal (only accessible in edit mode) */}
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
  contentFlex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 28,
    color: '#ffffff',
    letterSpacing: 1.5,
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
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  chipClear: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#26181a',
  },
  chipClearText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: COLORS.primary,
  },
  scrollContainerContent: {
    paddingTop: 4,
    paddingBottom: 110,
  },
  itemsWrapper: {
    paddingHorizontal: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg,
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
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: '#ffffff',
    flex: 1,
    marginRight: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS.full,
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
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  date: {
    fontFamily: FONTS.regular,
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
    borderRadius: BORDER_RADIUS.xs,
  },
  tagText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#a0a0ab',
  },
  collapsibleCalendarWrapper: {
    overflow: 'hidden',
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
  monthNavTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#16161c',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: '#262630',
  },
  monthNavTitle: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 16,
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
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
    letterSpacing: 0.8,
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
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#ffffff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: '#ffffff',
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  calendarTransactionsHeader: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
  },
  calendarDividerLine: {
    height: 1,
    backgroundColor: '#202028',
    marginBottom: 12,
  },
  calendarHeaderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarTitleAndToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginHorizontal: 20,
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
  calendarTransactionsTitle: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  calendarTransactionsCount: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#666672',
  },
  calendarEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  calendarEmptyText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#666672',
  },
  // Grouping styles
  groupWrapper: {
    marginBottom: 10,
  },
  groupCardHeader: {
    marginBottom: 0,
  },
  groupMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  groupSubLabel: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  groupAmount: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: 1.2,
  },
  groupChevronBtn: {
    padding: 6,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxPartial: {
    borderColor: COLORS.primary,
    backgroundColor: 'transparent',
  },
  checkboxPartialDot: {
    width: 8,
    height: 8,
    borderRadius: BORDER_RADIUS.xs,
    backgroundColor: COLORS.primary,
  },
  subExpensesContainer: {
    backgroundColor: 'transparent',
    paddingTop: 10,
    paddingHorizontal: 0,
  },
  collapsibleContent: {
    overflow: 'hidden',
  },
  subExpensesList: {
    width: '100%',
  },
  treeItemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  treeTrunkSegment: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: '#262630',
  },
  treeTrunkFirst: {
    top: 0,
  },
  treeTrunkLast: {
    bottom: '50%',
  },
  treeBranchLine: {
    position: 'absolute',
    left: 14,
    top: '50%',
    width: 16,
    height: 1.5,
    backgroundColor: '#262630',
  },
  treeCardContainer: {
    flex: 1,
    marginLeft: 36,
  },
  subCard: {
    backgroundColor: '#16161a',
    borderColor: '#24242a',
    marginBottom: 0,
  },
});
