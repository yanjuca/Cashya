import AsyncStorage from '@react-native-async-storage/async-storage';

import { CreditCard, Expense } from '../types';
import { ApiError, CashyaApi, Session } from './api';
import type { SyncBatchResult, SyncMutation } from './api';
import {
  ApiCard,
  ApiCardInput,
  ApiExpense,
  ApiExpenseInput,
  fromApiCard,
  fromApiExpense,
  toApiCard,
  toApiExpense,
} from './api/mappers';

/**
 * Offline-first sync with cashya-api.
 *
 * The device stays the source of truth for the UI (AsyncStorage, as before). Once an account is linked, every
 * local change is turned into a mutation and kept in a persistent outbox; `flush()` sends the outbox to
 * POST /sync/batch and receives what changed on the server since the last sync. Without a linked account
 * (the app works without login) nothing is queued and nothing leaves the device.
 *
 * Writes are idempotent upserts (CREATE_* with the full object) keyed by the client id, so retries, several
 * devices and the deterministic ids of recurring copies never create duplicates. The server resolves
 * concurrent edits with Last-Write-Wins on `clientUpdatedAt`.
 */

const KEYS = {
  outbox: '@cashya:sync_outbox',
  lastSyncAt: '@cashya:sync_last_at',
  userId: '@cashya:sync_user_id',
} as const;

const MAX_BATCH = 500; // server limit per request
const MAX_ROUNDS = 20;
const FLUSH_DELAY_MS = 1500;
// Ids from the old seeded demo cards ("card-1") would clash between accounts on the server.
const MIN_SAFE_ID_LENGTH = 12;

type Kind = 'expense' | 'card';

interface OutboxEntry {
  key: string;
  kind: Kind;
  id: string;
  op: 'upsert' | 'delete';
  payload?: ApiExpenseInput | ApiCardInput;
  clientUpdatedAt: string;
  seq: number;
}

export interface SyncChanges {
  expenses: {
    upserted: Expense[];
    deletedIds: string[];
    /** Expenses whose card no longer exists on the server: the app should drop their cardId. */
    clearCardIds: string[];
  };
  cards: { upserted: CreditCard[]; deletedIds: string[] };
}

export type SyncEvent = { type: 'reset' } | ({ type: 'changes' } & SyncChanges);

const listeners = new Set<(event: SyncEvent) => void>();
let outbox: OutboxEntry[] | null = null;
let seq = 0;
let linkedUserId: string | null | undefined; // undefined = not read from storage yet
let persistChain: Promise<void> = Promise.resolve();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
let flushRequestedWhileBusy = false;

// --------------------------------------------------------------------------------------------------------------
// Storage helpers
// --------------------------------------------------------------------------------------------------------------

async function loadOutbox(): Promise<OutboxEntry[]> {
  if (outbox) return outbox;
  try {
    const raw = await AsyncStorage.getItem(KEYS.outbox);
    const parsed = raw ? JSON.parse(raw) : [];
    outbox = Array.isArray(parsed) ? parsed : [];
  } catch {
    outbox = [];
  }
  seq = outbox.reduce((max, entry) => Math.max(max, entry.seq), 0);
  return outbox;
}

function persistOutbox(): Promise<void> {
  const snapshot = JSON.stringify(outbox ?? []);
  persistChain = persistChain
    .then(() => AsyncStorage.setItem(KEYS.outbox, snapshot))
    .catch((error) => console.error('[sync] could not persist outbox:', error));
  return persistChain;
}

async function getLinkedUserId(): Promise<string | null> {
  if (linkedUserId === undefined) {
    linkedUserId = await AsyncStorage.getItem(KEYS.userId);
  }
  return linkedUserId;
}

function emit(event: SyncEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error('[sync] listener failed:', error);
    }
  });
}

// --------------------------------------------------------------------------------------------------------------
// Diffing local lists into mutations
// --------------------------------------------------------------------------------------------------------------

function safe<T, R>(fn: (value: T) => R, value: T): R | null {
  try {
    return fn(value);
  } catch (error) {
    console.warn('[sync] skipping invalid item:', error);
    return null;
  }
}

function diffById<T extends { id: string }, P>(prev: T[], next: T[], toPayload: (item: T) => P) {
  const before = new Map(prev.map((item) => [item.id, JSON.stringify(safe(toPayload, item))]));
  const upserts: { id: string; payload: P }[] = [];
  const nextIds = new Set<string>();
  for (const item of next) {
    nextIds.add(item.id);
    const payload = safe(toPayload, item);
    if (payload === null) continue;
    if (before.get(item.id) !== JSON.stringify(payload)) upserts.push({ id: item.id, payload });
  }
  const deletedIds = prev.filter((item) => !nextIds.has(item.id)).map((item) => item.id);
  return { upserts, deletedIds };
}

async function enqueue(kind: Kind, upserts: { id: string; payload: ApiExpenseInput | ApiCardInput }[], deletedIds: string[]) {
  if (upserts.length === 0 && deletedIds.length === 0) return;
  if (!(await getLinkedUserId())) return;
  const queue = await loadOutbox();
  const now = new Date().toISOString();
  const entries: OutboxEntry[] = [
    ...upserts.map(({ id, payload }) => ({ key: `${kind}:${id}`, kind, id, op: 'upsert' as const, payload, clientUpdatedAt: now, seq: ++seq })),
    ...deletedIds.map((id) => ({ key: `${kind}:${id}`, kind, id, op: 'delete' as const, clientUpdatedAt: now, seq: ++seq })),
  ];
  const replaced = new Set(entries.map((entry) => entry.key));
  outbox = [...queue.filter((entry) => !replaced.has(entry.key)), ...entries];
  await persistOutbox();
  SyncService.requestFlush();
}

// Cards must exist before the expenses that point to them, and expenses leave before their card is removed.
const RANK: Record<string, number> = { 'card:upsert': 0, 'expense:upsert': 1, 'expense:delete': 2, 'card:delete': 3 };

function toMutation(entry: OutboxEntry): SyncMutation {
  if (entry.kind === 'expense') {
    return entry.op === 'upsert'
      ? { type: 'CREATE_EXPENSE', id: entry.id, data: entry.payload as ApiExpenseInput, clientUpdatedAt: entry.clientUpdatedAt }
      : { type: 'DELETE_EXPENSE', id: entry.id };
  }
  return entry.op === 'upsert'
    ? { type: 'CREATE_CARD', id: entry.id, data: entry.payload as ApiCardInput, clientUpdatedAt: entry.clientUpdatedAt }
    : { type: 'DELETE_CARD', id: entry.id };
}

// --------------------------------------------------------------------------------------------------------------
// Applying a batch response
// --------------------------------------------------------------------------------------------------------------

function collectChanges(result: SyncBatchResult, pendingKeys: Set<string>): SyncChanges {
  const changes: SyncChanges = {
    expenses: { upserted: [], deletedIds: [], clearCardIds: [] },
    cards: { upserted: [], deletedIds: [] },
  };
  const serverExpenses: ApiExpense[] = [...result.serverChanges.expenses];
  const serverCards: ApiCard[] = [...result.serverChanges.cards];

  for (const conflict of result.conflicts) {
    const isExpense = conflict.type.endsWith('EXPENSE');
    if (conflict.server) {
      // The server copy is newer (Last-Write-Wins): it replaces the local one.
      if (isExpense) serverExpenses.push(conflict.server as unknown as ApiExpense);
      else serverCards.push(conflict.server as unknown as ApiCard);
    } else if (isExpense && conflict.id && /cardId/i.test(conflict.reason)) {
      changes.expenses.clearCardIds.push(conflict.id);
    } else {
      console.warn('[sync] mutation rejected by the server:', conflict.type, conflict.id, conflict.reason);
    }
  }

  for (const dto of serverExpenses) {
    if (pendingKeys.has(`expense:${dto.id}`)) continue; // a newer local edit is still waiting to be sent
    if (dto.deletedAt) changes.expenses.deletedIds.push(dto.id);
    else {
      const expense = safe(fromApiExpense, dto);
      if (expense) changes.expenses.upserted.push(expense);
    }
  }
  for (const dto of serverCards) {
    if (pendingKeys.has(`card:${dto.id}`)) continue;
    if (dto.deletedAt) changes.cards.deletedIds.push(dto.id);
    else {
      const card = safe(fromApiCard, dto);
      if (card) changes.cards.upserted.push(card);
    }
  }
  return changes;
}

function hasChanges(changes: SyncChanges) {
  return (
    changes.expenses.upserted.length + changes.expenses.deletedIds.length + changes.expenses.clearCardIds.length +
      changes.cards.upserted.length + changes.cards.deletedIds.length >
    0
  );
}

async function runFlush(): Promise<void> {
  const userId = await getLinkedUserId();
  if (!userId || !(await Session.hasSession())) return;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const queue = await loadOutbox();
    const batch = [...queue]
      .sort((a, b) => RANK[`${a.kind}:${a.op}`] - RANK[`${b.kind}:${b.op}`] || a.seq - b.seq)
      .slice(0, MAX_BATCH);
    const lastSyncAt = await AsyncStorage.getItem(KEYS.lastSyncAt);

    const result = await CashyaApi.sync.batch(lastSyncAt, batch.map(toMutation));
    if ((await getLinkedUserId()) !== userId) return; // account changed while the request was in flight

    // Drop what was sent, unless it was edited again while the request was in flight.
    const sent = new Map(batch.map((entry) => [entry.key, entry.seq]));
    outbox = (outbox ?? []).filter((entry) => sent.get(entry.key) !== entry.seq);
    await persistOutbox();
    await AsyncStorage.setItem(KEYS.lastSyncAt, result.syncedAt);

    const changes = collectChanges(result, new Set(outbox.map((entry) => entry.key)));
    if (hasChanges(changes)) emit({ type: 'changes', ...changes });

    if (outbox.length === 0) return;
  }
}

// --------------------------------------------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------------------------------------------

export const SyncService = {
  subscribe(listener: (event: SyncEvent) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Queue the difference between two versions of the expense list (no-op while no account is linked). */
  async recordExpenses(prev: Expense[], next: Expense[]): Promise<void> {
    const { upserts, deletedIds } = diffById(prev, next, toApiExpense);
    await enqueue('expense', upserts, deletedIds);
  },

  /** Queue the difference between two versions of the card list (no-op while no account is linked). */
  async recordCards(prev: CreditCard[], next: CreditCard[]): Promise<void> {
    const { upserts, deletedIds } = diffById(prev, next, toApiCard);
    await enqueue('card', upserts, deletedIds);
  },

  /**
   * Called after every successful login/register.
   * - same account as before: nothing to do;
   * - first account on this device: everything already on the phone is uploaded to it;
   * - a different account: the previous account's local copy is dropped (`reset`) and this one is downloaded.
   */
  async linkAccount(userId: string, local: { expenses: Expense[]; cards: CreditCard[] }): Promise<'same' | 'first' | 'switched'> {
    const current = await getLinkedUserId();
    if (current === userId) return 'same';

    outbox = [];
    await persistOutbox();
    await AsyncStorage.multiRemove([KEYS.lastSyncAt]);
    await AsyncStorage.setItem(KEYS.userId, userId);
    linkedUserId = userId;

    if (current) {
      emit({ type: 'reset' });
      return 'switched';
    }

    // Give legacy short card ids a unique id before they reach the server.
    const renamed = new Map<string, string>();
    const cards = local.cards.map((card) => {
      if (card.id.length >= MIN_SAFE_ID_LENGTH) return card;
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      renamed.set(card.id, id);
      return { ...card, id };
    });
    const expenses = renamed.size
      ? local.expenses.map((e) => (e.cardId && renamed.has(e.cardId) ? { ...e, cardId: renamed.get(e.cardId) } : e))
      : local.expenses;
    if (renamed.size) {
      emit({
        type: 'changes',
        cards: { upserted: cards.filter((c) => [...renamed.values()].includes(c.id)), deletedIds: [...renamed.keys()] },
        expenses: { upserted: expenses.filter((e) => e.cardId && [...renamed.values()].includes(e.cardId)), deletedIds: [], clearCardIds: [] },
      });
    }

    await SyncService.recordCards([], cards);
    await SyncService.recordExpenses([], expenses);
    return 'first';
  },

  /** "Remove login": stop syncing this device. Local data stays; nothing is deleted on the server. */
  async unlink(): Promise<void> {
    if (flushTimer) clearTimeout(flushTimer);
    outbox = [];
    linkedUserId = null;
    await AsyncStorage.multiRemove([KEYS.outbox, KEYS.lastSyncAt, KEYS.userId]);
  },

  /** Send pending changes and pull the server's. Safe to call often: runs one at a time. */
  flush(): Promise<void> {
    if (flushing) {
      flushRequestedWhileBusy = true;
      return flushing;
    }
    flushing = (async () => {
      try {
        await runFlush();
      } catch (error) {
        if (error instanceof ApiError && (error.isNetworkError || error.status === 401)) return; // retried later
        console.error('[sync] flush failed:', error);
      } finally {
        flushing = null;
        if (flushRequestedWhileBusy) {
          flushRequestedWhileBusy = false;
          SyncService.requestFlush();
        }
      }
    })();
    return flushing;
  },

  /** Debounced flush, so a burst of edits travels in a single request. */
  requestFlush(): void {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(() => {
      flushTimer = null;
      SyncService.flush();
    }, FLUSH_DELAY_MS);
  },

  async pendingCount(): Promise<number> {
    return (await loadOutbox()).length;
  },
};
