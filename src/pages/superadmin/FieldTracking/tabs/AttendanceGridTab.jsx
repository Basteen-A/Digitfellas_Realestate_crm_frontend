import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import {
  th, td, inputStyle, btn, StatCard, Chip, EmptyState, Spinner,
  GRID_CELL_STYLE, todayStr, daysAgoStr,
} from '../ui';

// ============================================================
// Attendance grid - one row per person, one cell per day.
//
// The month view the day grid could never be: a whole team's month at a
// glance, the way a supervisor actually reads attendance.
//
// The important rule is in the BLANK cells. A date with no session row comes
// back from the server as null and is drawn as a faint dot, NOT as an absence.
// The worker only writes a verdict for a day it processed, so a person tracked
// since Wednesday has no business showing red boxes for Monday - and a grid
// that invents absences is worse than no grid at all.
// ============================================================

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Parse YYYY-MM-DD as a plain local date - never through Date(string), which treats it as UTC. */
const parseDay = (dateStr) => {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : null;
};

const headerFor = (dateStr) => {
  const d = parseDay(dateStr);
  if (!d) return { dow: '', day: '' };
  return { dow: DAY_INITIALS[d.getDay()], day: String(d.getDate()) };
};

const LEGEND = ['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE', 'WEEK_OFF', 'HOLIDAY', 'UNKNOWN'];

const AttendanceGridTab = ({ config }) => {
  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.getAttendanceGrid({
        from, to, ...(role ? { role } : {}), ...(search ? { search } : {}),
      });
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the attendance grid'));
    } finally {
      setLoading(false);
    }
  }, [from, to, role, search]);

  useEffect(() => { load(); }, [load]);

  const dates = data?.dates || [];
  const rows = data?.rows || [];
  const t = data?.totals || {};

  // The grid is one column per date. Past ~40 columns the cells get unreadable
  // before the query gets slow, so the cell shrinks rather than the table
  // scrolling forever.
  const cellWidth = useMemo(() => {
    if (dates.length > 45) return 22;
    if (dates.length > 31) return 26;
    return 32;
  }, [dates.length]);

  return (
    <div>
      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>FROM</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>TO</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All tracked roles</option>
            {(config?.enabledRoles || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 150 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>SEARCH</div>
          <input placeholder="Name or employee code" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </div>
        <button type="button" style={btn()} onClick={load}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Refresh
        </button>
      </div>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatCard label="People" value={t.users ?? 0} />
        <StatCard label="Days Shown" value={t.workingDays ?? 0} sub={`${data?.from || ''} → ${data?.to || ''}`} />
        <StatCard label="Avg Present" value={t.avgPresent ?? 0} sub="days per person" accent="#16a34a" />
        <StatCard label="Total Late" value={t.late ?? 0} accent={t.late ? '#d97706' : undefined} />
        <StatCard label="Leaves" value={t.leave ?? 0} accent="#1D4ED8" />
        <StatCard label="Absent Days" value={t.absent ?? 0} accent={t.absent ? '#dc2626' : undefined} />
        <StatCard label="Payable Days" value={t.payableDays ?? 0} sub="present + ½ × half" />
      </div>

      {loading && !rows.length ? <Spinner /> : null}

      {!loading && !rows.length ? (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
          <EmptyState
            icon={CalendarDaysIcon}
            title="No tracked users"
            hint="Nobody in the selected roles has a tracked day in this range."
          />
        </div>
      ) : null}

      {rows.length ? (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, overflow: 'hidden',
        }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
              <thead>
                <tr>
                  {/* Sticky so the name stays put while the month scrolls. */}
                  <th style={{
                    ...th,
                    position: 'sticky', left: 0, zIndex: 2, minWidth: 170,
                    background: 'var(--bg-tertiary, #f1f5f9)',
                  }}
                  >
                    Agent
                  </th>
                  {dates.map((d) => {
                    const h = headerFor(d);
                    const weekend = h.dow === 'S';
                    return (
                      <th
                        key={d}
                        title={d}
                        style={{
                          ...th,
                          width: cellWidth, minWidth: cellWidth, padding: '6px 2px',
                          textAlign: 'center',
                          color: weekend ? 'var(--text-muted)' : undefined,
                        }}
                      >
                        <div style={{ fontSize: 9, opacity: 0.7 }}>{h.dow}</div>
                        <div>{h.day}</div>
                      </th>
                    );
                  })}
                  <th style={{ ...th, textAlign: 'center', minWidth: 60 }}>P</th>
                  <th style={{ ...th, textAlign: 'center', minWidth: 60 }}>A</th>
                  <th style={{ ...th, textAlign: 'center', minWidth: 70 }}>Payable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td style={{
                      ...td,
                      position: 'sticky', left: 0, zIndex: 1,
                      background: 'var(--bg-secondary)',
                      borderRight: '1px solid var(--border-primary)',
                    }}
                    >
                      <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.user.name}</div>
                      <div style={{ marginTop: 3, display: 'flex', gap: 5, alignItems: 'center' }}>
                        {r.user.role ? <Chip>{r.user.role}</Chip> : null}
                        {r.totals.late ? (
                          <span style={{ fontSize: 10, color: '#92400E' }}>{r.totals.late} late</span>
                        ) : null}
                      </div>
                    </td>

                    {r.cells.map((c) => {
                      const st = GRID_CELL_STYLE[c.dayStatus] || GRID_CELL_STYLE.UNKNOWN;
                      const tip = c.dayStatus
                        ? `${c.date} · ${st.label}${c.isLate ? ' (late)' : ''}`
                          + `${c.workedLabel ? ` · ${c.workedLabel}` : ''}`
                          + `${c.visitCount ? ` · ${c.visitCount} visits` : ''}`
                        : `${c.date} · not tracked`;
                      return (
                        <td key={c.date} style={{ padding: 2, textAlign: 'center' }} title={tip}>
                          <div style={{
                            width: cellWidth - 6, height: cellWidth - 6, margin: '0 auto',
                            borderRadius: 6, border: `1px solid ${st.bd}`, background: st.bg,
                            color: st.fg, fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                          }}
                          >
                            {st.mark}
                            {/* Late is a corner dot, not a separate letter - the
                                cell still has to read as "present". */}
                            {c.isLate ? (
                              <span style={{
                                position: 'absolute', top: 1, right: 1,
                                width: 4, height: 4, borderRadius: 999, background: '#d97706',
                              }}
                              />
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#166534' }}>{r.totals.present}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: r.totals.absent ? '#B71C1C' : 'var(--text-muted)' }}>
                      {r.totals.absent || '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{r.totals.payableDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Legend ── */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 14px',
            borderTop: '1px solid var(--border-primary)',
            background: 'var(--bg-tertiary, rgba(100,116,139,0.04))',
          }}
          >
            {LEGEND.map((k) => {
              const st = GRID_CELL_STYLE[k];
              return (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span style={{
                    width: 15, height: 15, borderRadius: 4, border: `1px solid ${st.bd}`,
                    background: st.bg, color: st.fg, fontSize: 9, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  >
                    {st.mark}
                  </span>
                  {st.label}
                </span>
              );
            })}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ width: 5, height: 5, borderRadius: 999, background: '#d97706' }} />
              Late in
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
        A faint dot means the day was never tracked for that person — not that they
        were absent. Hover any cell for the hours and visits behind it.
        {t.workingDays >= 62 ? ' The range is capped at 62 days.' : ''}
      </div>
    </div>
  );
};

export default AttendanceGridTab;
