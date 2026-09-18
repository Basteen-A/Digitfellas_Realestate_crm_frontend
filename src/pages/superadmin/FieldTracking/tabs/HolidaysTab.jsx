import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDaysIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import fieldTrackingApi from '../../../../api/fieldTrackingApi';
import { getErrorMessage } from '../../../../utils/helpers';
import {
  th, td, inputStyle, labelStyle, btn, Chip, EmptyState, Spinner, fmtDate, todayStr,
} from '../ui';

// ============================================================
// Company holidays.
//
// A date on this list is reported HOLIDAY instead of ABSENT for everybody it
// applies to, even though nobody punched in. Without it, every festival day
// shows up as a floor full of absences.
// ============================================================

const HolidaysTab = ({ config, canWrite, canDelete }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fieldTrackingApi.listHolidays();
      setRows(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load holidays'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        holiday_date: form.holiday_date,
        holiday_name: form.holiday_name,
        applies_to_roles: form.applies_to_roles || [],
        is_active: form.is_active !== false,
      };
      if (form.id) await fieldTrackingApi.updateHoliday(form.id, payload);
      else await fieldTrackingApi.createHoliday(payload);
      toast.success(form.id ? 'Holiday updated' : 'Holiday added');
      setForm(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${row.holiday_name}"?`)) return;
    try {
      await fieldTrackingApi.deleteHoliday(row.id);
      toast.success('Holiday deleted');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete'));
    }
  };

  const toggleRole = (code) => {
    const current = form.applies_to_roles || [];
    setForm({
      ...form,
      applies_to_roles: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.5 }}>
          Dates listed here are reported as <b>Holiday</b> rather than Absent, so a festival day does
          not read as a floor full of no-shows. Week-offs are set per policy; these are the one-off dates.
        </div>
        {canWrite ? (
          <button
            type="button"
            style={btn('primary')}
            onClick={() => setForm({ holiday_date: todayStr(), holiday_name: '', applies_to_roles: [], is_active: true })}
          >
            <PlusIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            Add holiday
          </button>
        ) : null}
      </div>

      {form ? (
        <form
          onSubmit={save}
          style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 12, padding: 16, marginBottom: 16, maxWidth: 620,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={labelStyle}>Date *</div>
              <input required type="date" value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Name *</div>
              <input required value={form.holiday_name} onChange={(e) => setForm({ ...form, holiday_name: e.target.value })} placeholder="e.g. Diwali" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Applies to</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(config?.roles || []).map((r) => {
                const on = (form.applies_to_roles || []).includes(r.code);
                return (
                  <button key={r.id} type="button" onClick={() => toggleRole(r.code)} style={{ ...btn(on ? 'primary' : 'default'), padding: '5px 11px', fontSize: 12 }}>
                    {r.code}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              Select none for a company-wide holiday.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btn()} onClick={() => setForm(null)}>Cancel</button>
            <button type="submit" style={btn('primary')} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      ) : null}

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 12, overflow: 'hidden' }}>
        {loading && !rows.length ? <Spinner /> : null}
        {!loading && !rows.length ? <EmptyState icon={CalendarDaysIcon} title="No holidays added" hint="Add your company holiday calendar so those days are not counted as absences." /> : null}

        {rows.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-tertiary, rgba(100,116,139,0.06))' }}>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Holiday</th>
                <th style={th}>Applies to</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(r.holiday_date)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.holiday_name}</td>
                  <td style={td}>
                    {(r.applies_to_roles || []).length
                      ? <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.applies_to_roles.map((c) => <Chip key={c}>{c}</Chip>)}</div>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Everyone</span>}
                  </td>
                  <td style={td}>
                    {r.is_active
                      ? <Chip bg="rgba(22,163,74,0.12)" fg="#16a34a">ACTIVE</Chip>
                      : <Chip>INACTIVE</Chip>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {canWrite ? (
                      <button type="button" style={btn('ghost')} onClick={() => setForm({ ...r, holiday_date: String(r.holiday_date).slice(0, 10) })}>Edit</button>
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
        ) : null}
      </div>
    </div>
  );
};

export default HolidaysTab;
