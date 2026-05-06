import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import { CollectionDashboard } from './CollectionDashboard';
import { CollectionBookings } from './CollectionBookings';
import { CollectionPayments } from './CollectionPayments';
import { CollectionCustomerProfile } from './CollectionCustomerProfile';
import { collectionMenu } from '../../../components/layout/Sidebar/menuConfig';

const CollectionWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={collectionMenu}
      roleName="Collection Manager"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search bookings, payments..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && (
            <CollectionDashboard user={user} onNavigate={setActiveScreen} />
          )}
          {activeScreen === 'bookings' && (
            <CollectionBookings user={user} onSelectCustomer={(id) => setActiveScreen('customers')} />
          )}
          {activeScreen === 'customers' && (
            <CollectionCustomerProfile user={user} />
          )}
          {activeScreen === 'payments' && (
            <CollectionPayments user={user} />
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default CollectionWorkspace;
