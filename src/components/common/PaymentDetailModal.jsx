import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../api/bookingApi';
import paymentTypeApi from '../../api/paymentTypeApi';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import { CreditCardIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import '../../pages/portals/collection/CollectionWorkspace.css';

const PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Demand Draft', 'Credit Card', 'Debit Card', 'Loan Disbursement', 'Other'];

const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().split('T')[0];
};

const statusOf = (p) => (p.is_verified ? 'Verified' : p.is_bounced ? 'Rejected' : 'Pending');

const Field = ({ label, children }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
    <div style={{ fontWeight: 600 }}>{children}</div>
  </div>
);

/**
 * View / edit a single payment. Always opens in read-only view; payments that
 * are still unverified (not verified and not bounced) can be switched to an
 * inline edit form that PATCHes via bookingApi.updatePayment. After a save the
 * parent is told to refresh via onSaved().
 */
const PaymentDetailModal = ({ payment, onClose, onSaved }) => {
  const editable = payment && !payment.is_verified && !payment.is_bounced;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeOptions, setTypeOptions] = useState([]);
  const [form, setForm] = useState({
    payment_type: '', payment_mode: 'NEFT', amount: '', payment_date: '', account_name: '', remarks: '',
  });

  useEffect(() => {
    if (!payment) return;
    setEditing(false);
    setForm({
      payment_type: payment.payment_type || '',
      payment_mode: payment.payment_mode || 'NEFT',
      amount: payment.amount ?? '',
      payment_date: toDateInput(payment.payment_date),
      account_name: payment.account_name || '',
      remarks: payment.remarks || '',
    });
  }, [payment]);

  useEffect(() => {
    paymentTypeApi.getDropdown()
      .then((resp) => setTypeOptions(resp.data?.data || resp.data || []))
      .catch(() => setTypeOptions([]));
  }, []);

  if (!payment) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.payment_date) { toast.error('Amount and date are required'); return; }
    if (!form.payment_type) { toast.error('Payment type is required'); return; }
    setSaving(true);
    try {
      await bookingApi.updatePayment(payment.booking_id, payment.id, form);
      toast.success('Payment updated');
      onSaved && onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update payment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col-modal-overlay" onClick={onClose}>
      <div className="col-modal" onClick={(e) => e.stopPropagation()}>
        <div className="col-modal-header">
          <h2>
            <CreditCardIcon style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'text-bottom' }} />
            Payment {payment.payment_number} — {payment.booking_number}
          </h2>
          <button className="col-modal-close" onClick={onClose}>×</button>
        </div>

        {!editing ? (
          <>
            <div className="col-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Customer">{payment.customer_name || '—'}</Field>
                <Field label="Booking">{payment.booking_number || '—'}</Field>
                <Field label="Type">{payment.payment_type || '—'}</Field>
                <Field label="Mode">{payment.payment_mode || '—'}</Field>
                <Field label="Amount"><span style={{ color: 'var(--accent-green)' }}>{formatCurrency(payment.amount)}</span></Field>
                <Field label="Date">{formatDate(payment.payment_date)}</Field>
                <Field label="Account Name">{payment.account_name || '—'}</Field>
                <Field label="Status">{statusOf(payment)}</Field>
                {payment.remarks ? <div style={{ gridColumn: '1 / -1' }}><Field label="Remarks">{payment.remarks}</Field></div> : null}
              </div>
              {!editable && (
                <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  This payment is {statusOf(payment).toLowerCase()} and can no longer be edited.
                </p>
              )}
            </div>
            <div className="col-modal-footer">
              <button type="button" className="crm-btn crm-btn-ghost" onClick={onClose}>Close</button>
              {editable && (
                <button type="button" className="crm-btn crm-btn-primary" onClick={() => setEditing(true)}>
                  <PencilSquareIcon style={{ width: 14, height: 14, marginRight: 4 }} />Edit
                </button>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSave}>
            <div className="col-modal-body">
              <div className="col-form-grid">
                <div className="col-form-group">
                  <label className="col-form-label">Payment Type *</label>
                  <select className="col-form-select" value={form.payment_type} onChange={(e) => setForm((p) => ({ ...p, payment_type: e.target.value }))}>
                    <option value="">Select payment type</option>
                    {typeOptions.map((t) => <option key={t.id} value={t.type_name}>{t.type_name}</option>)}
                  </select>
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Payment Mode *</label>
                  <select className="col-form-select" value={form.payment_mode} onChange={(e) => setForm((p) => ({ ...p, payment_mode: e.target.value }))}>
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Amount (₹) *</label>
                  <input className="col-form-input" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Payment Date *</label>
                  <input className="col-form-input" type="date" required value={form.payment_date} onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))} />
                </div>
                <div className="col-form-group full-width">
                  <label className="col-form-label">Account Name</label>
                  <input className="col-form-input" value={form.account_name} onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))} placeholder="Account holder name" />
                </div>
                <div className="col-form-group full-width">
                  <label className="col-form-label">Remarks</label>
                  <textarea className="col-form-textarea" rows={2} value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="col-modal-footer">
              <button type="button" className="crm-btn crm-btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button type="submit" className="crm-btn crm-btn-success" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PaymentDetailModal;
