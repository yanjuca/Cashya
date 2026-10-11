import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Expense } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import { toDateKey } from '../../utils/formatters';

interface CalendarViewProps {
  currentMonth: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  expenses: Expense[];
  onChangeMonth: (nextMonth: Date) => void;
  onGestureActive?: (active: boolean) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Full width of one calendar card inside the horizontal carousel
const CALENDAR_WIDTH = SCREEN_WIDTH - 40; // 20 margin each side
const CELL_SIZE = Math.floor((CALENDAR_WIDTH - 24) / 7); // 12 inner padding each side

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function CalendarView({
  currentMonth,
  selectedDate,
  onSelectDate,
  expenses,
  onChangeMonth,
  onGestureActive,
}: CalendarViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Calculate row count for the current month
  const currentMonthRows = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    return Math.ceil((firstDay + daysInMonth) / 7);
  }, [currentMonth]);

  // Height for a given number of rows:
  // Card padding (12 top + 10 bottom = 22) + weekdays row (~25) + rows * (CELL_SIZE + 4 + 4 margin)
  const CARD_BASE_HEIGHT = 48; // weekdays + border + padding
  const ROW_HEIGHT = CELL_SIZE + 8;
  const targetHeight = CARD_BASE_HEIGHT + currentMonthRows * ROW_HEIGHT;

  const animatedHeight = useRef(new Animated.Value(targetHeight)).current;

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: targetHeight,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [targetHeight]);

  const expensesByDay = useMemo(() => {
    const map = new Map<string, { total: number; hasPending: boolean; hasPaid: boolean; count: number }>();

    expenses.forEach((expense) => {
      const key = toDateKey(expense.date);
      const current = map.get(key) || { total: 0, hasPending: false, hasPaid: false, count: 0 };
      current.total += expense.amount;
      current.count += 1;
      if (expense.paid) {
        current.hasPaid = true;
      } else {
        current.hasPending = true;
      }
      map.set(key, current);
    });

    return map;
  }, [expenses]);

  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;
  const todayKey = toDateKey(new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: {
    dayNumber: number;
    isCurrentMonth: boolean;
    date: Date;
    key: string;
  }[] = [];

  // Empty padding days before day 1
  for (let i = 0; i < firstDayIndex; i++) {
    days.push({
      dayNumber: 0,
      isCurrentMonth: false,
      date: new Date(year, month, 0),
      key: `prev-${year}-${month}-${i}`,
    });
  }

  // Days in this month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: true,
      date,
      key: toDateKey(date),
    });
  }

  return (
    <Animated.View style={[styles.outerContainer, { height: animatedHeight }]}>
      <View style={styles.monthCard}>
        {/* Weekday Labels Header */}
        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map((w, index) => (
            <View key={index} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{w}</Text>
            </View>
          ))}
        </View>

        {/* Days Grid */}
        <View style={styles.daysGrid}>
          {days.map((item, index) => {
            if (!item.isCurrentMonth) {
              return <View key={item.key || index} style={styles.dayCell} />;
            }

            const dayData = expensesByDay.get(item.key);
            const isSelected = selectedKey === item.key;
            const isToday = todayKey === item.key;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                  }
                  onSelectDate(item.date);
                }}
              >
                <Text
                  style={[
                    styles.dayNumberText,
                    isSelected && styles.dayNumberTextSelected,
                    isToday && !isSelected && styles.dayNumberTextToday,
                  ]}
                >
                  {item.dayNumber}
                </Text>

                {/* Expense Dots Indicator (Retro Dot-Matrix style) */}
                <View style={styles.dotsContainer}>
                  {dayData && (
                    <>
                      {dayData.hasPending && <View style={[styles.dot, styles.dotPending]} />}
                      {dayData.hasPaid && <View style={[styles.dot, styles.dotPaid]} />}
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    outerContainer: {
      marginHorizontal: 20,
      marginBottom: 10,
      width: CALENDAR_WIDTH,
      overflow: 'hidden',
    },
    monthCard: {
      width: CALENDAR_WIDTH,
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
      overflow: 'hidden',
    },
    weekdaysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 6,
    },
    weekdayCell: {
      width: CELL_SIZE,
      alignItems: 'center',
    },
    weekdayText: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 1,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: CELL_SIZE,
      height: CELL_SIZE + 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: BORDER_RADIUS.sm,
      marginVertical: 2,
    },
    dayCellSelected: {
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dayCellToday: {
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayNumberText: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 14,
      color: colors.text,
    },
    dayNumberTextSelected: {
      color: colors.primary,
      fontWeight: 'bold',
    },
    dayNumberTextToday: {
      color: colors.text,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: 6,
      marginTop: 3,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: BORDER_RADIUS.full,
    },
    dotPending: {
      backgroundColor: colors.primary,
    },
    dotPaid: {
      backgroundColor: colors.success,
    },
  });
}
