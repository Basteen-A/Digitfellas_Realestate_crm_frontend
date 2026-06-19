import React, { useState, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { getSidebarMenuForRole, getTaskMenuItem, ROLE_LABELS } from './menuConfig';
import { getRoleCode } from '../../../utils/permissions';
import { logout } from '../../../redux/slices/authSlice';
import { XMarkIcon, ChevronRightIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useSiteSettings } from '../../../contexts/SiteSettingsContext';
import './Sidebar.css';

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
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { siteTitle, logoFull, logoMark } = useSiteSettings();

  const fullName = user?.fullName || user?.full_name
    || `${user?.firstName || user?.first_name || ''} ${user?.lastName || user?.last_name || ''}`.trim()
    || 'User';
  const initials = (`${(user?.firstName || user?.first_name || '')[0] || ''}${(user?.lastName || user?.last_name || '')[0] || ''}`).toUpperCase() || 'U';
  const roleLabel = ROLE_LABELS[roleCode] || user?.userType || '';

  const handleLogout = async () => {
    try { await dispatch(logout()); } catch { /* ignore */ }
    toast.success('Logged out');
    navigate('/login');
  };

  // Determine which group contains the current path so it auto-opens
  const menu = React.useMemo(() => {
    const base = getSidebarMenuForRole(roleCode, user);
    // SA/ADM now have Tasks + Departments/Sub-Departments directly in their admin
    // sidebar (and the task dashboard embedded on their main Dashboard), so no
    // standalone-portal link for them. Standard Executive still uses /task-portal.
    if (roleCode === 'SE') {
      return [...base, getTaskMenuItem(roleCode)];
    }
    return base;
  }, [roleCode, user]);

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
          className="fixed inset-0 bg-black/50 z-[450] md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside className={`app-sidebar ${isCollapsed ? 'app-sidebar--collapsed' : ''} ${isMobile ? 'fixed left-0 top-0 z-[460] w-64 transform transition-transform duration-300' : ''} ${isMobile && !isMobileOpen ? '-translate-x-full' : ''} ${isMobile ? 'md:relative md:translate-x-0 md:z-auto' : ''}`}>
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            className="app-sidebar__close"
            aria-label="Close sidebar"
          >
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        )}
      {/* Brand — same as the portal sidebar: full logo when expanded, square
          mark on the collapsed rail. No extra text. */}
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo">
          <img src={logoFull} alt={siteTitle} className="sidebar-logo sidebar-logo--full" />
          <img src={logoMark} alt={siteTitle} className="sidebar-logo sidebar-logo--mark" />
        </div>
      </div>

      {/* Navigation. Labels/chevrons always render; CSS hides them on the
          collapsed rail and reveals them again on hover (portal-style). */}
      <nav className="app-sidebar__nav">
        {menu.map((item) => {
          // Section divider label (WORKSPACE / INVENTORY / ADMINISTRATION)
          if (item.section) {
            return <div key={`sec-${item.section}`} className="app-sidebar__section-label">{item.section}</div>;
          }
          if (item.children?.length) {
            const isOpen = !!openGroups[item.label];
            const hasActiveChild = item.children.some((child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'));

            return (
              <div key={item.label} className={`app-sidebar__group ${hasActiveChild ? 'has-active-child' : ''}`}>
                <button type="button" className={`app-sidebar__group-button ${isOpen ? 'is-open' : ''}`} onClick={() => toggleGroup(item.label)} title={item.label}>
                  <MenuIcon icon={item.icon} />
                  <span className="app-sidebar__link-label">{item.label}</span>
                  <span className={`app-sidebar__chevron ${isOpen ? 'open' : ''}`}><ChevronRightIcon className="sidebar-icon sidebar-icon--xs" /></span>
                </button>
                {isOpen && (
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
                        <span className="app-sidebar__link-label">{child.label}</span>
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
              title={item.label}
            >
              <MenuIcon icon={item.icon} />
              <span className="app-sidebar__link-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer — profile + logout (mirrors the header user menu) */}
      <div className="app-sidebar__footer">
        <div className="app-sidebar__profile">
          <NavLink
            to="/profile"
            onClick={handleLinkClick}
            className={({ isActive }) => `app-sidebar__profile-link ${isActive ? 'is-active' : ''}`}
            title={fullName}
          >
            <span className="app-sidebar__profile-avatar">{initials}</span>
            <span className="app-sidebar__profile-info">
              <span className="app-sidebar__profile-name">{fullName}</span>
              {roleLabel && <span className="app-sidebar__profile-role">{roleLabel}</span>}
            </span>
          </NavLink>
          <button type="button" className="app-sidebar__logout-btn" onClick={handleLogout} title="Logout" aria-label="Logout">
            <ArrowRightOnRectangleIcon className="sidebar-icon" />
          </button>
        </div>
      </div>

    </aside>
    </>
  );
};

export default Sidebar;
