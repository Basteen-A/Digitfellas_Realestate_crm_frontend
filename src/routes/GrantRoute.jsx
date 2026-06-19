import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';

// Route guard driven by a permission predicate (e.g. canViewAllReports,
// canAccessBookingApprovals from utils/permissions). Lets Super Admin / Admin and
// grant-holding Organization Heads reach the same page without duplicating role lists.
const GrantRoute = ({ check, fallbackPath = '/dashboard', children }) => {
  const { user } = useSelector((state) => state.auth);

  if (typeof check !== 'function' || !check(user)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children || <Outlet />;
};

export default GrantRoute;
