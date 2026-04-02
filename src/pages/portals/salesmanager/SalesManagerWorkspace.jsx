import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import SalesManagerDashboard from './SalesManagerDashboard';
import SalesManagerIncoming from './SalesManagerIncoming';
import SalesManagerPullLead from './SalesManagerPullLead';
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
          {activeScreen === 'dashboard' && <SalesManagerDashboard user={user} onNavigate={setActiveScreen} />}
          {activeScreen === 'leads' && <LeadWorkspacePage user={user} workspaceRole="SM" />}
          {activeScreen === 'visits' && (
            <div>
              <div className="page-header"><div className="page-header-left"><h1>Site Visits</h1><p>Manage your site visits and meetings</p></div></div>
              <div className="crm-card"><div className="empty-state"><div className="empty-icon">🏠</div><div className="empty-title">Site visit management</div><div className="empty-desc">Schedule and track site visits with buyers</div></div></div>
            </div>
          )}
          {activeScreen === 'incoming' && <SalesManagerIncoming user={user} onNavigate={setActiveScreen} />}
          {activeScreen === 'handoffs' && <HandoffLeadsPage workspaceRole="SM" />}
          {activeScreen === 'pull' && <SalesManagerPullLead user={user} />}
          {activeScreen === 'push' && (
            <div>
              <div className="page-header"><div className="page-header-left"><h1>Push to Sales Head</h1><p>Ready leads for negotiation</p></div></div>
              <div className="crm-card"><div className="empty-state"><div className="empty-icon">🚀</div><div className="empty-title">Push leads to Sales Head</div><div className="empty-desc">Select leads ready for final negotiation</div></div></div>
            </div>
          )}
        </>
      )}
    </PortalLayout>
  );
};

export default SalesManagerWorkspace;
