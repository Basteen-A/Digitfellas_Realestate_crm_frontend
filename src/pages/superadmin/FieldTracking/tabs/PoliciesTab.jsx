import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClockIcon, PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import {
  th, td, inputStyle, labelStyle, btn, Chip, EmptyState, Spinner, fmtDuration, WEEKDAYS,
} from '../ui';

// ============================================================
// Shift policies - the rules that decide Present / Half Day / Absent, when
// the day is late, which weekdays are off, and how GPS behaves.
//
// A policy is attached to roles and users on the Who's Tracked tab. Exactly
// one policy is the org-wide default and is used by anyone with no assignment.
// ============================================================

const emptyForm = {
  policy_name: '',
  description: '',
  work_start_time: '09:30',
  work_end_time: '18:30',
  late_grace_minutes: 15,
  auto_punch_out_time: '21:00',
  full_day_minutes: 480,
  half_day_minutes: 240,
  week_off_days: [0],
  count_travel_time: true,
  tracking_enabled: true,
  ping_interval_seconds: 300,
  track_after_punch_out: false,
  max_accuracy_m: 100,
  halt_min_minutes: 10,
  halt_radius_m: 100,
  punch_mode: 'ANY',
  default_radius_m: 150,
  enforce_punch_out_location: false,
  block_mock_location: true,
  is_default: false,
  is_active: true,
};

const Field = ({ label, hint, children }) => (
  <div>
    <div style={labelStyle}>{label}</div>
    {children}
    {hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.45 }}>{hint}</div> : null}
  </div>
);

const Toggle = ({ label, hint, checked, onChange }) => (
  <label style={{ display: 'block', cursor: 'pointer' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </div>
    {hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, marginLeft: 22, lineHeight: 1.45 }}>{hint}</div> : null}
  </label>
);

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 22 }}>
    <div style={{
      fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
      paddingBottom: 8, marginBottom: 14, borderBottom: '1px solid var(--border-primary)',
    }}
    >
      {title}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
      {children}
    </div>
  </div>
);

const PoliciesTab = ({ canWrite, canDelete }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.listPolicies();
      setRows(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load policies'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (Number(form.half_day_minutes) > Number(form.full_day_minutes)) {
      toast.error('Half-day minutes cannot exceed full-day minutes');
      return;
    }
    setSaving(true);
    try {
      const { id, created_at: c, updated_at: u, created_by: cb, updated_by: ub, is_deleted: d, ...payload } = form;
      payload.week_off_days = (form.week_off_days || []).map(Number);
      payload.auto_punch_out_time = form.auto_punch_out_time || null;
      if (id) await fieldTrackingApi.updatePolicy(id, payload);
      else await fieldTrackingApi.createPolicy(payload);
      toast.success(id ? 'Policy updated' : 'Policy created');
      setForm(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save the policy'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete the policy "${row.policy_name}"?`)) return;
    try {
      await fieldTrackingApi.deletePolicy(row.id);
      toast.success('Policy deleted');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete'));
    }
  };

  const toggleWeekOff = (day) => {
    const current = form.week_off_days || [];
    setForm({
      ...form,
      week_off_days: current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    });
  };

  // ── Form ──
  if (form) {
    return (
      <form onSubmit={save}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            {form.id ? `Edit "${form.policy_name}"` : 'New shift policy'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn()} onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" style={btn('primary')} disabled={saving}>{saving ? 'Saving…' : 'Save policy'}</button>
          </div>
        </div>

        <Section title="Identity">
          <Field label="Policy name *">
            <input required value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} placeholder="e.g. Field Sales — 9:30 to 6:30" style={inputStyle} />
          </Field>
          <Field label="Description">
            <input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} />
          </Field>
        </Section>

        <Section title="Working hours">
          <Field label="Day starts">
            <input type="time" value={form.work_start_time} onChange={(e) => setForm({ ...form, work_start_time: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Day ends">
            <input type="time" value={form.work_end_time} onChange={(e) => setForm({ ...form, work_end_time: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Late grace (minutes)" hint="Punching in later than the start time plus this is flagged LATE. The punch is still accepted.">
            <input type="number" min={0} max={480} value={form.late_grace_minutes} onChange={(e) => setForm({ ...form, late_grace_minutes: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <Field
            label="Auto punch-out at"
            hint="Anyone still punched in at this time is closed automatically — but stamped at the DAY END time above, not at this one, so a forgotten punch-out never credits extra hours. Clear it to never auto-close."
          >
            <input type="time" value={form.auto_punch_out_time || ''} onChange={(e) => setForm({ ...form, auto_punch_out_time: e.target.value })} style={inputStyle} />
          </Field>
        </Section>

        <Section title="Present / Half day / Absent">
          <Field label={`Full day = at least (minutes)`} hint={`${fmtDuration(form.full_day_minutes)} or more counts PRESENT.`}>
            <input type="number" min={1} max={1440} value={form.full_day_minutes} onChange={(e) => setForm({ ...form, full_day_minutes: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <Field label="Half day = at least (minutes)" hint={`${fmtDuration(form.half_day_minutes)} up to a full day counts HALF DAY. Below that is ABSENT even though they punched in.`}>
            <input type="number" min={1} max={1440} value={form.half_day_minutes} onChange={(e) => setForm({ ...form, half_day_minutes: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={labelStyle}>Week offs</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {WEEKDAYS.map((d, i) => {
                const on = (form.week_off_days || []).includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleWeekOff(i)}
                    style={{
                      ...btn(on ? 'primary' : 'default'),
                      padding: '6px 12px', fontSize: 12,
                    }}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              These days are reported WEEK OFF instead of ABSENT when nobody punches in.
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Toggle
              label="Count travel time as worked time"
              hint="ON (field staff): the whole punched-in day counts as worked. OFF (desk roles): only the time spent stationary at a stop counts, so travelling between places is excluded."
              checked={form.count_travel_time}
              onChange={(v) => setForm({ ...form, count_travel_time: v })}
            />
          </div>
        </Section>

        <Section title="GPS tracking">
          <div style={{ gridColumn: '1 / -1' }}>
            <Toggle
              label="Track location during the working day"
              hint="Off means punch in/out only — no route, no distance, no halts."
              checked={form.tracking_enabled}
              onChange={(v) => setForm({ ...form, tracking_enabled: v })}
            />
          </div>
          <Field label="Ping every (seconds)" hint="300 s (5 minutes) is the designed cadence. Shorter drains the battery fast and produces more data without a more useful route.">
            <input type="number" min={60} max={3600} step={30} value={form.ping_interval_seconds} onChange={(e) => setForm({ ...form, ping_interval_seconds: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <Field label="Ignore fixes worse than (metres)" hint="A GPS reading with poor accuracy is stored but left out of distance, so one bad fix cannot add kilometres.">
            <input type="number" min={10} max={5000} value={form.max_accuracy_m} onChange={(e) => setForm({ ...form, max_accuracy_m: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Toggle
              label="Keep tracking after punch-out"
              hint="Normally off. Leaving it on records people outside their working day."
              checked={form.track_after_punch_out}
              onChange={(v) => setForm({ ...form, track_after_punch_out: v })}
            />
          </div>
        </Section>

        <Section title="Halt detection">
          <Field label="A stop counts after (minutes)" hint="Shorter pauses — traffic lights, a quick call — stay part of the journey.">
            <input type="number" min={1} max={600} value={form.halt_min_minutes} onChange={(e) => setForm({ ...form, halt_min_minutes: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <Field label="Within a radius of (metres)" hint="Indoor GPS drifts 20–40 m, so anything under ~50 m will split one visit into several stops.">
            <input type="number" min={20} max={5000} value={form.halt_radius_m} onChange={(e) => setForm({ ...form, halt_radius_m: Number(e.target.value) })} style={inputStyle} />
          </Field>
        </Section>

        <Section title="Punch rules">
          <Field label="Punch from" hint="LOCATIONS restricts punching to the geofences mapped on the Who's Tracked tab.">
            <select value={form.punch_mode} onChange={(e) => setForm({ ...form, punch_mode: e.target.value })} style={inputStyle}>
              <option value="ANY">Anywhere (GPS still captured)</option>
              <option value="LOCATIONS">Only mapped locations</option>
            </select>
          </Field>
          <Field label="Default geofence radius (metres)" hint="Used for any location that has no radius of its own.">
            <input type="number" min={20} max={20000} value={form.default_radius_m} onChange={(e) => setForm({ ...form, default_radius_m: Number(e.target.value) })} style={inputStyle} />
          </Field>
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle
              label="Require punch-out inside a location too"
              hint="Off by default: field staff finish the day wherever the last visit was, so forcing them back to an office to punch out just produces false absences."
              checked={form.enforce_punch_out_location}
              onChange={(v) => setForm({ ...form, enforce_punch_out_location: v })}
            />
            <Toggle
              label="Block mock locations"
              hint="Rejects a punch when the phone reports the fix came from a location-spoofing app."
              checked={form.block_mock_location}
              onChange={(v) => setForm({ ...form, block_mock_location: v })}
            />
          </div>
        </Section>

        <Section title="Status">
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle
              label="Make this the default policy"
              hint="Used by every role and user with no policy of their own. Exactly one policy holds this."
              checked={form.is_default}
              onChange={(v) => setForm({ ...form, is_default: v })}
            />
            <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </Section>
      </form>
    );
  }

  // ── List ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.5 }}>
          A policy decides what counts as a full day, which weekdays are off, how often GPS
          records a point and whether punching is restricted to mapped locations. Attach one to a
          role or a person on the <b>Who&apos;s Tracked</b> tab.
        </div>
        {canWrite ? (
          <button type="button" style={btn('primary')} onClick={() => setForm({ ...emptyForm })}>
            <PlusIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            New policy
          </button>
        ) : null}
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && !rows.length ? <Spinner /> : null}
        {!loading && !rows.length ? <EmptyState icon={ClockIcon} title="No policies yet" hint="Run the migration to seed the default policy, or create one here." /> : null}

        {rows.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
                <tr>
                  <th style={th}>Policy</th>
                  <th style={th}>Hours</th>
                  <th style={th}>Full / Half day</th>
                  <th style={th}>Week offs</th>
                  <th style={th}>Tracking</th>
                  <th style={th}>Punch</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.policy_name}
                        {r.is_default ? <Chip bg="rgba(98,90,250,0.14)" fg="#625afa">DEFAULT</Chip> : null}
                        {!r.is_active ? <Chip bg="rgba(220,38,38,0.12)" fg="#dc2626">INACTIVE</Chip> : null}
                      </div>
                      {r.description ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.description}</div> : null}
                    </td>
                    <td style={td}>
                      {r.work_start_time} – {r.work_end_time}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.late_grace_minutes}m grace</div>
                    </td>
                    <td style={td}>
                      {fmtDuration(r.full_day_minutes)} / {fmtDuration(r.half_day_minutes)}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        travel {r.count_travel_time ? 'counts' : 'excluded'}
                      </div>
                    </td>
                    <td style={td}>
                      {(r.week_off_days || []).length
                        ? (r.week_off_days || []).map((d) => WEEKDAYS[d]?.slice(0, 3)).join(', ')
                        : <span style={{ color: 'var(--text-muted)' }}>none</span>}
                    </td>
                    <td style={td}>
                      {r.tracking_enabled
                        ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">{`ON · ${Math.round(r.ping_interval_seconds / 60)}m`}</Chip>
                        : <Chip>OFF</Chip>}
                    </td>
                    <td style={td}>
                      <Chip>{r.punch_mode === 'LOCATIONS' ? 'GEOFENCED' : 'ANYWHERE'}</Chip>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {canWrite ? (
                        <button type="button" style={btn('ghost')} onClick={() => setForm({ ...r })}>
                          <PencilSquareIcon style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-3px' }} />
                        </button>
                      ) : null}
                      {canDelete && !r.is_default ? (
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

export default PoliciesTab;
