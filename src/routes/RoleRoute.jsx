import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getRoleCode } from '../utils/permissions';

const RoleRoute = ({ allowedRoles = [], fallbackPath = '/dashboard', children }) => {
  const { user } = useSelector((state) => state.auth);
  const roleCode = getRoleCode(user);

  if (!roleCode) {
    return <Navigate to={fallbackPath} replace />;
  }

  if (!allowedRoles.includes(roleCode)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children || <Outlet />;
};

export default RoleRoute;
