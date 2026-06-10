import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { toggleSidebar } from '../../../redux/slices/uiSlice';
import { useThemeContext } from '../../../contexts/ThemeContext';
import { Bars3Icon, SunIcon, MoonIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import notificationApi from '../../../api/notificationApi';
import { useSiteSettings } from '../../../contexts/SiteSettingsContext';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import './Header.css';

// Prettify the current route into a topbar title (e.g. "/super-admin/lead-management" → "Lead Management").
const TITLE_OVERRIDES = {
  '/dashboard': 'Dashboard',
  '/super-admin/lead-management': 'Lead Management',
  '/super-admin/booking-approvals': 'Booking Approvals',
  '/super-admin/site-settings': 'Site Settings',
};
const titleFromPath = (pathname = '') => {
  if (TITLE_OVERRIDES[pathname]) return TITLE_OVERRIDES[pathname];
  const seg = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const Header = ({ onMenuClick }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeContext();
  const { siteName } = useSiteSettings();
  const sidebarCollapsed = useSelector((state) => state.ui.sidebarCollapsed);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const resp = await notificationApi.getUnreadCount();
      setUnreadCount(resp.data?.data?.count || 0);
    } catch {
      // Keep the existing badge if the request fails.
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);
    const onFocus = () => loadUnreadCount();

    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadUnreadCount]);

  const handleMenuToggle = () => {
    if (onMenuClick) {
      onMenuClick();
    } else {
      dispatch(toggleSidebar());
    }
  };

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          type="button"
          className="app-header__menu-toggle"
          onClick={handleMenuToggle}
          aria-label="Toggle sidebar"
        >
          {/* Mobile opens the drawer (bars); desktop collapses the rail (chevron). */}
          {onMenuClick
            ? <Bars3Icon style={{ width: 20, height: 20 }} />
            : (sidebarCollapsed
              ? <ChevronRightIcon style={{ width: 18, height: 18 }} />
              : <ChevronLeftIcon style={{ width: 18, height: 18 }} />)}
        </button>
        {siteName && (
          <>
            <span className="app-header__brand">{siteName}</span>
            <span className="app-header__brand-sep" aria-hidden="true" />
          </>
        )}
        <p className="app-header__title">{titleFromPath(location.pathname)}</p>
      </div>

      <div className="app-header__right">
        <button
          type="button"
          className="header-icon-button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <SunIcon style={{ width: 20, height: 20 }} /> : <MoonIcon style={{ width: 20, height: 20 }} />}
        </button>
        <NotificationBell unreadCount={unreadCount} />
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;
