import { CardBrand, CardType, CreditCard, Expense } from '../../types';

/**
 * Conversions between the app's domain objects (types/index.ts) and the cashya-api wire format.
 *
 * - Dates: the app works with `Date`; the API sends/receives ISO 8601 strings in UTC ("2026-09-21T16:00:00.000Z").
 * - Optional fields: the app uses `undefined`; the API uses `null` (and needs an explicit `null` to clear a field).
 * - Card type: the app may still hold the Portuguese labels from older builds; the API only knows Credit/Debit.
 */

// ------------------------------------------------------------------------------------------------------------------
// Wire types (mirror of cashya-api schemas, camelCase)
// ------------------------------------------------------------------------------------------------------------------

export interface ApiExpense {
  id: string;
  userId: string;
  description: string;
  amount: number;
  person: string;
  date: string;
  tags: string[];
  paid: boolean;
  source: 'manual' | 'notification' | 'import';
  cardId: string | null;
  groupId: string | null;
  recurring: boolean;
  recurringMonths: number | null;
  recurringSourceId: string | null;
  skippedMonths: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Body accepted by POST /expenses and PUT /expenses/:id. */
export interface ApiExpenseInput {
  id?: string;
  description: string;
  amount: number;
  person: string;
  date: string;
  tags: string[];
  paid: boolean;
  source: 'manual' | 'notification' | 'import';
  cardId: string | null;
  recurring: boolean;
  recurringMonths: number | null;
  recurringSourceId: string | null;
  skippedMonths: string[];
}

export interface ApiCard {
  id: string;
  holderName: string;
  brand: CardBrand;
  type: CardType;
  lastDigits: string;
  expiryDate: string;
  limit: number;
  colorAccent: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ApiCardInput {
  id?: string;
  holderName: string;
  brand: CardBrand;
  type: CardType;
  lastDigits: string;
  expiryDate: string;
  limit: number;
  colorAccent?: string;
}

// ------------------------------------------------------------------------------------------------------------------
// Dates
// ------------------------------------------------------------------------------------------------------------------

/** ISO string from the API -> Date. Rejects garbage instead of silently producing "Invalid Date". */
export function parseApiDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date received from the API: ${value}`);
  }
  return date;
}

/** Date (or an ISO string already) -> ISO string in UTC, the only format the API reads unambiguously. */
export function toApiDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot send an invalid date to the API');
  }
  return date.toISOString();
}

// ------------------------------------------------------------------------------------------------------------------
// Card type
// ------------------------------------------------------------------------------------------------------------------

const CARD_TYPE_ALIASES: Record<string, CardType> = {
  credit: 'Credit',
  'crédito': 'Credit',
  credito: 'Credit',
  debit: 'Debit',
  'débito': 'Debit',
  debito: 'Debit',
};

/** Accepts any spelling stored by older builds or backups ("Crédito", "debito"...) and returns Credit/Debit. */
export function normalizeCardType(value: unknown): CardType {
  if (typeof value === 'string') {
    const normalized = CARD_TYPE_ALIASES[value.trim().toLowerCase()];
    if (normalized) return normalized;
  }
  return 'Credit';
}

// ------------------------------------------------------------------------------------------------------------------
// Expenses
// ------------------------------------------------------------------------------------------------------------------

export function fromApiExpense(dto: ApiExpense): Expense {
  return {
    id: dto.id,
    description: dto.description,
    amount: Number(dto.amount),
    person: dto.person,
    date: parseApiDate(dto.date),
    tags: dto.tags ?? [],
    paid: dto.paid,
    source: dto.source,
    cardId: dto.cardId ?? undefined,
    recurring: dto.recurring || undefined,
    recurringMonths: dto.recurringMonths ?? undefined,
    recurringSourceId: dto.recurringSourceId ?? undefined,
    skippedMonths: dto.skippedMonths?.length ? [...dto.skippedMonths] : undefined,
  };
}

export function toApiExpense(expense: Expense): ApiExpenseInput {
  return {
    id: expense.id,
    description: expense.description,
    amount: expense.amount,
    person: expense.person,
    date: toApiDate(expense.date),
    tags: expense.tags ?? [],
    paid: expense.paid,
    source: expense.source ?? 'manual',
    cardId: expense.cardId ?? null,
    recurring: !!expense.recurring,
    recurringMonths: expense.recurringMonths ?? null,
    recurringSourceId: expense.recurringSourceId ?? null,
    skippedMonths: expense.skippedMonths ?? [],
  };
}

// Fields the app clears by setting them to `undefined` (e.g. EditExpenseScreen when a series is stopped).
const CLEARABLE_EXPENSE_FIELDS = ['cardId', 'recurring', 'recurringMonths', 'recurringSourceId', 'skippedMonths'] as const;

/**
 * Partial update for PATCH /expenses/:id. Only the keys present in `changes` are sent; a clearable key set to
 * `undefined` becomes `null` so the server actually clears it instead of ignoring it.
 */
export function toApiExpensePatch(changes: Partial<Expense>): Partial<Record<keyof ApiExpenseInput, unknown>> {
  const patch: Partial<Record<keyof ApiExpenseInput, unknown>> = {};
  for (const [key, value] of Object.entries(changes) as [keyof Expense, unknown][]) {
    if (key === 'id') continue;
    if (value === undefined) {
      if ((CLEARABLE_EXPENSE_FIELDS as readonly string[]).includes(key)) patch[key] = null;
      continue;
    }
    patch[key] = key === 'date' ? toApiDate(value as Date) : value;
  }
  return patch;
}

// ------------------------------------------------------------------------------------------------------------------
// Cards
// ------------------------------------------------------------------------------------------------------------------

export function fromApiCard(dto: ApiCard): CreditCard {
  return {
    id: dto.id,
    holderName: dto.holderName,
    brand: dto.brand,
    type: normalizeCardType(dto.type),
    lastDigits: dto.lastDigits,
    expiryDate: dto.expiryDate,
    limit: Number(dto.limit),
    colorAccent: dto.colorAccent,
  };
}

export function toApiCard(card: CreditCard): ApiCardInput {
  return {
    id: card.id,
    holderName: card.holderName,
    brand: card.brand,
    type: normalizeCardType(card.type),
    lastDigits: card.lastDigits,
    expiryDate: card.expiryDate,
    limit: card.limit,
    ...(card.colorAccent ? { colorAccent: card.colorAccent } : {}),
  };
}

export function toApiCardPatch(changes: Partial<CreditCard>): Partial<ApiCardInput> {
  const { id: _id, ...rest } = changes;
  return { ...rest, ...(rest.type !== undefined ? { type: normalizeCardType(rest.type) } : {}) };
}
