import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, CreditCardIcon,
  BanknotesIcon, UserIcon, ClockIcon,
  ExclamationTriangleIcon, PrinterIcon, PlusIcon,
  CheckCircleIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ShieldCheckIcon
} from '@heroicons/react/24/outline';
import '../common/LeadWorkspacePage.css';
import './CollectionWorkspace.css';

/* ── tiny helpers ── */
const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const InfoRow = ({label,value,mono,color}) => (
  <div className="bkd-info-item">
    <div className="bkd-info-label">{label}</div>
    <div className={`bkd-info-value${mono?' mono':''}`} style={color?{color}:undefined}>{value || '—'}</div>
  </div>
);

const CollectionBookingDetail = ({ user, bookingId, onBack }) => {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusOptions, setStatusOptions] = useState([]);
  const [actionMode, setActionMode] = useState(null); // 'pay' | 'status' | 'payStatus' | 'devCost'
  const [payForm, setPayForm] = useState({ payment_type:'Installment', payment_mode:'Online', amount:'', payment_date:'', transaction_ref:'', bank_name:'', remarks:'' });
  const [paySaving, setPaySaving] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [payStatusSaving, setPayStatusSaving] = useState(false);
  const [devCostForm, setDevCostForm] = useState({ guideline_value: '', plot_area: '', development_cost_per_sqft: '' });
  const [devCostSaving, setDevCostSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const PAYMENT_STATUSES = ['Bank Loan Applied', 'OSR Received', 'Registration Scheduled', 'Part Payment Received', 'Full Payment Received', 'Follow Up'];

  const loadActivities = useCallback(async () => {
    if (!bookingId) return;
    setActivitiesLoading(true);
    try {
      const r = await bookingApi.getActivities(bookingId);
      setActivities(r.data?.data || r.data || []);
    } catch (e) {
    } finally {
      setActivitiesLoading(false);
    }
  }, [bookingId]);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      setBooking(resp.data?.data || resp.data);
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to load booking')); }
    finally { setLoading(false); }
  }, [bookingId]);

  useEffect(() => { loadBooking(); }, [loadBooking]);
  useEffect(() => {
    bookingStatusApi.getDropdown().then(r => setStatusOptions(r.data?.data || r.data || [])).catch(()=>{});
    bookingApi.getCancelReasons().then(r => setCancelReasons(r.data?.data || r.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const openActionModal = (mode) => {
    setActionMode(mode);
    if (mode === 'status') {
      setNewStatusId('');
      setCancelReasonId('');
      setCancelRemarks('');
      return;
    }
    if (mode === 'payStatus') {
      setPaymentStatus(booking?.payment_status || '');
      setFollowUpDate('');
      return;
    }
    if (mode === 'pay') {
      setPayForm({ payment_type:'Installment', payment_mode:'Online', amount:'', payment_date:'', transaction_ref:'', bank_name:'', remarks:'' });
      return;
    }
    if (mode === 'devCost') {
      setDevCostForm({
        guideline_value: booking?.guideline_value ?? '',
        plot_area: booking?.plot_area ?? '',
        development_cost_per_sqft: booking?.development_cost_per_sqft ?? '',
      });
    }
  };

  const closeActionModal = () => setActionMode(null);

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    setPaySaving(true);
    try {
      await bookingApi.addPayment(bookingId, { ...payForm, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded');
      closeActionModal();
      setPayForm({ payment_type:'Installment', payment_mode:'Online', amount:'', payment_date:'', transaction_ref:'', bank_name:'', remarks:'' });
      loadBooking();
      loadActivities();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setPaySaving(false); }
  };

  const handleStatusUpdate = async () => {
    if (!newStatusId) return;
    const selectedStatus = statusOptions.find(s => String(s.id) === newStatusId);
    const isCancelled = selectedStatus?.status_code === 'CANCEL' || selectedStatus?.status_code === 'CANCELLED';
    if (isCancelled && !cancelReasonId) {
      toast.error('Select a cancellation reason');
      return;
    }
    setStatusSaving(true);
    try {
      const payload = { booking_status_id: newStatusId };
      if (isCancelled) {
        payload.cancel_reason_id = cancelReasonId;
        payload.cancel_remarks = cancelRemarks;
      }
      await bookingApi.update(bookingId, payload);
      toast.success('Status updated');
      closeActionModal();
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status'));
    } finally {
      setStatusSaving(false);
    }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!paymentStatus) return;
    if (paymentStatus === 'Follow Up' && !followUpDate) {
      toast.error('Select a follow-up date');
      return;
    }
    setPayStatusSaving(true);
    try {
      await bookingApi.updatePaymentStatus(bookingId, {
        payment_status: paymentStatus,
        next_follow_up_at: paymentStatus === 'Follow Up' ? followUpDate : null,
      });
      toast.success('Payment status updated');
      closeActionModal();
      setFollowUpDate('');
      loadBooking();
      loadActivities();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update payment status')); }
    finally { setPayStatusSaving(false); }
  };

  const handleDevelopmentCostUpdate = async () => {
    const guideline = parseFloat(devCostForm.guideline_value || 0);
    const area = parseFloat(devCostForm.plot_area || 0);
    const perSqft = parseFloat(devCostForm.development_cost_per_sqft || 0);
    if (guideline <= 0 || area <= 0 || perSqft <= 0) {
      toast.error('Enter valid guideline value, plot area, and development cost/sqft');
      return;
    }
    setDevCostSaving(true);
    try {
      await bookingApi.updateDevelopmentCost(bookingId, {
        guideline_value: guideline,
        plot_area: area,
        development_cost_per_sqft: perSqft,
      });
      toast.success('Development cost updated');
      closeActionModal();
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update development cost'));
    } finally {
      setDevCostSaving(false);
    }
  };

  if (loading) return (
    <div style={{padding:60,textAlign:'center'}}>
      <ArrowPathIcon style={{width:32,height:32,color:'var(--text-muted)',margin:'0 auto',animation:'spin 1s linear infinite'}}/>
      <p style={{color:'var(--text-muted)',marginTop:10}}>Loading booking details...</p>
    </div>
  );
  if (!booking) return (
    <div className="col-empty"><div className="col-empty-title">Booking not found</div>
      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={onBack}>Go Back</button>
    </div>
  );

  const payments = booking.payments || [];
  const customer = booking.customer || {};
  const toAmount = (v) => {
    const n = parseFloat(v || 0);
    return Number.isFinite(n) ? n : 0;
  };
  const totalPaid = toAmount(booking.total_paid);
  const plotValue = toAmount(booking.plot_value || booking.base_price || booking.total_amount || booking.net_amount);
  const stampValue = toAmount(booking.stamp_value || booking.stamp_duty);
  const registrationValue = toAmount(booking.registration_exp || booking.registration_charges);
  const developmentValue = toAmount(booking.development_charges);
  const computedTotalValue = plotValue + stampValue + registrationValue + developmentValue;
  const totalValue = computedTotalValue > 0 ? computedTotalValue : toAmount(booking.net_amount || booking.total_amount);
  const balanceDue = totalValue - totalPaid;
  const pctCollected = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;
  const unverifiedAmt = payments.filter(p => !p.is_verified && !p.is_bounced).reduce((s,p) => s + parseFloat(p.amount||0), 0);
  const verifiedCount = payments.filter(p => p.is_verified).length;
  const pendingCount = payments.filter(p => !p.is_verified && !p.is_bounced).length;

  // Check overdue
  const isOverdue = booking.next_follow_up_at && new Date(booking.next_follow_up_at) < new Date();
  const overdueDays = isOverdue ? Math.floor((Date.now() - new Date(booking.next_follow_up_at).getTime()) / 86400000) : 0;

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
    <div className="bkd-page">
      {/* Page Header */}
      <div className="bkd-header">
        <div className="bkd-header-left">
          <button className="bkd-back-btn" onClick={onBack}><ArrowLeftIcon style={{width:16,height:16}}/></button>
          <div>
            <h1 className="bkd-title">Booking Details — {booking.booking_number}</h1>
            <p className="bkd-subtitle">{booking.project_name} · {booking.unit_display || booking.unit_number || 'N/A'} · Booked {fmtD(booking.booking_date)}</p>
          </div>
        </div>
        <div className="bkd-header-actions">
          <button className="bkd-btn bkd-btn-ghost" onClick={() => window.print()}><PrinterIcon style={{width:14,height:14}}/> Print</button>
          <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('status')}><PencilSquareIcon style={{width:14,height:14}}/> Update Status</button>
          <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('payStatus')}><CreditCardIcon style={{width:14,height:14}}/> Update Payment Status</button>
          <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('devCost')}><BanknotesIcon style={{width:14,height:14}}/> Development Cost</button>
          <button className="bkd-btn bkd-btn-primary" onClick={() => openActionModal('pay')}><PlusIcon style={{width:14,height:14}}/> Add Payment</button>
          <button className="bkd-btn bkd-btn-ghost" onClick={loadBooking} title="Refresh"><ArrowPathIcon style={{width:14,height:14}}/></button>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {isOverdue && balanceDue > 0 && (
        <div className="bkd-alert-banner">
          <ExclamationTriangleIcon style={{width:18,height:18,flexShrink:0}}/>
          <div>
            <span className="bkd-alert-title">Payment Overdue</span>
            <span className="bkd-alert-text">Balance of {formatCurrency(balanceDue)} — {overdueDays} days overdue (due {fmtD(booking.next_follow_up_at)})</span>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div style={{marginBottom:16}}>
        <span className="bkd-status-badge" style={{background:`${booking.status_color}18`,color:booking.status_color,border:`1px solid ${booking.status_color}40`}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:booking.status_color,display:'inline-block'}}/> {booking.status_label}
        </span>
      </div>

      {/* Customer Info + Payment Summary — 2 col */}
      <div className="bkd-two-col">
        {/* Customer Information Card */}
        <div className="bkd-card">
          <div className="bkd-card-header">
            <div className="bkd-card-title"><UserIcon style={{width:15,height:15}}/> Customer Information</div>
          </div>
          <div className="bkd-card-body">
            <div className="bkd-info-grid">
              <InfoRow label="Customer Name" value={`${customer.first_name||''} ${customer.last_name||''}`.trim() || booking.customer_name}/>
              <InfoRow label="Phone" value={customer.phone} mono/>
              <InfoRow label="PAN" value={customer.pan_number} mono/>
              <InfoRow label="Aadhaar" value={customer.aadhar_number} mono/>
              <InfoRow label="Email" value={customer.email} mono/>
              <InfoRow label="Booking Date" value={fmtD(booking.booking_date)}/>
            </div>
            <hr className="bkd-divider"/>
            <div className="bkd-info-grid">
              <InfoRow label="Project" value={booking.project_name}/>
              <InfoRow label="Unit" value={booking.unit_display || booking.unit_number}/>
              <InfoRow label="Area" value={booking.carpet_area ? `${booking.carpet_area} sq.ft` : '—'}/>
              <InfoRow label="Config" value={booking.configuration}/>
              <InfoRow label="Sales Person" value={booking.sales_person_name || booking.buyer_name}/>
              <InfoRow label="Payment Plan" value={booking.paymentPlan?.plan_name}/>
            </div>
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="bkd-card">
          <div className="bkd-card-header">
            <div className="bkd-card-title"><BanknotesIcon style={{width:15,height:15}}/> Payment Summary</div>
          </div>
          <div className="bkd-card-body">
            <div className="bkd-amount-grid">
              <div className="bkd-amount-box"><div className="bkd-amount-label">Total Value</div><div className="bkd-amount-val">{formatCurrency(totalValue)}</div></div>
              <div className="bkd-amount-box bkd-amount-success"><div className="bkd-amount-label">Total Collected</div><div className="bkd-amount-val">{formatCurrency(totalPaid)}</div></div>
              <div className="bkd-amount-box bkd-amount-danger"><div className="bkd-amount-label">Balance Due</div><div className="bkd-amount-val">{formatCurrency(balanceDue)}</div></div>
              <div className="bkd-amount-box bkd-amount-warning"><div className="bkd-amount-label">Unverified</div><div className="bkd-amount-val">{formatCurrency(unverifiedAmt)}</div></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              Plot {formatCurrency(plotValue)} + Stamp {formatCurrency(stampValue)} + Registration {formatCurrency(registrationValue)} + Development {formatCurrency(developmentValue)}
            </div>
            {/* Progress bar */}
            <div className="bkd-progress-section">
              <div className="bkd-progress-label">Collection Progress</div>
              <div className="bkd-progress-row"><span>{formatCurrency(totalPaid)} of {formatCurrency(totalValue)}</span><span className="bkd-progress-pct">{pctCollected}%</span></div>
              <div className="bkd-progress-bar"><div className="bkd-progress-fill" style={{width:`${pctCollected}%`,background:pctCollected>=75?'#10b981':pctCollected>=40?'#f59e0b':'#ef4444'}}/></div>
            </div>
            <hr className="bkd-divider"/>
            <div className="bkd-stats-row">
              <div className="bkd-mini-stat"><div className="bkd-mini-label">Payments</div><div className="bkd-mini-val">{payments.length} entries</div></div>
              <div className="bkd-mini-stat"><div className="bkd-mini-label">Verified</div><div className="bkd-mini-val" style={{color:'#10b981'}}>{verifiedCount} payment{verifiedCount!==1?'s':''}</div></div>
              <div className="bkd-mini-stat"><div className="bkd-mini-label">Pending</div><div className="bkd-mini-val" style={{color:'#f59e0b'}}>{pendingCount} payment{pendingCount!==1?'s':''}</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="bkd-card">
        <div className="bkd-card-header">
          <div><div className="bkd-card-title"><CreditCardIcon style={{width:15,height:15}}/> Payment History</div>
            <div className="bkd-card-subtitle">All payments recorded for this booking</div></div>
          <button className="bkd-btn bkd-btn-primary bkd-btn-sm" onClick={() => openActionModal('pay')}><PlusIcon style={{width:13,height:13}}/> Add Payment</button>
        </div>
        <div>{payments.length === 0 ? (
          <div style={{padding:30,textAlign:'center',color:'var(--text-muted,#9ca3af)',fontSize:13}}>No payments recorded yet</div>
        ) : (
          <table className="bkd-table"><thead><tr>
            <th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Bank</th><th>Type</th><th>Status</th><th>Actions</th>
          </tr></thead><tbody>
            {payments.map(p => (
              <tr key={p.id} className={p.is_bounced?'bkd-row-bounced':p.is_verified?'bkd-row-verified':''}>
                <td>{fmtD(p.payment_date)}</td>
                <td style={{fontWeight:700}}>{formatCurrency(p.amount)}</td>
                <td>{p.payment_mode}</td>
                <td className="bkd-mono">{p.transaction_ref || p.utr_number || p.cheque_dd_number || '—'}</td>
                <td style={{fontSize:12}}>{p.bank_name || '—'}</td>
                <td style={{fontSize:12}}>{p.payment_type}</td>
                <td>{p.is_bounced ? <span className="bkd-badge bkd-badge-danger">Rejected</span>
                  : p.is_verified ? <span className="bkd-badge bkd-badge-success">Verified</span>
                  : <span className="bkd-badge bkd-badge-warning">Unverified</span>}</td>
                <td>—</td>
              </tr>
            ))}
          </tbody></table>
        )}</div>
      </div>

      {/* Activity Log */}
      <div className="bkd-card">
        <div className="bkd-card-header">
          <div className="bkd-card-title"><ClockIcon style={{width:15,height:15}}/> Activity Log</div>
          <button className="bkd-btn bkd-btn-ghost bkd-btn-sm" onClick={() => {
            setActivitiesLoading(true);
            bookingApi.getActivities(bookingId).then(r=>setActivities(r.data?.data||r.data||[])).catch(()=>{}).finally(()=>setActivitiesLoading(false));
          }}><ArrowPathIcon style={{width:14,height:14}}/></button>
        </div>
        <div className="bkd-card-body">
          {activitiesLoading ? <div style={{textAlign:'center',padding:20,color:'var(--text-muted,#9ca3af)'}}>Loading...</div>
          : activities.length === 0 ? <div style={{textAlign:'center',padding:20,color:'var(--text-muted,#9ca3af)',fontSize:13}}>No activity recorded yet</div>
          : (
            <div className="bkd-timeline">
              {activities.map((act,i) => {
                const color = act.activity_type==='PAYMENT_RECORDED'?'#10b981':act.activity_type==='STATUS_CHANGE'?'#3b82f6':act.activity_type==='CANCELLED'?'#ef4444':'#6b7280';
                return (
                  <div className="bkd-timeline-item" key={act.id||i}>
                    <div className="bkd-timeline-dot" style={{borderColor:color}}/>
                    <div className="bkd-timeline-time">{new Date(act.performed_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                    <div className="bkd-timeline-text">{act.title}</div>
                    {act.description && <div className="bkd-timeline-sub">{act.description}</div>}
                    <div className="bkd-timeline-sub">By {act.performedBy ? `${act.performedBy.first_name} ${act.performedBy.last_name}` : 'System'}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── QUICK ACTION MODAL (same as bookings list style) ── */}
      {actionMode && (
        <div className="col-modal-overlay" onClick={closeActionModal}>
          <div className="qa-modal-panel" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="qa-drawer-handle" />
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{ background: `${booking.status_color}22`, color: booking.status_color, border: `2px solid ${booking.status_color}` }}>
                  {(booking.customer_name || 'B')[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="qa-drawer-name">{booking.customer_name || booking.buyer_name || 'Customer'}</div>
                  <div className="qa-drawer-meta">{booking.booking_number} · {booking.project_name}</div>
                  <div className="qa-drawer-budget" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalValue)}</strong> · Paid: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(totalPaid)}</span> · Balance: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{formatCurrency(totalValue - totalPaid)}</span>
                  </div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={closeActionModal}>×</button>
            </div>

            <div className="qa-drawer-divider" />

            {actionMode === 'pay' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {/* Inline budget summary for Record Payment */}
                  <div style={{
                    display: 'flex', gap: 16, background: 'var(--bg-secondary)', 
                    padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: 12
                  }}>
                    <div>Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalValue)}</strong></div>
                    <div>Paid: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaid)}</strong></div>
                    <div>Balance: <strong style={{ color: 'var(--accent-red)' }}>{formatCurrency(totalValue - totalPaid)}</strong></div>
                  </div>

                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Record New Payment</div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Payment Date *</label><input type="date" className="bkd-form-control" value={payForm.payment_date} onChange={e => setPayForm(p => ({...p, payment_date:e.target.value}))}/></div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Amount (₹) *</label><input type="number" className="bkd-form-control" placeholder="e.g. 500000" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount:e.target.value}))}/></div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Payment Mode *</label>
                      <select className="bkd-form-control" value={payForm.payment_mode} onChange={e => setPayForm(p => ({...p, payment_mode:e.target.value}))}>
                        {['Online','NEFT/RTGS','Cheque','Demand Draft','Cash','UPI'].map(m => <option key={m}>{m}</option>)}
                      </select></div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Reference / UTR / Cheque No. *</label><input type="text" className="bkd-form-control" placeholder="e.g. UTR123456" value={payForm.transaction_ref} onChange={e => setPayForm(p => ({...p, transaction_ref:e.target.value}))}/></div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Bank / Drawn On</label><input type="text" className="bkd-form-control" placeholder="e.g. HDFC Bank" value={payForm.bank_name} onChange={e => setPayForm(p => ({...p, bank_name:e.target.value}))}/></div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Payment Type</label>
                      <select className="bkd-form-control" value={payForm.payment_type} onChange={e => setPayForm(p => ({...p, payment_type:e.target.value}))}>
                        {['Token','Down Payment','Installment','EMI','Final Payment','Other'].map(t => <option key={t}>{t}</option>)}
                      </select></div>
                  </div>
                  <div className="bkd-form-group"><label className="bkd-form-label">Remarks</label><textarea className="bkd-form-control" rows={2} placeholder="Notes for accounts team..." value={payForm.remarks} onChange={e => setPayForm(p => ({...p, remarks:e.target.value}))}/></div>
                  <div className="bkd-info-banner">This payment will be sent to <strong>Accounts Executive</strong> for verification. Status will show as <em>Unverified</em> until approved.</div>
                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" disabled={paySaving || !payForm.amount} onClick={handleAddPayment}>
                    {paySaving ? 'Saving...' : 'Submit Payment'}
                  </button>
                </div>
              </div>
            )}

            {actionMode === 'status' && (
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

            {actionMode === 'payStatus' && (
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
                  <button className="qa-drawer-save-btn" style={{ background: '#6366F1' }} onClick={handlePaymentStatusUpdate} disabled={!paymentStatus || payStatusSaving}>
                    {payStatusSaving ? 'Updating...' : <><CreditCardIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Payment Status</>}
                  </button>
                </div>
              </div>
            )}

            {actionMode === 'devCost' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '520px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Update Development Cost</div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Guideline Value *</label>
                      <input type="number" className="bkd-form-control" value={devCostForm.guideline_value} onChange={e => setDevCostForm(p => ({ ...p, guideline_value: e.target.value }))} />
                    </div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Plot Area *</label>
                      <input type="number" className="bkd-form-control" value={devCostForm.plot_area} onChange={e => setDevCostForm(p => ({ ...p, plot_area: e.target.value }))} />
                    </div>
                  </div>
                  <div className="bkd-form-group"><label className="bkd-form-label">Development Cost / Sqft *</label>
                    <input type="number" className="bkd-form-control" value={devCostForm.development_cost_per_sqft} onChange={e => setDevCostForm(p => ({ ...p, development_cost_per_sqft: e.target.value }))} />
                  </div>
                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" onClick={handleDevelopmentCostUpdate} disabled={devCostSaving}>
                    {devCostSaving ? 'Updating...' : 'Update Development Cost'}
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

export default CollectionBookingDetail;
