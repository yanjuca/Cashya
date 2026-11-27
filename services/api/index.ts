import { Platform } from 'react-native';

import { CreditCard, Expense } from '../../types';
import { apiRequest } from './client';
import {
  ApiCard,
  ApiCardInput,
  ApiExpense,
  ApiExpenseInput,
  fromApiCard,
  fromApiExpense,
  toApiCard,
  toApiCardPatch,
  toApiExpense,
  toApiExpensePatch,
} from './mappers';
import { ApiAuthData, ApiUser, authorizedRequest, Session } from './session';

export { API_URL, ApiError } from './client';
export { normalizeCardType, parseApiDate, toApiDate } from './mappers';
export { Session } from './session';
export type { ApiAuthData, ApiUser } from './session';

interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean };
}

export interface ExpenseQuery {
  searchText?: string;
  person?: string;
  tag?: string;
  status?: 'all' | 'pending' | 'paid';
  cardId?: string;
  month?: number;
  year?: number;
  startDate?: Date;
  endDate?: Date;
  /** Delta sync: only expenses changed after this moment. */
  since?: Date;
}

export type SyncMutation =
  | { type: 'CREATE_EXPENSE'; id: string; data: ApiExpenseInput; clientUpdatedAt: string }
  | { type: 'DELETE_EXPENSE'; id: string }
  | { type: 'CREATE_CARD'; id: string; data: ApiCardInput; clientUpdatedAt: string }
  | { type: 'DELETE_CARD'; id: string };

export interface SyncBatchResult {
  syncedAt: string;
  applied: { type: SyncMutation['type']; id: string }[];
  serverChanges: { expenses: ApiExpense[]; cards: ApiCard[] };
  conflicts: { type: SyncMutation['type']; id: string | null; reason: string; server: Record<string, unknown> | null }[];
}

const PAGE_SIZE = 200; // the API's maximum page size
const DEVICE_NAME = `Cashya ${Platform.OS}`;

/** Expenses and cards in the app's own shapes; the envelope, dates, nulls and tokens are handled here. */
export const CashyaApi = {
  auth: {
    async register(data: { name: string; email: string; password: string }): Promise<ApiAuthData> {
      const auth = await apiRequest<ApiAuthData>('/auth/register', { method: 'POST', body: { ...data, deviceName: DEVICE_NAME } });
      await Session.save(auth);
      return auth;
    },

    async login(data: { email: string; password: string }): Promise<ApiAuthData> {
      const auth = await apiRequest<ApiAuthData>('/auth/login', { method: 'POST', body: { ...data, deviceName: DEVICE_NAME } });
      await Session.save(auth);
      return auth;
    },

    /** Revokes this device's refresh token on the server (best effort) and always forgets the local tokens. */
    async logout(): Promise<void> {
      try {
        const refreshToken = await Session.getRefreshToken();
        if (refreshToken) await authorizedRequest('/auth/logout', { method: 'POST', body: { refreshToken } });
      } catch {
        // Offline or already expired: the token simply expires on the server.
      } finally {
        await Session.clear();
      }
    },

    me(): Promise<ApiUser> {
      return authorizedRequest<ApiUser>('/users/me');
    },

    /** Always succeeds for a valid e-mail (the server does not reveal whether the account exists). */
    async requestPasswordReset(email: string): Promise<void> {
      await apiRequest('/auth/password-reset/request', { method: 'POST', body: { email } });
    },

    async confirmPasswordReset(data: { email: string; code: string; newPassword: string }): Promise<void> {
      await apiRequest('/auth/password-reset/confirm', { method: 'POST', body: data });
    },
  },

  sync: {
    batch(lastSyncTimestamp: string | null, mutations: SyncMutation[]): Promise<SyncBatchResult> {
      return authorizedRequest<SyncBatchResult>('/sync/batch', { method: 'POST', body: { lastSyncTimestamp, mutations } });
    },
  },

  expenses: {
    async list(filters: ExpenseQuery = {}): Promise<Expense[]> {
      const { startDate, endDate, since, ...rest } = filters;
      const query = {
        ...rest,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        since: since?.toISOString(),
        limit: PAGE_SIZE,
      };
      const all: Expense[] = [];
      for (let page = 1; ; page++) {
        const result = await authorizedRequest<Paginated<ApiExpense>>('/expenses', { query: { ...query, page } });
        all.push(...result.items.map(fromApiExpense));
        if (!result.pagination.hasNext) return all;
      }
    },

    async create(expense: Expense): Promise<Expense> {
      return fromApiExpense(await authorizedRequest<ApiExpense>('/expenses', { method: 'POST', body: toApiExpense(expense) }));
    },

    async update(id: string, changes: Partial<Expense>): Promise<Expense> {
      const updated = await authorizedRequest<ApiExpense>(`/expenses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: toApiExpensePatch(changes),
      });
      return fromApiExpense(updated);
    },

    togglePaid(id: string): Promise<{ id: string; paid: boolean }> {
      return authorizedRequest(`/expenses/${encodeURIComponent(id)}/toggle-paid`, { method: 'PATCH' });
    },

    async remove(id: string): Promise<void> {
      await authorizedRequest(`/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  cards: {
    async list(includeArchived = false): Promise<CreditCard[]> {
      const cards = await authorizedRequest<ApiCard[]>('/cards', { query: { includeArchived } });
      return cards.map(fromApiCard);
    },

    async create(card: CreditCard): Promise<CreditCard> {
      return fromApiCard(await authorizedRequest<ApiCard>('/cards', { method: 'POST', body: toApiCard(card) }));
    },

    async update(id: string, changes: Partial<CreditCard>): Promise<CreditCard> {
      const updated = await authorizedRequest<ApiCard>(`/cards/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: toApiCardPatch(changes),
      });
      return fromApiCard(updated);
    },

    async remove(id: string): Promise<void> {
      await authorizedRequest(`/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },
};
