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
    return normalized;
  })();

export const hasRole = (user, roleCode) => getRoleCode(user) === roleCode;

export const hasAnyRole = (user, roleCodes = []) => roleCodes.includes(getRoleCode(user));

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
  '/super-admin': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/locations': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/projects': ROLE_GROUPS.ADMIN_LEVEL,
  '/super-admin/project-types': ROLE_GROUPS.ADMIN_LEVEL,
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
};

export const canAccessRoute = (user, path) => {
  const allowed = routePermissions[path];
  if (!allowed) return true;
  return hasAnyRole(user, allowed);
};
