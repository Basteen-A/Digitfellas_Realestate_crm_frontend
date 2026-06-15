import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { COLORS, SERIES } from '../palette';

// Card shell that registers its DOM node into a refs map so the Excel export
// can capture it as an image. `chartKey` is the capture id.
export const ChartCard = ({ title, subtitle, chartKey, registerRef, height = 280, children, right }) => (
  <div
    className="crm-card"
    ref={registerRef ? (el) => registerRef(chartKey, el) : undefined}
    style={{ padding: 16, display: 'flex', flexDirection: 'column', minWidth: 0 }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
    <div style={{ width: '100%', height }}>{children}</div>
  </div>
);

export const HourlyCallsBar = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
      <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} fontSize={11} interval={1} />
      <YAxis fontSize={11} allowDecimals={false} />
      <Tooltip labelFormatter={(h) => `${h}:00 – ${h}:59`} />
      <Legend />
      <Bar dataKey="answered" name="Answered" stackId="a" fill={COLORS.answered} radius={[0, 0, 0, 0]} />
      <Bar dataKey="unanswered" name="Unanswered" stackId="a" fill={COLORS.unanswered} radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export const CallsPerDayLine = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="day" fontSize={11} />
      <YAxis fontSize={11} allowDecimals={false} />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="answered" name="Answered" stroke={COLORS.answered} strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="unanswered" name="Unanswered" stroke={COLORS.unanswered} strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="total" name="Total" stroke={COLORS.primary} strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

// Generic horizontal/vertical bar for project-wise breakdowns
export const SimpleBar = ({ data, xKey, bars }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
      <XAxis dataKey={xKey} fontSize={10} angle={-30} textAnchor="end" interval={0} height={60} />
      <YAxis fontSize={11} allowDecimals={false} />
      <Tooltip />
      {bars.length > 1 && <Legend />}
      {bars.map((b, i) => (
        <Bar key={b.key} dataKey={b.key} name={b.name} stackId={b.stack} fill={b.color || SERIES[i % SERIES.length]} radius={[3, 3, 0, 0]} />
      ))}
    </BarChart>
  </ResponsiveContainer>
);

export const FunnelDonut = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
        {data.map((entry, i) => <Cell key={entry.name} fill={entry.color || SERIES[i % SERIES.length]} />)}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  </ResponsiveContainer>
);
