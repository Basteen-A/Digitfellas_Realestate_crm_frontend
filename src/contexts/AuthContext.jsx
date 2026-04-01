import React, { createContext, useContext, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { changePassword, loadUser, login, logout } from '../redux/slices/authSlice';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.auth);

  const value = useMemo(
    () => ({
      ...authState,
      login: (credentials) => dispatch(login(credentials)),
      logout: () => dispatch(logout()),
      loadUser: () => dispatch(loadUser()),
      changePassword: (payload) => dispatch(changePassword(payload)),
    }),
    [authState, dispatch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
