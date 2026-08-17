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

export default function CallDirectionIcon({ direction, status, size = 18 }) {
  const outgoing = isOutgoing(direction);
  const Icon = outgoing ? PhoneArrowUpRightIcon : PhoneArrowDownLeftIcon;
  const answered = status === 'ANSWERED';

  const color = !answered
    ? CALL_ICON_COLORS.missed
    : (outgoing ? CALL_ICON_COLORS.outgoing : CALL_ICON_COLORS.inbound);

  // An unanswered OUTGOING call is one the customer did not pick up - calling
  // that "missed" (which everywhere else means one WE missed) reads wrong.
  const outcome = answered ? 'Answered' : (outgoing ? 'Not answered' : 'Missed');
  const label = `${outgoing ? 'Outgoing' : 'Inbound'} · ${outcome}`;

  return (
    <Icon
      title={label}
      aria-label={label}
      style={{ width: size, height: size, color, strokeWidth: 2, flexShrink: 0 }}
    />
  );
}
