import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import SalesHeadDashboard from './SalesHeadDashboard';
import SalesHeadBookings from './SalesHeadBookings';
import SalesHeadBookingSummary from './SalesHeadBookingSummary';
import SalesHeadApprovals from './SalesHeadApprovals';
import SalesHeadCancellationRequests from './SalesHeadCancellationRequests';
import SalesHeadTeamLeads from './SalesHeadTeamLeads';
import SalesHeadTeamPerformance from './SalesHeadTeamPerformance';
import SalesHeadSiteVisits from './SalesHeadSiteVisits';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
import HandoffLeadsPage from '../common/HandoffLeadsPage';
import { TaskListPage } from '../../tasks';
import { salesHeadMenu } from '../../../components/layout/Sidebar/menuConfig';
import { BanknotesIcon } from '@heroicons/react/24/outline';

const SalesHeadWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={salesHeadMenu}
      roleName="Sales Head"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search leads, bookings..."
    >
      {({ activeScreen, setActiveScreen, screenContext }) => (
        <>
          {activeScreen === 'dashboard' && <SalesHeadDashboard user={user} onNavigate={setActiveScreen} />}
          {activeScreen === 'negotiations' && <LeadWorkspacePage user={user} workspaceRole="SH" initialTab={screenContext?.tab} />}
          {activeScreen === 'bookings' && <SalesHeadBookings user={user} />}
          {activeScreen === 'bookingsummary' && <SalesHeadBookingSummary />}
          {activeScreen === 'approvals' && <SalesHeadApprovals user={user} />}
          {activeScreen === 'cancellations' && <SalesHeadCancellationRequests user={user} />}
          {activeScreen === 'sitevisits' && <SalesHeadSiteVisits user={user} />}
          {activeScreen === 'handoffs' && <HandoffLeadsPage workspaceRole="SH" defaultType="outgoing" />}
          {activeScreen === 'allleads' && <LeadWorkspacePage user={user} workspaceRole="SH" initialTab={screenContext?.tab} />}
          {activeScreen === 'smteam' && <SalesHeadTeamLeads user={user} />}
          {activeScreen === 'team' && <SalesHeadTeamPerformance />}
          {activeScreen === 'tasks' && <TaskListPage />}
          {activeScreen === 'revenue' && (
            <div><div className="page-header flex-col md:flex-row md:items-center gap-3"><div className="page-header-left"><h1>Revenue</h1><p className="hidden sm:block">Track collections and payments</p></div></div>
            <div className="crm-card"><div className="empty-state"><div className="empty-icon"><BanknotesIcon style={{ width: 30, height: 30 }} /></div><div className="empty-title">Revenue tracking</div><div className="empty-desc">Monitor collections and payment schedules</div></div></div></div>
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default SalesHeadWorkspace;
