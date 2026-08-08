// ============================================================
// GENERIC (PERMISSION-DRIVEN) SIDEBAR
//
// The menu for a role that has no bespoke portal - i.e. any role created in
// Super Admin → Roles & Permissions. Instead of a hand-written list, the sidebar
// is assembled from the role's module matrix: every module the role can read
// contributes its links, and modules it cannot read contribute nothing.
//
// Each entry declares the module + the level it needs. Keep MODULE_LINKS in step
// with server/src/config/modules.js - a module with no links here simply shows
// nothing, which is a silent dead end for the admin who granted it.
// ============================================================

import {
  Squares2X2Icon, UsersIcon, ClipboardDocumentListIcon, CreditCardIcon,
  ChartBarIcon, BuildingStorefrontIcon, HomeModernIcon, MapPinIcon,
  BanknotesIcon, MagnifyingGlassIcon, BoltIcon, ArrowsRightLeftIcon,
  ArrowPathIcon, MegaphoneIcon, KeyIcon, ChatBubbleLeftRightIcon, PhoneIcon,
  PhoneArrowDownLeftIcon, UserGroupIcon, FingerPrintIcon, Cog6ToothIcon,
  FolderOpenIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { hasModule } from '../../../utils/modulePermissions';

// moduleKey → { section, items: [{ label, path, icon, level }] }
// `level` is the minimum the user needs for that specific link (default 'read').
const MODULE_LINKS = {
  dashboard: {
    section: 'WORKSPACE', items: [
      { label: 'Dashboard', path: '/dashboard', icon: Squares2X2Icon },
    ]
  },
  leads: {
    section: 'WORKSPACE', items: [
      { label: 'Leads', path: '/super-admin/lead-management', icon: UsersIcon },
    ]
  },
  tasks: {
    section: 'WORKSPACE', items: [
      { label: 'Tasks', path: '/super-admin/tasks', icon: ClipboardDocumentListIcon },
    ]
  },
  bookings: {
    section: 'WORKSPACE', items: [
      { label: 'Bookings', path: '/super-admin/finance/collections', icon: CreditCardIcon },
    ]
  },
  booking_approvals: {
    section: 'WORKSPACE', items: [
      { label: 'Booking Approvals', path: '/super-admin/booking-approvals', icon: CreditCardIcon },
    ]
  },
  record_manager: {
    section: 'WORKSPACE', items: [
      { label: 'Records', path: '/super-admin/record-manager', icon: ClipboardDocumentListIcon },
    ]
  },

  reports: {
    section: 'INSIGHTS', items: [
      { label: 'Analytics', path: '/super-admin/reports/organization', icon: ChartBarIcon, level: 'full' },
      { label: 'Telecaller', path: '/super-admin/reports/telecaller', icon: ChartBarIcon },
      { label: 'Marketing Reports', path: '/super-admin/marketing-reports', icon: ChartBarIcon, level: 'full' },
      { label: 'Collection Report', path: '/super-admin/collection-reports', icon: ChartBarIcon },
    ]
  },

  projects: {
    section: 'INVENTORY', items: [
      { label: 'Projects', path: '/super-admin/projects', icon: BuildingStorefrontIcon },
      { label: 'Inventory Overview', path: '/super-admin/inventory', icon: BuildingStorefrontIcon, level: 'write' },
    ]
  },
  inventory: {
    section: 'INVENTORY', items: [
      { label: 'Units & Plots', path: '/super-admin/units', icon: HomeModernIcon, level: 'write' },
    ]
  },
  locations: {
    section: 'INVENTORY', items: [
      { label: 'Locations', path: '/super-admin/locations', icon: MapPinIcon, level: 'write' },
    ]
  },
  documents: {
    section: 'INVENTORY', items: [
      { label: 'Document Management', path: '/super-admin/document-management', icon: FolderOpenIcon, level: 'write' },
      { label: 'Document Archive', path: '/super-admin/document-archive', icon: FolderOpenIcon, level: 'full' },
    ]
  },

  finance: {
    section: 'FINANCE', items: [
      { label: 'Revenue', path: '/super-admin/finance/revenue', icon: BanknotesIcon },
      { label: 'Collections', path: '/super-admin/finance/collections', icon: CreditCardIcon },
    ]
  },
  payment_verification: {
    section: 'FINANCE', items: [
      { label: 'Verify Payments', path: '/accounts/verify', icon: MagnifyingGlassIcon },
    ]
  },

  automation: {
    section: 'AUTOMATION', items: [
      { label: 'Workflow Actions', path: '/super-admin/workflow-actions', icon: BoltIcon, level: 'write' },
      { label: 'WA Automation', path: '/super-admin/wa-automation', icon: ChatBubbleLeftRightIcon, level: 'write' },
      { label: 'Reallocation Rules', path: '/super-admin/reallotment-rules', icon: ArrowsRightLeftIcon, level: 'write' },
      { label: 'Reallocation History', path: '/super-admin/reallotment-logs', icon: ArrowPathIcon },
    ]
  },

  marketing: {
    section: 'MARKETING', items: [
      { label: 'Marketing Allocation', path: '/super-admin/marketing-allocation', icon: MegaphoneIcon, level: 'write' },
      { label: 'Allocation History', path: '/super-admin/marketing-allocation-history', icon: PhoneArrowDownLeftIcon },
      { label: 'Campaigns', path: '/super-admin/marketing-campaigns', icon: ChatBubbleLeftRightIcon, level: 'write' },
      { label: 'Marketing API Keys', path: '/super-admin/marketing-api-keys', icon: KeyIcon, level: 'full' },
    ]
  },

  telephony: {
    section: 'TELEPHONY', items: [
      { label: 'Call Logs', path: '/super-admin/telephony/call-logs', icon: PhoneIcon },
      { label: 'Allocation History', path: '/super-admin/telephony/allocation-history', icon: PhoneArrowDownLeftIcon, level: 'full' },
      { label: 'Call Settings', path: '/super-admin/telephony/settings', icon: Cog6ToothIcon, level: 'full' },
    ]
  },

  users: {
    section: 'CONFIGURATION', items: [
      { label: 'Users', path: '/super-admin/users', icon: UserGroupIcon, level: 'write' },
    ]
  },
  roles: {
    section: 'CONFIGURATION', items: [
      { label: 'Roles & Permissions', path: '/super-admin/user-types', icon: ShieldCheckIcon },
    ]
  },
  org_settings: {
    section: 'CONFIGURATION', items: [
      { label: 'Org Settings', path: '/super-admin/site-settings', icon: Cog6ToothIcon, level: 'write' },
    ]
  },
  attendance: {
    section: 'CONFIGURATION', items: [
      { label: 'Attendance', path: '/super-admin/attendance', icon: FingerPrintIcon, level: 'write' },
    ]
  },
  lead_masters: {
    section: 'CONFIGURATION', items: [
      {
        label: 'Lead Masters', icon: Cog6ToothIcon, level: 'write', children: [
          { label: 'Lead Types', path: '/super-admin/lead-types' },
          { label: 'Lead Sources', path: '/super-admin/lead-sources' },
          { label: 'Lead Sub-Sources', path: '/super-admin/lead-sub-sources' },
          { label: 'Lead Stages', path: '/super-admin/lead-stages' },
          { label: 'Lead Statuses', path: '/super-admin/lead-statuses' },
          { label: 'Quick Remarks', path: '/super-admin/status-remarks' },
          { label: 'Motivations', path: '/super-admin/motivations' },
          { label: 'Closed-Lost Reasons', path: '/super-admin/closed-lost-reasons' },
          { label: 'Score Master', path: '/super-admin/score-master' },
        ]
      },
    ]
  },
  booking_finance_masters: {
    section: 'CONFIGURATION', items: [
      {
        label: 'Booking & Finance Masters', icon: BanknotesIcon, level: 'write', children: [
          { label: 'Booking Statuses', path: '/super-admin/booking-statuses' },
          { label: 'Booking Cancel Reasons', path: '/super-admin/booking-cancel-reasons' },
          { label: 'Payment Types', path: '/super-admin/payment-types' },
          { label: 'Payment Plans', path: '/super-admin/payment-plans' },
          { label: 'Payment Modes', path: '/super-admin/payment-modes' },
          { label: 'Payment Statuses', path: '/super-admin/payment-statuses' },
          { label: 'Banks', path: '/super-admin/banks' },
        ]
      },
    ]
  },
  other_masters: {
    section: 'CONFIGURATION', items: [
      {
        label: 'Other Masters', icon: Cog6ToothIcon, level: 'write', children: [
          { label: 'Customer Types', path: '/super-admin/customer-types' },
          { label: 'Terms & Conditions', path: '/super-admin/terms-and-conditions' },
        ]
      },
    ]
  },
};

// Section order matches the Super Admin sidebar so the app feels like one product.
const SECTION_ORDER = [
  'WORKSPACE', 'INSIGHTS', 'INVENTORY', 'FINANCE', 'AUTOMATION',
  'MARKETING', 'TELEPHONY', 'CONFIGURATION',
];

/**
 * Build the sidebar for a matrix-driven role.
 * Returns [] when the role has been granted nothing - the caller renders an
 * explanatory empty state rather than a bare shell.
 */
export const buildGenericSidebar = (user) => {
  const bySection = {};

  Object.entries(MODULE_LINKS).forEach(([moduleKey, { section, items }]) => {
    if (!hasModule(user, moduleKey, 'read', false)) return;
    items.forEach((item) => {
      if (!hasModule(user, moduleKey, item.level || 'read', false)) return;
      (bySection[section] = bySection[section] || []).push(item);
    });
  });

  const menu = [];
  SECTION_ORDER.forEach((section) => {
    const items = bySection[section];
    if (!items?.length) return;
    menu.push({ section });
    // De-duplicate: two modules can legitimately offer the same destination
    // (e.g. bookings and finance both point at Collections).
    const seen = new Set();
    items.forEach((item) => {
      const id = item.path || item.label;
      if (seen.has(id)) return;
      seen.add(id);
      menu.push(item);
    });
  });

  return menu;
};

export default buildGenericSidebar;
