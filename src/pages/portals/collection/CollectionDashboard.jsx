import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ClipboardDocumentListIcon,
  CreditCardIcon,
  UserGroupIcon,
  BanknotesIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

export const CollectionDashboard = ({ user, onNavigate, onSelectBooking }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getCollectionStats();
      setStats(resp.data?.data || resp.data || {});
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <ArrowPathIcon style={{ width: 36, height: 36, color: 'var(--text-muted)', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Active Bookings', value: stats?.activeBookings || 0, icon: ClipboardDocumentListIcon, color: '#6366f1', bg: '#6366f115' },
    { label: 'Total Collected', value: formatCurrency(stats?.totalCollected || 0), icon: BanknotesIcon, color: '#10b981', bg: '#10b98115' },
    { label: 'Pending Dues', value: formatCurrency(stats?.pendingDues || 0), icon: ExclamationCircleIcon, color: '#ef4444', bg: '#ef444415' },
    { label: 'Customers', value: stats?.customersCount || 0, icon: UserGroupIcon, color: '#f59e0b', bg: '#f59e0b15' },
    { label: 'This Month', value: formatCurrency(stats?.monthRevenue || 0), icon: ChartBarIcon, color: '#3b82f6', bg: '#3b82f615' },
    { label: 'Total Leads', value: stats?.totalLeads || 0, icon: CreditCardIcon, color: '#8b5cf6', bg: '#8b5cf615' },
  ];

  const statusBreakdown = stats?.statusBreakdown || [];
  const maxBarCount = Math.max(...statusBreakdown.map(s => parseInt(s.count) || 0), 1);
  const recentPayments = stats?.recentPayments || [];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Collection Dashboard</h1>
          <p className="hidden sm:block">Overview of bookings, payments, and collections</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadStats}>
            <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="col-stats-grid">
        {kpiCards.map((card) => (
          <div className="col-stat-card" key={card.label}>
            <div className="col-stat-icon" style={{ background: card.bg, color: card.color }}>
              <card.icon style={{ width: 24, height: 24 }} />
            </div>
            <div className="col-stat-info">
              <div className="col-stat-value">{card.value}</div>
              <div className="col-stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="col-two-col">
        {/* Booking Status Breakdown */}
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title">
              <ChartBarIcon style={{ width: 18, height: 18 }} />
              Booking Status Breakdown
            </div>
          </div>
          <div className="col-section-body">
            {statusBreakdown.length === 0 ? (
              <div className="col-empty" style={{ padding: 30 }}>
                <div className="col-empty-title">No data yet</div>
                <div className="col-empty-desc">Booking status data will appear here</div>
              </div>
            ) : (
              <div className="col-status-bars">
                {statusBreakdown.map((s) => {
                  const count = parseInt(s.count) || 0;
                  const heightPercent = Math.max((count / maxBarCount) * 100, 4);
                  return (
                    <div className="col-status-bar-item" key={s.status_code}>
                      <div className="col-status-bar-val">{count}</div>
                      <div
                        className="col-status-bar"
                        style={{
                          height: `${heightPercent}%`,
                          background: s.color_code || 'var(--accent-blue)',
                        }}
                      />
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
            <div className="col-section-title">
              <CreditCardIcon style={{ width: 18, height: 18 }} />
              Recent Payments
            </div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('payments')}>
              View All
            </button>
          </div>
          <div className="col-section-body-flush">
            {recentPayments.length === 0 ? (
              <div className="col-empty" style={{ padding: 30 }}>
                <div className="col-empty-title">No payments yet</div>
                <div className="col-empty-desc">Recent payments will appear here</div>
              </div>
            ) : (
              <table className="col-table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-blue)', fontSize: 12 }}>{p.payment_number || p.booking_number}</td>
                      <td style={{ fontSize: 12 }}>{p.customer_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: 13 }}>{formatCurrency(p.amount)}</td>
                      <td>
                        <span className="col-badge" style={{
                          background: p.is_verified ? '#10b98122' : '#f59e0b22',
                          color: p.is_verified ? '#10b981' : '#f59e0b',
                        }}>
                          <CheckCircleIcon style={{ width: 12, height: 12 }} />
                          {p.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => onNavigate('bookings')}>
          <ClipboardDocumentListIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
          View All Bookings
        </button>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('payments')}>
          <CreditCardIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
          Manage Payments
        </button>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onNavigate('customers')}>
          <UserGroupIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
          Customer List
        </button>
      </div>
    </div>
  );
};

export default CollectionDashboard;
