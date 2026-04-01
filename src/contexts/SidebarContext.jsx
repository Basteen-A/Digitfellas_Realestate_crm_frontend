import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { storage } from '../utils/storage';

const SidebarContext = createContext(null);

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    storage.get(STORAGE_KEYS.SIDEBAR_COLLAPSED, 'false') === 'true'
  );

  const setCollapsed = useCallback((nextValue) => {
    const value = Boolean(nextValue);
    setIsCollapsed(value);
    storage.set(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(value));
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      storage.set(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isCollapsed,
      setCollapsed,
      toggle,
    }),
    [isCollapsed, setCollapsed, toggle]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};

export const useSidebarContext = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebarContext must be used within SidebarProvider');
  }
  return context;
};

export default SidebarContext;
