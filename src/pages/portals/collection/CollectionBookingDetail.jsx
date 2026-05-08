import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, CreditCardIcon,
  BanknotesIcon, Cog6ToothIcon,
  UserIcon, BuildingStorefrontIcon, DocumentTextIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const CollectionBookingDetail = ({ user, bookingId, onBack }) => {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusOptions, setStatusOptions] = useState([]);
  // Payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ payment_type: 'Installment', payment_mode: 'Online', amount: '', payment_date: '', transaction_ref: '', remarks: '' });
  const [paySaving, setPaySaving] = useState(false);
  // Dev cost form
  const [showDevForm, setShowDevForm] = useState(false);
  const [devForm, setDevForm] = useState({ guideline_value: '', plot_area: '', development_cost_per_sqft: '' });
  const [devSaving, setDevSaving] = useState(false);
  // Status edit
  const [editStatus, setEditStatus] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  // Verify form
  const [verifyPaymentId, setVerifyPaymentId] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ transaction_id: '', verification_note: '' });
  // Activity history
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      const data = resp.data?.data || resp.data;
      setBooking(data);
      setDevForm({
        guideline_value: data.guideline_value || '',
        plot_area: data.plot_area || '',
        development_cost_per_sqft: data.development_cost_per_sqft || '',
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking'));
    } finally { setLoading(false); }
  }, [bookingId]);

  useEffect(() => { loadBooking(); }, [loadBooking]);
  useEffect(() => {
    bookingStatusApi.getDropdown().then(r => setStatusOptions(r.data?.data || r.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (bookingId) {
      setActivitiesLoading(true);
      bookingApi.getActivities(bookingId).then(r => setActivities(r.data?.data || r.data || [])).catch(() => {}).finally(() => setActivitiesLoading(false));
    }
  }, [bookingId]);

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setPaySaving(true);
    try {
      await bookingApi.addPayment(bookingId, { ...payForm, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded');
      setShowPayForm(false);
      setPayForm({ payment_type: 'Installment', payment_mode: 'Online', amount: '', payment_date: '', transaction_ref: '', remarks: '' });
      loadBooking();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to record payment')); }
    finally { setPaySaving(false); }
  };

  const handleDevCostSave = async () => {
    setDevSaving(true);
    try {
      await bookingApi.updateDevelopmentCost(bookingId, {
        guideline_value: parseFloat(devForm.guideline_value) || 0,
        plot_area: parseFloat(devForm.plot_area) || 0,
        development_cost_per_sqft: parseFloat(devForm.development_cost_per_sqft) || 0,
      });
      toast.success('Development costs updated');
      setShowDevForm(false);
      loadBooking();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update')); }
    finally { setDevSaving(false); }
  };

  const handleStatusUpdate = async () => {
    if (!newStatusId) return;
    try {
      await bookingApi.update(bookingId, { booking_status_id: newStatusId });
      toast.success('Booking status updated');
      setEditStatus(false);
      loadBooking();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update status')); }
  };

  const handleApproveAccounts = async (paymentId) => {
    try {
      await bookingApi.approvePaymentAccounts(bookingId, paymentId);
      toast.success('Payment approved (Accounts)');
      loadBooking();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
  };

  const handleApproveManagement = async (paymentId) => {
    try {
      await bookingApi.approvePaymentManagement(bookingId, paymentId);
      toast.success('Payment approved (Management)');
      loadBooking();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
  };

  const handleVerifyPayment = async () => {
    if (!verifyPaymentId) return;
    try {
      await bookingApi.verifyPayment(bookingId, verifyPaymentId, verifyForm);
      toast.success('Payment verified');
      setVerifyPaymentId(null);
      setVerifyForm({ transaction_id: '', verification_note: '' });
      loadBooking();
    } catch (err) { toast.error(getErrorMessage(err, 'Verification failed')); }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted)', marginTop: 10 }}>Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="col-empty">
        <div className="col-empty-title">Booking not found</div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={onBack}>← Go Back</button>
      </div>
    );
  }

  const payments = booking.payments || [];
  const customer = booking.customer || {};
  const tabs = [
    { key: 'overview', label: 'Overview', icon: DocumentTextIcon },
    { key: 'payments', label: `Payments (${payments.length})`, icon: CreditCardIcon },
    { key: 'devcost', label: 'Dev Costs', icon: Cog6ToothIcon },
    { key: 'activities', label: 'Activity History', icon: ClockIcon },
  ];

  return (
    <div>
      {/* Back + Header */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={onBack} style={{ padding: '6px 10px' }}>
            <ArrowLeftIcon style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {booking.booking_number}
              <span className="col-badge" style={{ background: `${booking.status_color}22`, color: booking.status_color, fontSize: 12 }}>
                <span className="col-badge-dot" style={{ background: booking.status_color }} />
                {booking.status_label}
              </span>
            </h1>
            <p className="hidden sm:block">{booking.customer_name} · {booking.project_name}</p>
          </div>
        </div>
        <div className="page-header-actions" style={{ gap: 8 }}>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => setShowPayForm(true)}>
            <BanknotesIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Record Payment
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setEditStatus(true)}>
            <PencilSquareIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Update Status
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadBooking}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Amount Cards */}
      <div className="col-booking-amounts" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="col-amount-card"><div className="col-amount-label">Total Amount</div><div className="col-amount-value">{formatCurrency(booking.total_amount)}</div></div>
        <div className="col-amount-card"><div className="col-amount-label">Net Amount</div><div className="col-amount-value blue">{formatCurrency(booking.net_amount)}</div></div>
        <div className="col-amount-card"><div className="col-amount-label">Total Paid</div><div className="col-amount-value green">{formatCurrency(booking.total_paid)}</div></div>
        <div className="col-amount-card"><div className="col-amount-label">Balance Due</div><div className="col-amount-value red">{formatCurrency(booking.total_due)}</div></div>
      </div>

      {/* Tab Navigation */}
      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} className={`filter-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <t.icon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />{t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="col-two-col">
          {/* Customer Info */}
          <div className="col-section">
            <div className="col-section-header">
              <div className="col-section-title"><UserIcon style={{ width: 16, height: 16 }} /> Customer Information</div>
            </div>
            <div className="col-section-body">
              <div className="col-profile-info-grid">
                {[
                  ['Name', `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || '-'],
                  ['Buyer Name', booking.buyer_name || '-'],
                  ['Phone', customer.phone || '-'],
                  ['Email', customer.email || '-'],
                  ['PAN', customer.pan_number || '-'],
                  ['Aadhar', customer.aadhar_number || '-'],
                ].map(([l, v]) => (
                  <div className="col-profile-field" key={l}>
                    <div className="col-profile-field-label">{l}</div>
                    <div className="col-profile-field-value">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Info */}
          <div className="col-section">
            <div className="col-section-header">
              <div className="col-section-title"><BuildingStorefrontIcon style={{ width: 16, height: 16 }} /> Booking Details</div>
            </div>
            <div className="col-section-body">
              <div className="col-profile-info-grid">
                {[
                  ['Project', booking.project_name],
                  ['Unit', booking.unit_display || booking.unit_number || '-'],
                  ['Config', booking.configuration || '-'],
                  ['Area', booking.carpet_area ? `${booking.carpet_area} sq.ft.` : '-'],
                  ['Booking Date', formatDate(booking.booking_date)],
                  ['Payment Plan', booking.paymentPlan?.plan_name || '-'],
                  ['Stamp Duty', formatCurrency(booking.stamp_duty || 0)],
                  ['Registration', formatCurrency(booking.registration_charges || 0)],
                  ['GST', formatCurrency(booking.gst_amount || 0)],
                  ['Payment Status', booking.payment_status || '-'],
                  ['Loan Required', booking.is_loan_required ? `Yes - ${booking.loan_bank_name || ''}` : 'No'],
                  ['Next Follow-Up', booking.next_follow_up_at ? formatDate(booking.next_follow_up_at) : '-'],
                ].map(([l, v]) => (
                  <div className="col-profile-field" key={l}>
                    <div className="col-profile-field-label">{l}</div>
                    <div className="col-profile-field-value">{v}</div>
                  </div>
                ))}
              </div>
              {booking.remarks && (
                <div style={{ marginTop: 14, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong>Remarks:</strong> {booking.remarks}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === 'payments' && (
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title"><CreditCardIcon style={{ width: 16, height: 16 }} /> Payment History</div>
            <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => setShowPayForm(true)}>+ Add Payment</button>
          </div>
          <div className="col-section-body-flush">
            {payments.length === 0 ? (
              <div className="col-empty" style={{ padding: 30 }}><div className="col-empty-title">No payments recorded</div></div>
            ) : (
              <table className="col-table">
                <thead><tr><th>Ref #</th><th>Type</th><th>Mode</th><th>Amount</th><th>Date</th><th>Verified</th><th>Accounts</th><th>Actions</th></tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className={p.is_bounced ? 'col-payment-bounced' : p.management_approved ? 'col-payment-verified' : ''}>
                      <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                      <td>{p.payment_type}</td>
                      <td>{p.payment_mode}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(p.amount)}</td>
                      <td>{formatDate(p.payment_date)}</td>
                      <td>
                        <span className="col-badge" style={{ background: p.is_verified ? '#10b98122' : '#f59e0b22', color: p.is_verified ? '#10b981' : '#f59e0b' }}>
                          {p.is_verified ? '✓ Verified' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className="col-badge" style={{ background: p.accounts_approved ? '#10b98122' : '#6b728022', color: p.accounts_approved ? '#10b981' : '#6b7280' }}>
                          {p.accounts_approved ? '✓ Approved' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {!p.is_verified && (
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" style={{ fontSize: 11 }} onClick={() => { setVerifyPaymentId(p.id); setVerifyForm({ transaction_id: p.transaction_ref || '', verification_note: '' }); }}>
                            Verify
                          </button>
                        )}
                        {!p.accounts_approved && (
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" style={{ fontSize: 11 }} onClick={() => handleApproveAccounts(p.id)}>Acc ✓</button>
                        )}
                        {p.accounts_approved && !p.management_approved && (
                          <button className="crm-btn crm-btn-primary crm-btn-sm" style={{ fontSize: 11 }} onClick={() => handleApproveManagement(p.id)}>Mgmt ✓</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* DEV COST TAB */}
      {activeTab === 'devcost' && (
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title"><Cog6ToothIcon style={{ width: 16, height: 16 }} /> Development Costs & Valuation</div>
            {!showDevForm && <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setShowDevForm(true)}>Edit</button>}
          </div>
          <div className="col-section-body">
            {showDevForm ? (
              <div>
                <div className="col-form-grid-3">
                  {[['guideline_value', 'Guideline Value (₹/sq.ft.)'], ['plot_area', 'Plot Area (sq.ft.)'], ['development_cost_per_sqft', 'Dev Cost (₹/sq.ft.)']].map(([f, l]) => (
                    <div className="col-form-group" key={f}>
                      <label className="col-form-label">{l}</label>
                      <input className="col-form-input" type="number" value={devForm[f]} onChange={e => setDevForm(p => ({ ...p, [f]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="crm-btn crm-btn-ghost" onClick={() => setShowDevForm(false)}>Cancel</button>
                  <button className="crm-btn crm-btn-primary" onClick={handleDevCostSave} disabled={devSaving}>{devSaving ? 'Saving...' : 'Save & Calculate'}</button>
                </div>
              </div>
            ) : (
              <div className="col-profile-info-grid">
                {[
                  ['Guideline Value', booking.guideline_value ? `₹${parseFloat(booking.guideline_value).toLocaleString('en-IN')}/sq.ft.` : '-'],
                  ['Plot Area', booking.plot_area ? `${parseFloat(booking.plot_area).toLocaleString('en-IN')} sq.ft.` : '-'],
                  ['Plot Value', formatCurrency(booking.plot_value || 0)],
                  ['Stamp Value (7%)', formatCurrency(booking.stamp_value || 0)],
                  ['Registration Exp (2%)', formatCurrency(booking.registration_exp || 0)],
                  ['Dev Cost/sq.ft.', booking.development_cost_per_sqft ? `₹${parseFloat(booking.development_cost_per_sqft).toLocaleString('en-IN')}` : '-'],
                  ['Dev Charges (incl. GST)', formatCurrency(booking.development_charges || 0)],
                ].map(([l, v]) => (
                  <div className="col-profile-field" key={l}>
                    <div className="col-profile-field-label">{l}</div>
                    <div className="col-profile-field-value">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVITIES TAB */}
      {activeTab === 'activities' && (
        <div className="col-section">
          <div className="col-section-header">
            <div className="col-section-title"><ClockIcon style={{ width: 16, height: 16 }} /> Activity History</div>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => {
              setActivitiesLoading(true);
              bookingApi.getActivities(bookingId).then(r => setActivities(r.data?.data || r.data || [])).catch(() => {}).finally(() => setActivitiesLoading(false));
            }}><ArrowPathIcon style={{ width: 14, height: 14 }} /></button>
          </div>
          <div className="col-section-body">
            {activitiesLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                <ArrowPathIcon style={{ width: 24, height: 24, margin: '0 auto', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: 8, fontSize: 13 }}>Loading activities...</p>
              </div>
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>No activity recorded yet</div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border-primary)' }} />
                {activities.map((act, i) => (
                  <div key={act.id || i} style={{ position: 'relative', paddingBottom: 20, marginBottom: 0 }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute', left: -17, top: 3, width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid',
                      borderColor: act.activity_type === 'STATUS_CHANGE' ? '#3B82F6' :
                        act.activity_type === 'PAYMENT_STATUS_CHANGE' ? '#6366F1' :
                        act.activity_type === 'PAYMENT_RECORDED' ? '#10B981' :
                        act.activity_type === 'PAYMENT_VERIFIED' ? '#8B5CF6' :
                        act.activity_type === 'CANCELLED' ? '#EF4444' : '#6B7280',
                      background: 'var(--bg-card)',
                    }} />
                    <div style={{ marginLeft: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{act.title}</div>
                      {act.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{act.description}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{act.performedBy ? `${act.performedBy.first_name} ${act.performedBy.last_name}` : 'System'}</span>
                        <span>·</span>
                        <span>{new Date(act.performed_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Record Payment Modal */}
      {showPayForm && (
        <div className="col-modal-overlay" onClick={() => setShowPayForm(false)}>
          <div className="col-modal" onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2>Record Payment</h2>
              <button className="col-modal-close" onClick={() => setShowPayForm(false)}>×</button>
            </div>
            <div className="col-modal-body">
              <div className="col-form-grid">
                <div className="col-form-group">
                  <label className="col-form-label">Payment Type</label>
                  <select className="col-form-select" value={payForm.payment_type} onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))}>
                    {['Token', 'Down Payment', 'Installment', 'EMI', 'Final Payment', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Payment Mode</label>
                  <select className="col-form-select" value={payForm.payment_mode} onChange={e => setPayForm(p => ({ ...p, payment_mode: e.target.value }))}>
                    {['Cash', 'Cheque', 'Online', 'NEFT/RTGS', 'UPI', 'DD'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Amount (₹) *</label>
                  <input className="col-form-input" type="number" placeholder="0.00" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Payment Date</label>
                  <input className="col-form-input" type="date" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Transaction Ref</label>
                  <input className="col-form-input" type="text" placeholder="UTR / Cheque #" value={payForm.transaction_ref} onChange={e => setPayForm(p => ({ ...p, transaction_ref: e.target.value }))} />
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Remarks</label>
                  <input className="col-form-input" type="text" value={payForm.remarks} onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setShowPayForm(false)}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={handleAddPayment} disabled={paySaving}>{paySaving ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {editStatus && (
        <div className="col-modal-overlay" onClick={() => setEditStatus(false)}>
          <div className="col-modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2>Update Booking Status</h2>
              <button className="col-modal-close" onClick={() => setEditStatus(false)}>×</button>
            </div>
            <div className="col-modal-body">
              <div className="col-form-group">
                <label className="col-form-label">New Status</label>
                <select className="col-form-select" value={newStatusId} onChange={e => setNewStatusId(e.target.value)}>
                  <option value="">Select status...</option>
                  {statusOptions.map(s => <option key={s.id} value={s.id}>{s.status_name}</option>)}
                </select>
              </div>
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setEditStatus(false)}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={handleStatusUpdate} disabled={!newStatusId}>Update Status</button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Payment Modal */}
      {verifyPaymentId && (
        <div className="col-modal-overlay" onClick={() => setVerifyPaymentId(null)}>
          <div className="col-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2>Verify Payment</h2>
              <button className="col-modal-close" onClick={() => setVerifyPaymentId(null)}>×</button>
            </div>
            <div className="col-modal-body">
              <div className="col-form-group" style={{ marginBottom: 14 }}>
                <label className="col-form-label">Transaction ID *</label>
                <input className="col-form-input" type="text" placeholder="Enter transaction ID" value={verifyForm.transaction_id} onChange={e => setVerifyForm(p => ({ ...p, transaction_id: e.target.value }))} />
              </div>
              <div className="col-form-group">
                <label className="col-form-label">Verification Note</label>
                <textarea className="col-form-textarea" rows={2} placeholder="Optional note..." value={verifyForm.verification_note} onChange={e => setVerifyForm(p => ({ ...p, verification_note: e.target.value }))} />
              </div>
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setVerifyPaymentId(null)}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={handleVerifyPayment}>Verify Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionBookingDetail;
