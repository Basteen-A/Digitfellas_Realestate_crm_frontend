import React, { useState, useEffect } from 'react';

// Shared building blocks for the role dashboard "widget" grid (lead-list cards).
// Styling lives in propcrm.css under the `.dash-*` classes.

// True when the viewport is in the mobile breakpoint used across the portal CSS.
export const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
};

// Resolve a phone number across the various shapes the lead lists come back in.
export const leadPhone = (x = {}) => x.phone || x.lead?.phone || '';

// Dial a phone number via the device's native call handler.
export const callLead = (phone) => {
  if (phone) window.location.href = `tel:${phone}`;
};

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
  // Site-visit and booked statuses render in a readable dark green.
  const lc = name.toLowerCase();
  const c = lc.includes('site visit') || lc.includes('book') ? '#15803d' : (color || '#6B7280');
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
