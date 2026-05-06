import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ClipboardDocumentListIcon,
  BanknotesIcon,
  ClockIcon,
  ChartBarIcon,
  CreditCardIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const ICON_SIZE = { width: 22, height: 22 };

/* ═══════════════════════════════════════════
   COLLECTION DASHBOARD — Redesigned
   ═══════════════════════════════════════════ */
const CollectionDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResp, bookingsResp] = await Promise.all([
        dashboardApi.getCollectionStats(),
        bookingApi.getMyBookings({ limit: 5 }),
      ]);
      setStats(statsResp.data || null);
      setRecentBookings(bookingsResp.data?.data || bookingsResp.data || []);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load dashboard')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="col-empty">
      <div className="col-empty-icon"><ClockIcon style={{ width: 40, height: 40, color: 'var(--text-muted)' }} /></div>
      <div className="col-empty-title">Loading dashboard...</div>
    </div>
  );

  const cards = [
    { label: 'Active Bookings', value: stats?.activeBookings ?? 0, icon: <ClipboardDocumentListIcon style={ICON_SIZE} />, bg: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' },
    { label: 'Total Collected', value: formatCurrency(stats?.totalCollected ?? 0), icon: <BanknotesIcon style={ICON_SIZE} />, bg: 'var(--accent-green-bg)', color: 'var(--accent-green)' },
    { label: 'Pending Dues', value: formatCurrency(stats?.pendingDues ?? 0), icon: <ExclamationTriangleIcon style={ICON_SIZE} />, bg: 'var(--accent-red-bg)', color: 'var(--accent-red)' },
    { label: 'This Month', value: formatCurrency(stats?.monthRevenue ?? 0), icon: <ChartBarIcon style={ICON_SIZE} />, bg: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan, #22d3ee)' },
  ];

  const statusData = stats?.statusBreakdown || [];
  const maxStatus = Math.max(...statusData.map(s => parseInt(s.count) || 0), 1);

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Welcome, {user?.first_name || 'Collection Manager'} <BanknotesIcon style={{ width: 24, height: 24 }} /></h1>
          <p className="hidden sm:block">Manage bookings, payments, and development charges</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="col-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {cards.map(c => (
          <div className="col-stat-card" key={c.label}>
            <div className="col-stat-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div className="col-stat-info">
              <div className="col-stat-value">{c.value}</div>
              <div className="col-stat-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two Column: Status Chart + Recent Payments ── */}
      <div className="col-two-col">
        {/* Booking Status Breakdown */}
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title"><ChartBarIcon style={{ width: 16, height: 16 }} /> Booking Status Breakdown</div>
          </div>
          <div className="col-section-body">
            {statusData.length === 0 ? (
              <div className="col-empty" style={{ padding: 24 }}><div className="col-empty-desc">No booking data yet</div></div>
            ) : (
              <div className="col-status-bars">
                {statusData.map(s => {
                  const pct = Math.round(((parseInt(s.count) || 0) / maxStatus) * 100);
                  return (
                    <div className="col-status-bar-item" key={s.status_code}>
                      <div className="col-status-bar-val">{s.count}</div>
                      <div className="col-status-bar" style={{ height: `${Math.max(pct, 8)}%`, background: s.color_code || '#6B7280' }} />
                      <div className="col-status-bar-lbl">{s.status_name}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title"><CreditCardIcon style={{ width: 16, height: 16 }} /> Recent Payments</div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('payments')}>View All →</button>
          </div>
          <div className="col-section-body-flush">
            {(stats?.recentPayments || []).length === 0 ? (
              <div className="col-empty" style={{ padding: 24 }}><div className="col-empty-desc">No payments recorded yet</div></div>
            ) : (
              <table className="col-table">
                <thead><tr><th>Customer</th><th>Amount</th><th>Mode</th><th>Date</th></tr></thead>
                <tbody>
                  {(stats?.recentPayments || []).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.customer_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(p.amount)}</td>
                      <td><span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{p.payment_mode}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(p.payment_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Bookings ── */}
      <div className="col-section">
        <div className="col-section-header">
          <div className="col-section-title"><ClipboardDocumentListIcon style={{ width: 16, height: 16 }} /> Recent Bookings</div>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('bookings')}>View All →</button>
        </div>
        <div className="col-section-body-flush" style={{ overflowX: 'auto' }}>
          {recentBookings.length === 0 ? (
            <div className="col-empty" style={{ padding: 24 }}><div className="col-empty-desc">No bookings yet</div></div>
          ) : (
            <table className="col-table">
              <thead>
                <tr>
                  <th>Booking #</th><th>Customer</th><th>Project</th><th>Unit</th>
                  <th>Total Amount</th><th>Paid</th><th>Balance</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map(b => {
                  const paid = parseFloat(b.total_paid || 0);
                  const net = parseFloat(b.net_amount || 0);
                  const balance = net - paid;
                  return (
                    <tr key={b.id} className="is-clickable" onClick={() => onNavigate('bookings')}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{b.booking_number}</td>
                      <td style={{ fontWeight: 600 }}>{b.customer_name || '-'}</td>
                      <td>{b.project_name || '-'}</td>
                      <td>{b.unit_display || b.unit_number || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(net)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(paid)}</td>
                      <td style={{ color: balance > 0 ? 'var(--accent-red)' : 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(balance)}</td>
                      <td>
                        <span className="col-badge" style={{ background: (b.status_color || '#6B7280') + '22', color: b.status_color || '#6B7280' }}>
                          <span className="col-badge-dot" style={{ background: b.status_color || '#6B7280' }} />
                          {b.status_label || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="col-actions-row" style={{ marginTop: 20 }}>
        <button className="crm-btn crm-btn-primary" onClick={() => onNavigate('bookings')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClipboardDocumentListIcon style={{ width: 16, height: 16 }} /> Manage Bookings</button>
        <button className="crm-btn crm-btn-success" onClick={() => onNavigate('payments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CreditCardIcon style={{ width: 16, height: 16 }} /> Payment History</button>
      </div>
    </div>
  );
};

export { CollectionDashboard };
