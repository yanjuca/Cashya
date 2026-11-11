import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCards } from '../../contexts/CardsContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { BORDER_RADIUS, FONTS, ThemeColors } from '../../theme';
import { Expense } from '../../types';
import { formatCurrency, formatMonthYear } from '../../utils/formatters';
import BottomSheetModal from '../ui/BottomSheetModal';

interface TransactionDetailsModalProps {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
  onEdit?: (expense: Expense) => void;
}

interface InferredInsight {
  category: string;
  iconName: keyof typeof Ionicons.glyphMap;
  explanation: string;
}

function inferCategoryAndInsight(description: string, tags: string[]): InferredInsight {
  const text = `${description} ${tags.join(' ')}`.toLowerCase();

  if (
    /mercado|supermercado|feir|hortifruti|a[çc]ougue|padaria|carrefour|p[ãa]o de a[çc][uú]car|extra|dia|assa[íi]|atacad|mercearia|grocery|market|bakery|butcher/.test(
      text
    )
  ) {
    return {
      category: 'Supermarket & Groceries',
      iconName: 'cart-outline',
      explanation:
        'Regular household supplies or purchases at supermarkets and grocery stores.',
    };
  }

  if (
    /ifood|rappi|restaurante|lanche|burger|hamburg|pizza|caf[ée]|coffee|bar|delivery|almo[çc]o|jantar|mcdonald|bk|burger king|outback|starbucks|churrasc|sushi|comida|food|dining/.test(
      text
    )
  ) {
    return {
      category: 'Dining & Delivery',
      iconName: 'restaurant-outline',
      explanation:
        'Dining out, quick meals, coffee, or food delivery orders.',
    };
  }

  if (
    /uber|99|t[áa]xi|taxi|posto|gasolina|combust[íi]vel|etanol|diesel|ped[áa]gio|estacionamento|sem parar|veloe|bilhete|metr[ôo]|onibus|[ôo]nibus|passagem|voo|a[ée]reo|fuel|gas|toll|transit|flight/.test(
      text
    )
  ) {
    return {
      category: 'Transport & Mobility',
      iconName: 'car-outline',
      explanation:
        'Urban mobility costs, ride-sharing, fuel, tolls, or public transit.',
    };
  }

  if (
    /netflix|spotify|prime|disney|hbo|max|apple|youtube|deezer|globoplay|paramount|steam|playstation|psn|xbox|assinatura|subscription/.test(
      text
    )
  ) {
    return {
      category: 'Streaming & Subscriptions',
      iconName: 'play-circle-outline',
      explanation:
        'Recurring charges for digital entertainment, streaming services, or gaming.',
    };
  }

  if (
    /amazon|mercado livre|shopee|aliexpress|shein|magalu|magazine|loja|shopping|roupa|vestu[áa]rio|zara|renner|riachuelo|c&a|compra|retail|clothes|store/.test(
      text
    )
  ) {
    return {
      category: 'Shopping & Retail',
      iconName: 'bag-handle-outline',
      explanation:
        'In-store or online retail shopping for personal goods and clothing.',
    };
  }

  if (
    /farm[áa]cia|drogaria|drogasil|raia|rem[ée]dio|medicamento|m[ée]dico|consulta|hospital|laborat[óo]rio|exame|sa[úu]de|dentista|odonto|academia|gym|smart fit|health|fitness|wellness|doctor|pharmacy/.test(
      text
    )
  ) {
    return {
      category: 'Health & Wellness',
      iconName: 'medical-outline',
      explanation:
        'Expenses on pharmacy, healthcare, personal care, medical visits, or fitness.',
    };
  }

  if (
    /luz|água|agua|energia|enel|sabesp|cpfl|internet|claro|vivo|tim|g[áa]s|aluguel|condom[íi]nio|iptu|boleto|fatura|reparo|manuten[çc][ãa]o|utility|rent|bills|maintenance/.test(
      text
    )
  ) {
    return {
      category: 'Housing & Utilities',
      iconName: 'flash-outline',
      explanation:
        'Essential bills, household consumption, or recurring utility expenses.',
    };
  }

  if (/pix|ted|doc|transfer[êe]ncia|pagamento|dep[óo]sito|saque|iof|tarifa|transfer|wire|deposit|bank/.test(text)) {
    return {
      category: 'Transfers & Finance',
      iconName: 'swap-horizontal-outline',
      explanation:
        'Direct bank transactions, transfers between accounts, or bank fees.',
    };
  }

  if (tags.length > 0) {
    return {
      category: `#${tags[0].toUpperCase()}`,
      iconName: 'pricetag-outline',
      explanation:
        'Financial activity categorized based on attached tags.',
    };
  }

  return {
    category: 'General Expense',
    iconName: 'receipt-outline',
    explanation:
      'General financial record for expense tracking and monitoring.',
  };
}

export default function TransactionDetailsModal({
  visible,
  expense,
  onClose,
  onEdit,
}: TransactionDetailsModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { expenses, togglePaid } = useExpenses();
  const { cards } = useCards();

  const lastExpenseRef = useRef<Expense | null>(expense);
  if (expense) {
    lastExpenseRef.current = expense;
  }
  const activeExpense = expense || lastExpenseRef.current;

  const linkedCard = useMemo(() => {
    if (!activeExpense?.cardId) return null;
    return cards.find((c) => c.id === activeExpense.cardId) || null;
  }, [cards, activeExpense?.cardId]);

  const insight = useMemo(() => {
    if (!activeExpense) return null;
    return inferCategoryAndInsight(activeExpense.description, activeExpense.tags || []);
  }, [activeExpense]);

  const stats = useMemo(() => {
    if (!activeExpense) return null;

    const monthExpenses = expenses.filter(
      (e) =>
        e.date.getMonth() === activeExpense.date.getMonth() &&
        e.date.getFullYear() === activeExpense.date.getFullYear()
    );
    const monthTotal = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
    const monthPercentage =
      monthTotal > 0 ? Math.min(100, (activeExpense.amount / monthTotal) * 100) : 0;

    const cardLimitShare =
      linkedCard && linkedCard.limit > 0
        ? Math.min(100, (activeExpense.amount / linkedCard.limit) * 100)
        : null;

    const vendorOccurrences = expenses.filter(
      (e) => e.description.toLowerCase().trim() === activeExpense.description.toLowerCase().trim()
    ).length;

    return {
      monthTotal,
      monthPercentage,
      cardLimitShare,
      vendorOccurrences,
    };
  }, [activeExpense, expenses, linkedCard]);

  const dotScaleAnim = useRef(new Animated.Value(1)).current;
  const haloScaleAnim = useRef(new Animated.Value(1)).current;
  const haloOpacityAnim = useRef(new Animated.Value(0)).current;
  const pillScaleAnim = useRef(new Animated.Value(1)).current;
  const isBusyRef = useRef(false);

  useEffect(() => {
    dotScaleAnim.stopAnimation();
    haloScaleAnim.stopAnimation();
    haloOpacityAnim.stopAnimation();
    pillScaleAnim.stopAnimation();
    dotScaleAnim.setValue(1);
    haloScaleAnim.setValue(1);
    haloOpacityAnim.setValue(0);
    pillScaleAnim.setValue(1);
    isBusyRef.current = false;
  }, [visible, activeExpense?.id, dotScaleAnim, haloScaleAnim, haloOpacityAnim, pillScaleAnim]);

  const handleTogglePaidStatus = async () => {
    if (!activeExpense || isBusyRef.current) return;
    isBusyRef.current = true;
    const willBePaid = !activeExpense.paid;
    if (Platform.OS !== 'web') {
      try {
        if (willBePaid) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.selectionAsync();
        }
      } catch {
      }
    }

    dotScaleAnim.setValue(1);
    haloScaleAnim.setValue(1);
    haloOpacityAnim.setValue(0.85);

    const popAnimation = Animated.parallel([
      Animated.sequence([
        Animated.timing(pillScaleAnim, {
          toValue: 0.94,
          duration: 90,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(pillScaleAnim, {
          toValue: 1,
          tension: 75,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(dotScaleAnim, {
          toValue: 1.5,
          tension: 85,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(dotScaleAnim, {
          toValue: 1,
          tension: 70,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(haloScaleAnim, {
        toValue: 2.8,
        duration: 380,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(haloOpacityAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]);

    const animationDone = new Promise<void>((resolve) => {
      popAnimation.start(() => resolve());
    });
    const maxWait = new Promise<void>((resolve) => setTimeout(resolve, 450));

    try {
      await Promise.all([togglePaid(activeExpense.id), Promise.race([animationDone, maxWait])]);
    } finally {
      isBusyRef.current = false;
      onClose();
    }
  };

  if (!activeExpense) {
    return (
      <BottomSheetModal
        visible={false}
        onClose={onClose}
      >
        <View />
      </BottomSheetModal>
    );
  }

  const isRecurring = !!activeExpense.recurring || !!activeExpense.recurringSourceId;

  const formattedDate = activeExpense.date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const formattedShortDate = activeExpense.date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <BottomSheetModal
      visible={visible && !!expense}
      onClose={onClose}
      customHeader={
        <View style={styles.headerRow}>
          <View style={styles.headerTagWrapper}>
            <View style={styles.headerDot} />
            <Text style={styles.headerTitle}>TRANSACTION DETAILS</Text>
          </View>

          <View style={styles.headerActions}>
            {onEdit && (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onEdit(activeExpense);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="pencil-outline" size={19} color="#ffffff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      }
    >
            <View style={styles.heroSection}>
              <Text style={styles.heroAmount}>{formatCurrency(activeExpense.amount)}</Text>
              <Text style={styles.heroDescription}>{activeExpense.description}</Text>

              <View style={styles.heroPillRow}>
                <Animated.View style={{ transform: [{ scale: pillScaleAnim }] }}>
                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      activeExpense.paid ? styles.statusPillPaid : styles.statusPillPending,
                    ]}
                    onPress={handleTogglePaidStatus}
                    activeOpacity={0.85}
                  >
                    <View style={styles.dotContainer}>
                      <Animated.View
                        style={[
                          styles.statusHalo,
                          {
                            backgroundColor: activeExpense.paid ? colors.success : colors.primary,
                            opacity: haloOpacityAnim,
                            transform: [{ scale: haloScaleAnim }],
                          },
                        ]}
                      />
                      <Animated.View
                        style={[
                          styles.statusDot,
                          activeExpense.paid ? styles.statusDotPaid : styles.statusDotPending,
                          { transform: [{ scale: dotScaleAnim }] },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.statusPillText,
                        activeExpense.paid ? styles.statusPillTextPaid : styles.statusPillTextPending,
                      ]}
                    >
                      {activeExpense.paid ? 'PAID' : 'PENDING'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <View style={styles.datePill}>
                  <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.datePillText}>{formattedShortDate}</Text>
                </View>

                {isRecurring && (
                  <View style={styles.datePill}>
                    <Ionicons name="repeat" size={12} color={colors.primary} />
                    <Text style={styles.datePillText}>Monthly</Text>
                  </View>
                )}
              </View>
            </View>

            {insight && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeaderRow}>
                  <View style={styles.insightTitleContainer}>
                    <Ionicons name={insight.iconName} size={15} color={colors.primary} />
                    <Text style={styles.insightTitle}>FURTHER INSIGHTS</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{insight.category}</Text>
                  </View>
                </View>

                <Text style={styles.insightExplanation}>{insight.explanation}</Text>

                <View style={styles.insightDivider} />

                <View style={styles.insightMetricsRow}>
                  {stats && (
                    <View style={styles.insightMetricItem}>
                      <Text style={styles.insightMetricLabel}>MONTH SHARE</Text>
                      <Text style={styles.insightMetricValue}>
                        {stats.monthPercentage.toFixed(1)}%
                      </Text>
                      <Text style={styles.insightMetricSub}>
                        of {formatCurrency(stats.monthTotal)}
                      </Text>
                    </View>
                  )}

                  {stats && stats.cardLimitShare !== null && (
                    <View style={styles.insightMetricItem}>
                      <Text style={styles.insightMetricLabel}>LIMIT USAGE</Text>
                      <Text style={styles.insightMetricValue}>
                        {stats.cardLimitShare.toFixed(1)}%
                      </Text>
                      <Text style={styles.insightMetricSub}>
                        {linkedCard ? `${linkedCard.brand.toUpperCase()}` : 'Card'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.insightMetricItem}>
                    <Text style={styles.insightMetricLabel}>HISTORY</Text>
                    <Text style={styles.insightMetricValue}>
                      {stats?.vendorOccurrences === 1 ? '1x' : `${stats?.vendorOccurrences}x`}
                    </Text>
                    <Text style={styles.insightMetricSub}>
                      {stats?.vendorOccurrences === 1 ? 'First time' : 'Records'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.specsCard}>
              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.specLabel}>RESPONSIBLE</Text>
                </View>
                <Text style={styles.specValue}>{activeExpense.person || 'General'}</Text>
              </View>

              <View style={styles.specDivider} />

              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.specLabel}>FULL DATE</Text>
                </View>
                <Text style={styles.specValueCap}>{formattedDate}</Text>
              </View>

              <View style={styles.specDivider} />

              {isRecurring && (
                <>
                  <View style={styles.specRow}>
                    <View style={styles.specLeft}>
                      <Ionicons name="repeat" size={15} color={colors.textSecondary} />
                      <Text style={styles.specLabel}>RECURRING</Text>
                    </View>
                    <Text style={styles.specValue}>
                      {`Every month, day ${activeExpense.date.getDate()}${
                        activeExpense.recurringMonths
                          ? ` · ${activeExpense.recurringMonths} ${activeExpense.recurringMonths === 1 ? 'month' : 'months'}`
                          : ''
                      }`}
                    </Text>
                  </View>

                  <View style={styles.specDivider} />
                </>
              )}

              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="card-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.specLabel}>METHOD / CARD</Text>
                </View>
                <Text style={styles.specValue}>
                  {linkedCard
                    ? `${linkedCard.brand.toUpperCase()} •••• ${linkedCard.lastDigits}`
                    : 'Cash / Other'}
                </Text>
              </View>

              <View style={styles.specDivider} />

              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="hardware-chip-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.specLabel}>RECORD SOURCE</Text>
                </View>
                <Text style={styles.specValue}>
                  {activeExpense.source
                    ? activeExpense.source.toUpperCase()
                    : 'MANUAL'}
                </Text>
              </View>
            </View>

            {activeExpense.tags && activeExpense.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsSectionTitle}>ATTACHED TAGS</Text>
                <View style={styles.tagsWrapper}>
                  {activeExpense.tags.map((tag, idx) => (
                    <View key={idx} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.actionBtn,
                activeExpense.paid ? styles.actionBtnSecondary : styles.actionBtnPrimary,
              ]}
              onPress={handleTogglePaidStatus}
              activeOpacity={0.8}
            >
              <Ionicons
                name={activeExpense.paid ? 'refresh-outline' : 'checkmark-circle-outline'}
                size={18}
                color={activeExpense.paid ? colors.primary : colors.primaryText}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  activeExpense.paid && styles.actionBtnTextSecondary,
                ]}
              >
                {activeExpense.paid ? 'MARK AS UNPAID' : 'MARK AS PAID'}
              </Text>
            </TouchableOpacity>
    </BottomSheetModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    headerTagWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    headerTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 12,
      color: colors.textSecondary,
      letterSpacing: 1.2,
    },
    scrollContent: {
      paddingHorizontal: 0,
      paddingBottom: 20,
    },
    heroSection: {
      alignItems: 'flex-start',
      paddingVertical: 10,
    },
    heroAmount: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 34,
      color: colors.text,
      letterSpacing: 0.5,
    },
    heroDescription: {
      fontFamily: FONTS.medium,
      fontSize: 18,
      color: colors.text,
      marginTop: 6,
      lineHeight: 24,
    },
    heroPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    statusPillPaid: {
      backgroundColor: 'rgba(48, 209, 88, 0.12)',
      borderColor: colors.success,
    },
    statusPillPending: {
      backgroundColor: colors.primaryMuted,
      borderColor: colors.primary,
    },
    dotContainer: {
      width: 14,
      height: 14,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    statusHalo: {
      position: 'absolute',
      width: 12,
      height: 12,
      borderRadius: BORDER_RADIUS.full,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: BORDER_RADIUS.full,
    },
    statusDotPaid: {
      backgroundColor: colors.success,
    },
    statusDotPending: {
      backgroundColor: colors.primary,
    },
    statusPillText: {
      fontFamily: FONTS.ndotCaps || FONTS.bold,
      fontSize: 11,
      letterSpacing: 0.8,
    },
    statusPillTextPaid: {
      color: colors.success,
    },
    statusPillTextPending: {
      color: colors.primary,
    },
    datePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.cardBackgroundLight,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    datePillText: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    insightCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginTop: 14,
    },
    insightHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    insightTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    insightTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 11,
      color: colors.primary,
      letterSpacing: 1,
    },
    categoryBadge: {
      backgroundColor: colors.primaryMuted,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.xs,
    },
    categoryBadgeText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.primary,
    },
    insightExplanation: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
      marginTop: 10,
    },
    insightDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    insightMetricsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    insightMetricItem: {
      flex: 1,
    },
    insightMetricLabel: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 9,
      color: colors.textSecondary,
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    insightMetricValue: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 16,
      color: colors.text,
      letterSpacing: 0.5,
    },
    insightMetricSub: {
      fontFamily: FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    specsCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 12,
      paddingVertical: 4,
      paddingHorizontal: 16,
    },
    specRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    specLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    specLabel: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 0.8,
    },
    specValue: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.text,
    },
    specValueCap: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    specDivider: {
      height: 1,
      backgroundColor: colors.border,
    },
    tagsSection: {
      marginTop: 14,
    },
    tagsSectionTitle: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    tagsWrapper: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tagBadge: {
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.xs,
    },
    tagBadgeText: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: BORDER_RADIUS.md,
      paddingVertical: 14,
      marginTop: 20,
    },
    actionBtnPrimary: {
      backgroundColor: colors.primary,
    },
    actionBtnSecondary: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionBtnText: {
      fontFamily: FONTS.bold,
      fontSize: 13,
      color: colors.primaryText,
      letterSpacing: 0.5,
    },
    actionBtnTextSecondary: {
      color: colors.primary,
    },
  });
}