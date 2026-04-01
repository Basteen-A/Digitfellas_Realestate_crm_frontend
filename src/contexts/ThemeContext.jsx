import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { storage } from '../utils/storage';

const ThemeContext = createContext(null);

const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
};

const getInitialTheme = () => {
  const saved = storage.get(STORAGE_KEYS.THEME, THEMES.DARK);
  return saved === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    storage.set(STORAGE_KEYS.THEME, theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK));
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      THEMES,
      isDark: theme === THEMES.DARK,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};

export default ThemeContext;
