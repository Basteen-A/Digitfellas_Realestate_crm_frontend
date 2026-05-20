import React, { useState, useEffect } from 'react';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const fmt = (v) => formatCurrency(v);

const CollectionReports = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await dashboardApi.getCollectionStats();
        setStats(res.data || res);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="col-dashboard-new" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ color: 'var(--col-text-secondary)' }}>Loading report...</div>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="col-dashboard-new">
      <div className="col-greeting-new">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowTrendingUpIcon style={{ width: 24, height: 24, color: 'var(--col-primary, #4f46e5)' }} />
          Collection Report
        </h1>
        <p style={{ color: 'var(--col-text-secondary)', marginTop: 4, fontSize: '0.875rem' }}>
          Summary of your collection performance and booking status
        </p>
      </div>

      {/* KPI Cards */}
      <div className="col-stat-grid-new" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid var(--col-primary)' }}>
          <div className="col-stat-label-new">Total Bookings</div>
          <div className="col-stat-value-new">{s.activeBookings || 0}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #059669' }}>
          <div className="col-stat-label-new">Total Collected</div>
          <div className="col-stat-value-new" style={{ color: '#059669' }}>{fmt(s.totalCollected)}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="col-stat-label-new">Pending Dues</div>
          <div className="col-stat-value-new" style={{ color: '#dc2626' }}>{fmt(s.pendingDues)}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #7c3aed' }}>
          <div className="col-stat-label-new">This Month Revenue</div>
          <div className="col-stat-value-new" style={{ color: '#7c3aed' }}>{fmt(s.monthRevenue)}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="col-stat-label-new">Overdue Count</div>
          <div className="col-stat-value-new" style={{ color: '#f59e0b' }}>{s.overdueCount || 0}</div>
        </div>
        <div className="col-stat-card-new" style={{ borderLeft: '4px solid #0ea5e9' }}>
          <div className="col-stat-label-new">Total Customers</div>
          <div className="col-stat-value-new">{s.customersCount || 0}</div>
        </div>
      </div>

      {/* Booking Status Breakdown */}
      {s.statusBreakdown && s.statusBreakdown.length > 0 && (
        <div className="col-card-new" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Booking Status Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {s.statusBreakdown.map((st, i) => (
              <div key={i} style={{
                padding: '14px', borderRadius: 10, background: 'var(--col-surface)',
                border: '1px solid var(--col-border)', textAlign: 'center',
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: st.color_code || '#6B7280', display: 'inline-block', marginRight: 6,
                }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--col-text-secondary)' }}>{st.status_name}</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 6 }}>
                  {parseInt(st.count) || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collection Efficiency */}
      <div className="col-card-new" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Collection Efficiency</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--col-text-secondary)' }}>Overall Collection Rate</span>
              <span style={{ fontWeight: 700 }}>
                {s.totalCollected && (s.totalCollected + s.pendingDues) > 0
                  ? ((s.totalCollected / (s.totalCollected + s.pendingDues)) * 100).toFixed(1) + '%'
                  : '0%'}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--col-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${s.totalCollected && (s.totalCollected + s.pendingDues) > 0 ? ((s.totalCollected / (s.totalCollected + s.pendingDues)) * 100) : 0}%`,
                background: 'linear-gradient(90deg, #059669, #34d399)',
              }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--col-text-secondary)' }}>Verification Rate</span>
              <span style={{ fontWeight: 700 }}>
                {s.unverifiedCount !== undefined
                  ? s.unverifiedCount === 0 ? '100%' : `${s.unverifiedCount} pending`
                  : '—'}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--col-border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: s.unverifiedCount === 0 ? '100%' : '60%',
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      {s.recentPayments && s.recentPayments.length > 0 && (
        <div className="col-card-new" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', fontWeight: 700 }}>Recent Payments</div>
          <div className="col-table-scroll">
            <table className="col-table-new">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Customer</th>
                  <th>Booking</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {s.recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.payment_number}</td>
                    <td>{p.customer_name}</td>
                    <td style={{ fontSize: '0.75rem' }}>{p.booking_number}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(p.amount)}</td>
                    <td>{p.payment_mode}</td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td>
                      {p.is_verified
                        ? <span className="col-badge-new col-badge-success">✓</span>
                        : <span className="col-badge-new col-badge-warning">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionReports;
