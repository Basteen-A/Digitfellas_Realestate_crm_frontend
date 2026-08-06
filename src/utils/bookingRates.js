// ============================================================
// STAMP DUTY + REGISTRATION RATES
// The single definition of how Stamp Value and Registration Charges are derived
// from the Plot Value. Every screen, PDF and demand calculation goes through
// here so they cannot drift apart.
//
//   Plot Value        = ROUNDUP(guideline rate × sq ft, -2)   → nearest 100
//   Stamp Value       = ROUNDUP(plot × 7%, -1)                → nearest 10
//   Registration      = ROUNDUP(plot × rate%, -1)             → nearest 10
//
// The registration rate is 2% by default and can be switched to 1% per booking by
// the Collection Manager (bookings.registration_percentage). Stamp is always 7%.
//
// ── Rounding, and what it does NOT touch ────────────────────────────────────
// Rounding is part of the CALCULATION. A booking that already has a stored
// stamp_value / registration_exp keeps that stored figure - those are what
// payments were collected against, and silently nudging them would put the
// demand out of step with the ledger. Stored values are only replaced when
// something explicitly recalculates the booking (a cost edit, or the Collection
// Manager changing the registration rate).
//
// IMPORTANT: this file MIRRORS server/src/utils/bookingRates.js. Change one, change
// the other - CollectionBookingDetail.jsx and the server's item demand must agree or
// the on-screen figures and the stored demand diverge.
// ============================================================

export const STAMP_RATE = 0.07;              // 7%, fixed
export const DEFAULT_REGISTRATION_RATE = 2;  // percent
export const REGISTRATION_RATE_CHOICES = [2, 1]; // what the Collection Manager may pick

export const toNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** ROUNDUP to the nearest 10. Zero and negatives pass through untouched. */
export const roundUpTo10 = (value) => {
  const n = toNum(value);
  return n > 0 ? Math.ceil(n / 10) * 10 : 0;
};

/** ROUNDUP to the nearest 100 - the Plot Value rule. */
export const roundUpTo100 = (value) => {
  const n = toNum(value);
  return n > 0 ? Math.ceil(n / 100) * 100 : 0;
};

/**
 * The registration rate on a booking, as a percent. Falls back to 2% for any
 * booking saved before the rate became configurable, and refuses anything that
 * is not one of the offered choices so a bad value can't quietly halve a demand.
 */
export const registrationRateOf = (booking) => {
  const raw = toNum(booking?.registration_percentage);
  return REGISTRATION_RATE_CHOICES.includes(raw) ? raw : DEFAULT_REGISTRATION_RATE;
};

/** Stamp Value from a Plot Value - 7%, rounded up to the nearest 10. */
export const computeStampValue = (plotValue) => roundUpTo10(toNum(plotValue) * STAMP_RATE);

/** Registration Charges from a Plot Value - rate%, rounded up to the nearest 10. */
export const computeRegistrationValue = (plotValue, ratePercent = DEFAULT_REGISTRATION_RATE) => {
  const rate = REGISTRATION_RATE_CHOICES.includes(toNum(ratePercent))
    ? toNum(ratePercent)
    : DEFAULT_REGISTRATION_RATE;
  return roundUpTo10(toNum(plotValue) * (rate / 100));
};

/** Stamp Commission - 1% of the Stamp Value. Unrounded, as it always was. */
export const computeStampCommission = (stampValue) => Math.round(toNum(stampValue) * 0.01);
