import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
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
import { useExpenses } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
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
}

export default function TransactionsScreen({
  viewMode = 'calendar',
  onCalendarGestureActive,
  onScroll,
}: TransactionsScreenProps = {}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { expenses, togglePaid } = useExpenses();
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsExpense, setDetailsExpense] = useState<Expense | null>(null);

  const [searchText, setSearchText] = useState('');
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'paid'>('all');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const minAllowedDate = useMemo(() => {
    const y = new Date().getFullYear();
    return new Date(y - 5, 0, 1);
  }, []);

  const maxAllowedDate = useMemo(() => {
    const y = new Date().getFullYear();
    return new Date(y + 5, 11, 31, 23, 59, 59);
  }, []);

  const onMonthDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowMonthPicker(false);
    }
    if (event.type === 'set' && selected) {
      triggerButtonHaptic();
      const clampedYear = Math.max(minAllowedDate.getFullYear(), Math.min(selected.getFullYear(), maxAllowedDate.getFullYear()));
      setCurrentMonth(new Date(clampedYear, selected.getMonth(), 1));
      setSelectedDate(null);
      if (Platform.OS === 'ios') {
        setShowMonthPicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowMonthPicker(false);
    }
  };


  const allPersons = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.person))).filter(Boolean).sort();
  }, [expenses]);

  const allTags = useMemo(() => {
    return Array.from(new Set(expenses.flatMap((e) => e.tags))).filter(Boolean).sort();
  }, [expenses]);

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
    setDetailsExpense(expense);
    setShowDetailsModal(true);
  };

  const handleCardLongPress = async (expense: Expense) => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    await togglePaid(expense.id);
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

  const TactileCardItem = React.memo(({
    item,
    isSubItem = false,
    onPress,
    onLongPress,
  }: {
    item: Expense;
    isSubItem?: boolean;
    onPress: () => void;
    onLongPress: () => void;
  }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

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

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View
          style={[
            styles.card,
            isSubItem && styles.subCard,
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
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      item.paid && styles.statusDotPaid,
                    ]}
                  />
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
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  });

  const renderExpenseCard = (item: Expense, isSubItem: boolean = false) => {
    return (
      <TactileCardItem
        key={item.id}
        item={item}
        isSubItem={isSubItem}
        onPress={() => handleCardPress(item)}
        onLongPress={() => handleCardLongPress(item)}
      />
    );
  };

  const AnimatedGroupCard = React.memo(({ group }: { group: ExpenseGroup }) => {
    const isExpanded = expandedGroupKeys.has(group.key);

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
      toggleGroupExpand(group.key);
    };

    const groupPressScale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.timing(groupPressScale, {
        toValue: 0.98,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(groupPressScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
    };

    return (
      <View style={styles.groupWrapper}>
        <Animated.View style={{ transform: [{ scale: groupPressScale }] }}>
          <View
            style={[
              styles.card,
              styles.groupCardHeader,
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleGroupPress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <View style={styles.cardMainRow}>
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

                <TouchableOpacity
                  style={styles.groupChevronBtn}
                  onPress={() => toggleGroupExpand(group.key)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.7}
                >
                  <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                    <Text style={styles.groupChevronGlyph}>›</Text>
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

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
                    <View
                      style={[
                        styles.treeTrunkSegment,
                        isFirst && styles.treeTrunkFirst,
                        isLast && styles.treeTrunkLast,
                      ]}
                    />

                    <View style={styles.treeBranchLine} />

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
      <StatusBar barStyle={colors.statusBar} />

      {viewMode === 'list' && (
        <ScrollView
          style={styles.contentFlex}
          contentContainerStyle={styles.scrollContainerContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search description..."
              placeholderTextColor={colors.textSecondary}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filtersWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContent}
            >
              <TouchableOpacity
                style={[styles.chip, filterStatus === 'all' && styles.chipActive]}
                onPress={() => {
                  triggerButtonHaptic();
                  setFilterStatus('all');
                }}
              >
                <Text style={[styles.chipText, filterStatus === 'all' && styles.chipTextActive]}>
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, filterStatus === 'pending' && styles.chipActive]}
                onPress={() => {
                  triggerButtonHaptic();
                  setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending');
                }}
              >
                <View style={[styles.miniDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.chipText, filterStatus === 'pending' && styles.chipTextActive]}>
                  Pending
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, filterStatus === 'paid' && styles.chipActive]}
                onPress={() => {
                  triggerButtonHaptic();
                  setFilterStatus(filterStatus === 'paid' ? 'all' : 'paid');
                }}
              >
                <View style={[styles.miniDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.chipText, filterStatus === 'paid' && styles.chipTextActive]}>
                  Paid
                </Text>
              </TouchableOpacity>

              {allPersons.map((person) => (
                <TouchableOpacity
                  key={person}
                  style={[styles.chip, filterPerson === person && styles.chipActive]}
                  onPress={() => {
                    triggerButtonHaptic();
                    setFilterPerson(filterPerson === person ? null : person);
                  }}
                >
                  <Text style={[styles.chipText, filterPerson === person && styles.chipTextActive]}>
                    {person}
                  </Text>
                </TouchableOpacity>
              ))}

              {allTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, filterTag === tag && styles.chipActive]}
                  onPress={() => {
                    triggerButtonHaptic();
                    setFilterTag(filterTag === tag ? null : tag);
                  }}
                >
                  <Text style={[styles.chipText, filterTag === tag && styles.chipTextActive]}>
                    #{tag}
                  </Text>
                </TouchableOpacity>
              ))}

              {(filterPerson || filterTag || filterStatus !== 'all' || searchText) && (
                <TouchableOpacity
                  style={styles.chipClear}
                  onPress={() => {
                    triggerButtonHaptic();
                    clearFilters();
                  }}
                >
                  <Text style={styles.chipClearText}>✕ Clear</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          <View style={styles.itemsWrapper}>
            {listExpenses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="reorder-two-outline" size={36} color={colors.borderLight} />
              </View>
            ) : (
              groupedListExpenses.map((item) => renderGroupedCard(item))
            )}
          </View>
        </ScrollView>
      )}

      {viewMode === 'calendar' && (
        <ScrollView
          style={styles.contentFlex}
          contentContainerStyle={styles.scrollContainerContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.calendarSection}>
            <View style={styles.monthNavRow}>
              <TouchableOpacity onPress={handlePreviousMonthBtn} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={styles.monthNavArrowText}>‹</Text>
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
                <Text style={styles.monthNavDropdownGlyph}>{showMonthPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNextMonthBtn} style={styles.monthNavBtn} activeOpacity={0.7}>
                <Text style={styles.monthNavArrowText}>›</Text>
              </TouchableOpacity>
            </View>

            {showMonthPicker && (
              <DateTimePicker
                value={currentMonth}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onMonthDateChange}
                minimumDate={minAllowedDate}
                maximumDate={maxAllowedDate}
              />
            )}

            <View style={styles.calendarSummaryBar}>
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>MONTH TOTAL</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalCalendarMonth)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryCol}>
                <Text style={styles.summaryLabel}>PENDING</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>
                  {formatCurrency(pendingCalendarMonth)}
                </Text>
              </View>
            </View>

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

            {selectedDate && (
              <View style={styles.dateFilterChipRow}>
                <Text style={styles.dateFilterChipText}>
                  Showing: {selectedDate.toLocaleDateString('en-US', { day: '2-digit', month: 'long' })}
                </Text>
                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

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

          <View style={styles.itemsWrapper}>
            {calendarExpenses.length === 0 ? (
              <View style={styles.calendarEmptyContainer}>
                <Ionicons name="reorder-two-outline" size={32} color={colors.borderLight} />
              </View>
            ) : (
              groupedCalendarExpenses.map((item) => renderGroupedCard(item))
            )}
          </View>
        </ScrollView>
      )}

      <TransactionDetailsModal
        visible={showDetailsModal}
        expense={detailsExpense}
        onClose={() => {
          setShowDetailsModal(false);
          setDetailsExpense(null);
        }}
        onEdit={(expense) => {
          setSelectedExpense(expense);
          setShowEditExpense(true);
        }}
      />

      <EditExpenseScreen
        visible={showEditExpense}
        expense={selectedExpense}
        onClose={() => {
          setShowEditExpense(false);
          setSelectedExpense(null);
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
      color: colors.text,
      letterSpacing: 1.5,
    },
    toggleContainer: {
      flexDirection: 'row',
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.full,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleButton: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: BORDER_RADIUS.full,
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: 14,
      marginHorizontal: 20,
      marginBottom: 10,
      height: 42,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: FONTS.regular,
      color: colors.text,
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
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
    },
    chipActive: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    chipText: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.text,
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
      backgroundColor: colors.primaryMuted,
    },
    chipClearText: {
      fontFamily: FONTS.bold,
      fontSize: 11,
      color: colors.primary,
    },
    scrollContainerContent: {
      paddingTop: 4,
      paddingBottom: 150,
    },
    itemsWrapper: {
      paddingHorizontal: 20,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 150,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.text,
      flex: 1,
      marginRight: 10,
    },
    statusDot: {
      width: 8,
      height: 8,
      marginRight: 12,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primary,
      borderWidth: 0.5,
      borderColor: colors.borderLight,
    },
    statusDotPaid: {
      backgroundColor: colors.success,
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
      color: colors.textSecondary,
    },
    date: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
    },
    amount: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 18,
      color: colors.text,
      letterSpacing: 1,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    tagBadge: {
      backgroundColor: colors.cardBackgroundLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.xs,
    },
    tagText: {
      fontFamily: FONTS.regular,
      fontSize: 10,
      color: colors.textSecondary,
    },
    calendarSection: {
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
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthNavArrowText: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 18,
      color: colors.text,
      lineHeight: 20,
      marginTop: -2,
    },
    monthNavTitleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 14,
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthNavDropdownGlyph: {
      fontSize: 9,
      color: colors.textSecondary,
      marginTop: 1,
    },
    monthNavTitle: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 16,
      color: colors.text,
      letterSpacing: 1,
    },
    calendarSummaryBar: {
      flexDirection: 'row',
      backgroundColor: colors.cardBackground,
      marginHorizontal: 20,
      marginBottom: 8,
      borderRadius: BORDER_RADIUS.lg,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryCol: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    summaryLabel: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 10,
      color: colors.textSecondary,
      marginBottom: 2,
      letterSpacing: 0.8,
    },
    summaryValue: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 16,
      color: colors.text,
      letterSpacing: 0.5,
    },
    dateFilterChipRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.primaryMuted,
      marginHorizontal: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    dateFilterChipText: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.text,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 50,
    },
    emptyTitle: {
      fontFamily: FONTS.medium,
      fontSize: 16,
      color: colors.text,
      marginTop: 12,
    },
    emptySubtitle: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
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
      backgroundColor: colors.border,
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
    cardMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardContent: {
      flex: 1,
    },
    cardEditMode: {
      borderColor: colors.border,
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
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
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    calendarTransactionsTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    calendarTransactionsCount: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
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
      color: colors.textMuted,
    },
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
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginTop: 4,
    },
    groupAmount: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 22,
      color: colors.text,
      letterSpacing: 1.2,
    },
    groupChevronBtn: {
      padding: 6,
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupChevronGlyph: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 22,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    checkboxPartial: {
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    checkboxPartialDot: {
      width: 8,
      height: 8,
      borderRadius: BORDER_RADIUS.xs,
      backgroundColor: colors.primary,
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
      backgroundColor: colors.border,
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
      backgroundColor: colors.border,
    },
    treeCardContainer: {
      flex: 1,
      marginLeft: 36,
    },
    subCard: {
      backgroundColor: colors.cardBackground,
      borderColor: colors.border,
      marginBottom: 0,
    },
  });
}