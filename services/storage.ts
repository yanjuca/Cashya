import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language } from '../i18n';
import { ThemeMode } from '../theme';
import { CreditCard, Expense } from '../types';

const STORAGE_KEYS = {
  EXPENSES: '@cashya:expenses',
  CARDS: '@cashya:cards',
  LAST_ACTIVE: '@cashya:last_active_at',
  THEME_MODE: '@cashya:theme_mode',
  ACCENT_COLOR: '@cashya:accent_color',
  ONBOARDING_DONE: '@cashya:onboarding_done',
  LANGUAGE: '@cashya:language',
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

  async getThemeMode(): Promise<ThemeMode | null> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
      if (mode === 'dark' || mode === 'light') {
        return mode;
      }
      return null;
    } catch (error) {
      console.error('Error reading theme mode from storage:', error);
      return null;
    }
  },

  async saveThemeMode(mode: ThemeMode): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
    } catch (error) {
      console.error('Error saving theme mode to storage:', error);
      throw error;
    }
  },

  async getAccentColor(): Promise<string | null> {
    try {
      const color = await AsyncStorage.getItem(STORAGE_KEYS.ACCENT_COLOR);
      return color;
    } catch (error) {
      console.error('Error reading accent color from storage:', error);
      return null;
    }
  },

  async saveAccentColor(color: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, color);
    } catch (error) {
      console.error('Error saving accent color to storage:', error);
      throw error;
    }
  },

  async getOnboardingDone(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_DONE);
      return val === 'true';
    } catch (error) {
      console.error('Error reading onboarding flag from storage:', error);
      return true;
    }
  },

  async setOnboardingDone(done: boolean = true): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_DONE, done ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving onboarding flag to storage:', error);
    }
  },

  async getLanguage(): Promise<Language | null> {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      return val === 'en' || val === 'pt' ? val : null;
    } catch (error) {
      console.error('Error reading language from storage:', error);
      return null;
    }
  },

  async saveLanguage(language: Language): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    } catch (error) {
      console.error('Error saving language to storage:', error);
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
