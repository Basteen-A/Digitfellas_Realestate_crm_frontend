import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  UserGroupIcon, ShieldCheckIcon, TrashIcon, PencilSquareIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import {
  th, td, inputStyle, labelStyle, btn, Chip, EmptyState, Spinner,
} from '../ui';

// ============================================================
// Who's Tracked - attach a policy to a ROLE or to one PERSON.
//
// Precedence, and the whole reason this screen has two tabs:
//     a USER row beats a ROLE row beats the default policy.
// So an admin sets the floor once per role, then carves out the handful of
// people who work differently - without cloning a policy for each of them.
//
// "Inherit" is a real, distinct third state on the two switches. It is not the
// same as Off: a role set to "no tracking" with one person set to "inherit"
// means that person follows the role, whereas "Off" pins them off forever.
// ============================================================

const emptyForm = (scope) => ({
  scope,
  user_type_id: '',
  user_id: '',
  policy_id: '',
  tracking_enabled: null,   // null = inherit
  punch_mode: null,         // null = inherit
  is_enabled: true,
  notes: '',
  location_ids: [],
});

/** Inherit / On / Off, kept as a real tri-state rather than a checkbox. */
const TriState = ({ label, hint, value, onChange, onLabel = 'On', offLabel = 'Off' }) => (
  <div>
    <div style={labelStyle}>{label}</div>
    <div style={{ display: 'flex', gap: 6 }}>
      {[
        { v: null, l: 'Inherit' },
        { v: true, l: onLabel },
        { v: false, l: offLabel },
      ].map((opt) => (
        <button
          key={String(opt.v)}
          type="button"
          onClick={() => onChange(opt.v)}
          style={{ ...btn(value === opt.v ? 'primary' : 'default'), padding: '6px 12px', fontSize: 12, flex: 1 }}
        >
          {opt.l}
        </button>
      ))}
    </div>
    {hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.45 }}>{hint}</div> : null}
  </div>
);

const ConfigTab = ({ config, canWrite }) => {
  const [scope, setScope] = useState('ROLE');
  const [assignments, setAssignments] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, l, u] = await Promise.all([
        fieldTrackingApi.listAssignments(),
        fieldTrackingApi.listPolicies(),
        fieldTrackingApi.listLocations({ is_active: 'true' }),
        fieldTrackingApi.listUsers(),
      ]);
      setAssignments(a.data || []);
      setPolicies(p.data || []);
      setLocations(l.data || []);
      setUsers(u.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the tracking configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => assignments.filter((a) => a.scope === scope), [assignments, scope]);
  const defaultPolicy = useMemo(() => policies.find((p) => p.is_default), [policies]);

  // Roles that have no row yet - what the "add" picker offers.
  const unconfiguredRoles = useMemo(() => {
    const taken = new Set(assignments.filter((a) => a.scope === 'ROLE').map((a) => a.user_type_id));
    return (config?.roles || []).filter((r) => !taken.has(r.id));
  }, [assignments, config]);

  const unconfiguredUsers = useMemo(() => {
    const taken = new Set(assignments.filter((a) => a.scope === 'USER').map((a) => a.user_id));
    return users.filter((u) => !taken.has(u.id));
  }, [assignments, users]);

  const save = async (e) => {
    e.preventDefault();
    if (form.scope === 'ROLE' && !form.user_type_id) { toast.error('Pick a role'); return; }
    if (form.scope === 'USER' && !form.user_id) { toast.error('Pick a user'); return; }

    setSaving(true);
    try {
      const payload = {
        scope: form.scope,
        ...(form.scope === 'ROLE' ? { user_type_id: form.user_type_id } : { user_id: form.user_id }),
        policy_id: form.policy_id || null,
        tracking_enabled: form.tracking_enabled,
        punch_mode: form.punch_mode,
        is_enabled: Boolean(form.is_enabled),
        notes: form.notes || null,
        location_ids: form.location_ids || [],
      };
      await fieldTrackingApi.saveAssignment(payload);
      toast.success('Tracking configuration saved');
      setForm(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const who = row.scope === 'ROLE' ? row.userType?.type_name : row.user?.name;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove the tracking configuration for ${who}? They will fall back to the level above.`)) return;
    try {
      await fieldTrackingApi.deleteAssignment(row.id);
      toast.success('Configuration removed');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove'));
    }
  };

  const editRow = (row) => setForm({
    id: row.id,
    scope: row.scope,
    user_type_id: row.user_type_id || '',
    user_id: row.user_id || '',
    policy_id: row.policy_id || '',
    tracking_enabled: row.tracking_enabled,
    punch_mode: row.punch_mode,
    is_enabled: row.is_enabled,
    notes: row.notes || '',
    location_ids: (row.locations || []).map((l) => l.id),
  });

  const toggleLocation = (id) => {
    const current = form.location_ids || [];
    setForm({
      ...form,
      location_ids: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    });
  };

  // ── Form ──
  if (form) {
    const targetName = form.scope === 'ROLE'
      ? config?.roles?.find((r) => r.id === form.user_type_id)?.name
      : users.find((u) => u.id === form.user_id)?.name;

    return (
      <form onSubmit={save} style={{ maxWidth: 780 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {form.id ? `Tracking for ${targetName}` : `Configure tracking for a ${form.scope === 'ROLE' ? 'role' : 'person'}`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn()} onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" style={btn('primary')} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {!form.id ? (
            <div>
              <div style={labelStyle}>{form.scope === 'ROLE' ? 'Role *' : 'User *'}</div>
              {form.scope === 'ROLE' ? (
                <select required value={form.user_type_id} onChange={(e) => setForm({ ...form, user_type_id: e.target.value })} style={inputStyle}>
                  <option value="">Select a role…</option>
                  {unconfiguredRoles.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                </select>
              ) : (
                <select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} style={inputStyle}>
                  <option value="">Select a user…</option>
                  {unconfiguredUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}{u.employeeCode ? ` (${u.employeeCode})` : ''} - {u.role}</option>
                  ))}
                </select>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Super Admin and Admin are deliberately not listed - they run this module rather than being tracked by it.
              </div>
            </div>
          ) : null}

          <div>
            <div style={labelStyle}>Shift policy</div>
            <select value={form.policy_id} onChange={(e) => setForm({ ...form, policy_id: e.target.value })} style={inputStyle}>
              <option value="">
                Inherit{form.scope === 'USER' ? ' from the role' : ` (${defaultPolicy?.policy_name || 'default policy'})`}
              </option>
              {policies.filter((p) => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>{p.policy_name}{p.is_default ? ' (default)' : ''}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Decides the working hours, what counts as a full day, week-offs and the GPS cadence.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <TriState
              label="GPS tracking"
              value={form.tracking_enabled}
              onChange={(v) => setForm({ ...form, tracking_enabled: v })}
              hint="Inherit follows the policy. Off means punch in/out only - no route, no distance."
            />
            <TriState
              label="Punch from"
              value={form.punch_mode === null ? null : form.punch_mode === 'LOCATIONS'}
              onChange={(v) => setForm({ ...form, punch_mode: v === null ? null : (v ? 'LOCATIONS' : 'ANY') })}
              onLabel="Mapped only"
              offLabel="Anywhere"
              hint="Mapped only requires the user to be inside one of the geofences selected below."
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(form.is_enabled)} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
              Field tracking applies to {form.scope === 'ROLE' ? 'this role' : 'this person'}
            </label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginLeft: 22 }}>
              Unchecked switches the module off for them entirely - no punch screen, no tracking, no
              attendance rows. Use it to exempt one person from an otherwise tracked role.
            </div>
          </div>

          <div>
            <div style={labelStyle}>Permitted punch locations</div>
            {!locations.length ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                No punch locations exist yet. Create them on the Locations tab first.
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  border: '1px solid var(--border-primary)', borderRadius: 8, padding: 10,
                  maxHeight: 190, overflowY: 'auto', background: 'var(--bg-primary)',
                }}
                >
                  {locations.map((l) => {
                    const on = (form.location_ids || []).includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleLocation(l.id)}
                        style={{ ...btn(on ? 'primary' : 'default'), padding: '5px 11px', fontSize: 12 }}
                      >
                        {l.location_name}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.45 }}>
                  Only used when Punch from is <b>Mapped only</b>. Select none to inherit
                  {form.scope === 'USER' ? " the role's list" : ' - falling back to every active location'}.
                </div>
              </>
            )}
          </div>

          <div>
            <div style={labelStyle}>Notes</div>
            <input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Why this person is configured differently" style={inputStyle} />
          </div>
        </div>
      </form>
    );
  }

  // ── List ──
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary, rgba(100,116,139,0.08))', padding: 4, borderRadius: 10 }}>
          {[
            { v: 'ROLE', l: 'By role', icon: ShieldCheckIcon },
            { v: 'USER', l: 'By person', icon: UserGroupIcon },
          ].map((s) => (
            <button
              key={s.v}
              type="button"
              onClick={() => setScope(s.v)}
              style={{
                padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: scope === s.v ? 'var(--bg-secondary)' : 'transparent',
                color: scope === s.v ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: scope === s.v ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <s.icon style={{ width: 14, height: 14, display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
              {s.l}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {canWrite ? (
          <button type="button" style={btn('primary')} onClick={() => setForm(emptyForm(scope))}>
            <PlusIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            Configure a {scope === 'ROLE' ? 'role' : 'person'}
          </button>
        ) : null}
      </div>

      <div style={{
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6,
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        borderRadius: 10, padding: '10px 14px',
      }}
      >
        <b style={{ color: 'var(--text-secondary)' }}>How this resolves:</b>{' '}
        a <b>person&apos;s</b> row wins over their <b>role&apos;s</b> row, which wins over the default policy
        {defaultPolicy ? ` (${defaultPolicy.policy_name})` : ''}. Anything set to <b>Inherit</b> falls through
        to the next level down.
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && !assignments.length ? <Spinner /> : null}
        {!loading && !rows.length ? (
          <EmptyState
            icon={scope === 'ROLE' ? ShieldCheckIcon : UserGroupIcon}
            title={scope === 'ROLE' ? 'No role is configured yet' : 'No person is configured individually'}
            hint={
              scope === 'ROLE'
                ? 'Roles switched on under Settings but not configured here use the default policy.'
                : 'People follow their role unless you carve out an exception here.'
            }
          />
        ) : null}

        {rows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                <tr>
                  <th style={th}>{scope === 'ROLE' ? 'Role' : 'Person'}</th>
                  <th style={th}>Policy</th>
                  <th style={th}>Tracking</th>
                  <th style={th}>Punch from</th>
                  <th style={th}>Locations</th>
                  <th style={th}>Module</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>
                        {r.scope === 'ROLE' ? r.userType?.type_name : r.user?.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {r.scope === 'ROLE' ? r.userType?.short_code : (r.user?.employeeCode || '')}
                      </div>
                      {r.notes ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div> : null}
                    </td>
                    <td style={td}>
                      {r.policy?.policy_name || <span style={{ color: 'var(--text-muted)' }}>inherit</span>}
                    </td>
                    <td style={td}>
                      {r.tracking_enabled === null || r.tracking_enabled === undefined
                        ? <Chip>INHERIT</Chip>
                        : (r.tracking_enabled
                          ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">ON</Chip>
                          : <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">OFF</Chip>)}
                    </td>
                    <td style={td}>
                      {!r.punch_mode
                        ? <Chip>INHERIT</Chip>
                        : <Chip>{r.punch_mode === 'LOCATIONS' ? 'MAPPED ONLY' : 'ANYWHERE'}</Chip>}
                    </td>
                    <td style={td}>
                      {r.locations?.length
                        ? <span style={{ fontSize: 12 }}>{r.locations.map((l) => l.name).join(', ')}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>all / inherit</span>}
                    </td>
                    <td style={td}>
                      {r.is_enabled
                        ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">ENABLED</Chip>
                        : <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">EXEMPT</Chip>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canWrite ? (
                        <>
                          <button type="button" style={btn('ghost')} onClick={() => editRow(r)}>
                            <PencilSquareIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px' }} />
                          </button>
                          <button type="button" style={{ ...btn('ghost'), color: '#dc2626' }} onClick={() => remove(r)}>
                            <TrashIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px' }} />
                          </button>
                        </>
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

export default ConfigTab;
