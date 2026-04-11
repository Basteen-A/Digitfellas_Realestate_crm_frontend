import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from './PortalLayout';
import { getRoleCode } from '../../../utils/permissions';
import { telecallerMenu, salesManagerMenu, salesHeadMenu } from '../../../components/layout/Sidebar/menuConfig';

const collectionMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: '📊', badge: null },
  { label: 'My Leads', key: 'leads', icon: '👥', badgeColor: 'blue' },
  { label: 'Bookings', key: 'bookings', icon: '📋', badgeColor: 'green' },
  { group: 'Management' },
  { label: 'Payments', key: 'payments', icon: '💳', badge: null },
  { label: 'Customer Profiles', key: 'customers', icon: '👤', badge: null },
];

const roleConfigByCode = {
  TC: { roleName: 'Telecaller', menuItems: telecallerMenu, defaultScreen: 'leads' },
  SM: { roleName: 'Sales Manager', menuItems: salesManagerMenu, defaultScreen: 'leads' },
  SH: { roleName: 'Sales Head', menuItems: salesHeadMenu, defaultScreen: 'negotiations' },
  COL: { roleName: 'Collection Manager', menuItems: collectionMenu, defaultScreen: 'leads' },
  SA: { roleName: 'Super Admin', menuItems: telecallerMenu, defaultScreen: 'leads' },
  ADM: { roleName: 'Admin', menuItems: telecallerMenu, defaultScreen: 'leads' },
};

const PortalWorkspaceShell = ({ children, defaultScreen = null }) => {
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user) || 'TC';
  const roleConfig = roleConfigByCode[roleCode] || roleConfigByCode.TC;

  return (
    <PortalLayout
      menuItems={roleConfig.menuItems}
      roleName={roleConfig.roleName}
      user={user}
      defaultScreen={defaultScreen || roleConfig.defaultScreen}
      searchPlaceholder="Search leads..."
    >
      {children}
    </PortalLayout>
  );
};

export default PortalWorkspaceShell;
