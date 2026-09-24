import React, { useEffect, useRef } from 'react';
import useGoogleMaps, { mapsErrorMessage } from './useGoogleMaps';
import { EmptyState, Spinner, fmtTime, fmtDuration } from './ui';
import { drawParcels } from './parcelOverlays';

// ============================================================
// RouteMap - one person, one day.
//
//   green pin    punch in
//   red pin      punch out
//   numbered     each halt, in order, sized by how long they stopped
//   blue line    the GPS route between them
//   dashed rings the configured punch locations and their geofences
//   teal circle  a logged customer visit (red when no GPS stop confirms it)
//
// Halts and visits are deliberately different SHAPES, not just different
// colours: a halt is what the phone recorded, a visit is what the rep typed.
// Conflating them on the map would hide exactly the discrepancy an admin is
// looking for.
//
// Every overlay is torn down and rebuilt when the day changes. Google map
// objects are not React-managed: leaving them attached is the classic leak that
// leaves yesterday's route drawn under today's.
// ============================================================

const PIN = {
  start: '#16a34a',
  end: '#dc2626',
  halt: '#625afa',
  // Visits are drawn in a different colour AND a different shape (circle, not
  // teardrop) so a claimed visit is never mistaken for a GPS-detected stop.
  visit: '#0891b2',
  visitUnverified: '#dc2626',
};

// Stable default, so a caller that passes no parcels does not redraw every render.
const NO_PARCELS = [];

const svgPin = (maps, color, label) => ({
  path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
  fillColor: color,
  fillOpacity: 1,
  strokeColor: '#fff',
  strokeWeight: 2,
  scale: 1,
  labelOrigin: new maps.Point(0, -30),
});

const RouteMap = ({
  apiKey,
  session,
  halts = [],
  points = [],
  // The line to DRAW. When road matching is on this is the snapped road
  // geometry; otherwise it is the cleaned fixes with jitter thinned out.
  // Falls back to `points` so an un-summarised day still shows something.
  route = [],
  routeSource = 'RAW',
  locations = [],
  visits = [],
  // Land parcels, drawn underneath - context only, they do not move the frame.
  parcels = NO_PARCELS,
  height = 460,
}) => {
  const { maps, loading, error } = useGoogleMaps(apiKey);
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const infoRef = useRef(null);

  useEffect(() => {
    if (!maps || !divRef.current) return undefined;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(divRef.current, {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: false,
        clickableIcons: false,
      });
      infoRef.current = new maps.InfoWindow();
    }
    const map = mapRef.current;

    // Tear down the previous day before drawing this one.
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    const bounds = new maps.LatLngBounds();
    let anything = false;

    // -- Land parcels (no bounds: the day's route decides the frame) --
    overlaysRef.current.push(...drawParcels(maps, map, parcels, { info: infoRef.current }));

    // -- Configured punch locations, as dashed geofence rings --
    locations.forEach((loc) => {
      if (loc.latitude == null || loc.longitude == null) return;
      const circle = new maps.Circle({
        map,
        center: { lat: loc.latitude, lng: loc.longitude },
        radius: loc.radiusM || 150,
        strokeColor: '#64748b',
        strokeOpacity: 0.5,
        strokeWeight: 1,
        fillColor: '#64748b',
        fillOpacity: 0.05,
        clickable: false,
      });
      overlaysRef.current.push(circle);
    });

    // -- The route polyline --
    // Prefer the built route. Drawing straight through raw fixes is what makes
    // a sparse day look like a triangle of chords across buildings: the line
    // has to be the road geometry, not the sample points.
    const source = (route && route.length > 1) ? route : points;
    const snapped = routeSource === 'SNAPPED' && route && route.length > 1;
    const path = source
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({ lat: p.latitude, lng: p.longitude }));

    if (path.length > 1) {
      const line = new maps.Polyline({
        map,
        path,
        strokeColor: '#2563eb',
        strokeOpacity: snapped ? 0.85 : 0.6,
        strokeWeight: snapped ? 5 : 4,
        // A road-matched line is drawn solid; an unmatched one is dashed,
        // because it is an approximation and should not be read as a path
        // somebody actually drove.
        ...(snapped ? {} : {
          strokeOpacity: 0,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, strokeWeight: 3, scale: 3 },
            offset: '0',
            repeat: '14px',
          }],
        }),
        // Arrowheads along the line so the direction of travel is readable
        // without clicking anything.
        ...(snapped ? {
          icons: [{
            icon: { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.4, strokeColor: '#2563eb' },
            offset: '0',
            repeat: '120px',
          }],
        } : {}),
      });
      overlaysRef.current.push(line);
      path.forEach((p) => bounds.extend(p));
      anything = true;
    }

    // -- Halt markers, numbered in chronological order --
    halts.forEach((h, i) => {
      const isStart = h.haltType === 'START';
      const isEnd = h.haltType === 'END';
      const color = isStart ? PIN.start : (isEnd ? PIN.end : PIN.halt);
      const pos = { lat: h.latitude, lng: h.longitude };

      const marker = new maps.Marker({
        map,
        position: pos,
        icon: svgPin(maps, color),
        label: { text: String(i + 1), color: '#fff', fontSize: '11px', fontWeight: '700' },
        title: `${h.label} - ${h.durationLabel || fmtDuration(h.durationMinutes)}`,
        zIndex: 100 + i,
      });
      marker.addListener('click', () => {
        infoRef.current.setContent(`
          <div style="font-family:inherit;min-width:190px;max-width:280px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${i + 1}. ${escapeHtml(h.label)}</div>
            <div style="font-size:12px;color:#555">${fmtTime(h.startedAt)} – ${fmtTime(h.endedAt)}</div>
            <div style="font-size:12px;color:#555;margin-top:2px">Stopped for <b>${escapeHtml(h.durationLabel || fmtDuration(h.durationMinutes))}</b></div>
            ${h.locationName ? `<div style="font-size:11px;color:#16a34a;margin-top:4px">At ${escapeHtml(h.locationName)}</div>` : ''}
          </div>`);
        infoRef.current.open({ map, anchor: marker });
      });
      overlaysRef.current.push(marker);
      bounds.extend(pos);
      anything = true;
    });

    // -- Logged customer visits --
    // A halt is where the GPS says they stopped; a visit is who they say they
    // met. Drawn together so the two can be compared at a glance.
    visits.filter((v) => v.status !== 'CANCELLED').forEach((v) => {
      if (v.latitude == null || v.longitude == null) return;
      const pos = { lat: v.latitude, lng: v.longitude };
      const marker = new maps.Marker({
        map,
        position: pos,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: v.unverifiedByGps ? PIN.visitUnverified : PIN.visit,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: `${v.customerName} - ${v.durationMinutes != null ? fmtDuration(v.durationMinutes) : 'in progress'}`,
        zIndex: 500,
      });
      marker.addListener('click', () => {
        infoRef.current.setContent(`
          <div style="font-family:inherit;min-width:200px;max-width:300px">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${escapeHtml(v.customerName)}</div>
            <div style="font-size:11px;color:#0891b2;font-weight:700;margin-bottom:4px">CUSTOMER VISIT</div>
            <div style="font-size:12px;color:#555">${fmtTime(v.checkedInAt)}${v.checkedOutAt ? ` – ${fmtTime(v.checkedOutAt)}` : ' (still there)'}</div>
            ${v.durationMinutes != null ? `<div style="font-size:12px;color:#555;margin-top:2px">Stayed <b>${escapeHtml(fmtDuration(v.durationMinutes))}</b></div>` : ''}
            ${v.purpose ? `<div style="font-size:12px;color:#555;margin-top:4px">${escapeHtml(v.purpose)}</div>` : ''}
            ${v.leadNumber ? `<div style="font-size:11px;color:#625afa;margin-top:4px">${escapeHtml(v.leadNumber)}</div>` : ''}
            ${v.unverifiedByGps ? '<div style="font-size:11px;color:#dc2626;margin-top:6px;font-weight:700">No GPS stop matches this visit</div>' : ''}
          </div>`);
        infoRef.current.open({ map, anchor: marker });
      });
      overlaysRef.current.push(marker);
      bounds.extend(pos);
      anything = true;
    });

    // -- Punch markers, when they sit outside any detected halt --
    if (session?.punchInLat != null && session?.punchInLng != null) {
      const pos = { lat: session.punchInLat, lng: session.punchInLng };
      const m = new maps.Marker({
        map, position: pos, icon: svgPin(maps, PIN.start),
        label: { text: 'IN', color: '#fff', fontSize: '9px', fontWeight: '700' },
        title: `Punched in ${fmtTime(session.punchInAt)}`, zIndex: 999,
      });
      overlaysRef.current.push(m);
      bounds.extend(pos);
      anything = true;
    }
    if (session?.punchOutLat != null && session?.punchOutLng != null) {
      const pos = { lat: session.punchOutLat, lng: session.punchOutLng };
      const m = new maps.Marker({
        map, position: pos, icon: svgPin(maps, PIN.end),
        label: { text: 'OUT', color: '#fff', fontSize: '8px', fontWeight: '700' },
        title: `Punched out ${fmtTime(session.punchOutAt)}`, zIndex: 999,
      });
      overlaysRef.current.push(m);
      bounds.extend(pos);
      anything = true;
    }

    if (anything && !bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
      // fitBounds on a single point zooms to street level, which looks broken.
      const once = maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 17) map.setZoom(17);
      });
      overlaysRef.current.push({ setMap: () => maps.event.removeListener(once) });
    }

    return undefined;
  }, [maps, session, halts, points, route, routeSource, locations, visits, parcels]);

  // Detach every overlay on unmount.
  useEffect(() => () => {
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
  }, []);

  if (loading) return <Spinner label="Loading Google Maps..." />;
  if (error) {
    return (
      <div style={{ border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
        <EmptyState title="Map unavailable" hint={mapsErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div
      ref={divRef}
      style={{
        height,
        width: '100%',
        borderRadius: 10,
        border: '1px solid var(--border-primary)',
        background: 'var(--bg-tertiary, #eee)',
      }}
    />
  );
};

// InfoWindow takes an HTML string, so anything interpolated into it must be
// escaped - a halt address comes from Google and a location name from an admin,
// and neither is trusted markup.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export default RouteMap;
