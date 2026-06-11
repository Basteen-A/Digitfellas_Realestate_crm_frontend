import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar } from '../../../redux/slices/uiSlice';
import { useThemeContext } from '../../../contexts/ThemeContext';
import { Bars3Icon, SunIcon, MoonIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import notificationApi from '../../../api/notificationApi';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import './Header.css';

// Prettify the current route into a topbar title (e.g. "/super-admin/lead-management" → "Lead Management").


const Header = ({ onMenuClick }) => {
  const dispatch = useDispatch();
  const { isDark, toggleTheme } = useThemeContext();
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
