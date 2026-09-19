import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import {
  th, td, inputStyle, btn, StatCard, statRow, Chip, EmptyState, Spinner,
  PlanStatusChip, VISIT_OUTCOME_STYLE, fmtTime, todayStr,
} from '../ui';

// ============================================================
// Beat plan - what the team was supposed to visit, and whether they did.
//
// These rows are NOT a table of this module's own: they are the sales
// pipeline's scheduled site visits (`site_visits`), read through
// GET /field-tracking/plans. The desk already schedules a visit against a lead
// and a project, and a second planning table would disagree with itself inside
// a week.
//
// Completion is DERIVED, never stamped: a plan counts as done when a field
// visit was logged against it (track_visits.site_visit_id), or when the desk
// itself marked the site visit Completed. Nothing on this screen writes back
// into the sales pipeline.
// ============================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseDay = (dateStr) => {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};

const addDays = (dateStr, n) => {
  const d = parseDay(dateStr);
  if (!d) return dateStr;
  d.setDate(d.getDate() + n);
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Monday of the week a date falls in - the week the grid draws. */
const weekStart = (dateStr) => {
  const d = parseDay(dateStr);
  if (!d) return dateStr;
  // getDay() is 0=Sun; shift so Monday is the first column.
  const back = (d.getDay() + 6) % 7;
  return addDays(dateStr, -back);
};

const PlansTab = ({ config }) => {
  const [anchor, setAnchor] = useState(weekStart(todayStr()));
  const [role, setRole] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)),
    [anchor]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.getPlans({
        from: days[0],
        to: days[6],
        ...(role ? { role } : {}),
      });
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the beat plan'));
    } finally {
      setLoading(false);
    }
  }, [days, role]);

  useEffect(() => { load(); }, [load]);

  // Memoised off `data` rather than off a freshly-built `data?.plans || []`,
  // which is a new array identity on every render and would rebuild the map
  // each time.
  const plans = useMemo(() => data?.plans || [], [data]);
  const t = data?.totals || {};
  const perUser = data?.perUser || [];
  const today = todayStr();

  const byDay = useMemo(() => {
    const map = new Map(days.map((d) => [d, []]));
    plans.forEach((p) => {
      if (map.has(p.date)) map.get(p.date).push(p);
    });
    return map;
  }, [days, plans]);

  return (
    <div>
      {/* ── Week nav ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>WEEK OF</div>
          <input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(weekStart(e.target.value))}
            style={{ ...inputStyle, width: 150 }}
          />
        </div>
        <button type="button" style={btn()} onClick={() => setAnchor(addDays(anchor, -7))}>← Previous</button>
        <button type="button" style={btn()} onClick={() => setAnchor(weekStart(today))}>This week</button>
        <button type="button" style={btn()} onClick={() => setAnchor(addDays(anchor, 7))}>Next →</button>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All tracked roles</option>
            {(config?.enabledRoles || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="button" style={btn()} onClick={load}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Refresh
        </button>
      </div>

      <div style={{ ...statRow, marginBottom: 18 }}>
        <StatCard label="Planned" value={t.planned ?? 0} sub="this week" />
        <StatCard label="Completed" value={t.completed ?? 0} />
        <StatCard label="Pending" value={t.pending ?? 0} />
        <StatCard label="Missed" value={t.missed ?? 0} />
        <StatCard label="Completion" value={`${t.completionPct ?? 0}%`} />
      </div>

      {loading && !plans.length ? <Spinner /> : null}

      {/* ── Week grid ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
      }}
      >
        {days.map((d) => {
          const rows = byDay.get(d) || [];
          const done = rows.filter((r) => r.status === 'COMPLETED').length;
          const isToday = d === today;
          const dd = parseDay(d);
          return (
            <div
              key={d}
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${isToday ? 'var(--accent-primary, #625afa)' : 'var(--border-primary)'}`,
                borderRadius: 10, overflow: 'hidden',
                opacity: rows.length ? 1 : 0.75,
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderBottom: '1px solid var(--border-primary)',
                background: isToday ? 'rgba(98,90,250,0.08)' : 'var(--bg-tertiary, rgba(100,116,139,0.05))',
                fontSize: 11, fontWeight: 700,
                color: isToday ? 'var(--accent-primary, #625afa)' : 'var(--text-secondary)',
              }}
              >
                <span>{dd ? `${DAY_NAMES[dd.getDay()]} ${dd.getDate()}` : d}</span>
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                  {rows.length ? `${done}/${rows.length}` : '-'}
                </span>
              </div>

              {!rows.length ? (
                <div style={{ padding: '18px 10px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Nothing planned
                </div>
              ) : rows.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: '8px 10px', borderBottom: '1px solid var(--border-primary)', fontSize: 11,
                  }}
                >
                  <div style={{
                    fontWeight: 600, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                  >
                    {p.leadName || 'Scheduled visit'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[p.projectName, p.timeSlot || fmtTime(p.scheduledAt)].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                    <PlanStatusChip status={p.status} />
                    {p.outcome ? (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: VISIT_OUTCOME_STYLE[p.outcome]?.bg,
                        color: VISIT_OUTCOME_STYLE[p.outcome]?.fg,
                      }}
                      >
                        {VISIT_OUTCOME_STYLE[p.outcome]?.label || p.outcome}
                      </span>
                    ) : null}
                    {/* A plan closed at the desk has no GPS behind it. Worth
                        saying out loud rather than showing the same tick. */}
                    {p.completedBy === 'DESK' ? (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>desk</span>
                    ) : null}
                  </div>
                  {p.user?.name ? (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{p.user.name}</div>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ── Per-agent summary ── */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
          This week - all agents
        </div>
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, overflow: 'hidden',
        }}
        >
          {!perUser.length ? (
            <EmptyState
              icon={CalendarDaysIcon}
              title="No scheduled visits this week"
              hint="Beat plans come from the site visits the sales team schedules against a lead and a project. Nothing is scheduled for tracked users in this range."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                  <tr>
                    <th style={th}>Agent</th>
                    <th style={th}>Planned</th>
                    <th style={th}>Completed</th>
                    <th style={th}>Missed</th>
                    <th style={th}>Completion</th>
                    <th style={th}>Positive</th>
                    <th style={th}>Negative</th>
                    <th style={th}>Booked</th>
                  </tr>
                </thead>
                <tbody>
                  {perUser.map((r) => (
                    <tr key={r.user.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.user.name}</div>
                        {r.user.role ? <div style={{ marginTop: 3 }}><Chip>{r.user.role}</Chip></div> : null}
                      </td>
                      <td style={td}>{r.planned}</td>
                      <td style={{ ...td, color: '#166534', fontWeight: 600 }}>{r.completed}</td>
                      <td style={{ ...td, color: r.missed ? '#B71C1C' : 'var(--text-muted)', fontWeight: 600 }}>
                        {r.missed || '-'}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 60, height: 5, borderRadius: 999,
                            background: 'var(--bg-tertiary, rgba(100,116,139,0.12))', overflow: 'hidden',
                          }}
                          >
                            <div style={{
                              height: '100%', width: `${r.completionPct}%`, borderRadius: 999,
                              background: r.completionPct >= 67 ? '#166534' : (r.completionPct >= 50 ? '#f59e0b' : '#dc2626'),
                            }}
                            />
                          </div>
                          {r.completionPct}%
                        </div>
                      </td>
                      <td style={{ ...td, color: r.positive ? '#166534' : 'var(--text-muted)', fontWeight: 600 }}>{r.positive || '-'}</td>
                      <td style={{ ...td, color: r.negative ? '#B71C1C' : 'var(--text-muted)', fontWeight: 600 }}>{r.negative || '-'}</td>
                      <td style={{ ...td, color: r.booked ? '#065F46' : 'var(--text-muted)', fontWeight: 600 }}>{r.booked || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
        Planned visits are the sales team&apos;s scheduled site visits. A plan is marked
        done when a field visit is logged against it on the phone, or when the desk
        closes the site visit itself - this screen never writes back to the pipeline.
      </div>
    </div>
  );
};

export default PlansTab;
