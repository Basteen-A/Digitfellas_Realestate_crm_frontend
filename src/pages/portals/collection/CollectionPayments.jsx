import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  CreditCardIcon, ChartBarIcon, CheckCircleIcon, ClockIcon,
  XCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import RecordPaymentModal from '../../../components/common/RecordPaymentModal';
import './CollectionWorkspace.css';

// Pending/unverified, non-refund, non-bounced payments can be edited with the
// rich Record-Payment modal; everything else opens the same modal read-only.
const canEditPayment = (p) => !!p && !p.is_verified && !p.is_bounced && !p.is_refund;

const CollectionPayments = ({ user, onSelectBooking }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activePayment, setActivePayment] = useState(null); // { bookingId, paymentId, readOnly }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getMyBookings({ limit: 200 });
      const raw = resp.data?.data?.rows || resp.data?.data || resp.data || [];
      setBookings(Array.isArray(raw) ? raw : []);
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
    : filter === 'Unverified' ? allPayments.filter(p => !p.is_verified && !p.is_bounced)
    : allPayments.filter(p => p.is_bounced);

    

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><CreditCardIcon style={{ width: 22, height: 22, display: 'inline', verticalAlign: 'text-bottom', marginRight: 8 }} />Payments</h1>
          <p className="hidden sm:block">Track all payment transactions across your bookings</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="crm-btn crm-btn-ghost" onClick={load}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="col-stats-grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'all' ? '2px solid var(--text-primary, #000000)' : '1px solid var(--border-primary, #e2e8f0)' }} onClick={() => setFilter('all')}>
          <div className="col-stat-icon" style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-primary, #000000)' }}><ChartBarIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.length}</div><div className="col-stat-label">Total Payments</div></div>
        </div>
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'verified' ? '2px solid var(--text-primary, #000000)' : '1px solid var(--border-primary, #e2e8f0)' }} onClick={() => setFilter('verified')}>
          <div className="col-stat-icon" style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-primary, #000000)' }}><CheckCircleIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.filter(p => p.is_verified).length}</div><div className="col-stat-label">Verified</div></div>
        </div>
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'Unverified' ? '2px solid var(--text-primary, #000000)' : '1px solid var(--border-primary, #e2e8f0)' }} onClick={() => setFilter('Unverified')}>
          <div className="col-stat-icon" style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-primary, #000000)' }}><ClockIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.filter(p => !p.is_verified && !p.is_bounced).length}</div><div className="col-stat-label">Unverified</div></div>
        </div>
        <div className="col-stat-card" style={{ cursor: 'pointer', border: filter === 'bounced' ? '2px solid var(--text-primary, #000000)' : '1px solid var(--border-primary, #e2e8f0)' }} onClick={() => setFilter('bounced')}>
          <div className="col-stat-icon" style={{ background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-primary, #000000)' }}><XCircleIcon style={{ width: 20, height: 20 }} /></div>
          <div className="col-stat-info"><div className="col-stat-value">{allPayments.filter(p => p.is_bounced).length}</div><div className="col-stat-label">Rejected</div></div>
        </div>
      </div>

      {/* Total bar */}
      <div className="col-section" style={{ marginBottom: 16 }}>
        <div className="col-section-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
            Showing {filtered.length} payment{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="simple-loader"><div className="simple-spinner" /><p>Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="col-section"><div className="col-empty"><div className="col-empty-icon"><CreditCardIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">No payments found</div><div className="col-empty-desc">Payments will appear here when recorded against bookings</div></div></div>
      ) : (
        <div className="col-section">
          <div className="col-section-body-flush" style={{ overflowX: 'auto' }}>
            <table className="col-table">
              <thead>
                <tr>
                  <th>Payment #</th><th>Booking</th><th>Customer</th><th>Type</th>
                  <th>Mode</th><th>Amount</th><th>Date</th><th>Towards</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className={p.is_bounced ? 'col-payment-bounced' : ''} style={{ cursor: 'pointer' }} onClick={() => setActivePayment({ bookingId: p.booking_id, paymentId: p.id, readOnly: !canEditPayment(p) })} title={canEditPayment(p) ? 'Edit payment' : 'View payment details'}>
                    <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                    <td style={{ color: 'var(--accent-blue)', fontWeight: 600, cursor: onSelectBooking ? 'pointer' : undefined, textDecoration: onSelectBooking ? 'underline' : undefined }} onClick={(e) => { if (onSelectBooking) { e.stopPropagation(); onSelectBooking(p.booking_id); } }}>{p.booking_number}</td>
                    <td>{p.customer_name}</td>
                    <td>{p.payment_type}</td>
                    <td><span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{p.payment_mode}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(p.amount)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(p.payment_date)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{p.payment_category || '—'}</td>
                    <td>
                      {p.is_verified ? <span className="col-badge col-badge-neutral">Verified</span>
                        : p.is_bounced ? <span className="col-badge" style={{ background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>Rejected</span>
                        : <span className="col-badge" style={{ background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' }}>Unverified</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activePayment && (
        <RecordPaymentModal
          bookingId={activePayment.bookingId}
          paymentId={activePayment.paymentId}
          readOnly={activePayment.readOnly}
          onClose={() => setActivePayment(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};

export { CollectionPayments };
export default CollectionPayments;
