import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPinIcon, PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import MapPicker from '../MapPicker';
import useGoogleMaps, { mapsErrorMessage } from '../useGoogleMaps';
import useParcelLayer from '../useParcelLayer';
import {
  th, td, inputStyle, labelStyle, btn, Chip, EmptyState, Spinner,
} from '../ui';

// ============================================================
// Punch locations - the places a field user may punch in and out from.
//
// Separate from the Locations master under Inventory: that one is "an area
// where we sell property", this one is "a place somebody may punch from".
// Nothing here touches that master, and the two never share a row.
//
// A location carries its end of the day: allow_punch_in / allow_punch_out.
// Both default on, because a place is normally where you both start and
// finish. Turning punch-out off models the common case directly - staff report
// to a site in the morning but are not expected to drive back to it at 7pm
// just to close the day.
//
// The map at the top of the list is the whole point of the screen: a geofence
// you cannot see is a geofence nobody can sanity-check. Every pin is drawn with
// its real radius circle, so an admin sees the actual punch area rather than
// guessing what "150 m" covers.
//
// Named land is listed here too. Every land parcel owns one punch location
// (server: landParcelService.syncLocation) - its name and position come from
// the land, so they are locked here; radius, punch in/out and Active are not.
// ============================================================

const TYPES = [
  { value: 'OFFICE', label: 'Office' },
  { value: 'SITE', label: 'Project Site' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'CLIENT', label: 'Client Location' },
  { value: 'OTHER', label: 'Other' },
];

const emptyForm = {
  location_name: '', address: '', city: '',
  latitude: null, longitude: null, radius_m: 150,
  location_type: 'OFFICE', description: '', sort_order: 0, is_active: true,
  allow_punch_in: true, allow_punch_out: true,
};

/**
 * All the punch locations on one map, with their real geofence circles.
 *
 * Read-only: clicking a pin selects the row rather than moving it. Editing a
 * position belongs in the form, where the radius is on screen next to it -
 * dragging a pin on an overview map is how somebody moves an office by 400 m
 * and does not notice.
 */
const OverviewMap = ({ apiKey, rows, selectedId, onSelect }) => {
  const { maps, error } = useGoogleMaps(apiKey);
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const shapesRef = useRef([]);

  useEffect(() => {
    if (!maps || !divRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new maps.Map(divRef.current, {
        center: { lat: 12.9716, lng: 77.5946 },
        zoom: 11,
        streetViewControl: false,
        clickableIcons: false,
        mapTypeControl: true,
      });
    }
    const map = mapRef.current;
    shapesRef.current.forEach((x) => x.setMap?.(null));
    shapesRef.current = [];

    const bounds = new maps.LatLngBounds();
    let any = false;

    rows.forEach((r) => {
      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const pos = { lat, lng };
      const on = selectedId === r.id;
      // Inactive places stay on the map but read grey - an admin needs to see
      // that the office they are looking for exists and is switched off, not
      // conclude it was never created.
      const tint = !r.is_active ? '#94a3b8' : (on ? '#dc2626' : '#625afa');

      const marker = new maps.Marker({
        map,
        position: pos,
        title: r.location_name,
        zIndex: on ? 999 : 1,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: on ? 9 : 6,
          fillColor: tint,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => onSelect(on ? null : r.id));

      const circle = new maps.Circle({
        map,
        center: pos,
        radius: Number(r.radius_m || 150),
        strokeColor: tint,
        strokeOpacity: 0.8,
        strokeWeight: on ? 2 : 1,
        fillColor: tint,
        fillOpacity: on ? 0.16 : 0.08,
      });

      shapesRef.current.push(marker, circle);
      bounds.extend(pos);
      any = true;
    });

    if (any) {
      const chosen = rows.find((r) => r.id === selectedId);
      if (chosen && Number.isFinite(Number(chosen.latitude))) {
        map.panTo({ lat: Number(chosen.latitude), lng: Number(chosen.longitude) });
        if (map.getZoom() < 15) map.setZoom(15);
      } else {
        map.fitBounds(bounds, 60);
        const once = maps.event.addListenerOnce(map, 'idle', () => {
          if (map.getZoom() > 16) map.setZoom(16);
        });
        shapesRef.current.push({ setMap: () => maps.event.removeListener(once) });
      }
    }
  }, [maps, rows, selectedId, onSelect]);

  // Named land, so a geofence can be checked against the plot it guards.
  // Must follow the effect that builds the map.
  useParcelLayer(maps, mapRef, {
    hasOwnContent: rows.some((r) => Number.isFinite(Number(r.latitude))),
    fitWhenAlone: true,
  });

  useEffect(() => () => {
    shapesRef.current.forEach((x) => x.setMap?.(null));
    shapesRef.current = [];
  }, []);

  if (!apiKey || error) {
    return (
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
        <EmptyState icon={MapPinIcon} title="Map unavailable" hint={mapsErrorMessage(error || 'NO_KEY')} />
      </div>
    );
  }
  return (
    <div
      ref={divRef}
      style={{
        height: 300, borderRadius: 12, border: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)', marginBottom: 14,
      }}
    />
  );
};

/** The two end-of-day switches, as one control so they read as a pair. */
const PunchToggles = ({ inOn, outOn, onChange }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    {[
      { key: 'allow_punch_in', on: inOn, label: 'Punch in here' },
      { key: 'allow_punch_out', on: outOn, label: 'Punch out here' },
    ].map((o) => (
      <button
        key={o.key}
        type="button"
        onClick={() => onChange(o.key, !o.on)}
        style={{
          flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
          border: `1px solid ${o.on ? 'var(--accent-primary, #625afa)' : 'var(--border-primary)'}`,
          background: o.on ? 'rgba(98,90,250,0.08)' : 'var(--bg-secondary)',
          color: o.on ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 13, fontWeight: o.on ? 700 : 500,
        }}
      >
        <span style={{ marginRight: 7 }}>{o.on ? '\u2713' : '\u00d7'}</span>
        {o.label}
      </button>
    ))}
  </div>
);

const LocationsTab = ({ config, canWrite, canDelete }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null); // null = list view
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  // Which pin/row is highlighted. Purely a focus aid - it filters nothing.
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.listLocations(search ? { search } : {});
      setRows(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load locations'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const save = async (e) => {
    e.preventDefault();
    if (form.latitude == null || form.longitude == null) {
      toast.error('Drop a pin on the map first');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        location_name: form.location_name,
        address: form.address || null,
        city: form.city || null,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_m: form.radius_m ? Number(form.radius_m) : null,
        location_type: form.location_type,
        description: form.description || null,
        sort_order: Number(form.sort_order) || 0,
        allow_punch_in: Boolean(form.allow_punch_in),
        allow_punch_out: Boolean(form.allow_punch_out),
        is_active: Boolean(form.is_active),
      };
      if (form.id) await fieldTrackingApi.updateLocation(form.id, payload);
      else await fieldTrackingApi.createLocation(payload);
      toast.success(form.id ? 'Location updated' : 'Location created');
      setForm(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save the location'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${row.location_name}"? Anyone restricted to it will fall back to their role's other locations.`)) return;
    try {
      await fieldTrackingApi.deleteLocation(row.id);
      toast.success('Location deleted');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete'));
    }
  };

  // ── Form view ──
  if (form) {
    const isLand = Boolean(form.land_parcel_id);
    const lockedStyle = isLand ? { ...inputStyle, opacity: 0.65, cursor: 'not-allowed' } : inputStyle;
    return (
      <form onSubmit={save}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {form.id ? 'Edit punch location' : 'New punch location'}
            {isLand ? <span style={{ marginLeft: 8 }}><Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">LAND</Chip></span> : null}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn()} onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" style={btn('primary')} disabled={saving}>{saving ? 'Saving…' : 'Save location'}</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.4fr)', gap: 20, alignItems: 'start' }}>
          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={labelStyle}>Location name *</div>
              <input
                required
                readOnly={isLand}
                value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                placeholder="e.g. Head Office - Jayanagar"
                style={lockedStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {isLand
                  ? `Comes from the land "${form.land_parcel_name}". Rename or redraw it on the Land Parcels tab and this location follows.`
                  : 'This is the name shown on the timeline and in every report.'}
              </div>
            </div>

            <div>
              <div style={labelStyle}>Type</div>
              <select value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })} style={inputStyle}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={labelStyle}>Latitude *</div>
                <input
                  required type="number" step="any" readOnly={isLand}
                  value={form.latitude ?? ''}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value === '' ? null : Number(e.target.value) })}
                  style={lockedStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>Longitude *</div>
                <input
                  required type="number" step="any" readOnly={isLand}
                  value={form.longitude ?? ''}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value === '' ? null : Number(e.target.value) })}
                  style={lockedStyle}
                />
              </div>
            </div>

            <div>
              <div style={labelStyle}>Punch radius (metres)</div>
              <input
                type="number" min={20} max={20000}
                value={form.radius_m ?? ''}
                onChange={(e) => setForm({ ...form, radius_m: e.target.value === '' ? null : Number(e.target.value) })}
                style={inputStyle}
                placeholder="Leave blank to use the policy default"
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                A user in LOCATIONS mode must be inside this circle to punch. Phone GPS is
                typically accurate to 10–30 m outdoors and much worse indoors, so anything
                under 50 m will reject honest punches.
                {isLand ? ' Set automatically to cover every corner of the land; redrawing the land resets it.' : ''}
              </div>
            </div>

            <div>
              <div style={labelStyle}>Valid for</div>
              <PunchToggles
                inOn={Boolean(form.allow_punch_in)}
                outOn={Boolean(form.allow_punch_out)}
                onChange={(key, val) => setForm({ ...form, [key]: val })}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                Only matters for people whose punch mode is &quot;Only mapped
                locations&quot;. Turn punch-out off for a site staff report to in
                the morning but are not expected back at to close the day.
              </div>
              {!form.allow_punch_in && !form.allow_punch_out ? (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 5, fontWeight: 600 }}>
                  With both off this location cannot be punched from at all.
                </div>
              ) : null}
            </div>

            <div>
              <div style={labelStyle}>Address</div>
              <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={labelStyle}>City</div>
                <input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>Sort order</div>
                <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
          </div>

          {/* Map */}
          <div>
            <div style={labelStyle}>{isLand ? 'Centre of the land' : 'Pin the location'}</div>
            <MapPicker
              readOnly={isLand}
              apiKey={config?.mapsBrowserKey}
              latitude={form.latitude}
              longitude={form.longitude}
              radiusM={form.radius_m || 150}
              onChange={({ latitude, longitude, address }) => setForm((f) => ({
                ...f,
                latitude,
                longitude,
                // Only auto-fill the address when the admin has not typed one.
                address: f.address ? f.address : (address || f.address),
              }))}
              height={420}
            />
          </div>
        </div>
      </form>
    );
  }

  // ── List view ──
  return (
    <div>
      {rows.length ? (
        <OverviewMap
          apiKey={config?.mapsBrowserKey}
          rows={rows}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 200 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>SEARCH</div>
          <input placeholder="Location name" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
        </div>
        {canWrite ? (
          <button type="button" style={btn('primary')} onClick={() => setForm({ ...emptyForm })}>
            <PlusIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            New location
          </button>
        ) : null}
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && !rows.length ? <Spinner /> : null}
        {!loading && !rows.length ? (
          <EmptyState
            icon={MapPinIcon}
            title="No punch locations yet"
            hint="Create the offices and sites your field staff punch from. Until at least one exists, everyone configured for LOCATIONS mode falls back to punching from anywhere."
          />
        ) : null}

        {rows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Type</th>
                  <th style={th}>Coordinates</th>
                  <th style={th}>Radius</th>
                  <th style={th}>Punch</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                    style={{
                      cursor: 'pointer',
                      background: selectedId === r.id ? 'rgba(98,90,250,0.07)' : undefined,
                    }}
                  >
                    <td style={td}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {r.location_name}
                        {r.land_parcel_id ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">LAND</Chip> : null}
                      </div>
                      {r.land_parcel_id ? (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Named land · {r.land_parcel_name}</div>
                      ) : null}
                      {r.address ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.address}</div> : null}
                    </td>
                    <td style={td}><Chip>{TYPES.find((t) => t.value === r.location_type)?.label || r.location_type}</Chip></td>
                    <td style={{ ...td, fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                      {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                    </td>
                    <td style={td}>{r.radius_m ? `${r.radius_m} m` : <span style={{ color: 'var(--text-muted)' }}>policy default</span>}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {r.allow_punch_in === false && r.allow_punch_out === false ? (
                        <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">NEITHER</Chip>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          {r.allow_punch_in !== false ? <Chip>IN</Chip> : null}
                          {r.allow_punch_out !== false ? <Chip>OUT</Chip> : null}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      {r.is_active
                        ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">ACTIVE</Chip>
                        : <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">INACTIVE</Chip>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canWrite ? (
                        <button type="button" style={btn('ghost')} onClick={(e) => { e.stopPropagation(); setForm({ ...r }); }}>
                          <PencilSquareIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px' }} />
                        </button>
                      ) : null}
                      {/* Land goes away with its parcel, on the Land Parcels tab. */}
                      {canDelete && !r.land_parcel_id ? (
                        <button type="button" style={{ ...btn('ghost'), color: '#dc2626' }} onClick={(e) => { e.stopPropagation(); remove(r); }}>
                          <TrashIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px' }} />
                        </button>
                      ) : null}
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

export default LocationsTab;
