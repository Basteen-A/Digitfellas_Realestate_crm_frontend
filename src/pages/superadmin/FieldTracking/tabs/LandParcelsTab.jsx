import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon, TrashIcon, PencilSquareIcon, ArrowUturnLeftIcon, XMarkIcon, CheckIcon,
  Squares2X2Icon, UserPlusIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import ParcelDrawMap from '../ParcelDrawMap';
import {
  PARCEL_COLORS, DEFAULT_PARCEL_COLOR, SQ_M_PER_ACRE, fmtArea, fmtLength,
} from '../parcelOverlays';
import {
  th, td, inputStyle, labelStyle, btn, cardStyle, Chip, EmptyState, Spinner, StatRow, StatCard, fmtDate,
} from '../ui';

// ============================================================
// Land Parcels - named land boundaries drawn on the map.
//
// A parcel is an irregular polygon with any number of corners (not a pin and
// radius), measured on the server. Everyone with the field map sees every
// parcel - GPS-tracked reps on their phone Map tab, admins here and on the
// Route Timeline. Only admins and the users listed under "Who can draw" may
// add one; an editor can change only the parcels they drew.
// ============================================================

const emptyForm = { name: '', surveyNumber: '', surveyAreaAcres: '', description: '', color: DEFAULT_PARCEL_COLOR };

// Live preview only - the server re-measures on save and its figure is stored.
const measure = (path) => {
  const sph = window.google?.maps?.geometry?.spherical;
  if (!sph || path.length < 2) return { areaSqM: 0, perimeterM: 0 };
  return {
    areaSqM: path.length >= 3 ? sph.computeArea(path) : 0,
    perimeterM: sph.computeLength(path.length >= 3 ? [...path, path[0]] : path),
  };
};

const LandParcelsTab = ({ config, canWrite }) => {
  const [parcels, setParcels] = useState([]);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // Drawing state. editingId = null while drawing a NEW parcel.
  const [drawing, setDrawing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [path, setPath] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Who can draw.
  const [editors, setEditors] = useState([]);
  const [users, setUsers] = useState([]);
  const [pickUserId, setPickUserId] = useState('');

  const load = useCallback(async () => {
    try {
      const [acc, list] = await Promise.all([fieldTrackingApi.getLandAccess(), fieldTrackingApi.listParcels()]);
      setAccess(acc.data || null);
      setParcels(list.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load land parcels'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEditors = useCallback(async () => {
    try {
      const [ed, us] = await Promise.all([fieldTrackingApi.listParcelEditors(), fieldTrackingApi.listUsers()]);
      setEditors(ed.data || []);
      setUsers(us.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load who can draw'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadEditors(); }, [loadEditors]);

  const canDraw = Boolean(access?.canDraw);
  const selected = parcels.find((p) => p.id === selectedId) || null;
  const live = useMemo(() => measure(path), [path]);

  const totals = useMemo(() => ({
    count: parcels.length,
    acres: parcels.reduce((s, p) => s + (Number(p.areaSqM) || 0), 0) / SQ_M_PER_ACRE,
  }), [parcels]);

  // Every path edit goes through here so Undo can step back through it.
  const pathRef = useRef(path);
  pathRef.current = path;
  const changePath = useCallback((next) => {
    const prev = pathRef.current;
    setHistory((h) => [...h.slice(-49), prev]);
    pathRef.current = next;
    setPath(next);
  }, []);

  const startNew = () => {
    setSelectedId(null);
    setEditingId(null);
    setForm(emptyForm);
    setPath([]);
    setHistory([]);
    setDrawing(true);
  };

  const startEdit = (p) => {
    setSelectedId(p.id);
    setEditingId(p.id);
    setForm({
      name: p.name || '',
      surveyNumber: p.surveyNumber || '',
      surveyAreaAcres: p.surveyAreaAcres ?? '',
      description: p.description || '',
      color: p.color || DEFAULT_PARCEL_COLOR,
    });
    setPath(p.boundary || []);
    setHistory([]);
    setDrawing(true);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setEditingId(null);
    setPath([]);
    setHistory([]);
  };

  const undo = () => {
    if (!history.length) return;
    setPath(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Give the land a name.'); return; }
    if (path.length < 3) { toast.error('Mark at least 3 corners on the map.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        surveyNumber: form.surveyNumber || null,
        surveyAreaAcres: form.surveyAreaAcres === '' ? null : Number(form.surveyAreaAcres),
        description: form.description || null,
        color: form.color,
        boundary: path,
      };
      const resp = editingId
        ? await fieldTrackingApi.updateParcel(editingId, payload)
        : await fieldTrackingApi.createParcel(payload);
      toast.success(editingId ? 'Land parcel updated' : 'Land parcel saved - also added to Locations');
      cancelDrawing();
      await load();
      setSelectedId(resp.data?.id || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the land parcel'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? It will disappear from every map.`)) return;
    try {
      await fieldTrackingApi.deleteParcel(p.id);
      toast.success('Land parcel and its location deleted');
      if (selectedId === p.id) setSelectedId(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete the land parcel'));
    }
  };

  const grant = async () => {
    if (!pickUserId) return;
    try {
      const resp = await fieldTrackingApi.grantParcelEditor(pickUserId);
      setEditors(resp.data || []);
      setPickUserId('');
      toast.success('They can now draw land parcels');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not grant drawing access'));
    }
  };

  const revoke = async (e) => {
    if (!window.confirm(`Stop ${e.name} from drawing land parcels? Parcels they already drew are kept.`)) return;
    try {
      const resp = await fieldTrackingApi.revokeParcelEditor(e.userId);
      setEditors(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove drawing access'));
    }
  };

  if (loading) return <Spinner label="Loading land parcels…" />;

  const editorIds = new Set(editors.map((e) => e.userId));
  const pickable = users.filter((u) => !editorIds.has(u.id));

  return (
    <div>
      <StatRow style={{ marginBottom: 16 }}>
        <StatCard label="Land parcels" value={totals.count} />
        <StatCard label="Total drawn area" value={`${totals.acres.toFixed(2)} acres`} />
        <StatCard label="Users who can draw" value={editors.length} sub="plus admins" />
      </StatRow>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* ── Map ── */}
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          <ParcelDrawMap
            apiKey={config?.mapsBrowserKey}
            parcels={parcels}
            selectedId={selectedId}
            onSelect={setSelectedId}
            drawing={drawing}
            editingId={editingId}
            path={path}
            color={form.color}
            onPathChange={changePath}
          />
        </div>

        {/* ── Side panel ── */}
        <div style={{ ...cardStyle, flex: '0 1 340px', minWidth: 280 }}>
          {drawing ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                {editingId ? 'Edit land boundary' : 'Draw new land'}
              </div>
              <ol style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 18, margin: '0 0 12px', lineHeight: 1.6 }}>
                <li>Search the place or press <b>My location</b>.</li>
                <li>Click each corner of the land on the map, in order.</li>
                <li>Drag a corner to move it; drag a mid-point to add one; right-click a corner to delete it.</li>
              </ol>

              <div style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                borderRadius: 10, padding: 12, marginBottom: 12,
              }}
              >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{path.length >= 3 ? fmtArea(live.areaSqM) : '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {path.length} corner{path.length === 1 ? '' : 's'}
                  {path.length >= 2 ? ` · perimeter ${fmtLength(live.perimeterM)}` : ''}
                  {path.length < 3 ? ` · ${3 - path.length} more to close the shape` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <button type="button" style={btn()} onClick={undo} disabled={!history.length}>
                  <ArrowUturnLeftIcon style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />Undo
                </button>
                <button type="button" style={btn()} onClick={() => changePath([])} disabled={!path.length}>Clear</button>
              </div>

              <label style={labelStyle}>Land name *</label>
              <input style={{ ...inputStyle, marginBottom: 10 }} value={form.name} maxLength={150}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Green Valley Plot" />

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Survey no.</label>
                  <input style={{ ...inputStyle, marginBottom: 10 }} value={form.surveyNumber} maxLength={100}
                    onChange={(e) => setForm((f) => ({ ...f, surveyNumber: e.target.value }))} placeholder="123/4A" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Document acres</label>
                  <input style={{ ...inputStyle, marginBottom: 10 }} type="number" min="0" step="0.0001" value={form.surveyAreaAcres}
                    onChange={(e) => setForm((f) => ({ ...f, surveyAreaAcres: e.target.value }))} placeholder="2.50" />
                </div>
              </div>

              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, marginBottom: 10 }} rows={2} value={form.description} maxLength={2000}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />

              <label style={labelStyle}>Colour</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {PARCEL_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Colour ${c}`}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: form.color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={{ ...btn('primary'), flex: 1 }} onClick={save} disabled={saving}>
                  <CheckIcon style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />
                  {saving ? 'Saving…' : 'Save land'}
                </button>
                <button type="button" style={btn()} onClick={cancelDrawing} disabled={saving}>
                  <XMarkIcon style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Cancel
                </button>
              </div>
            </>
          ) : selected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: selected.color || DEFAULT_PARCEL_COLOR }} />
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtArea(selected.areaSqM)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Perimeter {fmtLength(selected.perimeterM)} · {selected.vertexCount} corners
              </div>
              {selected.surveyNumber || selected.surveyAreaAcres != null ? (
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  {selected.surveyNumber ? <>Survey No. <b>{selected.surveyNumber}</b></> : null}
                  {selected.surveyAreaAcres != null ? <> · <b>{selected.surveyAreaAcres}</b> acres on document</> : null}
                </div>
              ) : null}
              {selected.description ? <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{selected.description}</div> : null}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                Drawn by {selected.createdByName || '—'} on {fmtDate(selected.createdAt)}
              </div>
              {selected.canEdit ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" style={btn()} onClick={() => startEdit(selected)}>
                    <PencilSquareIcon style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />Edit
                  </button>
                  <button type="button" style={btn('danger')} onClick={() => remove(selected)}>
                    <TrashIcon style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />Delete
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Land parcels</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Click a parcel on the map or in the list to see its area. Field users who are tracked with GPS see
                these on their phone map, alongside their own route.
              </div>
              {canDraw ? (
                <button type="button" style={btn('primary')} onClick={startNew}>
                  <PlusIcon style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />Draw new land
                </button>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>You can view parcels but not draw them.</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div style={{ ...cardStyle, padding: 0, marginTop: 16, overflowX: 'auto' }}>
        {parcels.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Drawn area</th>
                <th style={th}>Perimeter</th>
                <th style={th}>Survey</th>
                <th style={th}>Drawn by</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <tr key={p.id} onClick={() => !drawing && setSelectedId(p.id)}
                  style={{ cursor: drawing ? 'default' : 'pointer', background: p.id === selectedId ? 'var(--bg-primary)' : 'transparent' }}>
                  <td style={td}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 8, background: p.color || DEFAULT_PARCEL_COLOR }} />
                    <b>{p.name}</b>
                  </td>
                  <td style={td}>{fmtArea(p.areaSqM)}</td>
                  <td style={td}>{fmtLength(p.perimeterM)}</td>
                  <td style={td}>
                    {p.surveyNumber || '—'}
                    {p.surveyAreaAcres != null ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.surveyAreaAcres} acres on document</div> : null}
                  </td>
                  <td style={td}>{p.createdByName || '—'}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(p.createdAt)}</div></td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.canEdit && !drawing ? (
                      <>
                        <button type="button" style={btn('ghost')} title="Edit" onClick={(e) => { e.stopPropagation(); startEdit(p); }}>
                          <PencilSquareIcon style={{ width: 16, height: 16 }} />
                        </button>
                        <button type="button" style={{ ...btn('ghost'), color: '#dc2626' }} title="Delete" onClick={(e) => { e.stopPropagation(); remove(p); }}>
                          <TrashIcon style={{ width: 16, height: 16 }} />
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={Squares2X2Icon} title="No land parcels yet" hint={canDraw ? 'Press "Draw new land" and click the corners of the land on the map.' : null} />
        )}
      </div>

      {/* ── Who can draw ── */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Who can draw land</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px' }}>
          Admins can always draw. Add the field users who should be able to mark land from their phone - they
          can change only the parcels they drew themselves. Everyone who has the field map can see every parcel.
        </div>

        {canWrite ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <select style={{ ...inputStyle, flex: '1 1 260px', width: 'auto' }} value={pickUserId} onChange={(e) => setPickUserId(e.target.value)}>
              <option value="">Choose a user…</option>
              {pickable.map((u) => (
                <option key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ''}{u.employeeCode ? ` - ${u.employeeCode}` : ''}</option>
              ))}
            </select>
            <button type="button" style={btn('primary')} onClick={grant} disabled={!pickUserId}>
              <UserPlusIcon style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 4 }} />Allow to draw
            </button>
          </div>
        ) : null}

        {editors.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {editors.map((e) => (
              <span key={e.userId} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                border: '1px solid var(--border-primary)', borderRadius: 999, fontSize: 13, background: 'var(--bg-primary)',
              }}
              >
                <b>{e.name}</b>
                {e.role ? <Chip>{e.role}</Chip> : null}
                {canWrite ? (
                  <button type="button" onClick={() => revoke(e)} title="Remove" aria-label={`Remove ${e.name}`}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    <XMarkIcon style={{ width: 14, height: 14 }} />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nobody besides admins can draw yet.</div>
        )}
      </div>
    </div>
  );
};

export default LandParcelsTab;
