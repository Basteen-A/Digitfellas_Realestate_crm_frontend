// ── CRM Badge Color System ────────────────────────────────────────────────────
// Single source of truth for status badge colors site-wide (see badge-system.html).
// Every badge is a Tailwind-style triple keyed by its TEXT color (the DB
// color_code): 50-shade background, 200-shade border, 700/800-shade text.
// DB color_code stores the text color; badgeColors()/badgeStyle() derive the
// background + border. Legacy hexes (older DB values / hardcoded colors) are
// normalized to the canonical text color first, so any caller gets the new
// palette even if its source hasn't been migrated.

// Canonical text color → { bg, border } (badge-system.html v1.0)
export const BADGE_PALETTE = {
  '#1D4ED8': { bg: '#EFF6FF', border: '#BFDBFE' }, // blue - new / open / starting
  '#0F766E': { bg: '#F0FDFA', border: '#99F6E4' }, // teal - follow up / in progress
  '#92400E': { bg: '#FFFBEB', border: '#FDE68A' }, // amber - pending / scheduled
  '#166534': { bg: '#F0FDF4', border: '#BBF7D0' }, // green - done / approved / verified
  '#3730A3': { bg: '#EEF2FF', border: '#C7D2FE' }, // indigo - revisit / EMI
  '#C2410C': { bg: '#FFF7ED', border: '#FED7AA' }, // orange - WIP / warm / active
  '#475569': { bg: '#F8FAFC', border: '#CBD5E1' }, // slate - cold / stalled
  '#BE123C': { bg: '#FFF1F2', border: '#FECDD3' }, // red - hot / urgent action
  '#065F46': { bg: '#ECFDF5', border: '#A7F3D0' }, // emerald - booked / registered
  '#6B21A8': { bg: '#FAF5FF', border: '#E9D5FF' }, // purple - RnR / held
  '#6B7280': { bg: '#F9FAFB', border: '#E5E7EB' }, // grey - junk / disqualified
  '#4B5563': { bg: '#F3F4F6', border: '#D1D5DB' }, // grey dark - spam
  '#9F1239': { bg: '#FFF1F2', border: '#FECDD3' }, // rose - lost / cancelled / rejected
  '#155E75': { bg: '#ECFEFF', border: '#A5F3FC' }, // cyan - reallot / loan
  '#64748B': { bg: '#F1F5F9', border: '#CBD5E1' }, // cool grey - inactive / closed
};

// Legacy / off-palette hexes → canonical text color.
const CANON = {
  // blues
  '#3B82F6': '#1D4ED8', '#2563EB': '#1D4ED8', '#0EA5E9': '#1D4ED8',
  '#38BDF8': '#1D4ED8', '#1E40AF': '#1D4ED8', '#60A5FA': '#1D4ED8',
  // indigo
  '#6366F1': '#3730A3', '#625AFA': '#3730A3', '#4F46E5': '#3730A3', '#818CF8': '#3730A3',
  // teal
  '#14B8A6': '#0F766E', '#0D9488': '#0F766E', '#2DD4BF': '#0F766E',
  // cyan
  '#06B6D4': '#155E75', '#22D3EE': '#155E75', '#0891B2': '#155E75',
  // amber
  '#F59E0B': '#92400E', '#D97706': '#92400E', '#B45309': '#92400E', '#FBBF24': '#92400E',
  // orange
  '#F97316': '#C2410C', '#EA580C': '#C2410C', '#FB923C': '#C2410C', '#CDB932': '#C2410C',
  // green
  '#22C55E': '#166534', '#16A34A': '#166534', '#15803D': '#166534', '#4ADE80': '#166534',
  // emerald
  '#10B981': '#065F46', '#059669': '#065F46', '#047857': '#065F46',
  // red (urgent)
  '#EF4444': '#BE123C', '#F87171': '#BE123C', '#E62828': '#BE123C',
  // rose (negative outcome)
  '#DC2626': '#9F1239', '#B91C1C': '#9F1239', '#991B1B': '#9F1239', '#7F1D1D': '#9F1239',
  // purple
  '#A855F7': '#6B21A8', '#8B5CF6': '#6B21A8', '#7C3AED': '#6B21A8',
  '#A78BFA': '#6B21A8', '#9333EA': '#6B21A8', '#C084FC': '#6B21A8', '#5B4FCF': '#6B21A8',
  // greys
  '#94A3B8': '#64748B', '#334155': '#475569',
  '#9CA3AF': '#6B7280', '#D1D5DB': '#6B7280',
  '#374151': '#4B5563', '#1F2937': '#4B5563',
  '#F06124': '#475569', // legacy Collection Cold orange → slate
};

const normalizeHex = (c) => {
  if (typeof c !== 'string') return null;
  const t = c.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(t) ? t : null;
};

// Canonical text color for any input color (legacy hexes normalized).
export const badgeTextColor = (color, fallback = '#64748B') => {
  const hex = normalizeHex(color);
  if (!hex) return fallback;
  return CANON[hex] || hex;
};

// { text, bg, border } for a status color. Unknown (custom) colors keep the
// old tint convention (~10% alpha bg, ~20% alpha border) so nothing breaks.
export const badgeColors = (color, fallback = '#64748B') => {
  const text = badgeTextColor(color, fallback);
  const triple = BADGE_PALETTE[text];
  if (triple) return { text, bg: triple.bg, border: triple.border };
  return { text, bg: `${text}1A`, border: `${text}33` };
};

// Drop-in inline style for badge/chip elements. Sets the full border shorthand
// so the 200-shade outline shows even on classes without a base border.
export const badgeStyle = (color, fallback) => {
  const { text, bg, border } = badgeColors(color, fallback);
  return { backgroundColor: bg, color: text, border: `1px solid ${border}` };
};

// Fixed (non-DB-driven) statuses from badge-system.html, keyed how the code
// refers to them. Values are canonical TEXT colors - pass to badgeColors/Style.
export const TASK_STATUS_TEXT = {
  open: '#1D4ED8',
  pending: '#92400E',
  work_in_progress: '#C2410C',
  completed: '#166534',
  closed: '#64748B',
  cancelled: '#9F1239',
};

// Task priority, same convention as TASK_STATUS_TEXT. Set on the task list and
// reused by both task dashboards so a priority reads identically everywhere.
export const TASK_PRIORITY_TEXT = {
  low: '#4B5563',
  medium: '#1D4ED8',
  high: '#C2410C',
  urgent: '#BE123C',
};

export const TRANSACTION_STATUS_TEXT = {
  verified: '#166534',
  unverified: '#92400E',
  rejected: '#9F1239',
};

export const ACCEPTANCE_STATUS_TEXT = {
  accepted: '#166534',
  pending: '#92400E',
};
