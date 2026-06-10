import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import siteSettingsApi from '../api/siteSettingsApi';
import { APP_NAME } from '../utils/constants';
import defaultLogoFull from '../assets/images/Sujatha_N.png';
import defaultLogoMark from '../assets/images/Sujatha-Favico.png';

const SiteSettingsContext = createContext(null);

// Effective branding = stored value, else the bundled default.
//  - siteName: the configured name, possibly '' (blank = logo-only; consumers
//    should render the name text only when it's non-empty).
//  - siteTitle: always non-empty — siteName or the app default — for the
//    browser tab title and image alt text.
const toEffective = (settings) => {
  const siteName = (settings?.site_name || '').trim();
  return {
    siteName,
    siteTitle: siteName || APP_NAME,
    logoFull: settings?.logo_full || defaultLogoFull,
    logoMark: settings?.logo_mark || defaultLogoMark,
    favicon: settings?.favicon || null,
    raw: settings || null,
  };
};

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const resp = await siteSettingsApi.get();
      setSettings(resp?.data || null);
    } catch {
      // Network/login-page failures fall back to bundled defaults silently.
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const effective = useMemo(() => toEffective(settings), [settings]);

  // Keep the browser tab title + favicon in sync with the configured brand.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = effective.siteTitle;
    if (effective.favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = effective.favicon;
    }
  }, [effective.siteTitle, effective.favicon]);

  const value = useMemo(
    () => ({ ...effective, loading, refresh, setSettings }),
    [effective, loading, refresh]
  );

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
};

export const useSiteSettings = () => {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    // Safe fallback so a component used outside the provider still renders.
    return {
      siteName: APP_NAME,
      siteTitle: APP_NAME,
      logoFull: defaultLogoFull,
      logoMark: defaultLogoMark,
      favicon: null,
      raw: null,
      loading: false,
      refresh: () => {},
      setSettings: () => {},
    };
  }
  return ctx;
};

export default SiteSettingsContext;
