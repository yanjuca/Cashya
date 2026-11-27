import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  detectDeviceLanguage,
  Language,
  localeFor,
  setCurrentLanguage,
  translateTo,
} from '../i18n';
import { StorageService } from '../services/storage';

export interface LanguageContextValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => Promise<void>;
  t: (text: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const initial = detectDeviceLanguage();
    setCurrentLanguage(initial);
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    StorageService.getLanguage().then((saved) => {
      if (cancelled || !saved) return;
      setCurrentLanguage(saved);
      setLanguageState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setCurrentLanguage(next);
    setLanguageState(next);
    await StorageService.saveLanguage(next);
  }, []);

  const t = useCallback((text: string) => translateTo(text, language), [language]);

  const value = useMemo(
    () => ({ language, locale: localeFor(language), setLanguage, t }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
