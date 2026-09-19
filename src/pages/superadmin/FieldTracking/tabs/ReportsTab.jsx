import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowDownTrayIcon, ChartBarIcon, ArrowPathIcon, MapPinIcon,
  UsersIcon, BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import { exportFieldTrackingReport } from '../exportExcel';
import {
  th, td, inputStyle, btn, StatCard, statRow, Chip, EmptyState, Spinner,
  BarRow, ReportCard, NEGATIVE_REASON_LABEL,
  fmtTime, todayStr, daysAgoStr,
} from '../ui';

// ============================================================
// Reports - per-user attendance and movement over a date range, plus the
// stop-by-stop detail, and one Excel download holding both.
//
// Everything on screen comes from track_sessions, which the worker has already
// aggregated. No report here walks the raw GPS table.
// ============================================================

/**
 * The five breakdowns, as bar cards.
 *
 * Each card scales its bars against its OWN top row, not a global maximum:
 * "who did the most visits" and "who drove the furthest" are different
 * questions and sharing a scale would flatten one of them into nothing.
 *
 * Capped at eight rows per card. This is a glance, not a ledger - the full
 * detail lives one tab over on Customer Visits, and in the Excel download.
 */
const TOP_N = 8;

const AnalyticsPanel = ({ data, loading }) => {
  if (loading && !data) return <Spinner label="Running analytics..." />;

  const t = data?.totals;
  const perUser = (data?.perUser || []).slice(0, TOP_N);
  const perProject = (data?.perProject || []).slice(0, TOP_N);
  const reasons = (data?.negativeReasons || []).slice(0, TOP_N);
  const distance = (data?.distanceLeaderboard || []).slice(0, TOP_N);
  // Conversion is ranked separately from volume - the busiest rep is rarely
  // the one who converts best, and that gap is the point of the card.
  const conversion = [...(data?.perUser || [])]
    .filter((r) => r.visits > 0)
    .sort((a, b) => b.conversionPct - a.conversionPct)
    .slice(0, TOP_N);

  if (!t || !t.visits) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
        <EmptyState
          icon={ChartBarIcon}
          title="No completed visits in this range"
          hint="Analytics counts COMPLETED visits only - an open visit has no outcome to report yet."
        />
      </div>
    );
  }

  const pct = (n) => (t.visits ? Math.round((n / t.visits) * 100) : 0);

  return (
    <div>
      <div style={{ ...statRow, marginBottom: 16 }}>
        <StatCard label="Total Visits" value={t.visits} />
        <StatCard label="Positive" value={t.positive} sub={`${pct(t.positive)}%`} />
        <StatCard label="Negative" value={t.negative} sub={`${pct(t.negative)}%`} />
        <StatCard label="Revisit" value={t.revisit} />
        <StatCard label="Booked" value={t.booked} sub={`${t.conversionPct}% of visits`} />
        <StatCard label="Nobody There" value={t.notAvailable} />
        <StatCard label="Total Distance" value={t.distanceLabel} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <ReportCard icon={UsersIcon} title="Visits per agent">
          {perUser.map((r) => (
            <BarRow key={r.userId} label={r.name} value={r.visits} max={perUser[0]?.visits || 0} />
          ))}
        </ReportCard>

        <ReportCard
          icon={ChartBarIcon}
          title="Conversion per agent"
          hint="Booked visits as a share of that agent's completed visits."
        >
          {conversion.map((r) => (
            <BarRow
              key={r.userId}
              label={r.name}
              value={r.conversionPct}
              suffix="%"
              max={conversion[0]?.conversionPct || 0}
              color="#16a34a"
            />
          ))}
        </ReportCard>

        <ReportCard
          icon={ChartBarIcon}
          title="Negative visit reasons"
          hint="Only set on a NEGATIVE outcome - the reason is cleared whenever the outcome changes."
        >
          {!reasons.length ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No negative visits in this range.</div>
          ) : reasons.map((r) => (
            <BarRow
              key={r.reason}
              label={NEGATIVE_REASON_LABEL[r.reason] || r.reason}
              value={r.visits}
              max={reasons[0]?.visits || 0}
              color="#dc2626"
            />
          ))}
        </ReportCard>

        <ReportCard icon={BuildingOffice2Icon} title="Visits per project">
          {perProject.map((r) => (
            <BarRow key={r.projectId || 'none'} label={r.name} value={r.visits} max={perProject[0]?.visits || 0} />
          ))}
        </ReportCard>

        <ReportCard icon={MapPinIcon} title="Distance leaderboard">
          {distance.map((r) => (
            <BarRow
              key={r.userId}
              label={r.name}
              value={r.distanceLabel}
              amount={r.distanceM}
              max={distance[0]?.distanceM || 0}
              color="#625afa"
            />
          ))}
        </ReportCard>
      </div>
    </div>
  );
};

const ReportsTab = ({ config }) => {
  const { user } = useSelector((state) => state.auth);
  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());
  const [role, setRole] = useState('');
  const [view, setView] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [halts, setHalts] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { from, to, ...(role ? { role } : {}) };
      if (view === 'summary') {
        const resp = await fieldTrackingApi.getSummaryReport(params);
        setSummary(resp.data || null);
      } else if (view === 'analytics') {
        const resp = await fieldTrackingApi.getVisitAnalytics(params);
        setAnalytics(resp.data || null);
      } else {
        const resp = await fieldTrackingApi.getHaltReport({ ...params, min_minutes: 10 });
        setHalts(resp.data || null);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the report'));
    } finally {
      setLoading(false);
    }
  }, [from, to, role, view]);

  useEffect(() => { load(); }, [load]);

  const download = async () => {
    setExporting(true);
    try {
      const params = { from, to, ...(role ? { role } : {}) };
      // Both sheets come from one download, so fetch whichever half is missing.
      const [s, h, vz] = await Promise.all([
        summary && view === 'summary' ? Promise.resolve({ data: summary }) : fieldTrackingApi.getSummaryReport(params),
        fieldTrackingApi.getHaltReport({ ...params, min_minutes: 10 }),
        // Visits ride along so one download answers both "where were they"
        // and "who did they meet". Non-fatal if it fails.
        fieldTrackingApi.getVisitReport(params).catch(() => ({ data: null })),
      ]);
      await exportFieldTrackingReport(s.data, h.data, {
        from,
        to,
        role: role ? (config?.roles || []).find((r) => r.code === role)?.name : null,
        generatedBy: user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
      }, vz?.data);
      toast.success('Report downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const t = summary?.totals;

  return (
    <div>
      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>FROM</div>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, width: 155 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>TO</div>
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: 155 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 180 }}>
            <option value="">All tracked roles</option>
            {(config?.roles || [])
              .filter((r) => (config?.enabledRoles || []).includes(r.code))
              .map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>REPORT</div>
          <select value={view} onChange={(e) => setView(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="summary">Attendance &amp; distance</option>
            <option value="analytics">Visit analytics</option>
            <option value="halts">Stops detail</option>
          </select>
        </div>
        <button type="button" onClick={load} style={btn()} disabled={loading}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Run
        </button>
        <button type="button" onClick={download} style={btn('primary')} disabled={exporting}>
          <ArrowDownTrayIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          {exporting ? 'Preparing…' : 'Download Excel'}
        </button>
      </div>

      {/* ── Totals ── */}
      {view === 'summary' && t ? (
        <div style={{ ...statRow, marginBottom: 16 }}>
          <StatCard label="Users" value={t.users} />
          <StatCard label="Present Days" value={t.present} />
          <StatCard label="Half Days" value={t.halfDay} />
          <StatCard label="Absent Days" value={t.absent} />
          <StatCard label="Payable Days" value={t.payableDays} sub="present + ½ × half" />
          <StatCard label="Total Worked" value={t.totalWorkedLabel} />
          <StatCard label="Travel Time" value={t.totalTravelLabel} />
          <StatCard label="Distance" value={t.totalDistanceLabel} />
        </div>
      ) : null}

      {/* -- Visit analytics -- */}
      {view === 'analytics' ? (
        <AnalyticsPanel data={analytics} loading={loading} />
      ) : null}

      {/* ── Table ── */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'hidden',
        display: view === 'analytics' ? 'none' : undefined,
      }}
      >
        {loading ? <Spinner label="Running report…" /> : null}

        {!loading && view === 'summary' ? (
          !summary?.rows?.length ? (
            <EmptyState icon={ChartBarIcon} title="No data for this range" hint="Nobody in the selected roles has tracked days between these dates." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
                <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                  <tr>
                    <th style={th}>Employee</th>
                    <th style={th}>Present</th>
                    <th style={th}>Half</th>
                    <th style={th}>Absent</th>
                    <th style={th}>Week Off</th>
                    <th style={th}>Late</th>
                    <th style={th}>Payable</th>
                    <th style={th}>Worked</th>
                    <th style={th}>Avg/Day</th>
                    <th style={th}>Travel</th>
                    <th style={th}>Distance</th>
                    <th style={th}>Stops</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.user.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.user.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          <Chip>{r.user.role}</Chip>{r.user.employeeCode ? ` ${r.user.employeeCode}` : ''}
                        </div>
                      </td>
                      <td style={{ ...td, fontWeight: 600, color: '#16a34a' }}>{r.present}</td>
                      <td style={{ ...td, color: '#d97706' }}>{r.halfDay}</td>
                      <td style={{ ...td, color: r.absent ? '#dc2626' : 'var(--text-muted)' }}>{r.absent}</td>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{r.weekOff}</td>
                      <td style={td}>{r.late}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{r.payableDays}</td>
                      <td style={td}>{r.workedLabel}</td>
                      <td style={td}>{r.avgWorkedLabel}</td>
                      <td style={td}>{r.travelLabel}</td>
                      <td style={td}>
                        {r.distanceLabel}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.avgDistanceLabel}/day</div>
                      </td>
                      <td style={td}>{r.haltCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {!loading && view === 'halts' ? (
          !halts?.rows?.length ? (
            <EmptyState icon={MapPinIcon} title="No stops in this range" hint="Stops of 10 minutes or more appear here once GPS tracking has been running." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Employee</th>
                    <th style={th}>Place</th>
                    <th style={th}>From</th>
                    <th style={th}>To</th>
                    <th style={th}>Stopped</th>
                    <th style={th}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {halts.rows.map((h) => (
                    <tr key={h.id}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{h.workDate}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{h.user.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}><Chip>{h.user.role}</Chip></div>
                      </td>
                      <td style={td}>
                        <div>{h.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
                        </div>
                      </td>
                      <td style={td}>{fmtTime(h.startedAt)}</td>
                      <td style={td}>{fmtTime(h.endedAt)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{h.durationLabel}</td>
                      <td style={td}><Chip>{h.haltType}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {halts.rows.length >= 5000 ? (
                <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-primary)' }}>
                  Showing the most recent 5,000 stops. Narrow the date range or the role to see more.
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.6, maxWidth: 780 }}>
        <b style={{ color: 'var(--text-secondary)' }}>Reading these numbers:</b> distance is straight-line
        between GPS points, so it reads slightly under a vehicle odometer. Travel time is the punched-in
        day minus time spent stationary at a stop. Present / half day is decided by the shift policy that
        was in force <b>on that day</b> - editing a policy now does not re-grade past days.
      </div>
    </div>
  );
};

export default ReportsTab;
