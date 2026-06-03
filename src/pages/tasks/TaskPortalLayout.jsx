import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Squares2X2Icon,
  ClipboardDocumentCheckIcon,
  BuildingOffice2Icon,
  RectangleGroupIcon,
  ArrowLeftOnRectangleIcon,
  ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';
import { logout } from '../../redux/slices/authSlice';
import { getRoleCode } from '../../utils/permissions';
import './TaskManagement.css';

const TaskPortalLayout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const isAdmin = ['SA', 'ADM'].includes(getRoleCode(user));
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = `${(user?.firstName || user?.first_name || '?')[0] || ''}${(user?.lastName || user?.last_name || '')[0] || ''}`.toUpperCase();
  const name = user?.fullName || user?.full_name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const roleLabel = isAdmin ? 'Super Admin' : 'Standard Executive';

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login', { replace: true });
  };

  const links = [
    { to: '/task-portal/dashboard', label: 'Dashboard', icon: Squares2X2Icon },
    { to: '/task-portal/tasks', label: 'Tasks', icon: ClipboardDocumentCheckIcon },
  ];
  if (isAdmin) {
    links.push({ to: '/task-portal/departments', label: 'Departments', icon: BuildingOffice2Icon });
    links.push({ to: '/task-portal/sub-departments', label: 'Sub-Departments', icon: RectangleGroupIcon });
  }

  return (
    <div className="tmp-shell">
      <aside className="tmp-sidebar">
        <div className="tmp-brand">
          <span className="tmp-brand__mark"><ClipboardDocumentCheckIcon /></span>
          <span className="tmp-brand__name">Task Management</span>
        </div>
        <nav className="tmp-nav">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `tmp-nav__link ${isActive ? 'is-active' : ''}`}
              >
                <Icon className="tmp-nav__icon" />
                <span>{l.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="tmp-sidebar__foot">
          {isAdmin && (
            <button type="button" className="tmp-nav__link tmp-nav__link--muted" onClick={() => navigate('/dashboard')}>
              <ArrowUturnLeftIcon className="tmp-nav__icon" />
              <span>Back to CRM</span>
            </button>
          )}
        </div>
      </aside>

      <div className="tmp-main">
        <header className="tmp-header">
          <div className="tmp-user" onClick={() => setMenuOpen((o) => !o)}>
            <span className="tmp-user__avatar">{initials || 'U'}</span>
            <span className="tmp-user__meta">
              <span className="tmp-user__name">{name || 'User'}</span>
              <span className="tmp-user__role">{roleLabel}</span>
            </span>
            {menuOpen && (
              <div className="tmp-user__menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={handleLogout}>
                  <ArrowLeftOnRectangleIcon style={{ width: 16, height: 16 }} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="tmp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TaskPortalLayout;
