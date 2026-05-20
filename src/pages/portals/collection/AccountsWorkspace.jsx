import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import AccountsDashboard from './AccountsDashboard';
import AccountsVerifyPayments from './AccountsVerifyPayments';
import { accountsMenu } from '../../../components/layout/Sidebar/menuConfig';
import './CollectionWorkspace.css';

const AccountsWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={accountsMenu}
      roleName="Accounts Executive"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search payments, bookings..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && (
            <AccountsDashboard user={user} onNavigate={setActiveScreen} />
          )}
          {activeScreen === 'verify' && (
            <AccountsVerifyPayments user={user} initialFilter="unverified" />
          )}
          {activeScreen === 'verified' && (
            <AccountsVerifyPayments user={user} initialFilter="verified" />
          )}
          {activeScreen === 'rejected' && (
            <AccountsVerifyPayments user={user} initialFilter="rejected" />
          )}
          {activeScreen === 'reconciliation' && (
            <AccountsVerifyPayments user={user} initialFilter="all" />
          )}
          {activeScreen === 'reports' && (
            <AccountsVerifyPayments user={user} initialFilter="all" />
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default AccountsWorkspace;
