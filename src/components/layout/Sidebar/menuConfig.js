// ============================================================
// SIDEBAR MENU CONFIGURATION - Role-specific menus
// ============================================================
import {
  ChartBarIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  BoltIcon,
  HandRaisedIcon,
  BriefcaseIcon,
  CreditCardIcon,
  HomeModernIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
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
  FolderOpenIcon,
  DocumentChartBarIcon,
  PresentationChartLineIcon,
} from '@heroicons/react/24/outline';
// Admin / super-admin nav glyphs - the mockup's own outline set, not Heroicons.
import {
  NavHome, NavUsers, NavSettings, NavLayoutGrid, NavClipboardList, NavCalendar,
  NavFileText, NavBuildingWarehouse, NavBuilding, NavMapPin, NavWallet,
  NavCreditCard, NavChartBar, NavTrophy, NavSpeakerphone, NavPhone,
  NavArrowsExchange, NavRefresh, NavShield, NavAdjustments, NavRoute,
  NavHistory, NavBolt, NavPlug, NavDots,
} from './navIcons';
import { canViewAllReports, canAccessBookingApprovals, hasTaskPortalAccess } from '../../../utils/permissions';
import { usesGenericPortal, BUILT_IN_PORTAL_CODES } from '../../../utils/modulePermissions';
import { buildGenericSidebar } from './genericMenu';

/**
 * Icon per section heading. The collapsed sidebar is a rail of these - one icon
 * per category instead of one per link - and clicking one opens that section's
 * items in a flyout (see Sidebar.jsx). Keyed by section name so both the
 * hand-written admin menu and the matrix-driven generic menu are covered; add an
 * entry here whenever a new `{ section }` name is introduced.
 *
 * The first block is the admin / super-admin IA (plain-language groups) and uses
 * the mockup's own icon set; the second is the older engineering-worded set
 * still used by the matrix-driven generic sidebar (genericMenu.js), which stays
 * on Heroicons because its links do too.
 */
export const SECTION_ICONS = {
  HOME: NavHome,
  SALES: NavUsers,
  PROPERTIES: NavBuilding,
  PAYMENTS: NavWallet,
  REPORTS: NavChartBar,
  'MARKETING & CALLS': NavSpeakerphone,
  SETTINGS: NavSettings,

  WORKSPACE: Squares2X2Icon,
  INSIGHTS: ChartBarIcon,
  INVENTORY: BuildingStorefrontIcon,
  FINANCE: BanknotesIcon,
  AUTOMATION: BoltIcon,
  MARKETING: MegaphoneIcon,
  TELEPHONY: PhoneIcon,
  CONFIGURATION: Cog6ToothIcon,
};

/**
 * Returns the sidebar menu based on the user's role code.
 * SA/ADM → Admin sidebar with masters + all workspaces
 * TC     → Telecaller sidebar (leads, follow-ups, pipeline)
 * SM     → Sales Manager sidebar (leads, site visits, incoming)
 * SH     → Sales Head sidebar (negotiations, bookings)
 * COL    → Collection sidebar
 *
 * Any role NOT in this switch was created in Super Admin → Roles & Permissions
 * and has no bespoke portal, so its menu is assembled from its module matrix by
 * buildGenericSidebar(). That is what makes custom roles self-serve.
 */
export const getSidebarMenuForRole = (roleCode, user = null) => {
  if (user && usesGenericPortal(user) && !BUILT_IN_PORTAL_CODES.includes(roleCode)) {
    return buildGenericSidebar(user);
  }
  switch (roleCode) {
    case 'SA':
      return adminSidebar;
    case 'ADM':
      // Booking Approvals is Super Admin only - hide that child from plain Admins.
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
      // Unknown code with no matrix to work from - fall back to the generic
      // build, which yields [] and lets the shell explain itself.
      return user ? buildGenericSidebar(user) : telecallerSidebar;
  }
};

// ── Organization Head ──
// Grant-driven menu - only the modules the Super Admin ticked on the user form
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
// IA: HOME / SALES / PROPERTIES / PAYMENTS / REPORTS / MARKETING & CALLS /
// SETTINGS - 7 groups ordered by frequency of use, down from the 8 sections the
// admin menu carried before. Labels are deliberately plain-language: a
// salesperson or an accountant reads them the same way an engineer does, so no
// "masters", "reallocation" or other backend vocabulary surfaces in the UI.
//
// `{ section }` items render as collapsible uppercase group headers (see
// Sidebar.jsx); `collapsed: true` makes a section start closed - SETTINGS does,
// because it is the one low-frequency group. The sidebar renders only two levels
// (group → flat child links), so the master tables stay expressed as grouped
// child sets under SETTINGS.
//
// Renames from the previous IA (screens are unchanged, only the wording is):
//   Record Manager       → Records
//   Analytics            → Reports          Performance    → Team Performance
//   Revenue              → Payments Received
//   Collections          → Dues & Collections
//   Collection Report    → Payment Reports
//   Marketing            → Campaigns        Telephony      → Calls
//   Marketing Allocation → Lead Assignment  Allocation History → Assignment History
//   Org & Access         → Team & Access    Lead Masters   → Lead Settings
//   Booking & Finance Masters → Booking & Payment Settings
//   Reallocation Rules   → Auto-Reassign Rules
//   Reallocation History → Reassign History
//   Workflow Actions     → Automated Actions
//   Marketing API Keys   → Marketing Integrations
//   Other Masters        → Other Settings
//
// Icons are the mockup's own set (see navIcons.jsx), one per label exactly as
// its `iconMap` assigns them - including the three places that set resolves two
// labels to the same glyph (Bookings/Attendance → calendar, Records/Payment
// Reports → file-text, Lead Settings/Booking & Payment Settings → adjustments).
const adminSidebar = [
  { section: 'HOME' },
  { label: 'Dashboard', path: '/dashboard', icon: NavLayoutGrid },

  { section: 'SALES' },
  { label: 'Leads', path: '/super-admin/lead-management', icon: NavUsers },
  { label: 'Tasks', path: '/super-admin/tasks', icon: NavClipboardList },
  { label: 'Bookings', path: '/super-admin/booking-approvals', icon: NavCalendar },
  { label: 'Records', path: '/super-admin/record-manager', icon: NavFileText },

  { section: 'PROPERTIES' },
  {
    label: 'Projects',
    icon: NavBuildingWarehouse,
    children: [
      { label: 'Inventory Overview', path: '/super-admin/inventory' },
      { label: 'Projects', path: '/super-admin/projects' },
      // Project Types is a master table, not day-to-day work - it lives under
      // SETTINGS › Other Settings alongside the other type/lookup lists.
      { label: 'Document Management', path: '/super-admin/document-management' },
      { label: 'Document Archive', path: '/super-admin/document-archive' },
    ],
  },
  { label: 'Units & Plots', path: '/super-admin/units', icon: NavBuilding },
  { label: 'Locations', path: '/super-admin/locations', icon: NavMapPin },

  { section: 'PAYMENTS' },
  { label: 'Payments Received', path: '/super-admin/finance/revenue', icon: NavWallet },
  { label: 'Dues & Collections', path: '/super-admin/finance/collections', icon: NavCreditCard },
  // Org-wide twin of the Collection Manager portal's own "Collection Report" screen.
  { label: 'Payment Reports', path: '/super-admin/collection-reports', icon: NavFileText },

  { section: 'REPORTS' },
  { label: 'Reports', path: '/super-admin/reports/organization', icon: NavChartBar },
  {
    label: 'Team Performance',
    icon: NavTrophy,
    // No "Organization" child - that is the same page as "Reports" above.
    children: [
      { label: 'Telecaller', path: '/super-admin/reports/telecaller' },
      { label: 'Sales Manager', path: '/super-admin/reports/sales-manager' },
      { label: 'Sales Head', path: '/super-admin/reports/sales-head' },
    ],
  },

  { section: 'MARKETING & CALLS' },
  {
    label: 'Campaigns',
    icon: NavSpeakerphone,
    children: [
      { label: 'Campaigns', path: '/super-admin/marketing-metrix' },
      { label: 'WA Campaigns', path: '/super-admin/marketing-campaigns' },
      { label: 'WA Inbox', path: '/super-admin/whatsapp-inbox' },
      { label: 'WA Templates', path: '/super-admin/marketing-templates' },
      { label: 'Marketing Reports', path: '/super-admin/marketing-reports' },
    ],
  },
  {
    label: 'Calls',
    icon: NavPhone,
    children: [
      { label: 'Call Logs', path: '/super-admin/telephony/call-logs' },
      { label: 'Allocation History', path: '/super-admin/telephony/allocation-history' },
      { label: 'Call Settings', path: '/super-admin/telephony/settings' },
    ],
  },
  { label: 'Lead Assignment', path: '/super-admin/marketing-allocation', icon: NavArrowsExchange },
  { label: 'Assignment History', path: '/super-admin/marketing-allocation-history', icon: NavRefresh },

  // Low-frequency group - starts collapsed, and auto-opens when the route is
  // inside it (see Sidebar.jsx).
  { section: 'SETTINGS', collapsed: true },
  {
    label: 'Team & Access',
    icon: NavShield,
    children: [
      { label: 'Users', path: '/super-admin/users' },
      { label: 'Roles & Permissions', path: '/super-admin/user-types' },
      { label: 'Org Settings', path: '/super-admin/site-settings' },
    ],
  },
  { label: 'Attendance', path: '/super-admin/attendance', icon: NavCalendar },
  {
    label: 'Lead Settings',
    icon: NavAdjustments,
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
    label: 'Booking & Payment Settings',
    icon: NavAdjustments,
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
  { label: 'Auto-Reassign Rules', path: '/super-admin/reallotment-rules', icon: NavRoute },
  { label: 'Reassign History', path: '/super-admin/reallotment-logs', icon: NavHistory },
  { label: 'Automated Actions', path: '/super-admin/workflow-actions', icon: NavBolt },
  // Date-triggered WhatsApp drips - sits with the other automation rules rather
  // than under Campaigns, because it is a standing rule, not a one-off send-out.
  { label: 'WA Automation', path: '/super-admin/wa-automation', icon: NavSpeakerphone },
  { label: 'Marketing Integrations', path: '/super-admin/marketing-api-keys', icon: NavPlug },
  {
    label: 'Other Settings',
    icon: NavDots,
    children: [
      { label: 'Project Types', path: '/super-admin/project-types' },
      { label: 'Customer Types', path: '/super-admin/customer-types' },
      { label: 'Terms & Conditions', path: '/super-admin/terms-and-conditions' },
      { label: 'Departments', path: '/super-admin/departments' },
      { label: 'Sub-Departments', path: '/super-admin/sub-departments' },
      { label: 'WA Settings', path: '/super-admin/whatsapp-settings' },
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

// Placeholder a portal menu can drop anywhere to say "Tasks belongs HERE"
// instead of at the end. PortalLayout swaps it for portalTaskMenuItem when the
// user has task access, and strips it when they don't.
export const TASK_MENU_SLOT = { taskSlot: true };

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
  TASK_MENU_SLOT,
  // Every report this portal can open, collection and telecalling alike. The
  // telecalling ones are the same org-wide screens Super Admin sees - the
  // Collection Manager monitors telecaller performance and inbound-call
  // allocation, so they render inside the collection portal too.
  { group: 'Reports' },
  // Four report links in a row - each needs its own glyph or the group reads as
  // one repeated icon. Money report vs telecalling report vs the two audits.
  { label: 'Collection Report', key: 'reports', icon: DocumentChartBarIcon, badge: null },
  { label: 'Telecaller Reports', key: 'tc-reports', icon: PresentationChartLineIcon, badge: null },
  // Two different allocation audits, both about which telecaller got which lead:
  //   • Call Allocation History  - leads created from INBOUND CALLS (Tata Smartflo)
  //   • API Allocation History   - leads pushed in by the MARKETING API webhook
  { label: 'Call Allocation History', key: 'call-allocations', icon: PhoneArrowDownLeftIcon, badge: null },
  { label: 'API Allocation History', key: 'api-allocations', icon: MegaphoneIcon, badge: null },
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

// Accounts Manager mirrors the Accountant (ACCT) menu exactly - same items,
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
