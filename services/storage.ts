import AsyncStorage from '@react-native-async-storage/async-storage';
import { CreditCard, Expense } from '../types';

const STORAGE_KEYS = {
  EXPENSES: '@cashya:expenses',
  CARDS: '@cashya:cards',
  LAST_ACTIVE: '@cashya:last_active_at',
} as const;

export const StorageService = {
  async getExpenses(): Promise<Expense[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map((item: any) => ({
        ...item,
        date: new Date(item.date),
      }));
    } catch (error) {
      console.error('Error reading expenses from storage:', error);
      return [];
    }
  },

  async saveExpenses(expenses: Expense[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    } catch (error) {
      console.error('Error saving expenses to storage:', error);
      throw error;
    }
  },

  async getLastActiveAt(): Promise<Date | null> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
      return val ? new Date(val) : null;
    } catch {
      return null;
    }
  },

  async setLastActiveAt(date: Date = new Date()): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, date.toISOString());
    } catch (error) {
      console.error('Error saving last active timestamp:', error);
    }
  },

  async getCards(): Promise<CreditCard[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CARDS);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading cards from storage:', error);
      return [];
    }
  },

  async saveCards(cards: CreditCard[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    } catch (error) {
      console.error('Error saving cards to storage:', error);
      throw error;
    }
  },

  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.EXPENSES,
        STORAGE_KEYS.CARDS,
        STORAGE_KEYS.LAST_ACTIVE,
      ]);
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  },
};
