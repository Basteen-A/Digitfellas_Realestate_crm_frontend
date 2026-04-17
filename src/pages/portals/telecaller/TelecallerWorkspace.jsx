import React from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import TelecallerDashboard from './TelecallerDashboard';
import TelecallerPipeline from './TelecallerPipeline';
import TelecallerAddLead from './TelecallerAddLead';
import TelecallerCallLog from './TelecallerCallLog';
import TelecallerPullRequests from './TelecallerPullRequests';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
// import HandoffLeadsPage from '../common/HandoffLeadsPage'; (Removed as per requirement)
import { telecallerMenu } from '../../../components/layout/Sidebar/menuConfig';

const TelecallerWorkspace = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <PortalLayout
      menuItems={telecallerMenu}
      roleName="Telecaller"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search leads by name, phone, email..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && (
            <TelecallerDashboard user={user} onNavigate={setActiveScreen} />
          )}
          {activeScreen === 'leads' && (
            <LeadWorkspacePage user={user} workspaceRole="TC" />
          )}
          {activeScreen === 'leads-addnew' && (
            <LeadWorkspacePage user={user} workspaceRole="TC" autoOpenCreate />
          )}
          {activeScreen === 'pipeline' && (
            <TelecallerPipeline user={user} onNavigate={setActiveScreen} />
          )}
          {activeScreen === 'addlead' && (
            <TelecallerAddLead user={user} onNavigate={setActiveScreen} />
          )}
          {activeScreen === 'calllog' && (
            <TelecallerCallLog user={user} />
          )}
          {activeScreen === 'pullrequests' && (
            <TelecallerPullRequests user={user} />
          )}
          {/* {activeScreen === 'handoffs' && (
            <HandoffLeadsPage workspaceRole="TC" />
          )} */}
        </>
      )}
    </PortalLayout>
  );
};

export default TelecallerWorkspace;
