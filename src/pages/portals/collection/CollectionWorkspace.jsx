import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
import { CollectionDashboard } from './CollectionDashboard';
import { CollectionBookings } from './CollectionBookings';
import { CollectionPayments } from './CollectionPayments';
import { CollectionCustomerProfile } from './CollectionCustomerProfile';

const collectionMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: '📊', badge: null },
  { label: 'My Leads', key: 'leads', icon: '👥', badgeColor: 'blue' },
  { label: 'Bookings', key: 'bookings', icon: '📋', badgeColor: 'green' },
  { group: 'Management' },
  { label: 'Payments', key: 'payments', icon: '💳', badge: null },
  { label: 'Customer Profiles', key: 'customers', icon: '👤', badge: null },
];

const CollectionWorkspace = () => {
  const user = useSelector((state) => state.auth.user);
  const [customerIdFromBooking, setCustomerIdFromBooking] = useState(null);

  return (
    <PortalLayout
      menuItems={collectionMenu}
      roleName="Collection Manager"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search bookings, customers..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && (
            <CollectionDashboard user={user} onNavigate={setActiveScreen} />
          )}
          {activeScreen === 'leads' && (
            <LeadWorkspacePage user={user} workspaceRole="COL" />
          )}
          {activeScreen === 'bookings' && (
            <CollectionBookings
              user={user}
              onSelectCustomer={(id) => {
                setCustomerIdFromBooking(id);
                setActiveScreen('customers');
              }}
            />
          )}
          {activeScreen === 'payments' && (
            <CollectionPayments user={user} />
          )}
          {activeScreen === 'customers' && (
            <CollectionCustomerProfile
              user={user}
              initialCustomerId={customerIdFromBooking}
            />
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default CollectionWorkspace;
