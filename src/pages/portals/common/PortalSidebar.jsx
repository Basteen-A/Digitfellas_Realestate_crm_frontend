import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { logout } from '../../../redux/slices/authSlice';
import './PortalSidebar.css';

const PortalSidebar = ({ menuItems, activeScreen, onNavigate, user, roleName }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = user
    ? `${(user.firstName || user.first_name || '')[0] || ''}${(user.lastName || user.last_name || '')[0] || ''}`.toUpperCase()
    : 'U';

  const fullName = user?.fullName || user?.full_name || `${user?.firstName || user?.first_name || ''} ${user?.lastName || user?.last_name || ''}`.trim() || 'User';

  const avatarColors = {
    Telecaller: 'crm-avatar-blue',
    'Sales Manager': 'crm-avatar-green',
    'Sales Head': 'crm-avatar-purple',
    'Super Admin': 'crm-avatar-orange',
    'Collection Manager': 'crm-avatar-cyan',
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await dispatch(logout());
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleProfile = () => {
    setUserMenuOpen(false);
    navigate('/profile');
  };

  const handleChangePassword = () => {
    setUserMenuOpen(false);
    navigate('/profile/change-password');
  };

  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar__brand">
        <div className="portal-sidebar__brand-icon">
          <img src="/sujatha.png" alt="Logo" className="sidebar-logo" />
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
              <span className="portal-sidebar__icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badgeCount > 0 && (
                <span className={`s-badge s-badge-${item.badgeColor || 'blue'}`}>
                  {item.badgeCount}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      <div className="portal-sidebar__footer" ref={menuRef}>
        {/* User dropdown menu */}
        {userMenuOpen && (
          <div className="portal-sidebar__user-dropdown">
            <button type="button" className="portal-sidebar__dropdown-item" onClick={handleProfile}>
              <span className="portal-sidebar__dropdown-icon">👤</span>
              My Profile
            </button>
            <button type="button" className="portal-sidebar__dropdown-item" onClick={handleChangePassword}>
              <span className="portal-sidebar__dropdown-icon">🔒</span>
              Change Password
            </button>
            <div className="portal-sidebar__dropdown-divider" />
            <button type="button" className="portal-sidebar__dropdown-item portal-sidebar__dropdown-item--danger" onClick={handleLogout}>
              <span className="portal-sidebar__dropdown-icon">🚪</span>
              Logout
            </button>
          </div>
        )}

        <div
          className={`portal-sidebar__user ${userMenuOpen ? 'is-open' : ''}`}
          onClick={() => setUserMenuOpen((v) => !v)}
        >
          <div className={`crm-avatar ${avatarColors[roleName] || 'crm-avatar-blue'}`}>
            {initials}
          </div>
          <div className="portal-sidebar__user-info">
            <div className="portal-sidebar__user-name">{fullName}</div>
            <div className="portal-sidebar__user-role">{roleName}</div>
          </div>
          <span className={`portal-sidebar__chevron ${userMenuOpen ? 'is-open' : ''}`}>▾</span>
        </div>
      </div>
    </aside>
  );
};

export default PortalSidebar;
