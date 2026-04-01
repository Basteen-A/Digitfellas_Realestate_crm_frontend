import React from 'react';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../../../redux/slices/uiSlice';
import { useThemeContext } from '../../../contexts/ThemeContext';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import './Header.css';

const Header = () => {
  const dispatch = useDispatch();
  const { isDark, toggleTheme } = useThemeContext();

  return (
    <header className="app-header">
      <div className="app-header__left">
        <button
          type="button"
          className="app-header__menu-toggle"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div>
          <p className="app-header__title">Real Estate CRM</p>
          <p className="app-header__subtitle">Production Administration Console</p>
        </div>
      </div>

      <div className="app-header__right">
        <button
          type="button"
          className="header-theme-toggle"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <span aria-hidden="true">{isDark ? '☀' : '🌙'}</span>
          <span>{isDark ? 'Light' : 'Dark'}</span>
        </button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;
