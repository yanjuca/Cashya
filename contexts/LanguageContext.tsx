import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
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
  // Device detection is unreliable inside Expo Go (iOS always reports English), so start in Portuguese
  // and let the saved choice from Settings → Language take over below.
  const [language, setLanguageState] = useState<Language>(() => {
    setCurrentLanguage(DEFAULT_LANGUAGE);
    return DEFAULT_LANGUAGE;
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
