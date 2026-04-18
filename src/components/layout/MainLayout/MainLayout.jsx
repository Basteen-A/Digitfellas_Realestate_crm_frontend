import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import './MainLayout.css';

const MainLayout = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="main-layout">
      <Sidebar 
        isMobileOpen={isMobileSidebarOpen} 
        onMobileClose={() => setIsMobileSidebarOpen(false)} 
      />

      <div className="main-layout__right">
        <Header onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main className="main-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
