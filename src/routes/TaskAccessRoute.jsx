import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { hasTaskPortalAccess } from '../utils/permissions';

const TaskAccessRoute = ({ fallbackPath = '/dashboard', children }) => {
  const { user } = useSelector((state) => state.auth);

  if (!hasTaskPortalAccess(user)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return children || <Outlet />;
};

export default TaskAccessRoute;
