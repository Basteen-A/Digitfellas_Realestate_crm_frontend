import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import reportApi from '../../../api/reportApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import { formatCurrency } from '../../../utils/formatters';
import {
  ChartBarIcon, UsersIcon, BuildingOffice2Icon, ArrowPathIcon,
  ArrowLeftIcon, PresentationChartLineIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import AnalyticsDashboard from './analytics/AnalyticsDashboard';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'wtd', label: 'Week to Date' },
  { key: 'mtd', label: 'Month to Date' },
];
const ROLES = [
  { code: 'TC', label: 'Telecaller' },
  { code: 'SM', label: 'Sales Manager' },
  { code: 'SH', label: 'Sales Head' },
  { code: 'COL', label: 'Collection' },
];

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const fullName = (f, l) => `${f || ''} ${l || ''}`.trim() || '—';
const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' };

const ReportsPage = () => {
  const [tab, setTab] = useState('users');      // 'users' | 'inventory'
  const [period, setPeriod] = useState('today');

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><ChartBarIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Reports</h1>
          <p className="hidden sm:block">User activity &amp; inventory cost reports</p>
        </div>
        <div className="crm-btn-group">
          <button className={`crm-btn ${tab === 'analytics' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setTab('analytics')}>
            <PresentationChartLineIcon style={{ width: 15, height: 15 }} /> Analytics
          </button>
          <button className={`crm-btn ${tab === 'users' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setTab('users')}>
            <UsersIcon style={{ width: 15, height: 15 }} /> User Activity
          </button>
          <button className={`crm-btn ${tab === 'inventory' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setTab('inventory')}>
            <BuildingOffice2Icon style={{ width: 15, height: 15 }} /> Inventory
          </button>
        </div>
      </div>

      {/* Shared period filter — Analytics has its own filter bar */}
      {tab !== 'analytics' && (
        <div className="crm-btn-group" style={{ marginBottom: 16 }}>
          {PERIODS.map((p) => (
            <button key={p.key} className={`crm-btn ${period === p.key ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'analytics' && <AnalyticsDashboard />}
      {tab === 'users' && <UserActivityReport period={period} />}
      {tab === 'inventory' && <InventoryReport period={period} />}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};

// ── USER ACTIVITY ──────────────────────────────────────────────────────────────
const UserActivityReport = ({ period }) => {
  const [role, setRole] = useState('TC');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const isCol = role === 'COL';

  const loadList = useCallback(async () => {
    setLoading(true); setDetail(null);
    try {
      const res = await reportApi.getUserActivity({ role, period });
      setUsers(res?.data?.users || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load report');
    } finally { setLoading(false); }
  }, [role, period]);

  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (userId) => {
    setDetailLoading(true);
    try {
      const res = await reportApi.getUserActivity({ role, period, userId });
      setDetail(res?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load user detail');
    } finally { setDetailLoading(false); }
  };

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(users, 25);

  if (detail) return <UserDetail detail={detail} isCol={isCol} loading={detailLoading} onBack={() => setDetail(null)} />;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select className="crm-form-select" style={{ width: 220 }} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <button className="crm-btn crm-btn-ghost" onClick={loadList}><ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh</button>
      </div>

      <div className="crm-card" style={{ overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No users found for this role.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Last Login</th>
                {isCol ? (
                  <>
                    <th style={th}>Payments</th>
                    <th style={th}>Collected</th>
                    <th style={th}>Bookings</th>
                  </>
                ) : (
                  <>
                    <th style={th}>Leads Created</th>
                    <th style={th}>Assigned</th>
                    <th style={th}>Handoffs</th>
                  </>
                )}
                <th style={th}>Follow-ups</th>
                <th style={th}>Answered</th>
                <th style={th}>No Answer</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((u) => (
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(u.id)}>
                  <td style={{ ...td, fontWeight: 600 }}>
                    {fullName(u.first_name, u.last_name)}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={td}>{fmtDateTime(u.last_login)}</td>
                  {isCol ? (
                    <>
                      <td style={td}>{u.payments_recorded ?? 0}</td>
                      <td style={{ ...td, fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(u.amount_collected || 0)}</td>
                      <td style={td}>{u.bookings_handled ?? 0}</td>
                    </>
                  ) : (
                    <>
                      <td style={td}>{u.leads_created ?? 0}</td>
                      <td style={td}>{u.leads_assigned ?? 0}</td>
                      <td style={td}>{u.handoffs ?? 0}</td>
                    </>
                  )}
                  <td style={td}>{u.followups ?? 0}</td>
                  <td style={{ ...td, color: 'var(--accent-green)', fontWeight: 600 }}>{u.calls_answered ?? 0}</td>
                  <td style={{ ...td, color: 'var(--accent-red)', fontWeight: 600 }}>{u.calls_no_answer ?? 0}</td>
                  <td style={{ ...td, color: 'var(--accent-blue)', fontWeight: 600 }}>View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </>
  );
};

const Metric = ({ label, value, color }) => (
  <div className="crm-card" style={{ padding: 16, minWidth: 130, flex: 1 }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text-primary)', marginTop: 4 }}>{value}</div>
  </div>
);

const UserDetail = ({ detail, isCol, loading, onBack }) => {
  const s = detail.summary || {};
  // Pair LOGIN/LOGOUT events into sessions
  const sessions = [];
  let openLogin = null;
  (detail.loginSessions || []).forEach((e) => {
    if (e.action === 'LOGIN') { if (openLogin) sessions.push({ login: openLogin, logout: null }); openLogin = e.created_at; }
    else if (e.action === 'LOGOUT') { sessions.push({ login: openLogin, logout: e.created_at }); openLogin = null; }
  });
  if (openLogin) sessions.push({ login: openLogin, logout: null });

  return (
    <div>
      <button className="crm-btn crm-btn-ghost" onClick={onBack} style={{ marginBottom: 14 }}><ArrowLeftIcon style={{ width: 15, height: 15 }} /> Back to list</button>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{fullName(s.first_name, s.last_name)}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>{s.email}</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {isCol ? (
          <>
            <Metric label="Payments" value={s.payments_recorded ?? 0} />
            <Metric label="Collected" value={formatCurrency(s.amount_collected || 0)} color="var(--accent-green)" />
            <Metric label="Bookings" value={s.bookings_handled ?? 0} />
          </>
        ) : (
          <>
            <Metric label="Leads Created" value={s.leads_created ?? 0} color="var(--accent-blue)" />
            <Metric label="Assigned" value={s.leads_assigned ?? 0} />
            <Metric label="Handoffs" value={s.handoffs ?? 0} />
          </>
        )}
        <Metric label="Follow-ups" value={s.followups ?? 0} />
        <Metric label="Answered" value={s.calls_answered ?? 0} color="var(--accent-green)" />
        <Metric label="No Answer" value={s.calls_no_answer ?? 0} color="var(--accent-red)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }} className="report-detail-grid">
        {/* Sessions */}
        <div className="crm-card">
          <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border-primary)' }}>Login Sessions</div>
          {sessions.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No login activity in this period.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Login</th><th style={th}>Logout</th></tr></thead>
              <tbody>
                {sessions.map((sess, i) => (
                  <tr key={i}><td style={td}>{fmtDateTime(sess.login)}</td><td style={td}>{sess.logout ? fmtDateTime(sess.logout) : <span style={{ color: 'var(--accent-green)' }}>Active</span>}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Breakdown */}
        <div className="crm-card">
          <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border-primary)' }}>
            {isCol ? 'Recent Payments' : 'Lead Status Breakdown'}
          </div>
          {isCol ? (
            (detail.recentPayments || []).length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No payments in this period.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Booking</th><th style={th}>Category</th><th style={th}>Amount</th></tr></thead>
                <tbody>
                  {detail.recentPayments.map((p, i) => (
                    <tr key={i}>
                      <td style={td}>{p.booking_number}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.buyer_name}</div></td>
                      <td style={td}>{p.payment_category || '—'}</td>
                      <td style={{ ...td, fontWeight: 600, color: p.is_refund ? 'var(--accent-red)' : 'var(--accent-green)' }}>{p.is_refund ? '-' : ''}{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            (detail.leadStatusBreakdown || []).length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No leads assigned.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Status</th><th style={th}>Count</th></tr></thead>
                <tbody>
                  {detail.leadStatusBreakdown.map((r, i) => (
                    <tr key={i}><td style={td}>{r.status_name}</td><td style={{ ...td, fontWeight: 600 }}>{r.count}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Recent activity timeline */}
      <div className="crm-card" style={{ marginTop: 16 }}>
        <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border-primary)' }}>Recent Activity (A→Z)</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (detail.activities || []).length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No activity in this period.</div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>When</th><th style={th}>Activity</th><th style={th}>Lead</th></tr></thead>
              <tbody>
                {detail.activities.map((a, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(a.performed_at)}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{(a.activity_type || '').replace(/_/g, ' ')}</span>
                      {a.title ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.title}</div> : null}
                    </td>
                    <td style={td}>{fullName(a.lead_first_name, a.lead_last_name)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── INVENTORY ───────────────────────────────────────────────────────────────────
const InventoryReport = ({ period }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    projectApi.getDropdown().then((r) => setProjects(r.data || [])).catch(() => {});
    locationApi.getDropdown().then((r) => setLocations(r.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.getInventory({ period, projectId, locationId });
      setData(res?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load inventory report');
    } finally { setLoading(false); }
  }, [period, projectId, locationId]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const unitsPg = usePagination(data?.units || [], 25);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <select className="crm-form-select" style={{ minWidth: 180 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All Projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name || p.name}</option>)}
        </select>
        <select className="crm-form-select" style={{ minWidth: 180 }} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.location_name || l.name}</option>)}
        </select>
        <button className="crm-btn crm-btn-ghost" onClick={load}><ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Metric label="Total Value" value={formatCurrency(t.totalValue || 0)} color="var(--accent-blue)" />
        <Metric label="Received" value={formatCurrency(t.totalReceived || 0)} color="var(--accent-green)" />
        <Metric label="Due" value={formatCurrency(t.totalDue || 0)} color="var(--accent-red)" />
        <Metric label="Refunds" value={formatCurrency(t.totalRefund || 0)} color="var(--accent-yellow)" />
        <Metric label="Received (period)" value={formatCurrency(t.receivedInPeriod || 0)} color="var(--accent-green)" />
        <Metric label="Units (booked/total)" value={`${t.bookedUnits || 0}/${t.totalUnits || 0}`} />
      </div>

      {loading ? (
        <div className="crm-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
          <RollupTable title="By Project" rows={data?.byProject} nameKey="project_name" />
          <RollupTable title="By Location" rows={data?.byLocation} nameKey="location_name" />
          <RollupTable title="By Collection User" rows={data?.byUser} nameKey="user_name" userMode />

          {/* Per-unit cost breakdown */}
          <div className="crm-card" style={{ marginTop: 16, overflowX: 'auto' }}>
            <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border-primary)' }}>Per-Unit Cost Detail</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={th}>Project / Unit</th>
                  <th style={th}>Status</th>
                  <th style={th}>Buyer</th>
                  <th style={th}>Plot Value</th>
                  <th style={th}>Stamp</th>
                  <th style={th}>Registration</th>
                  <th style={th}>Development</th>
                  <th style={th}>Net Amount</th>
                  <th style={th}>Received</th>
                  <th style={th}>Due</th>
                  <th style={th}>Refund</th>
                  <th style={th}>Collection By</th>
                </tr>
              </thead>
              <tbody>
                {unitsPg.pageItems.map((u) => (
                  <tr key={u.id}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {u.project_name}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.unit_number}{u.location_name ? ` · ${u.location_name}` : ''}</div>
                    </td>
                    <td style={td}>{u.unit_status}</td>
                    <td style={td}>{u.buyer_name || (u.booking_number ? '—' : 'Unbooked')}</td>
                    <td style={td}>{u.plot_value != null ? formatCurrency(u.plot_value) : '—'}</td>
                    <td style={td}>{u.stamp_value != null ? formatCurrency(u.stamp_value) : '—'}</td>
                    <td style={td}>{u.registration_exp != null ? formatCurrency(u.registration_exp) : '—'}</td>
                    <td style={td}>{u.development_charges != null ? formatCurrency(u.development_charges) : '—'}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{u.net_amount != null ? formatCurrency(u.net_amount) : '—'}</td>
                    <td style={{ ...td, color: 'var(--accent-green)', fontWeight: 600 }}>{u.total_paid != null ? formatCurrency(u.total_paid) : '—'}</td>
                    <td style={{ ...td, color: 'var(--accent-red)' }}>{u.due != null && u.booking_number ? formatCurrency(u.due) : '—'}</td>
                    <td style={td}>{u.refund_amount ? formatCurrency(u.refund_amount) : '—'}</td>
                    <td style={td}>{u.collection_manager || u.created_by_name || '—'}</td>
                  </tr>
                ))}
                {(!data?.units || data.units.length === 0) && (
                  <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={12}>No units found.</td></tr>
                )}
              </tbody>
            </table>
            <Pagination
              page={unitsPg.page}
              pageSize={unitsPg.pageSize}
              total={unitsPg.total}
              onPageChange={unitsPg.setPage}
              onPageSizeChange={unitsPg.setPageSize}
            />
          </div>
        </>
      )}
    </>
  );
};

const RollupTable = ({ title, rows, nameKey, userMode }) => (
  <div className="crm-card" style={{ marginTop: 16, overflowX: 'auto' }}>
    <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 14, borderBottom: '1px solid var(--border-primary)' }}>{title}</div>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={th}>{userMode ? 'User' : 'Name'}</th>
          {!userMode && <th style={th}>Units (booked/total)</th>}
          {userMode && <th style={th}>Bookings</th>}
          <th style={th}>Total Value</th>
          <th style={th}>Received</th>
          <th style={th}>Refund</th>
        </tr>
      </thead>
      <tbody>
        {(rows || []).map((r, i) => (
          <tr key={i}>
            <td style={{ ...td, fontWeight: 600 }}>{r[nameKey] || '—'}</td>
            {!userMode && <td style={td}>{r.booked_units || 0}/{r.total_units || 0}</td>}
            {userMode && <td style={td}>{r.bookings || 0}</td>}
            <td style={td}>{formatCurrency(r.total_value || 0)}</td>
            <td style={{ ...td, color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(r.total_received || 0)}</td>
            <td style={td}>{r.total_refund ? formatCurrency(r.total_refund) : '—'}</td>
          </tr>
        ))}
        {(!rows || rows.length === 0) && (
          <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={5}>No data.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

export default ReportsPage;
