import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { LayoutAnimation, Platform } from 'react-native';
import { StorageService } from '../services/storage';
import { Expense } from '../types';

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

export function ExpensesProvider({ children }: ExpensesProviderProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await StorageService.getExpenses();
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAndSetExpenses = async (newExpenses: Expense[]) => {
    try {
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
      await StorageService.saveExpenses(newExpenses);
      setExpenses(newExpenses);
    } catch (error) {
      console.error('Error saving expenses:', error);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    };
    const newExpenses = [newExpense, ...expenses];
    await saveAndSetExpenses(newExpenses);
  };

  const editExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    const newExpenses = expenses.map((e) =>
      e.id === id ? { ...e, ...updatedExpense } : e
    );
    await saveAndSetExpenses(newExpenses);
  };

  const removeExpense = async (id: string) => {
    const newExpenses = expenses.filter((e) => e.id !== id);
    await saveAndSetExpenses(newExpenses);
  };

  const removeExpenses = async (ids: string[]) => {
    const idSet = new Set(ids);
    const newExpenses = expenses.filter((e) => !idSet.has(e.id));
    await saveAndSetExpenses(newExpenses);
  };

  const togglePaid = async (id: string) => {
    const newExpenses = expenses.map((e) =>
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
