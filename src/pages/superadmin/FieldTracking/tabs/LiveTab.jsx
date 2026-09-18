import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowPathIcon, SignalIcon, MapIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import useGoogleMaps, { mapsErrorMessage } from '../useGoogleMaps';
import {
  th, td, btn, inputStyle, StatCard, Chip, EmptyState, Spinner,
  fmtTime, fmtDistance,
} from '../ui';

// ============================================================
// Live board - where everyone who is punched in was last seen.
//
// NOT a WebSocket feed, by design. Positions move when each device's next
// 5-minute batch lands, which is what keeps this near-free to run. The page
// re-polls on the same cadence and every row states its own age, so nobody
// mistakes a 20-minute-old dot for a live one.
// ============================================================

const REFRESH_MS = 5 * 60 * 1000;

const LiveTab = ({ config, onOpenTimeline }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('');
  const { maps, error: mapsError } = useGoogleMaps(config?.mapsBrowserKey);
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.getLiveBoard(role ? { role } : {});
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the live board'));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  // Re-poll on the device batch cadence. Nothing arrives faster than this, so
  // a tighter interval would just be wasted requests.
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Draw the pins.
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
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let any = false;

    (data?.rows || []).forEach((r) => {
      if (r.latitude == null || r.longitude == null) return;
      const pos = { lat: r.latitude, lng: r.longitude };
      const marker = new maps.Marker({
        map,
        position: pos,
        title: `${r.user.name} — last seen ${r.minutesSinceLastPoint ?? '?'}m ago`,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          // Stale dots read grey so a dead device never looks like a live one.
          fillColor: r.isStale ? '#94a3b8' : '#16a34a',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
      any = true;
    });

    if (any) {
      map.fitBounds(bounds, 60);
      const once = maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15);
      });
      markersRef.current.push({ setMap: () => maps.event.removeListener(once) });
    }
  }, [maps, data]);

  useEffect(() => () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
  }, []);

  const rows = data?.rows || [];
  const stale = rows.filter((r) => r.isStale).length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>ROLE</div>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, width: 190 }}>
            <option value="">All tracked roles</option>
            {(config?.roles || [])
              .filter((r) => (config?.enabledRoles || []).includes(r.code))
              .map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <button type="button" onClick={load} style={btn()} disabled={loading}>
          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
          Refresh
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 380, lineHeight: 1.5 }}>
          Positions update when each device uploads its next batch — about every 5 minutes.
          This is not a live feed; every row shows how old its fix is.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard label="Out now" value={rows.length} sub="punched in" accent="#16a34a" />
        <StatCard label="Reporting" value={rows.length - stale} sub="fix under 15 min old" />
        <StatCard label="Stale" value={stale} sub="no fix for 15+ min" accent={stale ? '#d97706' : undefined} />
        <StatCard label="Distance today" value={fmtDistance(rows.reduce((s, r) => s + (r.totalDistanceM || 0), 0))} />
      </div>

      {config?.mapsBrowserKey && !mapsError ? (
        <div
          ref={divRef}
          style={{
            height: 380, width: '100%', borderRadius: 10,
            border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary, #eee)', marginBottom: 16,
          }}
        />
      ) : (
        <div style={{ border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--bg-secondary)', marginBottom: 16 }}>
          <EmptyState title="Map unavailable" hint={mapsErrorMessage(mapsError || 'NO_KEY')} />
        </div>
      )}

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && !data ? <Spinner /> : null}
        {!loading && !rows.length ? (
          <EmptyState icon={SignalIcon} title="Nobody is punched in right now" hint="People appear here between their punch in and punch out." />
        ) : null}

        {rows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Punched in</th>
                  <th style={th}>Last seen</th>
                  <th style={th}>Position</th>
                  <th style={th}>Distance</th>
                  <th style={{ ...th, textAlign: 'right' }}>Route</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        <Chip>{r.user.role}</Chip>
                      </div>
                    </td>
                    <td style={td}>{fmtTime(r.punchInAt)}</td>
                    <td style={td}>
                      {r.lastPointAt ? (
                        <>
                          <span style={{ color: r.isStale ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                            {r.minutesSinceLastPoint === 0 ? 'just now' : `${r.minutesSinceLastPoint}m ago`}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtTime(r.lastPointAt)}</div>
                        </>
                      ) : <span style={{ color: 'var(--text-muted)' }}>no fix yet</span>}
                      {r.isStale ? <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>device offline?</div> : null}
                    </td>
                    <td style={{ ...td, fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                      {r.latitude != null ? `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}` : '—'}
                    </td>
                    <td style={td}>{fmtDistance(r.totalDistanceM)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button type="button" style={{ ...btn('ghost'), color: 'var(--accent-primary, #625afa)' }} onClick={() => onOpenTimeline(r.user, data.workDate)}>
                        <MapIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px', marginRight: 4 }} />
                        Route
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LiveTab;
