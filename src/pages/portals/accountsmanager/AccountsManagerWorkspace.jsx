import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import AccountsVerifyPayments from '../accounts/AccountsVerifyPayments';
import { accountsManagerMenu } from '../../../components/layout/Sidebar/menuConfig';
import '../collection/CollectionWorkspace.css';

// Accounts Manager portal — verifies CASH payments only. The verification queue
// is scoped to cash server-side (by role), so we reuse the existing Accounts
// verify screen unchanged.
const AccountsManagerWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={accountsManagerMenu}
      roleName="Accounts Manager"
      user={user}
      defaultScreen="verify"
      searchPlaceholder="Search cash payments..."
    >
      {({ activeScreen }) => (
        <>
          {activeScreen === 'verify' && (
            <AccountsVerifyPayments user={user} initialFilter="unverified" />
          )}
          {activeScreen === 'reports' && (
            <AccountsVerifyPayments user={user} initialFilter="all" />
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default AccountsManagerWorkspace;
