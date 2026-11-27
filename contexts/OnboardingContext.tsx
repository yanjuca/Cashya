import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StorageService } from '../services/storage';

export interface OnboardingContextValue {
  visible: boolean;
  open: () => void;
  finish: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    StorageService.getOnboardingDone().then((done) => {
      if (!cancelled && !done) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback(() => setVisible(true), []);

  const finish = useCallback(async () => {
    setVisible(false);
    await StorageService.setOnboardingDone(true);
  }, []);

  const value = useMemo(() => ({ visible, open, finish }), [visible, open, finish]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return ctx;
}
