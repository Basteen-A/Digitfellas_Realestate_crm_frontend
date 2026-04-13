import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
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
  TC: { roleName: 'Telecaller', menuItems: telecallerMenu, defaultScreen: 'leads', basePath: '/telecaller/leads' },
  SM: { roleName: 'Sales Manager', menuItems: salesManagerMenu, defaultScreen: 'leads', basePath: '/sales-manager/leads' },
  SH: { roleName: 'Sales Head', menuItems: salesHeadMenu, defaultScreen: 'negotiations', basePath: '/sales-head/leads' },
  COL: { roleName: 'Collection Manager', menuItems: collectionMenu, defaultScreen: 'leads', basePath: '/collection/leads' },
  SA: { roleName: 'Super Admin', menuItems: telecallerMenu, defaultScreen: 'leads', basePath: '/telecaller/leads' },
  ADM: { roleName: 'Admin', menuItems: telecallerMenu, defaultScreen: 'leads', basePath: '/telecaller/leads' },
};

const PortalWorkspaceShell = ({ children, defaultScreen = null }) => {
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  const roleCode = getRoleCode(user) || 'TC';
  const roleConfig = roleConfigByCode[roleCode] || roleConfigByCode.TC;

  const handleSidebarNavigate = (key) => {
    navigate(roleConfig.basePath, { state: { screen: key } });
  };

  return (
    <PortalLayout
      menuItems={roleConfig.menuItems}
      roleName={roleConfig.roleName}
      user={user}
      defaultScreen={defaultScreen || roleConfig.defaultScreen}
      searchPlaceholder="Search leads..."
      onNavigateOverride={handleSidebarNavigate}
    >
      {children}
    </PortalLayout>
  );
};

export default PortalWorkspaceShell;
