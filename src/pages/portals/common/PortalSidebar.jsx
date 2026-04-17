import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import logoS from '../../../assets/images/sujatha.png';
import './PortalSidebar.css';


/** Renders a menu icon — accepts a Heroicon component or falls back to a dot */
const MenuIcon = ({ icon, className = 'portal-sidebar__hero-icon' }) => {
  if (!icon) return null;
  if (typeof icon === 'function' || typeof icon === 'object') {
    const Icon = icon;
    return <Icon className={className} />;
  }
  return <span className={className}>{icon}</span>;
};

const PortalSidebar = ({ menuItems, activeScreen, onNavigate, user, roleName, collapsed, mobileOpen, onMobileClose }) => {
  return (
    <aside className={`portal-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && (
        <button
          type="button"
          className="portal-sidebar__close lg:hidden"
          onClick={onMobileClose}
        >
          <XMarkIcon style={{ width: 20, height: 20 }} />
        </button>
      )}
      <div className="portal-sidebar__brand">
        <div className="portal-sidebar__brand-icon">
          <img src={collapsed ? '/sujatha.png' : logoS} alt="Logo" className="sidebar-logo" />
        </div>
      </div>

      <nav className="portal-sidebar__nav">
        {menuItems.map((item, idx) => {
          if (item.group) {
            return (
              <div key={`group-${idx}`} className="portal-sidebar__group-label">
                {item.group}
              </div>
            );
          }
          return (
            <div
              key={item.key}
              className={`portal-sidebar__link ${activeScreen === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="portal-sidebar__icon">
                <MenuIcon icon={item.icon} />
              </span>
              <span className="portal-sidebar__label">{item.label}</span>
              {item.badgeCount > 0 && (
                <span className={`s-badge s-badge-${item.badgeColor || 'blue'}`}>
                  {item.badgeCount}
                </span>
              )}
            </div>
          );
        })}
      </nav>

    </aside>
  );
};

export default PortalSidebar;
