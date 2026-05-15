import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  MagnifyingGlassIcon, ArrowPathIcon, ClipboardDocumentListIcon,
  EyeIcon, BanknotesIcon, PencilSquareIcon, CheckCircleIcon,
  CreditCardIcon, ShieldCheckIcon, CalendarDaysIcon,
  ClockIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import '../common/LeadWorkspacePage.css';
import './CollectionWorkspace.css';

export const CollectionBookings = ({ user, onSelectBooking, initialTab }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusOptions, setStatusOptions] = useState([]);

  // Quick Action Drawer state
  const [drawerBooking, setDrawerBooking] = useState(null);
  const [drawerMode, setDrawerMode] = useState(null); // 'status' | 'pay' | 'verify' | 'payStatus'
  // Status form
  const [newStatusId, setNewStatusId] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelRemarks, setCancelRemarks] = useState('');
  // Payment form
  const [payForm, setPayForm] = useState({ payment_type: 'Installment', payment_mode: 'Online', amount: '', payment_date: '', transaction_ref: '', remarks: '' });
  const [paySaving, setPaySaving] = useState(false);
  // Verify form
  const [verifyPaymentId, setVerifyPaymentId] = useState('');
  const [verifyForm, setVerifyForm] = useState({ transaction_id: '', verification_note: '' });
  const [verifySaving, setVerifySaving] = useState(false);
  // Payment status form
  const [paymentStatus, setPaymentStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [payStatusSaving, setPayStatusSaving] = useState(false);
  // Activity history
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const PAYMENT_STATUSES = ['Bank Loan Applied', 'OSR Received', 'Registration Scheduled', 'Part Payment Received', 'Full Payment Received', 'Follow Up'];

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (activeTab === 'Active') params.is_cancelled = 'false';
      if (activeTab === 'Cancelled') params.is_cancelled = 'true';
      const resp = await bookingApi.getMyBookings(params);
      const raw = resp.data?.data?.rows || resp.data?.data || [];
      setBookings(Array.isArray(raw) ? raw : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => {
    bookingStatusApi.getDropdown().then(r => setStatusOptions(r.data?.data || r.data || [])).catch(() => {});
    bookingApi.getCancelReasons().then(r => setCancelReasons(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter((b) =>
      (b.booking_number || '').toLowerCase().includes(q) ||
      (b.customer_name || '').toLowerCase().includes(q) ||
      (b.project_name || '').toLowerCase().includes(q) ||
      (b.unit_display || b.unit_number || '').toLowerCase().includes(q) ||
      (b.buyer_name || '').toLowerCase().includes(q)
    );
  }, [bookings, searchQuery]);

  // ── Drawer helpers ──
  const openDrawer = (booking, mode) => {
    setDrawerBooking(booking);
    setDrawerMode(mode);
    setNewStatusId('');
    setCancelReasonId(''); setCancelRemarks('');
    setPayForm({ payment_type: 'Installment', payment_mode: 'Online', amount: '', payment_date: '', transaction_ref: '', remarks: '' });
    setVerifyPaymentId('');
    setVerifyForm({ transaction_id: '', verification_note: '' });
    setPaymentStatus(booking.payment_status || '');
    setFollowUpDate('');
    // Load activities
    setActivitiesLoading(true);
    bookingApi.getActivities(booking.id).then(r => setActivities(r.data?.data || r.data || [])).catch(() => {}).finally(() => setActivitiesLoading(false));
  };
  const closeDrawer = () => { setDrawerBooking(null); setDrawerMode(null); setActivities([]); };

  const handleStatusUpdate = async () => {
    if (!newStatusId || !drawerBooking) return;
    // Find selected status to check if it's Cancelled
    const selectedStatus = statusOptions.find(s => String(s.id) === newStatusId);
    const isCancelled = selectedStatus?.status_code === 'CANCELLED';
    if (isCancelled && !cancelReasonId) { toast.error('Select a cancellation reason'); return; }
    setStatusSaving(true);
    try {
      const payload = { booking_status_id: newStatusId };
      if (isCancelled) { payload.cancel_reason_id = cancelReasonId; payload.cancel_remarks = cancelRemarks; }
      await bookingApi.update(drawerBooking.id, payload);
      toast.success('Booking status updated');
      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update status')); }
    finally { setStatusSaving(false); }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!paymentStatus || !drawerBooking) return;
    if (paymentStatus === 'Follow Up' && !followUpDate) { toast.error('Select a follow-up date'); return; }
    setPayStatusSaving(true);
    try {
      await bookingApi.updatePaymentStatus(drawerBooking.id, {
        payment_status: paymentStatus,
        next_follow_up_at: paymentStatus === 'Follow Up' ? followUpDate : null,
      });
      toast.success('Payment status updated');
      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update payment status')); }
    finally { setPayStatusSaving(false); }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0 || !drawerBooking) { toast.error('Enter valid amount'); return; }
    setPaySaving(true);
    try {
      await bookingApi.addPayment(drawerBooking.id, { ...payForm, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded successfully');
      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to record payment')); }
    finally { setPaySaving(false); }
  };

  const handleVerifyPayment = async () => {
    if (!verifyPaymentId || !drawerBooking) return;
    setVerifySaving(true);
    try {
      await bookingApi.verifyPayment(drawerBooking.id, verifyPaymentId, verifyForm);
      toast.success('Payment verified');
      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Verification failed')); }
    finally { setVerifySaving(false); }
  };

  const getProgressClass = (pct) => {
    if (pct >= 100) return 'success';
    if (pct >= 50) return '';
    return 'warning';
  };

  return (
    <div className="col-bookings-page">
      {/* Page Header */}
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>Bookings</h1>
          <p className="hidden sm:block">Manage all property bookings and collections</p>
        </div>
        <div className="page-header-actions flex-wrap" style={{ gap: 8 }}>
          <div style={{ position: 'relative', minWidth: 220 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search bookings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="col-form-input" style={{ paddingLeft: 32, height: 36, fontSize: 13, width: '100%' }} />
          </div>
          <div className="filter-tabs">
            {['All', 'Active', 'Cancelled'].map((tab) => (
              <button key={tab} className={`filter-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </div>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadBookings}>
            <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />Refresh
          </button>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="crm-card">
        <div className="crm-card-body-flush">
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <ArrowPathIcon style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading bookings...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">{searchQuery ? 'No bookings match your search' : 'No bookings found'}</div>
              <div className="col-empty-desc">{searchQuery ? 'Try a different search term' : 'Bookings from Sales Head will appear here'}</div>
            </div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Booking #</th>
                    <th>Buyer</th>
                    <th>Project · Unit</th>
                    <th>Net Value</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const pct = booking.payment_percentage || 0;
                    return (
                      <tr key={booking.id}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{booking.booking_number}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{booking.customer_name || booking.buyer_name || '-'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{booking.lead?.lead_number || ''}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{booking.project_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unit: {booking.unit_display || booking.unit_number || 'TBD'}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(booking.net_amount)}</td>
                        <td style={{ minWidth: 90 }}>
                          <div className="col-progress" style={{ height: 6, width: '100%' }}>
                            <div className={`col-progress-bar ${getProgressClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{pct}%</div>
                        </td>
                        <td>
                          <span className="col-badge" style={{ background: `${booking.status_color}22`, color: booking.status_color }}>
                            <span className="col-badge-dot" style={{ background: booking.status_color }} />
                            {booking.status_label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(booking.booking_date)}</td>
                        <td>
                          <div className="col-qa-actions">
                            <button className="col-qa-btn col-qa-view" title="View Details" onClick={() => onSelectBooking(booking.id)}>
                              <EyeIcon style={{ width: 15, height: 15 }} />
                            </button>
                            <button className="col-qa-btn col-qa-pay" title="Record Payment" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'pay'); }}>
                              <BanknotesIcon style={{ width: 15, height: 15 }} />
                            </button>
                            <button className="col-qa-btn col-qa-status" title="Update Status" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'status'); }}>
                              <PencilSquareIcon style={{ width: 15, height: 15 }} />
                            </button>
                            <button className="col-qa-btn col-qa-verify" title="Verify Payment" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'verify'); }}>
                              <ShieldCheckIcon style={{ width: 15, height: 15 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {!loading && filteredBookings.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><strong>{filteredBookings.length}</strong> bookings</span>
          <span>Value: <strong style={{ color: 'var(--accent-blue)' }}>{formatCurrency(filteredBookings.reduce((s, b) => s + parseFloat(b.net_amount || 0), 0))}</strong></span>
          <span>Collected: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(filteredBookings.reduce((s, b) => s + parseFloat(b.total_paid || 0), 0))}</strong></span>
        </div>
      )}

      {/* ══════════ QUICK ACTION DRAWER ══════════ */}
      {drawerBooking && (
        <div className="col-modal-overlay" onClick={closeDrawer}>
          <div className="qa-modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="qa-drawer-handle" />

            {/* Header */}
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{ background: `${drawerBooking.status_color}22`, color: drawerBooking.status_color, border: `2px solid ${drawerBooking.status_color}` }}>
                  {(drawerBooking.customer_name || 'B')[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="qa-drawer-name">{drawerBooking.customer_name || drawerBooking.buyer_name || 'Customer'}</div>
                  <div className="qa-drawer-meta">{drawerBooking.booking_number} · {drawerBooking.project_name}</div>
                  <div className="qa-drawer-budget">
                    Net: {formatCurrency(drawerBooking.net_amount)} · Paid: <span style={{ color: 'var(--accent-green)' }}>{formatCurrency(drawerBooking.total_paid || 0)}</span>
                  </div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={closeDrawer}>×</button>
            </div>

            {/* Mode Tabs */}
            <div className="qa-drawer-section" style={{ paddingBottom: 0 }}>Quick Actions</div>
            <div className="qa-drawer-status-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', padding: '8px 20px 16px' }}>
              <button className={`qa-drawer-st-btn ${drawerMode === 'status' ? 'sel-default' : ''}`} onClick={() => setDrawerMode('status')}>
                <div className="qa-drawer-st-icon"><PencilSquareIcon style={{ width: 22, height: 22 }} /></div>
                <div className="qa-drawer-st-label">Booking Status</div>
              </button>
              <button className={`qa-drawer-st-btn ${drawerMode === 'payStatus' ? 'sel-follow-up' : ''}`} onClick={() => setDrawerMode('payStatus')}>
                <div className="qa-drawer-st-icon"><CreditCardIcon style={{ width: 22, height: 22 }} /></div>
                <div className="qa-drawer-st-label">Pay Status</div>
              </button>
              <button className={`qa-drawer-st-btn ${drawerMode === 'pay' ? 'sel-sv-done' : ''}`} onClick={() => setDrawerMode('pay')}>
                <div className="qa-drawer-st-icon"><BanknotesIcon style={{ width: 22, height: 22 }} /></div>
                <div className="qa-drawer-st-label">Record Pay</div>
              </button>
              <button className={`qa-drawer-st-btn ${drawerMode === 'verify' ? 'sel-default' : ''}`} onClick={() => setDrawerMode('verify')}>
                <div className="qa-drawer-st-icon"><ShieldCheckIcon style={{ width: 22, height: 22 }} /></div>
                <div className="qa-drawer-st-label">Verify Pay</div>
              </button>
              <button className={`qa-drawer-st-btn`} onClick={() => { closeDrawer(); onSelectBooking(drawerBooking.id); }}>
                <div className="qa-drawer-st-icon"><EyeIcon style={{ width: 22, height: 22 }} /></div>
                <div className="qa-drawer-st-label">View Detail</div>
              </button>
            </div>

            <div className="qa-drawer-divider" />

            {/* ── BOOKING STATUS UPDATE MODE ── */}
            {drawerMode === 'status' && (
              <div style={{ padding: '16px 20px' }}>
                <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Select New Booking Status</div>
                <div className="qa-drawer-status-grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {statusOptions.map(s => (
                    <button key={s.id} className={`qa-drawer-st-btn ${newStatusId === String(s.id) ? 'sel-default' : ''}`}
                      onClick={() => setNewStatusId(String(s.id))}>
                      <div className="qa-drawer-st-icon" style={{ fontSize: 16 }}>
                        {s.status_code === 'CANCELLED' ? (
                          <ExclamationTriangleIcon style={{ width: 18, height: 18, color: s.color_code || '#EF4444' }} />
                        ) : (
                          <CheckCircleIcon style={{ width: 18, height: 18, color: s.color_code || 'var(--accent-blue)' }} />
                        )}
                      </div>
                      <div className="qa-drawer-st-label">{s.status_name}</div>
                    </button>
                  ))}
                </div>

                {/* Cancel reason dropdown — shown when Cancelled is selected */}
                {(() => {
                  const sel = statusOptions.find(s => String(s.id) === newStatusId);
                  if (sel?.status_code === 'CANCELLED') {
                    return (
                      <div style={{ marginTop: 14 }}>
                        <label className="qa-drawer-field-label">Cancel Reason *</label>
                        <select className="qa-drawer-field-select" style={{ width: '100%' }} value={cancelReasonId}
                          onChange={e => setCancelReasonId(e.target.value)}>
                          <option value="">— Select reason —</option>
                          {cancelReasons.map(r => <option key={r.id} value={r.id}>{r.reason_name}</option>)}
                        </select>
                        <div style={{ marginTop: 8 }}>
                          <label className="qa-drawer-field-label">Cancel Remarks</label>
                          <textarea className="qa-drawer-remark-ta" rows={2} placeholder="Additional remarks..."
                            value={cancelRemarks} onChange={e => setCancelRemarks(e.target.value)} />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="qa-drawer-save-row" style={{ padding: '16px 0 0', position: 'relative', borderTop: 'none' }}>
                  <button className="qa-drawer-save-btn" disabled={!newStatusId || statusSaving} onClick={handleStatusUpdate}>
                    {statusSaving ? 'Updating...' : <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Booking Status</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── PAYMENT STATUS UPDATE MODE ── */}
            {drawerMode === 'payStatus' && (
              <div style={{ padding: '16px 20px' }}>
                <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Update Payment Status</div>
                <div className="qa-drawer-status-grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {PAYMENT_STATUSES.map(ps => (
                    <button key={ps} className={`qa-drawer-st-btn ${paymentStatus === ps ? 'sel-follow-up' : ''}`}
                      onClick={() => setPaymentStatus(ps)}>
                      <div className="qa-drawer-st-icon" style={{ fontSize: 16 }}>
                        {ps === 'Follow Up' ? (
                          <CalendarDaysIcon style={{ width: 18, height: 18, color: '#F59E0B' }} />
                        ) : ps === 'Full Payment Received' ? (
                          <CheckCircleIcon style={{ width: 18, height: 18, color: '#10B981' }} />
                        ) : (
                          <CreditCardIcon style={{ width: 18, height: 18, color: '#3B82F6' }} />
                        )}
                      </div>
                      <div className="qa-drawer-st-label" style={{ fontSize: 10 }}>{ps}</div>
                    </button>
                  ))}
                </div>

                {/* Follow Up date — shown when Follow Up is selected */}
                {paymentStatus === 'Follow Up' && (
                  <div style={{ marginTop: 14 }}>
                    <label className="qa-drawer-field-label">Follow-Up Date *</label>
                    <input className="qa-drawer-field-input" style={{ width: '100%' }} type="date" value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)} />
                  </div>
                )}

                <div className="qa-drawer-save-row" style={{ padding: '16px 0 0', position: 'relative', borderTop: 'none' }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#6366F1' }} disabled={!paymentStatus || payStatusSaving} onClick={handlePaymentStatusUpdate}>
                    {payStatusSaving ? 'Updating...' : <><CreditCardIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Payment Status</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── RECORD PAYMENT MODE ── */}
            {drawerMode === 'pay' && (
              <div style={{ padding: '16px 20px' }}>
                <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Record New Payment</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="qa-drawer-field-label">Payment Type</label>
                    <select className="qa-drawer-field-select" style={{ width: '100%' }} value={payForm.payment_type} onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))}>
                      {['Token', 'Down Payment', 'Installment', 'EMI', 'Final Payment', 'Other'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="qa-drawer-field-label">Payment Mode</label>
                    <select className="qa-drawer-field-select" style={{ width: '100%' }} value={payForm.payment_mode} onChange={e => setPayForm(p => ({ ...p, payment_mode: e.target.value }))}>
                      {['Cash', 'Cheque', 'Online', 'NEFT/RTGS', 'UPI', 'DD'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="qa-drawer-field-label">Amount (₹) *</label>
                    <input className="qa-drawer-field-input" style={{ width: '100%' }} type="number" placeholder="0.00" value={payForm.amount}
                      onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="qa-drawer-field-label">Payment Date</label>
                    <input className="qa-drawer-field-input" style={{ width: '100%' }} type="date" value={payForm.payment_date}
                      onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="qa-drawer-field-label">Transaction Ref</label>
                    <input className="qa-drawer-field-input" style={{ width: '100%' }} type="text" placeholder="UTR / Cheque #" value={payForm.transaction_ref}
                      onChange={e => setPayForm(p => ({ ...p, transaction_ref: e.target.value }))} />
                  </div>
                  <div>
                    <label className="qa-drawer-field-label">Remarks</label>
                    <input className="qa-drawer-field-input" style={{ width: '100%' }} type="text" placeholder="Optional" value={payForm.remarks}
                      onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))} />
                  </div>
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 0 0', position: 'relative', borderTop: 'none' }}>
                  <button className="qa-drawer-save-btn" disabled={paySaving || !payForm.amount} onClick={handleAddPayment}>
                    {paySaving ? 'Recording...' : <><BanknotesIcon style={{ width: 14, height: 14, marginRight: 4 }} />Record Payment</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── VERIFY PAYMENT MODE ── */}
            {drawerMode === 'verify' && (
              <div style={{ padding: '16px 20px' }}>
                <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Verify a Payment</div>
                {/* Payment list for this booking */}
                {(drawerBooking.payments || []).length === 0 ? (
                  <div className="col-empty" style={{ padding: 20 }}>
                    <div className="col-empty-title">No payments to verify</div>
                    <div className="col-empty-desc">Record a payment first</div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label className="qa-drawer-field-label">Select Payment to Verify</label>
                      <select className="qa-drawer-field-select" style={{ width: '100%' }} value={verifyPaymentId}
                        onChange={e => {
                          setVerifyPaymentId(e.target.value);
                          const p = (drawerBooking.payments || []).find(pm => String(pm.id) === e.target.value);
                          if (p) setVerifyForm({ transaction_id: p.transaction_ref || '', verification_note: '' });
                        }}>
                        <option value="">— Select payment —</option>
                        {(drawerBooking.payments || []).filter(p => !p.is_verified).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.payment_number || `#${p.id}`} — {formatCurrency(p.amount)} ({p.payment_mode}) {p.is_verified ? 'Verified' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {verifyPaymentId && (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <label className="qa-drawer-field-label">Transaction ID *</label>
                          <input className="qa-drawer-field-input" style={{ width: '100%' }} type="text" placeholder="Enter transaction ID"
                            value={verifyForm.transaction_id} onChange={e => setVerifyForm(p => ({ ...p, transaction_id: e.target.value }))} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label className="qa-drawer-field-label">Verification Note</label>
                          <textarea className="qa-drawer-remark-ta" rows={2} placeholder="Optional note..."
                            value={verifyForm.verification_note} onChange={e => setVerifyForm(p => ({ ...p, verification_note: e.target.value }))} />
                        </div>
                        <div className="qa-drawer-save-row" style={{ padding: '16px 0 0', position: 'relative', borderTop: 'none' }}>
                          <button className="qa-drawer-save-btn" style={{ background: '#5B3FA6' }} disabled={verifySaving} onClick={handleVerifyPayment}>
                            {verifySaving ? 'Verifying...' : <><ShieldCheckIcon style={{ width: 14, height: 14, marginRight: 4 }} />Verify Payment</>}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── ACTIVITY HISTORY ── */}
            <div className="qa-drawer-divider" />
            <div style={{ padding: '12px 20px 20px' }}>
              <div className="qa-drawer-section" style={{ padding: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ClockIcon style={{ width: 14, height: 14 }} /> Activity History
              </div>
              {activitiesLoading ? (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
              ) : activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No activity yet</div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                  {activities.slice(0, 20).map((act, i) => (
                    <div key={act.id || i} style={{
                      display: 'flex', gap: 10, paddingBottom: 10, marginBottom: 10,
                      borderBottom: i < activities.length - 1 ? '1px solid var(--border-primary)' : 'none',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: act.activity_type === 'STATUS_CHANGE' ? '#3B82F622' :
                          act.activity_type === 'PAYMENT_STATUS_CHANGE' ? '#6366F122' :
                          act.activity_type === 'PAYMENT_RECORDED' ? '#10B98122' : '#6B728022',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: act.activity_type === 'STATUS_CHANGE' ? '#3B82F6' :
                          act.activity_type === 'PAYMENT_STATUS_CHANGE' ? '#6366F1' :
                          act.activity_type === 'PAYMENT_RECORDED' ? '#10B981' : '#6B7280',
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {act.activity_type === 'STATUS_CHANGE' ? <ClipboardDocumentListIcon style={{ width: 13, height: 13 }} /> :
                         act.activity_type === 'PAYMENT_STATUS_CHANGE' ? <CreditCardIcon style={{ width: 13, height: 13 }} /> :
                         act.activity_type === 'PAYMENT_RECORDED' ? <BanknotesIcon style={{ width: 13, height: 13 }} /> :
                         act.activity_type === 'PAYMENT_VERIFIED' ? <ShieldCheckIcon style={{ width: 13, height: 13 }} /> : <PencilSquareIcon style={{ width: 13, height: 13 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{act.title}</div>
                        {act.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{act.description}</div>}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                          {act.performedBy ? `${act.performedBy.first_name} ${act.performedBy.last_name}` : ''} · {new Date(act.performed_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionBookings;
