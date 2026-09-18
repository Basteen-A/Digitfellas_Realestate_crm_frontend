import React, { useCallback, useEffect, useRef, useState } from 'react';
import useGoogleMaps, { mapsErrorMessage } from './useGoogleMaps';
import { EmptyState, inputStyle, Spinner } from './ui';

// ============================================================
// MapPicker - drop a pin to define a punch location.
//
// Click the map, drag the marker, or search an address. The circle is the
// geofence at its current radius, so the admin sees the actual punch area
// rather than guessing what "150 m" covers.
// ============================================================

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bengaluru

const MapPicker = ({
  apiKey,
  latitude,
  longitude,
  radiusM = 150,
  onChange,          // ({ latitude, longitude, address }) => void
  height = 360,
}) => {
  const { maps, loading, error } = useGoogleMaps(apiKey);
  const divRef = useRef(null);
  const searchRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const geocoderRef = useRef(null);
  const [ready, setReady] = useState(false);

  const hasPin = latitude != null && longitude != null
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  // Reverse-geocode a dropped pin so the admin gets a readable address for free.
  // Failure is non-fatal: the coordinate is what matters, the address is a label.
  const emit = useCallback((lat, lng) => {
    if (!geocoderRef.current) {
      onChange?.({ latitude: lat, longitude: lng, address: null });
      return;
    }
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      const address = status === 'OK' && results?.[0] ? results[0].formatted_address : null;
      onChange?.({ latitude: lat, longitude: lng, address });
    });
  }, [onChange]);

  // ── Build the map once the SDK is up ──
  useEffect(() => {
    if (!maps || !divRef.current || mapRef.current) return;

    const center = hasPin ? { lat: Number(latitude), lng: Number(longitude) } : DEFAULT_CENTER;
    const map = new maps.Map(divRef.current, {
      center,
      zoom: hasPin ? 16 : 12,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
    });
    mapRef.current = map;
    geocoderRef.current = new maps.Geocoder();

    map.addListener('click', (e) => emit(e.latLng.lat(), e.latLng.lng()));

    // Places autocomplete, when the library is available.
    if (maps.places && searchRef.current) {
      const box = new maps.places.Autocomplete(searchRef.current, {
        fields: ['geometry', 'formatted_address', 'name'],
        componentRestrictions: { country: 'in' },
      });
      box.addListener('place_changed', () => {
        const place = box.getPlace();
        if (!place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        map.setCenter({ lat, lng });
        map.setZoom(17);
        onChange?.({ latitude: lat, longitude: lng, address: place.formatted_address || place.name || null });
      });
    }

    setReady(true);
  }, [maps, hasPin, latitude, longitude, emit, onChange]);

  // ── Keep marker + circle in step with the props ──
  useEffect(() => {
    if (!maps || !mapRef.current) return;

    if (!hasPin) {
      markerRef.current?.setMap(null);
      circleRef.current?.setMap(null);
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const pos = { lat: Number(latitude), lng: Number(longitude) };

    if (!markerRef.current) {
      markerRef.current = new maps.Marker({
        position: pos,
        map: mapRef.current,
        draggable: true,
        title: 'Drag to adjust',
      });
      markerRef.current.addListener('dragend', (e) => emit(e.latLng.lat(), e.latLng.lng()));
    } else {
      markerRef.current.setPosition(pos);
    }

    if (!circleRef.current) {
      circleRef.current = new maps.Circle({
        map: mapRef.current,
        center: pos,
        radius: Number(radiusM) || 150,
        strokeColor: '#625afa',
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: '#625afa',
        fillOpacity: 0.12,
      });
    } else {
      circleRef.current.setCenter(pos);
      circleRef.current.setRadius(Number(radiusM) || 150);
    }

    mapRef.current.panTo(pos);
  }, [maps, hasPin, latitude, longitude, radiusM, emit]);

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
      <input
        ref={searchRef}
        placeholder="Search an address or place, or click the map to drop a pin"
        style={{ ...inputStyle, marginBottom: 8 }}
      />
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
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        {hasPin
          ? `Pin at ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)} — drag it to adjust. The shaded circle is the ${Number(radiusM) || 150} m punch area.`
          : 'Click anywhere on the map to drop the pin.'}
        {ready ? '' : ' '}
      </div>
    </div>
  );
};

export default MapPicker;
