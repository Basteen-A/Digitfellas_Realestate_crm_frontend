import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon, ChartBarIcon, CheckCircleIcon, ClockIcon,
  XCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const CollectionPayments = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getMyBookings({ limit: 200 });
      setBookings(resp.data?.data || resp.data || []);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Flatten all payments from all bookings
  const allPayments = bookings.flatMap(b =>
    (b.payments || []).map(p => ({
      ...p,
      booking_number: b.booking_number,
      customer_name: b.customer_name || b.customer?.first_name || '',
      project_name: b.project_name || b.project?.project_name || '',
    }))
  ).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

  const filtered = filter === 'all' ? allPayments
    : filter === 'verified' ? allPayments.filter(p => p.is_verified)
    : filter === 'pending' ? allPayments.filter(p => !p.is_verified && !p.is_bounced)
    : allPayments.filter(p => p.is_bounced);

  const totalAmount = filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><CreditCardIcon style={{ width: 22, height: 22, display: 'inline', verticalAlign: 'text-bottom', marginRight: 8 }} />Payment History</h1>
          <p className="hidden sm:block">Track all payment transactions across your bookings</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Summary */}
      <div className="col-stats-grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'all' ? '2px solid var(--accent-blue)' : undefined }} onClick={() => setFilter('all')}>
          <div className="col-stat-icon" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}><ChartBarIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.length}</div><div className="col-stat-label">Total Payments</div></div>
        </div>
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'verified' ? '2px solid var(--accent-green)' : undefined }} onClick={() => setFilter('verified')}>
          <div className="col-stat-icon" style={{ background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}><CheckCircleIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.filter(p => p.is_verified).length}</div><div className="col-stat-label">Verified</div></div>
        </div>
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'pending' ? '2px solid var(--accent-yellow)' : undefined }} onClick={() => setFilter('pending')}>
          <div className="col-stat-icon" style={{ background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' }}><ClockIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.filter(p => !p.is_verified && !p.is_bounced).length}</div><div className="col-stat-label">Pending</div></div>
        </div>
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'bounced' ? '2px solid var(--accent-red)' : undefined }} onClick={() => setFilter('bounced')}>
          <div className="col-stat-icon" style={{ background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}><XCircleIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.filter(p => p.is_bounced).length}</div><div className="col-stat-label">Bounced</div></div>
        </div>
      </div>

      {/* Total bar */}
      <div className="col-section" style={{ marginBottom: 16 }}>
        <div className="col-section-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
            Showing {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)' }}>
            Total: {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="col-empty"><div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">Loading payments...</div></div>
      ) : filtered.length === 0 ? (
        <div className="col-section"><div className="col-empty"><div className="col-empty-icon"><CreditCardIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">No payments found</div><div className="col-empty-desc">Payments will appear here when recorded against bookings</div></div></div>
      ) : (
        <div className="col-section">
          <div className="col-section-body-flush" style={{ overflowX: 'auto' }}>
            <table className="col-table">
              <thead>
                <tr>
                  <th>Payment #</th><th>Booking</th><th>Customer</th><th>Type</th>
                  <th>Mode</th><th>Amount</th><th>Date</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={p.is_verified ? 'col-payment-verified' : p.is_bounced ? 'col-payment-bounced' : ''}>
                    <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                    <td style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{p.booking_number}</td>
                    <td>{p.customer_name}</td>
                    <td>{p.payment_type}</td>
                    <td><span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{p.payment_mode}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(p.amount)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(p.payment_date)}</td>
                    <td>
                      {p.is_verified ? <span className="col-badge" style={{ background: 'var(--accent-green-bg)', color: 'var(--accent-green)' }}>Verified</span>
                        : p.is_bounced ? <span className="col-badge" style={{ background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>Bounced</span>
                        : <span className="col-badge" style={{ background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' }}>Pending</span>}
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

export { CollectionPayments };
