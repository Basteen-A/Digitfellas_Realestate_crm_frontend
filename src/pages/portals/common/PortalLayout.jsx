import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useThemeContext } from '../../../contexts/ThemeContext';
import { logout } from '../../../redux/slices/authSlice';
import PortalSidebar from './PortalSidebar';
import {
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  UserIcon,
  LockClosedIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import './PortalSidebar.css';

const ICON_STYLE = { width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 6 };

const SCREEN_TITLES = {
  dashboard: 'Dashboard',
  leads: 'My Leads',
  handoffs: 'Handoff Leads',
  followups: "Today's Follow Ups",
  pipeline: 'Pipeline Board',
  addlead: 'Add New Lead',
  calllog: 'Call Log',
  visits: 'Site Visits',
  sitevisits: 'Site Visits',
  incoming: 'Incoming Leads',
  push: 'Push to Sales Head',
  negotiations: 'Negotiations',
  bookings: 'Bookings',
  approvals: 'Pending Approvals',
  allleads: 'All Leads',
  smteam: 'SM Team Management',
  team: 'Team Performance',
  revenue: 'Revenue',
  users: 'User Management',
  projects: 'Projects',
  analytics: 'Analytics',
  inventory: 'Inventory',
};

const PortalLayout = ({ menuItems, roleName, user, defaultScreen, children, searchPlaceholder, onNavigateOverride }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeContext();
  
  const [activeScreen, setActiveScreen] = useState(() => location.state?.screen || defaultScreen || 'dashboard');
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const topbarMenuRef = useRef(null);

  useEffect(() => {
    if (location.state?.screen) {
      setActiveScreen(location.state.screen);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.screen, location.pathname, navigate]);

  const handleNavigate = (key) => {
    if (onNavigateOverride) {
      onNavigateOverride(key);
    } else {
      setActiveScreen(key);
    }
    // Auto-collapse sidebar on desktop after navigating
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(true);
    }
  };

  const initials = useMemo(() => {
    const first = user?.firstName?.[0] || user?.first_name?.[0] || '';
    const last = user?.lastName?.[0] || user?.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'U';
  }, [user]);

  const fullName = user?.fullName || user?.full_name || `${user?.firstName || user?.first_name || ''} ${user?.lastName || user?.last_name || ''}`.trim() || 'User';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topbarMenuRef.current && !topbarMenuRef.current.contains(e.target)) {
        setTopbarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setTopbarMenuOpen(false);
    await dispatch(logout());
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="portal-layout">
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <PortalSidebar
        menuItems={menuItems}
        activeScreen={activeScreen}
        onNavigate={(key) => { handleNavigate(key); setMobileMenuOpen(false); }}
        user={user}
        roleName={roleName}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className={`portal-main ${sidebarCollapsed ? 'is-expanded' : ''}`}>
        <div className="portal-topbar">
          <button
            type="button"
            className="portal-topbar-btn lg:hidden mr-2"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Bars3Icon style={{ width: 20, height: 20 }} />
          </button>
          <button
            type="button"
            className="portal-topbar-btn hidden lg:inline-flex mr-2"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed
              ? <ChevronRightIcon style={{ width: 18, height: 18 }} />
              : <ChevronLeftIcon style={{ width: 18, height: 18 }} />
            }
          </button>
          <div className="portal-topbar__title">
            {SCREEN_TITLES[activeScreen] || activeScreen}
          </div>
          <div className="portal-topbar__center">
            {/* Search bar placeholder */}
          </div>
          <div className="portal-topbar__right">
            <button
              type="button"
              className="portal-topbar-btn"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark
                ? <SunIcon style={{ width: 20, height: 20 }} />
                : <MoonIcon style={{ width: 20, height: 20 }} />
              }
            </button>
            <button className="portal-topbar-btn" type="button">
              <BellIcon style={{ width: 20, height: 20 }} /><span className="notif-dot"></span>
            </button>

            {/* User Menu */}
            <div className="portal-topbar__user-menu" ref={topbarMenuRef}>
              <button
                type="button"
                className="portal-topbar__user-trigger"
                onClick={() => setTopbarMenuOpen((v) => !v)}
              >
                <span className="portal-topbar__user-avatar">{initials}</span>
                <span className="portal-topbar__user-name">{fullName}</span>
              </button>

              {topbarMenuOpen && (
                <div className="portal-topbar__user-dropdown">
                  <div className="portal-topbar__dropdown-header">
                    <strong>{fullName}</strong>
                    <small>{roleName}</small>
                  </div>
                  <div className="portal-topbar__dropdown-divider" />
                  <button type="button" className="portal-topbar__dropdown-item" onClick={() => { setTopbarMenuOpen(false); navigate('/portal/profile'); }}>
                    <UserIcon style={ICON_STYLE} /> My Profile
                  </button>
                  <button type="button" className="portal-topbar__dropdown-item" onClick={() => { setTopbarMenuOpen(false); navigate('/portal/profile/change-password'); }}>
                    <LockClosedIcon style={ICON_STYLE} /> Change Password
                  </button>
                  <div className="portal-topbar__dropdown-divider" />
                  <button type="button" className="portal-topbar__dropdown-item portal-topbar__dropdown-item--danger" onClick={handleLogout}>
                    <ArrowRightOnRectangleIcon style={ICON_STYLE} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="portal-content">
          {typeof children === 'function'
            ? children({ activeScreen, setActiveScreen: handleNavigate })
            : children}
        </div>
      </div>
    </div>
  );
};

export default PortalLayout;
