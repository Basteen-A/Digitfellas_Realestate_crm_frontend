import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import SalesHeadDashboard from './SalesHeadDashboard';
import SalesHeadBookings from './SalesHeadBookings';
import SalesHeadApprovals from './SalesHeadApprovals';
import SalesHeadTeamLeads from './SalesHeadTeamLeads';
import SalesHeadSiteVisits from './SalesHeadSiteVisits';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
import HandoffLeadsPage from '../common/HandoffLeadsPage';
import { salesHeadMenu } from '../../../components/layout/Sidebar/menuConfig';

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
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && <SalesHeadDashboard user={user} onNavigate={setActiveScreen} />}
          {activeScreen === 'negotiations' && <LeadWorkspacePage user={user} workspaceRole="SH" />}
          {activeScreen === 'bookings' && <SalesHeadBookings user={user} />}
          {activeScreen === 'approvals' && <SalesHeadApprovals user={user} />}
          {activeScreen === 'sitevisits' && <SalesHeadSiteVisits user={user} />}
          {activeScreen === 'handoffs' && <HandoffLeadsPage workspaceRole="SH" />}
          {activeScreen === 'allleads' && <LeadWorkspacePage user={user} workspaceRole="SH" />}
          {activeScreen === 'smteam' && <SalesHeadTeamLeads user={user} />}
          {activeScreen === 'team' && (
            <div><div className="page-header"><div className="page-header-left"><h1>Team Performance</h1><p>Monitor your team's metrics</p></div></div>
            <div className="crm-card"><div className="empty-state"><div className="empty-icon">👔</div><div className="empty-title">Team performance analytics</div><div className="empty-desc">View detailed team metrics and KPIs</div></div></div></div>
          )}
          {activeScreen === 'revenue' && (
            <div><div className="page-header"><div className="page-header-left"><h1>Revenue</h1><p>Track collections and payments</p></div></div>
            <div className="crm-card"><div className="empty-state"><div className="empty-icon">💰</div><div className="empty-title">Revenue tracking</div><div className="empty-desc">Monitor collections and payment schedules</div></div></div></div>
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default SalesHeadWorkspace;
