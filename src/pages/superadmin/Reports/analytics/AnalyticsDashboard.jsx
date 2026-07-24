import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, ArrowDownTrayIcon, PresentationChartLineIcon,
  ArrowTrendingUpIcon, BuildingOffice2Icon, TrophyIcon, CheckBadgeIcon,
  ScaleIcon, XCircleIcon, MapPinIcon, ExclamationTriangleIcon,
  PhoneArrowUpRightIcon, ClockIcon, Squares2X2Icon, UsersIcon, FunnelIcon,
  ChatBubbleLeftRightIcon, BanknotesIcon, ArrowsRightLeftIcon, ChevronDownIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import reportApi from '../../../../api/reportApi';
import leadSourceApi from '../../../../api/leadSourceApi';
import projectApi from '../../../../api/projectApi';
import inventoryUnitApi from '../../../../api/inventoryUnitApi';
import { COLORS } from './palette';
import { formatCurrency } from '../../../../utils/formatters';
import {
  ChartCard, CallsPerDayLine, SimpleBar, FunnelDonut, SalesFunnel,
} from './charts/Charts';
import { exportPlainData, exportAnalytics } from './exportExcel';
import '../Reports.css';

// Quick-pick presets shown outside the accordion. "Custom" (date range) and the
// remaining filters live inside the collapsible "Filters" section.
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

// ── helpers ──────────────────────────────────────────────────────────────────
const num = (v) => Number(v) || 0;
const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—';
const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);
const initials = (r) => `${(r.first_name || '?')[0] || ''}${(r.last_name || '')[0] || ''}`.toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');
const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#1a7a40', '#D97706', '#0891B2', '#DC2626', '#db2777'];

// ── Report catalogue, per role (drives the role-specific sidebar) ─────────────
const R = {
  // Telecaller
  qualification: { icon: ArrowTrendingUpIcon, accent: COLORS.siteVisit, title: 'Qualification Ratio', sub: 'Qualified ÷ Total leads', rs: 'Qualified ÷ Total' },
  svratio: { icon: BuildingOffice2Icon, accent: COLORS.negotiation, title: 'Site Visit Ratio', sub: 'Site visits ÷ Total leads', rs: 'SV ÷ Total leads' },
  calls: { icon: PhoneArrowUpRightIcon, accent: COLORS.qualified, title: 'Calls per Day', sub: 'Daily call volume & answer rate', rs: 'Daily call volume' },
  hourly: { icon: ClockIcon, accent: COLORS.primary, title: 'Hour-wise Call Analysis', sub: 'Answered vs unanswered by hour', rs: 'Answered vs unanswered' },
  leaderboard: { icon: TrophyIcon, accent: COLORS.booking, title: 'Leaderboard', sub: 'Team ranking', rs: 'Team ranking' },
  svproject: { icon: MapPinIcon, accent: COLORS.answered, title: 'Project-wise Site Visits', sub: 'Visit breakdown by project', rs: 'Visits by project' },
  // Sales Manager
  booking: { icon: CheckBadgeIcon, accent: COLORS.qualified, title: 'Booking Ratio', sub: 'Site Visit → Booking conversion', rs: 'SV → Booking' },
  negotiation: { icon: ChatBubbleLeftRightIcon, accent: COLORS.negotiation, title: 'Negotiation Ratio', sub: 'SV → Negotiation conversion', rs: 'SV → Negotiation' },
  svbooking: { icon: ScaleIcon, accent: COLORS.booking, title: 'SV : Booking Ratio', sub: 'Visits needed per booking', rs: 'Visits per booking' },
  svneg: { icon: ArrowsRightLeftIcon, accent: COLORS.siteVisit, title: 'SV : Negotiation Ratio', sub: 'Visits to reach negotiation', rs: 'Visits to negotiation' },
  bookingsqft: { icon: Squares2X2Icon, accent: COLORS.booking, title: 'Bookings in Sq Ft', sub: 'Area booked + booking count', rs: 'Area booked' },
  inventory: { icon: Squares2X2Icon, accent: COLORS.negotiation, title: 'Project-wise Inventory', sub: 'Unit status across projects', rs: 'Unit status overview' },
  // Sales Head
  cancelratio: { icon: XCircleIcon, accent: COLORS.cancelled, title: 'Cancellation Ratio', sub: 'Cancellations ÷ Bookings', rs: 'All bookings' },
  svstatus: { icon: MapPinIcon, accent: COLORS.answered, title: 'SM-wise SV Status', sub: 'Per Sales Manager site visit breakdown', rs: 'Per-SM breakdown' },
  missedfu: { icon: ExclamationTriangleIcon, accent: COLORS.cancelled, title: 'SM-wise Missed FU', sub: 'Overdue follow-ups across teams', rs: 'Per-SM risk' },
  shleaderboard: { icon: TrophyIcon, accent: COLORS.siteVisit, title: 'Sales Head Leaderboard', sub: 'Sales Head performance ranking', rs: 'SH ranking' },
  // Org-wide
  funnel: { icon: FunnelIcon, accent: COLORS.negotiation, title: 'Conversion Funnel', sub: 'Qualified → SV → Negotiation → Booking', rs: 'Org-wide funnel' },
  revenue: { icon: BanknotesIcon, accent: COLORS.booking, title: 'Revenue Snapshot', sub: 'Booking value & area — org-wide', rs: 'Financial overview' },
};

const ROLES = {
  TC: {
    label: 'Telecaller', accent: COLORS.booking,
    groups: [
      { label: 'Performance', keys: ['qualification', 'svratio', 'calls', 'hourly'] },
      { label: 'Leaderboard', keys: ['leaderboard'] },
      { label: 'Inventory', keys: ['svproject'] },
    ],
  },
  SM: {
    label: 'Sales Manager', accent: COLORS.qualified,
    groups: [
      { label: 'Conversion', keys: ['booking', 'negotiation', 'svbooking', 'svneg'] },
      { label: 'Activity', keys: ['calls', 'hourly', 'bookingsqft'] },
      { label: 'Team & Inventory', keys: ['leaderboard', 'inventory'] },
    ],
  },
  SH: {
    label: 'Sales Head', accent: COLORS.siteVisit,
    groups: [
      { label: 'Conversion', keys: ['booking', 'cancelratio'] },
      { label: 'Team', keys: ['svstatus', 'missedfu', 'leaderboard', 'shleaderboard'] },
      { label: 'Activity & Inventory', keys: ['calls', 'hourly', 'bookingsqft', 'inventory'] },
    ],
  },
  ORG: {
    label: 'Organization', accent: COLORS.primary,
    groups: [
      { label: 'Org-wide Analytics', keys: ['funnel', 'calls', 'hourly', 'bookingsqft', 'inventory', 'revenue'] },
    ],
  },
};
export const firstKey = (role) => ROLES[role].groups[0].keys[0];

// Curated report sets for the self-service portal view (TC / SM / SH seeing only
// their OWN data). Leaderboards and per-other-user breakdowns are intentionally
// excluded — those expose other people's numbers.
export const SELF_REPORT_GROUPS = {
  TC: [
    { label: 'Performance', keys: ['qualification', 'svratio', 'calls', 'hourly'] },
    { label: 'Inventory', keys: ['svproject'] },
  ],
  SM: [
    { label: 'Conversion', keys: ['booking', 'negotiation', 'svbooking', 'svneg'] },
    { label: 'Activity', keys: ['calls', 'hourly', 'bookingsqft'] },
    { label: 'Inventory', keys: ['inventory'] },
  ],
  SH: [
    { label: 'Conversion', keys: ['booking', 'cancelratio'] },
    { label: 'Activity & Inventory', keys: ['calls', 'hourly', 'bookingsqft', 'inventory'] },
  ],
};
export const selfFirstKey = (role) => (SELF_REPORT_GROUPS[role] || ROLES[role].groups)[0].keys[0];

// ── presentational pieces ──────────────────────────────────────────────────────
// When true, the shared pieces below render in a flat monochrome style: no accent
// top-borders on KPI cards, KPI numbers at font-weight 500, primary-text (black in
// light mode) table headers, and no per-cell colour. ReportBrowser turns this on for
// every report view — the Super Admin Analytics + Performance pages and the
// self-service "My Reports" all render consistently.
const MonoContext = createContext(false);

// `valueSize` lets name-based KPI cards (e.g. Top Performer) use a smaller,
// truncating value so long names don't overflow the card. Default 22px matches the
// portal dashboard stat cards (.col-stat-value-new) so the two screens look consistent.
const KpiCard = ({ label, value, sub, color, icon: Icon, valueSize = 22 }) => {
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
const KpiRow = ({ children }) => <div className="flex flex-wrap gap-3 mb-4">{children}</div>;

const PILL_TONES = {
  green: { bg: '#E8F5E8', fg: '#1a7a40' }, red: { bg: '#FEF2F2', fg: '#DC2626' },
  amber: { bg: '#FFF7ED', fg: '#D97706' }, blue: { bg: '#EFF6FF', fg: '#2563EB' },
  purple: { bg: '#F5F3FF', fg: '#7C3AED' }, gray: { bg: '#F3F4F6', fg: '#374151' },
};
const Pill = ({ children, tone = 'blue' }) => {
  const mono = useContext(MonoContext);
  const t = PILL_TONES[mono ? 'gray' : tone] || PILL_TONES.blue;
  return <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-semibold" style={{ background: t.bg, color: t.fg }}>{children}</span>;
};
const ratioTone = (p) => (p >= 60 ? 'green' : p >= 35 ? 'amber' : 'red');

const ProgressBar = ({ value, color }) => (
  <div className="h-1 rounded-full overflow-hidden min-w-[80px]" style={{ background: '#EFEFEF' }}>
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
  </div>
);

const Card = ({ title, sub, right, children, registerRef, chartKey }) => {
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

const Table = ({ head, children, colSpan, empty }) => {
  const mono = useContext(MonoContext);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead><tr style={{ background: 'var(--bg-hover, #FAFAFA)' }}>
          {head.map((h, i) => <th key={i} className={`px-3 py-2 text-left text-[10.5px] uppercase tracking-wide whitespace-nowrap ${mono ? 'font-medium' : 'font-semibold'}`} style={{ color: mono ? 'var(--text-primary)' : 'var(--text-muted)' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {empty ? <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>No data for this period.</td></tr> : children}
        </tbody>
      </table>
    </div>
  );
};
const Tr = ({ children, onClick }) => (
  <tr
    onClick={onClick}
    className={onClick ? 'transition-colors hover:bg-[var(--bg-hover,#FAFAFA)]' : undefined}
    style={{ borderTop: '1px solid var(--border-primary)', cursor: onClick ? 'pointer' : undefined }}
  >{children}</tr>
);
// In the mono (self-service "My Reports") style, table cells drop both their accent
// colour and their bold weight — flat, black-on-white numbers — per the reports polish.
const Td = ({ children, bold, color, className = '' }) => {
  const mono = useContext(MonoContext);
  const c = mono ? undefined : color;
  const isBold = bold && !mono;
  return <td className={`px-3 py-2.5 text-[13px] ${isBold ? 'font-semibold' : ''} ${className}`} style={c ? { color: c } : undefined}>{children}</td>;
};
// Summed footer row for per-project tables. `label` fills the first column; `cells`
// fills the rest (one entry per remaining column), all rendered bold and emphasised.
const TotalRow = ({ cells, label = 'Total' }) => (
  <tr style={{ borderTop: '2px solid var(--border-primary)', background: 'var(--bg-hover, #FAFAFA)' }}>
    <Td bold>{label}</Td>
    {cells.map((c, i) => <Td key={i} bold>{c}</Td>)}
  </tr>
);

const LeaderList = ({ rows, metric, metricLabel, subFn }) => {
  const mono = useContext(MonoContext);
  if (!rows || rows.length === 0) return <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>No data for this period.</div>;
  const rankBg = (i) => (i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7C2F' : '#F0F0EE');
  const rankFg = (i) => (i < 3 ? '#fff' : '#666');
  return (
    <div>
      {rows.map((r, i) => (
        <div key={r.id || i} className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: rankBg(i), color: rankFg(i) }}>{i + 1}</div>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{initials(r)}</div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{fullName(r)}</div>
            <div className="text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>{subFn(r)}</div>
          </div>
          <div className={`ml-auto text-[14px] flex-shrink-0 ${mono ? '' : 'font-bold'}`} style={{ color: mono ? 'var(--text-primary)' : COLORS.booking, fontWeight: mono ? 500 : undefined, fontVariantNumeric: 'tabular-nums' }}>{num(metric(r)).toLocaleString('en-IN')} {metricLabel}</div>
        </div>
      ))}
    </div>
  );
};

const FunnelBars = ({ steps }) => {
  // Compute widths: first step is 100%, each subsequent step narrows
  // proportionally, with a minimum of 40% so labels stay readable.
  const maxVal = Math.max(1, ...steps.map((s) => num(s.value)));
  const widths = steps.map((s) => {
    const ratio = num(s.value) / maxVal;
    return 40 + ratio * 60; // range: 40% → 100%
  });
  // Force the first bar to always be 100%
  widths[0] = 100;

  return (
    <div className="p-5" style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 480 }}>
        {steps.map((s, i) => {
          const topW = widths[i];
          const botW = i < steps.length - 1 ? widths[i + 1] : topW * 0.85;
          // Trapezoid via clip-path: top-left, top-right, bottom-right, bottom-left
          const topInset = (100 - topW) / 2;
          const botInset = (100 - botW) / 2;
          return (
            <React.Fragment key={s.label}>
              <div
                style={{
                  width: '100%',
                  position: 'relative',
                  clipPath: `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - botInset}% 100%, ${botInset}% 100%)`,
                  background: s.color,
                  padding: '12px 0',
                  textAlign: 'center',
                  transition: 'clip-path 0.3s ease',
                }}
              >
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>{s.label}</div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginTop: 2 }}>{num(s.value)}</div>
              </div>
              {i < steps.length - 1 && (
                <div className="text-center text-[11px] py-1.5" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                  ▼ {pct(num(steps[i + 1].value), num(s.value))}%
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
const Heatmap = ({ hourly, base }) => {
  const cells = HOURS.map((h) => ({ h, v: num(hourly[h]?.answered) + num(hourly[h]?.unanswered) }));
  const max = Math.max(1, ...cells.map((c) => c.v));
  const shade = (v) => {
    if (v === 0) return { bg: '#F5F5F5', fg: '#ccc' };
    const r = v / max;
    if (r > 0.75) return { bg: base, fg: '#fff' };
    if (r > 0.5) return { bg: `${base}cc`, fg: '#fff' };
    if (r > 0.25) return { bg: `${base}80`, fg: '#1f2937' };
    return { bg: `${base}40`, fg: '#374151' };
  };
  return (
    <div className="px-3 pt-3 pb-3">
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(12,1fr)' }}>
        {cells.map((c) => { const s = shade(c.v); return <div key={c.h} className="h-7 rounded flex items-center justify-center text-[9px] font-medium" style={{ background: s.bg, color: s.fg }}>{c.v}</div>; })}
      </div>
      <div className="grid gap-1 mt-1" style={{ gridTemplateColumns: 'repeat(12,1fr)' }}>
        {HOURS.map((h) => <div key={h} className="text-[9px] text-center" style={{ color: 'var(--text-muted)' }}>{hourLabel(h)}</div>)}
      </div>
    </div>
  );
};

// merge per-role call series for ORG view
const mergeCallsPerDay = (roleData) => {
  const map = new Map();
  Object.values(roleData).forEach((d) => (d?.callsPerDay || []).forEach((row) => {
    const c = map.get(row.day) || { day: row.day, answered: 0, unanswered: 0, total: 0 };
    c.answered += num(row.answered); c.unanswered += num(row.unanswered); c.total += num(row.total); map.set(row.day, c);
  }));
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
};
const mergeHourly = (roleData) => {
  const out = Array.from({ length: 24 }, (_, h) => ({ hour: h, answered: 0, unanswered: 0 }));
  Object.values(roleData).forEach((d) => (d?.hourlyCalls || []).forEach((row) => {
    const h = Number(row.hour); if (out[h]) { out[h].answered += num(row.answered); out[h].unanswered += num(row.unanswered); }
  }));
  return out;
};
// combine SV-per-project + bookings-per-project into one table dataset.
// svKey selects the SV source: 'projectWiseSiteVisit' (default) or
// 'projectWiseSiteVisitAssigned' (Booking-Ratio screen). Both are now distinct leads
// with a Completed, owner-attributed visit, so per-project rows sum to the headline.
const bookingByProject = (d, svKey = 'projectWiseSiteVisit') => {
  const map = new Map();
  (d?.[svKey] || []).forEach((p) => map.set(p.project_name, { project_name: p.project_name, sv: num(p.site_visits), booked: 0 }));
  (d?.projectWiseBooking || []).forEach((p) => {
    const cur = map.get(p.project_name) || { project_name: p.project_name, sv: 0, booked: 0 };
    cur.booked = num(p.booked); map.set(p.project_name, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.booked - a.booked || b.sv - a.sv);
};

// Completed site visits grouped by project (or by user, for the admin all-users
// view), each group expandable to its leads — mirrors the Task List page's
// group-by drill-down.
const fmtVisitDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const ProjectSiteVisitGroups = ({ details }) => {
  const [open, setOpen] = useState(() => new Set());
  const [groupBy, setGroupBy] = useState('project'); // 'project' | 'user'

  // Offer the user toggle only when more than one person's visits are present
  // (TC self-service has a single owner, so grouping by user is meaningless).
  const multiUser = useMemo(
    () => new Set((details || []).map((r) => r.owner_name || 'Unassigned')).size > 1,
    [details]
  );
  const by = multiUser ? groupBy : 'project';

  const groups = useMemo(() => {
    const map = new Map();
    (details || []).forEach((r) => {
      const k = (by === 'user' ? r.owner_name : r.project_name) || 'Unassigned';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [details, by]);

  if (!(details || []).length) {
    return <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>No completed site visits for this period.</div>;
  }
  const toggle = (k) => setOpen((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // Secondary column adapts: grouping by project shows who handled it; grouping
  // by user shows which project the visit was for.
  const secondHead = by === 'user' ? 'Project' : 'Handled By';

  return (
    <div>
      {multiUser && (
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Group by</span>
          {[{ k: 'project', l: 'Project' }, { k: 'user', l: 'User' }].map((o) => {
            const on = by === o.k;
            return (
              <button key={o.k} type="button" onClick={() => { setGroupBy(o.k); setOpen(new Set()); }}
                className="h-6 px-2 rounded-full text-[12px] font-medium transition-colors"
                style={on ? { background: COLORS.primary, color: '#fff', border: `1px solid ${COLORS.primary}` } : { background: 'var(--bg-card)', color: 'var(--text-secondary, #555)', border: '1px solid var(--border-input)' }}>
                {o.l}
              </button>
            );
          })}
        </div>
      )}
      {groups.map(([name, leads]) => {
        const gKey = `${by}:${name}`;
        const isOpen = open.has(gKey);
        return (
          <div key={gKey} style={{ borderTop: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2.5 px-4 py-3 cursor-pointer" onClick={() => toggle(gKey)} style={{ background: 'var(--bg-hover, #FAFAFA)' }}>
              <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border-primary)', background: isOpen ? COLORS.siteVisit : 'var(--bg-card)', color: isOpen ? '#fff' : COLORS.siteVisit }}>
                <PlusIcon style={{ width: 13, height: 13, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .15s' }} />
              </span>
              <span className="font-semibold text-[13px]" style={{ color: 'var(--text-primary)' }}>{name}</span>
              <span className="text-[11px] font-bold" style={{ color: COLORS.siteVisit, background: `${COLORS.siteVisit}1a`, borderRadius: 999, padding: '1px 8px' }}>{leads.length}</span>
              <span className="ml-auto text-[12px]" style={{ color: 'var(--text-muted)' }}>{leads.length} site visit{leads.length === 1 ? '' : 's'}</span>
            </div>
            {isOpen && (
              <Table head={['Lead', secondHead, 'Visit Date', 'Status']} colSpan={4} empty={leads.length === 0}>
                {leads.map((r, i) => (
                  <Tr key={r.lead_id || i}>
                    <Td bold>{r.lead_name || '—'}</Td>
                    <Td color="var(--text-muted)">{(by === 'user' ? r.project_name : r.owner_name) || '—'}</Td>
                    <Td color="var(--text-muted)">{fmtVisitDate(r.visit_date)}</Td>
                    <Td><Pill tone="green">{r.status || 'Completed'}</Pill></Td>
                  </Tr>
                ))}
              </Table>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Available-plots drawer (opens from the Inventory Summary table) ───────────
const AvailablePlotsModal = ({ project, units, loading, onClose }) => {
  const fmtArea = (u) => (u.unit_area ? `${num(u.unit_area).toLocaleString('en-IN')} ${u.area_unit || 'sq.ft.'}` : '—');
  const value = (u) => (u.total_price ? formatCurrency(u.total_price) : u.guided_value ? formatCurrency(u.guided_value) : '—');
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="crm-card w-full max-w-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{project.project_name}</div>
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Available plots</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none px-2" style={{ color: 'var(--text-muted)' }}>×</button>
        </div>
        <div className="overflow-auto">
          {loading ? (
            <div className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading available plots…</div>
          ) : (
            <Table head={['Unit', 'Phase', 'Configuration', 'Area', 'Facing', 'Value']} colSpan={6} empty={units.length === 0}>
              {units.map((u) => (
                <Tr key={u.id}>
                  <Td bold>{u.unit_number}{u.tower_block ? ` · ${u.tower_block}` : ''}</Td>
                  <Td>{u.phase?.phase_name || '—'}</Td>
                  <Td>{u.configuration || '—'}</Td>
                  <Td>{fmtArea(u)}</Td>
                  <Td>{u.facing || '—'}</Td>
                  <Td bold>{value(u)}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

// Inventory summary table — each project row opens the list of available plots.
const InventorySummaryTable = ({ inv }) => {
  const [active, setActive] = useState(null);
  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const openUnits = async (p) => {
    if (!p.project_id || p.available <= 0) return;
    setActive(p);
    setUnits([]);
    setLoadingUnits(true);
    try {
      const resp = await inventoryUnitApi.getAll({ project_id: p.project_id, unit_status: 'Available', limit: 200 });
      setUnits(resp.data || []);
    } catch {
      toast.error('Failed to load available plots');
      setActive(null);
    } finally {
      setLoadingUnits(false);
    }
  };

  return (
    <>
      <Card title="All Projects — Inventory Summary">
        <Table head={['Project', 'Total', 'Available', 'Booked', 'Blocked', 'Sold %']} colSpan={6} empty={inv.length === 0}>
          {inv.map((p, i) => { const sold = pct(p.booked, p.total); return (
            <Tr key={i} onClick={p.available > 0 ? () => openUnits(p) : undefined}>
              <Td bold>{p.project_name}</Td><Td bold>{p.total}</Td><Td bold color={COLORS.booking}>{p.available}</Td>
              <Td bold color={COLORS.qualified}>{p.booked}</Td><Td bold color={COLORS.cancelled}>{p.blocked}</Td><Td><Pill tone={ratioTone(sold)}>{sold}%</Pill></Td>
            </Tr>
          ); })}
        </Table>
      </Card>
      {active && (
        <AvailablePlotsModal project={active} units={units} loading={loadingUnits} onClose={() => setActive(null)} />
      )}
    </>
  );
};

// ── panels ──────────────────────────────────────────────────────────────────
const Panel = ({ rkey, role, d, accent, orgCalls, orgHourly, registerRef, selfView = false }) => {
  const f = d?.funnel || {};
  const lb = d?.teamLeaderboard || [];

  switch (rkey) {
    case 'qualification': {
      const r = d?.qualificationRatio || {};
      // Filter out Unassigned/Others from Top Performer calculation
      const userLeaderboard = lb.filter((u) => u.id !== 'unassigned');
      const best = [...userLeaderboard].sort((a, b) => pct(num(b.qualified), num(b.leads)) - pct(num(a.qualified), num(a.leads)))[0];
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Leads" value={num(f.totalLeads)} sub="All sources" color={COLORS.leads} icon={UsersIcon} />
            <KpiCard label="Qualified" value={num(f.qualified)} sub={`${r.pct || 0}% qualification rate`} color={COLORS.qualified} icon={CheckBadgeIcon} />
            <KpiCard label="RNR" value={num(f.rnr)} sub={`${pct(num(f.rnr), num(f.totalLeads))}% RNR rate`} color={COLORS.siteVisit} icon={PhoneArrowUpRightIcon} />
            <KpiCard label="Unqualified" value={num(f.unqualified)} sub={`${pct(num(f.unqualified), num(f.totalLeads))}% unqualified rate`} color={COLORS.cancelled} icon={XCircleIcon} />
            <KpiCard label="Unassigned" value={num(f.unassigned)} sub={`${pct(num(f.unassigned), num(f.totalLeads))}% unassigned rate`} color={COLORS.muted} icon={ClockIcon} />
            <KpiCard label="Top Performer" value={best ? fullName(best) : '—'} sub={best ? `${pct(num(best.qualified), num(best.leads))}% qual.` : ''} color={COLORS.booking} icon={TrophyIcon} valueSize={17} />
          </KpiRow>
          <Card title="Member-wise Qualification Ratio">
            <Table head={['Member', 'Leads Created', 'Total Leads', 'Qualified', 'RNR', 'Unqualified', 'Unassigned', 'Ratio']} colSpan={8} empty={lb.length === 0}>
              {lb.map((u) => { const p = pct(num(u.qualified), num(u.leads)); return (
                <Tr key={u.id}><Td bold>{fullName(u)}</Td><Td bold>{num(u.leads_created)}</Td><Td bold>{num(u.leads)}</Td>
                  <Td bold color={COLORS.qualified}>{num(u.qualified)}</Td>
                  <Td bold color={COLORS.siteVisit}>{num(u.rnr)}</Td>
                  <Td bold color={COLORS.cancelled}>{num(u.unqualified)}</Td>
                  <Td bold color={COLORS.muted}>{num(u.unassigned)}</Td>
                  <Td><Pill tone={ratioTone(p)}>{p}%</Pill></Td></Tr>
              ); })}
              {/* Total row */}
              {(() => {
                const totalCreated = lb.reduce((sum, u) => sum + num(u.leads_created), 0);
                const totalLeads = lb.reduce((sum, u) => sum + num(u.leads), 0);
                const totalQualified = lb.reduce((sum, u) => sum + num(u.qualified), 0);
                const totalRnr = lb.reduce((sum, u) => sum + num(u.rnr), 0);
                const totalUnqualified = lb.reduce((sum, u) => sum + num(u.unqualified), 0);
                const totalUnassigned = lb.reduce((sum, u) => sum + num(u.unassigned), 0);
                const totalPct = pct(totalQualified, totalLeads);
                return (
                  <Tr key="total" style={{ borderTop: '2px solid var(--border-color, #e5e7eb)', backgroundColor: 'var(--bg-secondary, #f9fafb)' }}>
                    <Td bold style={{ fontWeight: 'bold' }}>TOTAL</Td>
                    <Td bold style={{ fontWeight: 'bold' }}>{totalCreated}</Td>
                    <Td bold style={{ fontWeight: 'bold' }}>{totalLeads}</Td>
                    <Td bold style={{ fontWeight: 'bold', color: COLORS.qualified }}>{totalQualified}</Td>
                    <Td bold style={{ fontWeight: 'bold', color: COLORS.siteVisit }}>{totalRnr}</Td>
                    <Td bold style={{ fontWeight: 'bold', color: COLORS.cancelled }}>{totalUnqualified}</Td>
                    <Td bold style={{ fontWeight: 'bold', color: COLORS.muted }}>{totalUnassigned}</Td>
                    <Td><Pill tone={ratioTone(totalPct)}>{totalPct}%</Pill></Td>
                  </Tr>
                );
              })()}
            </Table>
          </Card>
        </>
      );
    }
    case 'svratio': {
      const r = d?.siteVisitRatio || {};
      return (
        <>
          <KpiRow>
            <KpiCard label="Total SV Done" value={num(f.siteVisits)} sub="Completed visits" color={COLORS.qualified} icon={BuildingOffice2Icon} />
            <KpiCard label="SV Ratio" value={`${r.pct || 0}%`} sub="SV ÷ Total leads" color={COLORS.booking} icon={ScaleIcon} />
            <KpiCard label="Total Leads" value={num(f.totalLeads)} sub="Cohort size" color={COLORS.siteVisit} icon={UsersIcon} />
          </KpiRow>
          <Card title="Member Site Visit Conversion">
            <Table head={['Member', 'Total Leads', 'Site Visits', 'SV Ratio', 'Progress']} colSpan={5} empty={lb.length === 0}>
              {lb.map((u) => { const p = pct(num(u.site_visits), num(u.leads)); return (
                <Tr key={u.id}><Td bold>{fullName(u)}</Td><Td bold>{num(u.leads)}</Td><Td bold>{num(u.site_visits)}</Td>
                  <Td><Pill tone={ratioTone(p * 3)}>{p}%</Pill></Td>
                  <Td><ProgressBar value={p * 3} color={p >= 20 ? COLORS.booking : COLORS.siteVisit} /></Td></Tr>
              ); })}
            </Table>
          </Card>
        </>
      );
    }
    case 'svproject': {
      const proj = (d?.projectWiseSiteVisit || []).map((p) => ({ project_name: p.project_name, site_visits: num(p.site_visits) }));
      const details = d?.siteVisitDetails || [];
      // Headline uses the canonical distinct-leads-visited total (funnel.siteVisits)
      // so it matches the SV Ratio screen and the leaderboard. The per-project table
      // below may sum higher when a lead visited more than one project.
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Site Visits" value={num(f.siteVisits)} sub="Completed in this period" color={COLORS.qualified} icon={MapPinIcon} />
            <KpiCard label="Projects with Visits" value={proj.length} sub="Active projects" color={COLORS.negotiation} icon={Squares2X2Icon} />
            <KpiCard label="Top Project" value={proj[0]?.project_name || '—'} sub={proj[0] ? `${proj[0].site_visits} visits` : ''} color={COLORS.siteVisit} icon={TrophyIcon} valueSize={17} />
          </KpiRow>
          <ChartCard title="Project-wise Site Visits" subtitle="Completed visits per project" chartKey="svproject" registerRef={registerRef}>
            <SimpleBar data={proj} xKey="project_name" bars={[{ key: 'site_visits', name: 'Site Visits', color: COLORS.siteVisit }]} />
          </ChartCard>
          <Card title="Site Visits by Project" sub="Expand a project to see its leads" right={`${details.length} lead${details.length === 1 ? '' : 's'}`}>
            <ProjectSiteVisitGroups details={details} />
          </Card>
        </>
      );
    }
    case 'calls': {
      const series = role === 'ORG' ? orgCalls : (d?.callsPerDay || []).map((x) => ({ day: x.day, answered: num(x.answered), unanswered: num(x.unanswered), total: num(x.total) }));
      const t = series.reduce((a, r) => ({ total: a.total + num(r.total), answered: a.answered + num(r.answered), unanswered: a.unanswered + num(r.unanswered) }), { total: 0, answered: 0, unanswered: 0 });
      const callLeaderboard = [...lb].sort((a, b) => num(b.calls) - num(a.calls));
      const callBest = callLeaderboard[0];
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Calls" value={t.total} sub={role === 'ORG' ? 'All agents · period' : 'Period total'} color={COLORS.qualified} icon={PhoneArrowUpRightIcon} />
            <KpiCard label="Answered" value={t.answered} sub={`${pct(t.answered, t.total)}% answer rate`} color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Not Answered" value={t.unanswered} sub={`${pct(t.unanswered, t.total)}% missed`} color={COLORS.cancelled} icon={XCircleIcon} />
            {/* "Top Caller" is a leaderboard card — pointless in a self-only portal view
                (it's always the logged-in user), so hide it there. */}
            {!selfView && (
              <KpiCard label="Top Caller" value={callBest ? fullName(callBest) : '—'} sub={callBest ? `${num(callBest.calls)} calls` : ''} color={COLORS.siteVisit} icon={TrophyIcon} valueSize={17} />
            )}
          </KpiRow>
          <ChartCard title="Calls per Day" subtitle="Answered vs unanswered" chartKey="calls" registerRef={registerRef}>
            <CallsPerDayLine data={series} />
          </ChartCard>
          <Card title="Member-wise Call Activity">
            <Table head={['Member', 'Total Calls', 'Answered', 'Not Answered', 'Answer Rate']} colSpan={5} empty={lb.length === 0}>
              {callLeaderboard.map((u) => { const total = num(u.calls); const answered = num(u.calls_answered); const rate = pct(answered, total); return (
                <Tr key={u.id}><Td bold>{fullName(u)}</Td><Td bold>{total}</Td>
                  <Td bold color={COLORS.booking}>{answered}</Td><Td bold color={COLORS.cancelled}>{total - answered}</Td>
                  <Td><Pill tone={ratioTone(rate)}>{rate}%</Pill></Td></Tr>
              ); })}
            </Table>
          </Card>
        </>
      );
    }
    case 'hourly': {
      const hourly = role === 'ORG' ? orgHourly : (d?.hourlyCalls || []);
      let peak = 0; let peakV = 0; let bestRate = 0; let bestHour = 0;
      hourly.forEach((h) => {
        const tot = num(h.answered) + num(h.unanswered);
        if (tot > peakV) { peakV = tot; peak = h.hour; }
        const rate = pct(num(h.answered), tot);
        if (tot > 0 && rate > bestRate) { bestRate = rate; bestHour = h.hour; }
      });
      return (
        <>
          <KpiRow>
            <KpiCard label="Peak Hour" value={hourLabel(peak)} sub={`${peakV} calls`} color={COLORS.siteVisit} icon={ClockIcon} />
            <KpiCard label="Best Answer %" value={`${bestRate}%`} sub={`at ${hourLabel(bestHour)}`} color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Total Calls" value={hourly.reduce((a, h) => a + num(h.answered) + num(h.unanswered), 0)} sub="Across the day" color={COLORS.qualified} icon={PhoneArrowUpRightIcon} />
          </KpiRow>
          <Card title="Hourly Call Heatmap" sub="Darker = more calls"><Heatmap hourly={hourly} base={accent} /></Card>
          <Card title="Answered vs Not Answered by Hour" sub="9 AM – 8 PM" registerRef={registerRef} chartKey="hourly">
            <Table head={['Time', 'Total Calls', 'Answered', 'Unanswered']} colSpan={4} empty={false}>
              {HOURS.map((h) => { const row = hourly[h] || {}; const a = num(row.answered); const u = num(row.unanswered); return (
                <Tr key={h}>
                  <Td bold>{hourLabel(h)}</Td>
                  <Td bold>{a + u}</Td>
                  <Td bold color={COLORS.answered}>{a}</Td>
                  <Td bold color={COLORS.unanswered}>{u}</Td>
                </Tr>
              ); })}
            </Table>
          </Card>
        </>
      );
    }
    case 'leaderboard': {
      const isTC = role === 'TC';
      return (
        <Card title={`${ROLES[role].label} Leaderboard`} sub={isTC ? 'Ranked by site visits' : 'Ranked by booked sq ft'}>
          <LeaderList rows={lb}
            metric={(r) => (isTC ? r.site_visits : Math.round(num(r.booked_sqft)))} metricLabel={isTC ? 'SV' : 'sq ft'}
            subFn={(r) => (isTC ? `${num(r.leads)} leads · ${pct(num(r.qualified), num(r.leads))}% qual.` : `${num(r.bookings)} bookings · ${num(r.site_visits)} SV`)} />
        </Card>
      );
    }
    case 'shleaderboard':
      return (
        <Card title="Sales Head Leaderboard" sub="Ranked by site visits">
          <LeaderList rows={d?.salesHeadLeaderboard} metric={(r) => r.bookings} metricLabel="bookings"
            subFn={(r) => `${num(r.site_visits)} SV · ${num(r.leads)} leads`} />
        </Card>
      );

    case 'booking': {
      const r = d?.bookingRatio || {};
      // "SV Done" = distinct leads with a Completed visit, attributed to the SM who
      // recorded/attended it (one per lead, revisits collapsed, cancelled excluded).
      const svDone = num(f.siteVisitsAssigned);
      const proj = bookingByProject(d, 'projectWiseSiteVisitAssigned');
      const totSV = proj.reduce((a, p) => a + num(p.sv), 0);
      const totBooked = proj.reduce((a, p) => a + num(p.booked), 0);
      return (
        <>
          <KpiRow>
            <KpiCard label="Site Visits Done" value={svDone} sub="Completed" color={COLORS.qualified} icon={BuildingOffice2Icon} />
            <KpiCard label="Bookings" value={num(f.bookings)} sub="Closed" color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Booking Ratio" value={`${r.pct || 0}%`} sub="SV → Booking" color={COLORS.siteVisit} icon={ScaleIcon} />
            <KpiCard label="Dropped Post-SV" value={Math.max(0, svDone - num(f.bookings))} sub={`${Math.round((100 - (r.pct || 0)) * 10) / 10}% not converted`} color={COLORS.cancelled} icon={XCircleIcon} />
          </KpiRow>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))' }}>
            <Card title="SV → Booking Funnel">
              <Table head={['Stage', 'Count']} colSpan={2} empty={false}>
                {[
                  { label: 'SV Done', value: svDone, color: COLORS.qualified },
                  { label: 'Bookings', value: f.bookings, color: COLORS.booking },
                  { label: 'Under Nego', value: f.negotiation, color: COLORS.negotiation },
                  { label: 'SM Leads', value: f.smLeads ?? f.totalLeads, color: COLORS.siteVisit },
                ].map((s) => (
                  <Tr key={s.label}><Td bold color={s.color}>{s.label}</Td><Td bold>{num(s.value)}</Td></Tr>
                ))}
              </Table>
            </Card>
            <Card title="Booking Ratio by Project">
              <Table head={['Project', 'SV Done', 'Booked', 'Ratio']} colSpan={4} empty={proj.length === 0}>
                {proj.map((p, i) => { const pr = pct(p.booked, p.sv); return (
                  <Tr key={i}><Td bold>{p.project_name}</Td><Td bold>{p.sv}</Td><Td bold color={COLORS.booking}>{p.booked}</Td><Td><Pill tone={ratioTone(pr * 2)}>{pr}%</Pill></Td></Tr>
                ); })}
                {proj.length > 0 && (
                  <TotalRow cells={[totSV, <span style={{ color: COLORS.booking }}>{totBooked}</span>, <Pill tone={ratioTone(pct(totBooked, totSV) * 2)}>{pct(totBooked, totSV)}%</Pill>]} />
                )}
              </Table>
            </Card>
          </div>
        </>
      );
    }
    case 'negotiation': {
      const r = d?.negotiationRatio || {};
      return (
        <>
          <KpiRow>
            <KpiCard label="SV Done" value={num(f.siteVisits)} sub="Period" color={COLORS.qualified} icon={BuildingOffice2Icon} />
            <KpiCard label="Reached Negotiation" value={num(f.negotiation)} sub={`${r.pct || 0}% negotiation rate`} color={COLORS.negotiation} icon={ChatBubbleLeftRightIcon} />
            <KpiCard label="Closed from Neg." value={num(f.bookings)} sub={`${pct(num(f.bookings), num(f.negotiation))}% close rate`} color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Pending Negotiation" value={Math.max(0, num(f.negotiation) - num(f.bookings))} sub="Active negotiations" color={COLORS.siteVisit} icon={ClockIcon} />
          </KpiRow>
          <Card title="Negotiation Funnel">
            <FunnelBars steps={[
              { label: 'Site Visits Done', value: f.siteVisits, color: COLORS.qualified },
              { label: 'Negotiation Stage', value: f.negotiation, color: COLORS.negotiation },
              { label: 'Bookings Closed', value: f.bookings, color: COLORS.booking },
            ]} />
          </Card>
        </>
      );
    }
    case 'svbooking': {
      const avg = num(f.bookings) > 0 ? (num(f.siteVisits) / num(f.bookings)).toFixed(1) : '—';
      const proj = bookingByProject(d);
      const totSV = proj.reduce((a, p) => a + num(p.sv), 0);
      const totBooked = proj.reduce((a, p) => a + num(p.booked), 0);
      return (
        <>
          <KpiRow>
            <KpiCard label="Avg SVs per Booking" value={avg} sub="Visits to close one" color={COLORS.qualified} icon={ScaleIcon} />
            <KpiCard label="Bookings" value={num(f.bookings)} sub="Period" color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Site Visits Done" value={num(f.siteVisits)} sub="Total visits" color={COLORS.siteVisit} icon={BuildingOffice2Icon} />
          </KpiRow>
          <Card title="Visits Required Per Booking by Project">
            <Table head={['Project', 'SV Done', 'Booked', 'Avg SV / Booking']} colSpan={4} empty={proj.length === 0}>
              {proj.map((p, i) => <Tr key={i}><Td bold>{p.project_name}</Td><Td bold>{p.sv}</Td><Td bold color={COLORS.booking}>{p.booked}</Td><Td bold>{p.booked > 0 ? (p.sv / p.booked).toFixed(1) : '—'}</Td></Tr>)}
              {proj.length > 0 && (
                <TotalRow cells={[totSV, <span style={{ color: COLORS.booking }}>{totBooked}</span>, totBooked > 0 ? (totSV / totBooked).toFixed(1) : '—']} />
              )}
            </Table>
          </Card>
        </>
      );
    }
    case 'svneg': {
      const r = d?.negotiationRatio || {};
      const avg = num(f.negotiation) > 0 ? (num(f.siteVisits) / num(f.negotiation)).toFixed(1) : '—';
      const proj = (d?.projectWiseSiteVisit || []).map((p) => ({ project_name: p.project_name, site_visits: num(p.site_visits) }));
      return (
        <>
          <KpiRow>
            <KpiCard label="SV Done" value={num(f.siteVisits)} sub="Period" color={COLORS.qualified} icon={BuildingOffice2Icon} />
            <KpiCard label="Reached Negotiation" value={num(f.negotiation)} sub={`${r.pct || 0}% of visits`} color={COLORS.negotiation} icon={ChatBubbleLeftRightIcon} />
            <KpiCard label="Avg Visits Before Neg." value={avg} sub="Per negotiation lead" color={COLORS.siteVisit} icon={ScaleIcon} />
          </KpiRow>
          <ChartCard title="Site Visits by Project" subtitle="Visit volume feeding negotiation" chartKey="svneg" registerRef={registerRef}>
            <SimpleBar data={proj} xKey="project_name" bars={[{ key: 'site_visits', name: 'Site Visits', color: COLORS.negotiation }]} />
          </ChartCard>
        </>
      );
    }
    case 'bookingsqft': {
      const rows = d?.bookingsDetail || [];
      const avgSize = num(f.bookings) > 0 ? Math.round(num(f.bookingsSqft) / num(f.bookings)) : 0;
      const totalValue = rows.reduce((a, r) => a + num(r.value), 0);
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Bookings" value={num(f.bookings)} sub="Period" color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Total Area Booked" value={num(f.bookingsSqft).toLocaleString('en-IN')} sub="Sq ft" color={COLORS.qualified} icon={Squares2X2Icon} />
            <KpiCard label="Avg Unit Size" value={avgSize.toLocaleString('en-IN')} sub="Sq ft per booking" color={COLORS.siteVisit} icon={ScaleIcon} />
            <KpiCard label="Booking Value" value={formatCurrency(totalValue)} sub="Sum of net amount" color={COLORS.negotiation} icon={BanknotesIcon} />
          </KpiRow>
          <Card title="Bookings Detail" right={`${rows.length} bookings`}>
            <Table head={['Customer', 'Project', 'Sq Ft', 'Booking Date']} colSpan={4} empty={rows.length === 0}>
              {rows.map((r, i) => (
                <Tr key={i}><Td bold>{r.buyer_name || '—'}</Td><Td color="var(--text-muted)">{r.project_name}</Td>
                  <Td bold>{num(r.sqft).toLocaleString('en-IN')}</Td>
                  <Td color="var(--text-muted)">{fmtDate(r.booking_date)}</Td></Tr>
              ))}
            </Table>
          </Card>
        </>
      );
    }
    case 'cancelratio': {
      const r = d?.cancellationRatio || {};
      const donut = [
        { name: 'Net Bookings', value: Math.max(0, num(f.bookings) - num(f.cancellations)), color: COLORS.booking },
        { name: 'Cancellations', value: num(f.cancellations), color: COLORS.cancelled },
      ];
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Bookings" value={num(f.bookings)} sub="Period" color={COLORS.booking} icon={CheckBadgeIcon} />
            <KpiCard label="Cancellations" value={num(f.cancellations)} sub={`${r.pct || 0}% cancel rate`} color={COLORS.cancelled} icon={XCircleIcon} />
            <KpiCard label="Net Bookings" value={num(f.bookings) - num(f.cancellations)} sub="After cancellations" color={COLORS.qualified} icon={ArrowTrendingUpIcon} />
            <KpiCard label="Cancellation Ratio" value={`${r.pct || 0}%`} sub="Cancelled ÷ Bookings" color={COLORS.siteVisit} icon={ScaleIcon} />
          </KpiRow>
          <ChartCard title="Bookings vs Cancellations" subtitle="Org-wide split" chartKey="cancelDonut" registerRef={registerRef}>
            <FunnelDonut data={donut} />
          </ChartCard>
        </>
      );
    }
    case 'svstatus': {
      const rows = d?.smWiseSiteVisit || [];
      const chart = rows.map((s) => ({ project_name: fullName(s), total: num(s.total_visits), bookings: num(s.bookings), negotiation: num(s.negotiation) }));
      return (
        <>
          <Card title="SM-wise Site Visit Status" right="Per Sales Manager">
            <Table head={['Sales Manager', 'Total SV', 'Bookings', 'Under Nego']} colSpan={4} empty={rows.length === 0}>
              {rows.map((s) => (
                <Tr key={s.id}><Td bold>{fullName(s)}</Td><Td bold>{num(s.total_visits)}</Td><Td bold color={COLORS.booking}>{num(s.bookings)}</Td><Td bold color={COLORS.negotiation}>{num(s.negotiation)}</Td></Tr>
              ))}
            </Table>
          </Card>
          {chart.length > 0 && (
            <ChartCard title="Visits by Sales Manager" subtitle="Total SV · Bookings · Under Nego" chartKey="smSV" registerRef={registerRef}>
              <SimpleBar data={chart} xKey="project_name" bars={[
                { key: 'total', name: 'Total SV', color: COLORS.siteVisit },
                { key: 'bookings', name: 'Bookings', color: COLORS.booking },
                { key: 'negotiation', name: 'Under Nego', color: COLORS.negotiation },
              ]} />
            </ChartCard>
          )}
        </>
      );
    }
    case 'missedfu': {
      const rows = d?.smWiseMissedFollowups || [];
      const chart = rows.map((s) => ({ project_name: fullName(s), missed: num(s.missed) }));
      const worst = rows[0]; const total = rows.reduce((a, s) => a + num(s.missed), 0);
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Missed FUs" value={total} sub="All teams" color={COLORS.cancelled} icon={ExclamationTriangleIcon} />
            <KpiCard label="Worst Team" value={worst ? fullName(worst) : '—'} sub={worst ? `${num(worst.missed)} missed` : ''} color={COLORS.siteVisit} icon={XCircleIcon} />
            <KpiCard label="SMs at Risk" value={rows.filter((s) => num(s.missed) > 0).length} sub="With overdue FUs" color={COLORS.negotiation} icon={UsersIcon} />
          </KpiRow>
          <Card title="Missed Follow-ups by SM">
            <Table head={['Sales Manager', 'Missed FU', 'Risk Level']} colSpan={3} empty={rows.length === 0}>
              {rows.map((s) => { const m = num(s.missed); const tone = m >= 5 ? 'red' : m >= 2 ? 'amber' : 'green'; return (
                <Tr key={s.id}><Td bold>{fullName(s)}</Td><Td bold color={m > 0 ? COLORS.cancelled : undefined}>{m}</Td><Td><Pill tone={tone}>{m >= 5 ? 'High' : m >= 2 ? 'Medium' : 'Low'}</Pill></Td></Tr>
              ); })}
            </Table>
          </Card>
          {chart.length > 0 && (
            <ChartCard title="Missed Follow-ups by SM" chartKey="smMissed" registerRef={registerRef}>
              <SimpleBar data={chart} xKey="project_name" bars={[{ key: 'missed', name: 'Missed', color: COLORS.cancelled }]} />
            </ChartCard>
          )}
        </>
      );
    }
    case 'inventory': {
      const inv = (d?.projectWiseInventory || []).map((p) => ({ project_id: p.project_id, project_name: p.project_name, available: num(p.available), booked: num(p.booked), blocked: num(p.blocked), total: num(p.total_units) }));
      const t = inv.reduce((a, p) => ({ available: a.available + p.available, booked: a.booked + p.booked, blocked: a.blocked + p.blocked, total: a.total + p.total }), { available: 0, booked: 0, blocked: 0, total: 0 });
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Units" value={t.total} sub="All projects" color={COLORS.primary} icon={Squares2X2Icon} />
            <KpiCard label="Available" value={t.available} sub={`${pct(t.available, t.total)}% of stock`} color={COLORS.available} icon={CheckBadgeIcon} />
            <KpiCard label="Booked / Sold" value={t.booked} sub={`${pct(t.booked, t.total)}% sold`} color={COLORS.booked} icon={ArrowTrendingUpIcon} />
            <KpiCard label="Blocked" value={t.blocked} sub="Under negotiation" color={COLORS.blocked} icon={ExclamationTriangleIcon} />
          </KpiRow>
          <ChartCard title="Project-wise Inventory" subtitle="Available / Booked / Blocked" chartKey="projInv" registerRef={registerRef}>
            <SimpleBar data={inv} xKey="project_name" bars={[
              { key: 'available', name: 'Available', color: COLORS.available, stack: 'a' },
              { key: 'booked', name: 'Booked', color: COLORS.booked, stack: 'a' },
              { key: 'blocked', name: 'Blocked', color: COLORS.blocked, stack: 'a' },
            ]} />
          </ChartCard>
          <InventorySummaryTable inv={inv} />
        </>
      );
    }
    case 'funnel': {
      const donut = [
        { name: 'Qualified', value: num(f.qualified), color: COLORS.qualified },
        { name: 'Site Visits', value: num(f.siteVisits), color: COLORS.siteVisit },
        { name: 'Negotiation', value: num(f.negotiation), color: COLORS.negotiation },
        { name: 'Bookings', value: num(f.bookings), color: COLORS.booking },
      ];
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Leads" value={num(f.totalLeads)} color={COLORS.leads} icon={UsersIcon} />
            <KpiCard label="Qualified" value={num(f.qualified)} color={COLORS.qualified} icon={CheckBadgeIcon} />
            <KpiCard label="Site Visits" value={num(f.siteVisits)} color={COLORS.siteVisit} icon={BuildingOffice2Icon} />
            <KpiCard label="Negotiation" value={num(f.negotiation)} color={COLORS.negotiation} icon={ChatBubbleLeftRightIcon} />
            <KpiCard label="Bookings" value={num(f.bookings)} sub={`${num(f.bookingsSqft).toLocaleString('en-IN')} sq ft`} color={COLORS.booking} icon={ArrowTrendingUpIcon} />
          </KpiRow>
          <Card title="Conversion Funnel" sub="Qualified → SV → Negotiation → Booking" registerRef={registerRef} chartKey="funnel">
            <SalesFunnel data={donut} total={num(f.totalLeads)} />
          </Card>
        </>
      );
    }
    case 'revenue': {
      const rows = d?.bookingsDetail || [];
      const totalValue = rows.reduce((a, r) => a + num(r.value), 0);
      const byProject = new Map();
      rows.forEach((r) => {
        const cur = byProject.get(r.project_name) || { project_name: r.project_name, value: 0, count: 0, sqft: 0 };
        cur.value += num(r.value); cur.count += 1; cur.sqft += num(r.sqft); byProject.set(r.project_name, cur);
      });
      const proj = Array.from(byProject.values()).sort((a, b) => b.value - a.value);
      return (
        <>
          <KpiRow>
            <KpiCard label="Total Booking Value" value={formatCurrency(totalValue)} sub="Period" color={COLORS.booking} icon={BanknotesIcon} />
            <KpiCard label="Bookings" value={num(f.bookings)} sub="Closed" color={COLORS.qualified} icon={CheckBadgeIcon} />
            <KpiCard label="Area Booked" value={num(f.bookingsSqft).toLocaleString('en-IN')} sub="Sq ft" color={COLORS.siteVisit} icon={Squares2X2Icon} />
            <KpiCard label="Avg Booking Value" value={rows.length ? formatCurrency(Math.round(totalValue / rows.length)) : '—'} sub="Per booking" color={COLORS.negotiation} icon={ScaleIcon} />
          </KpiRow>
          <Card title="Revenue by Project">
            <Table head={['Project', 'Bookings', 'Sq Ft', 'Booking Value']} colSpan={4} empty={proj.length === 0}>
              {proj.map((p, i) => <Tr key={i}><Td bold>{p.project_name}</Td><Td bold>{p.count}</Td><Td bold>{p.sqft.toLocaleString('en-IN')}</Td><Td bold color={COLORS.booking}>{formatCurrency(p.value)}</Td></Tr>)}
            </Table>
          </Card>
        </>
      );
    }
    default:
      return null;
  }
};

// ── report browser (role sidebar + selected panel) ───────────────────────────
// Shared by the full Analytics dashboard and the per-user drill-down in the
// User Activity detail view. `d` is the getRoleAnalytics payload (optionally
// scoped to one user). orgCalls/orgHourly/registerRef are only needed for the
// org-wide dashboard and export; the embedded user view omits them.
export const ReportBrowser = ({
  role, d, loading, hasData, selected, setSelected,
  orgCalls, orgHourly, registerRef, groups, selfView = false,
  loadingLabel = 'Loading analytics…', emptyLabel = 'No analytics available.',
}) => {
  // `groups` lets a caller show a curated subset of reports (e.g. the self-service
  // portal view, which hides leaderboards / other users' data).
  const grp = groups || ROLES[role].groups;
  const cfg = R[selected] || R[firstKey(role)];
  const Icon = cfg.icon;
  const roleAccent = ROLES[role].accent;

  return (
    <>
      {/* Mobile report picker */}
      <div className="lg:hidden mb-3">
        <label className="reports-filter__label" htmlFor="an-report">Report</label>
        <select id="an-report" className="reports-select mt-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {grp.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.keys.map((k) => <option key={k} value={k}>{R[k].title}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block lg:w-60 lg:flex-shrink-0">
          <div className="crm-card" style={{ padding: 8 }}>
            {grp.map((g) => (
              <div key={g.label} className="mb-1">
                <div className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{g.label}</div>
                {g.keys.map((k) => {
                  const r = R[k]; const RIcon = r.icon; const on = selected === k;
                  return (
                    <button key={k} type="button" onClick={() => setSelected(k)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                      style={on ? { background: 'var(--bg-hover, #f4f4f5)' } : {}}>
                      <span className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                        <RIcon className="w-[15px] h-[15px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                        <span className="block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{r.rs}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Report panel */}
        <main className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 flex items-center justify-center flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[17px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{cfg.title}</div>
              <div className="text-[12.5px] truncate" style={{ color: 'var(--text-muted)' }}>{cfg.sub}</div>
            </div>
          </div>

          {loading && <div className="simple-loader"><div className="simple-spinner" /><p>{loadingLabel}</p></div>}
          {!loading && !hasData && <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>{emptyLabel}</div>}
          {/* Flat/monochrome styling applies to every report view now — the Super
              Admin Analytics + Performance pages and the self-service My Reports all
              render consistently (no accent colours, 500-weight numbers, black
              table headers). */}
          {!loading && hasData && (
            <MonoContext.Provider value={true}>
              <Panel rkey={selected} role={role} d={d} accent={roleAccent} orgCalls={orgCalls} orgHourly={orgHourly} registerRef={registerRef} selfView={selfView} />
            </MonoContext.Provider>
          )}
        </main>
      </div>
    </>
  );
};

// ── main component ─────────────────────────────────────────────────────────────
const AnalyticsDashboard = ({ moduleRole }) => {
  const [role, setRole] = useState(moduleRole && ROLES[moduleRole] ? moduleRole : 'TC');
  const [period, setPeriod] = useState('mtd');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sources, setSources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [roleData, setRoleData] = useState({});
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(() => firstKey(moduleRole && ROLES[moduleRole] ? moduleRole : 'TC'));

  const chartRefs = useRef({});
  const registerRef = (key, el) => { if (el) chartRefs.current[key] = el; };

  // Sync the active module when the URL (sidebar submenu) changes.
  useEffect(() => {
    if (moduleRole && ROLES[moduleRole] && moduleRole !== role) {
      setRole(moduleRole);
      setSelected(firstKey(moduleRole));
    }
  }, [moduleRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try {
        const [sRes, pRes] = await Promise.all([leadSourceApi.getDropdown(), projectApi.getDropdown()]);
        setSources(sRes.data || []); setProjects(pRes.data || []);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    chartRefs.current = {};
    const fetchRole = (rl) => reportApi.getRoleAnalytics({ role: rl, period, from, to, sourceId, projectId }).then((r) => r.data).catch(() => null);
    try {
      if (role === 'ORG') {
        const [tc, sm, sh] = await Promise.all(['TC', 'SM', 'SH'].map(fetchRole));
        setRoleData({ TC: tc, SM: sm, SH: sh });
      } else {
        setRoleData({ [role]: await fetchRole(role) });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load analytics');
      setRoleData({});
    } finally { setLoading(false); }
  }, [role, period, from, to, sourceId, projectId]);

  useEffect(() => { load(); }, [load]);

  const orgCalls = useMemo(() => mergeCallsPerDay(roleData), [roleData]);
  const orgHourly = useMemo(() => mergeHourly(roleData), [roleData]);
  const d = role === 'ORG' ? roleData.SH : roleData[role];
  const hasData = role === 'ORG' ? (roleData.TC || roleData.SM || roleData.SH) : !!roleData[role];

  const chipBase = 'reports-chip';
  const customActive = !!(from || to);

  const doExport = async (kind) => {
    const exportRole = role === 'ORG' ? 'SH' : role;
    const data = roleData[exportRole];
    if (!data) return;
    const meta = { ...(data.meta || {}), role: exportRole, roleLabel: ROLES[role].label, period, from, to };
    setExporting(true);
    try {
      if (kind === 'data') await exportPlainData(data, meta);
      else await exportAnalytics(data, meta, chartRefs.current);
      toast.success('Export ready');
    } catch (err) {
      console.error('[Analytics export] failed:', err);
      toast.error(`Export failed: ${err?.message || 'unknown error'}`);
    } finally { setExporting(false); }
  };

  return (
    <div>
      {/* Filter bar — period quick-picks always visible; the rest collapses into an accordion */}
      <div className="reports-filter-bar reports-filter-bar--card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide mr-1" style={{ color: 'var(--text-muted)' }}>Period</span>
          {PERIODS.map((p) => {
            const active = !from && !to && period === p.key;
            return (
              <button key={p.key} type="button" onClick={() => { setFrom(''); setTo(''); setPeriod(p.key); }}
                className={`${chipBase} ${active ? 'reports-chip--active' : ''}`}>
                {p.label}
              </button>
            );
          })}
          {/* Custom date range — opens the accordion to pick From / To */}
          <button type="button" onClick={() => setFiltersOpen(true)} className={`${chipBase} ${customActive ? 'reports-chip--active' : ''}`}>
            Custom
          </button>
          {/* Accordion toggle for the remaining filters + actions */}
          <button type="button" onClick={() => setFiltersOpen((o) => !o)}
            className={`${chipBase} ml-auto`} aria-expanded={filtersOpen}>
            <FunnelIcon className="w-3.5 h-3.5" /> Filters
            <ChevronDownIcon className="w-3.5 h-3.5 transition-transform" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-3 pt-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
            <div className="reports-filter" style={{ flex: '1 1 130px' }}>
              <label className="reports-filter__label" htmlFor="an-from">From</label>
              <input id="an-from" type="date" className="reports-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="reports-filter" style={{ flex: '1 1 130px' }}>
              <label className="reports-filter__label" htmlFor="an-to">To</label>
              <input id="an-to" type="date" className="reports-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {role === 'TC' && (
              <div className="reports-filter" style={{ flex: '1 1 150px' }}>
                <label className="reports-filter__label" htmlFor="an-source">Source</label>
                <select id="an-source" className="reports-select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="">All Sources</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
                </select>
              </div>
            )}
            <div className="reports-filter" style={{ flex: '1 1 150px' }}>
              <label className="reports-filter__label" htmlFor="an-project">Project</label>
              <select id="an-project" className="reports-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">All Projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
            <div className="reports-filter-actions">
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
                <ArrowPathIcon style={{ width: 14, height: 14 }} /> {loading ? 'Loading…' : 'Refresh'}
              </button>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => doExport('data')} disabled={!hasData || exporting}>
                <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> Export Data
              </button>
              <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => doExport('analytics')} disabled={!hasData || exporting}>
                <PresentationChartLineIcon style={{ width: 14, height: 14 }} /> {exporting ? 'Building…' : 'Export Analytics'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ReportBrowser
        role={role} d={d} loading={loading} hasData={hasData}
        selected={selected} setSelected={setSelected}
        orgCalls={orgCalls} orgHourly={orgHourly} registerRef={registerRef}
      />
    </div>
  );
};

export default AnalyticsDashboard;
