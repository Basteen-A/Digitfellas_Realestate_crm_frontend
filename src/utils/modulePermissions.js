// ============================================================
// CLIENT-SIDE PERMISSION HELPERS
//
// These decide what to DRAW — the sidebar, buttons, tabs. They are a UX layer,
// never a security boundary: the server re-checks every request through
// middleware/requirePermission.js. Hiding a button here does not protect the
// endpoint behind it, and it is not supposed to.
//
// The matrix arrives on the auth payload as `user.permissions`
// ({ moduleKey: 'none'|'read'|'write'|'full' }) from both /auth/login and
// /auth/me. Users authenticated before this shipped have no matrix on their
// cached payload, so every helper falls back to "no opinion" rather than
// locking the UI down — see hasModule().
// ============================================================

import { MODULE_KEYS, MODULES, levelSatisfies, normalizeLevel } from '../config/modules';
import { getRoleCode } from './permissions';

/** The raw matrix off the user payload, or null when the session predates it. */
export const permissionMatrix = (user) => {
  const p = user?.permissions;
  return p && typeof p === 'object' && Object.keys(p).length ? p : null;
};

/** Level the user holds on a module. 'none' when unknown. */
export const moduleLevel = (user, moduleKey) =>
  normalizeLevel(permissionMatrix(user)?.[moduleKey]);

/**
 * Does this user meet `required` on `moduleKey`?
 *
 * Super Admin always passes. When the payload carries no matrix at all (an old
 * cached session), returns `fallback` — default true — so a stale token degrades
 * to the previous role-based behaviour instead of an empty screen. The server
 * still enforces, so a wrong `true` here costs a 403, not a leak.
 */
export const hasModule = (user, moduleKey, required = 'read', fallback = true) => {
  if (!user) return false;
  if (getRoleCode(user) === 'SA') return true;
  const matrix = permissionMatrix(user);
  if (!matrix) return fallback;
  return levelSatisfies(normalizeLevel(matrix[moduleKey]), required);
};

/** Convenience: can the module be seen at all. */
export const canSeeModule = (user, moduleKey) => hasModule(user, moduleKey, 'read');
/** Convenience: can the user create / edit inside the module. */
export const canWriteModule = (user, moduleKey) => hasModule(user, moduleKey, 'write');
/** Convenience: does the user hold the module's privileged level. */
export const canManageModule = (user, moduleKey) => hasModule(user, moduleKey, 'full');

/** Every module key the user holds at least `required` on. */
export const modulesAtLeast = (user, required = 'read') =>
  MODULE_KEYS.filter((key) => hasModule(user, key, required, false));

/** The catalogue entries the user can see, in catalogue order — drives the sidebar. */
export const visibleModules = (user) =>
  MODULES.filter((m) => hasModule(user, m.key, 'read', false));

/**
 * True when this user's role has no bespoke portal and should be rendered by the
 * generic, matrix-driven one. Built-in roles keep their hand-built portals.
 */
export const usesGenericPortal = (user) => {
  const portalType = user?.portalType || user?.portal_type;
  if (portalType) return portalType === 'generic';
  // No portal_type on the payload (old session): fall back to "is this one of
  // the short codes that has a bespoke portal".
  return !BUILT_IN_PORTAL_CODES.includes(getRoleCode(user));
};

// Short codes that have a hand-built portal in the app today.
export const BUILT_IN_PORTAL_CODES = [
  'SA', 'ADM', 'OH', 'SH', 'SM', 'TC', 'CRM', 'COL', 'CE', 'ACCT', 'AM', 'RM', 'SE',
];
