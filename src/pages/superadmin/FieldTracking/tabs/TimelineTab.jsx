import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, MapPinIcon, ClockIcon, CalculatorIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import RouteMap from '../RouteMap';
import {
  th, td, inputStyle, btn, StatCard, statRow, StatusChip, Chip, EmptyState, Spinner,
  fmtTime, fmtDuration, fmtDistance, todayStr,
  VISIT_TYPE_LABEL, VISIT_OUTCOME_STYLE, VisitStatusChip,
} from '../ui';

// ============================================================
// Timeline - where one person went on one day.
//
// The map and the list are two views of the same halts, so hovering a row
// makes the corresponding pin obvious by number. Reading order matches the
// question an admin actually asks: punched in where, went where next, stopped
// how long, ended where.
// ============================================================

const TimelineTab = ({ config, selected, onClearSelection }) => {
  const [userId, setUserId] = useState(selected?.user?.id || '');
  const [userLabel, setUserLabel] = useState(selected?.user?.name || '');
  const [date, setDate] = useState(selected?.date || todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [recalculating, setRecalculating] = useState(false);

  // A selection handed over from the Day View tab wins over local state.
  useEffect(() => {
    if (selected?.user?.id) {
      setUserId(selected.user.id);
      setUserLabel(selected.user.name);
      setDate(selected.date || todayStr());
    }
  }, [selected]);

  // The tracked-user list for the picker comes from the day view for today -
  // it is already role-filtered and permission-checked server-side.
  useEffect(() => {
    (async () => {
      try {
        const resp = await fieldTrackingApi.getDayView({ date: todayStr() });
        setUsers((resp.data?.rows || []).map((r) => r.user));
      } catch {
        // Non-fatal: the picker just stays empty and the admin arrives here
        // from the Day View tab instead.
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!userId) { setData(null); return; }
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.getTimeline(userId, { date });
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the timeline'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, date]);

  useEffect(() => { load(); }, [load]);

  const recalc = async () => {
    setRecalculating(true);
    try {
      await fieldTrackingApi.recalculate(userId, date);
      toast.success('Recalculated');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Recalculation failed'));
    } finally {
      setRecalculating(false);
    }
  };

  const s = data?.session;

  return (
    <div>
      {/* ── Picker ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>USER</div>
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setUserLabel(e.target.options[e.target.selectedIndex].text);
              onClearSelection?.();
            }}
            style={inputStyle}
          >
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}{u.employeeCode ? ` (${u.employeeCode})` : ''} - {u.role}
              </option>
            ))}
            {/* The handed-over user may not be in today's list (an older date). */}
            {userId && !users.some((u) => u.id === userId) ? (
              <option value={userId}>{userLabel}</option>
            ) : null}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>DATE</div>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </div>
        <button type="button" onClick={load} style={btn()} disabled={loading || !userId}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Refresh
        </button>
        {s ? (
          <button type="button" onClick={recalc} style={btn()} disabled={recalculating} title="Rebuild halts, distance and the day verdict from the stored GPS points">
            <CalculatorIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            {recalculating ? 'Recalculating…' : 'Recalculate'}
          </button>
        ) : null}
      </div>

      {!userId ? (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
          <EmptyState icon={MapPinIcon} title="Pick a user and a date" hint="Or click Route on any row in the Day View tab." />
        </div>
      ) : null}

      {loading && userId ? <Spinner label="Loading route…" /> : null}

      {userId && !loading && !s ? (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
          <EmptyState icon={ClockIcon} title="Nothing recorded" hint={`${userLabel || 'This user'} has no punch-in on ${date}.`} />
        </div>
      ) : null}

      {s ? (
        <>
          {/* ── Day summary ── */}
          <div style={{ ...statRow, marginBottom: 16 }}>
            <StatCard label="Status" value={<StatusChip status={s.dayStatus} />} sub={data.user.name} />
            <StatCard label="Punch In" value={fmtTime(s.punchInAt)} sub={s.isLate ? 'late' : (s.punchInLocation?.name || '-')} />
            <StatCard label="Punch Out" value={s.punchOutAt ? fmtTime(s.punchOutAt) : 'Still out'} sub={s.punchOutMode === 'AUTO' ? 'auto-closed' : (s.punchOutLocation?.name || '-')} />
            <StatCard label="Worked" value={fmtDuration(s.workedMinutes)} />
            <StatCard label="Travel" value={fmtDuration(s.travelMinutes)} sub="moving between stops" />
            <StatCard label="At Stops" value={fmtDuration(s.haltMinutes)} sub={`${s.haltCount} halts`} />
            <StatCard label="Visits" value={(data.visits || []).filter((v) => v.status !== 'CANCELLED').length} sub="customers logged" />
            <StatCard
              label="Distance"
              value={fmtDistance(data.routeDistanceM ?? s.totalDistanceM)}
              sub={data.routeDistanceM != null
                ? 'road-matched'
                : `${s.pointsCount} GPS points, straight-line`}
            />
          </div>

          {s.mockLocationFlagged ? (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)',
              color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 12, marginBottom: 14, fontWeight: 600,
            }}
            >
              A mock-location provider was reported on this day&apos;s device. Treat the route with caution.
            </div>
          ) : null}

          {/* ── Map ── */}
          <div style={{ marginBottom: 16 }}>
            <RouteMap
              apiKey={config?.mapsBrowserKey}
              session={s}
              halts={data.halts}
              points={data.points}
              route={data.route || []}
              routeSource={data.routeSource || 'RAW'}
              locations={data.locations}
              visits={data.visits || []}
              height={460}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.6 }}>
              {data.routeSource === 'SNAPPED' ? (
                <>The solid line is the road-matched route, and the distance above is measured along it.</>
              ) : (
                <>
                  <b>The dashed line is a straight line between GPS fixes, not a driven route.</b>{' '}
                  It cuts corners and reads short against an odometer. Turn on road
                  matching under Settings to snap it to the road network
                  {s.pointsCount != null && s.pointsCount < 40
                    ? `, and note this day has only ${s.pointsCount} fixes — background location has to be running on the phone for a route to exist at all`
                    : ''}.
                </>
              )}
              {data.downsampled
                ? ` Showing a sample of ${data.points.length} of ${data.totalPoints} GPS points for readability; distance and halts use all of them.`
                : ''}
            </div>
          </div>

          {/* ── Logged visits ── */}
          {(data.visits || []).length ? (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Customers visited
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                  what the rep logged, next to what the GPS recorded
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                  <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                    <tr>
                      <th style={th}>Customer</th>
                      <th style={th}>Type</th>
                      <th style={th}>In / Out</th>
                      <th style={th}>Stayed</th>
                      <th style={th}>Outcome</th>
                      <th style={th}>GPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.visits.map((v) => (
                      <tr key={v.id} style={v.status === 'CANCELLED' ? { opacity: 0.55 } : undefined}>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{v.customerName}</div>
                          {v.customerPhone ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.customerPhone}</div> : null}
                          {v.leadNumber ? <div style={{ marginTop: 3 }}><Chip bg="rgba(98,90,250,0.12)" fg="#625afa">{v.leadNumber}</Chip></div> : null}
                          {v.purpose ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>{v.purpose}</div> : null}
                        </td>
                        <td style={td}><Chip>{VISIT_TYPE_LABEL[v.visitType] || v.visitType}</Chip></td>
                        <td style={td}>
                          {fmtTime(v.checkedInAt)}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.checkedOutAt ? fmtTime(v.checkedOutAt) : '-'}</div>
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {v.durationMinutes != null ? fmtDuration(v.durationMinutes) : '-'}
                          {v.autoClosed ? <div style={{ fontSize: 10, color: '#d97706', fontWeight: 400 }}>auto-closed</div> : null}
                        </td>
                        <td style={td}>
                          {v.outcome ? (
                            <Chip bg={VISIT_OUTCOME_STYLE[v.outcome]?.bg} fg={VISIT_OUTCOME_STYLE[v.outcome]?.fg}>
                              {VISIT_OUTCOME_STYLE[v.outcome]?.label || v.outcome}
                            </Chip>
                          ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          <div style={{ marginTop: 4 }}><VisitStatusChip status={v.status} /></div>
                          {v.notes ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 240 }}>{v.notes}</div> : null}
                        </td>
                        <td style={td}>
                          {v.unverifiedByGps
                            ? <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700 }}>Not confirmed</span>
                            : <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>{v.status === 'IN_PROGRESS' ? 'Running' : 'Confirmed'}</span>}
                          {v.mockLocationFlagged ? <div style={{ fontSize: 10, color: '#dc2626', marginTop: 3, fontWeight: 700 }}>MOCK GPS</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* ── Halt list ── */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Stops on this day
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>
                with the distance travelled between each one
              </span>
            </div>
            {!data.halts.length ? (
              <EmptyState
                title="No stops detected"
                hint={
                  s.pointsCount > 1
                    ? 'The GPS points never stayed in one place long enough to count as a halt. The threshold is on the shift policy.'
                    : 'No background GPS points arrived for this day. Check that tracking is on for this user and that the app has background location permission.'
                }
              />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                    <tr>
                      <th style={{ ...th, width: 44 }}>#</th>
                      <th style={th}>Place</th>
                      <th style={th}>Travelled here</th>
                      <th style={th}>From</th>
                      <th style={th}>To</th>
                      <th style={th}>Stopped</th>
                      <th style={th}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.halts.map((h, i) => (
                      <tr key={h.id}>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{h.label}</div>
                          {h.locationName && h.address ? (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{h.address}</div>
                          ) : null}
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
                          </div>
                        </td>
                        {/* The leg INTO this stop. A dash on the first row is
                            correct - there is no previous stop to measure from,
                            and "0 km" would read as "went nowhere". */}
                        <td style={td}>
                          {h.distanceFromPrevM != null ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{fmtDistance(h.distanceFromPrevM)}</div>
                              {h.travelMinutesFromPrev != null ? (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                  {fmtDuration(h.travelMinutesFromPrev)} on the move
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={td}>{fmtTime(h.startedAt)}</td>
                        <td style={td}>{fmtTime(h.endedAt)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{h.durationLabel || fmtDuration(h.durationMinutes)}</td>
                        <td style={td}>
                          {h.haltType === 'START' ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">START</Chip> : null}
                          {h.haltType === 'END' ? <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">END</Chip> : null}
                          {h.haltType === 'HALT' ? <Chip>STOP</Chip> : null}
                          {h.locationId ? <div style={{ marginTop: 4 }}><Chip bg="rgba(98,90,250,0.12)" fg="#625afa">KNOWN SITE</Chip></div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default TimelineTab;
