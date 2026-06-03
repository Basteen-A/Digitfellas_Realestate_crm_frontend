import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import { CollectionDashboard } from './CollectionDashboard';
import { CollectionBookings } from './CollectionBookings';
import { CollectionPayments } from './CollectionPayments';
import CollectionBookingDetail from './CollectionBookingDetail';
import CollectionDemandSchedule from './CollectionDemandSchedule';
import CollectionOverdue from './CollectionOverdue';
import CollectionReports from './CollectionReports';
import { TaskListPage } from '../../tasks';
import { collectionMenu } from '../../../components/layout/Sidebar/menuConfig';

const CollectionWorkspaceContent = ({ activeScreen, selectedBookingId, setSelectedBookingId, user, setActiveScreen }) => {
  const [openedOnScreen, setOpenedOnScreen] = useState(null);

  useEffect(() => {
    if (selectedBookingId) {
      if (openedOnScreen === null) {
        setOpenedOnScreen(activeScreen);
      } else if (activeScreen !== openedOnScreen) {
        // User clicked a sidebar navigation item! Reset the selected booking ID.
        setSelectedBookingId(null);
        setOpenedOnScreen(null);
      }
    } else {
      setOpenedOnScreen(null);
    }
  }, [activeScreen, selectedBookingId, openedOnScreen, setSelectedBookingId]);

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
          onSelectBooking={setSelectedBookingId}
        />
      )}
      {activeScreen === 'bookings' && (
        <CollectionBookings
          user={user}
          onSelectBooking={setSelectedBookingId}
        />
      )}
      {activeScreen === 'demands' && (
        <CollectionDemandSchedule user={user} />
      )}
      {activeScreen === 'payments' && (
        <CollectionPayments user={user} onSelectBooking={setSelectedBookingId} />
      )}
      {activeScreen === 'overdue' && (
        <CollectionOverdue
          user={user}
          onSelectBooking={setSelectedBookingId}
        />
      )}
      {activeScreen === 'reports' && (
        <CollectionReports user={user} />
      )}
      {activeScreen === 'tasks' && (
        <TaskListPage />
      )}
    </>
  );
};

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
      {({ activeScreen, setActiveScreen }) => (
        <CollectionWorkspaceContent
          activeScreen={activeScreen}
          selectedBookingId={selectedBookingId}
          setSelectedBookingId={setSelectedBookingId}
          user={user}
          setActiveScreen={setActiveScreen}
        />
      )}
    </PortalLayout>
  );
};

export default CollectionWorkspace;
