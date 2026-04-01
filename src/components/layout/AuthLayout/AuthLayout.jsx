import React from 'react';
import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

const AuthLayout = () => {
  return (
    <div className="auth-layout">
      <div className="auth-layout__backdrop" />
      <div className="auth-layout__content">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
