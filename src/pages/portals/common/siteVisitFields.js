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

// Optional visit-detail fields — captured/displayed but not required to submit.
export const OPTIONAL_VISIT_DETAIL_KEYS = ['secondaryContact'];

// Keys that must be filled before a site visit can be submitted.
export const REQUIRED_VISIT_DETAIL_KEYS = VISIT_DETAIL_KEYS.filter(
  (k) => !OPTIONAL_VISIT_DETAIL_KEYS.includes(k)
);

// All required fields must be present before a site visit can be submitted.
export const isVisitDetailsComplete = (d = {}) =>
  REQUIRED_VISIT_DETAIL_KEYS.every((k) => String(d?.[k] ?? '').trim() !== '');

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

const VISIT_DETAIL_ALIASES = {
  secondaryContact: 'secondaryContact',
  secondary_contact: 'secondaryContact',
  address: 'address',
  budget: 'budget',
  preferredFacing: 'preferredFacing',
  preferred_facing: 'preferredFacing',
  paymentType: 'paymentType',
  payment_type: 'paymentType',
  timelineToBuy: 'timelineToBuy',
  timeline_to_buy: 'timelineToBuy',
  specificConcerns: 'specificConcerns',
  specific_concerns: 'specificConcerns',
  decisionMaker: 'decisionMaker',
  decision_maker: 'decisionMaker',
  ageBracket: 'ageBracket',
  age_bracket: 'ageBracket',
};

const normalizeVisitDetailsObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const nestedCandidate = value.visit_details || value.visitDetails || value.site_details || value.siteDetails;
  if (nestedCandidate && nestedCandidate !== value) {
    const nestedParsed = parseVisitDetailsValue(nestedCandidate);
    if (nestedParsed) return nestedParsed;
  }

  const normalized = {};
  Object.entries(value).forEach(([key, rawValue]) => {
    const mappedKey = VISIT_DETAIL_ALIASES[key];
    if (!mappedKey) return;
    normalized[mappedKey] = rawValue;
  });

  return hasVisitDetailsData(normalized) ? normalized : null;
};

export const parseVisitDetailsValue = (value) => {
  let current = value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!current) return null;
    if (typeof current === 'object') return normalizeVisitDetailsObject(current);
    if (typeof current !== 'string') return null;

    const trimmed = current.trim();
    if (!trimmed) return null;

    const candidates = [trimmed];

    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      candidates.push(trimmed.slice(1, -1));
    }

    if (trimmed.includes('""')) {
      candidates.push(trimmed.replace(/""/g, '"'));
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') return normalizeVisitDetailsObject(parsed);
        if (typeof parsed === 'string' && parsed !== current) {
          current = parsed;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
};

export const hasVisitDetailsData = (value) => VISIT_DETAIL_KEYS.some((key) => String(value?.[key] ?? '').trim() !== '');

export const displayVisitDetailValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'timelineToBuy') return TIMELINE_LABEL[value] || value;
  return value;
};
