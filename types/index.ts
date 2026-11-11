export type CardBrand = 'visa' | 'mastercard' | 'elo' | 'generic';
export type CardType = 'Credit' | 'Debit' | 'Crédito' | 'Débito';

export interface CreditCard {
  id: string;
  holderName: string;
  brand: CardBrand;
  type: CardType;
  lastDigits: string;
  expiryDate: string;
  limit: number;
  colorAccent?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  person: string;
  date: Date;
  tags: string[];
  paid: boolean;
  recurring?: boolean;
  recurringMonths?: number;
  recurringSourceId?: string;
  skippedMonths?: string[];
  source?: 'manual' | 'notification' | 'import';
  cardId?: string;
}

export interface ExpenseFilters {
  searchText?: string;
  person?: string | null;
  tag?: string | null;
  status?: 'all' | 'pending' | 'paid';
}

export interface BackupData {
  version: string;
  exportedAt: string;
  expenses: {
    id: string;
    description: string;
    amount: number;
    person: string;
    date: string;
    tags: string[];
    paid: boolean;
    recurring?: boolean;
    recurringMonths?: number;
    recurringSourceId?: string;
    skippedMonths?: string[];
    source?: 'manual' | 'notification' | 'import';
    cardId?: string;
  }[];
  cards: CreditCard[];
}