// ============================================================
// SIDEBAR MENU CONFIGURATION — Role-specific menus
// ============================================================
import {
  ChartBarIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  BoltIcon,
  HandRaisedIcon,
  BriefcaseIcon,
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  InboxArrowDownIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  AdjustmentsHorizontalIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

/**
 * Returns the sidebar menu based on the user's role code.
 * SA/ADM → Admin sidebar with masters + all workspaces
 * TC     → Telecaller sidebar (leads, follow-ups, pipeline)
 * SM     → Sales Manager sidebar (leads, site visits, incoming)
 * SH     → Sales Head sidebar (negotiations, bookings)
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
  // Top-level Dashboard
  { label: 'DASHBOARD', path: '/dashboard', icon: Squares2X2Icon },

  // Lead Management – full CRM lead overview for admin
  { label: 'Lead Management', path: '/super-admin/lead-management', icon: ClipboardDocumentListIcon },

  // Inventory group
  {
    label: 'PROPERTIES',
    icon: BuildingStorefrontIcon,
    children: [
      { label: 'Inventory Overview', path: '/super-admin/inventory' },
      { label: 'Locations', path: '/super-admin/locations' },
      { label: 'Projects', path: '/super-admin/projects' },
      { label: 'Project Types', path: '/super-admin/project-types' },
      { label: 'Manage Units', path: '/super-admin/units' }
    ],
  },

  // User Management group
  {
    label: 'User Management',
    icon: UserGroupIcon,
    children: [
      { label: 'Users', path: '/super-admin/users' },
      { label: 'User Types', path: '/super-admin/user-types' },
    ],
  },

  // Lead Configuration group
  {
    label: 'Lead Configuration',
    icon: AdjustmentsHorizontalIcon,
    children: [
      { label: 'Lead Types', path: '/super-admin/lead-types' },
      { label: 'Lead Sources', path: '/super-admin/lead-sources' },
      { label: 'Lead Sub-Sources', path: '/super-admin/lead-sub-sources' },
      { label: 'Lead Stages', path: '/super-admin/lead-stages' },
      { label: 'Lead Statuses', path: '/super-admin/lead-statuses' },
      { label: 'Quick Remarks', path: '/super-admin/status-remarks' },
      { label: 'Motivations', path: '/super-admin/motivations' },
      { label: 'Closed-Lost Reasons', path: '/super-admin/closed-lost-reasons' },
      { label: 'Customer Types', path: '/super-admin/customer-types' },
    ],
  },

  // System & Workflow group
  {
    label: 'System & Workflow',
    icon: Cog6ToothIcon,
    children: [
      { label: 'Workflow Actions', path: '/super-admin/workflow-actions' },
      { label: 'Score Master', path: '/super-admin/score-master' },
      { label: 'Booking Statuses', path: '/super-admin/booking-statuses' },
      { label: 'Booking Cancel Reasons', path: '/super-admin/booking-cancel-reasons' },
      { label: 'Payment Types', path: '/super-admin/payment-types' },
      { label: 'Payment Plans', path: '/super-admin/payment-plans' },
    ],
  },
];

// ── Telecaller ──
const telecallerSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: ChartBarIcon },
  { label: 'Leads', path: '/telecaller/leads', icon: UsersIcon },
  { label: 'SV Leads', path: '/telecaller/handoffs', icon: HandRaisedIcon },
  { label: 'Performance Tracker', path: '/telecaller/pipeline', icon: ClipboardDocumentListIcon },
];

// ── Sales Manager ──
const salesManagerSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: ChartBarIcon },
  { label: 'Leads', path: '/sales-manager/leads', icon: UsersIcon },
  { label: 'Revisits', path: '/sales-manager/visits', icon: ArrowPathIcon },
  { label: 'Incoming Leads', path: '/sales-manager/incoming', icon: BoltIcon },
];

// ── Sales Head ──
const salesHeadSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: ChartBarIcon },
  { label: 'Negotiations', path: '/sales-head/leads', icon: HandRaisedIcon },
  { label: 'Bookings', path: '/sales-head/bookings', icon: ClipboardDocumentListIcon },
  { label: 'All Leads', path: '/sales-head/all-leads', icon: UsersIcon },
  { label: 'Team', path: '/sales-head/team', icon: BriefcaseIcon },
];

// ── Collection Manager ──
const collectionSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: ChartBarIcon },
  { label: 'Leads', path: '/collection/leads', icon: BanknotesIcon },
  { label: 'Payments', path: '/collection/payments', icon: CreditCardIcon },
];

// Legacy export for backward compatibility
export const sidebarMenu = adminSidebar;

// ── Portal menus (key-based, used inside workspace components) ──
export const telecallerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: ChartBarIcon, badge: null },
  { label: 'Leads', key: 'leads', icon: UsersIcon, badgeColor: 'blue' },
  { label: 'SV Leads', key: 'handoffs', icon: HandRaisedIcon, badgeColor: 'purple' },
  { label: 'Performance Tracker', key: 'pipeline', icon: ClipboardDocumentListIcon, badge: null },
  { group: 'Quick Actions' },
  { label: 'Call Log', key: 'calllog', icon: DevicePhoneMobileIcon, badge: null },
  { label: 'Pull Requests', key: 'pullrequests', icon: InboxArrowDownIcon, badgeColor: 'red' },
];

export const salesManagerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: ChartBarIcon, badge: null },
  { label: 'My Leads', key: 'leads', icon: UsersIcon, badgeColor: 'green' },
  { label: 'Negotiations', key: 'handoffs', icon: HandRaisedIcon, badgeColor: 'purple' },
  { label: 'Site Visits', key: 'sitevisits', icon: HomeModernIcon, badge: null },
  { group: 'Workflow' },
  { label: 'Incoming Leads', key: 'incoming', icon: BoltIcon, badgeColor: 'orange' },
  // { label: 'Pull Lead', key: 'pull', icon: MagnifyingGlassIcon, badge: null },
];

export const salesHeadMenu = [
  { group: 'Sales' },
  { label: 'Dashboard', key: 'dashboard', icon: ChartBarIcon, badge: null },
  { label: 'My Leads', key: 'negotiations', icon: HandRaisedIcon, badgeColor: 'purple' },
  { label: 'Bookings Handoffs', key: 'handoffs', icon: ArrowsRightLeftIcon, badgeColor: 'blue' },
  { label: 'Bookings', key: 'bookings', icon: ClipboardDocumentListIcon, badgeColor: 'green' },
  { group: 'Overview' },
  { label: 'SM Team', key: 'smteam', icon: UsersIcon, badge: null },
  // { label: 'Site Visits', key: 'sitevisits', icon: HomeModernIcon, badge: null },
  { label: 'Team Metrics', key: 'team', icon: BriefcaseIcon, badge: null },
];

export const collectionMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: ChartBarIcon, badge: null },
  { label: 'My Leads', key: 'leads', icon: UsersIcon, badgeColor: 'blue' },
  { group: 'Bookings & Payments' },
  { label: 'Bookings', key: 'bookings', icon: ClipboardDocumentListIcon, badgeColor: 'green' },
  { label: 'Payments', key: 'payments', icon: CreditCardIcon, badge: null },
  { label: 'Customer Profiles', key: 'customers', icon: UserGroupIcon, badge: null },
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
