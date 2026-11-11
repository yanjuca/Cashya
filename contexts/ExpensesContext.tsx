import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState, LayoutAnimation, Platform } from 'react-native';
import { StorageService } from '../services/storage';
import { Expense } from '../types';
import {
  dropFutureCopies,
  generateRecurringExpenses,
  registerSkippedMonths,
} from '../utils/recurring';

export { Expense };

interface ExpensesContextData {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  editExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  removeExpenses: (ids: string[]) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
  reloadExpenses: () => Promise<void>;
  resetExpenses: (newExpenses: Expense[]) => Promise<void>;
  loading: boolean;
}

const ExpensesContext = createContext<ExpensesContextData>({} as ExpensesContextData);

interface ExpensesProviderProps {
  children: ReactNode;
}

const withRecurring = (list: Expense[]): Expense[] => {
  const generated = generateRecurringExpenses(list);
  return generated.length > 0 ? [...generated, ...list] : list;
};

export function ExpensesProvider({ children }: ExpensesProviderProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const expensesRef = useRef<Expense[]>([]);

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadExpenses();
      }
    });
    return () => subscription.remove();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await StorageService.getExpenses();
      const merged = withRecurring(data);
      if (merged.length !== data.length) {
        await StorageService.saveExpenses(merged);
      }
      expensesRef.current = merged;
      setExpenses(merged);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAndSetExpenses = async (newExpenses: Expense[]) => {
    try {
      const finalList = withRecurring(newExpenses);
      expensesRef.current = finalList;
      if (Platform.OS !== 'web') {
        LayoutAnimation.configureNext({
          duration: 320,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
          update: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.75,
          },
          delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
        });
      }
      await StorageService.saveExpenses(finalList);
      setExpenses(finalList);
    } catch (error) {
      console.error('Error saving expenses:', error);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    };
    await saveAndSetExpenses([newExpense, ...expensesRef.current]);
  };

  const editExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    const current = expensesRef.current;
    const target = current.find((e) => e.id === id);
    let next = current.map((e) => (e.id === id ? { ...e, ...updatedExpense } : e));
    if (target && !target.recurringSourceId) {
      next = dropFutureCopies(next, new Set([id]));
      if ('recurringMonths' in updatedExpense) {
        next = next.map((e) =>
          e.recurringSourceId === id ? { ...e, recurringMonths: updatedExpense.recurringMonths } : e
        );
      }
    }
    await saveAndSetExpenses(next);
  };

  const removeExpense = async (id: string) => {
    await removeExpenses([id]);
  };

  const removeExpenses = async (ids: string[]) => {
    const idSet = new Set(ids);
    const current = expensesRef.current;
    const removed = current.filter((e) => idSet.has(e.id));
    const remaining = current.filter((e) => !idSet.has(e.id));
    const cleaned = dropFutureCopies(remaining, idSet);
    await saveAndSetExpenses(registerSkippedMonths(cleaned, removed));
  };

  const togglePaid = async (id: string) => {
    const newExpenses = expensesRef.current.map((e) =>
      e.id === id ? { ...e, paid: !e.paid } : e
    );
    await saveAndSetExpenses(newExpenses);
  };

  const reloadExpenses = async () => {
    await loadExpenses();
  };

  const resetExpenses = async (newExpenses: Expense[]) => {
    await saveAndSetExpenses(newExpenses);
  };

  return (
    <ExpensesContext.Provider
      value={{
        expenses,
        addExpense,
        editExpense,
        removeExpense,
        removeExpenses,
        togglePaid,
        reloadExpenses,
        resetExpenses,
        loading,
      }}
    >
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpensesProvider');
  }
  return context;
}