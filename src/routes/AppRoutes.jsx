import React from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import PortalRoute from './PortalRoute';
import RoleRoute from './RoleRoute';
import ModuleRoute from './ModuleRoute';
import { usesGenericPortal } from '../utils/modulePermissions';
import { buildGenericSidebar } from '../components/layout/Sidebar/genericMenu';
import AttendanceGate from './AttendanceGate';
import TaskAccessRoute from './TaskAccessRoute';
import GrantRoute from './GrantRoute';
import {
  getRoleCode, canViewAllReports, canAccessBookingApprovals, hasTaskPortalAccess,
} from '../utils/permissions';

import AuthLayout from '../components/layout/AuthLayout/AuthLayout';
import MainLayout from '../components/layout/MainLayout/MainLayout';
import PortalLayoutRoute from '../components/layout/PortalLayoutRoute';

import Login from '../pages/auth/Login';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import Dashboard from '../pages/dashboard';
import Profile from '../pages/profile/Profile';
import ChangePassword from '../pages/profile/ChangePassword';
import LeadDetailsPage from '../pages/portals/common/LeadDetailsPage';
import PortalWorkspaceShell from '../pages/portals/common/PortalWorkspaceShell';
import CheckInPage from '../pages/portals/common/CheckInPage';
import NotFound from '../pages/NotFound';

import Locations from '../pages/superadmin/Locations';
import Projects from '../pages/superadmin/Projects';
import ProjectTypes from '../pages/superadmin/ProjectTypes';
import DocumentArchive from '../pages/superadmin/DocumentArchive';
import DocumentManagement from '../pages/superadmin/DocumentManagement';
import LeadTypes from '../pages/superadmin/LeadTypes';
import LeadSources from '../pages/superadmin/LeadSources';
import LeadSubSources from '../pages/superadmin/LeadSubSources';
import Users from '../pages/superadmin/Users';
import UserTypes from '../pages/superadmin/UserTypes';
import CustomerTypes from '../pages/superadmin/CustomerTypes';
import ScoreMaster from '../pages/superadmin/ScoreMaster';
import LeadStatuses from '../pages/superadmin/LeadStatuses';
import BookingStatuses from '../pages/superadmin/BookingStatuses';
import BookingApprovals from '../pages/superadmin/BookingApprovals';
import LeadStages from '../pages/superadmin/LeadStages';
import ClosedLostReasons from '../pages/superadmin/ClosedLostReasons';
import BookingCancelReasons from '../pages/superadmin/BookingCancelReasons';
import StatusRemarks from '../pages/superadmin/StatusRemarks';
import WorkflowActions from '../pages/superadmin/WorkflowActions/WorkflowActionList';
import Motivations from '../pages/superadmin/Motivations';
import PaymentTypes from '../pages/superadmin/PaymentTypes';
import PaymentPlans from '../pages/superadmin/PaymentPlans';
import PaymentModes from '../pages/superadmin/PaymentModes';
import Banks from '../pages/superadmin/Banks';
import PaymentStatuses from '../pages/superadmin/PaymentStatuses';
import { InventoryDashboard, InventoryUnitList } from '../pages/superadmin/Inventory';
import { AdminLeadManagement } from '../pages/superadmin/LeadManagement';
import Reports from '../pages/superadmin/Reports';
import FinanceRevenue from '../pages/superadmin/Finance/FinanceRevenue';
import FinanceCollections from '../pages/superadmin/Finance/FinanceCollections';
import SiteSettings from '../pages/superadmin/SiteSettings';
import TermsAndConditions from '../pages/superadmin/TermsAndConditions';
import ReallotmentRules from '../pages/superadmin/ReallotmentRules';
import ReallotmentLogs from '../pages/superadmin/ReallotmentLogs';
import MarketingAllocationRules from '../pages/superadmin/MarketingAllocation/MarketingAllocationRules';
import MarketingAllocationHistory from '../pages/superadmin/MarketingAllocation/MarketingAllocationHistory';
import MarketingApiKeys from '../pages/superadmin/MarketingAllocation/MarketingApiKeys';
import MarketingCampaigns from '../pages/superadmin/MarketingCampaigns/Campaigns';
import MarketingCampaignDetail from '../pages/superadmin/MarketingCampaigns/CampaignDetail';
import WhatsappInbox from '../pages/superadmin/MarketingCampaigns/Inbox';
import WhatsappTemplates from '../pages/superadmin/MarketingCampaigns/Templates';
import WhatsappAutomations from '../pages/superadmin/MarketingCampaigns/Automations';
import WhatsappSettings from '../pages/superadmin/MarketingCampaigns/WhatsappSettings';
import MarketingReports from '../pages/superadmin/MarketingReports';
import CollectionReports from '../pages/superadmin/CollectionReports';
import MarketingMetrix from '../pages/superadmin/MarketingMetrix';
import TelephonyCallSettings from '../pages/superadmin/Telephony/CallSettings';
import TelephonyCallLogs from '../pages/superadmin/Telephony/CallLogs';
import TelephonyCallAllocationHistory from '../pages/superadmin/Telephony/CallAllocationHistory';
import TelephonyCallAnalysisSettings from '../pages/superadmin/Telephony/CallAnalysisSettings';
import AdminRecordManager from '../pages/superadmin/RecordManager/AdminRecordManager';
import AttendancePage from '../pages/superadmin/Attendance/AttendancePage';
import {
  TaskWorkspace,
  TaskListPage,
  TaskDashboard,
  Departments as TaskDepartments,
  SubDepartments as TaskSubDepartments,
} from '../pages/tasks';
import TelecallerWorkspace from '../pages/portals/telecaller';
import SalesManagerWorkspace from '../pages/portals/salesmanager';
import SalesHeadWorkspace from '../pages/portals/saleshead';
import CollectionWorkspace from '../pages/portals/collection';
import AccountsWorkspace from '../pages/portals/accounts';
import RecordManagerWorkspace from '../pages/portals/recordmanager';
import AccountsManagerWorkspace from '../pages/portals/accountsmanager';
import CollectionExecWorkspace from '../pages/portals/collectionexec';

// Admin-area task dashboard: reuse the task dashboard, but keep "view all tasks"
// inside the admin layout (-> /super-admin/tasks) instead of the standalone portal.
const SuperAdminTaskDashboard = () => {
  const navigate = useNavigate();
  return <TaskDashboard onOpenTasks={() => navigate('/super-admin/tasks')} />;
};

const RoleHomeRedirect = () => {
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user);

  if (roleCode === 'SE') return <Navigate to="/task-portal/dashboard" replace />;
  if (roleCode === 'TC') return <Navigate to="/telecaller/leads" replace />;
  if (roleCode === 'SM') return <Navigate to="/sales-manager/leads" replace />;
  if (roleCode === 'SH') return <Navigate to="/sales-head/leads" replace />;
  if (roleCode === 'COL') return <Navigate to="/collection/leads" replace />;
  if (roleCode === 'ACCT') return <Navigate to="/accounts/dashboard" replace />;
  if (roleCode === 'RM') return <Navigate to="/record-manager/bookings" replace />;
  if (roleCode === 'AM') return <Navigate to="/accounts-manager/verify" replace />;
  if (roleCode === 'CE') return <Navigate to="/collection-exec/bookings" replace />;

  // Organization Head lands on the first module they were granted.
  if (roleCode === 'OH') {
    if (canViewAllReports(user)) return <Navigate to="/super-admin/reports" replace />;
    if (canAccessBookingApprovals(user)) return <Navigate to="/super-admin/booking-approvals" replace />;
    if (hasTaskPortalAccess(user)) return <Navigate to="/super-admin/tasks" replace />;
  }

  // A role created in Roles & Permissions has no home of its own, so land on the
  // first destination its matrix actually opens. Falling straight through to
  // /dashboard would strand a role that was never granted the dashboard.
  if (usesGenericPortal(user)) {
    const first = buildGenericSidebar(user).find((item) => item.path)
      || (buildGenericSidebar(user).find((item) => item.children?.length)?.children || [])[0];
    if (first?.path) return <Navigate to={first.path} replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
      </Route>

      {/* Daily check-in gate page - private but OUTSIDE the AttendanceGate. */}
      <Route element={<PrivateRoute />}>
        <Route path="/check-in" element={<CheckInPage />} />
      </Route>

      {/* Portal routes - no app sidebar, portals have their own sidebar */}
      <Route element={<PrivateRoute />}>
        <Route element={<AttendanceGate />}>
          <Route element={<PortalLayoutRoute />}>
            {/* PortalRoute ensures users can only access their own role's portal */}
            <Route element={<PortalRoute />}>
              {/* Standard Executive task portal - now uses the shared PortalLayout
                shell so it matches the look of every other role portal. */}
              <Route element={<TaskAccessRoute />}>
                <Route path="/task-portal" element={<Navigate to="/task-portal/dashboard" replace />} />
                <Route path="/task-portal/dashboard" element={<TaskWorkspace defaultScreen="dashboard" />} />
                <Route path="/task-portal/tasks" element={<TaskWorkspace defaultScreen="tasks" />} />
                <Route element={<RoleRoute allowedRoles={['SA', 'ADM']} />}>
                  <Route path="/task-portal/departments" element={<TaskWorkspace defaultScreen="departments" />} />
                  <Route path="/task-portal/sub-departments" element={<TaskWorkspace defaultScreen="sub-departments" />} />
                </Route>
              </Route>

              <Route element={<RoleRoute allowedRoles={['TC', 'SA', 'ADM']} />}>
                <Route path="/telecaller/leads" element={<TelecallerWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['SM', 'SH', 'SA', 'ADM']} />}>
                <Route path="/sales-manager/leads" element={<SalesManagerWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['SH', 'SA', 'ADM']} />}>
                <Route path="/sales-head/leads" element={<SalesHeadWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['COL', 'SA', 'ADM']} />}>
                <Route path="/collection/leads" element={<CollectionWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['ACCT', 'SA', 'ADM']} />}>
                <Route path="/accounts/dashboard" element={<AccountsWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['RM', 'SA', 'ADM']} />}>
                <Route path="/record-manager/bookings" element={<RecordManagerWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['AM', 'SA', 'ADM']} />}>
                <Route path="/accounts-manager/verify" element={<AccountsManagerWorkspace />} />
              </Route>

              <Route element={<RoleRoute allowedRoles={['CE', 'SA', 'ADM']} />}>
                <Route path="/collection-exec/bookings" element={<CollectionExecWorkspace />} />
              </Route>
            </Route>

            <Route element={<RoleRoute allowedRoles={['TC', 'SM', 'SH', 'COL', 'ACCT', 'AM', 'CE', 'RM', 'SA', 'ADM', 'SE']} />}>
              <Route
                path="/portal/lead/:id"
                element={(
                  <PortalWorkspaceShell>
                    <LeadDetailsPage />
                  </PortalWorkspaceShell>
                )}
              />
              <Route
                path="/portal/profile"
                element={(
                  <PortalWorkspaceShell defaultScreen="dashboard">
                    <Profile />
                  </PortalWorkspaceShell>
                )}
              />
              <Route
                path="/portal/profile/change-password"
                element={(
                  <PortalWorkspaceShell defaultScreen="dashboard">
                    <ChangePassword />
                  </PortalWorkspaceShell>
                )}
              />
            </Route>
          </Route>
        </Route>
      </Route>

      {/* Admin & general routes - standard MainLayout with app sidebar */}
      <Route element={<PrivateRoute />}>
        <Route element={<AttendanceGate />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<RoleHomeRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/change-password" element={<ChangePassword />} />
            <Route path="/lead/:id" element={<LeadDetailsPage />} />

            {/* Legacy task paths now live in the standalone Standard Executive portal */}
            <Route path="/tasks" element={<Navigate to="/task-portal/tasks" replace />} />
            <Route path="/tasks/departments" element={<Navigate to="/task-portal/departments" replace />} />
            <Route path="/tasks/sub-departments" element={<Navigate to="/task-portal/sub-departments" replace />} />

            {/* Admin screens. SA / ADM pass on role; any other role passes when its
              permission matrix grants the module that path maps to (routeModules.js),
              which is what makes a custom role's sidebar links actually work. */}
            <Route element={<ModuleRoute allowedRoles={['SA', 'ADM']} />}>
              <Route path="/super-admin" element={<Navigate to="/super-admin/locations" replace />} />
              {/* Task Management - Departments/Sub-Departments stay SA/ADM only; the Tasks
                list moves below so grant-holding Organization Heads can reach it too. */}
              <Route path="/super-admin/departments" element={<TaskDepartments />} />
              <Route path="/super-admin/sub-departments" element={<TaskSubDepartments />} />
              <Route path="/super-admin/locations" element={<Locations />} />
              <Route path="/super-admin/projects" element={<Projects />} />
              <Route path="/super-admin/project-types" element={<ProjectTypes />} />
              <Route path="/super-admin/document-archive" element={<DocumentArchive />} />
              <Route path="/super-admin/document-management" element={<DocumentManagement />} />
              <Route path="/super-admin/lead-types" element={<LeadTypes />} />
              <Route path="/super-admin/lead-sources" element={<LeadSources />} />
              <Route path="/super-admin/lead-sub-sources" element={<LeadSubSources />} />
              <Route path="/super-admin/users" element={<Users />} />
              <Route path="/super-admin/user-types" element={<UserTypes />} />
              <Route path="/super-admin/customer-types" element={<CustomerTypes />} />
              <Route path="/super-admin/score-master" element={<ScoreMaster />} />
              <Route path="/super-admin/lead-statuses" element={<LeadStatuses />} />
              <Route path="/super-admin/booking-statuses" element={<BookingStatuses />} />
              <Route path="/super-admin/lead-stages" element={<LeadStages />} />
              <Route path="/super-admin/closed-lost-reasons" element={<ClosedLostReasons />} />
              <Route path="/super-admin/booking-cancel-reasons" element={<BookingCancelReasons />} />
              <Route path="/super-admin/status-remarks" element={<StatusRemarks />} />
              <Route path="/super-admin/workflow-actions" element={<WorkflowActions />} />
              <Route path="/super-admin/motivations" element={<Motivations />} />
              <Route path="/super-admin/inventory" element={<InventoryDashboard />} />
              <Route path="/super-admin/units" element={<InventoryUnitList />} />
              <Route path="/super-admin/inventory/:projectId" element={<InventoryUnitList />} />
              <Route path="/super-admin/lead-management" element={<AdminLeadManagement />} />
              <Route path="/super-admin/finance/revenue" element={<FinanceRevenue />} />
              <Route path="/super-admin/finance/collections" element={<FinanceCollections />} />
              <Route path="/super-admin/payment-types" element={<PaymentTypes />} />
              <Route path="/super-admin/payment-plans" element={<PaymentPlans />} />
              <Route path="/super-admin/payment-modes" element={<PaymentModes />} />
              <Route path="/super-admin/banks" element={<Banks />} />
              <Route path="/super-admin/payment-statuses" element={<PaymentStatuses />} />
              <Route path="/super-admin/site-settings" element={<SiteSettings />} />
              <Route path="/super-admin/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/super-admin/reallotment-rules" element={<ReallotmentRules />} />
              <Route path="/super-admin/reallotment-logs" element={<ReallotmentLogs />} />
              <Route path="/super-admin/wa-automation" element={<WhatsappAutomations />} />
              <Route path="/super-admin/marketing-allocation" element={<MarketingAllocationRules />} />
              <Route path="/super-admin/marketing-allocation-history" element={<MarketingAllocationHistory />} />
              <Route path="/super-admin/marketing-api-keys" element={<MarketingApiKeys />} />
              <Route path="/super-admin/marketing-campaigns" element={<MarketingCampaigns />} />
              {/* Recipient report - a real page, not the old modal, so a
                  10k-recipient send can be paged, filtered and searched. */}
              <Route path="/super-admin/marketing-campaigns/:id" element={<MarketingCampaignDetail />} />
              {/* Two-way chat fed by the `messages` half of the provider webhook. */}
              <Route path="/super-admin/whatsapp-inbox" element={<WhatsappInbox />} />
              <Route path="/super-admin/whatsapp-inbox/:id" element={<WhatsappInbox />} />
              <Route path="/super-admin/marketing-templates" element={<WhatsappTemplates />} />
              <Route path="/super-admin/whatsapp-settings" element={<WhatsappSettings />} />
              <Route path="/super-admin/telephony/settings" element={<TelephonyCallSettings />} />
              <Route path="/super-admin/telephony/call-logs" element={<TelephonyCallLogs />} />
              <Route path="/super-admin/telephony/allocation-history" element={<TelephonyCallAllocationHistory />} />
              <Route path="/super-admin/telephony/ai-analysis" element={<TelephonyCallAnalysisSettings />} />
              <Route path="/super-admin/attendance" element={<AttendancePage />} />
              <Route path="/super-admin/record-manager" element={<AdminRecordManager />} />
            </Route>

            {/* Cross-cutting modules reachable by SA/ADM AND grant-holding Organization
              Heads. The predicate already admits the base roles where applicable
              (Reports = SA/ADM; Booking Approvals = SA only, per the original gate). */}
            <Route element={<GrantRoute check={canViewAllReports} />}>
              <Route path="/super-admin/reports" element={<Reports />} />
              <Route path="/super-admin/reports/:module" element={<Reports />} />
              {/* Marketing › Reports - same reports gate as the main Reports page */}
              <Route path="/super-admin/marketing-reports" element={<MarketingReports />} />
              {/* Collection Report - org-wide twin of the Collection Manager portal screen */}
              <Route path="/super-admin/collection-reports" element={<CollectionReports />} />
              {/* Marketing Metrix - spend vs lead/SV/booking volume + the cost-per reports.
                Budget entry lives inside the page, so it shares the reports gate. */}
              <Route path="/super-admin/marketing-metrix" element={<MarketingMetrix />} />
            </Route>
            <Route element={<GrantRoute check={canAccessBookingApprovals} />}>
              <Route path="/super-admin/booking-approvals" element={<BookingApprovals />} />
            </Route>
            <Route element={<GrantRoute check={hasTaskPortalAccess} />}>
              <Route path="/super-admin/tasks" element={<TaskListPage />} />
              <Route path="/super-admin/tasks/dashboard" element={<SuperAdminTaskDashboard />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
