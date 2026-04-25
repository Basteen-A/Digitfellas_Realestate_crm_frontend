import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSelector } from 'react-redux';
import PrivateRoute from './PrivateRoute';
import PublicRoute from './PublicRoute';
import RoleRoute from './RoleRoute';
import { getRoleCode } from '../utils/permissions';

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
import NotFound from '../pages/NotFound';

import Locations from '../pages/superadmin/Locations';
import Projects from '../pages/superadmin/Projects';
import ProjectTypes from '../pages/superadmin/ProjectTypes';
import LeadTypes from '../pages/superadmin/LeadTypes';
import LeadSources from '../pages/superadmin/LeadSources';
import LeadSubSources from '../pages/superadmin/LeadSubSources';
import Users from '../pages/superadmin/Users';
import UserTypes from '../pages/superadmin/UserTypes';
import CustomerTypes from '../pages/superadmin/CustomerTypes';
import ScoreMaster from '../pages/superadmin/ScoreMaster';
import LeadStatuses from '../pages/superadmin/LeadStatuses';
import BookingStatuses from '../pages/superadmin/BookingStatuses';
import LeadStages from '../pages/superadmin/LeadStages';
import ClosedLostReasons from '../pages/superadmin/ClosedLostReasons';
import BookingCancelReasons from '../pages/superadmin/BookingCancelReasons';
import StatusRemarks from '../pages/superadmin/StatusRemarks';
import WorkflowActions from '../pages/superadmin/WorkflowActions/WorkflowActionList';
import Motivations from '../pages/superadmin/Motivations';
import { InventoryDashboard, InventoryUnitList } from '../pages/superadmin/Inventory';
import { AdminLeadManagement } from '../pages/superadmin/LeadManagement';
import TelecallerWorkspace from '../pages/portals/telecaller';
import SalesManagerWorkspace from '../pages/portals/salesmanager';
import SalesHeadWorkspace from '../pages/portals/saleshead';
import CollectionWorkspace from '../pages/portals/collection';

const RoleHomeRedirect = () => {
  const user = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(user);

  if (roleCode === 'TC') return <Navigate to="/telecaller/leads" replace />;
  if (roleCode === 'SM') return <Navigate to="/sales-manager/leads" replace />;
  if (roleCode === 'SH') return <Navigate to="/sales-head/leads" replace />;
  if (roleCode === 'COL') return <Navigate to="/collection/leads" replace />;

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

      {/* Portal routes — no app sidebar, portals have their own sidebar */}
      <Route element={<PrivateRoute />}>
        <Route element={<PortalLayoutRoute />}>
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

          <Route element={<RoleRoute allowedRoles={['TC', 'SM', 'SH', 'COL', 'SA', 'ADM']} />}>
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

      {/* Admin & general routes — standard MainLayout with app sidebar */}
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/change-password" element={<ChangePassword />} />
          <Route path="/lead/:id" element={<LeadDetailsPage />} />

          <Route element={<RoleRoute allowedRoles={['SA', 'ADM']} />}>
            <Route path="/super-admin" element={<Navigate to="/super-admin/locations" replace />} />
            <Route path="/super-admin/locations" element={<Locations />} />
            <Route path="/super-admin/projects" element={<Projects />} />
            <Route path="/super-admin/project-types" element={<ProjectTypes />} />
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
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
