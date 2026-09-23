// ============================================================
// Share message templates - Site Visit and Booking
// ============================================================
// One copy of the wording for every surface that shares: the SM site-visit
// list, the SH bookings list, and their two mobile twins in
// telecaller-app/src/utils/shareTemplates.js. KEEP THE TWO FILES IN STEP -
// an SM on a laptop and an SM on the phone must paste the same text into the
// same WhatsApp group, or the format the sales floor reads every morning
// stops being one format.
//
// Plain text only. WhatsApp strips anything else, and these messages get
// forwarded on into groups where any markup would show up as literal
// characters.

import { parseVisitDetailsValue } from './siteVisitFields';

const DASH = '-';

// Labels are padded to a common width so the colons line up in a monospaced
// preview; WhatsApp renders proportionally so this only has to look sane, not
// be pixel-exact.
const pad = (label, width) => label + ' '.repeat(Math.max(0, width - label.length));

const val = (v) => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s === '' ? DASH : s;
};

const fullName = (o) => {
  if (!o) return '';
  return `${o.first_name || ''} ${o.last_name || ''}`.trim();
};

const shareDate = (v) => {
  if (!v) return DASH;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// time_spent is stored as whole minutes. Read back as "2 hr 15 min" because
// that is how the floor says it out loud.
const minutes = (m) => {
  const n = Number(m);
  if (!Number.isFinite(n) || n <= 0) return DASH;
  const h = Math.floor(n / 60);
  const rest = n % 60;
  if (h && rest) return `${h} hr ${rest} min`;
  if (h) return `${h} hr`;
  return `${rest} min`;
};

// Source reads "Social Media / Facebook Forms" when a sub-source is set - the
// sub-source is the part marketing actually acts on.
const sourceLabel = (lead) => {
  const src = lead?.leadSource?.source_name;
  const sub = lead?.leadSubSource?.sub_source_name;
  if (src && sub) return `${src} / ${sub}`;
  return val(src || sub);
};

/**
 * Site visit share message.
 * Takes a visit row from the SM/SH site-visit list, which carries `lead`,
 * `project` and the server-built `share_context` (SV type + the three role
 * holders). Anything missing prints as "-" rather than vanishing, so the
 * reader can see that a field was blank instead of silently getting a
 * shorter message.
 */
export const buildSiteVisitMessage = (visit) => {
  if (!visit) return '';
  const lead = visit.lead || {};
  const ctx = visit.share_context || {};
  const details = parseVisitDetailsValue(visit.visit_details) || {};
  const W = 15;

  return [
    `${pad('DATE', W)}: ${shareDate(visit.actual_visit_date || visit.completed_at || visit.scheduled_date)}`,
    `${pad('SITE VISIT NO', W)}: ${val(visit.visit_number)}`,
    `${pad('SV TYPE', W)}: ${val(ctx.sv_type)}`,
    `${pad('PROJECT', W)}: ${val(visit.project?.project_name)}`,
    `${pad('NAME', W)}: ${val(fullName(lead))}`,
    `${pad('ADDRESS', W)}: ${val(details.address)}`,
    `${pad('PINCODE', W)}: ${val(details.pincode)}`,
    `${pad('PROFESSION', W)}: ${val(details.profession)}`,
    `${pad('SOURCE', W)}: ${sourceLabel(lead)}`,
    `${pad('SALES MANAGER', W)}: ${val(ctx.sales_manager || fullName(visit.attendedBy))}`,
    `${pad('SALES HEAD', W)}: ${val(ctx.sales_head)}`,
    `${pad('TELE SALES', W)}: ${val(ctx.tele_sales)}`,
    `${pad('TIME SPENT', W)}: ${minutes(visit.time_spent)}`,
    `${pad('LEAD STAGE', W)}: ${val(lead.stage?.stage_name)}`,
  ].join('\n');
};

/**
 * Booking share message - the "Booking Alert" the Sales Head posts after a
 * booking closes. Deliberately much shorter than the site-visit one: this
 * goes to a celebration group, not a working record.
 */
export const buildBookingMessage = (booking) => {
  if (!booking) return '';
  const lead = booking.lead || {};
  const ctx = booking.share_context || {};
  const unit = booking.inventoryUnit || {};
  const W = 11;

  // "Plot (phase)" on the floor means the unit number with its phase in
  // brackets; either half can be missing on an older booking.
  const unitNo = booking.unit_number || unit.unit_number;
  const phase = booking.phase?.phase_name || unit.phase?.phase_name;
  const plot = unitNo && phase ? `${unitNo} (${phase})` : val(unitNo || phase);

  // Whichever area the project actually sells on, in priority order.
  const areaValue = booking.super_built_up_area || booking.built_up_area || booking.carpet_area;
  const area = areaValue ? `${areaValue}${booking.area_unit ? ` ${booking.area_unit}` : ''}` : DASH;

  return [
    '\u{1F4AB} Booking Alert \u{1F4AB}',
    '',
    `${pad('PROJECT', W)}- ${val(booking.project?.project_name)}`,
    `${pad('DATE', W)}- ${shareDate(booking.booking_date)}`,
    `${pad('PLOT', W)}- ${plot}`,
    `${pad('AREA', W)}- ${area}`,
    `${pad('SALES', W)}- ${val(ctx.sales_manager || fullName(booking.closedBy))}`,
    `${pad('TELESALES', W)}- ${val(ctx.tele_sales)}`,
    `${pad('SOURCE', W)}- ${sourceLabel(lead)}`,
  ].join('\n');
};

/**
 * Hand `text` to whatever the device can share with.
 *
 * navigator.share is the real share sheet - WhatsApp, SMS, Gmail, anything
 * installed - but it only exists on mobile browsers and a few desktop ones,
 * and it throws AbortError when the user just dismisses the sheet, which is
 * not a failure worth reporting. Desktop falls back to the clipboard, and the
 * caller is expected to offer the wa.me link alongside.
 *
 * Returns 'shared' | 'copied' | 'dismissed' | 'failed' so the caller can show
 * the right toast.
 */
export const shareText = async (text, title = '') => {
  if (!text) return 'failed';
  if (navigator.share) {
    try {
      await navigator.share({ text, title });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'dismissed';
      // Fall through to the clipboard - some browsers advertise share() and
      // then reject it for a text-only payload.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
};

/** Opens WhatsApp (app on mobile, web on desktop) with the message prefilled. */
export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text || '')}`;
