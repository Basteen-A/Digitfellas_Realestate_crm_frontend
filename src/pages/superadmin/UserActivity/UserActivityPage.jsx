// ============================================================
// USER ACTIVITY - Super Admin / Admin only
//
// Pick a role, pick a person, and see two things side by side:
//   1. What is on their plate      - hot leads, today's and missed follow-ups
//   2. How they are getting in     - sign-ins, devices, IPs, live sessions
//
// ── Why the counts can be trusted ───────────────────────────────────────────
// The lead numbers are computed server-side with the SAME clauses the user's own
// workspace tabs use (leadController.getAll), including the client timezone offset
// for the day boundary. So "Missed Follow Ups: 9" here is the same 9 that person
// sees when they open their own Missed tab - this page can never quote a different
// number for the same word.
//
// ── What is deliberately NOT shown ──────────────────────────────────────────
// The refresh token stored alongside each device is stripped on the server and never
// reaches this page. A device row identifies a session; it can never be used to
// resume one. There is also no "force logout" here - revoking someone's session is a
// write action, and this is a read-only supervisory view.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowPathIcon, UserCircleIcon, FireIcon, CalendarDaysIcon, ExclamationTriangleIcon,
  ComputerDesktopIcon, DevicePhoneMobileIcon, GlobeAltIcon, ShieldCheckIcon,
  ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, LockClosedIcon, KeyIcon,
  SignalIcon, ClockIcon, InboxStackIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';

import userTypeApi from '../../../api/userTypeApi';
import userApi from '../../../api/userApi';
import userActivityApi from '../../../api/userActivityApi';
import { KpiCard, KpiRow, Card, Table, Tr, Td, Pill, NoteBar } from '../Reports/analytics/ui';
import { COLORS } from '../Reports/analytics/palette';
import { formatDateTime, formatNumber } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import './UserActivity.css';

const num = (v) => Number(v) || 0;
const cnt = (v) => formatNumber(num(v));

const fmtWhen = (v) => (v ? formatDateTime(v) : '-');

// "3 hours ago" style relative age - the fastest way to read a device list.
const relative = (v) => {
  if (!v) return '-';
  const diff = Date.now() - new Date(v).getTime();
  if (Number.isNaN(diff)) return '-';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const platformIcon = (platform) => (
  String(platform).toLowerCase() === 'mobile' ? DevicePhoneMobileIcon : ComputerDesktopIcon
);

const OUTCOME_TONE = {
  SUCCESS: 'green',
  FAILED: 'red',
  LOGOUT: 'gray',
  PENDING: 'amber',
};

const UserActivityPage = () => {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [roleId, setRoleId] = useState('');
  const [userId, setUserId] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  // ── Roles ──
  useEffect(() => {
    let alive = true;
    userTypeApi.getDropdown()
      .then((res) => {
        if (!alive) return;
        const list = res?.data || res || [];
        setRoles(Array.isArray(list) ? list : []);
      })
      .catch((err) => toast.error(getErrorMessage(err)));
    return () => { alive = false; };
  }, []);

  // ── Users of the chosen role ──
  useEffect(() => {
    setUserId('');
    setData(null);
    if (!roleId) { setUsers([]); return undefined; }

    let alive = true;
    setUsersLoading(true);
    userApi.getDropdown({ user_type_id: roleId })
      .then((res) => {
        if (!alive) return;
        const list = res?.data || res || [];
        setUsers(Array.isArray(list) ? list : []);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => { if (alive) setUsersLoading(false); });
    return () => { alive = false; };
  }, [roleId]);

  const load = useCallback(async (id) => {
    const target = id || userId;
    if (!target) return;
    setLoading(true);
    try {
      const res = await userActivityApi.getActivity(target);
      setData(res?.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) load(userId); }, [userId, load]);

  const roleName = useMemo(
    () => roles.find((r) => r.id === roleId)?.type_name || '',
    [roles, roleId]
  );

  const leads = data?.leads;
  const access = data?.access;
  const sessions = data?.sessions;
  const win = data?.window;

  const trend = useMemo(() => (win?.trend || []).map((t) => ({
    day: new Date(`${String(t.date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    Logins: t.logins,
    Failed: t.failed,
  })), [win]);

  return (
    <div className="col-dashboard">
      {/* ── Header ── */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>User Activity</h1>
          <p>Pick a role and a team member to see their workload and how they have been signing in.</p>
        </div>
      </div>

      {/* ── Role → user picker ── */}
      <div className="ua-filter-bar">
        <div className="ua-filter">
          <label className="ua-filter__label" htmlFor="user-activity-role">Role</label>
          <select
            id="user-activity-role"
            className="ua-select"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">Select a role…</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.type_name}</option>
            ))}
          </select>
        </div>

        <div className="ua-filter">
          <label className="ua-filter__label" htmlFor="user-activity-user">
            User{roleName ? ` · ${roleName}` : ''}
          </label>
          <select
            id="user-activity-user"
            className="ua-select"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={!roleId || usersLoading}
          >
            <option value="">
              {!roleId ? 'Pick a role first' : usersLoading ? 'Loading…' : `Select a user… (${users.length})`}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
              </option>
            ))}
          </select>
        </div>

        <div className="ua-filter-actions">
          <button
            type="button"
            className="crm-btn crm-btn-ghost"
            onClick={() => load()}
            disabled={!userId || loading}
          >
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Empty / loading ── */}
      {!userId && (
        <div className="crm-card ua-empty">
          <UserCircleIcon style={{ width: 44, height: 44, opacity: 0.25, margin: '0 auto 12px' }} />
          <div>Select a role and a user to view their activity.</div>
        </div>
      )}

      {userId && loading && !data && (
        <div className="crm-card ua-empty">Loading activity…</div>
      )}

      {data && (
        <>
          {/* ── Identity strip ── */}
          <div className="ua-identity">
            <div className="crm-avatar crm-avatar-blue" style={{ width: 46, height: 46, fontSize: 16 }}>
              {(data.user.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ minWidth: 180 }}>
              <div className="ua-identity__name">{data.user.name}</div>
              <div className="ua-identity__meta">
                {data.user.role}
                {data.user.employeeId ? ` · ${data.user.employeeId}` : ''}
              </div>
            </div>
            <div className="ua-identity__contact">
              {data.user.email && <span>{data.user.email}</span>}
              {data.user.phone && <span>{data.user.phone}</span>}
              {data.user.username && <span>Login ID: {data.user.username}</span>}
            </div>
            <div className="ua-identity__badges">
              <Pill tone={data.user.isActive ? 'green' : 'red'}>{data.user.isActive ? 'Active' : 'Inactive'}</Pill>
              {access?.isLocked && <Pill tone="red">Locked</Pill>}
              {sessions?.active > 0 && <Pill tone="blue">{sessions.active} live session{sessions.active === 1 ? '' : 's'}</Pill>}
            </div>
          </div>

          {/* ── Workload ── */}
          <NoteBar>
            Workload figures use the same rules as this user&apos;s own workspace tabs, including your
            timezone for the day boundary — <strong>Hot</strong> is flag-based (new and re-enquired leads
            awaiting their first touch), <strong>Today</strong> and <strong>Missed</strong> count open
            leads only, and Missed excludes the Reallot pool.
          </NoteBar>

          <KpiRow>
            <KpiCard label="Hot Leads" value={cnt(leads.hot)} icon={FireIcon} color="#f97316"
              sub="awaiting first touch" />
            <KpiCard label="Today's Follow Ups" value={cnt(leads.todayFollowUps)} icon={CalendarDaysIcon} color={COLORS.primary}
              sub="due today" />
            <KpiCard label="Missed Follow Ups" value={cnt(leads.missedFollowUps)} icon={ExclamationTriangleIcon} color={COLORS.unanswered}
              sub="overdue" />
            <KpiCard label="Open Leads" value={cnt(leads.openLeads)} icon={InboxStackIcon} color={COLORS.leads}
              sub={`${cnt(leads.totalAssigned)} assigned all-time`} />
            <KpiCard label="Active Sessions" value={cnt(sessions.active)} icon={SignalIcon} color={COLORS.answered}
              sub={`${cnt(sessions.total)} device${sessions.total === 1 ? '' : 's'} on record`} />
            <KpiCard label="Distinct IPs" value={cnt(sessions.uniqueIps)} icon={GlobeAltIcon} color="#a855f7"
              sub={`${cnt(win.distinctIps)} in last ${win.days}d`} />
          </KpiRow>

          {leads.noFollowUpDate > 0 && (
            <NoteBar tone="#f59e0b">
              <strong>{cnt(leads.noFollowUpDate)}</strong> open lead{leads.noFollowUpDate === 1 ? ' has' : 's have'} no
              follow-up date at all. Those are invisible in every follow-up tab — they are neither due nor overdue —
              so they will not appear in the counts above.
            </NoteBar>
          )}

          {/* ── Access + trend ── */}
          <div className="ua-two-col">
            <Card title="Access & Security" sub="Credentials and sign-in state">
              <div className="ua-kv">
                <span className="ua-kv__label"><ArrowRightOnRectangleIcon style={{ width: 15, height: 15 }} />Last login</span>
                <span className="ua-kv__value">
                  {fmtWhen(access.lastLoginAt)}
                  <div className="ua-kv__sub">
                    {relative(access.lastLoginAt)}{access.lastLoginIp ? ` · ${access.lastLoginIp}` : ''}
                  </div>
                </span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><ArrowLeftOnRectangleIcon style={{ width: 15, height: 15 }} />Last logout</span>
                <span className="ua-kv__value">
                  {fmtWhen(access.lastLogoutAt)}
                  <div className="ua-kv__sub">{relative(access.lastLogoutAt)}</div>
                </span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><ShieldCheckIcon style={{ width: 15, height: 15 }} />Total logins</span>
                <span className="ua-kv__value">{cnt(access.loginCount)}</span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><LockClosedIcon style={{ width: 15, height: 15 }} />Failed attempts</span>
                <span className="ua-kv__value">
                  {num(access.failedLoginCount) > 0
                    ? <Pill tone="red">{cnt(access.failedLoginCount)} since last success</Pill>
                    : 'None'}
                </span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><KeyIcon style={{ width: 15, height: 15 }} />Password changed</span>
                <span className="ua-kv__value">{access.passwordChangedAt ? fmtWhen(access.passwordChangedAt) : 'Never'}</span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><DevicePhoneMobileIcon style={{ width: 15, height: 15 }} />Push notifications</span>
                <span className="ua-kv__value">
                  <Pill tone={access.pushEnabled ? 'green' : 'gray'}>{access.pushEnabled ? 'Registered' : 'Not registered'}</Pill>
                </span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><GlobeAltIcon style={{ width: 15, height: 15 }} />Account created</span>
                <span className="ua-kv__value">{fmtWhen(data.user.createdAt)}</span>
              </div>
            </Card>

            <Card title="Sign-in Activity" sub={`Last ${win.days} days · ${cnt(win.successfulLogins)} logins, ${cnt(win.failedLogins)} failed, ${cnt(win.logouts)} logouts`}>
              {trend.length === 0 ? (
                <div className="col-empty-mini" style={{ padding: 32 }}>
                  <ClockIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                  <span>No sign-ins in this window</span>
                </div>
              ) : (
                <div className="ua-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color, #e5e7eb)" />
                      <XAxis dataKey="day" tick={{ fontSize: 10.5 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10.5 }} allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="Logins" fill={COLORS.answered} radius={[3, 3, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="Failed" fill={COLORS.unanswered} radius={[3, 3, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* ── Devices ── */}
          <Card
            title="Devices & Sessions"
            sub={`${cnt(sessions.active)} active · ${cnt(sessions.expired)} expired`}
          >
            <Table
              head={['Device', 'Platform', 'IP address', 'First seen', 'Last used', 'Status']}
              colSpan={6}
              empty={data.devices.length === 0}
              emptyLabel="No devices on record - this user has not signed in since device tracking began."
            >
              {data.devices.map((d, i) => {
                const Icon = platformIcon(d.platform);
                return (
                  <Tr key={d.deviceId || i}>
                    <Td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon style={{ width: 18, height: 18, color: 'var(--text-muted)', flexShrink: 0 }} />
                        <div>
                          <div className="col-cell-primary">{d.browser}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.os}</div>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="col-cell-secondary" style={{ textTransform: 'capitalize' }}>{d.platform}</span></Td>
                    <Td><span className="ua-mono">{d.ip || '-'}</span></Td>
                    <Td><span className="col-cell-secondary">{fmtWhen(d.createdAt)}</span></Td>
                    <Td>
                      <div className="col-cell-primary">{relative(d.lastUsedAt)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtWhen(d.lastUsedAt)}</div>
                    </Td>
                    <Td>
                      <Pill tone={d.isActive ? 'green' : 'gray'}>{d.isActive ? 'Active' : 'Expired'}</Pill>
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          </Card>

          {/* ── Login history ── */}
          <Card title="Sign-in History" sub={`Most recent ${data.history.length} events`}>
            <Table
              head={['When', 'Event', 'Result', 'Channel', 'IP address', 'Device']}
              colSpan={6}
              empty={data.history.length === 0}
              emptyLabel="No sign-in history recorded for this user."
            >
              {data.history.map((h) => (
                <Tr key={h.id}>
                  <Td>
                    <div className="col-cell-primary">{fmtWhen(h.at)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{relative(h.at)}</div>
                  </Td>
                  <Td><span className="col-cell-secondary">{h.action.replace('_', ' ')}</span></Td>
                  <Td><Pill tone={OUTCOME_TONE[h.outcome] || 'gray'}>{h.outcome}</Pill></Td>
                  <Td><span className="col-cell-secondary">{h.channel || '-'}</span></Td>
                  <Td><span className="ua-mono">{h.ip || '-'}</span></Td>
                  <Td><span className="col-cell-secondary">{h.browser} / {h.os}</span></Td>
                </Tr>
              ))}
            </Table>
          </Card>
        </>
      )}
    </div>
  );
};

export default UserActivityPage;
