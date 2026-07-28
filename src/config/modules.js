// ============================================================
// MODULE CATALOGUE + PERMISSION LEVELS
// The single source of truth for role-based module permissions.
//
// A role (user_type) stores a { moduleKey: level } matrix in
// user_types.module_permissions. A user may override individual modules via
// users.module_permission_overrides. The auth middleware merges the two into
// req.user.permissions on every request — no extra queries, because both
// columns ride along on the rows it already loads.
//
// ── Levels ───────────────────────────────────────────────────────────────
//   none   cannot see the module at all (hidden from the sidebar, 403 on API)
//   read   may view lists / detail / reports
//   write  read + create & edit
//   full   write + delete, plus the module's privileged actions (approve,
//          verify, configure, act outside your own scope)
//
// Levels are ordered, so a check for `read` passes for write and full.
//
// IMPORTANT: client/src/config/modules.js mirrors this file. The two MUST stay
// in lock-step — the server enforces, the client only draws the matrix and the
// sidebar from it. Change one, change the other.
// ============================================================

export const LEVELS = ['none', 'read', 'write', 'full'];

export const LEVEL_RANK = LEVELS.reduce((acc, key, i) => { acc[key] = i; return acc; }, {});

// Most modules support the whole ladder; a few are meaningfully view-only.
export const ALL = ['none', 'read', 'write', 'full'];
export const READ_ONLY = ['none', 'read'];
export const READ_FULL = ['none', 'read', 'full'];

// Groups mirror the Super Admin sidebar sections so the matrix on screen reads
// in the same order as the navigation the admin already knows.
export const MODULES = [
  // ── WORKSPACE ──
  { key: 'dashboard', label: 'Dashboard', group: 'Workspace', levels: READ_ONLY, description: 'Role dashboard and KPI cards' },
  { key: 'leads', label: 'Leads', group: 'Workspace', levels: ALL, description: 'Lead list, detail, follow-ups and site visits' },
  { key: 'tasks', label: 'Tasks', group: 'Workspace', levels: ALL, description: 'Task management module and departments' },
  { key: 'bookings', label: 'Bookings', group: 'Workspace', levels: ALL, description: 'Booking pipeline, customers and payments' },
  { key: 'booking_approvals', label: 'Booking Approvals', group: 'Workspace', levels: READ_FULL, description: 'Approve or reject bookings sent for approval' },
  { key: 'record_manager', label: 'Record Manager', group: 'Workspace', levels: ALL, description: 'Registered bookings and the document archive' },

  // ── INSIGHTS ──
  // read = self-service (your own / your team's numbers, the level TC, SM and SH
  // have always had). full = org-wide: every role tab, every user, marketing and
  // collection reports. The gap between the two is deliberate — do not collapse it.
  { key: 'reports', label: 'Reports & Analytics', group: 'Insights', levels: READ_FULL, description: 'Read = own & team numbers · Full = org-wide, every role and user' },

  // ── INVENTORY ──
  { key: 'projects', label: 'Projects', group: 'Inventory', levels: ALL, description: 'Projects, project types and phases' },
  { key: 'inventory', label: 'Units & Plots', group: 'Inventory', levels: ALL, description: 'Inventory units and plot availability' },
  { key: 'locations', label: 'Locations', group: 'Inventory', levels: ALL, description: 'Location master' },
  { key: 'documents', label: 'Documents', group: 'Inventory', levels: ALL, description: 'Project document management and archive' },

  // ── FINANCE ──
  { key: 'finance', label: 'Finance', group: 'Finance', levels: ALL, description: 'Revenue, collections and the payment ledger' },
  { key: 'payment_verification', label: 'Payment Verification', group: 'Finance', levels: READ_FULL, description: 'Verify or reject collected payments' },

  // ── AUTOMATION ──
  { key: 'automation', label: 'Automation', group: 'Automation', levels: ALL, description: 'Workflow actions, reallocation rules and history' },

  // ── MARKETING ──
  { key: 'marketing', label: 'Marketing', group: 'Marketing', levels: ALL, description: 'Campaigns, templates, allocation rules and API keys' },

  // ── TELEPHONY ──
  // read = your own / your team's call logs. full = the whole telecalling floor:
  // every call log, the inbound allocation history and provider settings. Same
  // deliberate gap as reports.
  { key: 'telephony', label: 'Telephony', group: 'Telephony', levels: READ_FULL, description: 'Read = own & team calls · Full = all call logs, allocation history, settings' },

  // ── CONFIGURATION ──
  { key: 'users', label: 'Users', group: 'Configuration', levels: ALL, description: 'Create and manage user accounts' },
  { key: 'roles', label: 'Roles & Permissions', group: 'Configuration', levels: ALL, description: 'This screen — create roles and set their module access' },
  { key: 'org_settings', label: 'Org Settings', group: 'Configuration', levels: ALL, description: 'Branding, site settings and terms' },
  { key: 'attendance', label: 'Attendance', group: 'Configuration', levels: ALL, description: 'Check-in records and attendance settings' },
  { key: 'masters', label: 'Data Masters', group: 'Configuration', levels: ALL, description: 'Lead, booking and finance master data' },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);
export const MODULE_BY_KEY = MODULES.reduce((acc, m) => { acc[m.key] = m; return acc; }, {});

export const MODULE_GROUPS = MODULES.reduce((acc, m) => {
  if (!acc.includes(m.group)) acc.push(m.group);
  return acc;
}, []);

/** Normalise anything into a valid level string, defaulting to 'none'. */
export const normalizeLevel = (level) => (LEVEL_RANK[level] === undefined ? 'none' : level);

/** true when `level` satisfies a requirement of `required`. */
export const levelSatisfies = (level, required) =>
  LEVEL_RANK[normalizeLevel(level)] >= LEVEL_RANK[normalizeLevel(required)];

/** A matrix with every module set to the same level — used for SA (full) and defaults (none). */
export const uniformMatrix = (level) =>
  MODULE_KEYS.reduce((acc, key) => { acc[key] = normalizeLevel(level); return acc; }, {});

/**
 * Drop unknown keys and clamp each value to a level the module actually offers.
 * Anything the module does not support falls back to the highest level it does
 * support that is still <= the requested one (so 'write' on a read-only module
 * becomes 'read', never an escalation).
 */
export const sanitizeMatrix = (matrix = {}) => {
  const out = {};
  MODULES.forEach((mod) => {
    const requested = normalizeLevel(matrix[mod.key]);
    if (mod.levels.includes(requested)) {
      out[mod.key] = requested;
      return;
    }
    const allowed = mod.levels
      .filter((l) => LEVEL_RANK[l] <= LEVEL_RANK[requested])
      .sort((a, b) => LEVEL_RANK[b] - LEVEL_RANK[a]);
    out[mod.key] = allowed[0] || 'none';
  });
  return out;
};
