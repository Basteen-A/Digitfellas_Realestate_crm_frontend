import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getRoleCode } from '../utils/permissions';
import { hasModule } from '../utils/modulePermissions';
import { moduleForPath } from './routeModules';

/**
 * Route guard for the admin screens.
 *
 * Passes when EITHER:
 *   • the user's role is in `allowedRoles` (the built-in SA / ADM path - unchanged), or
 *   • the user's permission matrix grants the module this path maps to.
 *
 * That second branch is what lets a role created in Roles & Permissions actually
 * open the screens it was granted. Without it a custom role could be given, say,
 * Leads access and still be bounced to /dashboard by a hardcoded role list -
 * the sidebar would show the link and clicking it would do nothing useful.
 *
 * Fail-closed: a path with no entry in routeModules.js falls back to the role
 * allow-list, so a screen added later is never accidentally opened up.
 */
const ModuleRoute = ({ allowedRoles = [], fallbackPath = '/dashboard', children }) => {
  const { user } = useSelector((state) => state.auth);
  const { pathname } = useLocation();
  const roleCode = getRoleCode(user);

  if (!roleCode) return <Navigate to={fallbackPath} replace />;
  if (allowedRoles.includes(roleCode)) return children || <Outlet />;

  const required = moduleForPath(pathname);
  // `false` fallback: an unmapped path, or a session with no matrix, must not
  // slip through here - this guard is the only thing standing in front of the
  // admin screens for a non-admin role.
  if (required && hasModule(user, required.module, required.level, false)) {
    return children || <Outlet />;
  }

  return <Navigate to={fallbackPath} replace />;
};

export default ModuleRoute;
