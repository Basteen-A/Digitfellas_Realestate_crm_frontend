import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CalendarDaysIcon,
  HomeIcon,
  CurrencyRupeeIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const firstName = user?.name?.split(' ')[0] || 'User';

  if (loading) {
    return (
      <div className="col-loading-state">
        <ArrowPathIcon className="col-loading-icon" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Bookings', value: stats?.activeBookings || 0,
      sub: 'Active this month', icon: HomeIcon, variant: ''
    },
    {
      label: 'Collected (Month)', value: formatCurrency(stats?.monthRevenue || 0),
      sub: `from ${formatCurrency(stats?.targetAmount || 0)} target`, icon: CurrencyRupeeIcon, variant: 'success'
    },
    {
      label: 'Pending Demands', value: formatCurrency(stats?.pendingDues || 0),
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
    {
      label: 'Demands This Week', value: stats?.weekDemands || 0,
      sub: 'to be sent', icon: EnvelopeIcon, variant: ''
    },
  ];

  const recentPayments = stats?.recentPayments || [];
  const overdueCustomers = stats?.overdueCustomers || [];
  const upcomingDemands = stats?.upcomingDemands || [];

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{getGreeting()}, {firstName}</h1>
          <p>Here's your collection overview for today — {today}</p>
        </div>
        <div className="col-page-header-actions">
          <button className="col-btn col-btn-ghost col-btn-sm" onClick={loadStats}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button className="col-btn col-btn-primary" onClick={() => onNavigate('bookings')}>
            + New Booking
          </button>
        </div>
      </div>

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
        {/* Overdue Customers */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ExclamationTriangleIcon style={{ width: 20, height: 20, color: '#dc2626' }} />
              <div>
                <div className="col-card-title-new">Overdue Customers</div>
                <div className="col-card-subtitle-new">Action needed immediately</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate('bookings')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {overdueCustomers.length === 0 ? (
              <div className="col-empty-mini">
                <CheckCircleIcon style={{ width: 32, height: 32, color: 'var(--accent-green, #10b981)', opacity: 0.5 }} />
                <span>No overdue customers</span>
              </div>
            ) : (
              <table className="col-table-new">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Booking</th>
                    <th>Overdue</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {overdueCustomers.slice(0, 4).map((c, i) => (
                    <tr key={i}>
                      <td>
                        <div className="col-cell-primary">{c.customer_name}</div>
                        <div className="col-cell-secondary">{c.project_name} {c.unit_number}</div>
                      </td>
                      <td className="col-cell-mono">{c.booking_number}</td>
                      <td><span className="col-badge-new col-badge-overdue">{c.days_overdue || 0} days</span></td>
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
      <div className="col-card-new">
        <div className="col-card-header-new">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDaysIcon style={{ width: 20, height: 20, color: 'var(--col-primary, #4f46e5)' }} />
            <div>
              <div className="col-card-title-new">Upcoming Demand Schedule</div>
              <div className="col-card-subtitle-new">Demands due in next 30 days</div>
            </div>
          </div>
          <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate('bookings')}>
            Full Schedule →
          </button>
        </div>
        <div className="col-card-body-flush-new">
          {upcomingDemands.length === 0 ? (
            <div className="col-empty-mini">
              <CalendarDaysIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
              <span>No upcoming demands</span>
            </div>
          ) : (
            <div className="col-table-scroll">
              <table className="col-table-new">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer</th>
                    <th>Project / Unit</th>
                    <th>Demand Stage</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingDemands.slice(0, 5).map((d, i) => (
                    <tr key={i} className="col-clickable-row" onClick={() => onSelectBooking(d.booking_id)}>
                      <td className="col-cell-mono">{d.booking_number}</td>
                      <td><span className="col-cell-primary">{d.customer_name}</span></td>
                      <td>{d.project_name} · {d.unit_number}</td>
                      <td>{d.milestone_name || 'N/A'}</td>
                      <td style={{ color: d.is_overdue ? 'var(--accent-red, #ef4444)' : undefined, fontWeight: d.is_overdue ? 600 : undefined }}>
                        {d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(d.demand_amount)}</td>
                      <td>
                        <span className={`col-badge-new ${d.is_overdue ? 'col-badge-overdue' : 'col-badge-pending'}`}>
                          {d.is_overdue ? 'Overdue' : 'Upcoming'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionDashboard;
