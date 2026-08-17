import React from 'react';
import { PhoneArrowDownLeftIcon, PhoneArrowUpRightIcon } from '@heroicons/react/24/outline';

// A single glyph that encodes BOTH the call direction and its outcome.
//
//   GLYPH  - direction, always:
//     • Inbound   → phone with a down-left arrow
//     • Outgoing  → phone with an up-right arrow
//   COLOUR - outcome:
//     • Missed / not answered → RED   (either direction)
//     • Inbound  answered     → GREEN
//     • Outgoing answered     → BLUE
//
// Missed calls keep the DIRECTIONAL glyph rather than switching to a
// phone-with-an-x: direction and outcome are two independent facts, so the
// shape says which way the call went and the colour says how it ended. One
// glyph, two readings.
//
// The mobile app renders the identical rule from
// telecaller-app/src/components/CallDirectionIcon.js - the three hexes below
// are duplicated there verbatim, so a change here needs the same change there.
export const CALL_ICON_COLORS = {
  missed: '#DC2626', // red   - nobody picked up, whichever way it went
  inbound: '#16A34A', // green - they called us and we answered
  outgoing: '#2563EB', // blue  - we called them and they answered
};

const isOutgoing = (direction) => {
  const d = String(direction || '').toLowerCase();
  return d.includes('out') || d.includes('click'); // outbound, click_to_call, …
};

// The one place that decides which of the three states a call is in.
export const callIconState = (direction, status) => {
  if (status !== 'ANSWERED') return 'missed';
  return isOutgoing(direction) ? 'outgoing' : 'inbound';
};

// An unanswered OUTGOING call is one the customer did not pick up - calling
// that "missed" (which everywhere else means one WE missed) reads wrong.
export const callOutcomeLabel = (direction, status) => {
  if (status === 'ANSWERED') return 'Answered';
  return isOutgoing(direction) ? 'Not Answered' : 'Missed';
};

export default function CallDirectionIcon({ direction, status, size = 18, color }) {
  const outgoing = isOutgoing(direction);
  const Icon = outgoing ? PhoneArrowUpRightIcon : PhoneArrowDownLeftIcon;
  const label = `${outgoing ? 'Outgoing' : 'Inbound'} · ${callOutcomeLabel(direction, status)}`;

  return (
    <Icon
      title={label}
      aria-label={label}
      style={{
        width: size,
        height: size,
        // `color: 'currentColor'` lets the badge below tint the glyph with its
        // own foreground instead of the standalone palette.
        color: color || CALL_ICON_COLORS[callIconState(direction, status)],
        strokeWidth: 2,
        flexShrink: 0,
      }}
    />
  );
}

// ── Status pill ──────────────────────────────────────────────
// The "Answered / Missed" cell in the call-log tables. It used to be a plain
// answered/not-answered binary with an up-arrow on EVERY answered call, so an
// inbound answered call showed an outgoing glyph. Now it carries the same three
// states as the icon, in badge-system triples (50 ground / 700-800 text / 200
// outline), and the glyph inside inherits the pill's foreground.
export const CALL_STATUS_BADGE = {
  missed: { bg: '#FFF1F2', fg: '#9F1239', border: '#FECDD3' },
  inbound: { bg: '#F0FDF4', fg: '#166534', border: '#BBF7D0' },
  outgoing: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
};

export function CallStatusBadge({ direction, status }) {
  const state = callIconState(direction, status);
  const c = CALL_STATUS_BADGE[state];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <CallDirectionIcon direction={direction} status={status} size={12} color="currentColor" />
      {callOutcomeLabel(direction, status)}
    </span>
  );
}
