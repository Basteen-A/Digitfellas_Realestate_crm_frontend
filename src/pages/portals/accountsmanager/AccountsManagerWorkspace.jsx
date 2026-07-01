import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import AccountsDashboard from '../accounts/AccountsDashboard';
import AccountsVerifyPayments from '../accounts/AccountsVerifyPayments';
import { TaskListPage } from '../../tasks';
import { accountsManagerMenu } from '../../../components/layout/Sidebar/menuConfig';
import '../collection/CollectionWorkspace.css';

// Accounts Manager portal — mirrors the Accountant (ACCT) portal (same menu,
// dashboard + verify + report screens). The verification queue defaults to CASH
// (server-scoped by role), with a "Show all payments" toggle on the verify
// screen for a full overview.
const AccountsManagerWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={accountsManagerMenu}
      roleName="Accounts Manager"
      user={user}
      defaultScreen="verify"
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
          {activeScreen === 'tasks' && (
            <TaskListPage />
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default AccountsManagerWorkspace;
