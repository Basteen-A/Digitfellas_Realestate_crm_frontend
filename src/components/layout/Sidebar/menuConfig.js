// ============================================================
// SIDEBAR MENU CONFIGURATION — Role-specific menus
// ============================================================

/**
 * Returns the sidebar menu based on the user's role code.
 * SA/ADM → Admin sidebar with masters + all workspaces
 * TC     → Telecaller sidebar (leads, follow-ups, pipeline)
 * SM     → Sales Manager sidebar (leads, site visits, incoming)
 * SH     → Sales Head sidebar (negotiations, bookings, approvals)
 * COL    → Collection sidebar
 */
export const getSidebarMenuForRole = (roleCode) => {
  switch (roleCode) {
    case 'SA':
    case 'ADM':
      return adminSidebar;
    case 'TC':
      return telecallerSidebar;
    case 'SM':
      return salesManagerSidebar;
    case 'SH':
      return salesHeadSidebar;
    case 'COL':
      return collectionSidebar;
    default:
      return telecallerSidebar;
  }
};

// ── Admin / Super Admin ──
const adminSidebar = [
  {
    label: 'Masters',
    icon: '🛠',
    children: [
      { label: 'Users', path: '/super-admin/users' },
      { label: 'User Types', path: '/super-admin/user-types' },
      { label: 'Locations', path: '/super-admin/locations' },
      { label: 'Projects', path: '/super-admin/projects' },
      { label: 'Project Types', path: '/super-admin/project-types' },
      { label: 'Lead Types', path: '/super-admin/lead-types' },
      { label: 'Lead Sources', path: '/super-admin/lead-sources' },
      { label: 'Lead Sub-Sources', path: '/super-admin/lead-sub-sources' },
      { label: 'Customer Types', path: '/super-admin/customer-types' },
      { label: 'Score Master', path: '/super-admin/score-master' },
      { label: 'Lead Stages', path: '/super-admin/lead-stages' },
      { label: 'Lead Statuses', path: '/super-admin/lead-statuses' },
      { label: 'Booking Statuses', path: '/super-admin/booking-statuses' },
      { label: 'Closed-Lost Reasons', path: '/super-admin/closed-lost-reasons' },
      { label: 'Booking Cancel Reasons', path: '/super-admin/booking-cancel-reasons' },
    ],
  },
];

// ── Telecaller ──
const telecallerSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'My Leads', path: '/telecaller/leads', icon: '👥' },
  { label: "Today's Follow Ups", path: '/telecaller/followups', icon: '📞' },
  { label: 'Pipeline Board', path: '/telecaller/pipeline', icon: '📋' },
];

// ── Sales Manager ──
const salesManagerSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'My Leads', path: '/sales-manager/leads', icon: '👥' },
  { label: 'Revisits', path: '/sales-manager/visits', icon: '🔄' },
  { label: 'Incoming Leads', path: '/sales-manager/incoming', icon: '⚡' },
];

// ── Sales Head ──
const salesHeadSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'Negotiations', path: '/sales-head/leads', icon: '🤝' },
  { label: 'Bookings', path: '/sales-head/bookings', icon: '📋' },
  { label: 'All Leads', path: '/sales-head/all-leads', icon: '👥' },
  { label: 'Team', path: '/sales-head/team', icon: '👔' },
];

// ── Collection Manager ──
const collectionSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'My Leads', path: '/collection/leads', icon: '💰' },
  { label: 'Payments', path: '/collection/payments', icon: '💳' },
];

// Legacy export for backward compatibility
export const sidebarMenu = adminSidebar;

// ── Portal menus (key-based, used inside workspace components) ──
export const telecallerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: '📊', badge: null },
  { label: 'My Leads', key: 'leads', icon: '👥', badgeColor: 'blue' },
  { label: 'Handoff Leads', key: 'handoffs', icon: '🤝', badgeColor: 'purple' },
  { label: "Today's Follow Ups", key: 'followups', icon: '📞', badgeColor: 'orange' },
  { label: 'Pipeline Board', key: 'pipeline', icon: '📋', badge: null },
  { group: 'Quick Actions' },
  { label: 'Add New Lead', key: 'addlead', icon: '➕', badge: null },
  { label: 'Call Log', key: 'calllog', icon: '📱', badge: null },
  { label: 'Pull Requests', key: 'pullrequests', icon: '📥', badgeColor: 'red' },
];

export const salesManagerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: '📊', badge: null },
  { label: 'My Leads', key: 'leads', icon: '👥', badgeColor: 'green' },
  { label: 'Handoff Leads', key: 'handoffs', icon: '🤝', badgeColor: 'purple' },
  { label: 'Revisits', key: 'visits', icon: '🔄', badge: null },
  { group: 'Workflow' },
  { label: 'Incoming Leads', key: 'incoming', icon: '⚡', badgeColor: 'orange' },
  { label: 'Pull Lead', key: 'pull', icon: '🔍', badge: null },
  { label: 'Push to Sales Head', key: 'push', icon: '🚀', badge: null },
];

export const salesHeadMenu = [
  { group: 'Sales' },
  { label: 'Dashboard', key: 'dashboard', icon: '📊', badge: null },
  { label: 'Negotiations', key: 'negotiations', icon: '🤝', badgeColor: 'purple' },
  { label: 'Handoff Leads', key: 'handoffs', icon: '🔁', badgeColor: 'blue' },
  { label: 'Bookings', key: 'bookings', icon: '📋', badgeColor: 'green' },
  { label: 'Approvals', key: 'approvals', icon: '✅', badgeColor: 'red' },
  { group: 'Overview' },
  { label: 'All Leads', key: 'allleads', icon: '👥', badge: null },
  { label: 'Team', key: 'team', icon: '👔', badge: null },
  { label: 'Revenue', key: 'revenue', icon: '💰', badge: null },
];

export const ROLE_LABELS = {
  SA: 'Super Admin',
  ADM: 'Admin',
  SH: 'Sales Head',
  SM: 'Sales Manager',
  TC: 'Telecaller',
  COL: 'Collection Manager',
  CRM: 'CRM Executive',
};
