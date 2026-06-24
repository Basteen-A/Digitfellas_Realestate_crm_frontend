import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import RecordManagerBookings from './RecordManagerBookings';
import RecordManagerBookingDetail from './RecordManagerBookingDetail';
import { recordManagerMenu } from '../../../components/layout/Sidebar/menuConfig';

const RecordManagerWorkspaceContent = ({ selectedBookingId, setSelectedBookingId, user }) => {
  if (selectedBookingId) {
    return (
      <RecordManagerBookingDetail
        user={user}
        bookingId={selectedBookingId}
        onBack={() => setSelectedBookingId(null)}
      />
    );
  }
  return (
    <RecordManagerBookings
      user={user}
      onSelectBooking={setSelectedBookingId}
    />
  );
};

const RecordManagerWorkspace = () => {
  const user = useSelector((state) => state.auth.user);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

  return (
    <PortalLayout
      menuItems={recordManagerMenu}
      roleName="Record Manager"
      user={user}
      defaultScreen="bookings"
      searchPlaceholder="Search registered bookings..."
    >
      {() => (
        <RecordManagerWorkspaceContent
          selectedBookingId={selectedBookingId}
          setSelectedBookingId={setSelectedBookingId}
          user={user}
        />
      )}
    </PortalLayout>
  );
};

export default RecordManagerWorkspace;
