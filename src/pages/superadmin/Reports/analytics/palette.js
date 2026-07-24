import { STAGE_COLORS } from '../../../../utils/stageColors';

export const COLORS = {
  primary: '#4f46e5',   // indigo
  answered: '#16a34a',  // green (de-limed to the app-standard dark green)
  unanswered: '#ef4444', // red
  leads: '#6366f1',
  qualified: STAGE_COLORS.qualified,
  siteVisit: STAGE_COLORS.siteVisit,
  negotiation: STAGE_COLORS.negotiation,
  booking: STAGE_COLORS.booking,
  cancelled: STAGE_COLORS.cancelled,
  available: '#22c55e',
  booked: '#f59e0b',
  blocked: '#ef4444',
  muted: '#94a3b8',
};

// Ordered series used for multi-bar / pie charts
export const SERIES = [
  '#4f46e5', '#0ea5e9', '#f59e0b', '#a855f7', '#16a34a',
  '#ef4444', '#14b8a6', '#eab308', '#ec4899', '#64748b',
];

// Hex without leading '#', for ExcelJS ARGB fills (FF + RRGGBB)
export const argb = (hex) => `FF${String(hex).replace('#', '').toUpperCase()}`;

export const KPI_THEME = {
  totalLeads: COLORS.leads,
  qualified: COLORS.qualified,
  siteVisits: COLORS.siteVisit,
  negotiation: COLORS.negotiation,
  bookings: COLORS.booking,
  cancellations: COLORS.cancelled,
};
