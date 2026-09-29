import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useCards } from '../../contexts/CardsContext';
import { useExpenses } from '../../contexts/ExpensesContext';
import { BORDER_RADIUS, COLORS, FONTS } from '../../theme';
import { Expense } from '../../types';
import { formatCurrency, formatMonthYear } from '../../utils/formatters';

interface TransactionDetailsModalProps {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
}

interface InferredInsight {
  category: string;
  iconName: keyof typeof Ionicons.glyphMap;
  explanation: string;
}

function inferCategoryAndInsight(description: string, tags: string[]): InferredInsight {
  const text = `${description} ${tags.join(' ')}`.toLowerCase();

  // Supermarket & Groceries
  if (
    /mercado|supermercado|feir|hortifruti|a[çc]ougue|padaria|carrefour|p[ãa]o de a[çc][uú]car|extra|dia|assa[íi]|atacad|mercearia|grocery|market/.test(
      text
    )
  ) {
    return {
      category: 'Supermercado & Mantimentos',
      iconName: 'cart-outline',
      explanation:
        'Movimentação comum de abastecimento doméstico ou compras em supermercados e feiras.',
    };
  }

  // Dining & Delivery
  if (
    /ifood|rappi|restaurante|lanche|burger|hamburg|pizza|caf[ée]|coffee|bar|delivery|almo[çc]o|jantar|mcdonald|bk|burger king|outback|starbucks|churrasc|sushi|comida/.test(
      text
    )
  ) {
    return {
      category: 'Restaurante & Delivery',
      iconName: 'restaurant-outline',
      explanation:
        'Despesa com alimentação fora de casa, refeições rápidas ou pedidos de delivery.',
    };
  }

  // Transport & Mobility
  if (
    /uber|99|t[áa]xi|taxi|posto|gasolina|combust[íi]vel|etanol|diesel|ped[áa]gio|estacionamento|sem parar|veloe|bilhete|metr[ôo]|onibus|[ôo]nibus|passagem|voo|a[ée]reo/.test(
      text
    )
  ) {
    return {
      category: 'Transporte & Mobilidade',
      iconName: 'car-outline',
      explanation:
        'Custo associado a mobilidade urbana, transporte por aplicativo, combustível ou pedágio.',
    };
  }

  // Streaming & Digital Subscriptions
  if (
    /netflix|spotify|prime|disney|hbo|max|apple|youtube|deezer|globoplay|paramount|steam|playstation|psn|xbox|assinatura|subscription/.test(
      text
    )
  ) {
    return {
      category: 'Streaming & Assinaturas',
      iconName: 'play-circle-outline',
      explanation:
        'Cobrança associada a serviços recorrentes de entretenimento, streaming ou jogos digitais.',
    };
  }

  // Shopping & Retail
  if (
    /amazon|mercado livre|shopee|aliexpress|shein|magalu|magazine|loja|shopping|roupa|vestu[áa]rio|zara|renner|riachuelo|c&a|compra/.test(
      text
    )
  ) {
    return {
      category: 'Compras & Vestuário',
      iconName: 'bag-handle-outline',
      explanation:
        'Compra no comércio presencial ou e-commerce de produtos e itens pessoais.',
    };
  }

  // Health & Wellbeing
  if (
    /farm[áa]cia|drogaria|drogasil|raia|rem[ée]dio|medicamento|m[ée]dico|consulta|hospital|laborat[óo]rio|exame|sa[úu]de|dentista|odonto|academia|gym|smart fit/.test(
      text
    )
  ) {
    return {
      category: 'Saúde & Bem-Estar',
      iconName: 'medical-outline',
      explanation:
        'Gastos com medicamentos, saúde, cuidados pessoais, consultas ou atividades físicas.',
    };
  }

  // Housing & Utilities
  if (
    /luz|água|agua|energia|enel|sabesp|cpfl|internet|claro|vivo|tim|g[áa]s|aluguel|condom[íi]nio|iptu|boleto|fatura|reparo|manuten[çc][ãa]o/.test(
      text
    )
  ) {
    return {
      category: 'Moradia & Contas Essenciais',
      iconName: 'flash-outline',
      explanation:
        'Contas essenciais, consumo doméstico ou despesas fixas de utilidades.',
    };
  }

  // Banking & Transfers
  if (/pix|ted|doc|transfer[êe]ncia|pagamento|dep[óo]sito|saque|iof|tarifa/.test(text)) {
    return {
      category: 'Transferência & Finanças',
      iconName: 'swap-horizontal-outline',
      explanation:
        'Transação bancária direta realizada via Pix, transferência entre contas ou tarifas.',
    };
  }

  // Fallback to tags or generic expense
  if (tags.length > 0) {
    return {
      category: `#${tags[0].toUpperCase()}`,
      iconName: 'pricetag-outline',
      explanation:
        'Movimentação financeira categorizada a partir das etiquetas vinculadas.',
    };
  }

  return {
    category: 'Despesa Geral',
    iconName: 'receipt-outline',
    explanation:
      'Registro financeiro geral para acompanhamento e controle de despesas.',
  };
}

export default function TransactionDetailsModal({
  visible,
  expense,
  onClose,
}: TransactionDetailsModalProps) {
  const { expenses, togglePaid } = useExpenses();
  const { cards } = useCards();

  const linkedCard = useMemo(() => {
    if (!expense?.cardId) return null;
    return cards.find((c) => c.id === expense.cardId) || null;
  }, [cards, expense?.cardId]);

  const insight = useMemo(() => {
    if (!expense) return null;
    return inferCategoryAndInsight(expense.description, expense.tags || []);
  }, [expense]);

  // Statistics for this specific expense
  const stats = useMemo(() => {
    if (!expense) return null;

    // Monthly total
    const monthExpenses = expenses.filter(
      (e) =>
        e.date.getMonth() === expense.date.getMonth() &&
        e.date.getFullYear() === expense.date.getFullYear()
    );
    const monthTotal = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
    const monthPercentage =
      monthTotal > 0 ? Math.min(100, (expense.amount / monthTotal) * 100) : 0;

    // Card limit share
    const cardLimitShare =
      linkedCard && linkedCard.limit > 0
        ? Math.min(100, (expense.amount / linkedCard.limit) * 100)
        : null;

    // Vendor occurrence count
    const vendorOccurrences = expenses.filter(
      (e) => e.description.toLowerCase().trim() === expense.description.toLowerCase().trim()
    ).length;

    return {
      monthTotal,
      monthPercentage,
      cardLimitShare,
      vendorOccurrences,
    };
  }, [expense, expenses, linkedCard]);

  if (!expense) return null;

  const handleTogglePaidStatus = async () => {
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        // Silently ignore
      }
    }
    await togglePaid(expense.id);
  };

  const formattedDate = expense.date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const formattedShortDate = expense.date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Top Sheet Handle */}
          <View style={styles.sheetHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTagWrapper}>
              <View style={styles.headerDot} />
              <Text style={styles.headerTitle}>TRANSACTION DETAILS</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Amount & Status Section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroAmount}>{formatCurrency(expense.amount)}</Text>
              <Text style={styles.heroDescription}>{expense.description}</Text>

              {/* Status and Date Pills */}
              <View style={styles.heroPillRow}>
                <TouchableOpacity
                  style={[
                    styles.statusPill,
                    expense.paid ? styles.statusPillPaid : styles.statusPillPending,
                  ]}
                  onPress={handleTogglePaidStatus}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.statusDot,
                      expense.paid ? styles.statusDotPaid : styles.statusDotPending,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      expense.paid ? styles.statusPillTextPaid : styles.statusPillTextPending,
                    ]}
                  >
                    {expense.paid ? 'PAGO' : 'PENDENTE'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.datePill}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.datePillText}>{formattedShortDate}</Text>
                </View>
              </View>
            </View>

            {/* Further Insights Card (Nothing OS Aesthetic) */}
            {insight && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeaderRow}>
                  <View style={styles.insightTitleContainer}>
                    <Ionicons name={insight.iconName} size={15} color={COLORS.primary} />
                    <Text style={styles.insightTitle}>FURTHER INSIGHTS</Text>
                  </View>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{insight.category}</Text>
                  </View>
                </View>

                <Text style={styles.insightExplanation}>{insight.explanation}</Text>

                <View style={styles.insightDivider} />

                {/* Quantitative Context */}
                <View style={styles.insightMetricsRow}>
                  {stats && (
                    <View style={styles.insightMetricItem}>
                      <Text style={styles.insightMetricLabel}>PESO NO MÊS</Text>
                      <Text style={styles.insightMetricValue}>
                        {stats.monthPercentage.toFixed(1)}%
                      </Text>
                      <Text style={styles.insightMetricSub}>
                        de {formatCurrency(stats.monthTotal)}
                      </Text>
                    </View>
                  )}

                  {stats && stats.cardLimitShare !== null && (
                    <View style={styles.insightMetricItem}>
                      <Text style={styles.insightMetricLabel}>CONSUMO DO LIMITE</Text>
                      <Text style={styles.insightMetricValue}>
                        {stats.cardLimitShare.toFixed(1)}%
                      </Text>
                      <Text style={styles.insightMetricSub}>
                        {linkedCard ? `${linkedCard.brand.toUpperCase()}` : 'Cartão'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.insightMetricItem}>
                    <Text style={styles.insightMetricLabel}>HISTÓRICO</Text>
                    <Text style={styles.insightMetricValue}>
                      {stats?.vendorOccurrences === 1 ? '1x' : `${stats?.vendorOccurrences}x`}
                    </Text>
                    <Text style={styles.insightMetricSub}>
                      {stats?.vendorOccurrences === 1 ? 'Primeira vez' : 'Registros'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Spec Sheet Properties (Nothing OS technical specification styling) */}
            <View style={styles.specsCard}>
              {/* Responsible Person */}
              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="person-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.specLabel}>RESPONSÁVEL</Text>
                </View>
                <Text style={styles.specValue}>{expense.person || 'Geral'}</Text>
              </View>

              <View style={styles.specDivider} />

              {/* Full Date */}
              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.specLabel}>DATA COMPLETA</Text>
                </View>
                <Text style={styles.specValueCap}>{formattedDate}</Text>
              </View>

              <View style={styles.specDivider} />

              {/* Payment Method / Card */}
              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="card-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.specLabel}>MÉTODO / CARTÃO</Text>
                </View>
                <Text style={styles.specValue}>
                  {linkedCard
                    ? `${linkedCard.brand.toUpperCase()} •••• ${linkedCard.lastDigits}`
                    : 'Carteira / Outros'}
                </Text>
              </View>

              <View style={styles.specDivider} />

              {/* Source */}
              <View style={styles.specRow}>
                <View style={styles.specLeft}>
                  <Ionicons name="hardware-chip-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.specLabel}>ORIGEM DO REGISTRO</Text>
                </View>
                <Text style={styles.specValue}>
                  {expense.source
                    ? expense.source.toUpperCase()
                    : 'MANUAL'}
                </Text>
              </View>
            </View>

            {/* Tags Row */}
            {expense.tags && expense.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsSectionTitle}>TAGS ASSOCIADAS</Text>
                <View style={styles.tagsWrapper}>
                  {expense.tags.map((tag, idx) => (
                    <View key={idx} style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Quick Toggle Action Button */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                expense.paid ? styles.actionBtnSecondary : styles.actionBtnPrimary,
              ]}
              onPress={handleTogglePaidStatus}
              activeOpacity={0.8}
            >
              <Ionicons
                name={expense.paid ? 'refresh-outline' : 'checkmark-circle-outline'}
                size={18}
                color={expense.paid ? COLORS.primary : '#ffffff'}
              />
              <Text
                style={[
                  styles.actionBtnText,
                  expense.paid && styles.actionBtnTextSecondary,
                ]}
              >
                {expense.paid ? 'MARCAR COMO PENDENTE' : 'MARCAR COMO PAGO'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121216',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#24242e',
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#33333e',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
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
    backgroundColor: COLORS.primary,
  },
  headerTitle: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: '#2a2a36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  heroAmount: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 34,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  heroDescription: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: '#ffffff',
    marginTop: 6,
    lineHeight: 24,
  },
  heroPillRow: {
    flexDirection: 'row',
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
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    borderColor: COLORS.success,
  },
  statusPillPending: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderColor: COLORS.primary,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  statusDotPaid: {
    backgroundColor: COLORS.success,
  },
  statusDotPending: {
    backgroundColor: COLORS.primary,
  },
  statusPillText: {
    fontFamily: FONTS.ndotCaps || FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  statusPillTextPaid: {
    color: COLORS.success,
  },
  statusPillTextPending: {
    color: COLORS.primary,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#181820',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: '#262632',
  },
  datePillText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  insightCard: {
    backgroundColor: '#16161c',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#262632',
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
    color: COLORS.primary,
    letterSpacing: 1,
  },
  categoryBadge: {
    backgroundColor: '#201518',
    borderWidth: 1,
    borderColor: '#451f24',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
  },
  categoryBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.primary,
  },
  insightExplanation: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#d2d2db',
    lineHeight: 18,
    marginTop: 10,
  },
  insightDivider: {
    height: 1,
    backgroundColor: '#22222c',
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
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  insightMetricValue: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  insightMetricSub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#6c6c78',
    marginTop: 2,
  },
  specsCard: {
    backgroundColor: '#16161c',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#24242e',
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
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  specValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#ffffff',
  },
  specValueCap: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#d0d0d8',
    textTransform: 'capitalize',
  },
  specDivider: {
    height: 1,
    backgroundColor: '#202028',
  },
  tagsSection: {
    marginTop: 14,
  },
  tagsSectionTitle: {
    fontFamily: FONTS.ndotCaps || FONTS.system,
    fontSize: 10,
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: '#2c2c38',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.xs,
  },
  tagBadgeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#a0a0b0',
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
    backgroundColor: COLORS.primary,
  },
  actionBtnSecondary: {
    backgroundColor: '#1e1618',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  actionBtnTextSecondary: {
    color: COLORS.primary,
  },
});
