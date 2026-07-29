import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import CollectionExecBookings from './CollectionExecBookings';
import CollectionExecBookingDetail from './CollectionExecBookingDetail';
import { TaskListPage } from '../../tasks';
import { collectionExecMenu } from '../../../components/layout/Sidebar/menuConfig';

const CollectionExecWorkspace = () => {
  const user = useSelector((state) => state.auth.user);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  return (
    <PortalLayout
      menuItems={collectionExecMenu}
      roleName="Collection Executive"
      user={user}
      defaultScreen="bookings"
      searchPlaceholder="Search my collections..."
    >
      {({ activeScreen }) => {
        if (activeScreen === 'tasks') return <TaskListPage />;
        return selectedBookingId ? (
          <CollectionExecBookingDetail
            user={user}
            bookingId={selectedBookingId}
            onBack={() => setSelectedBookingId(null)}
          />
        ) : (
          <CollectionExecBookings
            user={user}
            onSelectBooking={setSelectedBookingId}
          />
        );
      }}
    </PortalLayout>
  );
};

export default CollectionExecWorkspace;
