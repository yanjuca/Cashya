import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { CreditCard } from '../types';

export { CreditCard };

export const DEFAULT_CARDS: CreditCard[] = [
  {
    id: 'card-1',
    holderName: 'MAIN WALLET',
    brand: 'visa',
    type: 'Debit',
    lastDigits: '1234',
    expiryDate: '12/28',
    limit: 3000,
    colorAccent: '#9B1D20',
  },
  {
    id: 'card-2',
    holderName: 'CREDIT CARD',
    brand: 'mastercard',
    type: 'Credit',
    lastDigits: '5678',
    expiryDate: '09/29',
    limit: 5000,
    colorAccent: '#ff9f0a',
  },
];

interface CardsContextData {
  cards: CreditCard[];
  activeCardIndex: number;
  setActiveCardIndex: (index: number) => void;
  activeCard: CreditCard | null;
  addCard: (card: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCard: (id: string, card: Partial<CreditCard>) => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  reloadCards: () => Promise<void>;
  resetCards: (newCards: CreditCard[]) => Promise<void>;
  loading: boolean;
}

const CardsContext = createContext<CardsContextData>({} as CardsContextData);

export function CardsProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const data = await StorageService.getCards();
      setCards(data || []);
    } catch (error) {
      console.error('Error loading cards:', error);
      setCards([]);
    } finally {
      setLoading(false);
    }
  };

  const saveAndSetCards = async (newCards: CreditCard[]) => {
    try {
      await StorageService.saveCards(newCards);
      setCards(newCards);
    } catch (error) {
      console.error('Error saving cards:', error);
    }
  };

  const addCard = async (card: Omit<CreditCard, 'id'>) => {
    const newCard: CreditCard = {
      ...card,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    };
    const newCards = [...cards, newCard];
    await saveAndSetCards(newCards);
  };

  const updateCard = async (id: string, updated: Partial<CreditCard>) => {
    const newCards = cards.map((c) => (c.id === id ? { ...c, ...updated } : c));
    await saveAndSetCards(newCards);
  };

  const removeCard = async (id: string) => {
    const newCards = cards.filter((c) => c.id !== id);
    await saveAndSetCards(newCards);
    if (activeCardIndex >= newCards.length) {
      setActiveCardIndex(Math.max(0, newCards.length - 1));
    }
  };

  const reloadCards = async () => {
    await loadCards();
  };

  const resetCards = async (newCards: CreditCard[]) => {
    await saveAndSetCards(newCards);
    setActiveCardIndex(0);
  };

  const activeCard = cards[activeCardIndex] || cards[0] || null;

  return (
    <CardsContext.Provider
      value={{
        cards,
        activeCardIndex,
        setActiveCardIndex,
        activeCard,
        addCard,
        updateCard,
        removeCard,
        reloadCards,
        resetCards,
        loading,
      }}
    >
      {children}
    </CardsContext.Provider>
  );
}

export function useCards() {
  const context = useContext(CardsContext);
  if (!context) {
    throw new Error('useCards must be used within a CardsProvider');
  }
  return context;
}
