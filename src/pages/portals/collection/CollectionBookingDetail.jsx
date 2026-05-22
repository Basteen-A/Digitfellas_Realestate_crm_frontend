import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentPlanApi from '../../../api/paymentPlanApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, CreditCardIcon,
  BanknotesIcon, UserIcon, ClockIcon,
  ExclamationTriangleIcon, PlusIcon,
  CheckCircleIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ShieldCheckIcon,
  DocumentTextIcon, CloudArrowUpIcon, ArrowDownTrayIcon, FolderOpenIcon
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
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [actionMode, setActionMode] = useState(null); // 'pay' | 'status' | 'payStatus' | 'devCost'
  const [activeTab, setActiveTab] = useState('payment-history');
  const [payForm, setPayForm] = useState({ payment_type:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
  const [paySaving, setPaySaving] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [paymentModeOptions, setPaymentModeOptions] = useState([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [payStatusSaving, setPayStatusSaving] = useState(false);
  const [devCostForm, setDevCostForm] = useState({ guideline_value: '', plot_area: '', development_cost_per_sqft: '' });
  const [devCostSaving, setDevCostSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsSaving, setDocumentsSaving] = useState(false);
  const [documentForm, setDocumentForm] = useState({ document_name: '', document_type: '', description: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);

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

  const loadPaymentPlans = useCallback(async () => {
    try {
      const resp = await paymentPlanApi.getDropdown();
      setPaymentPlans(resp.data?.data || resp.data || []);
    } catch (err) {
      setPaymentPlans([]);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!bookingId) return;
    setDocumentsLoading(true);
    try {
      const resp = await bookingApi.getDocuments(bookingId);
      setDocuments(resp.data?.data || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load documents'));
    } finally {
      setDocumentsLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { loadBooking(); }, [loadBooking]);
  useEffect(() => {
    bookingStatusApi.getDropdown().then(r => setStatusOptions(r.data?.data || r.data || [])).catch(()=>{});
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
    loadPaymentPlans();
  }, [loadPaymentPlans]);
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const getUserLabel = (person) => {
    if (!person) return '';
    const name = `${person.first_name || ''} ${person.last_name || ''}`.trim();
    const roleCode = person.userType?.short_code || person.user_type?.short_code;
    return roleCode ? `${name} (${roleCode})` : name;
  };

  const leadAssignee = booking?.lead?.assignedTo || null;
  const previousLeadAssignee = booking?.lead?.previousAssignedToUser || null;
  const paymentPlanLabel = booking?.paymentPlan?.plan_name || paymentPlans.find((plan) => String(plan.id) === String(booking?.payment_plan_id))?.plan_name || '—';
  const paymentPlanType = booking?.paymentPlan?.plan_type || paymentPlans.find((plan) => String(plan.id) === String(booking?.payment_plan_id))?.plan_type || '';

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
      setPayForm({ payment_type:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
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
      await bookingApi.addPayment(bookingId, {
        ...payForm,
        payment_mode: selectedModeName,
        amount: parseFloat(payForm.amount),
      });
      toast.success('Payment recorded');
      closeActionModal();
      setPayForm({ payment_type:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
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

  const handleUploadDocuments = async () => {
    if (!selectedFiles.length) {
      toast.error('Select at least one file to upload');
      return;
    }
    setDocumentsSaving(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append('documents', file));
      formData.append('document_name', documentForm.document_name || 'Booking Document');
      formData.append('document_type', documentForm.document_type || 'General');
      formData.append('description', documentForm.description || '');
      await bookingApi.uploadDocuments(bookingId, formData);
      toast.success('Documents uploaded');
      setSelectedFiles([]);
      setDocumentForm({ document_name: '', document_type: '', description: '' });
      loadDocuments();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to upload documents'));
    } finally {
      setDocumentsSaving(false);
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
  const buyerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || booking.customer_name || booking.buyer_name || '—';
  const customerPhoneRaw = customer.phone || customer.phone_number || customer.mobile || booking.customer_phone || '';
  const customerPhone = /^\s*LD[-_ ]?\d+\s*$/i.test(String(customerPhoneRaw || '')) ? '—' : (customerPhoneRaw || '—');
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

  const devCostGuidelineValue = toAmount(devCostForm.guideline_value || booking.guideline_value);
  const devCostPlotAreaValue = toAmount(devCostForm.plot_area || booking.plot_area);
  const devCostPerSqftValue = toAmount(devCostForm.development_cost_per_sqft || booking.development_cost_per_sqft);
  const previewPlotValue = devCostGuidelineValue * devCostPlotAreaValue;
  const previewStampValue = Math.ceil((previewPlotValue * 0.07) / 100) * 100;
  const previewRegistrationValue = Math.ceil((previewPlotValue * 0.02) / 100) * 100;
  const previewDevelopmentValue = Math.round((devCostPlotAreaValue * devCostPerSqftValue) * 1.18 * 100) / 100;
  const previewGrandTotal = previewPlotValue + previewStampValue + previewRegistrationValue + previewDevelopmentValue;
  const liveTotalValue = actionMode === 'devCost' ? previewGrandTotal : totalValue;

  const unverifiedAmt = payments.filter(p => !p.is_verified && !p.is_bounced).reduce((s,p) => s + parseFloat(p.amount||0), 0);
  const verifiedCount = payments.filter(p => p.is_verified).length;
  const pendingCount = payments.filter(p => !p.is_verified && !p.is_bounced).length;
  const tabs = [
    { key: 'payment-history', label: 'Payment History', icon: CreditCardIcon },
    { key: 'activity-log', label: 'Activity Log', icon: ClockIcon },
    { key: 'uploads', label: 'Uploads', icon: CloudArrowUpIcon },
  ];

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
            <h1 className="bkd-title">
              Booking Details — {booking.booking_number}{' '}
                
        <span className="bkd-status-badge" style={{background:`${booking.status_color}18`,color:booking.status_color,border:`1px solid ${booking.status_color}40`}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:booking.status_color,display:'inline-block'}}/> {booking.status_label}
        </span>
     
            </h1>
            <p className="bkd-subtitle">{booking.project_name} · {booking.unit_display || booking.unit_number || 'N/A'} · {fmtD(booking.booking_date)}</p>
          </div>
        </div>
        <div className="bkd-header-actions">
          <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('status')}><PencilSquareIcon style={{width:14,height:14}}/> Boooking Status</button>
          <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('payStatus')}><CreditCardIcon style={{width:14,height:14}}/> Payment Status</button>
          {/* <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('devCost')}><BanknotesIcon style={{width:14,height:14}}/> Development Cost</button> */}
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

      <div className="bkd-two-col">
            <div className="bkd-card">
              <div className="bkd-card-header">
                <div className="bkd-card-title"><UserIcon style={{width:15,height:15}}/> Customer Information</div>
              </div>
              <div className="bkd-card-body">
                <div className="bkd-info-grid">
                  <InfoRow label="Buyer Name" value={buyerName}/>
                  <InfoRow label="Customer Phone" value={customerPhone} mono/>
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
                  
                  <InfoRow label="Current Handler" value={leadAssignee ? getUserLabel(leadAssignee) : '—'} />
                  <InfoRow label="Previous Handler" value={previousLeadAssignee ? getUserLabel(previousLeadAssignee) : '—'} />
                  <InfoRow label="Payment Plan" value={paymentPlanLabel} />
                  <InfoRow label="Plan Type" value={paymentPlanType || '—'} />
                  <InfoRow label="Sales Head / Manager" value={previousLeadAssignee ? getUserLabel(previousLeadAssignee) : '—'} />
                  <InfoRow label="Collection Owner" value={leadAssignee ? getUserLabel(leadAssignee) : '—'} />
                  <InfoRow label="Booking Status" value={booking.status_label} />
                  <InfoRow label="Payment Status" value={booking.payment_status || '—'} />
                </div>
              </div>
            </div>

            <div className="bkd-card bkd-payment-preview-card">
              <div className="bkd-payment-preview-header">
                <div className="bkd-payment-preview-header-left">
                  <div className="bkd-payment-preview-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" className="bkd-payment-preview-icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l1 11H4L5 9z" />
                    </svg>
                  </div>

                  <div>
                    <h3 className="bkd-payment-preview-title">Payment Summary</h3>
                    <p className="bkd-payment-preview-subtitle">Financial overview & collection progress</p>
                  </div>
                </div>
              </div>

              <div className="bkd-payment-preview-body">
                <div className="bkd-payment-preview-top-grid">
                  <div className="bkd-payment-preview-card bkd-payment-preview-card-total">
                    <p className="bkd-payment-preview-card-label">Total Value</p>
                    <h2 className="bkd-payment-preview-card-value">{formatCurrency(liveTotalValue)}</h2>
                  </div>

                  <div className="bkd-payment-preview-card bkd-payment-preview-card-collected">
                    <p className="bkd-payment-preview-card-label bkd-payment-preview-card-label-collected">Total Collected</p>
                    <h2 className="bkd-payment-preview-card-value bkd-payment-preview-card-value-collected">{formatCurrency(totalPaid)}</h2>
                  </div>

                  <div className="bkd-payment-preview-card bkd-payment-preview-card-balance">
                    <p className="bkd-payment-preview-card-label bkd-payment-preview-card-label-balance">Balance Due</p>
                    <h2 className="bkd-payment-preview-card-value bkd-payment-preview-card-value-balance">{formatCurrency(balanceDue)}</h2>
                  </div>

                  <div className="bkd-payment-preview-card bkd-payment-preview-card-unverified">
                    <p className="bkd-payment-preview-card-label bkd-payment-preview-card-label-unverified">Unverified</p>
                    <h2 className="bkd-payment-preview-card-value bkd-payment-preview-card-value-unverified">{formatCurrency(unverifiedAmt)}</h2>
                  </div>
                </div>

                <div className="bkd-payment-preview-breakdown-shell">
                  <div className="bkd-payment-preview-breakdown-head">
                    <div>
                      <h4 className="bkd-payment-preview-breakdown-title">Cost Breakdown</h4>
                      <p className="bkd-payment-preview-breakdown-subtitle">Detailed property pricing structure</p>
                    </div>

                    <div className="bkd-payment-preview-grand-total">
                      <button type="button" className="bkd-payment-preview-edit-btn" onClick={() => openActionModal('devCost')}>
                        Edit
                      </button>
                      <p className="bkd-payment-preview-grand-label">Grand Total</p>
                      <p className="bkd-payment-preview-grand-value">{formatCurrency(totalValue)}</p>
                    </div>
                  </div>

                  <div className="bkd-payment-preview-breakdown-grid">
                    <div className="bkd-payment-preview-breakdown-card bkd-payment-preview-breakdown-card-total">
                      <div className="bkd-payment-preview-breakdown-item-head">
                        <div className="bkd-payment-preview-breakdown-icon-shell">
                          <svg xmlns="http://www.w3.org/2000/svg" className="bkd-payment-preview-breakdown-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7" />
                          </svg>
                        </div>

                        <div>
                          <p className="bkd-payment-preview-breakdown-item-label">Plot Value</p>
                          <p className="bkd-payment-preview-breakdown-item-sub">90% of total</p>
                        </div>
                      </div>

                      <h3 className="bkd-payment-preview-breakdown-item-value">{formatCurrency(plotValue)}</h3>
                    </div>

                    <div className="bkd-payment-preview-breakdown-card bkd-payment-preview-breakdown-card-stamp">
                      <div className="bkd-payment-preview-breakdown-item-head">
                        <div className="bkd-payment-preview-breakdown-icon-shell bkd-payment-preview-breakdown-icon-shell-stamp">
                          <svg xmlns="http://www.w3.org/2000/svg" className="bkd-payment-preview-breakdown-icon bkd-payment-preview-breakdown-icon-stamp" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6M7 4h10l2 2v14H5V4h2z" />
                          </svg>
                        </div>

                        <div>
                          <p className="bkd-payment-preview-breakdown-item-label bkd-payment-preview-breakdown-item-label-stamp">Stamp Duty</p>
                          <p className="bkd-payment-preview-breakdown-item-sub bkd-payment-preview-breakdown-item-sub-stamp">Govt Charge</p>
                        </div>
                      </div>

                      <h3 className="bkd-payment-preview-breakdown-item-value bkd-payment-preview-breakdown-item-value-stamp">{formatCurrency(stampValue)}</h3>
                    </div>

                    <div className="bkd-payment-preview-breakdown-card bkd-payment-preview-breakdown-card-registration">
                      <div className="bkd-payment-preview-breakdown-item-head">
                        <div className="bkd-payment-preview-breakdown-icon-shell bkd-payment-preview-breakdown-icon-shell-registration">
                          <svg xmlns="http://www.w3.org/2000/svg" className="bkd-payment-preview-breakdown-icon bkd-payment-preview-breakdown-icon-registration" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10m-11 9h12a1 1 0 001-1V7H5v12a1 1 0 001 1z" />
                          </svg>
                        </div>

                        <div>
                          <p className="bkd-payment-preview-breakdown-item-label bkd-payment-preview-breakdown-item-label-registration">Registration</p>
                          <p className="bkd-payment-preview-breakdown-item-sub bkd-payment-preview-breakdown-item-sub-registration">Legal Charge</p>
                        </div>
                      </div>

                      <h3 className="bkd-payment-preview-breakdown-item-value bkd-payment-preview-breakdown-item-value-registration">{formatCurrency(registrationValue)}</h3>
                    </div>

                    <div className="bkd-payment-preview-breakdown-card bkd-payment-preview-breakdown-card-development">
                      <div className="bkd-payment-preview-breakdown-item-head">
                        <div className="bkd-payment-preview-breakdown-icon-shell bkd-payment-preview-breakdown-icon-shell-development">
                          <svg xmlns="http://www.w3.org/2000/svg" className="bkd-payment-preview-breakdown-icon bkd-payment-preview-breakdown-icon-development" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14.7 6.3l3 3m-9.4 9.4H5v-3.3l9.4-9.4a1 1 0 011.4 0l1.9 1.9a1 1 0 010 1.4l-9.4 9.4z" />
                          </svg>
                        </div>

                        <div>
                          <p className="bkd-payment-preview-breakdown-item-label bkd-payment-preview-breakdown-item-label-development">Development</p>
                          <p className="bkd-payment-preview-breakdown-item-sub bkd-payment-preview-breakdown-item-sub-development">Infrastructure</p>
                        </div>
                      </div>

                      <h3 className="bkd-payment-preview-breakdown-item-value bkd-payment-preview-breakdown-item-value-development">{formatCurrency(developmentValue)}</h3>
                    </div>
                  </div>
                </div>

                <div className="bkd-payment-preview-progress">
                  <div className="bkd-payment-preview-progress-head">
                    <h4 className="bkd-payment-preview-progress-title">Collection Progress</h4>
                    <span className="bkd-payment-preview-progress-percent">{pctCollected}%</span>
                  </div>

                  <div className="bkd-payment-preview-progress-bar">
                    <div className="bkd-payment-preview-progress-fill" style={{ width: `${pctCollected}%` }} />
                  </div>

                  <div className="bkd-payment-preview-progress-foot">
                    <p className="bkd-payment-preview-progress-foot-text">{formatCurrency(totalPaid)} collected out of {formatCurrency(liveTotalValue)}</p>
                    <p className="bkd-payment-preview-progress-foot-pending">{formatCurrency(liveTotalValue - totalPaid)} pending</p>
                  </div>
                </div>

                <div className="bkd-payment-preview-stats-grid">
                  <div className="bkd-payment-preview-stat-card bkd-payment-preview-stat-card-neutral">
                    <p className="bkd-payment-preview-stat-label">Payments</p>
                    <h4 className="bkd-payment-preview-stat-value">{payments.length}</h4>
                  </div>

                  <div className="bkd-payment-preview-stat-card bkd-payment-preview-stat-card-success">
                    <p className="bkd-payment-preview-stat-label bkd-payment-preview-stat-label-success">Verified</p>
                    <h4 className="bkd-payment-preview-stat-value bkd-payment-preview-stat-value-success">{verifiedCount}</h4>
                  </div>

                  <div className="bkd-payment-preview-stat-card bkd-payment-preview-stat-card-warning">
                    <p className="bkd-payment-preview-stat-label bkd-payment-preview-stat-label-warning">Pending</p>
                    <h4 className="bkd-payment-preview-stat-value bkd-payment-preview-stat-value-warning">{pendingCount}</h4>
                  </div>
                </div>
              </div>
            </div>

      </div>

      <div className="bkd-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              className={`bkd-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon style={{ width: 14, height: 14 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'payment-history' && (
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
      )}

      {activeTab === 'activity-log' && (
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
      )}

      {activeTab === 'uploads' && (
        <div className="bkd-card">
          <div className="bkd-card-header">
            <div><div className="bkd-card-title"><FolderOpenIcon style={{width:15,height:15}}/> Uploads</div>
              <div className="bkd-card-subtitle">Store documents against the lead linked to this booking</div></div>
          </div>
          <div className="bkd-card-body">
            <div className="bkd-upload-grid">
              <div className="bkd-upload-panel">
                <div className="bkd-upload-dropzone">
                  <CloudArrowUpIcon style={{ width: 22, height: 22, color: 'var(--col-primary, #4f46e5)' }} />
                  <div style={{ fontWeight: 700, color: 'var(--col-text, #111827)' }}>Upload booking documents</div>
                  <div style={{ fontSize: 12, color: 'var(--col-text-secondary, #6b7280)' }}>PDF, images, docs, spreadsheets. Up to 5 files.</div>
                </div>
                <div className="bkd-form-group" style={{ marginTop: 14 }}>
                  <label className="bkd-form-label">Document Title</label>
                  <input className="bkd-form-control" value={documentForm.document_name} onChange={(e) => setDocumentForm((p) => ({ ...p, document_name: e.target.value }))} placeholder="e.g. Sale Agreement" />
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Document Type</label>
                  <input className="bkd-form-control" value={documentForm.document_type} onChange={(e) => setDocumentForm((p) => ({ ...p, document_type: e.target.value }))} placeholder="e.g. Agreement / ID Proof / Receipt" />
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Description</label>
                  <textarea className="bkd-form-control" rows={3} value={documentForm.description} onChange={(e) => setDocumentForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional notes for this upload" />
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Files</label>
                  <input className="bkd-form-control" type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} />
                </div>
                <button className="bkd-btn bkd-btn-primary" onClick={handleUploadDocuments} disabled={documentsSaving || selectedFiles.length === 0} style={{ marginTop: 10 }}>
                  {documentsSaving ? 'Uploading...' : <><CloudArrowUpIcon style={{ width: 14, height: 14 }} /> Upload Documents</>}
                </button>
              </div>
              <div className="bkd-upload-panel">
                <div className="bkd-card-title" style={{ marginBottom: 12 }}><DocumentTextIcon style={{ width: 15, height: 15 }} /> Uploaded Documents</div>
                {documentsLoading ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</div>
                ) : documents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No documents uploaded yet.</div>
                ) : (
                  <div className="bkd-document-list">
                    {documents.map((doc) => (
                      <div className="bkd-document-item" key={doc.id}>
                        <div className="bkd-document-main">
                          <div className="bkd-document-title">{doc.document_name}</div>
                          <div className="bkd-document-meta">{doc.document_type || 'Document'} · {doc.mime_type || 'Unknown type'} · {doc.file_size ? `${Math.round(Number(doc.file_size) / 1024)} KB` : '—'}</div>
                          <div className="bkd-document-meta">Uploaded by {doc.uploader ? `${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`.trim() : 'System'} · {fmtD(doc.created_at)}</div>
                        </div>
                        <div className="bkd-document-actions">
                          <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={doc.download_url || doc.file_url} target="_blank" rel="noreferrer">
                            <ArrowDownTrayIcon style={{ width: 13, height: 13 }} /> Open
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                    <div>Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(liveTotalValue)}</strong></div>
                    <div>Paid: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaid)}</strong></div>
                    <div>Balance: <strong style={{ color: 'var(--accent-red)' }}>{formatCurrency(liveTotalValue - totalPaid)}</strong></div>
                  </div>

                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Record New Payment</div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Payment Date *</label><input type="date" className="bkd-form-control" value={payForm.payment_date} onChange={e => setPayForm(p => ({...p, payment_date:e.target.value}))}/></div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Amount (₹) *</label><input type="number" className="bkd-form-control" placeholder="e.g. 500000" value={payForm.amount} onChange={e => setPayForm(p => ({...p, amount:e.target.value}))}/></div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Payment Mode *</label>
                      <select className="bkd-form-control" value={payForm.payment_mode_id} onChange={e => {
                        const selectedId = e.target.value;
                        const selectedMode = paymentModeOptions.find((mode) => String(mode.id) === String(selectedId));
                        setPayForm(p => ({ ...p, payment_mode_id: selectedId, payment_mode: selectedMode?.mode_name || '' }));
                      }}>
                        <option value="">Select payment mode</option>
                        {paymentModeOptions.map((mode) => <option key={mode.id} value={mode.id}>{mode.mode_name}</option>)}
                      </select></div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Reference / UTR / Cheque No. {payForm.payment_mode !== 'Cash' ? '*' : ''}</label><input type="text" className="bkd-form-control" placeholder="e.g. UTR123456" value={payForm.transaction_ref} onChange={e => setPayForm(p => ({...p, transaction_ref:e.target.value}))}/></div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Company Bank</label>
                      <select className="bkd-form-control" value={payForm.bank_id || ''} onChange={e => setPayForm(p => ({ ...p, bank_id: e.target.value }))}>
                        <option value="">Select bank</option>
                        {bankOptions.map((bank) => (
                          <option key={bank.id} value={bank.id}>{bank.bank_name} - {bank.account_number}</option>
                        ))}
                      </select>
                    </div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Payment Type</label>
                      <select className="bkd-form-control" value={payForm.payment_type} onChange={e => setPayForm(p => ({...p, payment_type:e.target.value}))}>
                        <option value="">Select payment type</option>
                        {paymentTypeOptions.map((type) => <option key={type.id} value={type.type_name}>{type.type_name}</option>)}
                      </select></div>
                  </div>
                  <div className="bkd-form-group"><label className="bkd-form-label">Remarks</label><textarea className="bkd-form-control" rows={2} placeholder="Notes for accounts team..." value={payForm.remarks} onChange={e => setPayForm(p => ({...p, remarks:e.target.value}))}/></div>
                  <div className="bkd-info-banner">This payment will be sent to <strong>Accounts Executive</strong> for verification. Status will show as <em>Unverified</em> until approved.</div>
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" disabled={paySaving || !payForm.amount || !payForm.payment_type || !payForm.payment_mode_id || (payForm.payment_mode !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim()))} onClick={handleAddPayment}>
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
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Update Cost Breakdown</div>
                  <div className="bkd-dev-summary-grid">
                    <div className="bkd-dev-summary-item">
                      <div className="bkd-dev-summary-label">Plot Value</div>
                      <div className="bkd-dev-summary-value">{formatCurrency(previewPlotValue || plotValue)}</div>
                    </div>
                    <div className="bkd-dev-summary-item">
                      <div className="bkd-dev-summary-label">Stamp Duty</div>
                      <div className="bkd-dev-summary-value">{formatCurrency(previewStampValue || stampValue)}</div>
                    </div>
                    <div className="bkd-dev-summary-item">
                      <div className="bkd-dev-summary-label">Registration</div>
                      <div className="bkd-dev-summary-value">{formatCurrency(previewRegistrationValue || registrationValue)}</div>
                    </div>
                    <div className="bkd-dev-summary-item bkd-dev-summary-item-editable">
                      <div className="bkd-dev-summary-label">Development</div>
                      <div className="bkd-dev-summary-value">{formatCurrency(previewDevelopmentValue || developmentValue)}</div>
                    </div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group"><label className="bkd-form-label">Guideline Value *</label>
                      <input type="number" className="bkd-form-control" value={devCostForm.guideline_value} readOnly />
                    </div>
                    <div className="bkd-form-group"><label className="bkd-form-label">Plot Area *</label>
                      <input type="number" className="bkd-form-control" value={devCostForm.plot_area} readOnly />
                    </div>
                  </div>
                  <div className="bkd-form-group"><label className="bkd-form-label">Development Cost / Sqft *</label>
                    <input type="number" className="bkd-form-control" value={devCostForm.development_cost_per_sqft} onChange={e => setDevCostForm(p => ({ ...p, development_cost_per_sqft: e.target.value }))} />
                  </div>
                  <div className="bkd-dev-hint">Only development cost is editable here. Plot, stamp, and registration values are derived from the booking and kept read-only.</div>
                  <div className="bkd-dev-summary-grid" style={{ marginTop: 14 }}>
                    <div className="bkd-dev-summary-item bkd-dev-summary-item-editable" style={{ gridColumn: '1 / -1' }}>
                      <div className="bkd-dev-summary-label">Live Grand Total</div>
                      <div className="bkd-dev-summary-value" style={{ fontSize: 22, fontWeight: 800 }}>{formatCurrency(previewGrandTotal || totalValue)}</div>
                    </div>
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
