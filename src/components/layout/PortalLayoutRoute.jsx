import React from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ViewAsBanner from '../common/ViewAsBanner';
import { isViewingAs } from '../../utils/viewAs';

/**
 * Minimal layout for portal workspaces.
 * No sidebar, no header, no footer - the portal components
 * render their own PortalSidebar and topbar.
 */
const PortalLayoutRoute = () => {
  // Subscribing to the identity keeps this in step with entering/leaving a
  // workspace view, both of which swap the user in redux.
  useSelector((state) => state.auth.user);
  const viewingAs = isViewingAs();

  // The root is height:100vh; overflow:hidden, so a banner added in normal flow
  // would push the portal out of view. Only while viewing does it become a flex
  // column that gives the banner its band and the portal the rest.
  return (
    <div className={`portal-layout-root${viewingAs ? ' portal-layout-root--view-as' : ''}`}>
      <ViewAsBanner />
      <Outlet />
    </div>
  );
};

export default PortalLayoutRoute;
