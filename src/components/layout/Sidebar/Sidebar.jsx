import React, { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSidebarMenuForRole, ROLE_LABELS } from './menuConfig';
import { getRoleCode } from '../../../utils/permissions';
import { XMarkIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import './Sidebar.css';
import logoS from '../../../assets/images/logo S.png';

const MOBILE_BREAKPOINT = 768;

/** Renders a menu icon — accepts a Heroicon component or falls back to a dot */
const MenuIcon = ({ icon, className = 'sidebar-icon' }) => {
  if (!icon) return <span className={className}>•</span>;
  if (typeof icon === 'function' || typeof icon === 'object') {
    const Icon = icon;
    return <Icon className={className} />;
  }
  return <span className={className}>{icon}</span>;
};

const Sidebar = ({ isMobileOpen, onMobileClose }) => {
  const { sidebarCollapsed } = useSelector((state) => state.ui);
  const roleCode = useSelector((state) => getRoleCode(state.auth.user));
  const location = useLocation();

  // Determine which group contains the current path so it auto-opens
  const menu = getSidebarMenuForRole(roleCode);

  const getInitialOpenGroups = useCallback(() => {
    const initial = {};
    menu.forEach((item) => {
      if (item.children?.length) {
        const isActive = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'));
        initial[item.label] = isActive;
      }
    });
    return initial;
  }, [menu, location.pathname]);

  const [openGroups, setOpenGroups] = useState(() => getInitialOpenGroups());
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-expand group containing the active route when location changes
  React.useEffect(() => {
    menu.forEach((item) => {
      if (item.children?.length) {
        const isActive = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'));
        if (isActive) {
          setOpenGroups((prev) => ({ ...prev, [item.label]: true }));
        }
      }
    });
  }, [location.pathname, menu]);

  const toggleGroup = (label) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const roleLabel = ROLE_LABELS[roleCode] || roleCode || '';

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const isCollapsed = !isMobile && sidebarCollapsed;

  return (
    <>
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside className={`app-sidebar ${isCollapsed ? 'app-sidebar--collapsed' : ''} ${isMobile ? 'fixed left-0 top-0 z-50 w-64 transform transition-transform duration-300' : ''} ${isMobile && !isMobileOpen ? '-translate-x-full' : ''} ${isMobile ? 'md:relative md:translate-x-0 md:z-auto' : ''}`}>
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 md:hidden"
            aria-label="Close sidebar"
          >
            <XMarkIcon className="sidebar-icon" />
          </button>
        )}
      {/* Brand */}
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo">
          {isCollapsed ? 'RC' : <img src={logoS} alt="Logo" />}
        </div>
        {!isCollapsed && <span className="app-sidebar__name">RealEstate CRM</span>}
      </div>

      {/* Role Badge */}
      {!isCollapsed && (
        <div className="app-sidebar__role-badge">
          <span className="app-sidebar__role-dot" />
          <span>{roleLabel}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="app-sidebar__nav">
        {menu.map((item) => {
          if (item.children?.length) {
            const isOpen = !!openGroups[item.label];
            const hasActiveChild = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'));

            return (
              <div key={item.label} className={`app-sidebar__group ${hasActiveChild ? 'has-active-child' : ''}`}>
                <button type="button" className={`app-sidebar__group-button ${isOpen ? 'is-open' : ''}`} onClick={() => toggleGroup(item.label)}>
                  <MenuIcon icon={item.icon} />
                  {!isCollapsed && <span>{item.label}</span>}
                  {!isCollapsed && <span className={`app-sidebar__chevron ${isOpen ? 'open' : ''}`}><ChevronRightIcon className="sidebar-icon sidebar-icon--xs" /></span>}
                </button>
                {!isCollapsed && isOpen && (
                  <div className="app-sidebar__subnav">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={handleLinkClick}
                        className={({ isActive }) =>
                          `app-sidebar__link app-sidebar__link--child ${isActive ? 'is-active' : ''}`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={({ isActive }) => `app-sidebar__link ${isActive ? 'is-active' : ''}`}
            >
              <MenuIcon icon={item.icon} />
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>


    </aside>
    </>
  );
};

export default Sidebar;
