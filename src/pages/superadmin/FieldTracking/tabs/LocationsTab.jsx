import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MapPinIcon, PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import MapPicker from '../MapPicker';
import {
  th, td, inputStyle, labelStyle, btn, Chip, EmptyState, Spinner,
} from '../ui';

// ============================================================
// Punch locations - the places a field user may punch in and out from.
//
// Separate from the Locations master under Inventory: that one is "an area
// where we sell property", this one is "a place somebody may punch from".
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
};

const LocationsTab = ({ config, canWrite, canDelete }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null); // null = list view
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

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
    return (
      <form onSubmit={save}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {form.id ? 'Edit punch location' : 'New punch location'}
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
                value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                placeholder="e.g. Head Office — Jayanagar"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                This is the name shown on the timeline and in every report.
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
                  required type="number" step="any"
                  value={form.latitude ?? ''}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value === '' ? null : Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>
              <div>
                <div style={labelStyle}>Longitude *</div>
                <input
                  required type="number" step="any"
                  value={form.longitude ?? ''}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value === '' ? null : Number(e.target.value) })}
                  style={inputStyle}
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
              </div>
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
            <div style={labelStyle}>Pin the location</div>
            <MapPicker
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
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.location_name}</div>
                      {r.address ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.address}</div> : null}
                    </td>
                    <td style={td}><Chip>{TYPES.find((t) => t.value === r.location_type)?.label || r.location_type}</Chip></td>
                    <td style={{ ...td, fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>
                      {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                    </td>
                    <td style={td}>{r.radius_m ? `${r.radius_m} m` : <span style={{ color: 'var(--text-muted)' }}>policy default</span>}</td>
                    <td style={td}>
                      {r.is_active
                        ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">ACTIVE</Chip>
                        : <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">INACTIVE</Chip>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canWrite ? (
                        <button type="button" style={btn('ghost')} onClick={() => setForm({ ...r })}>
                          <PencilSquareIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px' }} />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button type="button" style={{ ...btn('ghost'), color: '#dc2626' }} onClick={() => remove(r)}>
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
