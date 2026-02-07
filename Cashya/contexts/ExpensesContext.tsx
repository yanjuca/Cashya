import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  person: string;
  date: Date;
  tags: string[];
  paid: boolean;
}

interface ExpensesContextData {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  editExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
  loading: boolean;
}

const ExpensesContext = createContext<ExpensesContextData>({} as ExpensesContextData);

const STORAGE_KEY = '@cashya:expenses';

interface ExpensesProviderProps {
  children: ReactNode;
}

export function ExpensesProvider({ children }: ExpensesProviderProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Load expenses from AsyncStorage on mount
  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const expensesJSON = await AsyncStorage.getItem(STORAGE_KEY);
      if (expensesJSON) {
        const expensesParsed = JSON.parse(expensesJSON);
        // Convert date strings back to Date objects
        const expensesWithDates = expensesParsed.map((e: any) => ({
          ...e,
          date: new Date(e.date),
        }));
        setExpenses(expensesWithDates);
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveExpenses = async (newExpenses: Expense[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newExpenses));
      setExpenses(newExpenses);
    } catch (error) {
      console.error('Error saving expenses:', error);
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    };
    const newExpenses = [...expenses, newExpense];
    await saveExpenses(newExpenses);
  };

  const editExpense = async (id: string, updatedExpense: Partial<Expense>) => {
    const newExpenses = expenses.map((e) =>
      e.id === id ? { ...e, ...updatedExpense } : e
    );
    await saveExpenses(newExpenses);
  };

  const removeExpense = async (id: string) => {
    const newExpenses = expenses.filter((e) => e.id !== id);
    await saveExpenses(newExpenses);
  };

  const togglePaid = async (id: string) => {
    const newExpenses = expenses.map((e) =>
      e.id === id ? { ...e, paid: !e.paid } : e
    );
    await saveExpenses(newExpenses);
  };

  return (
    <ExpensesContext.Provider
      value={{
        expenses,
        addExpense,
        editExpense,
        removeExpense,
        togglePaid,
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