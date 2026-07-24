import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, Line, Area, ComposedChart,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, Label,
} from 'recharts';
import { COLORS, SERIES } from '../palette';

// ── responsive helper ─────────────────────────────────────────────────────────
// The SA opens these reports on phones too, so charts shed chrome (rotated
// labels, wide gutters, tall canvases) below this breakpoint.
const useIsMobile = (bp = 640) => {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    if (mq.addEventListener) { mq.addEventListener('change', onChange); return () => mq.removeEventListener('change', onChange); }
    mq.addListener(onChange); return () => mq.removeListener(onChange);
  }, [bp]);
  return mobile;
};

const GRID = 'var(--border-primary, #e5e7eb)';
const axisTick = { fontSize: 11, fill: 'var(--text-muted, #64748b)' };
const num = (v) => (v == null || v === 0 ? '' : v);
const hourTip = (h) => `${h}:00 – ${h}:59`;
const fmtDay = (d) => {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// Shared, theme-aware tooltip — replaces recharts' default white box so every
// chart reads consistently and respects dark mode.
const ChartTooltip = ({ active, payload, label, labelFormatter, total }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card, #fff)', border: `1px solid ${GRID}`, borderRadius: 8,
      boxShadow: '0 6px 20px rgba(15,23,42,0.14)', padding: '8px 10px', fontSize: 12, minWidth: 120,
    }}>
      {(label != null && label !== '') && (
        <div style={{ fontWeight: 700, marginBottom: 5, color: 'var(--text-primary, #0f172a)' }}>
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((p) => {
        const v = Number(p.value) || 0;
        return (
          <div key={p.dataKey || p.name} style={{ display: 'flex', alignItems: 'center', gap: 7, lineHeight: '18px', color: 'var(--text-secondary, #475569)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color || p.fill, flexShrink: 0 }} />
            <span style={{ flex: 1, paddingRight: 10 }}>{p.name}</span>
            <strong style={{ color: 'var(--text-primary, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
              {v.toLocaleString('en-IN')}{total ? ` · ${Math.round((v / total) * 100)}%` : ''}
            </strong>
          </div>
        );
      })}
    </div>
  );
};

const legendProps = { wrapperStyle: { fontSize: 12, paddingTop: 4 }, iconType: 'circle', iconSize: 8 };

// Card shell that registers its DOM node into a refs map so the Excel export
// can capture it as an image. `chartKey` is the capture id. Height is
// viewport-aware so charts stay legible (not squashed) on phones.
export const ChartCard = ({ title, subtitle, chartKey, registerRef, height, children, right }) => {
  const isMobile = useIsMobile();
  const h = height || (isMobile ? 230 : 280);
  return (
    <div
      className="crm-card"
      ref={registerRef ? (el) => registerRef(chartKey, el) : undefined}
      style={{ padding: 16, display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ width: '100%', height: h }}>{children}</div>
    </div>
  );
};

export const HourlyCallsBar = ({ data }) => {
  const isMobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: isMobile ? -20 : -10, bottom: 0 }} barCategoryGap={isMobile ? '14%' : '22%'}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
        <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={axisTick} interval={isMobile ? 3 : 1} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={axisTick} allowDecimals={false} width={32} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(24,24,27,0.05)' }} content={<ChartTooltip labelFormatter={hourTip} />} />
        <Legend {...legendProps} />
        <Bar dataKey="answered" name="Answered" stackId="a" fill={COLORS.answered} maxBarSize={46} />
        <Bar dataKey="unanswered" name="Unanswered" stackId="a" fill={COLORS.unanswered} radius={[4, 4, 0, 0]} maxBarSize={46} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const CallsPerDayLine = ({ data }) => {
  const isMobile = useIsMobile();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: isMobile ? -20 : -10, bottom: 0 }}>
        <defs>
          <linearGradient id="callsTotalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.18} />
            <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
        <XAxis dataKey="day" tickFormatter={fmtDay} tick={axisTick} interval="preserveStartEnd" minTickGap={isMobile ? 24 : 12} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={axisTick} allowDecimals={false} width={32} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip labelFormatter={fmtDay} />} />
        <Legend {...legendProps} />
        <Area type="monotone" dataKey="total" name="Total" stroke="none" fill="url(#callsTotalFill)" />
        <Line type="monotone" dataKey="total" name="Total" stroke={COLORS.primary} strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="answered" name="Answered" stroke={COLORS.answered} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="unanswered" name="Unanswered" stroke={COLORS.unanswered} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// Generic bar for project / member breakdowns. Single-series bars get value
// labels on top; rotated x labels collapse gracefully on phones.
export const SimpleBar = ({ data, xKey, bars }) => {
  const isMobile = useIsMobile();
  const single = bars.length === 1;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: single ? 18 : 8, right: 8, left: isMobile ? -20 : -10, bottom: 44 }} barCategoryGap={isMobile ? '12%' : '20%'}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={{ ...axisTick, fontSize: isMobile ? 9 : 10 }} angle={-30} textAnchor="end" interval={0} height={60} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={axisTick} allowDecimals={false} width={32} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(24,24,27,0.05)' }} content={<ChartTooltip />} />
        {!single && <Legend {...legendProps} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} stackId={b.stack} fill={b.color || SERIES[i % SERIES.length]} radius={[3, 3, 0, 0]} maxBarSize={isMobile ? 40 : 56} minPointSize={2}>
            {single && !isMobile && <LabelList dataKey={b.key} position="top" formatter={num} style={{ fontSize: 10, fill: 'var(--text-muted, #64748b)', fontWeight: 600 }} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export const FunnelDonut = ({ data }) => {
  const total = data.reduce((a, d) => a + (Number(d.value) || 0), 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="var(--bg-card, #fff)" strokeWidth={2}>
          {data.map((entry, i) => <Cell key={entry.name} fill={entry.color || SERIES[i % SERIES.length]} />)}
          <Label
            position="center"
            content={({ viewBox }) => {
              const { cx, cy } = viewBox || {};
              if (cx == null) return null;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                  <tspan x={cx} dy="-0.35em" style={{ fontSize: 22, fontWeight: 800, fill: 'var(--text-primary, #0f172a)' }}>{total.toLocaleString('en-IN')}</tspan>
                  <tspan x={cx} dy="1.5em" style={{ fontSize: 11, fill: 'var(--text-muted, #64748b)' }}>Total</tspan>
                </text>
              );
            }}
          />
        </Pie>
        <Tooltip content={<ChartTooltip total={total} />} />
        <Legend {...legendProps} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// Proper sales funnel (descending trapezoids) with the stage name, count and
// % of the top stage labelled inside each band — the Qualified → Site Visit →
// Negotiation → Booking flow reads as a real conversion funnel.
export const SalesFunnel = ({ data, total }) => {
  const isMobile = useIsMobile();
  const num = (v) => Number(v) || 0;
  const top = num(data?.[0]?.value) || 0;
  const maxVal = Math.max(1, ...data.map((d) => num(d.value)));
  const widths = data.map((d) => {
    const ratio = num(d.value) / maxVal;
    return 35 + ratio * 65; // range: 35% → 100%
  });
  widths[0] = 100;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: isMobile ? '12px 8px' : '16px 12px 12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 480 }}>
        {total != null && (
          <>
            <div
              style={{
                width: '100%',
                background: COLORS.leads,
                padding: isMobile ? '10px 0' : '14px 0',
                textAlign: 'center',
                borderRadius: '6px 6px 0 0',
              }}
            >
              <div style={{ color: '#fff', fontWeight: 700, fontSize: isMobile ? 11 : 13 }}>Total Leads</div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: isMobile ? 14 : 18, marginTop: 1 }}>
                {num(total).toLocaleString('en-IN')}
              </div>
            </div>
            {data.length > 0 && (
              <div style={{ textAlign: 'center', fontSize: isMobile ? 10 : 11, padding: '3px 0', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                ▼ {num(total) > 0 ? Math.round((num(data[0].value) / num(total)) * 100) : 0}%
              </div>
            )}
          </>
        )}
        {data.map((entry, i) => {
          const topW = widths[i];
          const botW = i < data.length - 1 ? widths[i + 1] : topW * 0.82;
          const topInset = (100 - topW) / 2;
          const botInset = (100 - botW) / 2;
          const v = num(entry.value);
          return (
            <React.Fragment key={entry.name}>
              <div
                style={{
                  width: '100%',
                  clipPath: `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - botInset}% 100%, ${botInset}% 100%)`,
                  background: entry.color || '#27272a',
                  padding: isMobile ? '10px 0' : '14px 0',
                  textAlign: 'center',
                  transition: 'clip-path 0.3s ease',
                }}
              >
                <div style={{ color: '#fff', fontWeight: 700, fontSize: isMobile ? 11 : 13 }}>{entry.name}</div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: isMobile ? 14 : 18, marginTop: 1 }}>
                  {v.toLocaleString('en-IN')}
                </div>
              </div>
              {i < data.length - 1 && (
                <div style={{ textAlign: 'center', fontSize: isMobile ? 10 : 11, padding: '3px 0', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                  ▼ {top > 0 ? Math.round((num(data[i + 1].value) / v) * 100) : 0}%
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

