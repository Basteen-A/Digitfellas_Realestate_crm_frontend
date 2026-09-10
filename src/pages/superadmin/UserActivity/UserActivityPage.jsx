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
// ── Styling ─────────────────────────────────────────────────────────────────
// Built from the .col-* family (col-stat-card-new / col-card-new / col-table-new) -
// the same components as the admin Dashboard this page sits directly under, NOT the
// Reports KpiCard, which paints a coloured top rule and a coloured icon on every
// card. Stat cards here are monochrome with a 12%-opacity watermark icon. The only
// colour on the page is a status badge (the app's one sanctioned exception) and the
// two chart series, where green/red carries the same success/failure meaning it does
// on call logs and badges everywhere else.
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
  SignalIcon, ClockIcon, InboxStackIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';

import userTypeApi from '../../../api/userTypeApi';
import userApi from '../../../api/userApi';
import userActivityApi from '../../../api/userActivityApi';
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

// Status badges are the one place colour is allowed, per the app's badge system.
const OUTCOME_BADGE = {
  SUCCESS: 'col-badge-verified',
  FAILED: 'col-badge-rejected',
  LOGOUT: 'col-badge-neutral',
  PENDING: 'col-badge-pending',
};

// ── Monochrome stat card, identical markup to the admin Dashboard's ──
const StatCard = ({ label, value, sub, icon: Icon }) => (
  <div className="col-stat-card-new">
    <div className="col-stat-label-new">{label}</div>
    <div className="col-stat-value-new">{value}</div>
    <div className="col-stat-sub-new">{sub}</div>
    <div className="col-stat-icon-new">
      <Icon style={{ width: 24, height: 24 }} />
    </div>
  </div>
);

const Panel = ({ title, subtitle, children, flush }) => (
  <div className="col-card-new">
    <div className="col-card-header-new">
      <div>
        <div className="col-card-title-new">{title}</div>
        {subtitle && <div className="col-card-subtitle-new">{subtitle}</div>}
      </div>
    </div>
    <div className={flush ? 'col-card-body-flush-new' : 'col-card-body-new'}>{children}</div>
  </div>
);

const Note = ({ children }) => (
  <div className="ua-note">
    <InformationCircleIcon style={{ width: 17, height: 17, flexShrink: 0, marginTop: 1 }} />
    <div>{children}</div>
  </div>
);

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
            className="col-btn col-btn-ghost"
            onClick={() => load()}
            disabled={!userId || loading}
          >
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Empty / loading ── */}
      {!userId && (
        <div className="col-card-new ua-empty">
          <UserCircleIcon style={{ width: 44, height: 44, opacity: 0.2, margin: '0 auto 12px' }} />
          <div>Select a role and a user to view their activity.</div>
        </div>
      )}

      {userId && loading && !data && (
        <div className="col-card-new ua-empty">Loading activity…</div>
      )}

      {data && (
        <>
          {/* ── Identity strip ── */}
          <div className="ua-identity">
            <div className="ua-identity__avatar">
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
              <span className={`col-badge-new ${data.user.isActive ? 'col-badge-verified' : 'col-badge-rejected'}`}>
                {data.user.isActive ? 'Active' : 'Inactive'}
              </span>
              {access.isLocked && <span className="col-badge-new col-badge-rejected">Locked</span>}
              {sessions.active > 0 && (
                <span className="col-badge-new col-badge-new-status">
                  {sessions.active} live session{sessions.active === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>

          {/* ── Workload ── */}
          <Note>
            Workload figures use the same rules as this user&apos;s own workspace tabs, including your
            timezone for the day boundary — <strong>Hot</strong> is flag-based (new and re-enquired leads
            awaiting their first touch), <strong>Today</strong> and <strong>Missed</strong> count open
            leads only, and Missed excludes the Reallot pool.
          </Note>

          <div className="col-stat-grid-new">
            <StatCard label="Hot Leads" value={cnt(leads.hot)} sub="awaiting first touch" icon={FireIcon} />
            <StatCard label="Today's Follow Ups" value={cnt(leads.todayFollowUps)} sub="due today" icon={CalendarDaysIcon} />
            <StatCard label="Missed Follow Ups" value={cnt(leads.missedFollowUps)} sub="overdue" icon={ExclamationTriangleIcon} />
            <StatCard label="Open Leads" value={cnt(leads.openLeads)} sub={`${cnt(leads.totalAssigned)} assigned all-time`} icon={InboxStackIcon} />
            <StatCard label="Active Sessions" value={cnt(sessions.active)} sub={`${cnt(sessions.total)} device${sessions.total === 1 ? '' : 's'} on record`} icon={SignalIcon} />
            <StatCard label="Distinct IPs" value={cnt(sessions.uniqueIps)} sub={`${cnt(win.distinctIps)} in last ${win.days}d`} icon={GlobeAltIcon} />
          </div>

          {leads.noFollowUpDate > 0 && (
            <Note>
              <strong>{cnt(leads.noFollowUpDate)}</strong> open lead{leads.noFollowUpDate === 1 ? ' has' : 's have'} no
              follow-up date at all. Those are invisible in every follow-up tab — they are neither due nor overdue —
              so they will not appear in the counts above.
            </Note>
          )}

          {/* ── Access + trend ── */}
          <div className="ua-two-col">
            <Panel title="Access & Security" subtitle="Credentials and sign-in state" flush>
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
                    ? <span className="col-badge-new col-badge-rejected">{cnt(access.failedLoginCount)} since last success</span>
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
                  <span className={`col-badge-new ${access.pushEnabled ? 'col-badge-verified' : 'col-badge-neutral'}`}>
                    {access.pushEnabled ? 'Registered' : 'Not registered'}
                  </span>
                </span>
              </div>
              <div className="ua-kv">
                <span className="ua-kv__label"><GlobeAltIcon style={{ width: 15, height: 15 }} />Account created</span>
                <span className="ua-kv__value">{fmtWhen(data.user.createdAt)}</span>
              </div>
            </Panel>

            <Panel
              title="Sign-in Activity"
              subtitle={`Last ${win.days} days · ${cnt(win.successfulLogins)} logins, ${cnt(win.failedLogins)} failed, ${cnt(win.logouts)} logouts`}
            >
              {trend.length === 0 ? (
                <div className="col-empty-mini">
                  <ClockIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                  <span>No sign-ins in this window</span>
                </div>
              ) : (
                <div className="ua-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary, #e5e7eb)" />
                      <XAxis dataKey="day" tick={{ fontSize: 10.5 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10.5 }} allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      {/* Green / red here is data encoding, not decoration - the same
                          success/failure pairing badges and call logs already use. */}
                      <Bar dataKey="Logins" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="Failed" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* ── Devices ── */}
          <Panel
            title="Devices & Sessions"
            subtitle={`${cnt(sessions.active)} active · ${cnt(sessions.expired)} expired`}
            flush
          >
            {data.devices.length === 0 ? (
              <div className="col-empty-mini">
                <ComputerDesktopIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No devices on record for this user.</span>
              </div>
            ) : (
              <div className="ua-table-scroll">
                <table className="col-table-new">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Platform</th>
                      <th>IP address</th>
                      <th>First seen</th>
                      <th>Last used</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.devices.map((d, i) => {
                      const Icon = platformIcon(d.platform);
                      return (
                        <tr key={d.deviceId || i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Icon style={{ width: 18, height: 18, color: 'var(--text-muted)', flexShrink: 0 }} />
                              <div>
                                <div className="col-cell-primary">{d.browser}</div>
                                <div className="col-cell-secondary">{d.os}</div>
                              </div>
                            </div>
                          </td>
                          <td><span style={{ textTransform: 'capitalize' }}>{d.platform}</span></td>
                          <td><span className="ua-mono">{d.ip || '-'}</span></td>
                          <td>{fmtWhen(d.createdAt)}</td>
                          <td>
                            <div className="col-cell-primary">{relative(d.lastUsedAt)}</div>
                            <div className="col-cell-secondary">{fmtWhen(d.lastUsedAt)}</div>
                          </td>
                          <td>
                            <span className={`col-badge-new ${d.isActive ? 'col-badge-verified' : 'col-badge-neutral'}`}>
                              {d.isActive ? 'Active' : 'Expired'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── Login history ── */}
          <Panel title="Sign-in History" subtitle={`Most recent ${data.history.length} events`} flush>
            {data.history.length === 0 ? (
              <div className="col-empty-mini">
                <ClockIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No sign-in history recorded for this user.</span>
              </div>
            ) : (
              <div className="ua-table-scroll ua-table-scroll--tall">
                <table className="col-table-new">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Event</th>
                      <th>Result</th>
                      <th>Channel</th>
                      <th>IP address</th>
                      <th>Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <div className="col-cell-primary">{fmtWhen(h.at)}</div>
                          <div className="col-cell-secondary">{relative(h.at)}</div>
                        </td>
                        <td>{h.action.replace('_', ' ')}</td>
                        <td>
                          <span className={`col-badge-new ${OUTCOME_BADGE[h.outcome] || 'col-badge-neutral'}`}>
                            {h.outcome}
                          </span>
                        </td>
                        <td>{h.channel || '-'}</td>
                        <td><span className="ua-mono">{h.ip || '-'}</span></td>
                        <td><span className="col-cell-secondary">{h.browser} / {h.os}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default UserActivityPage;
