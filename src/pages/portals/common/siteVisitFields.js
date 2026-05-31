// Shared definitions for the extended site-visit capture fields, used by the
// Sales Manager "Add Site Visit" modal, the Incoming-accept panel, and the
// Visit Detail display. Backend stores these under site_visits.visit_details
// and maps "Timeline to Buy" → lead priority.

export const FACING_OPTIONS = ['North', 'South', 'West', 'East', 'Corner'];
export const PAYMENT_TYPE_OPTIONS = ['Bank Loan', 'Own Funds', 'EMI'];
export const DECISION_MAKER_OPTIONS = ['Yes', 'No', 'Partial'];
export const AGE_BRACKET_OPTIONS = ['20-25', '26-30', '31-40', '41-50', '51-60', '61-70', '71-80'];

// value = stored day-range; label shows the derived temperature.
export const TIMELINE_OPTIONS = [
  { value: '1-30 Days', label: '1-30 Days (Hot)' },
  { value: '30-90 Days', label: '30-90 Days (Warm)' },
  { value: '90-180 Days', label: '90-180 Days (Nurture)' },
  { value: 'After 180 Days', label: 'After 180 Days (Long Term)' },
];
export const TIMELINE_LABEL = TIMELINE_OPTIONS.reduce((m, o) => { m[o.value] = o.label; return m; }, {});

// Blank capture object + the keys the API expects (camelCase).
export const EMPTY_VISIT_DETAILS = {
  secondaryContact: '',
  address: '',
  budget: '',
  preferredFacing: '',
  paymentType: '',
  timelineToBuy: '',
  specificConcerns: '',
  decisionMaker: '',
  ageBracket: '',
};
export const VISIT_DETAIL_KEYS = Object.keys(EMPTY_VISIT_DETAILS);

// All nine fields are mandatory before a site visit can be submitted.
export const isVisitDetailsComplete = (d = {}) =>
  VISIT_DETAIL_KEYS.every((k) => String(d?.[k] ?? '').trim() !== '');

// Pull just the visit-detail keys out of a larger form object for the payload.
export const pickVisitDetails = (src = {}) =>
  VISIT_DETAIL_KEYS.reduce((acc, k) => { acc[k] = src[k] || undefined; return acc; }, {});

// Human labels for the Visit Detail display.
export const VISIT_DETAIL_LABELS = {
  secondaryContact: 'Secondary Contact',
  address: 'Address',
  budget: 'Budget',
  preferredFacing: 'Preferred Facing',
  paymentType: 'Payment Type',
  timelineToBuy: 'Timeline to Buy',
  specificConcerns: 'Specific Concerns',
  decisionMaker: 'Decision Maker Present',
  ageBracket: 'Age Bracket',
};

export const displayVisitDetailValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'timelineToBuy') return TIMELINE_LABEL[value] || value;
  return value;
};
