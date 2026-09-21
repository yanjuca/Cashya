import * as Haptics from 'expo-haptics';
import React, { useMemo, useRef } from 'react';
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Expense } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { toDateKey } from '../../utils/formatters';

interface CalendarViewProps {
  currentMonth: Date;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  expenses: Expense[];
  onSwipeMonthLeft?: () => void;
  onSwipeMonthRight?: () => void;
  onGestureActive?: (active: boolean) => void;
}

const { width } = Dimensions.get('window');
const CELL_SIZE = Math.floor((width - 40) / 7);

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function CalendarView({
  currentMonth,
  selectedDate,
  onSelectDate,
  expenses,
  onSwipeMonthLeft,
  onSwipeMonthRight,
  onGestureActive,
}: CalendarViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Trigger capture when user drags horizontally on the calendar
        const isHorizontal = Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isHorizontal;
      },
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isHorizontal;
      },
      onPanResponderGrant: () => {
        onGestureActive?.(true);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        onGestureActive?.(false);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        onGestureActive?.(false);
        if (gestureState.dx > 35) {
          // Swiped right -> go to previous month
          if (Platform.OS !== 'web') {
            try {
              Haptics.selectionAsync();
            } catch {
              // Ignore
            }
          }
          onSwipeMonthRight?.();
        } else if (gestureState.dx < -35) {
          // Swiped left -> go to next month
          if (Platform.OS !== 'web') {
            try {
              Haptics.selectionAsync();
            } catch {
              // Ignore
            }
          }
          onSwipeMonthLeft?.();
        }
      },
    })
  ).current;

  // Map expenses by day string 'YYYY-MM-DD'
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

  // Generate calendar grid matrix
  const calendarDays = useMemo(() => {
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
        key: `prev-${i}`,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        date,
        key: toDateKey(date),
      });
    }

    return days;
  }, [year, month]);

  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;
  const todayKey = toDateKey(new Date());

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
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
        {calendarDays.map((item, index) => {
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
              onPress={() => onSelectDate(item.date)}
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
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  weekdayCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  weekdayText: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 10,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayNumberText: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 14,
    color: COLORS.text,
  },
  dayNumberTextSelected: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  dayNumberTextToday: {
    color: COLORS.text,
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
    backgroundColor: COLORS.error, // Red
  },
  dotPaid: {
    backgroundColor: COLORS.success, // Green
  },
});
