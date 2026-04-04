import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import SalesManagerDashboard from './SalesManagerDashboard';
import SalesManagerIncoming from './SalesManagerIncoming';
import SalesManagerVisits from './SalesManagerVisits';
import SalesManagerPullLead from './SalesManagerPullLead';
import SalesManagerPushLeads from './SalesManagerPushLeads';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
import HandoffLeadsPage from '../common/HandoffLeadsPage';
import { salesManagerMenu } from '../../../components/layout/Sidebar/menuConfig';

const SalesManagerWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={salesManagerMenu}
      roleName="Sales Manager"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search leads..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && <SalesManagerDashboard onNavigate={setActiveScreen} />}
          {activeScreen === 'leads' && <LeadWorkspacePage user={user} workspaceRole="SM" />}
          {activeScreen === 'visits' && <SalesManagerVisits onNavigate={setActiveScreen} />}
          {activeScreen === 'incoming' && <SalesManagerIncoming onNavigate={setActiveScreen} />}
          {activeScreen === 'handoffs' && <HandoffLeadsPage workspaceRole="SM" />}
          {activeScreen === 'pull' && <SalesManagerPullLead user={user} onNavigate={setActiveScreen} />}
          {activeScreen === 'push' && <SalesManagerPushLeads onNavigate={setActiveScreen} />}
        </>
      )}
    </PortalLayout>
  );
};

export default SalesManagerWorkspace;
