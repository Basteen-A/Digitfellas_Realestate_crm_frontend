import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, MapIcon, UsersIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import useGoogleMaps, { mapsErrorMessage } from '../useGoogleMaps';
import useParcelLayer from '../useParcelLayer';
import {
  th, td, inputStyle, btn, StatCard, statRow, Chip, EmptyState, Spinner,
  LIVE_STATE_STYLE, LiveStateChip, StatusChip, TrackingModeChip,
  fmtTime, fmtDistance, todayStr,
} from '../ui';

// ============================================================
// Field Dashboard - the whole day on one screen.
//
// Deliberately NOT another copy of Day View or Live Map. Those answer
// "who worked" and "where are they"; this answers "how is today going", by
// putting attendance, live state, today's visits and the beat plan in one
// payload (GET /field-tracking/dashboard) so the three never disagree.
//
// Selecting an agent on the left filters nothing - it centres the map and
// highlights the row. A filter here would hide the people the screen exists
// to surface.
// ============================================================

// The device uploads its queue every 5 minutes, so nothing new can arrive
// faster than this. A tighter poll would only burn requests.
const REFRESH_MS = 60_000;

const DashboardTab = ({ config, onOpenTimeline }) => {
  const [date, setDate] = useState(todayStr());
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const { maps, error: mapsError } = useGoogleMaps(config?.mapsBrowserKey);
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const resp = await fieldTrackingApi.getDashboard({
        date,
        ...(role ? { role } : {}),
        ...(search ? { search } : {}),
      });
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the dashboard'));
    } finally {
      setLoading(false);
    }
  }, [date, role, search]);

  useEffect(() => { load(); }, [load]);

  // Only a live day needs polling - a past date never changes.
  useEffect(() => {
    if (date !== todayStr()) return undefined;
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [date, load]);

  // ── Pins ──
  useEffect(() => {
    if (!maps || !divRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new maps.Map(divRef.current, {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 11,
        streetViewControl: false,
        clickableIcons: false,
      });
    }
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.setMap?.(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let any = false;

    (data?.rows || []).forEach((r) => {
      if (r.latitude == null || r.longitude == null) return;
      const pos = { lat: r.latitude, lng: r.longitude };
      const style = LIVE_STATE_STYLE[r.liveState] || LIVE_STATE_STYLE.NOT_IN;
      const marker = new maps.Marker({
        map,
        position: pos,
        title: `${r.user.name} - ${style.label}`,
        zIndex: selected === r.user.id ? 999 : 1,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: selected === r.user.id ? 11 : 8,
          fillColor: style.dot,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => setSelected(r.user.id));
      markersRef.current.push(marker);
      bounds.extend(pos);
      any = true;
    });

    if (any) {
      const chosen = (data?.rows || []).find((r) => r.user.id === selected);
      if (chosen && chosen.latitude != null) {
        map.panTo({ lat: chosen.latitude, lng: chosen.longitude });
        if (map.getZoom() < 14) map.setZoom(14);
      } else {
        map.fitBounds(bounds, 60);
        const once = maps.event.addListenerOnce(map, 'idle', () => {
          if (map.getZoom() > 15) map.setZoom(15);
        });
        markersRef.current.push({ setMap: () => maps.event.removeListener(once) });
      }
    }
  }, [maps, data, selected]);

  // Named land underneath the pins - must follow the effect that builds the map.
  // The map div only mounts after the first load (spinner before), hence ready.
  useParcelLayer(maps, mapRef, {
    ready: Boolean(data),
    hasOwnContent: (data?.rows || []).some((r) => r.latitude != null),
    fitWhenAlone: true,
  });

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.setMap?.(null));
    markersRef.current = [];
  }, []);

  if (loading && !data) return <Spinner label="Loading the dashboard…" />;

  const rows = data?.rows || [];
  const t = data?.totals || {};
  const idleMins = data?.thresholds?.idleMinutes ?? 30;

  return (
    <div>
      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>DATE</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 150 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All tracked roles</option>
            {(config?.enabledRoles || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>SEARCH</div>
          <input placeholder="Name or employee code" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </div>
        <button type="button" style={btn()} onClick={() => load()}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Refresh
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ ...statRow, marginBottom: 18 }}>
        <StatCard label="Tracked" value={t.users ?? 0} sub="field team" />
        <StatCard label="Checked In" value={t.checkedIn ?? 0} sub={`${t.presentPct ?? 0}% present`} />
        <StatCard label="On Visit" value={t.onVisit ?? 0} sub="right now" />
        <StatCard
          label={`Idle >${idleMins}min`}
          value={t.idle ?? 0}
          sub="not moving"
        />
        <StatCard
          label="No Signal"
          value={t.offline ?? 0}
          sub="no fix 15min+"
        />
        <StatCard
          label="Not Started"
          value={t.notStarted ?? 0}
          sub="no punch-in"
        />
        <StatCard label="Visits" value={t.visitsDone ?? 0} sub={`of ${t.visitsPlanned ?? 0} planned`} />
        <StatCard label="Distance" value={t.totalDistanceLabel || '0 m'} sub="all users" />
      </div>

      {!data?.isToday ? (
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--text-muted)',
        }}
        >
          Showing a past day, so nobody is live. Idle and signal states only mean
          something on today&apos;s date.
        </div>
      ) : null}

      {/* ── Agent list + map ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 300px) 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 12, overflow: 'hidden', maxHeight: 460, overflowY: 'auto',
        }}
        >
          <div style={{
            padding: '11px 14px', borderBottom: '1px solid var(--border-primary)',
            fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 1,
          }}
          >
            <span>All agents</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{rows.length}</span>
          </div>

          {!rows.length ? (
            <EmptyState icon={UsersIcon} title="Nobody is tracked" hint="Switch the module on for a role under Settings." />
          ) : null}

          {rows.map((r) => {
            const style = LIVE_STATE_STYLE[r.liveState] || LIVE_STATE_STYLE.NOT_IN;
            const on = selected === r.user.id;
            return (
              <button
                key={r.user.id}
                type="button"
                onClick={() => setSelected(on ? null : r.user.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', border: 'none', textAlign: 'left', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-primary)',
                  background: on ? 'rgba(98,90,250,0.07)' : 'transparent',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: style.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                  >
                    {r.user.name}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {style.label}
                    {r.activeCustomer ? ` · ${r.activeCustomer}` : ''}
                    {r.idleMinutes ? ` · ${r.idleMinutes}m` : ''}
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: r.session?.totalDistanceM ? 'var(--accent-primary, #625afa)' : 'var(--text-muted)' }}>
                  {r.session?.totalDistanceM ? fmtDistance(r.session.totalDistanceM) : '-'}
                </span>
              </button>
            );
          })}
        </div>

        <div>
          {!config?.mapsBrowserKey || mapsError ? (
            <div style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
              borderRadius: 12, minHeight: 300,
            }}
            >
              <EmptyState icon={MapIcon} title="Map unavailable" hint={mapsErrorMessage(mapsError || 'NO_KEY')} />
            </div>
          ) : (
            <div
              ref={divRef}
              style={{
                height: 340, borderRadius: 12, border: '1px solid var(--border-primary)',
                background: 'var(--bg-secondary)',
              }}
            />
          )}

          {/* ── Per-agent today ── */}
          <div style={{
            marginTop: 14, background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden',
          }}
          >
            {!rows.length ? (
              <EmptyState icon={CalendarDaysIcon} title="Nothing for this day" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                  <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                    <tr>
                      <th style={th}>Agent</th>
                      <th style={th}>Attendance</th>
                      <th style={th}>In / Out</th>
                      <th style={th}>Visits</th>
                      <th style={th}>Positive</th>
                      <th style={th}>Negative</th>
                      <th style={th}>Booked</th>
                      <th style={th}>Distance</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: 'right' }}>Route</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.user.id}
                        style={{ background: selected === r.user.id ? 'rgba(98,90,250,0.06)' : undefined }}
                      >
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{r.user.name}</div>
                          {r.user.role ? <div style={{ marginTop: 3 }}><Chip>{r.user.role}</Chip></div> : null}
                          <div style={{ marginTop: 3 }}>
                            <TrackingModeChip trackingEnabled={r.user.trackingEnabled} coverage={r.user.coverage} />
                          </div>
                        </td>
                        <td style={td}><StatusChip status={r.dayStatus} small /></td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {r.session?.punchInAt ? fmtTime(r.session.punchInAt) : '-'}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.session?.punchOutAt ? fmtTime(r.session.punchOutAt) : 'ongoing'}
                          </div>
                        </td>
                        <td style={td}>
                          <b>{r.visits.done}</b>
                          {r.visits.planned ? (
                            <span style={{ color: 'var(--text-muted)' }}>/{r.visits.planned}</span>
                          ) : null}
                          {r.visits.inProgress ? (
                            <div style={{ fontSize: 10, color: '#1D4ED8', marginTop: 2 }}>1 open</div>
                          ) : null}
                        </td>
                        <td style={{ ...td, color: r.visits.positive ? '#166534' : 'var(--text-muted)', fontWeight: 600 }}>
                          {r.visits.positive || '-'}
                        </td>
                        <td style={{ ...td, color: r.visits.negative ? '#B71C1C' : 'var(--text-muted)', fontWeight: 600 }}>
                          {r.visits.negative || '-'}
                        </td>
                        <td style={{ ...td, color: r.visits.booked ? '#065F46' : 'var(--text-muted)', fontWeight: 600 }}>
                          {r.visits.booked || '-'}
                        </td>
                        <td style={td}>{r.session?.totalDistanceM ? fmtDistance(r.session.totalDistanceM) : '-'}</td>
                        <td style={td}><LiveStateChip state={r.liveState} minutes={r.idleMinutes} /></td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {r.session?.punchInAt ? (
                            <button
                              type="button"
                              style={{ ...btn('ghost'), color: 'var(--accent-primary, #625afa)' }}
                              onClick={() => onOpenTimeline?.(r.user, data.workDate)}
                            >
                              Route
                            </button>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
