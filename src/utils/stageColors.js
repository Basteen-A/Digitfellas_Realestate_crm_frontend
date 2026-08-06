// ── Canonical pipeline stage colors ───────────────────────────────────────────
// Single source of truth for the four pipeline-stage colors used across the app
// (funnel cards, stage chips, analytics charts, Excel export, Finance screens).
// Qualified = blue · Site Visit = orange · Negotiation = purple · Booking = green.
// Keep this in sync with the on-screen funnel in the Reports → Analytics dashboard.

// Canonical badge-system text colors (badge-system.html / utils/badgeColors.js).
export const STAGE_COLORS = {
  qualified: '#1D4ED8',   // blue
  siteVisit: '#92400E',   // amber
  negotiation: '#6B21A8', // purple
  booking: '#166534',     // green
  cancelled: '#9F1239',   // rose (lost / cancelled)
};

// Badge-system 50-shade backgrounds for the matching foreground color - used by
// stage chips and funnel rows.
export const STAGE_BG = {
  qualified: '#EFF6FF',
  siteVisit: '#FFFBEB',
  negotiation: '#FAF5FF',
  booking: '#F0FDF4',
  cancelled: '#FFF1F2',
};

// Badge-system 200-shade borders for the matching foreground color.
export const STAGE_BORDER = {
  qualified: '#BFDBFE',
  siteVisit: '#FDE68A',
  negotiation: '#E9D5FF',
  booking: '#BBF7D0',
  cancelled: '#FECDD3',
};

// Map a stage/status label to a canonical key. Tolerant of casing/spacing and
// common synonyms ("sv" → site visit, "won/closed" → booking).
export const stageKeyFor = (label) => {
  const s = String(label || '').toLowerCase();
  if (s.includes('qualif')) return 'qualified';
  if (s.includes('site') || s === 'sv' || s.includes('visit')) return 'siteVisit';
  if (s.includes('negoti')) return 'negotiation';
  if (s.includes('book') || s.includes('won') || s.includes('closed won')) return 'booking';
  if (s.includes('cancel') || s.includes('lost') || s.includes('reject')) return 'cancelled';
  return null;
};

export const stageColorFor = (label, fallback = '#94a3b8') => {
  const key = stageKeyFor(label);
  return key ? STAGE_COLORS[key] : fallback;
};

export const stageBgFor = (label, fallback = '#f1f5f9') => {
  const key = stageKeyFor(label);
  return key ? STAGE_BG[key] : fallback;
};

export const stageBorderFor = (label, fallback = '#CBD5E1') => {
  const key = stageKeyFor(label);
  return key ? STAGE_BORDER[key] : fallback;
};
