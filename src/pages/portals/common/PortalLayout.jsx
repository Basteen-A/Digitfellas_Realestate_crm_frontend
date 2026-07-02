import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useThemeContext } from '../../../contexts/ThemeContext';
import { logout } from '../../../redux/slices/authSlice';
import notificationApi from '../../../api/notificationApi';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import userApi from '../../../api/userApi';
import { getRoleCode, hasTaskPortalAccess, hasAnyRole } from '../../../utils/permissions';
import { portalTaskMenuItem } from '../../../components/layout/Sidebar/menuConfig';
import { useWebSocket } from '../../../hooks/useWebSocket';
import PortalSidebar from './PortalSidebar';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import {
  Bars3Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  BellIcon,
  UserIcon,
  LockClosedIcon,
  DocumentMagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PhoneXMarkIcon,
  CheckCircleIcon,
  TagIcon,
  CalendarDaysIcon,
  UserPlusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import './PortalSidebar.css';

const ICON_STYLE = { width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 6 };

// Phone helpers — mirror the new-lead creation form so the lookup input behaves identically.
const sanitizePhoneNumberInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 12);

const SCREEN_TITLES = {
  dashboard: 'Dashboard',
  leads: '',
  'leads-addnew': '',
  handoffs: '',
  followups: "Today's Follow Ups",
  pipeline: '',
  addlead: 'Add New Lead',
  calllog: '',
  visits: '',
  sitevisits: '',
  incoming: '',
  tasks: '',
  departments: '',
  'sub-departments': '',
  documents: '',
  push: 'Push to Sales Head',
  negotiations: '',
  bookings: '',
  bookingsummary: '',
  approvals: 'Pending Approvals',
  allleads: 'All Leads',
  smteam: '',
  team: '',
  revenue: 'Revenue',
  users: 'User Management',
  projects: 'Projects',
  analytics: 'Analytics',
  inventory: 'Inventory',
  'open-bookings': '',
  demands: '',
  payments: '',
  overdue: '',
  reports: '',
  pullrequests: '',
  pull: '',
  cancellations: '',
  verify: '',
  verified: '',
  rejected: '',
  reconciliation: '',
};

const getWorkspaceBasePath = (pathname = '') => {
  if (pathname.startsWith('/telecaller/')) return '/telecaller/leads';
  if (pathname.startsWith('/sales-manager/')) return '/sales-manager/leads';
  if (pathname.startsWith('/sales-head/')) return '/sales-head/leads';
  if (pathname.startsWith('/collection/')) return '/collection/leads';
  if (pathname.startsWith('/accounts/')) return '/accounts/dashboard';
  if (pathname.startsWith('/accounts-manager/')) return '/accounts-manager/verify';
  if (pathname.startsWith('/collection-exec/')) return '/collection-exec/bookings';
  if (pathname.startsWith('/record-manager/')) return '/record-manager/bookings';
  if (pathname.startsWith('/task-portal/')) return '/task-portal/dashboard';
  return null;
};

const getWorkspaceScreenStorageKey = (pathname = '') => {
  const basePath = getWorkspaceBasePath(pathname);
  return basePath ? `portalActiveScreen:${basePath}` : null;
};

const getStoredScreen = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
};

const setStoredScreen = (storageKey, screen) => {
  if (!storageKey || !screen || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey, screen);
  } catch {
    // ignore storage failures
  }
};

const PortalLayout = ({ menuItems, roleName, user, defaultScreen, children, searchPlaceholder, onNavigateOverride }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeContext();
  const roleCode = getRoleCode(user);
  const canUsePhoneLookup = !['COL', 'ACCT', 'SE', 'RM', 'AM', 'CE'].includes(roleCode);
  const isAdmin = ['SA', 'ADM'].includes(roleCode);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryScreen = searchParams.get('screen') || '';
  const workspaceScreenStorageKey = useMemo(() => getWorkspaceScreenStorageKey(location.pathname), [location.pathname]);
  const storedScreen = getStoredScreen(workspaceScreenStorageKey);

  // Append the embedded Tasks screen to this portal's own sidebar when the user
  // has Standard Executive (task) access, replacing the old external link.
  const resolvedMenuItems = useMemo(() => {
    if (!hasTaskPortalAccess(user)) return menuItems;
    if (menuItems?.some((item) => item.key === 'tasks')) return menuItems;
    return [...(menuItems || []), portalTaskMenuItem];
  }, [menuItems, user]);
  
  const [activeScreen, setActiveScreen] = useState(() => queryScreen || location.state?.screen || storedScreen || defaultScreen || 'dashboard');
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const topbarMenuRef = useRef(null);

  // ── Notifications (bell dropdown) ──
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifBellPulse, setNotifBellPulse] = useState(false);
  const notifMenuRef = useRef(null);
  const [phoneLookupOpen, setPhoneLookupOpen] = useState(false);
  const [phoneLookupValue, setPhoneLookupValue] = useState('');
  const [phoneLookupCountryCode, setPhoneLookupCountryCode] = useState('+91');
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneLookupResults, setPhoneLookupResults] = useState([]);
  const [phoneLookupError, setPhoneLookupError] = useState('');
  const [phoneLookupSearched, setPhoneLookupSearched] = useState(false);
  const [screenContext, setScreenContext] = useState(null);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [pointsHistoryData, setPointsHistoryData] = useState(null);
  const [pointsHistoryLoading, setPointsHistoryLoading] = useState(false);

  useEffect(() => {
    if (pointsModalOpen && user?.id) {
      setPointsHistoryLoading(true);
      userApi.getPointsHistory(user.id)
        .then((res) => {
          setPointsHistoryData(res.data?.data || res.data);
        })
        .catch((err) => {
          toast.error(err.response?.data?.message || 'Failed to load points history');
        })
        .finally(() => {
          setPointsHistoryLoading(false);
        });
    }
  }, [pointsModalOpen, user?.id]);

  const locationScreen = location.state?.screen;
  const locationScreenData = location.state?.screenData;

  useEffect(() => {
    if (locationScreen) {
      setActiveScreen(locationScreen);
      setScreenContext(locationScreenData || null);
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
    }
  }, [locationScreen, locationScreenData, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!locationScreen && queryScreen) {
      setActiveScreen(queryScreen);
    }
  }, [locationScreen, queryScreen]);

  useEffect(() => {
    if (!workspaceScreenStorageKey || !activeScreen) return;

    setStoredScreen(workspaceScreenStorageKey, activeScreen);

    if (queryScreen === activeScreen) return;

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set('screen', activeScreen);
    navigate({ pathname: location.pathname, search: `?${nextSearchParams.toString()}` }, { replace: true });
  }, [activeScreen, location.pathname, location.search, navigate, queryScreen, workspaceScreenStorageKey]);

  const handleNavigate = useCallback((key, context = null) => {
    if (onNavigateOverride) {
      onNavigateOverride(key, context);
    } else {
      setActiveScreen(key);
      setScreenContext(context);
    }
    // Auto-collapse sidebar on desktop after navigating
    if (window.innerWidth >= 1024) {
      setSidebarCollapsed(true);
    }
  }, [onNavigateOverride]);

  const initials = useMemo(() => {
    const first = user?.firstName?.[0] || user?.first_name?.[0] || '';
    const last = user?.lastName?.[0] || user?.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'U';
  }, [user]);

  const fullName = user?.fullName || user?.full_name || `${user?.firstName || user?.first_name || ''} ${user?.lastName || user?.last_name || ''}`.trim() || 'User';

  // ── Notification loaders ──
  const loadNotifUnread = useCallback(async () => {
    try {
      const resp = await notificationApi.getUnreadCount();
      setNotifUnread(resp.data?.data?.count || 0);
    } catch { /* silent — badge just stays as-is */ }
  }, []);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      // Only the unread items. Reading one keeps it on the list, but closing the
      // panel marks everything read and clears it, so it reopens empty until new
      // notifications arrive.
      const resp = await notificationApi.getAll({ limit: 20, unread: 'true' });
      const rows = resp.data?.data || [];
      setNotifications(rows);
      setNotifUnread(rows.length);
      return rows;
    } catch { /* silent */ } finally {
      setNotifLoading(false);
    }
    return [];
  }, []);

  const handleIncomingNotification = useCallback((notif) => {
    if (!notif) return;

    setNotifications((prev) => {
      const next = [notif, ...prev.filter((item) => item.id !== notif.id)];
      return next.slice(0, 20);
    });

    setNotifUnread((current) => current + (notif.is_read ? 0 : 1));
    setNotifBellPulse(true);

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([80, 40, 80]);
    }

    if (!notifOpen) {
      toast.success(notif.message || notif.title || 'New notification', { duration: 2500 });
    }
  }, [notifOpen]);

  useWebSocket({ onNotification: handleIncomingNotification });

  useEffect(() => {
    if (!notifBellPulse) return undefined;
    const t = setTimeout(() => setNotifBellPulse(false), 1600);
    return () => clearTimeout(t);
  }, [notifBellPulse]);

  // Keep the unread badge fresh (initial load + light polling).
  useEffect(() => {
    loadNotifUnread();
    const t = setInterval(loadNotifUnread, 60000);
    return () => clearInterval(t);
  }, [loadNotifUnread]);

  const handleMarkAllNotifRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setNotifUnread(0);
    try { await notificationApi.markAllAsRead(); } catch { /* silent */ }
  }, []);

  // Closing the panel clears it: everything that was shown is marked read and
  // wiped, so the next open starts empty until new notifications come in.
  const clearNotifications = useCallback(async () => {
    setNotifications([]);
    setNotifUnread(0);
    try { await notificationApi.markAllAsRead(); } catch { /* silent */ }
  }, []);

  const closeNotif = useCallback(async () => {
    setNotifOpen(false);
    await clearNotifications();
  }, [clearNotifications]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topbarMenuRef.current && !topbarMenuRef.current.contains(e.target)) {
        setTopbarMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        closeNotif();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeNotif]);

  const toggleNotif = async () => {
    if (notifOpen) {
      await closeNotif();
      return;
    }

    await loadNotifications();
    setNotifOpen(true);
  };

  const handleNotifClick = async (n) => {
    // Reading one just marks it read — the rest stay on the list until you close.
    if (!n.is_read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setNotifUnread((c) => Math.max(0, c - 1));
      try { await notificationApi.markAsRead(n.id); } catch { /* silent */ }
    }
    // Opening a link dismisses the panel → clear it like any other close.
    if (n.link && String(n.link).startsWith('/')) {
      await clearNotifications();
      setNotifOpen(false);
      navigate(n.link);
    }
  };

  const handleLogout = async () => {
    setTopbarMenuOpen(false);
    await dispatch(logout());
    toast.success('Logged out');
    navigate('/login');
  };

  const normalizePhoneLookup = (value) => String(value || '').replace(/\D/g, '').slice(0, 15);

  const formatLookupDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const lookupInitials = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return `${parts[0][0] || ''}${parts.length > 1 ? parts[parts.length - 1][0] || '' : ''}`.toUpperCase();
  };

  const resetPhoneLookup = useCallback(() => {
    setPhoneLookupValue('');
    setPhoneLookupCountryCode('+91');
    setPhoneLookupResults([]);
    setPhoneLookupError('');
    setPhoneLookupSearched(false);
    setPhoneLookupLoading(false);
  }, []);

  const openPhoneLookup = useCallback(() => {
    if (!canUsePhoneLookup) return;
    resetPhoneLookup();
    setPhoneLookupOpen(true);
  }, [canUsePhoneLookup, resetPhoneLookup]);

  const closePhoneLookup = useCallback(() => {
    setPhoneLookupOpen(false);
    resetPhoneLookup();
  }, [resetPhoneLookup]);

  const handlePhoneLookup = useCallback(async (event) => {
    event.preventDefault();
    if (!canUsePhoneLookup) return;
    const phone = sanitizePhoneNumberInput(phoneLookupValue);

    if (phone.length < 7) {
      setPhoneLookupError('Enter at least 7 digits.');
      setPhoneLookupResults([]);
      setPhoneLookupSearched(false);
      return;
    }

    setPhoneLookupLoading(true);
    setPhoneLookupError('');

    try {
      const response = await leadWorkflowApi.searchLeadByPhone(phone, phoneLookupCountryCode);
      const rows = Array.isArray(response) ? response : response?.data || [];
      setPhoneLookupResults(rows);
      setPhoneLookupSearched(true);
    } catch (error) {
      setPhoneLookupResults([]);
      setPhoneLookupSearched(false);
      setPhoneLookupError(error?.response?.data?.message || 'Unable to check this phone number.');
    } finally {
      setPhoneLookupLoading(false);
    }
  }, [canUsePhoneLookup, phoneLookupCountryCode, phoneLookupValue]);

  const handleCreateLeadFromLookup = useCallback(() => {
    const phone = normalizePhoneLookup(phoneLookupValue);
    if (!phone) return;
    closePhoneLookup();
    handleNavigate('leads-addnew', { prefillPhone: phone });
  }, [closePhoneLookup, handleNavigate, phoneLookupValue]);

  useEffect(() => {
    if (!canUsePhoneLookup && phoneLookupOpen) {
      closePhoneLookup();
    }
  }, [canUsePhoneLookup, phoneLookupOpen, closePhoneLookup]);

  return (
    <div className="portal-layout">
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}
      <PortalSidebar
        menuItems={resolvedMenuItems}
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

          {SCREEN_TITLES[activeScreen] !== undefined ? (
            SCREEN_TITLES[activeScreen] ? (
              <div className="portal-topbar__title">
                {SCREEN_TITLES[activeScreen]}
              </div>
            ) : null
          ) : (
            <div className="portal-topbar__title">
              {activeScreen}
            </div>
          )}
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
            {canUsePhoneLookup && (
              <button
                type="button"
                className={`portal-topbar-btn ${phoneLookupOpen ? 'is-notif-pulse' : ''}`}
                onClick={openPhoneLookup}
                title="Check phone number"
                aria-label="Check phone number"
              >
                <DocumentMagnifyingGlassIcon style={{ width: 20, height: 20 }} />
              </button>
            )}
            <div className="portal-topbar__notif-menu" ref={notifMenuRef}>
              <button
                type="button"
                className={`portal-topbar-btn ${notifBellPulse ? 'is-notif-pulse' : ''}`}
                onClick={toggleNotif}
                title="Notifications"
                aria-label="Notifications"
              >
                <BellIcon style={{ width: 20, height: 20 }} />
                {notifUnread > 0 && <span className="notif-dot"></span>}
              </button>

              {notifOpen && (
                <div className="portal-topbar__user-dropdown portal-topbar__notif-dropdown">
                  <div className="portal-topbar__notif-header">
                    <strong>Notifications{notifUnread > 0 ? ` (${notifUnread})` : ''}</strong>
                    {notifUnread > 0 && (
                      <button type="button" className="portal-topbar__notif-markall" onClick={handleMarkAllNotifRead}>
                        Clear new
                      </button>
                    )}
                  </div>
                  <div className="portal-topbar__notif-list">
                    {notifLoading ? (
                      <div className="portal-topbar__notif-empty">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="portal-topbar__notif-empty">You&apos;re all caught up</div>
                    ) : (
                      notifications.map((n) => {
                        const isLead = String(n.entity_type || '').toLowerCase() === 'lead';
                        return (
                          <button
                            key={n.id}
                            type="button"
                            className={`portal-topbar__notif-item ${n.is_read ? '' : 'is-unread'}`}
                            onClick={() => handleNotifClick(n)}
                          >
                            <span className="portal-topbar__notif-icon">
                              {isLead
                                ? <UserIcon style={{ width: 16, height: 16 }} />
                                : <BellIcon style={{ width: 16, height: 16 }} />}
                            </span>
                            <span className="portal-topbar__notif-text">
                              <span className="portal-topbar__notif-title">{n.title}</span>
                              {n.message && <span className="portal-topbar__notif-msg">{n.message}</span>}
                            </span>
                            {!n.is_read && <span className="portal-topbar__notif-unreaddot" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

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
                  {hasAnyRole(user, ['SM', 'SH']) && (
                    <button type="button" className="portal-topbar__dropdown-item" onClick={() => { setTopbarMenuOpen(false); setPointsModalOpen(true); }}>
                      <span style={{ fontSize: 13, marginRight: 6 }}>🏆</span> Reward Points
                    </button>
                  )}
                  {isAdmin && (
                    <button type="button" className="portal-topbar__dropdown-item" onClick={() => { setTopbarMenuOpen(false); navigate('/dashboard'); }}>
                      <ChevronLeftIcon style={ICON_STYLE} /> Back to CRM
                    </button>
                  )}
                  <div className="portal-topbar__dropdown-divider" />
                  <button type="button" className="portal-topbar__dropdown-item portal-topbar__dropdown-item--danger" onClick={handleLogout}>
                    <ArrowRightOnRectangleIcon style={ICON_STYLE} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {canUsePhoneLookup && phoneLookupOpen && (
          <div className="portal-phone-modal-overlay" onClick={closePhoneLookup} role="presentation">
            <div className="portal-phone-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="portal-phone-modal__header">
                <div>
                  <h3>Phone number lookup</h3>
                  <p>Check if a number exists in the CRM and who owns it</p>
                </div>
                <button type="button" className="portal-phone-modal__close" onClick={closePhoneLookup} aria-label="Close lookup">
                  <XMarkIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <form className="portal-phone-modal__form" onSubmit={handlePhoneLookup}>
                <label className="portal-phone-modal__label" htmlFor="portal-phone-lookup">
                  Enter phone number
                </label>
                <div className="portal-phone-modal__input-row">
                  <div className="portal-phone-lookup-wrap" data-dial={phoneLookupCountryCode}>
                    <PhoneInput
                      country="in"
                      enableSearch
                      disableCountryCode
                      disableCountryGuess
                      value={phoneLookupValue}
                      onChange={(value, data) => {
                        // disableCountryCode → value is the national number only.
                        const dialCode = data?.dialCode ? `+${data.dialCode}` : '+91';
                        setPhoneLookupCountryCode(dialCode);
                        setPhoneLookupValue(sanitizePhoneNumberInput(value));
                      }}
                      inputProps={{ id: 'portal-phone-lookup', name: 'phone', placeholder: 'Phone number' }}
                      containerClass="portal-phone-lookup-input"
                      inputClass="portal-phone-lookup-input__control"
                      buttonClass="portal-phone-lookup-input__button"
                      dropdownClass="portal-phone-lookup-input__dropdown"
                    />
                  </div>
                  <button type="submit" className="portal-phone-modal__check-btn" disabled={phoneLookupLoading}>
                    <MagnifyingGlassIcon style={{ width: 16, height: 16 }} />
                    {phoneLookupLoading ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </form>

              {phoneLookupError && (
                <div className="portal-phone-modal__notice portal-phone-modal__notice--error">
                  <ExclamationTriangleIcon style={{ width: 16, height: 16 }} />
                  <span>{phoneLookupError}</span>
                </div>
              )}

              <div className="portal-phone-modal__body">
                {!phoneLookupSearched && !phoneLookupError && (
                  <div className="portal-phone-modal__empty-state">
                    <PhoneXMarkIcon className="portal-phone-modal__empty-icon" />
                    <p>Enter a number above to check its status and assigned owner</p>
                  </div>
                )}

                {phoneLookupSearched && phoneLookupResults.length === 0 && (
                  <div className="portal-phone-modal__notfound">
                    <PhoneXMarkIcon className="portal-phone-modal__empty-icon" />
                    <p>No lead found for this number.</p>
                    {roleName === 'Telecaller' && (
                      <button type="button" className="portal-phone-modal__primary" onClick={handleCreateLeadFromLookup}>
                        <PlusIcon style={{ width: 16, height: 16 }} />
                        Create new lead with this number
                      </button>
                    )}
                  </div>
                )}

                {phoneLookupSearched && phoneLookupResults.length > 0 && (
                  <>
                    <div className="portal-phone-modal__found">
                      <CheckCircleIcon style={{ width: 18, height: 18 }} />
                      <span>Number found in CRM</span>
                    </div>

                    {phoneLookupResults.map((lead) => (
                      <div key={lead.id} className="portal-phone-modal__result-card">
                        <div className="portal-phone-modal__row">
                          <span className="portal-phone-modal__row-label">
                            <UserIcon style={{ width: 16, height: 16 }} /> Lead name
                          </span>
                          <span className="portal-phone-modal__row-value">
                            {lead.fullName || lead.leadNumber || 'Unnamed lead'}
                          </span>
                        </div>

                        <div className="portal-phone-modal__row">
                          <span className="portal-phone-modal__row-label">
                            <TagIcon style={{ width: 16, height: 16 }} /> Status
                          </span>
                          <span className="portal-phone-modal__row-value">
                            <span className={`portal-phone-modal__badge ${lead.isClosed ? 'is-closed' : 'is-open'}`}>
                              {lead.currentStatus || lead.statusLabel || 'Unknown'}
                            </span>
                          </span>
                        </div>

                        <div className="portal-phone-modal__divider" />

                        <div className="portal-phone-modal__row">
                          <span className="portal-phone-modal__row-label">
                            <UserPlusIcon style={{ width: 16, height: 16 }} /> Assigned to
                          </span>
                          <span className="portal-phone-modal__row-value portal-phone-modal__assignee">
                            <span className="portal-phone-modal__avatar">{lookupInitials(lead.assignedToName)}</span>
                            {lead.assignedToName || 'Unassigned'}
                          </span>
                        </div>

                        <div className="portal-phone-modal__row">
                          <span className="portal-phone-modal__row-label">
                            <CalendarDaysIcon style={{ width: 16, height: 16 }} /> Next follow-up
                          </span>
                          <span className="portal-phone-modal__row-value">
                            {formatLookupDate(lead.nextFollowUpDate)}
                          </span>
                        </div>

                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {pointsModalOpen && (
          <div className="portal-phone-modal-overlay" onClick={() => setPointsModalOpen(false)} role="presentation">
            <div className="portal-phone-modal" role="dialog" aria-modal="true" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
              <div className="portal-phone-modal__header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, fontSize: 16 }}>🏆 Loyalty &amp; Reward Points</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5 }}>Your performance points history and lead breakdown</p>
                </div>
                <button type="button" className="portal-phone-modal__close" onClick={() => setPointsModalOpen(false)} aria-label="Close points history">
                  <XMarkIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div className="portal-phone-modal__body" style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
                {pointsHistoryLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 13, fontStyle: 'italic' }}>
                    Loading points data...
                  </div>
                ) : (
                  <div>
                    {/* Points Summary Header Card */}
                    <div style={{ 
                      background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', 
                      color: '#fff', 
                      borderRadius: 12, 
                      padding: '20px 24px', 
                      textAlign: 'center',
                      marginBottom: 24,
                      boxShadow: '0 4px 12px rgba(234, 179, 8, 0.15)'
                    }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
                        Total Cumulative Balance
                      </div>
                      <div style={{ fontSize: 40, fontWeight: 800, marginTop: 4, letterSpacing: '-0.5px' }}>
                        {pointsHistoryData?.total_points || 0} <span style={{ fontSize: 20, fontWeight: 600 }}>pts</span>
                      </div>
                    </div>

                    {/* Per-Lead Breakdown */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 0 }}>
                        Per-Lead Breakdown
                      </h4>
                      {!pointsHistoryData?.per_lead || Object.keys(pointsHistoryData.per_lead).length === 0 ? (
                        <div style={{ background: 'var(--bg-secondary, #f8fafc)', border: '1px dashed var(--border-primary, #e2e8f0)', borderRadius: 8, padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12.5 }}>
                          No points recorded per lead yet
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-secondary, #f8fafc)', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Lead Name</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Booking Number</th>
                                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Total Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(pointsHistoryData.per_lead).map(([leadId, details]) => (
                                <tr key={leadId} style={{ borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>{details.name}</td>
                                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{details.booking_number || '—'}</td>
                                  <td style={{ 
                                    padding: '10px 12px', 
                                    textAlign: 'right', 
                                    fontWeight: 700, 
                                    color: details.points >= 0 ? '#16a34a' : '#dc2626' 
                                  }}>
                                    {details.points > 0 ? `+${details.points}` : details.points}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Detailed Transaction Ledger */}
                    <div>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, marginTop: 0 }}>
                        Points Transaction Log
                      </h4>
                      {!pointsHistoryData?.history || pointsHistoryData.history.length === 0 ? (
                        <div style={{ background: 'var(--bg-secondary, #f8fafc)', border: '1px dashed var(--border-primary, #e2e8f0)', borderRadius: 8, padding: '20px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12.5 }}>
                          No point transactions recorded yet
                        </div>
                      ) : (
                        <div style={{ 
                          maxHeight: 180, 
                          overflowY: 'auto', 
                          border: '1px solid var(--border-primary, #e2e8f0)', 
                          borderRadius: 8 
                        }}>
                          {pointsHistoryData.history.map((entry, idx) => (
                            <div 
                              key={entry.id || idx} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '10px 12px', 
                                borderBottom: idx < pointsHistoryData.history.length - 1 ? '1px solid var(--border-primary, #e2e8f0)' : 'none',
                                fontSize: 12
                              }}
                            >
                              <div style={{ minWidth: 0, marginRight: 12 }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {entry.reason || 'Points Award'}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted, #9ca3af)', marginTop: 2 }}>
                                  Awarded by {entry.awardedByUser ? `${entry.awardedByUser.first_name} ${entry.awardedByUser.last_name}` : 'System'} on {new Date(entry.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ 
                                  fontWeight: 700, 
                                  fontSize: 12.5, 
                                  color: entry.points >= 0 ? '#16a34a' : '#dc2626' 
                                }}>
                                  {entry.points > 0 ? `+${entry.points}` : entry.points}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted, #9ca3af)', marginTop: 2 }}>
                                  Bal: {entry.balance_after}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="portal-content">
          {typeof children === 'function'
            ? children({ activeScreen, setActiveScreen: handleNavigate, screenContext })
            : children}
        </div>
      </div>
    </div>
  );
};

export default PortalLayout;
