import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';
import paymentPlanApi from '../../../api/paymentPlanApi';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import VoiceNoteField from '../../../components/common/VoiceNoteField';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { getRoleCode } from '../../../utils/permissions';
import { ROLE_CODES } from '../../../utils/constants';
import {
  ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, CreditCardIcon,
  BanknotesIcon, UserIcon, ClockIcon,
  ExclamationTriangleIcon, PlusIcon,
  CheckCircleIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ShieldCheckIcon,
  DocumentTextIcon, CloudArrowUpIcon, ArrowDownTrayIcon, FolderOpenIcon, XCircleIcon, EyeIcon
} from '@heroicons/react/24/outline';
import '../common/LeadWorkspacePage.css';
import './CollectionWorkspace.css';

/* ── tiny helpers ── */
const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
// Full rupee value (no Lakh/Crore shortening) — used inside the edit popup where
// the actual figures must be visible.
const fmtFull = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};
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
  const [payForm, setPayForm] = useState({ payment_type:'', payment_category:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
  const [paySaving, setPaySaving] = useState(false);
  const [newStatusId, setNewStatusId] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusVoice, setStatusVoice] = useState(null); // EMI remarks voice note { blob, url, duration }
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelVoice, setCancelVoice] = useState(null); // cancel remarks voice note
  const [paymentModeOptions, setPaymentModeOptions] = useState([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentStatusId, setPaymentStatusId] = useState('');
  const [paymentStatusOptions, setPaymentStatusOptions] = useState([]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [payStatusRemarks, setPayStatusRemarks] = useState('');
  const [payStatusVoice, setPayStatusVoice] = useState(null); // payment-status remarks voice note
  const [payStatusPaymentDate, setPayStatusPaymentDate] = useState('');
  const [payStatusRegDate, setPayStatusRegDate] = useState('');
  const [payStatusSaving, setPayStatusSaving] = useState(false);
  const emptyRegSplit = {
    stamp_commission: '',
    registration_expenses: '',
    writer_expenses: '',
    patta_charges: '',
    other_registration_expenses: '',
  };
  const emptyModtSplit = {
    stamp_duty: '',
    registration_fees: '',
    stamp_commission: '',
    registration_expenses: '',
    writer_expenses: '',
  };
  const [devCostForm, setDevCostForm] = useState({
    guideline_value: '',
    plot_area: '',
    development_cost_per_sqft: '',
    registration_split: { ...emptyRegSplit },
    modt_enabled: false,
    modt_split: { ...emptyModtSplit },
  });
  const [devCostSaving, setDevCostSaving] = useState(false);
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsSaving, setDocumentsSaving] = useState(false);
  const [documentForm, setDocumentForm] = useState({ document_name: '', document_type: '', description: '' });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // ── File-type helpers (icon + flag) ──
  const getFileMeta = (mimeType = '', fileName = '') => {
    const mt = String(mimeType).toLowerCase();
    const name = String(fileName).toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    const isImage = mt.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
    const isPdf = mt === 'application/pdf' || ext === 'pdf';
    const isVideo = mt.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi'].includes(ext);
    const isAudio = mt.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
    const isDoc = ['doc', 'docx', 'odt', 'rtf'].includes(ext) || mt.includes('msword') || mt.includes('officedocument.wordprocessing');
    const isSheet = ['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mt.includes('spreadsheet') || mt.includes('excel');
    const isSlide = ['ppt', 'pptx', 'odp'].includes(ext) || mt.includes('presentation') || mt.includes('powerpoint');
    const isZip = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mt.includes('zip') || mt.includes('compressed');
    const isText = mt.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'log'].includes(ext);
    let icon = '📎';
    if (isImage) icon = '🖼️';
    else if (isPdf) icon = '📕';
    else if (isVideo) icon = '🎬';
    else if (isAudio) icon = '🎵';
    else if (isDoc) icon = '📄';
    else if (isSheet) icon = '📊';
    else if (isSlide) icon = '📽️';
    else if (isZip) icon = '🗜️';
    else if (isText) icon = '📝';
    return { icon, isImage, isPdf, ext };
  };

  const humanFileSize = (bytes) => {
    if (!bytes) return '—';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Workflow state
  const [workflowMode, setWorkflowMode] = useState(null);
  const [registerForm, setRegisterForm] = useState({ registration_date: '', registration_number: '' });
  const [registerFiles, setRegisterFiles] = useState([]);
  const [registerSaving, setRegisterSaving] = useState(false);
  const [emiRemarks, setEmiRemarks] = useState('');
  const [emiSaving, setEmiSaving] = useState(false);
  const [reqCancelSaving, setReqCancelSaving] = useState(false);
  const [confirmCancelSaving, setConfirmCancelSaving] = useState(false);
  const [cancelRefundForm, setCancelRefundForm] = useState({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
  const [refundForm, setRefundForm] = useState({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
  const [refundSaving, setRefundSaving] = useState(false);

  const QUICK_STATUS_CODES = ['BOOKED', 'REGISTERED', 'EMI', 'REQUEST_TO_CANCEL'];
  const PAYMENT_CATEGORIES = ['Plot Value', 'Stamp Duty', 'Registration', 'Registration Expenses', 'Other Registration Expenses', 'Development', 'MODT', 'Other'];
  const CATEGORY_COLORS = {
    'Plot Value': { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
    'Stamp Duty': { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    'Registration': { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' },
    'Registration Expenses': { bg: '#E0F2FE', text: '#075985', border: '#BAE6FD' },
    'Other Registration Expenses': { bg: '#CFFAFE', text: '#155E75', border: '#A5F3FC' },
    'Development': { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
    'MODT': { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
    'Other': { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  };

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
    paymentStatusApi.getDropdown().then(r => setPaymentStatusOptions(r.data?.data || r.data || [])).catch(()=>{});
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
  const quickStatusOptions = statusOptions.filter((status) => QUICK_STATUS_CODES.includes(status.status_code));

  const openActionModal = (mode) => {
    setActionMode(mode);
    if (mode === 'status') {
      const currentStatusCode = booking?.bookingStatus?.status_code || booking?.status_code;
      const selectedStatusId = QUICK_STATUS_CODES.includes(currentStatusCode)
        ? String(booking?.booking_status_id || '')
        : '';
      setNewStatusId(selectedStatusId);
      setStatusRemarks('');
      setStatusVoice(null);
      setCancelReasonId('');
      setCancelRemarks('');
      setCancelVoice(null);
      setRegisterForm({ registration_date: '', registration_number: '' });
      setRegisterFiles([]);
      return;
    }
    if (mode === 'payStatus') {
      setPaymentStatus(booking?.payment_status || '');
      const matched = paymentStatusOptions.find(p => p.status_name === booking?.payment_status || p.status_code === booking?.payment_status);
      setPaymentStatusId(booking?.payment_status_id || matched?.id || '');
      setFollowUpDate('');
      setPayStatusRemarks('');
      setPayStatusVoice(null);
      setPayStatusPaymentDate('');
      setPayStatusRegDate('');
      return;
    }
    if (mode === 'pay') {
      setPayForm({ payment_type:'', payment_category:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
      return;
    }
    if (mode === 'devCost') {
      const cb = booking?.custom_fields?.cost_breakdown || {};
      const hydrate = (template, source) => Object.keys(template).reduce((acc, k) => {
        acc[k] = source && source[k] != null ? source[k] : '';
        return acc;
      }, {});
      setDevCostForm({
        guideline_value: booking?.guideline_value ?? '',
        plot_area: booking?.plot_area ?? '',
        development_cost_per_sqft: booking?.development_cost_per_sqft ?? '',
        registration_split: hydrate(emptyRegSplit, cb.registration_split),
        modt_enabled: !!cb.modt_enabled,
        modt_split: hydrate(emptyModtSplit, cb.modt_split),
      });
    }
  };

  const closeActionModal = () => setActionMode(null);

  // Send a draft "Booking Open" booking to the Super Admin for approval.
  const [sendingApproval, setSendingApproval] = useState(false);
  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const handleSendForApproval = async () => {
    setSendingApproval(true);
    try {
      await bookingApi.sendForApproval(bookingId);
      toast.success('Booking sent for approval');
      setShowApprovalConfirm(false);
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send for approval'));
    } finally {
      setSendingApproval(false);
    }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    if (!payForm.payment_category) {
      toast.error('Please select what this payment is for (Plot, Stamp, Registration, Development, or MODT)');
      return;
    }
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
      setPayForm({ payment_type:'', payment_category:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
      loadBooking();
      loadActivities();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setPaySaving(false); }
  };

  const handleStatusUpdate = async () => {
    if (!newStatusId) return;
    const selectedStatus = quickStatusOptions.find((s) => String(s.id) === newStatusId);
    if (!selectedStatus) {
      toast.error('Select a valid status');
      return;
    }
    if (selectedStatus.status_code === 'REGISTERED') {
      if (!registerForm.registration_date || !registerForm.registration_number || registerFiles.length === 0) {
        toast.error('Registration date, document number, and at least one document file are required');
        return;
      }
    }
    if (selectedStatus.status_code === 'EMI' && !statusRemarks.trim()) {
      toast.error('Remarks are mandatory for EMI');
      return;
    }
    if (selectedStatus.status_code === 'REQUEST_TO_CANCEL' && !cancelReasonId) {
      toast.error('Select a cancellation reason');
      return;
    }
    setStatusSaving(true);
    try {
      if (selectedStatus.status_code === 'EMI') {
        await bookingApi.updateToEMI(bookingId, { remarks: statusRemarks.trim() });
        toast.success('Booking moved to EMI');
      } else if (selectedStatus.status_code === 'REQUEST_TO_CANCEL') {
        await bookingApi.requestToCancel(bookingId, {
          cancel_reason_id: cancelReasonId,
          cancel_remarks: cancelRemarks,
        });
        toast.success('Cancellation requested');
      } else if (selectedStatus.status_code === 'REGISTERED') {
        const formData = new FormData();
        registerFiles.forEach((f) => formData.append('documents', f));
        formData.append('registration_date', registerForm.registration_date);
        formData.append('registration_number', registerForm.registration_number);
        await bookingApi.registerBooking(bookingId, formData);
        toast.success('Booking registered');
        setRegisterForm({ registration_date: '', registration_number: '' });
        setRegisterFiles([]);
      } else {
        await bookingApi.update(bookingId, { booking_status_id: newStatusId });
        toast.success('Status updated');
      }

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
    
    const sel = paymentStatusOptions.find(p => p.id === paymentStatusId);
    const needsFollowup = sel ? sel.needs_followup : ['Bank Loan Applied', 'OSR Received', 'Registration Scheduled', 'Part Payment Received', 'Follow Up'].includes(paymentStatus);
    const needsRemarks = sel ? sel.needs_remarks : ['Bank Loan Applied', 'OSR Received', 'Registration Scheduled', 'Part Payment Received', 'Follow Up'].includes(paymentStatus);
    const isRegScheduled = sel ? (sel.status_code === 'REGISTRATION_SCHEDULED' || sel.status_name === 'Registration Scheduled') : paymentStatus === 'Registration Scheduled';
    const isPaymentDateReq = sel ? (sel.status_code === 'RECEIVED' || sel.status_code === 'PARTIAL' || sel.status_name === 'Part Payment Received') : ['Part Payment Received', 'Full Payment Received'].includes(paymentStatus);

    if (needsFollowup && !followUpDate) { toast.error('Follow-up date is required'); return; }
    if (needsRemarks && !payStatusRemarks.trim()) { toast.error('Remarks are required'); return; }
    if (isRegScheduled && !payStatusRegDate) { toast.error('Registration date is required'); return; }
    if (isPaymentDateReq && !payStatusPaymentDate) { toast.error('Payment date is required'); return; }

    setPayStatusSaving(true);
    try {
      const payload = {
        payment_status: paymentStatus,
        payment_status_id: paymentStatusId || null,
      };
      if (followUpDate) payload.next_follow_up_at = followUpDate;
      if (payStatusRemarks.trim()) payload.remarks = payStatusRemarks;
      if (payStatusPaymentDate) payload.payment_date = payStatusPaymentDate;
      if (payStatusRegDate) payload.registration_date = payStatusRegDate;
      await bookingApi.updatePaymentStatus(bookingId, payload);
      toast.success('Payment status updated');
      closeActionModal();
      setFollowUpDate('');
      setPayStatusRemarks('');
      setPayStatusVoice(null);
      setPayStatusPaymentDate('');
      setPayStatusRegDate('');
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
      toast.error('Enter valid Guideline Value, Plot Area, and Development cost/sqft');
      return;
    }
    const cleanSplit = (split) => Object.fromEntries(
      Object.entries(split).map(([k, v]) => [k, parseFloat(v) || 0])
    );
    setDevCostSaving(true);
    try {
      await bookingApi.updateDevelopmentCost(bookingId, {
        guideline_value: guideline,
        plot_area: area,
        development_cost_per_sqft: perSqft,
        registration_split: cleanSplit(devCostForm.registration_split),
        modt_enabled: !!devCostForm.modt_enabled,
        modt_split: cleanSplit(devCostForm.modt_split),
      });
      toast.success('Cost breakdown updated');
      closeActionModal();
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update cost breakdown'));
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
    <div className="simple-loader">
      <div className="simple-spinner" />
      <p>Loading...</p>
    </div>
  );
  if (!booking) return (
    <div className="col-empty"><div className="col-empty-title">Booking not found</div>
      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={onBack}>Go Back</button>
    </div>
  );

  const payments = booking.payments || [];
  const customer = booking.customer || {};
  // The lead's name (customer first/last mirror the originating lead).
  const leadFullName = (booking.lead
    ? `${booking.lead.first_name || ''} ${booking.lead.last_name || ''}`.trim()
    : `${customer.first_name || ''} ${customer.last_name || ''}`.trim()) || '—';
  // The actual buyer comes from the dedicated buyer_name field — NOT the lead name.
  const buyerName = booking.buyer_name || customer.buyer_name || booking.customer_name || leadFullName || '—';
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

  // Detailed split + optional MODT stored in custom_fields.cost_breakdown
  const sumSplit = (split) => Object.values(split || {}).reduce((sum, v) => sum + toAmount(v), 0);
  const labelize = (k) => k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const costBreakdown = booking.custom_fields?.cost_breakdown || {};
  const savedRegSplit = costBreakdown.registration_split || {};
  const savedModtEnabled = !!costBreakdown.modt_enabled;
  const savedModtSplit = costBreakdown.modt_split || {};
  const regSplitTotal = sumSplit(savedRegSplit);
  const modtSplitTotal = savedModtEnabled ? sumSplit(savedModtSplit) : 0;
  const otherChargesTotal = regSplitTotal + modtSplitTotal;

  const computedTotalValue = plotValue + stampValue + registrationValue + developmentValue + otherChargesTotal;
  const totalValue = computedTotalValue > 0 ? computedTotalValue : toAmount(booking.net_amount || booking.total_amount);
  const balanceDue = totalValue - totalPaid;
  const pctCollected = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0;

  // ── Per-category targets & collected (drives the Add Payment dropdown + per-bucket progress bars) ──
  const paidByCategory = payments.reduce((acc, p) => {
    if (p.is_bounced) return acc;
    const cat = p.payment_category || 'Other';
    acc[cat] = (acc[cat] || 0) + toAmount(p.amount);
    return acc;
  }, {});
  // "Registration Expenses" and "Other Registration Expenses" are broken out of
  // the registration split into their own payment buckets so they can be
  // collected and logged separately. The base Registration bucket therefore
  // excludes them to avoid double-counting (grand total is unchanged).
  const regExpensesTarget = toAmount(savedRegSplit.registration_expenses);
  const otherRegExpensesTarget = toAmount(savedRegSplit.other_registration_expenses);
  const registrationTarget = registrationValue + (regSplitTotal - regExpensesTarget - otherRegExpensesTarget);
  const categoryBuckets = [
    { key: 'Plot Value', target: plotValue, paid: paidByCategory['Plot Value'] || 0 },
    { key: 'Stamp Duty', target: stampValue, paid: paidByCategory['Stamp Duty'] || 0 },
    { key: 'Registration', target: registrationTarget, paid: paidByCategory['Registration'] || 0 },
    { key: 'Registration Expenses', target: regExpensesTarget, paid: paidByCategory['Registration Expenses'] || 0 },
    { key: 'Other Registration Expenses', target: otherRegExpensesTarget, paid: paidByCategory['Other Registration Expenses'] || 0 },
    { key: 'Development', target: developmentValue, paid: paidByCategory['Development'] || 0 },
    { key: 'MODT', target: modtSplitTotal, paid: paidByCategory['MODT'] || 0 },
    { key: 'Other', target: 0, paid: paidByCategory['Other'] || 0 },
  ];

  const isCollectionManager = getRoleCode(user) === ROLE_CODES.COLLECTION;
  const devCostGuidelineValue = toAmount(devCostForm.guideline_value || booking.guideline_value);
  const devCostPlotAreaValue = toAmount(devCostForm.plot_area || booking.plot_area);
  const devCostPerSqftValue = toAmount(devCostForm.development_cost_per_sqft || booking.development_cost_per_sqft);
  // Plot Value = ROUNDUP(rate × sqft, -2) — round up to the nearest 100.
  const previewPlotValue = Math.ceil((devCostGuidelineValue * devCostPlotAreaValue) / 100) * 100;
  const previewStampValue = Math.ceil((previewPlotValue * 0.07) / 100) * 100;
  const previewRegistrationValue = Math.ceil((previewPlotValue * 0.02) / 100) * 100;
  const previewDevelopmentValue = Math.round((devCostPlotAreaValue * devCostPerSqftValue) * 1.18 * 100) / 100;
  const previewRegSplitTotal = sumSplit(devCostForm.registration_split);
  const previewModtSplitTotal = devCostForm.modt_enabled ? sumSplit(devCostForm.modt_split) : 0;
  const previewOtherChargesTotal = previewRegSplitTotal + previewModtSplitTotal;
  const previewGrandTotal = previewPlotValue + previewStampValue + previewRegistrationValue + previewDevelopmentValue + previewOtherChargesTotal;
  const liveTotalValue = actionMode === 'devCost' ? previewGrandTotal : totalValue;

  const unverifiedAmt = payments.filter(p => !p.is_verified && !p.is_bounced).reduce((s,p) => s + parseFloat(p.amount||0), 0);
  const verifiedCount = payments.filter(p => p.is_verified).length;
  const pendingCount = payments.filter(p => !p.is_verified && !p.is_bounced).length;
  const tabs = [
    { key: 'payment-history', label: 'Payments', icon: CreditCardIcon },
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
          {/* Workflow action buttons */}
          {['BOOKING_APPROVED', 'BOOKED', 'REGISTERED', 'EMI'].includes(booking.bookingStatus?.status_code || booking.status_code) && (
            <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#EF4444',color:'#EF4444'}} onClick={() => setWorkflowMode('requestCancel')}><ExclamationTriangleIcon style={{width:14,height:14}}/> Request Cancel</button>
          )}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && booking.custom_fields?.cancel_approved_by && (
            <button className="bkd-btn bkd-btn-primary" style={{background:'#DC2626'}} onClick={() => setWorkflowMode('confirmCancel')}><XCircleIcon style={{width:14,height:14}}/> Confirm Cancel</button>
          )}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && !booking.custom_fields?.cancel_approved_by && (
            <span style={{fontSize:12, color:'#F59E0B', fontWeight:600, padding:'6px 12px', background:'#F59E0B18', borderRadius:6}}>⏳ Awaiting SH Approval</span>
          )}
          {booking.is_cancelled && totalPaid > 0 && (
            <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#F59E0B',color:'#F59E0B'}} onClick={() => setWorkflowMode('refund')}>
              <BanknotesIcon style={{width:14,height:14}}/> Process Refund ({formatCurrency(totalPaid)} pending)
            </button>
          )}
          {/* Booking Open → send to Super Admin for approval (unit reserved) */}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'BOOKING_OPEN' && (
            <button className="bkd-btn bkd-btn-primary" disabled={sendingApproval} onClick={() => setShowApprovalConfirm(true)}>
              <CheckCircleIcon style={{width:14,height:14}}/> {sendingApproval ? 'Sending…' : 'Send for Approval'}
            </button>
          )}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'BOOKING_PENDING' && (
            <span style={{fontSize:12, color:'#B45309', fontWeight:600, padding:'6px 12px', background:'#F59E0B18', borderRadius:6}}>⏳ Awaiting Super Admin Approval</span>
          )}
          {/* Payment/Booking status changes are blocked while still Booking Open (not yet sent for approval) */}
          {(booking.bookingStatus?.status_code || booking.status_code) !== 'BOOKING_OPEN' && (
            <>
              <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('payStatus')}><CreditCardIcon style={{width:14,height:14}}/> Payment Status</button>
              <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('status')}><PencilSquareIcon style={{width:14,height:14}}/> Booking Status</button>
            </>
          )}
          {/* <button className="bkd-btn bkd-btn-outline" onClick={() => openActionModal('devCost')}><BanknotesIcon style={{width:14,height:14}}/> Development Cost</button> */}
          {/* Payments are blocked until the booking is sent for approval (Booking Pending+) */}
          {(booking.bookingStatus?.status_code || booking.status_code) !== 'BOOKING_OPEN' && (
            <button className="bkd-btn bkd-btn-primary" onClick={() => openActionModal('pay')}><PlusIcon style={{width:14,height:14}}/> Add Payment</button>
          )}
          <button className="bkd-btn bkd-btn-ghost" onClick={loadBooking} title="Refresh"><ArrowPathIcon style={{width:14,height:14}}/></button>
        </div>
      </div>

      {/* Rejection banner — shows the Super Admin's reject remarks */}
      {(booking.bookingStatus?.status_code || booking.status_code) === 'BOOKING_REJECTED' && (
        <div className="bkd-alert-banner" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
          <XCircleIcon style={{ width: 18, height: 18, flexShrink: 0, color: '#DC2626' }} />
          <div>
            <span className="bkd-alert-title" style={{ color: '#991B1B' }}>Booking Rejected by Super Admin</span>
            <span className="bkd-alert-text">{booking.custom_fields?.reject_remarks || 'No remarks provided.'}{totalPaid > 0 ? ` — refund of ${formatCurrency(totalPaid)} pending.` : ''}</span>
          </div>
        </div>
      )}

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
                  <InfoRow label="Lead Name" value={leadFullName}/>
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

                  {(otherChargesTotal > 0) && (
                    <div className="bkd-extra-charges-shell" style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #111827)' }}>Other Registration Charges</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>
                          Subtotal: {formatCurrency(otherChargesTotal)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {Object.entries(savedRegSplit).filter(([, v]) => toAmount(v) > 0).map(([k, v]) => (
                          <span key={k} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: '#EEF2FF', color: '#4338CA', fontSize: 11, fontWeight: 600,
                            padding: '4px 8px', borderRadius: 6, border: '1px solid #C7D2FE',
                          }}>
                            <span style={{ opacity: 0.85 }}>{labelize(k)}</span>
                            <strong>{formatCurrency(toAmount(v))}</strong>
                          </span>
                        ))}
                        {savedModtEnabled && Object.entries(savedModtSplit).filter(([, v]) => toAmount(v) > 0).map(([k, v]) => (
                          <span key={`modt-${k}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 600,
                            padding: '4px 8px', borderRadius: 6, border: '1px solid #FDE68A',
                          }}>
                            <span style={{ opacity: 0.85 }}>MODT · {labelize(k)}</span>
                            <strong>{formatCurrency(toAmount(v))}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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

                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {categoryBuckets.filter(b => b.target > 0 || b.paid > 0).map(b => {
                      const c = CATEGORY_COLORS[b.key] || CATEGORY_COLORS.Other;
                      const pct = b.target > 0 ? Math.min(100, Math.round((b.paid / b.target) * 100)) : (b.paid > 0 ? 100 : 0);
                      const balance = Math.max(b.target - b.paid, 0);
                      return (
                        <div key={b.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 11 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                              padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                            }}>
                              {b.key} · {pct}%
                            </span>
                            <span style={{ color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>
                              {formatCurrency(b.paid)} / {formatCurrency(b.target)}
                              {b.target > 0 && <span style={{ marginLeft: 6, color: '#DC2626' }}>· {formatCurrency(balance)} due</span>}
                            </span>
                          </div>
                          <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: c.text, transition: 'width 0.3s' }} />
                          </div>
                        </div>
                      );
                    })}
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
            {/* Payments blocked until the booking is sent for approval (Pending+) */}
            {(booking.bookingStatus?.status_code || booking.status_code) !== 'BOOKING_OPEN' && (
              <button className="bkd-btn bkd-btn-primary bkd-btn-sm" onClick={() => openActionModal('pay')}><PlusIcon style={{width:13,height:13}}/> Add Payment</button>
            )}
          </div>
          <div>{payments.length === 0 ? (
            <div style={{padding:30,textAlign:'center',color:'var(--text-muted,#9ca3af)',fontSize:13}}>No payments recorded yet</div>
          ) : (
            <table className="bkd-table"><thead><tr>
              <th>Date</th><th>Paid For</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Bank</th><th>Type</th><th>Status</th><th>Actions</th>
            </tr></thead><tbody>
              {payments.map(p => {
                const isRefund = !!p.is_refund;
                const catKey = isRefund ? 'Refund' : (p.payment_category || 'Other');
                const c = isRefund
                  ? { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' }
                  : (CATEGORY_COLORS[catKey] || CATEGORY_COLORS.Other);
                return (
                <tr key={p.id} className={p.is_bounced ? 'bkd-row-bounced' : ''}>
                  <td>{fmtD(p.payment_date)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', background: c.bg, color: c.text,
                      border: `1px solid ${c.border}`, padding: '3px 8px',
                      borderRadius: 12, fontSize: 11, fontWeight: 700,
                    }}>{isRefund ? '↩ Refund' : catKey}</span>
                  </td>
                  <td style={{fontWeight:700, color: isRefund ? '#DC2626' : undefined}}>
                    {isRefund ? '−' : ''}{formatCurrency(p.amount)}
                  </td>
                  <td>{p.payment_mode}</td>
                  <td className="bkd-mono">{p.transaction_ref || p.utr_number || p.cheque_dd_number || '—'}</td>
                  <td style={{fontSize:12}}>{p.bank_name || '—'}</td>
                  <td style={{fontSize:12}}>{p.payment_type}</td>
                  <td>{p.is_bounced ? <span className="bkd-badge bkd-badge-danger">Rejected</span>
                    : isRefund ? <span className="bkd-badge bkd-badge-danger">Refunded</span>
                    : p.is_verified ? <span className="bkd-badge bkd-badge-neutral">Verified</span>
                    : <span className="bkd-badge bkd-badge-warning">Unverified</span>}</td>
                  <td>—</td>
                </tr>
                );
              })}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                />
                <div
                  className="bkd-upload-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    const dropped = Array.from(e.dataTransfer.files || []);
                    if (dropped.length) setSelectedFiles(dropped);
                  }}
                  style={{
                    cursor: 'pointer',
                    border: `2px dashed ${dragActive ? '#4f46e5' : 'var(--border-primary, #e5e7eb)'}`,
                    background: dragActive ? '#eef2ff' : 'var(--bg-secondary, #f9fafb)',
                    transition: 'all 0.15s',
                  }}
                >
                  <CloudArrowUpIcon style={{ width: 28, height: 28, color: 'var(--col-primary, #4f46e5)' }} />
                  <div style={{ fontWeight: 700, color: 'var(--col-text, #111827)' }}>
                    {dragActive ? 'Drop files here' : 'Click to choose files or drag & drop'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--col-text-secondary, #6b7280)' }}>
                    Any file type — PDF, images, Word, Excel, ZIP, video, audio, anything.
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Selected ({selectedFiles.length}):</div>
                    {selectedFiles.map((f, i) => {
                      const meta = getFileMeta(f.type, f.name);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: '#334155' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 14 }}>{meta.icon}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{f.name}</span>
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>{humanFileSize(f.size)}</span>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => { setSelectedFiles([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
                    >
                      Clear selection
                    </button>
                  </div>
                )}

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
                <button className="bkd-btn bkd-btn-primary" onClick={handleUploadDocuments} disabled={documentsSaving || selectedFiles.length === 0} style={{ marginTop: 10 }}>
                  {documentsSaving ? 'Uploading...' : <><CloudArrowUpIcon style={{ width: 14, height: 14 }} /> Upload Documents</>}
                </button>
              </div>

              <div className="bkd-upload-panel">
                <div className="bkd-card-title" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><DocumentTextIcon style={{ width: 15, height: 15 }} /> Uploaded Documents</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted, #6b7280)' }}>{documents.length} file{documents.length === 1 ? '' : 's'}</span>
                </div>
                {documentsLoading ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>Loading...</div>
                ) : documents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No documents uploaded yet.</div>
                ) : (
                  <div className="bkd-document-list">
                    {documents.map((doc) => {
                      const meta = getFileMeta(doc.mime_type, doc.document_name || doc.original_filename || '');
                      const viewUrl = doc.file_url || doc.download_url;
                      const downloadUrl = doc.download_url || doc.file_url;
                      return (
                        <div className="bkd-document-item" key={doc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-primary, #e5e7eb)' }}>
                          <div style={{
                            width: 44, height: 44, flexShrink: 0, borderRadius: 8,
                            background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                            overflow: 'hidden',
                          }}>
                            {meta.isImage && viewUrl
                              ? <img src={viewUrl} alt={doc.document_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span>{meta.icon}</span>}
                          </div>
                          <div className="bkd-document-main" style={{ flex: 1, minWidth: 0 }}>
                            <div className="bkd-document-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.document_name || doc.original_filename || 'Document'}
                            </div>
                            <div className="bkd-document-meta">
                              {doc.document_type || 'Document'} · {doc.mime_type || meta.ext.toUpperCase() || 'Unknown'} · {humanFileSize(doc.file_size)}
                            </div>
                            <div className="bkd-document-meta">
                              Uploaded by {doc.uploader ? `${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`.trim() : 'System'} · {fmtD(doc.created_at)}
                            </div>
                            {doc.description && (
                              <div className="bkd-document-meta" style={{ fontStyle: 'italic' }}>{doc.description}</div>
                            )}
                          </div>
                          <div className="bkd-document-actions" style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                            {viewUrl && (
                              <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={viewUrl} target="_blank" rel="noreferrer" title="View / Preview">
                                <EyeIcon style={{ width: 13, height: 13 }} /> View
                              </a>
                            )}
                            {downloadUrl && (
                              <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={downloadUrl} download={doc.document_name || doc.original_filename || true} title="Download to your device">
                                <ArrowDownTrayIcon style={{ width: 13, height: 13 }} /> Download
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK ACTION MODAL (same as bookings list style) ── */}
      {showApprovalConfirm && (
        <div className="col-modal-overlay" onClick={() => !sendingApproval && setShowApprovalConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: 'min(100%, 440px)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-blue-bg, #eff4ff)', color: 'var(--accent-blue, #2563eb)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircleIcon style={{ width: 18, height: 18 }} />
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Send for approval</h3>
            </div>
            <div style={{ padding: 20, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Send booking <strong style={{ color: 'var(--text-primary)' }}>{booking.booking_number}</strong>
              {' '}({booking.customer_name || booking.buyer_name || 'customer'}) for Super Admin approval?
              The unit will be <strong style={{ color: 'var(--text-primary)' }}>reserved</strong>.
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="bkd-btn bkd-btn-outline" onClick={() => setShowApprovalConfirm(false)} disabled={sendingApproval}>Cancel</button>
              <button type="button" className="bkd-btn bkd-btn-primary" onClick={handleSendForApproval} disabled={sendingApproval}>
                <CheckCircleIcon style={{ width: 14, height: 14 }} /> {sendingApproval ? 'Sending…' : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <div className="bkd-form-group" style={{ flex: 1 }}>
                      <label className="bkd-form-label">Payment For (Category) *</label>
                      <select className="bkd-form-control" value={payForm.payment_category}
                        onChange={e => setPayForm(p => ({ ...p, payment_category: e.target.value }))}>
                        <option value="">Select what this payment is for</option>
                        {PAYMENT_CATEGORIES.map((cat) => {
                          const bucket = categoryBuckets.find(b => b.key === cat);
                          const target = bucket?.target || 0;
                          const paid = bucket?.paid || 0;
                          const balance = Math.max(target - paid, 0);
                          const suffix = target > 0
                            ? ` — Balance ${formatCurrency(balance)} of ${formatCurrency(target)}`
                            : (paid > 0 ? ` — Paid ${formatCurrency(paid)}` : '');
                          return <option key={cat} value={cat}>{cat}{suffix}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                  {payForm.payment_category && (() => {
                    const bucket = categoryBuckets.find(b => b.key === payForm.payment_category);
                    if (!bucket) return null;
                    const c = CATEGORY_COLORS[payForm.payment_category] || CATEGORY_COLORS.Other;
                    const balance = Math.max(bucket.target - bucket.paid, 0);
                    const pct = bucket.target > 0 ? Math.min(100, Math.round((bucket.paid / bucket.target) * 100)) : 0;
                    return (
                      <div style={{
                        marginBottom: 12, padding: '10px 12px', background: c.bg, border: `1px solid ${c.border}`,
                        borderRadius: 8, color: c.text, fontSize: 12, fontWeight: 600,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span>{payForm.payment_category}</span>
                          <span>Target {formatCurrency(bucket.target)} · Paid {formatCurrency(bucket.paid)} · Balance {formatCurrency(balance)}</span>
                        </div>
                        <div style={{ height: 6, background: '#FFFFFF80', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: c.text, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    );
                  })()}
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
                  <button className="qa-drawer-save-btn" disabled={paySaving || !payForm.amount || !payForm.payment_category || !payForm.payment_type || !payForm.payment_mode_id || (payForm.payment_mode !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim()))} onClick={handleAddPayment}>
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
                    {quickStatusOptions.map(s => (
                      <button key={s.id} className={`qa-drawer-st-btn ${newStatusId === String(s.id) ? 'sel-default' : ''}`}
                        onClick={() => setNewStatusId(String(s.id))}>
                        <div className="qa-drawer-st-icon" style={{ fontSize: 16 }}>
                          {s.status_code === 'REQUEST_TO_CANCEL' ? (
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
                    const sel = quickStatusOptions.find(s => String(s.id) === newStatusId);
                    if (sel?.status_code === 'EMI') {
                      return (
                        <div style={{ marginTop: 14 }}>
                          <label className="qa-drawer-field-label">EMI Remarks *</label>
                          <textarea className="qa-drawer-remark-ta" rows={2} placeholder="Enter EMI remarks"
                            value={statusRemarks} onChange={e => setStatusRemarks(e.target.value)} />
                          <VoiceNoteField
                            voice={statusVoice}
                            onVoiceChange={setStatusVoice}
                            transcribeApi={leadWorkflowApi.transcribeVoice}
                            onTranscribed={(text) => setStatusRemarks((p) => (p ? `${p} ${text}` : text))}
                          />
                        </div>
                      );
                    }
                    if (sel?.status_code === 'REGISTERED') {
                      return (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8, padding: 10, fontSize: 12, color: '#166534', marginBottom: 12 }}>
                            <strong>Registration requires document upload.</strong> Fill in the details below and the registered document file to complete this status.
                          </div>
                          <div className="bkd-form-row">
                            <div className="bkd-form-group">
                              <label className="bkd-form-label">Date of Registration *</label>
                              <input type="date" className="bkd-form-control" value={registerForm.registration_date}
                                onChange={(e) => setRegisterForm((p) => ({ ...p, registration_date: e.target.value }))} />
                            </div>
                            <div className="bkd-form-group">
                              <label className="bkd-form-label">Document Number *</label>
                              <input type="text" className="bkd-form-control" placeholder="Registration document number"
                                value={registerForm.registration_number}
                                onChange={(e) => setRegisterForm((p) => ({ ...p, registration_number: e.target.value }))} />
                            </div>
                          </div>
                          <div className="bkd-form-group">
                            <label className="bkd-form-label">Upload Document *</label>
                            <input type="file" className="bkd-form-control" multiple
                              onChange={(e) => setRegisterFiles(Array.from(e.target.files || []))} />
                            {registerFiles.length > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--accent-green, #166534)', marginTop: 6 }}>
                                Selected: {registerFiles.map((f) => f.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    if (sel?.status_code === 'REQUEST_TO_CANCEL') {
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
                            <VoiceNoteField
                              voice={cancelVoice}
                              onVoiceChange={setCancelVoice}
                              transcribeApi={leadWorkflowApi.transcribeVoice}
                              onTranscribed={(text) => setCancelRemarks((p) => (p ? `${p} ${text}` : text))}
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button
                    className="qa-drawer-save-btn"
                    disabled={
                      !newStatusId
                      || statusSaving
                      || (quickStatusOptions.find(s => String(s.id) === newStatusId)?.status_code === 'REGISTERED' && (!registerForm.registration_date || !registerForm.registration_number || registerFiles.length === 0))
                      || (quickStatusOptions.find(s => String(s.id) === newStatusId)?.status_code === 'EMI' && !statusRemarks.trim())
                      || (quickStatusOptions.find(s => String(s.id) === newStatusId)?.status_code === 'REQUEST_TO_CANCEL' && !cancelReasonId)
                    }
                    onClick={handleStatusUpdate}
                  >
                    {statusSaving ? 'Updating...' : <><CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Booking Status</>}
                  </button>
                </div>
              </div>
            )}

            {actionMode === 'payStatus' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '580px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Update Payment Status</div>
                  <div className="qa-drawer-status-grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {paymentStatusOptions.map(ps => {
                      const isSelected = paymentStatusId === ps.id;
                      return (
                        <button key={ps.id} className={`qa-drawer-st-btn ${isSelected ? 'sel-follow-up' : ''}`}
                          onClick={() => {
                            setPaymentStatusId(ps.id);
                            setPaymentStatus(ps.status_name);
                            setFollowUpDate(''); setPayStatusRemarks(''); setPayStatusPaymentDate(''); setPayStatusRegDate('');
                          }}>
                          <div className="qa-drawer-st-icon" style={{ fontSize: 16 }}>
                            {ps.status_code === 'PENDING' || ps.status_code === 'OVERDUE' ? (
                              <CalendarDaysIcon style={{ width: 18, height: 18, color: ps.color_code || '#F59E0B' }} />
                            ) : ps.status_code === 'RECEIVED' ? (
                              <CheckCircleIcon style={{ width: 18, height: 18, color: ps.color_code || '#10B981' }} />
                            ) : (
                              <CreditCardIcon style={{ width: 18, height: 18, color: ps.color_code || '#3B82F6' }} />
                            )}
                          </div>
                          <div className="qa-drawer-st-label" style={{ fontSize: 10 }}>{ps.status_name}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* ── Contextual fields per payment status ── */}
                  {(() => {
                    const sel = paymentStatusOptions.find(p => p.id === paymentStatusId);
                    if (!sel) return null;
                    const needsFollowup = sel.needs_followup;
                    const needsRemarks = sel.needs_remarks;
                    const isFullPayment = sel.status_code === 'RECEIVED';
                    const isRegScheduled = sel.status_code === 'REGISTRATION_SCHEDULED' || sel.status_name === 'Registration Scheduled';
                    const isPaymentDateReq = sel.status_code === 'RECEIVED' || sel.status_code === 'PARTIAL' || sel.status_name === 'Part Payment Received';
                    return (
                      <div style={{ marginTop: 16, background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                        {isFullPayment && (
                          <div style={{background:'#DCFCE7',border:'1px solid #BBF7D0',borderRadius:8,padding:10,marginBottom:12,fontSize:12,color:'#166534'}}>
                            <strong>✓ Full Payment:</strong> Booking will be auto-registered and the unit will be marked as <strong>Sold</strong>.
                          </div>
                        )}
                        {isRegScheduled && (
                          <div className="bkd-form-group" style={{marginBottom:10}}>
                            <label className="bkd-form-label">Registration Date *</label>
                            <input type="date" className="bkd-form-control" value={payStatusRegDate} onChange={e => setPayStatusRegDate(e.target.value)} />
                          </div>
                        )}
                        {isPaymentDateReq && (
                          <div className="bkd-form-group" style={{marginBottom:10}}>
                            <label className="bkd-form-label">Payment Date *</label>
                            <input type="date" className="bkd-form-control" value={payStatusPaymentDate} onChange={e => setPayStatusPaymentDate(e.target.value)} />
                          </div>
                        )}
                        {needsFollowup && (
                          <div className="bkd-form-group" style={{marginBottom:10}}>
                            <label className="bkd-form-label">Next Follow-Up Date *</label>
                            <input type="date" className="bkd-form-control" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
                          </div>
                        )}
                        {needsRemarks && (
                          <div className="bkd-form-group">
                            <label className="bkd-form-label">Remarks *</label>
                            <textarea className="bkd-form-control" rows={2} placeholder="Status remarks..." value={payStatusRemarks} onChange={e => setPayStatusRemarks(e.target.value)} />
                            <VoiceNoteField
                              voice={payStatusVoice}
                              onVoiceChange={setPayStatusVoice}
                              transcribeApi={leadWorkflowApi.transcribeVoice}
                              onTranscribed={(text) => setPayStatusRemarks((p) => (p ? `${p} ${text}` : text))}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Current follow-up info */}
                  {booking?.next_follow_up_at && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarDaysIcon style={{width:14,height:14}} />
                      Current follow-up: <strong>{new Date(booking.next_follow_up_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</strong>
                      {booking.custom_fields?.last_payment_remarks && <span> · {booking.custom_fields.last_payment_remarks}</span>}
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

            {actionMode === 'devCost' && (() => {
              const regSplitFields = [
                { key: 'stamp_commission', label: 'Stamp Commission' },
                { key: 'registration_expenses', label: 'Registration Expenses' },
                { key: 'writer_expenses', label: 'Writer Expenses' },
                { key: 'patta_charges', label: 'Patta Charges' },
                { key: 'other_registration_expenses', label: 'Other Registration Expenses' },
              ];
              const modtSplitFields = [
                { key: 'stamp_duty', label: 'Stamp Duty' },
                { key: 'registration_fees', label: 'Registration Fees' },
                { key: 'stamp_commission', label: 'Stamp Commission' },
                { key: 'registration_expenses', label: 'Registration Expenses' },
                { key: 'writer_expenses', label: 'Writer Expenses' },
              ];
              const setRegField = (key, val) => setDevCostForm(p => ({
                ...p,
                registration_split: { ...p.registration_split, [key]: val },
              }));
              const setModtField = (key, val) => setDevCostForm(p => ({
                ...p,
                modt_split: { ...p.modt_split, [key]: val },
              }));
              return (
              <div style={{ display: 'flex', flexDirection: 'column', height: '620px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Update Cost Breakdown</div>

                  <div className="bkd-dev-summary-grid">
                    <div className="bkd-dev-summary-item">
                      <div className="bkd-dev-summary-label">Plot Value</div>
                      <div className="bkd-dev-summary-value">{fmtFull(previewPlotValue || plotValue)}</div>
                    </div>
                    <div className="bkd-dev-summary-item">
                      <div className="bkd-dev-summary-label">Stamp Duty (7%)</div>
                      <div className="bkd-dev-summary-value">{fmtFull(previewStampValue || stampValue)}</div>
                    </div>
                    <div className="bkd-dev-summary-item">
                      <div className="bkd-dev-summary-label">Registration (2%)</div>
                      <div className="bkd-dev-summary-value">{fmtFull(previewRegistrationValue || registrationValue)}</div>
                    </div>
                    <div className="bkd-dev-summary-item bkd-dev-summary-item-editable">
                      <div className="bkd-dev-summary-label">Development</div>
                      <div className="bkd-dev-summary-value">{fmtFull(previewDevelopmentValue || developmentValue)}</div>
                    </div>
                  </div>

                  <div className="bkd-form-row">
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Guideline Value (per sq.ft) *</label>
                      <input type="number" className="bkd-form-control" placeholder="e.g. 5000"
                        value={devCostForm.guideline_value}
                        disabled={isCollectionManager}
                        title={isCollectionManager ? 'Collection managers cannot change the guideline value' : undefined}
                        onChange={e => setDevCostForm(p => ({ ...p, guideline_value: e.target.value }))} />
                      {isCollectionManager && (
                        <div className="bkd-dev-hint" style={{ marginTop: 4 }}>Guideline value is locked for your role.</div>
                      )}
                    </div>
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Plot Area (sqft) *</label>
                      <input type="number" className="bkd-form-control" placeholder="e.g. 1200"
                        value={devCostForm.plot_area}
                        disabled={isCollectionManager}
                        onChange={e => setDevCostForm(p => ({ ...p, plot_area: e.target.value }))} />
                    </div>
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Development Cost / Sqft *</label>
                    <input type="number" className="bkd-form-control" placeholder="e.g. 250"
                      value={devCostForm.development_cost_per_sqft}
                      onChange={e => setDevCostForm(p => ({ ...p, development_cost_per_sqft: e.target.value }))} />
                  </div>
                  <div className="bkd-dev-hint">
                    Plot Value = Guideline × Area · Stamp Duty = 7% of Plot Value · Registration = 2% of Plot Value · Development = Area × Cost/sqft × 1.18 (GST).
                  </div>

                  <div className="qa-drawer-section" style={{ padding: '14px 0 8px' }}>
                    Registration Expenses (Detailed Split)
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                      Subtotal: {fmtFull(sumSplit(devCostForm.registration_split))}
                    </span>
                  </div>
                  <div className="bkd-form-row" style={{ flexWrap: 'wrap' }}>
                    {regSplitFields.map(f => (
                      <div className="bkd-form-group" key={f.key} style={{ flex: '1 1 45%' }}>
                        <label className="bkd-form-label">{f.label}</label>
                        <input type="number" className="bkd-form-control" placeholder="0"
                          value={devCostForm.registration_split[f.key] ?? ''}
                          onChange={e => setRegField(f.key, e.target.value)} />
                      </div>
                    ))}
                  </div>

                  <div className="qa-drawer-section" style={{ padding: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700 }}>
                      <input type="checkbox" checked={!!devCostForm.modt_enabled}
                        onChange={e => setDevCostForm(p => ({ ...p, modt_enabled: e.target.checked }))} />
                      MODT Charges
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                      (To be selected if applicable)
                      {devCostForm.modt_enabled && ` · Subtotal: ${fmtFull(sumSplit(devCostForm.modt_split))}`}
                    </span>
                  </div>
                  {devCostForm.modt_enabled && (
                    <div className="bkd-form-row" style={{ flexWrap: 'wrap' }}>
                      {modtSplitFields.map(f => (
                        <div className="bkd-form-group" key={f.key} style={{ flex: '1 1 45%' }}>
                          <label className="bkd-form-label">{f.label}</label>
                          <input type="number" className="bkd-form-control" placeholder="0"
                            value={devCostForm.modt_split[f.key] ?? ''}
                            onChange={e => setModtField(f.key, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bkd-dev-summary-grid" style={{ marginTop: 14 }}>
                    <div className="bkd-dev-summary-item" style={{ gridColumn: '1 / span 1' }}>
                      <div className="bkd-dev-summary-label">Reg. Split Subtotal</div>
                      <div className="bkd-dev-summary-value">{fmtFull(previewRegSplitTotal)}</div>
                    </div>
                    <div className="bkd-dev-summary-item" style={{ gridColumn: '2 / span 1' }}>
                      <div className="bkd-dev-summary-label">MODT Subtotal</div>
                      <div className="bkd-dev-summary-value">{fmtFull(previewModtSplitTotal)}</div>
                    </div>
                    <div className="bkd-dev-summary-item bkd-dev-summary-item-editable" style={{ gridColumn: '1 / -1' }}>
                      <div className="bkd-dev-summary-label">Live Grand Total</div>
                      <div className="bkd-dev-summary-value" style={{ fontSize: 22, fontWeight: 800 }}>{fmtFull(previewGrandTotal || totalValue)}</div>
                    </div>
                  </div>
                  {renderActivityHistory()}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, borderTop: '1px solid var(--border-primary)' }}>
                  <button type="button" className="bkd-btn bkd-btn-ghost bkd-btn-sm" onClick={closeActionModal} disabled={devCostSaving}>
                    Close
                  </button>
                  <button type="button" className="bkd-btn bkd-btn-sm" onClick={handleDevelopmentCostUpdate} disabled={devCostSaving}
                    style={{ background: '#635BFF', borderColor: '#635BFF', color: '#fff' }}>
                    {devCostSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══════════ WORKFLOW MODAL ══════════ */}
      {workflowMode && (
        <div className="col-modal-overlay" onClick={() => setWorkflowMode(null)}>
          <div className="qa-modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="qa-drawer-handle" />
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{
                  background: workflowMode === 'register' ? '#22C55E22' : workflowMode === 'emi' ? '#F59E0B22' : '#EF444422',
                  color: workflowMode === 'register' ? '#22C55E' : workflowMode === 'emi' ? '#F59E0B' : '#EF4444',
                  border: `2px solid ${workflowMode === 'register' ? '#22C55E' : workflowMode === 'emi' ? '#F59E0B' : '#EF4444'}`,
                }}>
                  {workflowMode === 'register' ? '📋' : workflowMode === 'emi' ? '💰' : workflowMode === 'confirmCancel' ? '✕' : workflowMode === 'refund' ? '↩' : '⚠'}
                </div>
                <div>
                  <div className="qa-drawer-name">
                    {workflowMode === 'register' ? 'Register Booking' : workflowMode === 'emi' ? 'Move to EMI' : workflowMode === 'confirmCancel' ? 'Confirm Cancellation' : workflowMode === 'refund' ? 'Record Refund' : 'Request to Cancel'}
                  </div>
                  <div className="qa-drawer-meta">{booking.booking_number} · {booking.customer_name || booking.buyer_name}</div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={() => setWorkflowMode(null)}>×</button>
            </div>
            <div className="qa-drawer-divider" />

            {workflowMode === 'register' && (
              <div style={{ padding: '16px 20px' }}>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Date of Registration *</label>
                  <input type="date" className="bkd-form-control" value={registerForm.registration_date}
                    onChange={e => setRegisterForm(p => ({ ...p, registration_date: e.target.value }))} />
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Document Number *</label>
                  <input type="text" className="bkd-form-control" placeholder="Enter registration document number"
                    value={registerForm.registration_number} onChange={e => setRegisterForm(p => ({ ...p, registration_number: e.target.value }))} />
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Upload Document *</label>
                  <input type="file" className="bkd-form-control" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setRegisterFiles(Array.from(e.target.files || []))} />
                  {registerFiles.length > 0 && <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>{registerFiles.map(f => f.name).join(', ')}</div>}
                </div>
                <div className="qa-drawer-save-row" style={{ marginTop: 16 }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#22C55E' }} disabled={registerSaving} onClick={async () => {
                    if (!registerForm.registration_date || !registerForm.registration_number || registerFiles.length === 0) { toast.error('All fields are mandatory'); return; }
                    setRegisterSaving(true);
                    try {
                      const formData = new FormData();
                      registerFiles.forEach(f => formData.append('documents', f));
                      formData.append('registration_date', registerForm.registration_date);
                      formData.append('registration_number', registerForm.registration_number);
                      await bookingApi.registerBooking(bookingId, formData);
                      toast.success('Booking registered'); setWorkflowMode(null); loadBooking(); loadActivities();
                    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
                    finally { setRegisterSaving(false); }
                  }}>
                    {registerSaving ? 'Saving...' : 'Register Booking'}
                  </button>
                </div>
              </div>
            )}

            {workflowMode === 'emi' && (
              <div style={{ padding: '16px 20px' }}>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Remarks *</label>
                  <textarea className="bkd-form-control" rows={3} placeholder="Enter EMI remarks (mandatory)"
                    value={emiRemarks} onChange={e => setEmiRemarks(e.target.value)} />
                </div>
                <div className="qa-drawer-save-row" style={{ marginTop: 16 }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#F59E0B' }} disabled={emiSaving || !emiRemarks.trim()} onClick={async () => {
                    setEmiSaving(true);
                    try {
                      await bookingApi.updateToEMI(bookingId, { remarks: emiRemarks });
                      toast.success('Booking moved to EMI'); setWorkflowMode(null); loadBooking(); loadActivities();
                    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
                    finally { setEmiSaving(false); }
                  }}>
                    {emiSaving ? 'Saving...' : 'Move to EMI'}
                  </button>
                </div>
              </div>
            )}

            {workflowMode === 'requestCancel' && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B44', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#92400E' }}>
                  <strong>⚠ Note:</strong> This will send the request to the Sales Head for 7-day follow-up review.
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Cancel Reason *</label>
                  <select className="bkd-form-control" value={cancelReasonId} onChange={e => setCancelReasonId(e.target.value)}>
                    <option value="">Select reason</option>
                    {cancelReasons.map(r => <option key={r.id} value={r.id}>{r.reason_name}</option>)}
                  </select>
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Remarks</label>
                  <textarea className="bkd-form-control" rows={2} placeholder="Additional remarks"
                    value={cancelRemarks} onChange={e => setCancelRemarks(e.target.value)} />
                </div>
                <div className="qa-drawer-save-row" style={{ marginTop: 16 }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#EF4444' }} disabled={reqCancelSaving || !cancelReasonId} onClick={async () => {
                    setReqCancelSaving(true);
                    try {
                      await bookingApi.requestToCancel(bookingId, { cancel_reason_id: cancelReasonId, cancel_remarks: cancelRemarks });
                      toast.success('Cancellation requested'); setWorkflowMode(null); loadBooking(); loadActivities();
                    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
                    finally { setReqCancelSaving(false); }
                  }}>
                    {reqCancelSaving ? 'Submitting...' : 'Request Cancellation'}
                  </button>
                </div>
              </div>
            )}

            {workflowMode === 'confirmCancel' && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ background: '#FEE2E2', border: '1px solid #EF444444', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13 }}>
                  <strong>⚠ Confirm Cancellation</strong>
                  <p style={{ margin: '8px 0 0', color: '#991B1B' }}>SH has approved this cancellation. This action is permanent: the booking is cancelled, the unit is released back to <strong>Available</strong>, and the lead is moved to <strong>Lost</strong>.</p>
                </div>

                <div style={{ background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Collected</span>
                    <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaid)}</strong>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  Refund (optional — leave 0 to record refund later)
                </div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Amount (₹)</label>
                    <input type="number" min="0" max={totalPaid} className="bkd-form-control"
                      placeholder={`Up to ${formatCurrency(totalPaid)}`}
                      value={cancelRefundForm.refund_amount}
                      onChange={(e) => setCancelRefundForm(p => ({ ...p, refund_amount: e.target.value }))} />
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Date</label>
                    <input type="date" className="bkd-form-control"
                      value={cancelRefundForm.refund_date}
                      onChange={(e) => setCancelRefundForm(p => ({ ...p, refund_date: e.target.value }))} />
                  </div>
                </div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Mode</label>
                    <select className="bkd-form-control" value={cancelRefundForm.refund_mode_id}
                      onChange={(e) => setCancelRefundForm(p => ({ ...p, refund_mode_id: e.target.value }))}>
                      <option value="">Select mode</option>
                      {paymentModeOptions.map((m) => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
                    </select>
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Reference / UTR</label>
                    <input className="bkd-form-control" placeholder="e.g. UTR123456"
                      value={cancelRefundForm.refund_reference}
                      onChange={(e) => setCancelRefundForm(p => ({ ...p, refund_reference: e.target.value }))} />
                  </div>
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Remarks</label>
                  <textarea rows={2} className="bkd-form-control"
                    placeholder="Refund details..."
                    value={cancelRefundForm.refund_remarks}
                    onChange={(e) => setCancelRefundForm(p => ({ ...p, refund_remarks: e.target.value }))} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', marginBottom: 12 }}>
                  Refund is operator-entered. It is subtracted from collected balance — never auto-derived from plot value.
                </div>

                <div className="qa-drawer-save-row">
                  <button className="qa-drawer-save-btn" style={{ background: '#DC2626' }} disabled={confirmCancelSaving} onClick={async () => {
                    const amt = parseFloat(cancelRefundForm.refund_amount || 0);
                    if (amt > totalPaid + 0.01) { toast.error(`Refund cannot exceed collected (${formatCurrency(totalPaid)})`); return; }
                    setConfirmCancelSaving(true);
                    try {
                      await bookingApi.confirmCancel(bookingId, amt > 0 ? cancelRefundForm : {});
                      toast.success(amt > 0 ? 'Booking cancelled and refund recorded' : 'Booking cancelled');
                      setWorkflowMode(null);
                      setCancelRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
                      loadBooking(); loadActivities();
                    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
                    finally { setConfirmCancelSaving(false); }
                  }}>
                    {confirmCancelSaving ? 'Processing...' : 'Confirm Cancel Booking'}
                  </button>
                </div>
              </div>
            )}

            {workflowMode === 'refund' && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: '#92400E' }}>
                  <strong>Record Refund Payment</strong>
                  <p style={{ margin: '6px 0 0' }}>Use this when the refund is paid out after the booking was already cancelled (split refunds, delayed payouts).</p>
                </div>

                <div style={{ background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Remaining collected (refundable)</span>
                    <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaid)}</strong>
                  </div>
                </div>

                <div className="bkd-form-row">
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Amount (₹) *</label>
                    <input type="number" min="0" max={totalPaid} className="bkd-form-control"
                      placeholder={`Up to ${formatCurrency(totalPaid)}`}
                      value={refundForm.refund_amount}
                      onChange={(e) => setRefundForm(p => ({ ...p, refund_amount: e.target.value }))} />
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Date</label>
                    <input type="date" className="bkd-form-control"
                      value={refundForm.refund_date}
                      onChange={(e) => setRefundForm(p => ({ ...p, refund_date: e.target.value }))} />
                  </div>
                </div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Mode *</label>
                    <select className="bkd-form-control" value={refundForm.refund_mode_id}
                      onChange={(e) => setRefundForm(p => ({ ...p, refund_mode_id: e.target.value }))}>
                      <option value="">Select mode</option>
                      {paymentModeOptions.map((m) => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
                    </select>
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Reference / UTR</label>
                    <input className="bkd-form-control" placeholder="e.g. UTR123456"
                      value={refundForm.refund_reference}
                      onChange={(e) => setRefundForm(p => ({ ...p, refund_reference: e.target.value }))} />
                  </div>
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Remarks</label>
                  <textarea rows={2} className="bkd-form-control"
                    value={refundForm.refund_remarks}
                    onChange={(e) => setRefundForm(p => ({ ...p, refund_remarks: e.target.value }))} />
                </div>

                <div className="qa-drawer-save-row">
                  <button className="qa-drawer-save-btn" style={{ background: '#F59E0B' }}
                    disabled={refundSaving || !refundForm.refund_amount || parseFloat(refundForm.refund_amount) <= 0}
                    onClick={async () => {
                      setRefundSaving(true);
                      try {
                        await bookingApi.processRefund(bookingId, refundForm);
                        toast.success('Refund recorded');
                        setWorkflowMode(null);
                        setRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
                        loadBooking(); loadActivities();
                      } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
                      finally { setRefundSaving(false); }
                    }}>
                    {refundSaving ? 'Recording...' : 'Record Refund'}
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
