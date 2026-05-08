import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import { CollectionDashboard } from './CollectionDashboard';
import { CollectionBookings } from './CollectionBookings';
import { CollectionPayments } from './CollectionPayments';
import CollectionBookingDetail from './CollectionBookingDetail';
import { collectionMenu } from '../../../components/layout/Sidebar/menuConfig';

const CollectionWorkspace = () => {
  const user = useSelector((state) => state.auth.user);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  return (
    <PortalLayout
      menuItems={collectionMenu}
      roleName="Collection Manager"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search bookings, payments..."
    >
      {({ activeScreen, setActiveScreen }) => {
        // If a booking is selected, show full-page detail regardless of activeScreen
        if (selectedBookingId) {
          return (
            <CollectionBookingDetail
              user={user}
              bookingId={selectedBookingId}
              onBack={() => setSelectedBookingId(null)}
            />
          );
        }

        return (
          <>
            {activeScreen === 'dashboard' && (
              <CollectionDashboard
                user={user}
                onNavigate={setActiveScreen}
                onSelectBooking={(id) => setSelectedBookingId(id)}
              />
            )}
            {activeScreen === 'bookings' && (
              <CollectionBookings
                user={user}
                onSelectBooking={(id) => setSelectedBookingId(id)}
              />
            )}
            {activeScreen === 'customers' && (
              <CollectionBookings
                user={user}
                onSelectBooking={(id) => setSelectedBookingId(id)}
                initialTab="customers"
              />
            )}
            {activeScreen === 'payments' && (
              <CollectionPayments user={user} onSelectBooking={(id) => setSelectedBookingId(id)} />
            )}
          </>
        );
      }}
    </PortalLayout>
  );
};

export default CollectionWorkspace;
