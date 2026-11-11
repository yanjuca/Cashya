import { Expense } from '../types';

export const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

function occurrenceDate(origin: Date, year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(origin.getDate(), lastDay);
  return new Date(
    year,
    month,
    day,
    origin.getHours(),
    origin.getMinutes(),
    origin.getSeconds()
  );
}

export function generateRecurringExpenses(
  expenses: Expense[],
  now: Date = new Date(),
  monthsAhead: number = 12
): Expense[] {
  const created: Expense[] = [];
  const horizon = new Date(now.getFullYear(), now.getMonth() + monthsAhead + 1, 0, 23, 59, 59);
  const existing = new Set(
    expenses
      .filter((e) => e.recurringSourceId)
      .map((e) => `${e.recurringSourceId}|${monthKey(e.date)}`)
  );

  expenses.forEach((origin) => {
    if (!origin.recurring || origin.recurringSourceId) return;

    const skipped = new Set(origin.skippedMonths ?? []);
    const limit =
      origin.recurringMonths && origin.recurringMonths > 0 ? origin.recurringMonths : Infinity;
    let offset = 1;
    let year = origin.date.getFullYear();
    let month = origin.date.getMonth() + 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }

    for (let guard = 0; guard < 720; guard++) {
      if (offset >= limit) break;
      const date = occurrenceDate(origin.date, year, month);
      if (date.getTime() > horizon.getTime()) break;

      const key = monthKey(date);
      const uniqueKey = `${origin.id}|${key}`;
      if (!skipped.has(key) && !existing.has(uniqueKey)) {
        created.push({
          ...origin,
          id: `${origin.id}-r-${key}`,
          date,
          tags: [...origin.tags],
          paid: false,
          recurring: false,
          recurringSourceId: origin.id,
          skippedMonths: undefined,
        });
        existing.add(uniqueKey);
      }

      offset += 1;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
  });

  return created;
}

export function dropFutureCopies(
  all: Expense[],
  originIds: Set<string>,
  now: Date = new Date()
): Expense[] {
  return all.filter(
    (e) =>
      !(
        e.recurringSourceId &&
        originIds.has(e.recurringSourceId) &&
        !e.paid &&
        e.date.getTime() > now.getTime()
      )
  );
}

export function registerSkippedMonths(all: Expense[], removed: Expense[]): Expense[] {
  const additions = new Map<string, string[]>();
  removed.forEach((e) => {
    if (!e.recurringSourceId) return;
    const list = additions.get(e.recurringSourceId) ?? [];
    list.push(monthKey(e.date));
    additions.set(e.recurringSourceId, list);
  });
  if (additions.size === 0) return all;

  return all.map((e) => {
    const extra = additions.get(e.id);
    if (!extra) return e;
    return { ...e, skippedMonths: [...(e.skippedMonths ?? []), ...extra] };
  });
}