import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StorageService } from '../services/storage';
import { ACCENT_COLORS, AccentColorOption, getThemeColors, ThemeColors, ThemeMode } from '../theme';

export interface ThemeContextValue {
  themeMode: ThemeMode;
  accentColor: string;
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  accentList: AccentColorOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [accentColor, setAccentColorState] = useState<string>('#9B1D20');

  useEffect(() => {
    async function loadThemePreferences() {
      try {
        const [savedMode, savedAccent] = await Promise.all([
          StorageService.getThemeMode(),
          StorageService.getAccentColor(),
        ]);
        if (savedMode) {
          setThemeModeState(savedMode);
        }
        if (savedAccent) {
          setAccentColorState(savedAccent);
        }
      } catch (err) {
        console.error('Failed to load theme preferences from storage:', err);
      }
    }

    loadThemePreferences();
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await StorageService.saveThemeMode(mode);
    } catch (err) {
      console.error('Failed to save theme mode:', err);
    }
  }, []);

  const setAccentColor = useCallback(async (color: string) => {
    setAccentColorState(color);
    try {
      await StorageService.saveAccentColor(color);
    } catch (err) {
      console.error('Failed to save accent color:', err);
    }
  }, []);

  const colors = useMemo(() => {
    return getThemeColors(themeMode, accentColor);
  }, [themeMode, accentColor]);

  const value = useMemo<ThemeContextValue>(() => ({
    themeMode,
    accentColor,
    colors,
    isDark: themeMode === 'dark',
    setThemeMode,
    setAccentColor,
    accentList: ACCENT_COLORS,
  }), [themeMode, accentColor, colors, setThemeMode, setAccentColor]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
