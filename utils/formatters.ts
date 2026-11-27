import { getLocale } from '../i18n';

/**
 * Currency and date formatting utilities
 */

export function formatCurrency(amount: number, currencySymbol: string = '$', locale: string = getLocale()): string {
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol} ${formatted}`;
}

export function formatMonthYear(date: Date, locale: string = getLocale()): string {
  const formatted = date.toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDate(date: Date, locale: string = getLocale()): string {
  return date.toLocaleDateString(locale, {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
