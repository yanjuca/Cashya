import { Share } from 'react-native';
import { customAlert } from '../contexts/AlertContext';
import { BackupData, CreditCard, Expense } from '../types';
import { StorageService } from './storage';

export const BackupService = {
  /**
   * Generates consolidated backup JSON with version and timestamp
   */
  async generateBackupData(): Promise<BackupData> {
    const expenses = await StorageService.getExpenses();
    const cards = await StorageService.getCards();

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      expenses: expenses.map((e) => ({
        ...e,
        date: e.date.toISOString(),
      })),
      cards,
    };
  },

  /**
   * Triggers native file share sheet with JSON content
   */
  async shareBackup(): Promise<boolean> {
    try {
      const backup = await this.generateBackupData();
      const jsonString = JSON.stringify(backup, null, 2);

      const result = await Share.share({
        title: `Cashya_Backup_${new Date().toISOString().slice(0, 10)}.json`,
        message: jsonString,
      });

      return result.action === Share.sharedAction;
    } catch (error) {
      console.error('Error sharing backup:', error);
      customAlert({
        title: 'Error',
        message: 'Unable to export backup at this time.',
        type: 'danger',
      });
      return false;
    }
  },

  /**
   * Validates and restores data from a JSON string
   */
  async restoreFromJson(
    jsonString: string
  ): Promise<{ success: boolean; message: string; count?: { expenses: number; cards: number } }> {
    try {
      const parsed = JSON.parse(jsonString);

      if (!parsed || !Array.isArray(parsed.expenses)) {
        return {
          success: false,
          message: 'Invalid backup file: incompatible format.',
        };
      }

      // Sanitize expenses
      const restoredExpenses: Expense[] = parsed.expenses.map((e: any) => ({
        id: e.id || Date.now().toString() + Math.random().toString(36).substring(2, 7),
        description: String(e.description || 'Expense without description'),
        amount: Number(e.amount) || 0,
        person: String(e.person || 'General'),
        date: e.date ? new Date(e.date) : new Date(),
        tags: Array.isArray(e.tags) ? e.tags : [],
        paid: Boolean(e.paid),
        source: e.source || 'import',
        cardId: e.cardId,
      }));

      // Sanitize cards (if any)
      const restoredCards: CreditCard[] = Array.isArray(parsed.cards)
        ? parsed.cards.map((c: any) => ({
            id: c.id || Date.now().toString() + Math.random().toString(36).substring(2, 7),
            holderName: String(c.holderName || 'USER').toUpperCase(),
            brand: c.brand || 'generic',
            type: c.type || 'Credit',
            lastDigits: String(c.lastDigits || '0000'),
            expiryDate: String(c.expiryDate || '12/99'),
            limit: Number(c.limit) || 1000,
            colorAccent: c.colorAccent,
          }))
        : [];

      await StorageService.saveExpenses(restoredExpenses);
      if (restoredCards.length > 0) {
        await StorageService.saveCards(restoredCards);
      }

      return {
        success: true,
        message: 'Backup restored successfully!',
        count: {
          expenses: restoredExpenses.length,
          cards: restoredCards.length,
        },
      };
    } catch (error) {
      console.error('Error restoring backup:', error);
      return {
        success: false,
        message: 'Failed to process backup JSON file.',
      };
    }
  },
};
