import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import '../collection/CollectionWorkspace.css';

const SalesHeadPayments = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    payment_type: 'Token Amount', payment_mode: 'NEFT',
    amount: '', payment_date: '', account_name: '', remarks: '',
  });

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getAll({ limit: 100 });
      setBookings(resp.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const openPaymentModal = (booking) => {
    setSelectedBooking(booking);
    setPaymentForm({
      payment_type: 'Token Amount', payment_mode: 'NEFT',
      amount: '', payment_date: new Date().toISOString().split('T')[0],
      account_name: '', remarks: '',
    });
    setPaymentModal(true);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!selectedBooking || !paymentForm.amount || !paymentForm.payment_date) {
      toast.error('Amount and date are required'); return;
    }
    try {
      await bookingApi.addPayment(selectedBooking.id, paymentForm);
      toast.success('Payment recorded successfully');
      setPaymentModal(false);
      loadBookings();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add payment'));
    }
  };

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>💳 Payments</h1>
          <p className="hidden sm:block">Add payments and track collection progress for bookings</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadBookings}>Refresh</button>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div className="col-empty-icon">⏳</div>
              <p>Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No bookings found.
            </div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Booking #</th>
                    <th>Buyer</th>
                    <th>Project</th>
                    <th>Net Value</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Progress</th>
                    <th>Payment Plan</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{b.booking_number}</td>
                      <td style={{ fontWeight: 600 }}>{b.customer_name}</td>
                      <td>{b.project_name}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(b.net_amount)}</td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(b.total_paid || 0)}</td>
                      <td style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
                        {formatCurrency(b.total_due ?? (parseFloat(b.net_amount || 0) - parseFloat(b.total_paid || 0)))}
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <div className="col-progress" style={{ height: 6, width: '100%' }}>
                          <div
                            className={`col-progress-bar ${b.payment_percentage >= 100 ? 'success' : b.payment_percentage >= 50 ? '' : 'warning'}`}
                            style={{ width: `${Math.min(b.payment_percentage || 0, 100)}%` }}
                          />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{b.payment_percentage || 0}%</div>
                      </td>
                      <td>
                        <span className="col-badge" style={{
                          background: b.paymentPlan ? '#8b5cf622' : '#6b728022',
                          color: b.paymentPlan ? '#8b5cf6' : '#6b7280',
                        }}>
                          {b.paymentPlan ? `${b.paymentPlan.plan_name}${b.paymentPlan.plan_type === 'EMI' ? ` (${b.paymentPlan.emi_months}m)` : ''}` : 'Not Set'}
                        </span>
                      </td>
                      <td>
                        <button className="crm-btn crm-btn-success crm-btn-sm" onClick={() => openPaymentModal(b)}>
                          + Add Payment
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {paymentModal && selectedBooking && (
        <div className="col-modal-overlay" onClick={() => setPaymentModal(false)}>
          <div className="col-modal" onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2>💳 Add Payment — {selectedBooking.booking_number}</h2>
              <button className="col-modal-close" onClick={() => setPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="col-modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Amount</div><div style={{ fontWeight: 700 }}>{formatCurrency(selectedBooking.net_amount)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Paid</div><div style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(selectedBooking.total_paid || 0)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Balance Due</div><div style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{formatCurrency(selectedBooking.total_due ?? (parseFloat(selectedBooking.net_amount || 0) - parseFloat(selectedBooking.total_paid || 0)))}</div></div>
                </div>
                <div className="col-form-grid">
                  <div className="col-form-group">
                    <label className="col-form-label">Payment Type *</label>
                    <select className="col-form-select" value={paymentForm.payment_type} onChange={e => setPaymentForm(p => ({ ...p, payment_type: e.target.value }))}>
                      {['Token Amount', 'Down Payment', 'Installment', 'Loan Disbursement', 'Registration Charge', 'Stamp Duty', 'GST', 'Maintenance Deposit', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-form-group">
                    <label className="col-form-label">Payment Mode *</label>
                    <select className="col-form-select" value={paymentForm.payment_mode} onChange={e => setPaymentForm(p => ({ ...p, payment_mode: e.target.value }))}>
                      {['Cash', 'Cheque', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Demand Draft', 'Credit Card', 'Debit Card', 'Loan Disbursement', 'Other'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="col-form-group">
                    <label className="col-form-label">Amount (₹) *</label>
                    <input className="col-form-input" type="number" step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="col-form-group">
                    <label className="col-form-label">Payment Date *</label>
                    <input className="col-form-input" type="date" required value={paymentForm.payment_date} onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} />
                  </div>
                  <div className="col-form-group full-width">
                    <label className="col-form-label">Account Name</label>
                    <input className="col-form-input" value={paymentForm.account_name} onChange={e => setPaymentForm(p => ({ ...p, account_name: e.target.value }))} placeholder="Account holder name" />
                  </div>
                  <div className="col-form-group full-width">
                    <label className="col-form-label">Remarks</label>
                    <textarea className="col-form-textarea" rows={2} value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="col-modal-footer">
                <button type="button" className="crm-btn crm-btn-ghost" onClick={() => setPaymentModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn crm-btn-success">💳 Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHeadPayments;
