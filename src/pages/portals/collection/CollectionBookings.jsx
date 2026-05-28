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

const getComputedTotalValue = (booking) => {
  if (!booking) return 0;
  const toAmount = (v) => {
    const n = parseFloat(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const plotValue = toAmount(booking.plot_value || booking.base_price || booking.total_amount || booking.net_amount);
  const stampValue = toAmount(booking.stamp_value || booking.stamp_duty);
  const registrationValue = toAmount(booking.registration_exp || booking.registration_charges);
  const developmentValue = toAmount(booking.development_charges);
  const computedTotalValue = plotValue + stampValue + registrationValue + developmentValue;
  return computedTotalValue > 0 ? computedTotalValue : toAmount(booking.net_amount || booking.total_amount);
};

export const CollectionBookings = ({ user, onSelectBooking, initialTab }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusOptions, setStatusOptions] = useState([]);

  // Quick Action Drawer state
  const [drawerBooking, setDrawerBooking] = useState(null);
  const [drawerMode, setDrawerMode] = useState(null); // 'status' | 'pay' | 'payStatus'
  // Status form
  const [newStatusId, setNewStatusId] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [paymentModeOptions, setPaymentModeOptions] = useState([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  // Payment form
  const [payForm, setPayForm] = useState({ payment_type: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', bank_id: '', remarks: '' });
  const [paySaving, setPaySaving] = useState(false);
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
    bookingApi.getPaymentFormMasters().then((r) => {
      const payload = r.data?.data || r.data || {};
      setPaymentModeOptions(payload.payment_modes || []);
      setPaymentTypeOptions(payload.payment_types || []);
      setBankOptions(payload.banks || []);
    }).catch(() => {
      setPaymentModeOptions([]);
      setPaymentTypeOptions([]);
      setBankOptions([]);
    });
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
    setPayForm({ payment_type: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', bank_id: '', remarks: '' });
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
    const isCancelled = selectedStatus?.status_code === 'CANCEL' || selectedStatus?.status_code === 'CANCELLED';
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
    if (!payForm.payment_type) {
      toast.error('Please select a payment type');
      return;
    }
    const selectedMode = paymentModeOptions.find((mode) => String(mode.id) === String(payForm.payment_mode_id));
    const selectedModeName = selectedMode?.mode_name || payForm.payment_mode;
    if (!payForm.payment_mode_id || !selectedModeName) {
      toast.error('Please select a payment mode');
      return;
    }
    if (selectedModeName !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim())) {
      toast.error(`Reference / UTR / Cheque No. is required for ${selectedModeName}`);
      return;
    }
    setPaySaving(true);
    try {
      await bookingApi.addPayment(drawerBooking.id, {
        ...payForm,
        payment_mode: selectedModeName,
        amount: parseFloat(payForm.amount),
      });
      toast.success('Payment recorded successfully');
      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to record payment')); }
    finally { setPaySaving(false); }
  };

  const getProgressClass = (pct) => {
    if (pct >= 100) return 'success';
    if (pct >= 50) return '';
    return 'warning';
  };

  const renderActivityHistory = () => {
    return (
      <div style={{ marginTop: 24 }}>
        <div className="qa-drawer-divider" style={{ margin: '0 0 16px' }} />
        <div className="qa-drawer-section" style={{ padding: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClockIcon style={{ width: 14, height: 14 }} /> Activity History
        </div>
        {activitiesLoading ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Loading...</div>
        ) : activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No activity yet</div>
        ) : (
          <div style={{ paddingRight: 4 }}>
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
    );
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
          <button type="button" className="crm-btn crm-btn-ghost" onClick={loadBookings}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
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
                        <td style={{ fontWeight: 600 }}>{formatCurrency(getComputedTotalValue(booking))}</td>
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
                            <button className="col-qa-btn col-qa-status" title="Update Payment Status" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'payStatus'); }}>
                              <CreditCardIcon style={{ width: 15, height: 15 }} />
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
          <span>Value: <strong style={{ color: 'var(--accent-blue)' }}>{formatCurrency(filteredBookings.reduce((s, b) => s + getComputedTotalValue(b), 0))}</strong></span>
          <span>Collected: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(filteredBookings.reduce((s, b) => s + parseFloat(b.total_paid || 0), 0))}</strong></span>
        </div>
      )}

      {/* ══════════ QUICK ACTION DRAWER ══════════ */}
      {drawerBooking && (
        <div className="col-modal-overlay" onClick={closeDrawer}>
          <div className="qa-modal-panel" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
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
                  <div className="qa-drawer-budget" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(getComputedTotalValue(drawerBooking))}</strong> · Paid: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(drawerBooking.total_paid || 0)}</span> · Balance: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{formatCurrency(getComputedTotalValue(drawerBooking) - (drawerBooking.total_paid || 0))}</span>
                  </div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={closeDrawer}>×</button>
            </div>

            <div className="qa-drawer-divider" />

            {/* ── BOOKING STATUS UPDATE MODE ── */}
            {drawerMode === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Select New Booking Status</div>
                  <div className="qa-drawer-status-grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {statusOptions.map(s => (
                      <button key={s.id} className={`qa-drawer-st-btn ${newStatusId === String(s.id) ? 'sel-default' : ''}`}
                        onClick={() => setNewStatusId(String(s.id))}>
                        <div className="qa-drawer-st-icon" style={{ fontSize: 16 }}>
                          {s.status_code === 'CANCEL' || s.status_code === 'CANCELLED' ? (
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
                    if (sel?.status_code === 'CANCEL' || sel?.status_code === 'CANCELLED') {
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

                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" disabled={!newStatusId || statusSaving} onClick={handleStatusUpdate}>
                    {statusSaving ? 'Updating...' : <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Booking Status</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── PAYMENT STATUS UPDATE MODE ── */}
            {drawerMode === 'payStatus' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
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

                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#6366F1' }} disabled={!paymentStatus || payStatusSaving} onClick={handlePaymentStatusUpdate}>
                    {payStatusSaving ? 'Updating...' : <><CreditCardIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Payment Status</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── RECORD PAYMENT MODE ── */}
            {drawerMode === 'pay' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
                    <div>Net: <strong>{formatCurrency(getComputedTotalValue(drawerBooking))}</strong></div>
                    <div>Paid: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(drawerBooking.total_paid || 0)}</strong></div>
                    <div>Balance: <strong style={{ color: 'var(--accent-red)' }}>{formatCurrency(getComputedTotalValue(drawerBooking) - (drawerBooking.total_paid || 0))}</strong></div>
                  </div>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Record New Payment</div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Payment Date *</label>
                      <input type="date" className="bkd-form-control" value={payForm.payment_date} onChange={e => setPayForm(p => ({...p, payment_date:e.target.value}))}/>
                    </div>
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Amount (₹) *</label>
                      <input type="number" className="bkd-form-control" placeholder="e.g. 500000" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Payment Mode *</label>
                      <select className="bkd-form-control" value={payForm.payment_mode_id} onChange={e => {
                        const selectedId = e.target.value;
                        const selectedMode = paymentModeOptions.find((mode) => String(mode.id) === String(selectedId));
                        setPayForm(p => ({ ...p, payment_mode_id: selectedId, payment_mode: selectedMode?.mode_name || '' }));
                      }}>
                        <option value="">Select payment mode</option>
                        {paymentModeOptions.map((mode) => <option key={mode.id} value={mode.id}>{mode.mode_name}</option>)}
                      </select>
                    </div>
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Reference / UTR / Cheque No. {payForm.payment_mode !== 'Cash' ? '*' : ''}</label>
                      <input type="text" className="bkd-form-control" placeholder="e.g. UTR123456" value={payForm.transaction_ref} onChange={e => setPayForm(p => ({...p, transaction_ref:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Company Bank</label>
                      <select className="bkd-form-control" value={payForm.bank_id || ''} onChange={e => setPayForm(p => ({ ...p, bank_id: e.target.value }))}>
                        <option value="">Select bank</option>
                        {bankOptions.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.bank_name} - {bank.account_number}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Payment Type</label>
                      <select className="bkd-form-control" value={payForm.payment_type} onChange={e => setPayForm(p => ({...p, payment_type:e.target.value}))}>
                        <option value="">Select payment type</option>
                        {paymentTypeOptions.map((type) => <option key={type.id} value={type.type_name}>{type.type_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Remarks</label>
                    <textarea className="bkd-form-control" rows={2} placeholder="Notes for accounts team..." value={payForm.remarks} onChange={e => setPayForm(p => ({...p, remarks:e.target.value}))}/>
                  </div>
                  <div className="bkd-info-banner">This payment will be sent to <strong>Accounts Executive</strong> for verification. Status will show as <em>Unverified</em> until approved.</div>

                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" disabled={paySaving || !payForm.amount || !payForm.payment_type || !payForm.payment_mode_id || (payForm.payment_mode !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim()))} onClick={handleAddPayment}>
                    {paySaving ? 'Saving...' : 'Submit Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionBookings;
