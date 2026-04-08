import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { getSidebarMenuForRole, ROLE_LABELS } from './menuConfig';
import { getRoleCode } from '../../../utils/permissions';
import { logout } from '../../../redux/slices/authSlice';
import toast from 'react-hot-toast';
import './Sidebar.css';

const MOBILE_BREAKPOINT = 768;

const Sidebar = ({ isMobileOpen, onMobileClose }) => {
  const { sidebarCollapsed } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);
  const roleCode = useSelector((state) => getRoleCode(state.auth.user));
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [openGroups, setOpenGroups] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menu = getSidebarMenuForRole(roleCode);

  const toggleGroup = (label) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const fullName = user?.fullName || user?.full_name || 'User';
  const initials = (fullName.split(' ').map((w) => w[0]).join('').substring(0, 2) || 'U').toUpperCase();
  const roleLabel = ROLE_LABELS[roleCode] || roleCode || '';

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success('Logged out');
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside className={`app-sidebar ${sidebarCollapsed ? 'app-sidebar--collapsed' : ''} ${isMobile ? 'fixed left-0 top-0 z-50 w-64 transform transition-transform duration-300' : ''} ${isMobile && !isMobileOpen ? '-translate-x-full' : ''} ${isMobile ? 'md:relative md:translate-x-0 md:z-auto' : ''}`}>
        {isMobile && (
          <button
            type="button"
            onClick={onMobileClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 md:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        )}
      {/* Brand */}
      <div className="app-sidebar__brand">
        <span className="app-sidebar__logo">RC</span>
        {!sidebarCollapsed && <span className="app-sidebar__name">RealEstate CRM</span>}
      </div>

      {/* Role Badge */}
      {!sidebarCollapsed && (
        <div className="app-sidebar__role-badge">
          <span className="app-sidebar__role-dot" />
          <span>{roleLabel}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="app-sidebar__nav">
        {menu.map((item) => {
          if (item.children?.length) {
            const isOpen = openGroups[item.label] !== false; // default open
            return (
              <div key={item.label} className="app-sidebar__group">
                <button type="button" className="app-sidebar__group-button" onClick={() => toggleGroup(item.label)}>
                  <span>{item.icon || '▸'}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                  {!sidebarCollapsed && <span className={`app-sidebar__chevron ${isOpen ? 'open' : ''}`}>›</span>}
                </button>
                {!sidebarCollapsed && isOpen && (
                  <div className="app-sidebar__subnav">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
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
              <span>{item.icon || '•'}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Profile Section at Bottom */}
      <div className="app-sidebar__footer">
        <div className="app-sidebar__profile">
          <NavLink
            to="/profile"
            className={({ isActive }) => `app-sidebar__profile-link ${isActive ? 'is-active' : ''}`}
          >
            <span className="app-sidebar__profile-avatar">{initials}</span>
            {!sidebarCollapsed && (
              <div className="app-sidebar__profile-info">
                <span className="app-sidebar__profile-name">{fullName}</span>
                <span className="app-sidebar__profile-role">{roleLabel}</span>
              </div>
            )}
          </NavLink>
          {!sidebarCollapsed && (
            <button type="button" className="app-sidebar__logout-btn" onClick={handleLogout} title="Logout">
              🚪
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
