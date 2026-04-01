import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { logout } from '../../../redux/slices/authSlice';

const UserMenu = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user } = useSelector((state) => state.auth);
  const menuRef = useRef(null);

  const initials = useMemo(() => {
    const first = user?.firstName?.[0] || user?.first_name?.[0] || '';
    const last = user?.lastName?.[0] || user?.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'U';
  }, [user]);

  const fullName = user?.fullName || user?.full_name || 'User';
  const roleLabel = user?.userType || user?.userTypeCode || '';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await dispatch(logout());
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button type="button" className="user-menu__trigger" onClick={() => setOpen((v) => !v)}>
        <span className="user-menu__avatar">{initials}</span>
        <span className="user-menu__name">{fullName}</span>
      </button>

      {open && (
        <div className="user-menu__dropdown">
          <div className="user-menu__dropdown-header">
            <strong>{fullName}</strong>
            {roleLabel && <small className="user-menu__role-badge">{roleLabel}</small>}
          </div>
          <div className="user-menu__divider" />
          <Link to="/profile" className="user-menu__item" onClick={() => setOpen(false)}>
            👤 Profile
          </Link>
          <Link to="/profile/change-password" className="user-menu__item" onClick={() => setOpen(false)}>
            🔒 Change Password
          </Link>
          <div className="user-menu__divider" />
          <button type="button" className="user-menu__item user-menu__item--danger" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
