import React from 'react';

// Shared building blocks for the role dashboard "widget" grid (lead-list cards).
// Styling lives in propcrm.css under the `.dash-*` classes.

// Up to two initials from a name, for the row avatar.
export const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

// Resolve a display name across the various shapes the lead lists come back in.
export const leadName = (x = {}) =>
  x.fullName ||
  x.lead?.fullName ||
  (x.first_name ? `${x.first_name} ${x.last_name || ''}`.trim() : '') ||
  `${x.firstName || ''} ${x.lastName || ''}`.trim() ||
  'Unknown Lead';

// Small colored pill showing the lead's current status, tinted with its own color.
export const StatusChip = ({ name, color }) => {
  if (!name) return null;
  const c = color || '#6B7280';
  return (
    <span className="dash-chip" style={{ background: `${c}22`, color: c }}>{name}</span>
  );
};

// Round avatar tinted with the lead's own status color (falls back to the blue accent).
export const Avatar = ({ name, color }) => (
  <div className="dash-avatar" style={color ? { background: `${color}22`, color } : undefined}>
    {getInitials(name)}
  </div>
);
