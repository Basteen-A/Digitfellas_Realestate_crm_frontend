import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  HomeIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { hasTaskPortalAccess } from '../../../utils/permissions';
import { TaskDashboardWidget } from '../../tasks';
import './CollectionWorkspace.css';

const DATE_PRESETS = [
  { label: 'All Time', key: 'all' },
  { label: 'Today', key: 'today' },
  { label: 'WTD', key: 'wtd' },
  { label: 'MTD', key: 'mtd' },
  { label: 'Custom', key: 'custom' },
];

const FilterBar = ({
  activeFilter, onFilterChange,
  customStart, customEnd, onCustomStartChange, onCustomEndChange, onApplyCustom
}) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '12px 16px', background: 'var(--bg-secondary)',
    borderRadius: 12, marginBottom: 20,
    border: '1px solid var(--border-primary)',
  }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <FunnelIcon style={{ width: 16, height: 16, color: 'var(--text-secondary)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 }}>
        Period:
      </span>
      {DATE_PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => p.key !== 'custom' ? onFilterChange(p.key) : onFilterChange('custom')}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: activeFilter === p.key ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-primary)',
            background: activeFilter === p.key ? 'var(--accent-blue-bg)' : 'transparent',
            color: activeFilter === p.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
            cursor: 'pointer', transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {p.label}
        </button>
      ))}

      {activeFilter === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <input type="date" value={customStart} onChange={e => onCustomStartChange(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
          <input type="date" value={customEnd} onChange={e => onCustomEndChange(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }} />
          <button onClick={onApplyCustom} disabled={!customStart || !customEnd}
            className="col-btn col-btn-primary col-btn-sm" style={{ fontSize: 11, padding: '4px 12px' }}>
            Apply
          </button>
        </div>
      )}
    </div>
  </div>
);

export const CollectionDashboard = ({ user, onNavigate, onSelectBooking }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [dateFilter, setDateFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getCollectionStats({
        dateFilter: dateFilter !== 'custom' ? dateFilter : (customStart && customEnd ? 'custom' : 'all'),
        startDate: customStart,
        endDate: customEnd
      });
      setStats(resp.data?.data || resp.data || {});
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customStart, customEnd]);

  const handleFilterChange = (key) => {
    setDateFilter(key);
    if (key !== 'custom') {
      setCustomStart(''); setCustomEnd('');
    }
  };

  useEffect(() => { loadStats(); }, [loadStats]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const firstName = user?.first_name || user?.firstName || 'User';

  if (loading) {
    return (
      <div className="simple-loader">
        <div className="simple-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Bookings', value: stats?.activeBookings || 0,
      sub: 'Active this month', icon: HomeIcon, variant: ''
    },
    {
      label: 'Collected', value: formatCurrency(stats?.monthRevenue || 0),
      
    },
     {
      label: 'Verified Payments', value: formatCurrency(stats?.verifiedAmount || 0),
      sub: 'amount verified', icon: CheckCircleIcon, variant: ''
    },
    {
      label: 'Pending Amount', value: formatCurrency(stats?.pendingDues || 0),
      sub: `${stats?.pendingDemandsCount || 0} demands due`, icon: ClipboardDocumentListIcon, variant: 'warning'
    },
    {
      label: 'Overdue', value: stats?.overdueCount || 0,
      sub: 'customers overdue', icon: ExclamationTriangleIcon, variant: 'danger'
    },
    {
      label: 'Unverified Payments', value: stats?.unverifiedCount || 0,
      sub: 'awaiting accounts', icon: MagnifyingGlassIcon, variant: 'info'
    },
   
  ];

  const recentPayments = stats?.recentPayments || [];
  const recentBookings = stats?.recentBookings || [];

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{getGreeting()}, {firstName}</h1>
          <p>Here's your collection overview for today — {today}</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadStats}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
        </div>
      </div>

      <FilterBar
        activeFilter={dateFilter}
        onFilterChange={handleFilterChange}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onApplyCustom={loadStats}
      />

      {/* Stat Cards */}
      <div className="col-stat-grid-new">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`col-stat-card-new ${card.variant}`} key={card.label}>
              <div className="col-stat-label-new">{card.label}</div>
              <div className="col-stat-value-new">{card.value}</div>
              <div className="col-stat-sub-new">{card.sub}</div>
              <div className="col-stat-icon-new">
                {Icon ? <Icon style={{ width: 24, height: 24, opacity: 0.8 }} /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="col-two-col-new">
        {/* Recent Bookings */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HomeIcon style={{ width: 20, height: 20, color: 'var(--accent-blue, #2563eb)' }} />
              <div>
                <div className="col-card-title-new">Recent Bookings</div>
                <div className="col-card-subtitle-new">Latest bookings created</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate('bookings')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {recentBookings.length === 0 ? (
              <div className="col-empty-mini">
                <HomeIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No recent bookings</span>
              </div>
            ) : (
              <table className="col-table-new">
                <thead>
                  <tr>
                     <th>Booking</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.slice(0, 4).map((c, i) => (
                    <tr key={i}>
                      <td className="col-cell-mono">
                        <button
                          type="button"
                          className="col-booking-link"
                          onClick={() => onSelectBooking(c.booking_id)}
                        >
                          {c.booking_number}
                        </button>
                      </td>
                      <td>
                        <div className="col-cell-primary">{c.customer_name}</div>
                        <div className="col-cell-secondary">{c.project_name} {c.unit_number ? `- ${c.unit_number}` : ''}</div>
                      </td>
                      
                      <td>{c.booking_date ? new Date(c.booking_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                      <td>  
                        <button className="col-btn col-btn-primary col-btn-sm" onClick={() => onSelectBooking(c.booking_id)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCardIcon style={{ width: 20, height: 20, color: 'var(--col-primary, #4f46e5)' }} />
              <div>
                <div className="col-card-title-new">Recent Payments</div>
                <div className="col-card-subtitle-new">Last entries added</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate('payments')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {recentPayments.length === 0 ? (
              <div className="col-empty-mini">
                <CreditCardIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No payments yet</span>
              </div>
            ) : (
              <table className="col-table-new">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.slice(0, 5).map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="col-cell-primary">{p.customer_name}</div>
                        <div className="col-cell-mono col-cell-secondary">
                          {p.payment_number || p.booking_number} · {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                      <td>
                        <span className={`col-badge-new ${p.is_verified ? 'col-badge-verified' : 'col-badge-unverified'}`}>
                          {p.is_verified ? 'Verified' : 'Unverified'}
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

      {/* Upcoming Demand Schedule */}

      {hasTaskPortalAccess(user) && (
        <TaskDashboardWidget onOpenTasks={() => onNavigate?.('tasks')} />
      )}
    </div>
  );
};

export default CollectionDashboard;
