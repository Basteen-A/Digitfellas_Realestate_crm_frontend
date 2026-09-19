import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, MapIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import {
  th, td, inputStyle, btn, StatCard, StatusChip, Chip, EmptyState, Spinner,
  fmtTime, fmtDuration, fmtDistance, todayStr, DAY_STATUS_STYLE,
} from '../ui';

// ============================================================
// Day View - one date, every tracked user, one row each.
//
// Users who never punched in are listed too, as ABSENT. A day grid that
// silently drops the people who did not turn up is the opposite of useful.
// ============================================================

const STATUSES = ['PRESENT', 'HALF_DAY', 'ABSENT', 'WEEK_OFF', 'HOLIDAY', 'LEAVE'];

const DayViewTab = ({ config, onOpenTimeline }) => {
  const [date, setDate] = useState(todayStr());
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState('');
  const [editing, setEditing] = useState(null); // { userId, name, current }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.getDayView({
        date,
        ...(role ? { role } : {}),
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
      });
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the day view'));
    } finally {
      setLoading(false);
    }
  }, [date, role, search, status]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per keystroke.
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const doPunch = async (userId, direction) => {
    setActing(`${direction}:${userId}`);
    try {
      if (direction === 'in') await fieldTrackingApi.adminPunchIn(userId);
      else await fieldTrackingApi.adminPunchOut(userId);
      toast.success(direction === 'in' ? 'Punched in' : 'Punched out');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setActing('');
    }
  };

  const saveStatus = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await fieldTrackingApi.setDayStatus(editing.userId, {
        work_date: date,
        day_status: form.get('day_status'),
        remarks: form.get('remarks') || null,
      });
      toast.success('Day status updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    }
  };

  const t = data?.totals;

  return (
    <div>
      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>DATE</div>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 170 }}>
            <option value="">All tracked roles</option>
            {(config?.roles || [])
              .filter((r) => (config?.enabledRoles || []).includes(r.code))
              .map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>STATUS</div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{DAY_STATUS_STYLE[s].label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>SEARCH</div>
          <input placeholder="Name, employee ID or phone" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </div>
        <button type="button" onClick={load} style={btn()} disabled={loading}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Refresh
        </button>
      </div>

      {/* ── Totals ── */}
      {t ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatCard label="Tracked" value={t.users} sub="users" />
          <StatCard label="Present" value={t.present} accent={DAY_STATUS_STYLE.PRESENT.fg} />
          <StatCard label="Half Day" value={t.halfDay} accent={DAY_STATUS_STYLE.HALF_DAY.fg} />
          <StatCard label="Absent" value={t.absent} accent={DAY_STATUS_STYLE.ABSENT.fg} />
          <StatCard label="Week Off" value={t.weekOff} accent={DAY_STATUS_STYLE.WEEK_OFF.fg} />
          <StatCard label="Late" value={t.late} accent="#d97706" />
          <StatCard label="Still Out" value={t.punchedIn} sub="not punched out" />
          <StatCard label="Distance" value={t.totalDistanceLabel} sub="all users" />
        </div>
      ) : null}

      {/* ── Grid ── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && !data ? <Spinner /> : null}
        {!loading && !data?.rows?.length ? (
          <EmptyState
            icon={UserGroupIcon}
            title="No tracked users for this day"
            hint={
              config?.isEnabled
                ? 'Nobody matches these filters. Check the roles switched on under Settings.'
                : 'Field tracking is switched off. Turn it on under the Settings tab and pick the roles it applies to.'
            }
          />
        ) : null}

        {data?.rows?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1130 }}>
              <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Status</th>
                  <th style={th}>Punch In</th>
                  <th style={th}>Punch Out</th>
                  <th style={th}>Worked</th>
                  <th style={th}>Travel</th>
                  <th style={th}>Halts</th>
                  <th style={th}>Visits</th>
                  <th style={th}>Distance</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const s = r.session;
                  const open = s?.punchInAt && !s?.punchOutAt;
                  return (
                    <tr key={r.user.id}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.user.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                          <Chip>{r.user.role}</Chip>
                          {r.user.employeeCode ? <span>{r.user.employeeCode}</span> : null}
                        </div>
                      </td>
                      <td style={td}>
                        <StatusChip status={r.dayStatus} />
                        {s?.statusOverridden ? <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>set by admin</div> : null}
                      </td>
                      <td style={td}>
                        {fmtTime(s?.punchInAt)}
                        {s?.isLate ? <div style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>LATE</div> : null}
                        {s?.punchInMode === 'ADMIN' ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>by admin</div> : null}
                        {s?.punchInLocation ? <div style={{ fontSize: 10, color: '#16a34a' }}>{s.punchInLocation.name}</div> : null}
                      </td>
                      <td style={td}>
                        {open
                          ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>Still out</span>
                          : fmtTime(s?.punchOutAt)}
                        {s?.punchOutMode === 'AUTO' ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>auto</div> : null}
                        {s?.punchOutMode === 'ADMIN' ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>by admin</div> : null}
                      </td>
                      <td style={td}>{s ? fmtDuration(s.workedMinutes) : '-'}</td>
                      <td style={td}>{s ? fmtDuration(s.travelMinutes) : '-'}</td>
                      <td style={td}>
                        {s?.haltCount ? `${s.haltCount} · ${fmtDuration(s.haltMinutes)}` : '-'}
                      </td>
                      <td style={td}>{s?.visitCount ? s.visitCount : '-'}</td>
                      <td style={td}>{s ? fmtDistance(s.totalDistanceM) : '-'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {s?.punchInAt ? (
                          <button type="button" style={{ ...btn('ghost'), color: 'var(--accent-primary, #625afa)' }} onClick={() => onOpenTimeline(r.user, date)}>
                            <MapIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
                            Route
                          </button>
                        ) : null}
                        {!s?.punchInAt ? (
                          <button type="button" style={btn('ghost')} disabled={acting === `in:${r.user.id}`} onClick={() => doPunch(r.user.id, 'in')}>
                            {acting === `in:${r.user.id}` ? '...' : 'Punch in'}
                          </button>
                        ) : null}
                        {open ? (
                          <button type="button" style={btn('ghost')} disabled={acting === `out:${r.user.id}`} onClick={() => doPunch(r.user.id, 'out')}>
                            {acting === `out:${r.user.id}` ? '...' : 'Punch out'}
                          </button>
                        ) : null}
                        <button type="button" style={btn('ghost')} onClick={() => setEditing({ userId: r.user.id, name: r.user.name, current: r.dayStatus })}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Day status override ── */}
      {editing ? (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setEditing(null)}
          role="presentation"
        >
          <form
            onSubmit={saveStatus}
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: 20, width: 420, maxWidth: '100%' }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Set day status</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {editing.name} · {date}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>STATUS</div>
            <select name="day_status" defaultValue={editing.current} style={{ ...inputStyle, marginBottom: 14 }}>
              {STATUSES.map((s) => <option key={s} value={s}>{DAY_STATUS_STYLE[s].label}</option>)}
            </select>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>REMARKS</div>
            <input name="remarks" placeholder="Why this was changed" style={{ ...inputStyle, marginBottom: 8 }} />

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              A hand-set status is kept: the background worker will keep refreshing this day&apos;s distance and
              halts but will stop recalculating the verdict.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" style={btn('primary')}>Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
};

export default DayViewTab;
