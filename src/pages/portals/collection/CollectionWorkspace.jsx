import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import { CollectionDashboard } from './CollectionDashboard';
import { CollectionBookings } from './CollectionBookings';
import { CollectionOpenBookings } from './CollectionOpenBookings';
import { CollectionPayments } from './CollectionPayments';
import CollectionBookingDetail from './CollectionBookingDetail';
import CollectionDemandSchedule from './CollectionDemandSchedule';
import CollectionReports from './CollectionReports';
// Telecalling floor - the same components Super Admin renders. The server decides
// the scope; for COL that is org-wide, telecaller-only.
import ReportsPage from '../../superadmin/Reports/ReportsPage';
import CallAllocationHistory from '../../superadmin/Telephony/CallAllocationHistory';
// Inbound-call allocation (above) and marketing-API allocation (below) are two
// separate audits of the same question: which telecaller received this lead.
import MarketingAllocationHistory from '../../superadmin/MarketingAllocation/MarketingAllocationHistory';
import { TaskListPage } from '../../tasks';
import { collectionMenu } from '../../../components/layout/Sidebar/menuConfig';

// Screens this portal used to have. The active screen is restored from
// sessionStorage, so a user who was sitting on one of these would land on a
// blank pane after the retire - send them to the dashboard instead.
const RETIRED_SCREENS = ['overdue', 'call-logs'];

const CollectionWorkspaceContent = ({ activeScreen, selectedBookingId, setSelectedBookingId, user, setActiveScreen }) => {
  const [openedOnScreen, setOpenedOnScreen] = useState(null);

  useEffect(() => {
    if (RETIRED_SCREENS.includes(activeScreen)) setActiveScreen('dashboard');
  }, [activeScreen, setActiveScreen]);

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

  useEffect(() => {
    if (selectedBookingId) {
      if (!window.history.state?.bookingDetailOpen) {
        window.history.pushState({ bookingDetailOpen: true }, '');
      }

      const handlePopState = (e) => {
        setSelectedBookingId(null);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
    return undefined;
  }, [selectedBookingId, setSelectedBookingId]);

  if (selectedBookingId) {
    return (
      <CollectionBookingDetail
        user={user}
        bookingId={selectedBookingId}
        onBack={() => {
          if (openedOnScreen === 'dashboard') {
            setActiveScreen('bookings');
          }
          if (window.history.state?.bookingDetailOpen) {
            window.history.back();
          } else {
            setSelectedBookingId(null);
          }
        }}
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
      {activeScreen === 'open-bookings' && (
        <CollectionOpenBookings
          user={user}
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
      {activeScreen === 'reports' && (
        <CollectionReports user={user} />
      )}
      {activeScreen === 'tc-reports' && (
        <ReportsPage />
      )}
      {activeScreen === 'call-allocations' && (
        <CallAllocationHistory />
      )}
      {activeScreen === 'api-allocations' && (
        <MarketingAllocationHistory />
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
