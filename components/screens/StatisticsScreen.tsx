import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import {
    Dimensions,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useExpenses } from '../../contexts/ExpensesContext';
import { COLORS, FONTS } from '../../theme';

const { height } = Dimensions.get('window');

interface StatisticsScreenProps {
  onClose: () => void;
}

export default function StatisticsScreen({ onClose }: StatisticsScreenProps) {
  const { expenses } = useExpenses();

  const stats = useMemo(() => {
    const total = expenses.reduce((acc, e) => acc + e.amount, 0);
    const paid = expenses.filter(e => e.paid).reduce((acc, e) => acc + e.amount, 0);
    const pending = total - paid;
    
    // Group by person
    const byPerson: { [key: string]: { total: number; pending: number; count: number } } = {};
    expenses.forEach(expense => {
      if (!byPerson[expense.person]) {
        byPerson[expense.person] = { total: 0, pending: 0, count: 0 };
      }
      byPerson[expense.person].total += expense.amount;
      byPerson[expense.person].count += 1;
      if (!expense.paid) {
        byPerson[expense.person].pending += expense.amount;
      }
    });

    // Group by tag
    const byTag: { [key: string]: { total: number; count: number } } = {};
    expenses.forEach(expense => {
      expense.tags.forEach(tag => {
        if (!byTag[tag]) {
          byTag[tag] = { total: 0, count: 0 };
        }
        byTag[tag].total += expense.amount;
        byTag[tag].count += 1;
      });
    });

    // Monthly trend
    const byMonth: { [key: string]: number } = {};
    expenses.forEach(expense => {
      const monthKey = expense.date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
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
        .map(([month, total]) => ({ month, total }))
        .reverse()
        .slice(0, 6),
      averageExpense: total / (expenses.length || 1),
    };
  }, [expenses]);

  const getPercentage = (value: number, total: number) => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundGradientStart} />
      
      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={styles.gradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistics</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Overview Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.cardsRow}>
            <View style={[styles.statCard, styles.cardPrimary]}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>${stats.total.toFixed(2)}</Text>
              <Text style={styles.statSubtext}>{stats.count} expenses</Text>
            </View>
            <View style={[styles.statCard, styles.cardGreen]}>
              <Text style={styles.statLabel}>Paid</Text>
              <Text style={styles.statValue}>${stats.paid.toFixed(2)}</Text>
              <Text style={styles.statSubtext}>{getPercentage(stats.paid, stats.total)}%</Text>
            </View>
          </View>
          <View style={styles.cardsRow}>
            <View style={[styles.statCard, styles.cardOrange]}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>${stats.pending.toFixed(2)}</Text>
              <Text style={styles.statSubtext}>{getPercentage(stats.pending, stats.total)}%</Text>
            </View>
            <View style={[styles.statCard, styles.cardBlue]}>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue}>${stats.averageExpense.toFixed(2)}</Text>
              <Text style={styles.statSubtext}>per expense</Text>
            </View>
          </View>
        </View>

        {/* By Person */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Person</Text>
          {stats.byPerson.length === 0 ? (
            <Text style={styles.emptyText}>No data yet</Text>
          ) : (
            stats.byPerson.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemSubtext}>
                    {item.count} expense{item.count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemTotal}>${item.total.toFixed(2)}</Text>
                  {item.pending > 0 && (
                    <Text style={styles.listItemPending}>
                      ${item.pending.toFixed(2)} pending
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* By Tag */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Category</Text>
          {stats.byTag.length === 0 ? (
            <Text style={styles.emptyText}>No tags used yet</Text>
          ) : (
            stats.byTag.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>{item.name}</Text>
                  </View>
                  <Text style={styles.listItemSubtext}>
                    {item.count} expense{item.count !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.listItemRight}>
                  <Text style={styles.listItemTotal}>${item.total.toFixed(2)}</Text>
                  <Text style={styles.listItemPercent}>
                    {getPercentage(item.total, stats.total)}%
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Monthly Trend */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 6 Months</Text>
          {stats.byMonth.length === 0 ? (
            <Text style={styles.emptyText}>No data yet</Text>
          ) : (
            stats.byMonth.map((item, index) => (
              <View key={index} style={styles.trendItem}>
                <Text style={styles.trendMonth}>{item.month}</Text>
                <View style={styles.trendBarContainer}>
                  <View 
                    style={[
                      styles.trendBar,
                      { width: `${getPercentage(item.total, stats.byMonth[0].total)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.trendValue}>${item.total.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: FONTS.system,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.system,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardPrimary: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.primary,
  },
  cardGreen: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.success,
  },
  cardOrange: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.warning,
  },
  cardBlue: {
    backgroundColor: COLORS.cardBackground,
    borderColor: '#2196f3',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontFamily: FONTS.system,
  },
  statValue: {
    fontSize: 20,
    fontFamily: FONTS.system,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontFamily: FONTS.system,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  listItemSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listItemTotal: {
    fontSize: 16,
    fontFamily: FONTS.system,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  listItemPending: {
    fontSize: 12,
    color: COLORS.warning,
    fontFamily: FONTS.system,
  },
  listItemPercent: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
  },
  tagBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  tagBadgeText: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONTS.system,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontFamily: FONTS.system,
    textAlign: 'center',
    paddingVertical: 20,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  trendMonth: {
    fontSize: 13,
    fontFamily: FONTS.system,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 70,
  },
  trendBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trendBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 2,
  },
  trendValue: {
    fontSize: 13,
    fontFamily: FONTS.system,
    fontWeight: 'bold',
    color: COLORS.text,
    width: 70,
    textAlign: 'right',
  },
});