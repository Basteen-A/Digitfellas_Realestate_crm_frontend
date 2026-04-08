import React from 'react';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../../../redux/slices/uiSlice';
import { useThemeContext } from '../../../contexts/ThemeContext';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import './Header.css';

const Header = ({ onMenuClick }) => {
  const dispatch = useDispatch();
  const { isDark, toggleTheme } = useThemeContext();

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
          ☰
        </button>
        <div className="hidden sm:block">
          <p className="app-header__title">Real Estate CRM</p>
          <p className="app-header__subtitle hidden md:block">Production Administration Console</p>
        </div>
      </div>

      <div className="app-header__right">
        <button
          type="button"
          className="header-theme-toggle hidden xs:flex"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          <span aria-hidden="true">{isDark ? '&#9728;' : '&#9790;'}</span>
          <span className="hidden md:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;
