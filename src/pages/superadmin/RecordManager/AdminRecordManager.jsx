import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import RecordManagerBookings from '../../portals/recordmanager/RecordManagerBookings';
import RecordManagerBookingDetail from '../../portals/recordmanager/RecordManagerBookingDetail';

const AdminRecordManager = () => {
  const user = useSelector((state) => state.auth.user);
  const [selectedBookingId, setSelectedBookingId] = useState(null);

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
      showCompleted={true}
    />
  );
};

export default AdminRecordManager;
