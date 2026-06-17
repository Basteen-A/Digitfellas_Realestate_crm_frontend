// ── Canonical pipeline stage colors ───────────────────────────────────────────
// Single source of truth for the four pipeline-stage colors used across the app
// (funnel cards, stage chips, analytics charts, Excel export, Finance screens).
// Qualified = blue · Site Visit = orange · Negotiation = purple · Booking = green.
// Keep this in sync with the on-screen funnel in the Reports → Analytics dashboard.

export const STAGE_COLORS = {
  qualified: '#0ea5e9',   // blue
  siteVisit: '#f59e0b',   // orange
  negotiation: '#a855f7', // purple
  booking: '#16a34a',     // green
  cancelled: '#dc2626',   // red (lost / cancelled)
};

// Tints (background) for the matching foreground color — used by stage chips and
// funnel rows. Roughly the on-screen `${color}1a` (~10% alpha) convention.
export const STAGE_BG = {
  qualified: '#e0f2fe',
  siteVisit: '#fef3c7',
  negotiation: '#f3e8ff',
  booking: '#dcfce7',
  cancelled: '#fee2e2',
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
