// Shared color palette for the analytics dashboard + Excel export, so the
// workbook fills/series match the on-screen charts. The four pipeline-stage
// colors come from the app-wide canonical source so funnels, stage chips and
// Finance screens stay consistent (see utils/stageColors.js).

export const COLORS = {
  primary: '#18181b',    // charcoal black
  answered: '#27272a',   // dark slate
  unanswered: '#71717a', // medium gray
  leads: '#18181b',
  qualified: '#27272a',
  siteVisit: '#3f3f46',
  negotiation: '#52525b',
  booking: '#18181b',
  cancelled: '#71717a',
  available: '#27272a',
  booked: '#52525b',
  blocked: '#71717a',
  muted: '#9ca3af',
};

// Ordered series used for multi-bar / pie charts (monochrome grayscale)
export const SERIES = [
  '#18181b', '#3f3f46', '#52525b', '#71717a', '#a1a1aa',
  '#d4d4d8', '#27272a', '#64748b', '#94a3b8', '#e2e8f0',
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

