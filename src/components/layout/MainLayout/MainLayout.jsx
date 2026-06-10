import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import './MainLayout.css';

const MOBILE_BREAKPOINT = 768;

const MainLayout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const sidebarCollapsed = useSelector((state) => state.ui.sidebarCollapsed);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="main-layout" data-collapsed={!isMobile && sidebarCollapsed ? 'true' : 'false'}>
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        onMobileClose={() => setIsMobileSidebarOpen(false)} 
      />

      <div className="main-layout__right">
        <Header onMenuClick={isMobile ? () => setIsMobileSidebarOpen(true) : undefined} />
        <main className="main-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
