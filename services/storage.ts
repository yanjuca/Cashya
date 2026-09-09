import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '../contexts/ExpensesContext';

const EXPENSES_STORAGE_KEY = '@cashya:expenses';
const LAST_ACTIVE_KEY = '@cashya:last_active_at';

export const StorageService = {
  async getExpenses(): Promise<Expense[]> {
    try {
      const data = await AsyncStorage.getItem(EXPENSES_STORAGE_KEY);
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
      await AsyncStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    } catch (error) {
      console.error('Error saving expenses to storage:', error);
      throw error;
    }
  },

  async getLastActiveAt(): Promise<Date | null> {
    try {
      const val = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
      return val ? new Date(val) : null;
    } catch {
      return null;
    }
  },

  async setLastActiveAt(date: Date = new Date()): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, date.toISOString());
    } catch (error) {
      console.error('Error saving last active timestamp:', error);
    }
  },
};
