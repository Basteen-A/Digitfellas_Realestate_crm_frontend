import React, { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import PortalLayout from '../common/PortalLayout';
import TelecallerDashboard from './TelecallerDashboard';
import TelecallerPipeline from './TelecallerPipeline';
import TelecallerAddLead from './TelecallerAddLead';
import TelecallerCallLog from './TelecallerCallLog';
import TelecallerPullRequests from './TelecallerPullRequests';
import LeadWorkspacePage from '../common/LeadWorkspacePage';
import HandoffLeadsPage from '../common/HandoffLeadsPage';
import PortalReports from '../common/PortalReports';
import { TaskListPage } from '../../tasks';
import { telecallerMenu } from '../../../components/layout/Sidebar/menuConfig';

const TelecallerWorkspace = () => {
  const user = useSelector((state) => state.auth.user);
  const [leadWorkspaceOptions, setLeadWorkspaceOptions] = useState(null);
  const lastScreenRef = useRef('dashboard');

  return (
    <PortalLayout
      menuItems={telecallerMenu}
      roleName="Telecaller"
      user={user}
      defaultScreen="dashboard"
      searchPlaceholder="Search leads by name, phone, email..."
    >
      {({ activeScreen, setActiveScreen, screenContext }) => {
        // Reset lead workspace options when navigating away from the leads screen
        if (lastScreenRef.current !== activeScreen) {
          lastScreenRef.current = activeScreen;
          if (activeScreen !== 'leads') {
            setTimeout(() => setLeadWorkspaceOptions(null), 0);
          }
        }

        const handleNavigate = (screen, options) => {
          if (screen === 'leads') {
            setLeadWorkspaceOptions(options || null);
          }
          setActiveScreen(screen);
        };

        return (
          <>
            {activeScreen === 'dashboard' && (
              <TelecallerDashboard user={user} onNavigate={handleNavigate} />
            )}
            {activeScreen === 'leads' && (
              <LeadWorkspacePage 
                user={user} 
                workspaceRole="TC" 
                initialTab={leadWorkspaceOptions?.tab} 
              />
            )}
            {activeScreen === 'leads-addnew' && (
              <LeadWorkspacePage
                user={user}
                workspaceRole="TC"
                autoOpenCreate
                prefillPhone={screenContext?.prefillPhone || ''}
              />
            )}
            {activeScreen === 'pipeline' && (
              <TelecallerPipeline user={user} onNavigate={handleNavigate} />
            )}
            {activeScreen === 'addlead' && (
              <TelecallerAddLead
                user={user}
                onNavigate={handleNavigate}
                prefillPhone={screenContext?.prefillPhone || ''}
              />
            )}
            {activeScreen === 'calllog' && (
              <TelecallerCallLog user={user} />
            )}
            {activeScreen === 'pullrequests' && (
              <TelecallerPullRequests user={user} />
            )}
            {activeScreen === 'handoffs' && (
              <HandoffLeadsPage workspaceRole="TC" defaultType="outgoing" showStage={false} />
            )}
            {activeScreen === 'tasks' && (
              <TaskListPage />
            )}
            {activeScreen === 'reports' && (
              <PortalReports role="TC" />
            )}
          </>
        );
      }}
    </PortalLayout>
  );
};

export default TelecallerWorkspace;
