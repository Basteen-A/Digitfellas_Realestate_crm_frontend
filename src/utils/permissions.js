import { ROLE_CODES, ROLE_GROUPS } from './constants';

export const getRoleCode = (user) =>
  (() => {
    const code = user?.userTypeCode || user?.user_type_code || user?.userType?.short_code || null;
    if (!code) return null;
    const normalized = String(code).toUpperCase();
    if (['CM', 'COLLECTION', 'COLLECTION_MANAGER', 'COLLECTION_OFFICER'].includes(normalized)) {
      return ROLE_CODES.COLLECTION;
    }
    if (['TC', 'TELE_CALLER', 'TELECALLER'].includes(normalized)) return ROLE_CODES.TELECALLER;
    if (['SM', 'SALES_MANAGER', 'SALESMANAGER'].includes(normalized)) return ROLE_CODES.SALES_MANAGER;
    if (['SH', 'SALES_HEAD', 'SALESHEAD'].includes(normalized)) return ROLE_CODES.SALES_HEAD;
    if (['ACCT', 'ACCOUNTS', 'ACCOUNTS_EXEC', 'ACCOUNTS_EXECUTIVE'].includes(normalized)) {
      return ROLE_CODES.ACCOUNTS_EXEC;
    }
    if (['SE', 'STANDARD_EXECUTIVE', 'STANDARD_EXEC'].includes(normalized)) return 'SE';
    return normalized;
  })();

export const hasRole = (user, roleCode) => getRoleCode(user) === roleCode;

export const hasAnyRole = (user, roleCodes = []) => roleCodes.includes(getRoleCode(user));

// Task Management portal access: Super Admin / Admin always, plus users
// explicitly granted via the user edit page. Handles both the login payload
// (taskPortalAccess) and the /auth/me payload (task_portal_access).
export const hasTaskPortalAccess = (user) => {
  if (!user) return false;
  const code = getRoleCode(user);
  if (code === 'SA' || code === 'ADM' || code === 'SE') return true;
  // Per-user grant: legacy task_portal_access OR the Organization Head tasks read/write grant.
  return user.taskPortalAccess === true || user.task_portal_access === true
    || user.tasksReadWrite === true || user.tasks_read_write === true;
};

export const isTaskAdmin = (user) => ['SA', 'ADM'].includes(getRoleCode(user));

// ── Per-module access grants (Organization Head). Helpers tolerate both the login
// payload (camelCase) and the /auth/me payload (snake_case). Each = the base role
// that always had access OR the matching grant. Mirrors server/src/utils/accessGrants.js.
const hasGrant = (user, camel, snake) => user?.[camel] === true || user?.[snake] === true;

// Reports — view all reports like a Super Admin (SA/ADM always; granted OH users too).
export const canViewAllReports = (user) => {
  const code = getRoleCode(user);
  return code === 'SA' || code === 'ADM' || hasGrant(user, 'reportsAccess', 'reports_access');
};

// Tasks — All Access: see / edit / delete EVERY task.
export const canManageAllTasks = (user) => {
  const code = getRoleCode(user);
  return code === 'SA' || code === 'ADM' || hasGrant(user, 'tasksAllAccess', 'tasks_all_access');
};

// Booking Approval — view queue + approve/reject. SA-only by design (Admin cannot approve)
// plus granted OH users.
export const canAccessBookingApprovals = (user) =>
  getRoleCode(user) === 'SA' || hasGrant(user, 'bookingApprovalReadWrite', 'booking_approval_read_write');

// Booking Approval — All Access: act on EVERY booking.
export const canApproveAllBookings = (user) =>
  getRoleCode(user) === 'SA' || hasGrant(user, 'bookingApprovalAllAccess', 'booking_approval_all_access');

export const isAdminLevel = (user) => hasAnyRole(user, ROLE_GROUPS.ADMIN_LEVEL);

export const isManagementLevel = (user) => hasAnyRole(user, ROLE_GROUPS.MANAGEMENT_LEVEL);

export const canAccessSuperAdmin = (user) => hasAnyRole(user, ROLE_GROUPS.ADMIN_LEVEL);

export const canManageUsers = (user) => hasAnyRole(user, [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN]);

export const canViewDashboard = (user) => Boolean(getRoleCode(user));

export const routePermissions = {
  '/dashboard': ROLE_GROUPS.SALES_TEAM,
  '/telecaller/leads': [ROLE_CODES.TELECALLER, ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN],
  '/sales-manager/leads': [ROLE_CODES.SALES_MANAGER, ROLE_CODES.SALES_HEAD, ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN],
  '/sales-head/leads': [ROLE_CODES.SALES_HEAD, ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN],
  '/collection/leads': [ROLE_CODES.COLLECTION, ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN],
  '/accounts/dashboard': [ROLE_CODES.ACCOUNTS_EXEC, ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN],
  '/super-admin': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/locations': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/projects': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/project-types': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/document-archive': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/document-management': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/lead-types': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/lead-sources': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/lead-sub-sources': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/users': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/user-types': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/customer-types': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/score-master': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/lead-statuses': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/booking-statuses': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/lead-stages': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/closed-lost-reasons': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/booking-cancel-reasons': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/workflow-actions': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/terms-and-conditions': ROLE_GROUPS.ADMIN_LEVEL,
};

export const canAccessRoute = (user, path) => {
  const allowed = routePermissions[path];
  if (!allowed) return true;
  return hasAnyRole(user, allowed);
};
