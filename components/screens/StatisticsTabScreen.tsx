import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  DimensionValue,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useExpenses } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import { formatCurrency } from '../../utils/formatters';

export interface StatisticsTabScreenProps {
  onScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void;
}

export default function StatisticsTabScreen({ onScroll }: StatisticsTabScreenProps = {}) {
  const { expenses } = useExpenses();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const stats = useMemo(() => {
    const total = expenses.reduce((acc, e) => acc + e.amount, 0);
    const paid = expenses.filter((e) => e.paid).reduce((acc, e) => acc + e.amount, 0);
    const pending = total - paid;

    // Group by person
    const byPerson: { [key: string]: { total: number; pending: number; count: number } } = {};
    expenses.forEach((expense) => {
      const personKey = expense.person || 'General';
      if (!byPerson[personKey]) {
        byPerson[personKey] = { total: 0, pending: 0, count: 0 };
      }
      byPerson[personKey].total += expense.amount;
      byPerson[personKey].count += 1;
      if (!expense.paid) {
        byPerson[personKey].pending += expense.amount;
      }
    });

    // Group by tag
    const byTag: { [key: string]: { total: number; count: number } } = {};
    expenses.forEach((expense) => {
      const tagsToCount = expense.tags.length > 0 ? expense.tags : ['Other'];
      tagsToCount.forEach((tag) => {
        if (!byTag[tag]) {
          byTag[tag] = { total: 0, count: 0 };
        }
        byTag[tag].total += expense.amount;
        byTag[tag].count += 1;
      });
    });

    // Monthly trend
    const byMonth: { [key: string]: number } = {};
    expenses.forEach((expense) => {
      const monthKey = expense.date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      });
      byMonth[monthKey] = (byMonth[monthKey] || 0) + expense.amount;
    });

    return {
      total,
      paid,
      pending,
      count: expenses.length,
      byPerson: Object.entries(byPerson)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      byTag: Object.entries(byTag)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total),
      byMonth: Object.entries(byMonth)
        .map(([month, totalVal]) => ({ month, total: totalVal }))
        .reverse()
        .slice(0, 6),
      averageExpense: total / (expenses.length || 1),
    };
  }, [expenses]);

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  };

  const highestMonthTotal = stats.byMonth.reduce((max, item) => Math.max(max, item.total), 0) || 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Empty State */}
        {expenses.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>NO DATA AVAILABLE</Text>
            <Text style={styles.emptySubtext}>Add expenses to see your statistics breakdown</Text>
          </View>
        )}

        {/* Overview Grid */}
        {expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OVERVIEW</Text>
            <View style={styles.cardsRow}>
              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>Total Recorded</Text>
                </View>
                <Text style={styles.statValue}>{formatCurrency(stats.total)}</Text>
                <Text style={styles.statSubtext}>
                  {stats.count} {stats.count === 1 ? 'expense' : 'expenses'}
                </Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>Total Paid</Text>
                  <View style={[styles.statusDot, styles.statusDotPaid]} />
                </View>
                <Text style={styles.statValue}>
                  {formatCurrency(stats.paid)}
                </Text>
                <Text style={styles.statSubtext}>{getPercentage(stats.paid, stats.total)}% of total</Text>
              </View>
            </View>

            <View style={styles.cardsRow}>
              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>Pending</Text>
                  <View style={[styles.statusDot, styles.statusDotPending]} />
                </View>
                <Text style={styles.statValue}>
                  {formatCurrency(stats.pending)}
                </Text>
                <Text style={styles.statSubtext}>{getPercentage(stats.pending, stats.total)}% of total</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Text style={styles.statLabel}>Average per Entry</Text>
                </View>
                <Text style={styles.statValue}>{formatCurrency(stats.averageExpense)}</Text>
                <Text style={styles.statSubtext}>per expense</Text>
              </View>
            </View>
          </View>
        )}

        {/* Breakdown by Person */}
        {stats.byPerson.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BY PERSON</Text>
            {stats.byPerson.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemSubtext}>
                    {item.count} {item.count === 1 ? 'expense' : 'expenses'}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemTotal}>{formatCurrency(item.total)}</Text>
                  {item.pending > 0 && (
                    <View style={styles.pendingBadgeRow}>
                      <View style={[styles.statusDotMini, { backgroundColor: colors.primary }]} />
                      <Text style={styles.listItemPending}>
                        {formatCurrency(item.pending)} pending
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Breakdown by Category / Tag */}
        {stats.byTag.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BY CATEGORY</Text>
            {stats.byTag.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>{item.name}</Text>
                  </View>
                  <Text style={styles.listItemSubtext}>
                    {item.count} {item.count === 1 ? 'expense' : 'expenses'}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemTotal}>{formatCurrency(item.total)}</Text>
                  <Text style={styles.listItemPercent}>
                    {getPercentage(item.total, stats.total)}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Monthly Trend */}
        {stats.byMonth.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RECENT MONTHS</Text>
            {stats.byMonth.map((item, index) => {
              const barWidth = `${Math.max(5, (item.total / highestMonthTotal) * 100)}%` as DimensionValue;
              return (
                <View key={index} style={styles.trendItem}>
                  <Text style={styles.trendMonth}>{item.month.toUpperCase()}</Text>
                  <View style={styles.trendBarContainer}>
                    <View style={[styles.trendBar, { width: barWidth }]} />
                  </View>
                  <Text style={styles.trendValue}>{formatCurrency(item.total)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 140,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
    },
    emptyTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 13,
      color: colors.textSecondary,
      letterSpacing: 1,
      marginTop: 16,
      marginBottom: 6,
    },
    emptySubtext: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 1,
      marginBottom: 12,
    },
    cardsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    statLabel: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 0.5,
      borderColor: colors.borderLight,
    },
    statusDotPaid: {
      backgroundColor: colors.success,
    },
    statusDotPending: {
      backgroundColor: colors.primary,
    },
    statValue: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 16,
      color: colors.text,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    statSubtext: {
      fontFamily: FONTS.regular,
      fontSize: 10,
      color: colors.textSecondary,
    },
    listItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    listItemLeft: {
      flex: 1,
    },
    listItemName: {
      fontFamily: FONTS.medium,
      fontSize: 15,
      color: colors.text,
      marginBottom: 2,
    },
    listItemSubtext: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    listItemRight: {
      alignItems: 'flex-end',
    },
    listItemTotal: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 14,
      color: colors.text,
      marginBottom: 2,
    },
    pendingBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
    },
    statusDotMini: {
      width: 6,
      height: 6,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 0.5,
      borderColor: colors.borderLight,
    },
    listItemPending: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    listItemPercent: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    tagBadge: {
      backgroundColor: colors.cardBackgroundLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.xs,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    tagBadgeText: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.text,
    },
    trendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      gap: 8,
    },
    trendMonth: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 11,
      color: colors.textSecondary,
      width: 60,
    },
    trendBarContainer: {
      flex: 1,
      height: 18,
      backgroundColor: colors.cardBackgroundLight,
      borderRadius: BORDER_RADIUS.full,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    trendBar: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: BORDER_RADIUS.full,
    },
    trendValue: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 11,
      color: colors.text,
      width: 80,
      textAlign: 'right',
    },
  });
}
