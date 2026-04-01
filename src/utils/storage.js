import { STORAGE_KEYS } from './constants';
import { safeJsonParse, safeJsonStringify } from './helpers';

const inBrowser = typeof window !== 'undefined';

const canUseStorage = () => {
  if (!inBrowser) return false;
  try {
    const key = '__recrm_storage_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const getStorage = () => (canUseStorage() ? window.localStorage : null);

export const storage = {
  set: (key, value) => {
    const s = getStorage();
    if (!s) return false;
    try {
      s.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  },

  get: (key, fallback = null) => {
    const s = getStorage();
    if (!s) return fallback;
    try {
      const value = s.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  },

  setJSON: (key, value) => storage.set(key, safeJsonStringify(value, 'null')),

  getJSON: (key, fallback = null) => {
    const raw = storage.get(key, null);
    if (raw === null) return fallback;
    return safeJsonParse(raw, fallback);
  },

  remove: (key) => {
    const s = getStorage();
    if (!s) return false;
    try {
      s.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear: () => {
    const s = getStorage();
    if (!s) return false;
    try {
      s.clear();
      return true;
    } catch {
      return false;
    }
  },
};

export const authStorage = {
  getAccessToken: () => storage.get(STORAGE_KEYS.ACCESS_TOKEN),
  setAccessToken: (token) => storage.set(STORAGE_KEYS.ACCESS_TOKEN, token),
  getRefreshToken: () => storage.get(STORAGE_KEYS.REFRESH_TOKEN),
  setRefreshToken: (token) => storage.set(STORAGE_KEYS.REFRESH_TOKEN, token),
  getUser: () => storage.getJSON(STORAGE_KEYS.USER),
  setUser: (user) => storage.setJSON(STORAGE_KEYS.USER, user),
  clear: () => {
    storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    storage.remove(STORAGE_KEYS.USER);
  },
};
