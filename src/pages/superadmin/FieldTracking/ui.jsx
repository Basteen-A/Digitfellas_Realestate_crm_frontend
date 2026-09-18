import React from 'react';

// ============================================================
// Shared presentation atoms for the Field Tracking screens.
//
// Inline styles over CSS variables, matching AttendancePage.jsx and the rest of
// the Super Admin screens - these pages inherit light/dark automatically
// because every colour is a token, never a literal.
// ============================================================

export const th = {
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

export const td = {
  padding: '12px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderTop: '1px solid var(--border-primary)',
  verticalAlign: 'middle',
};

export const inputStyle = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border-primary)',
  fontSize: 13,
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  width: '100%',
};

export const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
  marginBottom: 6,
};

export const cardStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 16,
};

export const btn = (variant = 'default') => {
  const base = {
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  };
  if (variant === 'primary') {
    return { ...base, background: 'var(--accent-primary, #625afa)', color: '#fff', border: '1px solid transparent' };
  }
  if (variant === 'danger') {
    return { ...base, color: '#dc2626', borderColor: '#fecaca' };
  }
  if (variant === 'ghost') {
    return { ...base, background: 'transparent', border: '1px solid transparent', padding: '6px 8px' };
  }
  return base;
};

// ── Day-status colours ────────────────────────────────────────
// One place, because the same verdict appears on the day grid, the timeline,
// the history list and both exports. Text colour plus a tinted background,
// following the badge convention used elsewhere in the product.
export const DAY_STATUS_STYLE = {
  PRESENT: { bg: 'rgba(22,163,74,0.12)', fg: '#16a34a', label: 'Present' },
  HALF_DAY: { bg: 'rgba(217,119,6,0.12)', fg: '#d97706', label: 'Half Day' },
  ABSENT: { bg: 'rgba(220,38,38,0.12)', fg: '#dc2626', label: 'Absent' },
  WEEK_OFF: { bg: 'rgba(100,116,139,0.14)', fg: '#64748b', label: 'Week Off' },
  HOLIDAY: { bg: 'rgba(37,99,235,0.12)', fg: '#2563eb', label: 'Holiday' },
  LEAVE: { bg: 'rgba(147,51,234,0.12)', fg: '#9333ea', label: 'Leave' },
};

export const StatusChip = ({ status, small = false }) => {
  const s = DAY_STATUS_STYLE[status] || DAY_STATUS_STYLE.ABSENT;
  return (
    <span style={{
      display: 'inline-block',
      padding: small ? '1px 8px' : '3px 10px',
      borderRadius: 12,
      fontSize: small ? 10 : 11,
      fontWeight: 700,
      background: s.bg,
      color: s.fg,
      whiteSpace: 'nowrap',
    }}
    >
      {s.label}
    </span>
  );
};

// ── Customer-visit vocabulary ─────────────────────────────────
// One place, because these labels appear on the Visits tab, the route
// timeline and the Excel export.

export const VISIT_TYPE_LABEL = {
  CLIENT: 'Client',
  SITE: 'Site',
  VENDOR: 'Vendor',
  FOLLOW_UP: 'Follow-up',
  COLLECTION: 'Collection',
  OTHER: 'Other',
};

export const VISIT_OUTCOME_STYLE = {
  INTERESTED: { bg: 'rgba(22,163,74,0.12)', fg: '#16a34a', label: 'Interested' },
  FOLLOW_UP: { bg: 'rgba(37,99,235,0.12)', fg: '#2563eb', label: 'Follow-up' },
  CLOSED: { bg: 'rgba(98,90,250,0.12)', fg: '#625afa', label: 'Closed' },
  NOT_INTERESTED: { bg: 'rgba(220,38,38,0.12)', fg: '#dc2626', label: 'Not interested' },
  NOT_AVAILABLE: { bg: 'rgba(217,119,6,0.12)', fg: '#d97706', label: 'Not available' },
  OTHER: { bg: 'rgba(100,116,139,0.14)', fg: '#64748b', label: 'Other' },
};

export const VISIT_STATUS_STYLE = {
  COMPLETED: { bg: 'rgba(22,163,74,0.12)', fg: '#16a34a', label: 'Completed' },
  IN_PROGRESS: { bg: 'rgba(217,119,6,0.12)', fg: '#d97706', label: 'In progress' },
  CANCELLED: { bg: 'rgba(100,116,139,0.14)', fg: '#64748b', label: 'Cancelled' },
};

export const VisitStatusChip = ({ status }) => {
  const s = VISIT_STATUS_STYLE[status] || VISIT_STATUS_STYLE.CANCELLED;
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 10,
      fontSize: 10, fontWeight: 700, background: s.bg, color: s.fg, whiteSpace: 'nowrap',
    }}
    >
      {s.label}
    </span>
  );
};

export const Chip = ({ children, bg = 'var(--bg-tertiary, rgba(100,116,139,0.14))', fg = 'var(--text-secondary)' }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 10,
    fontSize: 10, fontWeight: 700, background: bg, color: fg, whiteSpace: 'nowrap',
  }}
  >
    {children}
  </span>
);

export const StatCard = ({ label, value, sub = null, accent = 'var(--text-primary)' }) => (
  <div style={{
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: 12,
    padding: '14px 16px',
    minWidth: 130,
    flex: '1 1 130px',
  }}
  >
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color: accent, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
    {sub ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div> : null}
  </div>
);

export const EmptyState = ({ icon: Icon, title, hint }) => (
  <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
    {Icon ? <Icon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} /> : null}
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
    {hint ? <div style={{ fontSize: 12, marginTop: 6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>{hint}</div> : null}
  </div>
);

export const Spinner = ({ label = 'Loading...' }) => (
  <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{label}</div>
);

// ── Formatters ────────────────────────────────────────────────

export const fmtTime = (d) => (d
  ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  : '—');

export const fmtDateTime = (d) => (d
  ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
  : '—');

export const fmtDate = (d) => (d
  ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—');

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Minutes -> "8h 15m". Mirrors geoUtils.formatDuration on the server. */
export const fmtDuration = (minutes) => {
  const mins = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Metres -> "840 m" / "12.4 km". Mirrors geoUtils.formatDistance. */
export const fmtDistance = (metres) => {
  const m = Math.max(0, Number(metres) || 0);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
