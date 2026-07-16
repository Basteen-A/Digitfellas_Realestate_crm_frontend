import React from 'react';
import { PhoneArrowDownLeftIcon, PhoneArrowUpRightIcon } from '@heroicons/react/24/outline';

// A single glyph that encodes BOTH the call direction and its outcome:
//   • Inbound  → down-left phone arrow
//   • Outgoing → up-right phone arrow
//   • Answered → black (theme text colour)
//   • Missed / not answered → red
const isOutgoing = (direction) => {
  const d = String(direction || '').toLowerCase();
  return d.includes('out') || d.includes('click'); // outbound, click_to_call, …
};

export default function CallDirectionIcon({ direction, status, size = 18 }) {
  const outgoing = isOutgoing(direction);
  const Icon = outgoing ? PhoneArrowUpRightIcon : PhoneArrowDownLeftIcon;
  const answered = status === 'ANSWERED';
  const color = answered ? 'var(--text-primary)' : '#dc2626'; // black vs red
  const label = `${outgoing ? 'Outgoing' : 'Inbound'} · ${answered ? 'Answered' : 'Missed'}`;
  return (
    <Icon
      title={label}
      aria-label={label}
      style={{ width: size, height: size, color, strokeWidth: 2, flexShrink: 0 }}
    />
  );
}
