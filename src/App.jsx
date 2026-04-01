// ============================================================
// ROOT APP COMPONENT
// ============================================================

import React, { Suspense, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AppRoutes from './routes/AppRoutes';
import { loadUser } from './redux/slices/authSlice';
import './App.css';

// Lazy page loader
const PageLoader = () => (
  <div className="page-loader">
    <div className="page-loader__content">
      <div className="page-loader__spinner" />
      <p className="page-loader__text">Loading...</p>
    </div>
  </div>
);

const App = () => {
  const dispatch = useDispatch();
  const { isInitialized } = useSelector((state) => state.auth);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    dispatch(loadUser());
  }, [dispatch]);

  if (!isInitialized) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <AppRoutes />
    </Suspense>
  );
};

export default App;
