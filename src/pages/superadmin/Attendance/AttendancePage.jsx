import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FingerPrintIcon, ArrowPathIcon, MapPinIcon, Cog6ToothIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import attendanceApi from '../../../api/attendanceApi';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'top' };
const inputStyle = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

const chip = (bg, fg, label) => (
  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: bg, color: fg }}>{label}</span>
);

const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const AttendancePage = () => {
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState('');
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await attendanceApi.getDayView(date);
      setData(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load attendance'));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const resp = await attendanceApi.getSettings();
        setSettings(resp.data || null);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load attendance settings'));
      }
    })();
  }, []);

  const doAdminAction = async (userId, action) => {
    setActing(`${action}:${userId}`);
    try {
      if (action === 'in') await attendanceApi.adminCheckIn(userId);
      else await attendanceApi.adminCheckOut(userId);
      toast.success(action === 'in' ? 'User checked in' : 'User checked out');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setActing('');
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const resp = await attendanceApi.updateSettings({
        is_enforced: settings.is_enforced,
        checkin_deadline: settings.checkin_deadline,
        checkout_time: settings.checkout_time,
        default_radius_m: settings.default_radius_m,
        reallocation_enabled: settings.reallocation_enabled,
      });
      setSettings(resp.data || settings);
      toast.success('Attendance settings saved');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  const rows = data?.rows || [];
  const present = rows.filter((r) => r.checkinAt);
  const isToday = date === todayStr();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><FingerPrintIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Attendance</h1>
          <p className="hidden sm:block">Daily telecaller check-in / check-out — geofenced self check-in with admin override</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`crm-btn crm-btn-sm ${tab === 'daily' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setTab('daily')}>
            <CalendarDaysIcon style={{ width: 15, height: 15 }} /> Daily
          </button>
          <button type="button" className={`crm-btn crm-btn-sm ${tab === 'settings' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setTab('settings')}>
            <Cog6ToothIcon style={{ width: 15, height: 15 }} /> Settings
          </button>
        </div>
      </div>

      {settings && !settings.is_enforced && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          Attendance enforcement is <strong>OFF</strong> — telecallers are not asked to check in. Turn it on under Settings.
        </div>
      )}

      {tab === 'daily' && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Date</label>
              <input type="date" style={inputStyle} value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
              <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
              <div className="crm-card" style={{ padding: '8px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Present</div><div style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>{present.length}</div></div>
              <div className="crm-card" style={{ padding: '8px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Absent</div><div style={{ fontSize: 18, fontWeight: 800, color: '#991b1b' }}>{rows.length - present.length}</div></div>
            </div>
          </div>

          <div className="crm-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th}>User</th>
                    <th style={th}>Status</th>
                    <th style={th}>Check-In</th>
                    <th style={th}>Location</th>
                    <th style={th}>Check-Out</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>Loading…</td></tr>}
                  {!loading && rows.length === 0 && (
                    <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>No users in the enforced roles</td></tr>
                  )}
                  {!loading && rows.map((r) => (
                    <tr key={r.userId}>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.userName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.role || ''}</div>
                      </td>
                      <td style={td}>
                        {r.checkinAt
                          ? (r.checkoutAt ? chip('#e5e7eb', '#374151', 'Checked Out') : chip('#dcfce7', '#166534', 'Present'))
                          : chip('#fee2e2', '#991b1b', 'Absent')}
                      </td>
                      <td style={td}>
                        {fmtTime(r.checkinAt)}
                        {r.checkinAt && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.checkinMode === 'ADMIN' ? `by admin${r.checkinBy ? ` (${r.checkinBy})` : ''}` : (r.geofenceValidated ? 'geo-verified' : 'no geofence')}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        {r.checkinLocation ? (
                          <>
                            <MapPinIcon style={{ width: 13, height: 13, verticalAlign: 'text-top', marginRight: 3 }} />
                            {r.checkinLocation}
                            {r.checkinDistanceM != null && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(r.checkinDistanceM)}m from pin</div>}
                          </>
                        ) : '—'}
                      </td>
                      <td style={td}>
                        {fmtTime(r.checkoutAt)}
                        {r.checkoutAt && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {r.checkoutMode === 'AUTO' ? 'auto' : r.checkoutMode === 'ADMIN' ? 'by admin' : 'on logout'}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        {isToday && !r.checkinAt && (
                          <button
                            className="crm-btn crm-btn-sm crm-btn-primary"
                            disabled={acting === `in:${r.userId}`}
                            onClick={() => doAdminAction(r.userId, 'in')}
                          >
                            {acting === `in:${r.userId}` ? '…' : 'Check In'}
                          </button>
                        )}
                        {isToday && r.checkinAt && !r.checkoutAt && (
                          <button
                            className="crm-btn crm-btn-sm crm-btn-ghost"
                            disabled={acting === `out:${r.userId}`}
                            onClick={() => doAdminAction(r.userId, 'out')}
                          >
                            {acting === `out:${r.userId}` ? '…' : 'Check Out'}
                          </button>
                        )}
                        {(!isToday || (r.checkinAt && r.checkoutAt)) && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'settings' && settings && (
        <form onSubmit={saveSettings} className="crm-card" style={{ padding: 20, maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(settings.is_enforced)}
              onChange={(e) => setSettings((s) => ({ ...s, is_enforced: e.target.checked }))}
            />
            <div>
              <div style={{ fontWeight: 700 }}>Enforce daily check-in</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Telecallers must check in (inside their office geofence) after login before they can use the portal.</div>
            </div>
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Check-in allowed until</span>
              <input
                type="time"
                style={inputStyle}
                value={settings.checkin_deadline || '10:30'}
                onChange={(e) => setSettings((s) => ({ ...s, checkin_deadline: e.target.value }))}
                required
              />
              <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>After this time only an admin can check a user in.</small>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Auto check-out at</span>
              <input
                type="time"
                style={inputStyle}
                value={settings.checkout_time || '19:00'}
                onChange={(e) => setSettings((s) => ({ ...s, checkout_time: e.target.value }))}
                required
              />
              <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>Still-checked-in users are auto checked out; a logout after this time counts as the check-out.</small>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 240 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Default geofence radius (meters)</span>
            <input
              type="number"
              min="10"
              max="100000"
              style={inputStyle}
              value={settings.default_radius_m ?? 100}
              onChange={(e) => setSettings((s) => ({ ...s, default_radius_m: e.target.value }))}
              required
            />
            <small style={{ fontSize: 11, color: 'var(--text-muted)' }}>Used when a Location has no radius of its own (set per-location in Locations).</small>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(settings.reallocation_enabled)}
              onChange={(e) => setSettings((s) => ({ ...s, reallocation_enabled: e.target.checked }))}
            />
            <div>
              <div style={{ fontWeight: 700 }}>Re-allot leads of absent telecallers</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                After the check-in deadline, fresh auto-allocated leads (marketing API / inbound calls) sitting with users who did not check in are round-robin re-allotted within the lead's source pool to users who did. Shown in Reallocation History.
              </div>
            </div>
          </label>

          <div>
            <button type="submit" className="crm-btn crm-btn-primary" disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AttendancePage;
