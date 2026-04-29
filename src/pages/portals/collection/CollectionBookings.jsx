import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ClipboardDocumentListIcon, PencilSquareIcon, CreditCardIcon, UserIcon,
  ArrowPathIcon, CheckCircleIcon, ChartBarIcon,
  WrenchScrewdriverIcon, DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const CollectionBookings = ({ user, onSelectCustomer }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ payment_type: 'Token Amount', payment_mode: 'NEFT', amount: '', payment_date: '', account_name: '', remarks: '' });
  const [statusOptions, setStatusOptions] = useState([]);
  const [devCostModal, setDevCostModal] = useState(null); // booking object
  const [devCostForm, setDevCostForm] = useState({ guideline_value: '', plot_area: '', development_cost_per_sqft: '' });
  const [devCostSaving, setDevCostSaving] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getMyBookings({ limit: 100 });
      setBookings(resp.data?.data || resp.data || []);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load bookings')); }
    finally { setLoading(false); }
  }, []);

  const loadStatuses = useCallback(async () => {
    try {
      const resp = await bookingStatusApi.getDropdown();
      setStatusOptions(resp.data?.data || resp.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadBookings(); loadStatuses(); }, [loadBookings, loadStatuses]);

  const openDetail = async (bookingId) => {
    setDetailLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      setSelectedBooking(resp.data?.data || resp.data);
      setEditMode(false);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load booking')); }
    finally { setDetailLoading(false); }
  };

  const handleEditSave = async () => {
    if (!selectedBooking) return;
    try {
      await bookingApi.update(selectedBooking.id, editForm);
      toast.success('Booking updated');
      setEditMode(false);
      openDetail(selectedBooking.id);
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update')); }
  };

  const handleApproveAccounts = async (paymentId) => {
    try {
      await bookingApi.approvePaymentAccounts(selectedBooking.id, paymentId);
      toast.success('Payment approved by Accounts');
      openDetail(selectedBooking.id);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to approve (Accounts)')); }
  };

  const handleApproveManagement = async (paymentId) => {
    try {
      await bookingApi.approvePaymentManagement(selectedBooking.id, paymentId);
      toast.success('Payment approved by Management');
      openDetail(selectedBooking.id);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to approve (Management)')); }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!selectedBooking || !paymentForm.amount || !paymentForm.payment_date) {
      toast.error('Amount and date are required'); return;
    }
    try {
      await bookingApi.addPayment(selectedBooking.id, paymentForm);
      toast.success('Payment recorded');
      setPaymentModal(false);
      setPaymentForm({ payment_type: 'Token Amount', payment_mode: 'NEFT', amount: '', payment_date: '', account_name: '', remarks: '' });
      openDetail(selectedBooking.id);
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to add payment')); }
  };

  const startEdit = () => {
    setEditForm({
      unit_number: selectedBooking.unit_number || '',
      tower_block: selectedBooking.tower_block || '',
      floor_number: selectedBooking.floor_number || '',
      configuration: selectedBooking.configuration || '',
      carpet_area: selectedBooking.carpet_area || '',
      base_price: selectedBooking.base_price || '',
      total_amount: selectedBooking.total_amount || '',
      discount_amount: selectedBooking.discount_amount || '',
      net_amount: selectedBooking.net_amount || '',
      gst_amount: selectedBooking.gst_amount || '',
      stamp_duty: selectedBooking.stamp_duty || '',
      registration_charges: selectedBooking.registration_charges || '',
      booking_status_id: selectedBooking.booking_status_id || '',
      next_calling_date: selectedBooking.next_calling_date || '',
      call_status: selectedBooking.call_status || '',
      remarks: selectedBooking.remarks || '',
    });
    setEditMode(true);
  };

  // Development cost handlers
  const openDevCostModal = (booking) => {
    setDevCostModal(booking);
    setDevCostForm({
      guideline_value: booking.guideline_value || '',
      plot_area: booking.plot_area || booking.carpet_area || '',
      development_cost_per_sqft: booking.development_cost_per_sqft || '',
    });
  };

  const computeDerived = (form) => {
    const gv = parseFloat(form.guideline_value) || 0;
    const pa = parseFloat(form.plot_area) || 0;
    const dcps = parseFloat(form.development_cost_per_sqft) || 0;
    const plotValue = gv * pa;
    return {
      plot_value: Math.round(plotValue * 100) / 100,
      stamp_value: Math.ceil((plotValue * 0.07) / 100) * 100,
      registration_exp: Math.ceil((plotValue * 0.02) / 100) * 100,
      development_charges: Math.round(pa * dcps * 1.18 * 100) / 100,
    };
  };

  const handleDevCostSave = async () => {
    if (!devCostModal) return;
    setDevCostSaving(true);
    try {
      await bookingApi.updateDevelopmentCost(devCostModal.id, {
        guideline_value: parseFloat(devCostForm.guideline_value) || 0,
        plot_area: parseFloat(devCostForm.plot_area) || 0,
        development_cost_per_sqft: parseFloat(devCostForm.development_cost_per_sqft) || 0,
      });
      toast.success('Development costs updated');
      setDevCostModal(null);
      loadBookings();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update development costs'));
    } finally {
      setDevCostSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1> Bookings</h1>
          <p className="hidden sm:block">Manage bookings, update details, and record payments</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={loadBookings}> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="col-empty"><div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">Loading bookings...</div></div>
      ) : bookings.length === 0 ? (
        <div className="col-section"><div className="col-empty"><div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div><div className="col-empty-title">No bookings yet</div><div className="col-empty-desc">Bookings are auto-created when Sales Head approves a deal</div></div></div>
      ) : (
        <div className="col-section">
          <div className="col-section-body-flush" style={{ overflowX: 'auto' }}>
            <table className="col-table">
              <thead>
                <tr>
                  <th>Booking #</th><th>Customer</th><th>Project</th><th>Status</th>
                  <th>Net Amount</th><th>Paid</th><th>Progress</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="is-clickable" onClick={() => openDetail(b.id)}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{b.booking_number}</td>
                    <td style={{ fontWeight: 600 }}>{b.customer_name || '-'}</td>
                    <td>{b.project_name || '-'}</td>
                    <td>
                      <span className="col-badge" style={{ background: (b.status_color || '#6B7280') + '22', color: b.status_color || '#6B7280' }}>
                        <span className="col-badge-dot" style={{ background: b.status_color || '#6B7280' }} />
                        {b.status_label || 'Pending'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(b.net_amount)}</td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{formatCurrency(b.total_paid)}</td>
                    <td style={{ minWidth: 100 }}>
                      <div className="col-progress">
                        <div className={`col-progress-bar ${b.payment_percentage >= 100 ? 'success' : b.payment_percentage >= 50 ? '' : 'warning'}`}
                          style={{ width: `${Math.min(b.payment_percentage || 0, 100)}%` }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.payment_percentage || 0}%</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(b.id); }}>View</button>
                        <button className="crm-btn crm-btn-success crm-btn-sm" onClick={(e) => { e.stopPropagation(); openDetail(b.id); setPaymentModal(true); }}>+ Pay</button>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); openDevCostModal(b); }}>Dev Cost</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Booking Detail Modal ── */}
      {selectedBooking && (
        <div className="col-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="col-modal col-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2><ClipboardDocumentListIcon style={{ width: 20, height: 20, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />{selectedBooking.booking_number}</h2>
              <button className="col-modal-close" onClick={() => setSelectedBooking(null)}>×</button>
            </div>
            {detailLoading ? (
              <div className="col-modal-body"><div className="col-empty"><div className="col-empty-icon"><ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} /></div></div></div>
            ) : (
              <div className="col-modal-body">
                {/* Amount cards */}
                <div className="col-booking-amounts">
                  <div className="col-amount-card"><div className="col-amount-label">Total Amount</div><div className="col-amount-value">{formatCurrency(selectedBooking.total_amount)}</div></div>
                  <div className="col-amount-card"><div className="col-amount-label">Net Amount</div><div className="col-amount-value blue">{formatCurrency(selectedBooking.net_amount)}</div></div>
                  <div className="col-amount-card"><div className="col-amount-label">Total Paid</div><div className="col-amount-value green">{formatCurrency(selectedBooking.total_paid)}</div></div>
                  <div className="col-amount-card"><div className="col-amount-label">Due</div><div className="col-amount-value red">{formatCurrency(selectedBooking.total_due ?? (parseFloat(selectedBooking.net_amount || 0) - parseFloat(selectedBooking.total_paid || 0)))}</div></div>
                </div>

                {editMode ? (
                  <>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Edit Booking Details</h3>
                    <div className="col-form-grid-3">
                      {[['unit_number','Unit #'],['tower_block','Tower/Block'],['floor_number','Floor'],['configuration','Config'],['carpet_area','Carpet Area'],['base_price','Base Price'],['total_amount','Total Amount'],['discount_amount','Discount'],['net_amount','Net Amount'],['gst_amount','GST'],['stamp_duty','Stamp Duty'],['registration_charges','Reg. Charges']].map(([k,l]) => (
                        <div className="col-form-group" key={k}>
                          <label className="col-form-label">{l}</label>
                          <input className="col-form-input" value={editForm[k] || ''} onChange={e => setEditForm(p => ({...p, [k]: e.target.value}))} />
                        </div>
                      ))}
                      <div className="col-form-group">
                        <label className="col-form-label">Status</label>
                        <select className="col-form-select" value={editForm.booking_status_id || ''} onChange={e => setEditForm(p => ({...p, booking_status_id: e.target.value}))}>
                          <option value="">Select...</option>
                          {statusOptions.map(s => <option key={s.id} value={s.id}>{s.status_name}</option>)}
                        </select>
                      </div>
                      <div className="col-form-group">
                        <label className="col-form-label">Next Calling Date</label>
                        <input className="col-form-input" type="date" value={editForm.next_calling_date || ''} onChange={e => setEditForm(p => ({...p, next_calling_date: e.target.value}))} />
                      </div>
                      <div className="col-form-group">
                        <label className="col-form-label">Call Status</label>
                        <select className="col-form-select" value={editForm.call_status || ''} onChange={e => setEditForm(p => ({...p, call_status: e.target.value}))}>
                          <option value="">Select...</option>
                          <option value="Not Reachable">Not Reachable</option>
                          <option value="Busy">Busy</option>
                          <option value="Callback Requested">Callback Requested</option>
                          <option value="Connected">Connected</option>
                          <option value="Committed to Pay">Committed to Pay</option>
                          <option value="Refused / Issue">Refused / Issue</option>
                        </select>
                      </div>
                      <div className="col-form-group full-width">
                        <label className="col-form-label">Remarks</label>
                        <textarea className="col-form-textarea" value={editForm.remarks || ''} onChange={e => setEditForm(p => ({...p, remarks: e.target.value}))} rows={2} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                      <button className="crm-btn crm-btn-ghost" onClick={() => setEditMode(false)}>Cancel</button>
                      <button className="crm-btn crm-btn-primary" onClick={handleEditSave}><DocumentCheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Save Changes</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-booking-header">
                      <div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.customer ? `${selectedBooking.customer.first_name} ${selectedBooking.customer.last_name || ''}` : '-'}</strong></div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Project: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.project?.project_name || '-'}</strong></div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unit: <strong>{selectedBooking.unit_number || 'Not set'}</strong> | Floor: <strong>{selectedBooking.floor_number || '-'}</strong> | Config: <strong>{selectedBooking.configuration || '-'}</strong></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={startEdit}><PencilSquareIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Edit Details</button>
                        <button className="crm-btn crm-btn-success crm-btn-sm" onClick={() => setPaymentModal(true)}><CreditCardIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Add Payment</button>
                        {selectedBooking.customer && <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => onSelectCustomer?.(selectedBooking.customer.id)}><UserIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />View Customer</button>}
                      </div>
                    </div>

                    {/* Payments table */}
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: '20px 0 12px' }}><CreditCardIcon style={{ width: 18, height: 18, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Payment History</h3>
                    {(selectedBooking.payments || []).length === 0 ? (
                      <div className="col-empty" style={{ padding: 24 }}><div className="col-empty-desc">No payments recorded. Click "Add Payment" to start.</div></div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="col-table">
                          <thead><tr><th>Payment #</th><th>Type</th><th>Mode</th><th>Amount</th><th>Date</th><th>Account</th><th>Accounts</th><th>Mgmt</th><th>Status</th></tr></thead>
                          <tbody>
                            {(selectedBooking.payments || []).map(p => {
                              const approvalStatus = p.management_approved ? 'APPROVED' : p.accounts_approved ? 'ACCOUNTS_OK' : 'PENDING';
                              const statusColors = { PENDING: '#f59e0b', ACCOUNTS_OK: '#3b82f6', APPROVED: '#10b981' };
                              const statusLabels = { PENDING: 'Pending', ACCOUNTS_OK: 'Accounts OK', APPROVED: 'Approved' };
                              return (
                                <tr key={p.id} className={p.is_verified ? 'col-payment-verified' : p.is_bounced ? 'col-payment-bounced' : ''}>
                                  <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                                  <td>{p.payment_type}</td>
                                  <td><span className="col-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }}>{p.payment_mode}</span></td>
                                  <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(p.amount)}</td>
                                  <td style={{ fontSize: 12 }}>{formatDate(p.payment_date)}</td>
                                  <td style={{ fontSize: 12 }}>{p.account_name || '-'}</td>
                                  <td>{p.accounts_approved ? <CheckCircleIcon style={{ width: 16, height: 16, color: 'var(--accent-green)' }} /> : (
                                    <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => handleApproveAccounts(p.id)} style={{ padding: '4px 8px', fontSize: 11 }}>Approve A/C</button>
                                  )}</td>
                                  <td>{p.management_approved ? <CheckCircleIcon style={{ width: 16, height: 16, color: 'var(--accent-green)' }} /> : (
                                    <button className="crm-btn crm-btn-success crm-btn-sm" onClick={() => handleApproveManagement(p.id)} disabled={!p.accounts_approved} style={{ padding: '4px 8px', fontSize: 11 }}>Approve Mgmt</button>
                                  )}</td>
                                  <td><span className="col-badge" style={{ background: statusColors[approvalStatus] + '22', color: statusColors[approvalStatus], fontWeight: 600 }}>{statusLabels[approvalStatus]}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Payment Modal ── */}
      {paymentModal && (
        <div className="col-modal-overlay" onClick={() => setPaymentModal(false)}>
          <div className="col-modal" onClick={e => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2><CreditCardIcon style={{ width: 20, height: 20, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Add Payment</h2>
              <button className="col-modal-close" onClick={() => setPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="col-modal-body">
                <div className="col-form-grid">
                  <div className="col-form-group">
                    <label className="col-form-label">Payment Type *</label>
                    <select className="col-form-select" value={paymentForm.payment_type} onChange={e => setPaymentForm(p => ({...p, payment_type: e.target.value}))}>
                      {['Token Amount','Down Payment','Installment','Loan Disbursement','Registration Charge','Stamp Duty','GST','Maintenance Deposit','Other'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-form-group">
                    <label className="col-form-label">Payment Mode *</label>
                    <select className="col-form-select" value={paymentForm.payment_mode} onChange={e => setPaymentForm(p => ({...p, payment_mode: e.target.value}))}>
                      {['Cash','Cheque','NEFT','RTGS','IMPS','UPI','Demand Draft','Credit Card','Debit Card','Loan Disbursement','Other'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="col-form-group">
                    <label className="col-form-label">Amount (₹) *</label>
                    <input className="col-form-input" type="number" step="0.01" required value={paymentForm.amount} onChange={e => setPaymentForm(p => ({...p, amount: e.target.value}))} />
                  </div>
                  <div className="col-form-group">
                    <label className="col-form-label">Payment Date *</label>
                    <input className="col-form-input" type="date" required value={paymentForm.payment_date} onChange={e => setPaymentForm(p => ({...p, payment_date: e.target.value}))} />
                  </div>
                  <div className="col-form-group full-width">
                    <label className="col-form-label">Account Name</label>
                    <input className="col-form-input" value={paymentForm.account_name} onChange={e => setPaymentForm(p => ({...p, account_name: e.target.value}))} placeholder="Account holder name" />
                  </div>
                  <div className="col-form-group full-width">
                    <label className="col-form-label">Remarks</label>
                    <textarea className="col-form-textarea" rows={2} value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({...p, remarks: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="col-modal-footer">
                <button type="button" className="crm-btn crm-btn-ghost" onClick={() => setPaymentModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn crm-btn-success"><CreditCardIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Development Cost Modal */}
      {devCostModal && (
        <div className="col-modal-overlay" onClick={() => setDevCostModal(null)}>
          <div className="col-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="col-modal-header">
              <h2><WrenchScrewdriverIcon style={{ width: 20, height: 20, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Development Cost — {devCostModal.booking_number}</h2>
              <button className="col-modal-close" onClick={() => setDevCostModal(null)}>×</button>
            </div>
            <div className="col-modal-body">
              <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                <strong>{devCostModal.customer_name}</strong> — {devCostModal.project_name} | Unit: {devCostModal.unit_display || devCostModal.unit_number || 'N/A'}
              </div>

              <div className="col-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div className="col-form-group">
                  <label className="col-form-label">Guideline Value (₹/sq.ft.)</label>
                  <input
                    className="col-form-input"
                    type="number" step="0.01"
                    value={devCostForm.guideline_value}
                    onChange={e => setDevCostForm(p => ({ ...p, guideline_value: e.target.value }))}
                    placeholder="e.g. 2500"
                  />
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Plot Area (sq.ft.)</label>
                  <input
                    className="col-form-input"
                    type="number" step="0.01"
                    value={devCostForm.plot_area}
                    onChange={e => setDevCostForm(p => ({ ...p, plot_area: e.target.value }))}
                    placeholder="e.g. 1200"
                  />
                </div>
                <div className="col-form-group">
                  <label className="col-form-label">Dev Cost (₹/sq.ft.)</label>
                  <input
                    className="col-form-input"
                    type="number" step="0.01"
                    value={devCostForm.development_cost_per_sqft}
                    onChange={e => setDevCostForm(p => ({ ...p, development_cost_per_sqft: e.target.value }))}
                    placeholder="e.g. 500"
                  />
                </div>
              </div>

              {/* Live computed preview */}
              {(() => {
                const d = computeDerived(devCostForm);
                return (
                  <div style={{ marginTop: 20, background: 'var(--bg-secondary)', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--accent-blue)' }}><ChartBarIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />Computed Values (Live Preview)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Plot Value</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(d.plot_value)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Guideline × Plot Area</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stamp Value (7%)</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(d.stamp_value)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Plot Value × 7% (rounded ↑100)</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Registration Exp (2%)</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(d.registration_exp)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Plot Value × 2% (rounded ↑100)</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Development Charges</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(d.development_charges)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Area × Dev/sqft) + 18% GST</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setDevCostModal(null)}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={handleDevCostSave} disabled={devCostSaving}>
                {devCostSaving ? 'Saving...' : 'Save Development Costs'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { CollectionBookings };
