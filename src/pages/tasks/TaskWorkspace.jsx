import React from 'react';
import { useSelector } from 'react-redux';
import {
  Squares2X2Icon,
  ClipboardDocumentListIcon,
  BuildingOffice2Icon,
  RectangleGroupIcon,
} from '@heroicons/react/24/outline';
import PortalLayout from '../portals/common/PortalLayout';
import { getRoleCode } from '../../utils/permissions';
import TaskDashboard from './TaskDashboard';
import TaskListPage from './TaskListPage';
import Departments from './Departments';
import SubDepartments from './SubDepartments';

/**
 * Standard Executive task portal, rendered inside the shared PortalLayout so it
 * matches the look (light sidebar, topbar, theme/notif/user menu) of every other
 * role portal. Screens are key-based; the route only seeds the initial screen.
 */
const TaskWorkspace = ({ defaultScreen = 'dashboard' }) => {
  const user = useSelector((state) => state.auth.user);
  const isAdmin = ['SA', 'ADM'].includes(getRoleCode(user));

  const menuItems = [
    { group: 'Menu' },
    { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon },
    { label: 'Tasks', key: 'tasks', icon: ClipboardDocumentListIcon },
    ...(isAdmin
      ? [
          { group: 'Configuration' },
          { label: 'Departments', key: 'departments', icon: BuildingOffice2Icon },
          { label: 'Sub-Departments', key: 'sub-departments', icon: RectangleGroupIcon },
        ]
      : []),
  ];

  return (
    <PortalLayout
      menuItems={menuItems}
      roleName={isAdmin ? 'Super Admin' : 'Standard Executive'}
      user={user}
      defaultScreen={defaultScreen}
      searchPlaceholder="Search tasks..."
    >
      {({ activeScreen, setActiveScreen }) => (
        <>
          {activeScreen === 'dashboard' && <TaskDashboard onOpenTasks={() => setActiveScreen('tasks')} />}
          {activeScreen === 'tasks' && <TaskListPage />}
          {isAdmin && activeScreen === 'departments' && <Departments />}
          {isAdmin && activeScreen === 'sub-departments' && <SubDepartments />}
        </>
      )}
    </PortalLayout>
  );
};

export default TaskWorkspace;
