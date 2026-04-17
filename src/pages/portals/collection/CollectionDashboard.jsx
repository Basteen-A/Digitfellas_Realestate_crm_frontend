import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  UsersIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  ClockIcon,
  UserIcon,
  ChartBarIcon,
  CreditCardIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const ICON_SIZE = { width: 22, height: 22 };
const ICON_SM = { width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 };

/* ═══════════════════════════════════════════
   COLLECTION DASHBOARD
   ═══════════════════════════════════════════ */
const CollectionDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getCollectionStats();
      setStats(resp.data || null);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load dashboard')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="col-empty"><div className="col-empty-icon"><ClockIcon style={{ width: 40, height: 40, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">Loading dashboard...</div></div>;

  const cards = [
    { label: 'Assigned Leads', value: stats?.totalLeads ?? 0, icon: <UsersIcon style={ICON_SIZE} />, bg: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' },
    { label: 'Active Bookings', value: stats?.activeBookings ?? 0, icon: <ClipboardDocumentListIcon style={ICON_SIZE} />, bg: 'var(--accent-green-bg)', color: 'var(--accent-green)' },
    { label: 'Total Collected', value: formatCurrency(stats?.totalCollected ?? 0), icon: <BanknotesIcon style={ICON_SIZE} />, bg: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan, #22d3ee)' },
    { label: 'Pending Dues', value: formatCurrency(stats?.pendingDues ?? 0), icon: <ClockIcon style={ICON_SIZE} />, bg: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' },
    { label: 'Customers', value: stats?.customersCount ?? 0, icon: <UserIcon style={ICON_SIZE} />, bg: 'var(--accent-purple-bg, #ede9fe)', color: 'var(--accent-purple, #8b5cf6)' },
    { label: 'This Month', value: formatCurrency(stats?.monthRevenue ?? 0), icon: <ChartBarIcon style={ICON_SIZE} />, bg: 'var(--accent-green-bg)', color: 'var(--accent-green)' },
  ];

  const statusData = stats?.statusBreakdown || [];
  const maxStatus = Math.max(...statusData.map(s => parseInt(s.count) || 0), 1);

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Welcome, {user?.first_name || 'Collection Manager'} <BanknotesIcon style={{ width: 24, height: 24 }} /></h1>
          <p className="hidden sm:block">Manage bookings, payments, and customer profiles</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh</button>
        </div>
      </div>

      <div className="col-stats-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      <div className="col-two-col">
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ChartBarIcon style={ICON_SM} /> Booking Status Breakdown</div>
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

        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CreditCardIcon style={ICON_SM} /> Recent Payments</div>
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

      <div className="col-actions-row" style={{ marginTop: 20 }}>
        <button className="crm-btn crm-btn-primary" onClick={() => onNavigate('bookings')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClipboardDocumentListIcon style={{ width: 16, height: 16 }} /> Manage Bookings</button>
        <button className="crm-btn crm-btn-success" onClick={() => onNavigate('payments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CreditCardIcon style={{ width: 16, height: 16 }} /> Payment History</button>
        <button className="crm-btn crm-btn-ghost" onClick={() => onNavigate('customers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UserIcon style={{ width: 16, height: 16 }} /> Customer Profiles</button>
        <button className="crm-btn crm-btn-ghost" onClick={() => onNavigate('leads')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UsersIcon style={{ width: 16, height: 16 }} /> View Leads</button>
      </div>
    </div>
  );
};

export { CollectionDashboard };
