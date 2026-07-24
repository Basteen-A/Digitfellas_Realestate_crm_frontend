// ============================================================
// SHARED REPORT UI ATOMS
// The KPI cards, cards, tables and pills every report screen is built from —
// the Super Admin Analytics / Performance pages, the self-service "My Reports"
// portal view and the Marketing Reports page. Extracted so a change to the
// report look lands on all of them at once.
// ============================================================

import React, { createContext, useContext } from 'react';

// When true, the pieces below render in a flat monochrome style: no accent
// top-borders on KPI cards, KPI numbers at font-weight 500, primary-text (black in
// light mode) table headers, and no per-cell colour. Every report browser turns
// this on, so all report screens render consistently.
export const MonoContext = createContext(false);

// `valueSize` lets name-based KPI cards (e.g. Top Performer) use a smaller,
// truncating value so long names don't overflow the card. Default 22px matches the
// portal dashboard stat cards (.col-stat-value-new) so the two screens look consistent.
export const KpiCard = ({ label, value, sub, color, icon: Icon, valueSize = 22 }) => {
  const mono = useContext(MonoContext);
  return (
    <div className="crm-card flex-1 min-w-[150px]" style={{ borderTop: mono ? undefined : `3px solid ${color}`, padding: '14px 16px' }}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10.5px] uppercase tracking-wide ${mono ? 'font-medium' : 'font-semibold'}`} style={{ color: 'var(--text-muted)' }}>{label}</span>
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: mono ? 'var(--text-muted)' : color }} />}
      </div>
      <div className={`mt-2 leading-none truncate ${mono ? '' : 'font-extrabold'}`} style={{ color: 'var(--text-primary)', fontSize: valueSize, fontWeight: mono ? 500 : undefined }} title={typeof value === 'string' ? value : undefined}>{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px]" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
};

export const KpiRow = ({ children }) => <div className="flex flex-wrap gap-3 mb-4">{children}</div>;

export const PILL_TONES = {
  green: { bg: '#E8F5E8', fg: '#1a7a40' }, red: { bg: '#FEF2F2', fg: '#DC2626' },
  amber: { bg: '#FFF7ED', fg: '#D97706' }, blue: { bg: '#EFF6FF', fg: '#2563EB' },
  purple: { bg: '#F5F3FF', fg: '#7C3AED' }, gray: { bg: '#F3F4F6', fg: '#374151' },
};

export const Pill = ({ children, tone = 'blue' }) => {
  const mono = useContext(MonoContext);
  const t = PILL_TONES[mono ? 'gray' : tone] || PILL_TONES.blue;
  return <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold" style={{ background: t.bg, color: t.fg }}>{children}</span>;
};

export const ratioTone = (p) => (p >= 60 ? 'green' : p >= 35 ? 'amber' : 'red');

export const ProgressBar = ({ value, color }) => (
  <div className="h-1 rounded-full overflow-hidden min-w-[80px]" style={{ background: '#EFEFEF' }}>
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
  </div>
);

export const Card = ({ title, sub, right, children, registerRef, chartKey }) => {
  const mono = useContext(MonoContext);
  return (
    <div className="crm-card overflow-hidden mb-4" ref={registerRef && chartKey ? (el) => registerRef(chartKey, el) : undefined}>
      {(title || right) && (
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          {title && <span className={`text-[13.5px] ${mono ? 'font-medium' : 'font-semibold'}`} style={{ color: 'var(--text-primary)' }}>{title}</span>}
          {sub && <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
          {right && <span className="ml-auto text-[12px]" style={{ color: 'var(--text-muted)' }}>{right}</span>}
        </div>
      )}
      {children}
    </div>
  );
};

export const Table = ({ head, children, colSpan, empty, emptyLabel = 'No data for this period.' }) => {
  const mono = useContext(MonoContext);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead><tr style={{ background: 'var(--bg-table-header, #f1f5f9)' }}>
          {head.map((h, i) => <th key={i} className={`px-3 py-2 text-left text-[10.5px] uppercase tracking-wide whitespace-nowrap ${mono ? 'font-medium' : 'font-semibold'}`} style={{ color: mono ? 'var(--text-primary)' : 'var(--text-muted)' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {empty ? <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>{emptyLabel}</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
};

export const Tr = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    className={onClick ? 'transition-colors hover:bg-[var(--bg-hover,#FAFAFA)]' : undefined}
    style={{ borderTop: '1px solid var(--border-primary)', cursor: onClick ? 'pointer' : undefined }}
  >{children}</tr>
);

// In the mono style, table cells drop both their accent colour and their bold
// weight — flat, black-on-white numbers — per the reports polish.
export const Td = ({ children, bold, color, className = '' }) => {
  const mono = useContext(MonoContext);
  const c = mono ? undefined : color;
  const isBold = bold && !mono;
  return <td className={`px-3 py-2.5 text-[13px] ${isBold ? 'font-semibold' : ''} ${className}`} style={c ? { color: c } : undefined}>{children}</td>;
};

// Summed footer row for breakdown tables. `label` fills the first column; `cells`
// fills the rest (one entry per remaining column), all rendered bold and emphasised.
export const TotalRow = ({ cells, label = 'Total' }) => (
  <tr style={{ borderTop: '2px solid var(--border-primary)', background: 'var(--bg-table-header, #f1f5f9)' }}>
    <Td bold>{label}</Td>
    {cells.map((c, i) => <Td key={i} bold>{c}</Td>)}
  </tr>
);
