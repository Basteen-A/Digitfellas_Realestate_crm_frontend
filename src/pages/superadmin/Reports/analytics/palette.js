// Shared color palette for the analytics dashboard + Excel export, so the
// workbook fills/series match the on-screen charts.

export const COLORS = {
  primary: '#4f46e5',   // indigo
  answered: '#22c55e',  // green
  unanswered: '#ef4444', // red
  leads: '#6366f1',
  qualified: '#0ea5e9',
  siteVisit: '#f59e0b',
  negotiation: '#a855f7',
  booking: '#16a34a',
  cancelled: '#dc2626',
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
