import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowPathIcon,
  CreditCardIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
  CurrencyRupeeIcon,
  LinkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import '../collection/CollectionWorkspace.css';

export const AccountsDashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getAccountsStats();
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
    { label: 'Pending Verification', value: stats?.unverifiedCount || 0, sub: 'payments to review', icon: MagnifyingGlassIcon, variant: 'warning' },
    { label: 'Verified Today', value: stats?.verifiedToday || 0, sub: `${formatCurrency(stats?.verifiedTodayAmount || 0)} approved`, icon: CheckCircleIcon, variant: 'success' },
    { label: 'Rejected', value: stats?.rejectedCount || 0, sub: 'this week', icon: XCircleIcon, variant: 'danger' },
    { label: 'Total Verified (Month)', value: formatCurrency(stats?.totalCollected || 0), sub: `${stats?.verifiedPaymentsCount || 0} payments`, icon: CurrencyRupeeIcon, variant: '' },
    { label: 'Unreconciled', value: stats?.unreconciledCount || 0, sub: 'bank entries', icon: LinkIcon, variant: 'info' },
    { label: 'Avg. Turnaround', value: stats?.avgTurnaround || '—', sub: 'verification time', icon: ClockIcon, variant: '' },
  ];

  const pendingPayments = stats?.recentPayments?.filter((p) => !p.is_verified && !p.is_bounced) || [];
  const verifiedPayments = stats?.recentPayments?.filter((p) => p.is_verified && !p.is_bounced) || [];

  return (
    <div className="col-dashboard">
      {/* Page Header */}
      <div className="col-page-header">
        <div className="col-page-header-left">
          <h1>{getGreeting()}, {firstName}</h1>
          <p>Accounts overview — {today}</p>
        </div>
        <div className="col-page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadStats}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
          <button className="col-btn col-btn-primary" onClick={() => onNavigate('verify')}>
            <MagnifyingGlassIcon style={{ width: 16, height: 16, marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} /> Review Payments
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="col-stat-grid-new" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
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
        {/* Pending Queue */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MagnifyingGlassIcon style={{ width: 20, height: 20, color: 'var(--col-primary, #4f46e5)' }} />
              <div>
                <div className="col-card-title-new">Pending Verification Queue</div>
                <div className="col-card-subtitle-new">Oldest first — action needed</div>
              </div>
            </div>
            <button className="col-btn col-btn-primary col-btn-sm" onClick={() => onNavigate('verify')}>
              Review All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {pendingPayments.length === 0 ? (
              <div className="col-empty-mini">
                <CheckCircleIcon style={{ width: 32, height: 32, color: '#10b981', opacity: 0.5 }} />
                <span>All payments verified</span>
              </div>
            ) : (
              <table className="col-table-new">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Age</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.slice(0, 4).map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="col-cell-primary">{p.customer_name}</div>
                        <div className="col-cell-mono col-cell-secondary">
                          {p.payment_number || '—'} · {p.booking_number}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                      <td style={{ fontSize: 12 }}>{p.payment_mode || 'N/A'}</td>
                      <td>
                        <span className="col-badge-new col-badge-pending">
                          {p.days_pending ? `${p.days_pending} days` : 'Today'}
                        </span>
                      </td>
                      <td>
                        <button className="col-btn col-btn-primary col-btn-sm" onClick={() => onNavigate('verify')}>
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recently Verified */}
        <div className="col-card-new">
          <div className="col-card-header-new">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircleIcon style={{ width: 20, height: 20, color: '#10b981' }} />
              <div>
                <div className="col-card-title-new">Recently Verified</div>
                <div className="col-card-subtitle-new">Payments approved today</div>
              </div>
            </div>
            <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate('verified')}>
              View All →
            </button>
          </div>
          <div className="col-card-body-flush-new">
            {verifiedPayments.length === 0 ? (
              <div className="col-empty-mini">
                <CreditCardIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
                <span>No verified payments yet</span>
              </div>
            ) : (
              <table className="col-table-new">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Verified At</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedPayments.slice(0, 4).map((p, i) => (
                    <tr key={i}>
                      <td>
                        <div className="col-cell-primary">{p.customer_name}</div>
                        <div className="col-cell-mono col-cell-secondary">
                          {p.payment_number || '—'} · {p.booking_number}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-green, #10b981)' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted, #9ca3af)' }}>
                        {p.verified_at ? new Date(p.verified_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Reconciliation Summary */}
      <div className="col-card-new">
        <div className="col-card-header-new">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LinkIcon style={{ width: 20, height: 20, color: 'var(--col-primary, #4f46e5)' }} />
            <div>
              <div className="col-card-title-new">Bank Reconciliation Status</div>
              <div className="col-card-subtitle-new">Matching CRM payments to bank statement entries</div>
            </div>
          </div>
          <button className="col-btn col-btn-ghost col-btn-sm" onClick={() => onNavigate('reconciliation')}>
            Open Reconciliation →
          </button>
        </div>
        <div className="col-card-body-new">
          <div className="acct-recon-grid">
            <div className="acct-recon-card" style={{ background: 'var(--bg-tertiary, #f4f5f9)' }}>
              <div className="col-stat-label-new">Statement Credits</div>
              <div className="acct-recon-value">{formatCurrency(stats?.statementCredits || 0)}</div>
              <div className="col-stat-sub-new">this month</div>
            </div>
            <div className="acct-recon-card" style={{ background: '#d1fae5' }}>
              <div className="col-stat-label-new" style={{ color: '#065f46' }}>Matched</div>
              <div className="acct-recon-value" style={{ color: '#065f46' }}>{formatCurrency(stats?.matchedAmount || 0)}</div>
              <div className="col-stat-sub-new">{stats?.matchedEntries || 0} entries</div>
            </div>
            <div className="acct-recon-card" style={{ background: '#fef3c7' }}>
              <div className="col-stat-label-new" style={{ color: '#92400e' }}>Unmatched</div>
              <div className="acct-recon-value" style={{ color: '#92400e' }}>{formatCurrency(stats?.unmatchedAmount || 0)}</div>
              <div className="col-stat-sub-new">{stats?.unmatchedEntries || 0} entries</div>
            </div>
            <div className="acct-recon-card" style={{ background: '#fee2e2' }}>
              <div className="col-stat-label-new" style={{ color: '#991b1b' }}>Gap</div>
              <div className="acct-recon-value" style={{ color: '#ef4444' }}>{formatCurrency(stats?.reconciliationGap || 0)}</div>
              <div className="col-stat-sub-new">needs review</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountsDashboard;
