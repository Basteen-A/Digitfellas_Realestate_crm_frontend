// ============================================================
// ROUTE → PERMISSION MODULE MAP
//
// Which module (config/modules.js) each admin route belongs to, and the level it
// needs. ModuleRoute uses this so a custom role granted, say, `masters: write`
// can actually REACH /super-admin/lead-sources instead of being bounced to the
// dashboard by a hardcoded SA/ADM guard.
//
// This mirrors the server guards on the matching API routes - the screen is
// pointless without the data behind it, so the levels are kept the same:
//   a master list needs masters:read to view, masters:write to manage.
// Where a screen only exists to edit (the master CRUD pages), the level is the
// one the page's primary action needs.
//
// Longest prefix wins, so '/super-admin/telephony/settings' can be stricter than
// '/super-admin/telephony'. A path with no entry falls back to SA/ADM only -
// deliberately fail-closed, so a route added later is never silently public.
// ============================================================

// [pathPrefix, moduleKey, requiredLevel]
const ROUTE_MODULES = [
  // ── Workspace ──
  ['/super-admin/lead-management', 'leads', 'read'],
  ['/super-admin/tasks', 'tasks', 'read'],
  ['/super-admin/booking-approvals', 'booking_approvals', 'read'],
  ['/super-admin/record-manager', 'record_manager', 'read'],

  // ── Insights ──
  // The per-role Performance views are self-service (reports:read); the org-wide
  // Analytics tab inside them is gated again server-side on reports:full.
  ['/super-admin/reports', 'reports', 'read'],
  ['/super-admin/marketing-reports', 'reports', 'full'],
  ['/super-admin/marketing-metrix', 'reports', 'full'],
  ['/super-admin/collection-reports', 'reports', 'read'],

  // ── Inventory ──
  ['/super-admin/projects', 'projects', 'read'],
  ['/super-admin/project-types', 'projects', 'write'],
  ['/super-admin/inventory', 'inventory', 'write'],
  ['/super-admin/units', 'inventory', 'write'],
  ['/super-admin/locations', 'locations', 'write'],
  ['/super-admin/document-management', 'documents', 'write'],
  ['/super-admin/document-archive', 'documents', 'full'],

  // ── Finance ──
  ['/super-admin/finance', 'finance', 'read'],

  // ── Automation ──
  ['/super-admin/workflow-actions', 'automation', 'write'],
  ['/super-admin/reallotment-rules', 'automation', 'write'],
  ['/super-admin/reallotment-logs', 'automation', 'read'],
  // WA Automation lives under Automation but sends through the marketing
  // provider - the server admits marketing:write here too.
  ['/super-admin/wa-automation', 'automation', 'write'],

  // ── Marketing ──
  ['/super-admin/marketing-allocation-history', 'marketing', 'read'],
  ['/super-admin/marketing-allocation', 'marketing', 'write'],
  ['/super-admin/marketing-api-keys', 'marketing', 'full'],
  ['/super-admin/marketing-campaigns', 'marketing', 'write'],
  // Two-way inbox - same gate as campaigns: replying to a customer is a
  // marketing send, and it goes out on the same provider number.
  ['/super-admin/whatsapp-inbox', 'marketing', 'write'],
  ['/super-admin/marketing-templates', 'marketing', 'write'],
  ['/super-admin/whatsapp-settings', 'marketing', 'full'],

  // ── Telephony ──
  // Settings holds the provider credentials, so it follows the server and sits
  // behind org_settings rather than telephony.
  ['/super-admin/telephony/settings', 'org_settings', 'write'],
  ['/super-admin/telephony/allocation-history', 'telephony', 'full'],
  ['/super-admin/telephony/call-logs', 'telephony', 'read'],

  // ── Configuration ──
  ['/super-admin/users', 'users', 'write'],
  ['/super-admin/user-types', 'roles', 'read'],
  ['/super-admin/site-settings', 'org_settings', 'write'],
  ['/super-admin/attendance', 'attendance', 'write'],

  // ── Data masters (split three ways so a role can hold one set and not another) ──
  ['/super-admin/departments', 'tasks', 'full'],
  ['/super-admin/sub-departments', 'tasks', 'full'],
  ['/super-admin/lead-types', 'lead_masters', 'write'],
  ['/super-admin/lead-sources', 'lead_masters', 'write'],
  ['/super-admin/lead-sub-sources', 'lead_masters', 'write'],
  ['/super-admin/lead-stages', 'lead_masters', 'write'],
  ['/super-admin/lead-statuses', 'lead_masters', 'write'],
  ['/super-admin/status-remarks', 'lead_masters', 'write'],
  ['/super-admin/motivations', 'lead_masters', 'write'],
  ['/super-admin/closed-lost-reasons', 'lead_masters', 'write'],
  ['/super-admin/score-master', 'lead_masters', 'write'],
  ['/super-admin/booking-statuses', 'booking_finance_masters', 'write'],
  ['/super-admin/booking-cancel-reasons', 'booking_finance_masters', 'write'],
  ['/super-admin/payment-types', 'booking_finance_masters', 'write'],
  ['/super-admin/payment-plans', 'booking_finance_masters', 'write'],
  ['/super-admin/payment-modes', 'booking_finance_masters', 'write'],
  ['/super-admin/payment-statuses', 'booking_finance_masters', 'write'],
  ['/super-admin/banks', 'booking_finance_masters', 'write'],
  ['/super-admin/customer-types', 'other_masters', 'write'],
  ['/super-admin/terms-and-conditions', 'other_masters', 'write'],
];

// Longest prefix first, so a more specific entry always beats a shorter one.
const SORTED = [...ROUTE_MODULES].sort((a, b) => b[0].length - a[0].length);

/**
 * The [moduleKey, level] a path requires, or null when the path is not mapped
 * (caller then falls back to the role allow-list).
 */
export const moduleForPath = (pathname = '') => {
  const hit = SORTED.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? { module: hit[1], level: hit[2] } : null;
};

export default ROUTE_MODULES;
