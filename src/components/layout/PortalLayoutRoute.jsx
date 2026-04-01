import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * Minimal layout for portal workspaces.
 * No sidebar, no header, no footer — the portal components
 * render their own PortalSidebar and topbar.
 */
const PortalLayoutRoute = () => {
  return (
    <div className="portal-layout-root">
      <Outlet />
    </div>
  );
};

export default PortalLayoutRoute;
