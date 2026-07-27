// ============================================================
// SIDEBAR MENU CONFIGURATION — Role-specific menus
// ============================================================
import {
  ChartBarIcon,
  UsersIcon,
  FingerPrintIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  BoltIcon,
  HandRaisedIcon,
  BriefcaseIcon,
  CreditCardIcon,
  HomeModernIcon,
  ArrowsRightLeftIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  Squares2X2Icon,
  BanknotesIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  UserPlusIcon,
  TrophyIcon,
  PhoneArrowDownLeftIcon,
  PhoneIcon,
  PaperAirplaneIcon,
  MegaphoneIcon,
  KeyIcon,
  ChatBubbleLeftRightIcon,
  FolderOpenIcon,
} from '@heroicons/react/24/outline';
import { canViewAllReports, canAccessBookingApprovals, hasTaskPortalAccess } from '../../../utils/permissions';

/**
 * Returns the sidebar menu based on the user's role code.
 * SA/ADM → Admin sidebar with masters + all workspaces
 * TC     → Telecaller sidebar (leads, follow-ups, pipeline)
 * SM     → Sales Manager sidebar (leads, site visits, incoming)
 * SH     → Sales Head sidebar (negotiations, bookings)
 * COL    → Collection sidebar
 */
export const getSidebarMenuForRole = (roleCode, user = null) => {
  switch (roleCode) {
    case 'SA':
      return adminSidebar;
    case 'ADM':
      // Booking Approvals is Super Admin only — hide that child from plain Admins.
      return adminSidebar.map((item) => (item.children
        ? { ...item, children: item.children.filter((c) => c.path !== '/super-admin/booking-approvals') }
        : item));
    case 'OH':
      return buildOrganizationHeadSidebar(user);
    case 'TC':
      return telecallerSidebar;
    case 'SM':
      return salesManagerSidebar;
    case 'SH':
      return salesHeadSidebar;
    case 'COL':
      return collectionSidebar;
    case 'ACCT':
      return accountsSidebar;
    case 'RM':
      return recordManagerSidebar;
    case 'AM':
      return accountsManagerSidebar;
    case 'CE':
      return collectionExecSidebar;
    default:
      return telecallerSidebar;
  }
};

// ── Organization Head ──
// Grant-driven menu — only the modules the Super Admin ticked on the user form
// (Reports / Booking Approvals / Tasks) appear. Reuses the existing admin pages.
const buildOrganizationHeadSidebar = (user) => {
  const menu = [{ section: 'WORKSPACE' }];
  if (canViewAllReports(user)) {
    // Mirror the admin Reports: org-wide Analytics + per-role Performance views.
    menu.push({
      label: 'Reports',
      icon: ChartBarIcon,
      children: [
        { label: 'Organization', path: '/super-admin/reports/organization' },
        { label: 'Telecaller', path: '/super-admin/reports/telecaller' },
        { label: 'Sales Manager', path: '/super-admin/reports/sales-manager' },
        { label: 'Sales Head', path: '/super-admin/reports/sales-head' },
        // Marketing + Collection reports share the reports grant, so grant-holders
        // get those links too.
        { label: 'Marketing', path: '/super-admin/marketing-reports' },
        { label: 'Marketing Metrix', path: '/super-admin/marketing-metrix' },
        { label: 'Collection', path: '/super-admin/collection-reports' },
      ],
    });
  }
  if (canAccessBookingApprovals(user)) {
    menu.push({ label: 'Booking Approvals', path: '/super-admin/booking-approvals', icon: CreditCardIcon });
  }
  if (hasTaskPortalAccess(user)) {
    // Full task module: dashboard (KPIs) + the task list.
    menu.push({
      label: 'Tasks',
      icon: ClipboardDocumentListIcon,
      children: [
        { label: 'Task Dashboard', path: '/super-admin/tasks/dashboard' },
        { label: 'Task List', path: '/super-admin/tasks' },
      ],
    });
  }
  return menu;
};

// ── Admin / Super Admin ──
// Restructured IA: WORKSPACE / INSIGHTS / INVENTORY / FINANCE / AUTOMATION /
// CONFIGURATION. `{ section }` items render as non-clickable uppercase group
// labels (see Sidebar.jsx). The sidebar renders only two levels (group →
// flat child links), so the "Data Masters" umbrella is expressed as grouped
// master sets under the CONFIGURATION section.
//
// Mapping notes (target IA → existing screens; net-new sub-views omitted):
//   Leads / Tasks / Bookings sub-views (Pipeline, Segmentation, My/Team/Overdue,
//     History) have no backing screen yet → single entry to the existing screen.
//   INSIGHTS › Analytics    → org-wide analytics (Reports ORG tab)
//   INSIGHTS › Performance  → per-role analytics tabs (Reports, TC default)
//   Org & Access › Roles & Permissions → User Types ; Org Settings → Site Settings
//   Workflows (no screen), Org Structure, Activity Logs → omitted (no screen yet)
const adminSidebar = [
  { section: 'WORKSPACE' },
  { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
  { label: 'Leads', path: '/super-admin/lead-management', icon: UsersIcon },
  { label: 'Tasks', path: '/super-admin/tasks', icon: ClipboardDocumentListIcon },
  { label: 'Bookings', path: '/super-admin/booking-approvals', icon: CreditCardIcon },
  { label: 'Record Manager', path: '/super-admin/record-manager', icon: ClipboardDocumentListIcon },

  { section: 'INSIGHTS' },
  { label: 'Analytics', path: '/super-admin/reports/organization', icon: ChartBarIcon },
  {
    label: 'Performance',
    icon: TrophyIcon,
    children: [
      { label: 'Telecaller', path: '/super-admin/reports/telecaller' },
      { label: 'Sales Manager', path: '/super-admin/reports/sales-manager' },
      { label: 'Sales Head', path: '/super-admin/reports/sales-head' },
      { label: 'Organization', path: '/super-admin/reports/organization' },
    ],
  },

  { section: 'INVENTORY' },
  {
    label: 'Projects',
    icon: BuildingStorefrontIcon,
    children: [
      { label: 'Inventory Overview', path: '/super-admin/inventory' },
      { label: 'Projects', path: '/super-admin/projects' },
      { label: 'Project Types', path: '/super-admin/project-types' },
      { label: 'Document Management', path: '/super-admin/document-management' },
      { label: 'Document Archive', path: '/super-admin/document-archive' },
    ],
  },
  { label: 'Units & Plots', path: '/super-admin/units', icon: HomeModernIcon },
  { label: 'Locations', path: '/super-admin/locations', icon: MapPinIcon },

  { section: 'FINANCE' },
  { label: 'Revenue', path: '/super-admin/finance/revenue', icon: BanknotesIcon },
  { label: 'Collections', path: '/super-admin/finance/collections', icon: CreditCardIcon },
  // Org-wide twin of the Collection Manager portal's own "Collection Report" screen.
  { label: 'Collection Report', path: '/super-admin/collection-reports', icon: ChartBarIcon },

  { section: 'AUTOMATION' },
  { label: 'Workflow Actions', path: '/super-admin/workflow-actions', icon: BoltIcon },
  { label: 'Reallocation Rules', path: '/super-admin/reallotment-rules', icon: ArrowsRightLeftIcon },
  { label: 'Reallocation History', path: '/super-admin/reallotment-logs', icon: ArrowPathIcon },
  { label: 'Marketing Allocation', path: '/super-admin/marketing-allocation', icon: MegaphoneIcon },
  { label: 'Allocation History', path: '/super-admin/marketing-allocation-history', icon: PhoneArrowDownLeftIcon },
  { label: 'Marketing API Keys', path: '/super-admin/marketing-api-keys', icon: KeyIcon },

  { section: 'MARKETING' },
  {
    label: 'Marketing',
    icon: ChatBubbleLeftRightIcon,
    children: [
      { label: 'Marketing Reports', path: '/super-admin/marketing-reports' },
      { label: 'Marketing Metrix', path: '/super-admin/marketing-metrix' },
      { label: 'Marketing Campaigns', path: '/super-admin/marketing-campaigns' },
      { label: 'Templates', path: '/super-admin/marketing-templates' },
      { label: 'WhatsApp Settings', path: '/super-admin/whatsapp-settings' },
    ],
  },

  { section: 'TELEPHONY' },
  {
    label: 'Telephony',
    icon: PhoneIcon,
    children: [
      { label: 'Call Logs', path: '/super-admin/telephony/call-logs' },
      { label: 'Allocation History', path: '/super-admin/telephony/allocation-history' },
      { label: 'Call Settings', path: '/super-admin/telephony/settings' },
    ],
  },

  { section: 'CONFIGURATION' },
  {
    label: 'Org & Access',
    icon: UserGroupIcon,
    children: [
      { label: 'Users', path: '/super-admin/users' },
      { label: 'Roles & Permissions', path: '/super-admin/user-types' },
      { label: 'Org Settings', path: '/super-admin/site-settings' },
    ],
  },
  { label: 'Attendance', path: '/super-admin/attendance', icon: FingerPrintIcon },
  {
    label: 'Lead Masters',
    icon: Cog6ToothIcon,
    children: [
      { label: 'Lead Types', path: '/super-admin/lead-types' },
      { label: 'Lead Sources', path: '/super-admin/lead-sources' },
      { label: 'Lead Sub-Sources', path: '/super-admin/lead-sub-sources' },
      { label: 'Lead Stages', path: '/super-admin/lead-stages' },
      { label: 'Lead Statuses', path: '/super-admin/lead-statuses' },
      { label: 'Quick Remarks', path: '/super-admin/status-remarks' },
      { label: 'Motivations', path: '/super-admin/motivations' },
      { label: 'Closed-Lost Reasons', path: '/super-admin/closed-lost-reasons' },
      { label: 'Score Master', path: '/super-admin/score-master' },
    ],
  },
  {
    label: 'Booking & Finance Masters',
    icon: BanknotesIcon,
    children: [
      { label: 'Booking Statuses', path: '/super-admin/booking-statuses' },
      { label: 'Booking Cancel Reasons', path: '/super-admin/booking-cancel-reasons' },
      { label: 'Payment Types', path: '/super-admin/payment-types' },
      { label: 'Payment Plans', path: '/super-admin/payment-plans' },
      { label: 'Payment Modes', path: '/super-admin/payment-modes' },
      { label: 'Payment Statuses', path: '/super-admin/payment-statuses' },
      { label: 'Banks', path: '/super-admin/banks' },
    ],
  },
  {
    label: 'Other Masters',
    icon: Cog6ToothIcon,
    children: [
      { label: 'Customer Types', path: '/super-admin/customer-types' },
      { label: 'Terms & Conditions', path: '/super-admin/terms-and-conditions' },
      { label: 'Departments', path: '/super-admin/departments' },
      { label: 'Sub-Departments', path: '/super-admin/sub-departments' },
    ],
  },
];

// ── Telecaller ──
const telecallerSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
  { label: 'Leads', path: '/telecaller/leads', icon: UserPlusIcon },
  { label: 'SV Leads', path: '/telecaller/handoffs', icon: MapPinIcon },
  { label: 'Performance Tracker', path: '/telecaller/pipeline', icon: TrophyIcon },
];

// ── Sales Manager ──
const salesManagerSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
  { label: 'Leads', path: '/sales-manager/leads', icon: UserPlusIcon },
  { label: 'Revisits', path: '/sales-manager/visits', icon: ArrowPathIcon },
  { label: 'Incoming Leads', path: '/sales-manager/incoming', icon: BoltIcon },
];

// ── Sales Head ──
const salesHeadSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
  { label: 'Negotiations', path: '/sales-head/leads', icon: HandRaisedIcon },
  { label: 'Bookings', path: '/sales-head/bookings', icon: ClipboardDocumentListIcon },
  { label: 'All Leads', path: '/sales-head/all-leads', icon: UserPlusIcon },
  { label: 'Team', path: '/sales-head/team', icon: BriefcaseIcon },
];

// ── Collection Manager ──
const collectionSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
  { label: 'Bookings', path: '/collection/bookings', icon: ClipboardDocumentListIcon },
  { label: 'Payments', path: '/collection/payments', icon: CreditCardIcon },
];

// ── Accounts Executive ──
const accountsSidebar = [
  { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
  { label: 'Verify Payments', path: '/accounts/verify', icon: MagnifyingGlassIcon },
];

// ── Record Manager ──
const recordManagerSidebar = [
  { label: 'Registered Bookings', path: '/record-manager/bookings', icon: ClipboardDocumentListIcon },
];

// ── Accounts Manager ── (mirrors the Accountant; verify queue defaults to cash)
const accountsManagerSidebar = [
  { label: 'Verify Payments', path: '/accounts-manager/verify', icon: MagnifyingGlassIcon },
];

// ── Collection Executive (assigned collections) ──
const collectionExecSidebar = [
  { label: 'My Collections', path: '/collection-exec/bookings', icon: ClipboardDocumentListIcon },
];

// ── Task Management (Standard Executive portal) ──
// Single entry that opens the standalone Standard Executive portal.
export const getTaskMenuItem = () => ({
  label: 'Task Management',
  path: '/task-portal/dashboard',
  icon: ClipboardDocumentListIcon,
});

// Key-based Tasks item, appended to a role portal's own sidebar menu when the
// user has Standard Executive (task) access. Renders the embedded Tasks screen
// inside the portal instead of routing out to the standalone /task-portal.
export const portalTaskMenuItem = {
  label: 'Tasks',
  key: 'tasks',
  icon: ClipboardDocumentListIcon,
};

// Legacy export for backward compatibility
export const sidebarMenu = adminSidebar;

// ── Portal menus (key-based, used inside workspace components) ──
export const telecallerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon, badge: null },
  { label: 'Leads', key: 'leads', icon: UserPlusIcon, badgeColor: 'blue' },
  { label: 'SV Leads', key: 'handoffs', icon: MapPinIcon, badgeColor: 'purple' },
  { label: 'Performance Tracker', key: 'pipeline', icon: TrophyIcon, badge: null },
  { label: 'Call Log', key: 'calllog', icon: PhoneArrowDownLeftIcon, badge: null },
  // { label: 'Pull Requests', key: 'pullrequests', icon: InboxArrowDownIcon, badgeColor: 'red' },
  { label: 'Reports', key: 'reports', icon: ChartBarIcon, badge: null },
];

export const salesManagerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon, badge: null },
  { label: 'My Leads', key: 'leads', icon: UserPlusIcon, badgeColor: 'green' },
  { label: 'Negotiations', key: 'handoffs', icon: HandRaisedIcon, badgeColor: 'purple' },
  { label: 'Site Visits', key: 'sitevisits', icon: HomeModernIcon, badge: null },
  { label: 'Incoming Leads', key: 'incoming', icon: BoltIcon, badgeColor: 'orange' },
  // { label: 'Pull Lead', key: 'pull', icon: MagnifyingGlassIcon, badge: null },
  { label: 'Reports', key: 'reports', icon: ChartBarIcon, badge: null },
];

export const salesHeadMenu = [
  { group: 'Sales' },
  { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon, badge: null },
  { label: 'Negotiation Leads', key: 'negotiations', icon: HandRaisedIcon, badgeColor: 'purple' },
  { label: 'Booking Details', key: 'bookings', icon: CreditCardIcon, badgeColor: 'blue' },
  { label: 'Bookings Analytics', key: 'bookingsummary', icon: ClipboardDocumentListIcon, badgeColor: 'green' },
  { label: 'Cancel Requests', key: 'cancellations', icon: XCircleIcon, badgeColor: 'red' },
  { group: 'Overview' },
  { label: 'SM Team', key: 'smteam', icon: UsersIcon, badge: null },
  { label: 'Reports', key: 'reports', icon: ChartBarIcon, badge: null },
  // { label: 'Site Visits', key: 'sitevisits', icon: HomeModernIcon, badge: null },
  // { label: 'Team Metrics', key: 'team', icon: BriefcaseIcon, badge: null },
];

export const collectionMenu = [
  { group: 'Overview' },
  { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon, badge: null },
  { label: 'Open Bookings', key: 'open-bookings', icon: PaperAirplaneIcon, badgeColor: 'blue' },
  { label: 'Bookings', key: 'bookings', icon: ClipboardDocumentListIcon, badgeColor: 'green' },
  { label: 'Payments', key: 'payments', icon: BanknotesIcon, badge: null },
  { label: 'Overdue', key: 'overdue', icon: XCircleIcon, badgeColor: 'red' },
  { label: 'Collection Report', key: 'reports', icon: ChartBarIcon, badge: null },
];

export const accountsMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon, badge: null },
  { label: 'Verify Payments', key: 'verify', icon: MagnifyingGlassIcon, badgeColor: 'orange' },
  { label: 'Accounts Report', key: 'reports', icon: ChartBarIcon, badge: null },
];

export const recordManagerMenu = [
  { group: 'Menu' },
  { label: 'Registered Bookings', key: 'bookings', icon: ClipboardDocumentListIcon, badgeColor: 'green' },
  { label: 'Project Documents', key: 'documents', icon: FolderOpenIcon },
];

// Accounts Manager mirrors the Accountant (ACCT) menu exactly — same items,
// no "Cash" labels. The verify queue still defaults to cash server-side, with a
// "Show all payments" toggle on the screen itself.
export const accountsManagerMenu = [
  { group: 'Menu' },
  { label: 'Dashboard', key: 'dashboard', icon: Squares2X2Icon, badge: null },
  { label: 'Verify Payments', key: 'verify', icon: MagnifyingGlassIcon, badgeColor: 'orange' },
  { label: 'Accounts Report', key: 'reports', icon: ChartBarIcon, badge: null },
];

export const collectionExecMenu = [
  { group: 'Menu' },
  { label: 'My Collections', key: 'bookings', icon: ClipboardDocumentListIcon, badgeColor: 'green' },
];

export const ROLE_LABELS = {
  SA: 'Super Admin',
  ADM: 'Admin',
  OH: 'Organization Head',
  SH: 'Sales Head',
  SM: 'Sales Manager',
  TC: 'Telecaller',
  COL: 'Collection Manager',
  ACCT: 'Accounts Executive',
  AM: 'Accounts Manager',
  CE: 'Collection Executive',
  RM: 'Record Manager',
  CRM: 'CRM Executive',
};
