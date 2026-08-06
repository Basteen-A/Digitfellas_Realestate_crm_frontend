// ============================================================
// NEXT-FOLLOW-UP DATE LIMITS (client mirror)
// ============================================================
// Mirrors server/src/utils/followUpLimits.js - keep the two in step. The server
// is the authority and rejects anything past the cap; this copy exists so the
// date picker greys out the disallowed range and the user sees the rule before
// submitting instead of as an error afterwards.
//
//   RNR         → 12 days.  A lead that was never actually reached has to come
//                 back around quickly, not be parked months out.
//   every other → 2 calendar months.
//
// Future side only - back-dating is not restricted here.

export const RNR_MAX_DAYS = 12;
export const DEFAULT_MAX_MONTHS = 2;

const startOfDay = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

// Clamps instead of overflowing: 31 Dec + 2 months is 28 Feb, not 3 March.
const addMonths = (date, months) => {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
};

const isRnr = (statusCode) => String(statusCode || '').toUpperCase() === 'RNR';

/** Latest date a follow-up may be scheduled for, given the resulting status. */
export const followUpMaxDate = (statusCode, today = new Date()) => {
  const base = startOfDay(today);
  return isRnr(statusCode)
    ? new Date(base.getFullYear(), base.getMonth(), base.getDate() + RNR_MAX_DAYS, 0, 0, 0, 0)
    : addMonths(base, DEFAULT_MAX_MONTHS);
};

/** Same bound as a `YYYY-MM-DD` string, for an <input type="date" max={…}>. */
export const followUpMaxDateValue = (statusCode, today = new Date()) => {
  const d = followUpMaxDate(statusCode, today);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Error message for a date past the cap, or null when it is allowed. */
export const followUpLimitError = (value, statusCode, today = new Date()) => {
  if (!value) return null;
  const picked = startOfDay(value);
  if (!picked) return null;
  const max = followUpMaxDate(statusCode, today);
  if (picked.getTime() <= max.getTime()) return null;

  const asDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return isRnr(statusCode)
    ? `An RNR lead must be followed up within ${RNR_MAX_DAYS} days - pick a date on or before ${asDate(max)}.`
    : `A follow-up cannot be scheduled more than ${DEFAULT_MAX_MONTHS} months ahead - pick a date on or before ${asDate(max)}.`;
};
