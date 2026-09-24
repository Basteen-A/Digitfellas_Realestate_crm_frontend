import React, { useEffect, useRef, useState } from 'react';
import useGoogleMaps, { mapsErrorMessage } from './useGoogleMaps';
import { drawParcels, DEFAULT_PARCEL_COLOR } from './parcelOverlays';
import { EmptyState, inputStyle, Spinner, btn } from './ui';

// ============================================================
// ParcelDrawMap - every land parcel on one map, plus the boundary editor.
//
// While `drawing` is on:
//   click the map          adds a corner at the end of the boundary
//   drag a corner          moves it
//   drag an edge midpoint  inserts a corner there (Google's editable polygon)
//   right-click a corner   deletes it
//
// The boundary lives in the PARENT (`path`); this component only renders it
// and reports edits through onPathChange. Opens on satellite view, because a
// field boundary is traced against what is on the ground, not a road map.
// ============================================================

const DEFAULT_CENTER = { lat: 11.1271, lng: 78.6569 }; // Tamil Nadu

const samePath = (a, b) => a.length === b.length
  && a.every((p, i) => Math.abs(p.lat - b[i].lat) < 1e-9 && Math.abs(p.lng - b[i].lng) < 1e-9);

const ParcelDrawMap = ({
  apiKey,
  parcels = [],
  selectedId = null,
  onSelect,
  drawing = false,
  path = [],
  color = DEFAULT_PARCEL_COLOR,
  editingId = null,
  onPathChange,
  height = 520,
}) => {
  const { maps, loading, error } = useGoogleMaps(apiKey);
  const divRef = useRef(null);
  const searchRef = useRef(null);
  const mapRef = useRef(null);
  const infoRef = useRef(null);
  const overlaysRef = useRef([]);
  const editorRef = useRef(null);
  const editorListenersRef = useRef([]);
  const meRef = useRef(null);
  const fittedRef = useRef(false);
  // Map listeners are bound once; read the latest props through refs.
  const drawingRef = useRef(drawing);
  const pathRef = useRef(path);
  const onPathChangeRef = useRef(onPathChange);
  drawingRef.current = drawing;
  pathRef.current = path;
  onPathChangeRef.current = onPathChange;
  const [locating, setLocating] = useState(false);

  // ── Build the map once ──
  useEffect(() => {
    if (!maps || !divRef.current || mapRef.current) return;
    const map = new maps.Map(divRef.current, {
      center: DEFAULT_CENTER,
      zoom: 7,
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
    });
    mapRef.current = map;
    infoRef.current = new maps.InfoWindow();

    map.addListener('click', (e) => {
      if (!drawingRef.current) return;
      onPathChangeRef.current?.([...pathRef.current, { lat: e.latLng.lat(), lng: e.latLng.lng() }]);
    });

    if (maps.places && searchRef.current) {
      const box = new maps.places.Autocomplete(searchRef.current, {
        fields: ['geometry', 'name'],
        componentRestrictions: { country: 'in' },
      });
      box.addListener('place_changed', () => {
        const place = box.getPlace();
        if (place?.geometry?.viewport) map.fitBounds(place.geometry.viewport);
        else if (place?.geometry?.location) { map.setCenter(place.geometry.location); map.setZoom(18); }
      });
    }
  }, [maps]);

  // ── The saved parcels ──
  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    const bounds = new maps.LatLngBounds();
    overlaysRef.current = drawParcels(maps, map, parcels, {
      selectedId,
      hiddenId: drawing ? editingId : null,
      info: drawing ? null : infoRef.current,
      onClick: drawing ? null : (p) => onSelect?.(p.id),
      bounds,
    });
    // Frame everything the first time there is something to frame.
    if (!fittedRef.current && !bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
      fittedRef.current = true;
    }
  }, [maps, parcels, selectedId, drawing, editingId, onSelect]);

  // Pan to a parcel picked from the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map || !selectedId || drawing) return;
    const p = parcels.find((x) => x.id === selectedId);
    if (!p?.boundary?.length) return;
    const b = new maps.LatLngBounds();
    p.boundary.forEach((pt) => b.extend(pt));
    map.fitBounds(b, 80);
  }, [maps, selectedId, parcels, drawing]);

  // ── The boundary being drawn / edited ──
  useEffect(() => {
    const map = mapRef.current;
    if (!maps || !map) return;
    map.setOptions({ draggableCursor: drawing ? 'crosshair' : null });

    if (!drawing) {
      editorListenersRef.current.forEach((l) => maps.event.removeListener(l));
      editorListenersRef.current = [];
      editorRef.current?.setMap(null);
      editorRef.current = null;
      return;
    }

    const readPath = () => editorRef.current.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
    const bindPathListeners = () => {
      editorListenersRef.current.forEach((l) => maps.event.removeListener(l));
      const mvc = editorRef.current.getPath();
      const emit = () => onPathChangeRef.current?.(readPath());
      editorListenersRef.current = [
        mvc.addListener('set_at', emit),
        mvc.addListener('insert_at', emit),
        mvc.addListener('remove_at', emit),
      ];
    };

    if (!editorRef.current) {
      editorRef.current = new maps.Polygon({
        map,
        paths: path,
        editable: true,
        strokeColor: color,
        strokeWeight: 3,
        fillColor: color,
        fillOpacity: 0.25,
        zIndex: 50,
      });
      // A click INSIDE the shape would otherwise be swallowed by the polygon
      // instead of adding a corner.
      editorRef.current.addListener('click', (e) => {
        if (e.vertex != null || e.edge != null) return;
        onPathChangeRef.current?.([...pathRef.current, { lat: e.latLng.lat(), lng: e.latLng.lng() }]);
      });
      editorRef.current.addListener('rightclick', (e) => {
        if (e.vertex == null) return;
        const next = pathRef.current.filter((_, i) => i !== e.vertex);
        onPathChangeRef.current?.(next);
      });
      bindPathListeners();
      if (path.length >= 2) {
        const b = new maps.LatLngBounds();
        path.forEach((pt) => b.extend(pt));
        map.fitBounds(b, 80);
      }
    } else if (!samePath(readPath(), path)) {
      // An edit from outside (undo, clear, a new corner) - replace the path and
      // re-bind, since setPath swaps the MVCArray the listeners were on.
      editorRef.current.setPath(path);
      bindPathListeners();
    }
    editorRef.current.setOptions({ strokeColor: color, fillColor: color });
  }, [maps, drawing, path, color]);

  // Tear everything down on unmount.
  useEffect(() => () => {
    overlaysRef.current.forEach((o) => o.setMap(null));
    editorRef.current?.setMap(null);
    meRef.current?.setMap(null);
  }, []);

  const goToMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const map = mapRef.current;
        if (!map || !maps) return;
        if (!meRef.current) {
          meRef.current = new maps.Marker({
            map,
            position: here,
            title: 'You are here',
            zIndex: 999,
            icon: {
              path: maps.SymbolPath.CIRCLE, scale: 8,
              fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3,
            },
          });
        } else {
          meRef.current.setPosition(here);
        }
        map.panTo(here);
        if (map.getZoom() < 17) map.setZoom(18);
      },
      () => { setLocating(false); window.alert('Could not read your location. Allow location access in the browser and try again.'); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (loading) return <Spinner label="Loading Google Maps..." />;
  if (error) {
    return (
      <div style={{ border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
        <EmptyState title="Map unavailable" hint={mapsErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input ref={searchRef} placeholder="Search a village, area or landmark..." style={{ ...inputStyle, flex: 1 }} />
        <button type="button" style={btn()} onClick={goToMyLocation} disabled={locating}>
          {locating ? 'Locating…' : '◎ My location'}
        </button>
      </div>
      <div
        ref={divRef}
        style={{
          height,
          width: '100%',
          borderRadius: 10,
          border: drawing ? '2px solid var(--accent-primary, #625afa)' : '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary, #eee)',
        }}
      />
    </div>
  );
};

export default ParcelDrawMap;
