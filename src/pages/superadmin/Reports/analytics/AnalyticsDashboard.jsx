import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, ArrowDownTrayIcon, PresentationChartLineIcon,
} from '@heroicons/react/24/outline';
import reportApi from '../../../../api/reportApi';
import leadSourceApi from '../../../../api/leadSourceApi';
import projectApi from '../../../../api/projectApi';
import { COLORS } from './palette';
import {
  ChartCard, HourlyCallsBar, CallsPerDayLine, SimpleBar, FunnelDonut,
} from './charts/Charts';
import { exportPlainData, exportAnalytics } from './exportExcel';

const ROLE_TABS = [
  { code: 'TC', label: 'Tele Sales' },
  { code: 'SM', label: 'Sales Manager' },
  { code: 'SH', label: 'Sales Head' },
];
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week' },
  { key: 'mtd', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

const num = (v) => Number(v) || 0;
const fullName = (r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—';
const th = { padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' };

const KpiCard = ({ label, value, color, sub }) => (
  <div className="crm-card" style={{ padding: '12px 14px', borderLeft: `4px solid ${color}`, minWidth: 130, flex: '1 1 130px' }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
  </div>
);

const RatioCard = ({ label, data, color }) => {
  if (!data) return null;
  return (
    <div className="crm-card" style={{ padding: '12px 14px', minWidth: 180, flex: '1 1 180px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{data.numerator} : {data.denominator}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{data.pct}% conversion</div>
    </div>
  );
};

const LeaderboardTable = ({ title, rows, registerRef, chartKey }) => (
  <div className="crm-card" ref={registerRef ? (el) => registerRef(chartKey, el) : undefined} style={{ padding: 16, overflowX: 'auto' }}>
    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</div>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
      <thead><tr>
        <th style={th}>#</th><th style={th}>Name</th><th style={th}>Leads</th><th style={th}>Qualified</th>
        <th style={th}>Site Visits</th><th style={th}>Bookings</th><th style={th}>Calls</th><th style={th}>Answered</th>
      </tr></thead>
      <tbody>
        {(rows || []).map((r, i) => (
          <tr key={r.id}>
            <td style={{ ...td, color: 'var(--text-muted)' }}>{i + 1}</td>
            <td style={{ ...td, fontWeight: 600 }}>{fullName(r)}</td>
            <td style={td}>{num(r.leads)}</td>
            <td style={td}>{num(r.qualified)}</td>
            <td style={{ ...td, fontWeight: 700, color: COLORS.siteVisit }}>{num(r.site_visits)}</td>
            <td style={{ ...td, fontWeight: 700, color: COLORS.booking }}>{num(r.bookings)}</td>
            <td style={td}>{num(r.calls)}</td>
            <td style={td}>{num(r.calls_answered)}</td>
          </tr>
        ))}
        {(!rows || rows.length === 0) && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>No data</td></tr>}
      </tbody>
    </table>
  </div>
);

const AnalyticsDashboard = () => {
  const [role, setRole] = useState('TC');
  const [period, setPeriod] = useState('mtd');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sources, setSources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const chartRefs = useRef({});
  const registerRef = (key, el) => { if (el) chartRefs.current[key] = el; };

  useEffect(() => {
    (async () => {
      try {
        const [sRes, pRes] = await Promise.all([leadSourceApi.getDropdown(), projectApi.getDropdown()]);
        setSources(sRes.data || []);
        setProjects(pRes.data || []);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.getRoleAnalytics({ role, period, from, to, sourceId, projectId });
      setData(res.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load analytics');
      setData(null);
    } finally { setLoading(false); }
  }, [role, period, from, to, sourceId, projectId]);

  useEffect(() => { load(); }, [load]);

  const roleLabel = ROLE_TABS.find((r) => r.code === role)?.label || role;
  const meta = data ? { ...data.meta, roleLabel } : { role, roleLabel, period, from, to };

  const doExport = async (kind) => {
    if (!data) return;
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

  // Normalised chart datasets
  const hourly = (data?.hourlyCalls || []).map((h) => ({ hour: h.hour, answered: num(h.answered), unanswered: num(h.unanswered) }));
  const perDay = (data?.callsPerDay || []).map((d) => ({ day: d.day, answered: num(d.answered), unanswered: num(d.unanswered), total: num(d.total) }));
  const projSV = (data?.projectWiseSiteVisit || []).map((p) => ({ project_name: p.project_name, site_visits: num(p.site_visits) }));
  const projInv = (data?.projectWiseInventory || []).map((p) => ({ project_name: p.project_name, available: num(p.available), booked: num(p.booked), blocked: num(p.blocked) }));
  const smSV = (data?.smWiseSiteVisit || []).map((s) => ({ project_name: fullName(s), total_visits: num(s.total_visits), completed: num(s.completed) }));
  const smMissed = (data?.smWiseMissedFollowups || []).map((s) => ({ project_name: fullName(s), missed: num(s.missed) }));
  const funnelDonut = data ? [
    { name: 'Qualified', value: num(data.funnel.qualified), color: COLORS.qualified },
    { name: 'Site Visits', value: num(data.funnel.siteVisits), color: COLORS.siteVisit },
    { name: 'Negotiation', value: num(data.funnel.negotiation), color: COLORS.negotiation },
    { name: 'Bookings', value: num(data.funnel.bookings), color: COLORS.booking },
  ] : [];

  const selStyle = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

  return (
    <div>
      {/* Role sub-tabs */}
      <div className="crm-btn-group" style={{ marginBottom: 12 }}>
        {ROLE_TABS.map((r) => (
          <button key={r.code} className={`crm-btn ${role === r.code ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setRole(r.code)}>{r.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="crm-card" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="crm-btn-group">
          {PERIODS.map((p) => (
            <button key={p.key} className={`crm-btn crm-btn-sm ${period === p.key && !from && !to ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => { setFrom(''); setTo(''); setPeriod(p.key); }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>FROM</label>
          <input type="date" style={selStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>TO</label>
          <input type="date" style={selStyle} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {role === 'TC' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>SOURCE</label>
            <select style={selStyle} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">All Sources</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>PROJECT</label>
          <select style={selStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
        </div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
          <ArrowPathIcon style={{ width: 14, height: 14 }} /> {loading ? 'Loading…' : 'Refresh'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => doExport('data')} disabled={!data || exporting}>
            <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> Export Data
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => doExport('analytics')} disabled={!data || exporting}>
            <PresentationChartLineIcon style={{ width: 14, height: 14 }} /> {exporting ? 'Building…' : 'Export Analytics'}
          </button>
        </div>
      </div>

      {loading && <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics…</div>}

      {!loading && data && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <KpiCard label="Total Leads" value={num(data.funnel.totalLeads)} color={COLORS.leads} />
            <KpiCard label="Qualified" value={num(data.funnel.qualified)} color={COLORS.qualified} />
            <KpiCard label="Site Visits" value={num(data.funnel.siteVisits)} color={COLORS.siteVisit} />
            <KpiCard label="Negotiation" value={num(data.funnel.negotiation)} color={COLORS.negotiation} />
            <KpiCard label="Bookings" value={num(data.funnel.bookings)} color={COLORS.booking} sub={`${num(data.funnel.bookingsSqft).toLocaleString('en-IN')} sq ft`} />
            <KpiCard label="Cancellations" value={num(data.funnel.cancellations)} color={COLORS.cancelled} />
          </div>

          {/* Ratio cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <RatioCard label="Qualification Ratio" data={data.qualificationRatio} color={COLORS.qualified} />
            <RatioCard label="Site Visit Ratio" data={data.siteVisitRatio} color={COLORS.siteVisit} />
            <RatioCard label="Booking Ratio (SV:Book)" data={data.bookingRatio} color={COLORS.booking} />
            <RatioCard label="Negotiation Ratio" data={data.negotiationRatio} color={COLORS.negotiation} />
            <RatioCard label="Cancellation Ratio" data={data.cancellationRatio} color={COLORS.cancelled} />
          </div>

          {/* Charts grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14, marginBottom: 14 }}>
            <ChartCard title="Hour-wise Calls" subtitle="Answered vs unanswered by hour" chartKey="hourly" registerRef={registerRef}>
              <HourlyCallsBar data={hourly} />
            </ChartCard>
            <ChartCard title="Calls Per Day" subtitle="Daily call volume" chartKey="perDay" registerRef={registerRef}>
              <CallsPerDayLine data={perDay} />
            </ChartCard>
            <ChartCard title="Conversion Funnel" subtitle="Qualified → SV → Negotiation → Booking" chartKey="funnel" registerRef={registerRef}>
              <FunnelDonut data={funnelDonut} />
            </ChartCard>
            {role === 'TC' && (
              <ChartCard title="Project-wise Site Visits" chartKey="projSV" registerRef={registerRef}>
                <SimpleBar data={projSV} xKey="project_name" bars={[{ key: 'site_visits', name: 'Site Visits', color: COLORS.siteVisit }]} />
              </ChartCard>
            )}
            {(role === 'SM' || role === 'SH') && (
              <ChartCard title="Project-wise Inventory" subtitle="Available / Booked / Blocked" chartKey="projInv" registerRef={registerRef}>
                <SimpleBar data={projInv} xKey="project_name" bars={[
                  { key: 'available', name: 'Available', color: COLORS.available, stack: 'a' },
                  { key: 'booked', name: 'Booked', color: COLORS.booked, stack: 'a' },
                  { key: 'blocked', name: 'Blocked', color: COLORS.blocked, stack: 'a' },
                ]} />
              </ChartCard>
            )}
            {role === 'SH' && (
              <ChartCard title="SM-wise Site Visits" chartKey="smSV" registerRef={registerRef}>
                <SimpleBar data={smSV} xKey="project_name" bars={[
                  { key: 'total_visits', name: 'Total', color: COLORS.muted, stack: 'a' },
                  { key: 'completed', name: 'Completed', color: COLORS.siteVisit, stack: 'a' },
                ]} />
              </ChartCard>
            )}
            {role === 'SH' && (
              <ChartCard title="SM-wise Missed Follow-ups" chartKey="smMissed" registerRef={registerRef}>
                <SimpleBar data={smMissed} xKey="project_name" bars={[{ key: 'missed', name: 'Missed', color: COLORS.cancelled }]} />
              </ChartCard>
            )}
          </div>

          {/* Leaderboards */}
          <div style={{ display: 'grid', gap: 14 }}>
            <LeaderboardTable
              title={role === 'TC' ? 'Tele Sales Leaderboard' : 'Sales Team Leaderboard'}
              rows={data.teamLeaderboard}
              registerRef={registerRef}
              chartKey="leaderboard"
            />
            {role === 'SH' && data.salesHeadLeaderboard && (
              <LeaderboardTable title="Sales Head Leaderboard" rows={data.salesHeadLeaderboard} registerRef={registerRef} chartKey="shLeaderboard" />
            )}
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No analytics available.</div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
