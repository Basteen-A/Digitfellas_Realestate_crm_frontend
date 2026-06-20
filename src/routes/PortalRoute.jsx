import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getRoleCode } from '../utils/permissions';

// Map portal paths to their required role codes
const PORTAL_ROLE_MAP = {
  '/telecaller': ['TC'],
  '/sales-manager': ['SM'],
  '/sales-head': ['SH'],
  '/collection': ['COL'],
  '/accounts': ['ACCT'],
  '/task-portal': ['SE'],
};

// Super Admin and Admin can access all portals
const ADMIN_ROLES = ['SA', 'ADM'];

/**
 * PortalRoute - Restricts access to portal routes based on user's primary role
 * Ensures users can only access their own portal, not other roles' portals
 * Super Admin and Admin can access all portals
 */
const PortalRoute = ({ children }) => {
  const location = useLocation();
  const { user, isAuthenticated, isInitialized } = useSelector((state) => state.auth);
  
  if (!isInitialized) {
    return null;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  
  const userRoleCode = getRoleCode(user);
  const pathname = location.pathname;
  
  // Super Admin and Admin can access any portal
  if (ADMIN_ROLES.includes(userRoleCode)) {
    return children || <Outlet />;
  }
  
  // Find which portal the user is trying to access
  const portalMatch = Object.entries(PORTAL_ROLE_MAP).find(([path]) => 
    pathname.startsWith(path)
  );
  
  if (!portalMatch) {
    // Not a portal route, allow access
    return children || <Outlet />;
  }
  
  const [portalPath, allowedRoles] = portalMatch;
  
  // Check if user's role matches the portal they're trying to access
  if (!allowedRoles.includes(userRoleCode)) {
    // User is trying to access a portal that doesn't match their role
    // Redirect to their appropriate portal
    if (userRoleCode === 'TC') {
      return <Navigate to="/telecaller/leads" replace />;
    }
    if (userRoleCode === 'SM') {
      return <Navigate to="/sales-manager/leads" replace />;
    }
    if (userRoleCode === 'SH') {
      return <Navigate to="/sales-head/leads" replace />;
    }
    if (userRoleCode === 'COL') {
      return <Navigate to="/collection/leads" replace />;
    }
    if (userRoleCode === 'ACCT') {
      return <Navigate to="/accounts/dashboard" replace />;
    }
    if (userRoleCode === 'SE') {
      return <Navigate to="/task-portal/dashboard" replace />;
    }
    
    // Fallback to dashboard
    return <Navigate to="/dashboard" replace />;
  }
  
  // User's role matches the portal, allow access
  return children || <Outlet />;
};

export default PortalRoute;
