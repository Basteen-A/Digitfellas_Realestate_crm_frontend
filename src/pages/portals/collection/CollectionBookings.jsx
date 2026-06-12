import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  MagnifyingGlassIcon, ArrowPathIcon, ClipboardDocumentListIcon,
  EyeIcon, BanknotesIcon, PencilSquareIcon, CheckCircleIcon,
  CreditCardIcon, ShieldCheckIcon, CalendarDaysIcon,
  ClockIcon, ExclamationTriangleIcon, DocumentTextIcon, XCircleIcon, ChevronRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import '../common/LeadWorkspacePage.css';
import './CollectionWorkspace.css';

// Booking list tabs — full label on desktop, short label on mobile (mobile-compact-tabs).
const BOOKING_TABS = [
  { value: 'All', label: 'All', short: 'All' },
  { value: 'Active', label: 'Active', short: 'Active' },
  { value: 'Today Follow-up', label: 'Today Follow-up', short: 'Today' },
  { value: 'Missed Follow-up', label: 'Missed Follow-up', short: 'Missed' },
  { value: 'Cancelled', label: 'Cancelled', short: 'Cancelled' },
];

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
  const [statusRemarks, setStatusRemarks] = useState('');
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelReasons, setCancelReasons] = useState([]);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [paymentModeOptions, setPaymentModeOptions] = useState([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  // Payment form
  const [payForm, setPayForm] = useState({ payment_type: '', payment_category: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', bank_id: '', remarks: '' });
  const [paySaving, setPaySaving] = useState(false);
  // Payment status form
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentStatusId, setPaymentStatusId] = useState('');
  const [paymentStatusOptions, setPaymentStatusOptions] = useState([]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [payStatusRemarks, setPayStatusRemarks] = useState('');
  const [payStatusPaymentDate, setPayStatusPaymentDate] = useState('');
  const [payStatusRegDate, setPayStatusRegDate] = useState('');
  const [payStatusSaving, setPayStatusSaving] = useState(false);
  const [expandedMobileBookingId, setExpandedMobileBookingId] = useState(null);
  // Activity history
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // Workflow state
  const [workflowMode, setWorkflowMode] = useState(null); // 'register' | 'emi' | 'requestCancel' | 'confirmCancel'
  const [workflowBooking, setWorkflowBooking] = useState(null);
  const [registerForm, setRegisterForm] = useState({ registration_date: '', registration_number: '' });
  const [registerFiles, setRegisterFiles] = useState([]);
  const [registerSaving, setRegisterSaving] = useState(false);
  const [emiRemarks, setEmiRemarks] = useState('');
  const [emiSaving, setEmiSaving] = useState(false);
  const [reqCancelSaving, setReqCancelSaving] = useState(false);
  const [confirmCancelSaving, setConfirmCancelSaving] = useState(false);
  // Refund forms (used by confirmCancel + standalone refund modes)
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
  // Display-only label overrides; stored payment_category value is unchanged.
  const CATEGORY_LABELS = { 'Registration Expenses': 'Regn Misc. Expenses' };
  const categoryLabel = (cat) => CATEGORY_LABELS[cat] || cat;

  // Build per-category buckets (target + paid) for the drawer booking
  const getDrawerCategoryBuckets = (booking) => {
    if (!booking) return [];
    const toAmount = (v) => {
      const n = parseFloat(v || 0);
      return Number.isFinite(n) ? n : 0;
    };
    const sumSplit = (split) => Object.values(split || {}).reduce((s, v) => s + toAmount(v), 0);
    const cb = booking.custom_fields?.cost_breakdown || {};
    const regSplitTotal = sumSplit(cb.registration_split);
    const modtSplitTotal = cb.modt_enabled ? sumSplit(cb.modt_split) : 0;
    const plotTarget = toAmount(booking.plot_value || booking.base_price);
    const stampTarget = toAmount(booking.stamp_value || booking.stamp_duty);
    const regSplit = cb.registration_split || {};
    const regExpensesTarget = toAmount(regSplit.registration_expenses);
    const otherRegExpensesTarget = toAmount(regSplit.other_registration_expenses);
    // Registration bucket excludes the two broken-out expense buckets (no double count).
    const registrationTarget = toAmount(booking.registration_exp || booking.registration_charges)
      + (regSplitTotal - regExpensesTarget - otherRegExpensesTarget);
    const developmentTarget = toAmount(booking.development_charges);
    const modtTarget = modtSplitTotal;
    const paidByCategory = (booking.payments || []).reduce((acc, p) => {
      if (p.is_bounced) return acc;
      const cat = p.payment_category || 'Other';
      acc[cat] = (acc[cat] || 0) + toAmount(p.amount);
      return acc;
    }, {});
    return [
      { key: 'Plot Value', target: plotTarget, paid: paidByCategory['Plot Value'] || 0 },
      { key: 'Stamp Duty', target: stampTarget, paid: paidByCategory['Stamp Duty'] || 0 },
      { key: 'Registration', target: registrationTarget, paid: paidByCategory['Registration'] || 0 },
      { key: 'Registration Expenses', target: regExpensesTarget, paid: paidByCategory['Registration Expenses'] || 0 },
      { key: 'Other Registration Expenses', target: otherRegExpensesTarget, paid: paidByCategory['Other Registration Expenses'] || 0 },
      { key: 'Development', target: developmentTarget, paid: paidByCategory['Development'] || 0 },
      { key: 'MODT', target: modtTarget, paid: paidByCategory['MODT'] || 0 },
      { key: 'Other', target: 0, paid: paidByCategory['Other'] || 0 },
    ];
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (activeTab === 'Active' || activeTab === 'Today Follow-up' || activeTab === 'Missed Follow-up') params.is_cancelled = 'false';
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

  // Send a draft "Booking Open" booking to the Super Admin for approval.
  const [sendingId, setSendingId] = useState(null);
  const [confirmBooking, setConfirmBooking] = useState(null);
  const handleSendForApproval = (booking, e) => {
    if (e) e.stopPropagation();
    setConfirmBooking(booking);
  };
  const doSendForApproval = async () => {
    const booking = confirmBooking;
    if (!booking) return;
    setSendingId(booking.id);
    try {
      await bookingApi.sendForApproval(booking.id);
      toast.success('Booking sent for approval');
      setConfirmBooking(null);
      loadBookings();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send for approval'));
    } finally {
      setSendingId(null);
    }
  };
  useEffect(() => {
    bookingStatusApi.getDropdown().then(r => setStatusOptions(r.data?.data || r.data || [])).catch(() => {});
    paymentStatusApi.getDropdown().then(r => setPaymentStatusOptions(r.data?.data || r.data || [])).catch(() => {});
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
    // "Booking Open" drafts live on the New Bookings screen until Collection
    // sends them for approval — exclude them from the main bookings list.
    let list = bookings.filter((b) => b.status_code !== 'BOOKING_OPEN');
    // Follow-up tab filtering
    if (activeTab === 'Today Follow-up') {
      const todayStr = new Date().toISOString().slice(0, 10);
      list = list.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) === todayStr);
    } else if (activeTab === 'Missed Follow-up') {
      const todayStr = new Date().toISOString().slice(0, 10);
      list = list.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) < todayStr);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((b) =>
      (b.booking_number || '').toLowerCase().includes(q) ||
      (b.customer_name || '').toLowerCase().includes(q) ||
      (b.project_name || '').toLowerCase().includes(q) ||
      (b.unit_display || b.unit_number || '').toLowerCase().includes(q) ||
      (b.buyer_name || '').toLowerCase().includes(q)
    );
  }, [bookings, searchQuery, activeTab]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filteredBookings, 25);

  // Follow-up counts for tab badges
  const todayFollowUpCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return bookings.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) === todayStr).length;
  }, [bookings]);
  const missedFollowUpCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return bookings.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) < todayStr).length;
  }, [bookings]);

  const quickStatusOptions = statusOptions.filter((status) => QUICK_STATUS_CODES.includes(status.status_code));

  const renderQuickActions = (booking, mobile = false) => (
    <div className={`col-qa-actions ${mobile ? 'col-qa-actions--mobile' : ''}`} onClick={mobile ? (e) => e.stopPropagation() : undefined}>
      <button className="col-qa-btn col-qa-view" title="View Details" onClick={() => onSelectBooking(booking.id)}>
        <EyeIcon style={{ width: 15, height: 15 }} />
      </button>
      {booking.status_code !== 'BOOKING_OPEN' && (
        <button className="col-qa-btn col-qa-pay" title="Record Payment" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'pay'); }}>
          <BanknotesIcon style={{ width: 15, height: 15 }} />
        </button>
      )}
      {booking.status_code === 'BOOKING_OPEN' && (
        <button className="col-qa-btn" title="Send for Approval" style={{ color: '#2563EB' }} disabled={sendingId === booking.id} onClick={(e) => handleSendForApproval(booking, e)}>
          <CheckCircleIcon style={{ width: 15, height: 15 }} />
        </button>
      )}
      <button className="col-qa-btn col-qa-status" title="Update Payment Status" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'payStatus'); }}>
        <CreditCardIcon style={{ width: 15, height: 15 }} />
      </button>
      <button className="col-qa-btn col-qa-status" title="Update Booking Status" onClick={(e) => { e.stopPropagation(); openDrawer(booking, 'status'); }}>
        <PencilSquareIcon style={{ width: 15, height: 15 }} />
      </button>
      {['BOOKED', 'TOKEN_RECEIVED', 'FORM_SUBMITTED', 'AGREEMENT_DRAFT', 'AGREEMENT_SIGNED'].includes(booking.status_code) && (
        <>
          <button className="col-qa-btn" title="Register" style={{ color: '#22C55E' }} onClick={(e) => { e.stopPropagation(); openWorkflow(booking, 'register'); }}>
            <DocumentTextIcon style={{ width: 15, height: 15 }} />
          </button>
          <button className="col-qa-btn" title="EMI" style={{ color: '#F59E0B' }} onClick={(e) => { e.stopPropagation(); openWorkflow(booking, 'emi'); }}>
            <CreditCardIcon style={{ width: 15, height: 15 }} />
          </button>
        </>
      )}
      {['BOOKING_OPEN', 'BOOKING_PENDING', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'BOOKED', 'REGISTERED', 'EMI', 'TOKEN_RECEIVED', 'FORM_SUBMITTED', 'AGREEMENT_DRAFT', 'AGREEMENT_SIGNED'].includes(booking.status_code) && (
        <button className="col-qa-btn" title="Request Cancel" style={{ color: '#EF4444' }} onClick={(e) => { e.stopPropagation(); openWorkflow(booking, 'requestCancel'); }}>
          <ExclamationTriangleIcon style={{ width: 15, height: 15 }} />
        </button>
      )}
      {booking.status_code === 'REQUEST_TO_CANCEL' && booking.custom_fields?.cancel_approved_by && (
        <button className="col-qa-btn" title="Confirm Cancel" style={{ color: '#DC2626' }} onClick={(e) => { e.stopPropagation(); openWorkflow(booking, 'confirmCancel'); }}>
          <XCircleIcon style={{ width: 15, height: 15 }} />
        </button>
      )}
      {booking.status_code === 'REQUEST_TO_CANCEL' && !booking.custom_fields?.cancel_approved_by && (
        <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>Awaiting SH</span>
      )}
      {booking.is_cancelled && parseFloat(booking.total_paid || 0) > 0 && (
        <button className="col-qa-btn" title={`Process Refund (${formatCurrency(booking.total_paid || 0)} pending)`} style={{ color: '#F59E0B' }} onClick={(e) => { e.stopPropagation(); openWorkflow(booking, 'refund'); }}>
          <BanknotesIcon style={{ width: 15, height: 15 }} />
        </button>
      )}
    </div>
  );

  // ── Drawer helpers ──
  const openDrawer = (booking, mode) => {
    setDrawerBooking(booking);
    setDrawerMode(mode);
    // Pre-select the current booking status whenever the status modal opens
    const selectedStatusId = mode === 'status' ? String(booking.booking_status_id || '') : '';
    setNewStatusId(selectedStatusId);
    setStatusRemarks('');
    setCancelReasonId(''); setCancelRemarks('');
    setPayForm({ payment_type: '', payment_category: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', bank_id: '', remarks: '' });
    setPaymentStatus(booking.payment_status || '');
    const matched = paymentStatusOptions.find(p => p.status_name === booking.payment_status || p.status_code === booking.payment_status);
    setPaymentStatusId(booking.payment_status_id || matched?.id || '');
    setFollowUpDate(''); setPayStatusRemarks(''); setPayStatusPaymentDate(''); setPayStatusRegDate('');
    // Reset register form so REGISTERED inline form starts clean
    setRegisterForm({ registration_date: '', registration_number: '' });
    setRegisterFiles([]);
    // Load activities
    setActivitiesLoading(true);
    bookingApi.getActivities(booking.id).then(r => setActivities(r.data?.data || r.data || [])).catch(() => {}).finally(() => setActivitiesLoading(false));
  };
  const closeDrawer = () => { setDrawerBooking(null); setDrawerMode(null); setActivities([]); };

  // ── Workflow helpers ──
  const openWorkflow = (booking, mode) => {
    setWorkflowBooking(booking); setWorkflowMode(mode);
    setRegisterForm({ registration_date: '', registration_number: '' }); setRegisterFiles([]);
    setEmiRemarks(''); setCancelReasonId(''); setCancelRemarks('');
    setCancelRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
    setRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
  };
  const closeWorkflow = () => { setWorkflowBooking(null); setWorkflowMode(null); };

  const handleRegister = async () => {
    if (!registerForm.registration_date || !registerForm.registration_number || registerFiles.length === 0) {
      toast.error('All fields are mandatory: Date, Document Number, and Document file'); return;
    }
    setRegisterSaving(true);
    try {
      const formData = new FormData();
      registerFiles.forEach(f => formData.append('documents', f));
      formData.append('registration_date', registerForm.registration_date);
      formData.append('registration_number', registerForm.registration_number);
      await bookingApi.registerBooking(workflowBooking.id, formData);
      toast.success('Booking registered successfully'); closeWorkflow(); loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to register')); }
    finally { setRegisterSaving(false); }
  };

  const handleEMI = async () => {
    if (!emiRemarks.trim()) { toast.error('Remarks are mandatory for EMI'); return; }
    setEmiSaving(true);
    try {
      await bookingApi.updateToEMI(workflowBooking.id, { remarks: emiRemarks });
      toast.success('Booking moved to EMI'); closeWorkflow(); loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setEmiSaving(false); }
  };

  const handleRequestCancel = async () => {
    if (!cancelReasonId) { toast.error('Cancel reason is mandatory'); return; }
    setReqCancelSaving(true);
    try {
      await bookingApi.requestToCancel(workflowBooking.id, { cancel_reason_id: cancelReasonId, cancel_remarks: cancelRemarks });
      toast.success('Cancellation requested — SH will review'); closeWorkflow(); loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setReqCancelSaving(false); }
  };

  const handleConfirmCancel = async () => {
    const totalPaidAmt = parseFloat(workflowBooking?.total_paid || 0);
    const amt = parseFloat(cancelRefundForm.refund_amount || 0);
    if (totalPaidAmt > 0.01) {
      if (Math.abs(amt - totalPaidAmt) > 0.01) {
        toast.error(`Outstanding collected amount of ${formatCurrency(totalPaidAmt)} must be fully refunded to confirm cancellation.`);
        return;
      }
    }
    setConfirmCancelSaving(true);
    try {
      await bookingApi.confirmCancel(workflowBooking.id, amt > 0 ? cancelRefundForm : {});
      toast.success('Booking cancelled and refund recorded');
      setCancelRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
      closeWorkflow();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setConfirmCancelSaving(false); }
  };

  const handleProcessRefund = async () => {
    const totalPaidAmt = parseFloat(workflowBooking?.total_paid || 0);
    const amt = parseFloat(refundForm.refund_amount || 0);
    if (!amt || amt <= 0) { toast.error('Enter a refund amount greater than 0'); return; }
    if (amt > totalPaidAmt + 0.01) { toast.error(`Refund cannot exceed remaining collected (${formatCurrency(totalPaidAmt)})`); return; }
    setRefundSaving(true);
    try {
      await bookingApi.processRefund(workflowBooking.id, refundForm);
      toast.success('Refund recorded');
      setRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
      closeWorkflow();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setRefundSaving(false); }
  };

  const handleStatusUpdate = async () => {
    if (!newStatusId || !drawerBooking) return;

    const selectedStatus = quickStatusOptions.find((s) => String(s.id) === newStatusId);
    if (!selectedStatus) { toast.error('Select a valid status'); return; }

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
        await bookingApi.updateToEMI(drawerBooking.id, { remarks: statusRemarks.trim() });
        toast.success('Booking moved to EMI');
      } else if (selectedStatus.status_code === 'REQUEST_TO_CANCEL') {
        await bookingApi.requestToCancel(drawerBooking.id, {
          cancel_reason_id: cancelReasonId,
          cancel_remarks: cancelRemarks,
        });
        toast.success('Cancellation requested — SH will review');
      } else if (selectedStatus.status_code === 'REGISTERED') {
        const formData = new FormData();
        registerFiles.forEach((f) => formData.append('documents', f));
        formData.append('registration_date', registerForm.registration_date);
        formData.append('registration_number', registerForm.registration_number);
        await bookingApi.registerBooking(drawerBooking.id, formData);
        toast.success('Booking registered');
        setRegisterForm({ registration_date: '', registration_number: '' });
        setRegisterFiles([]);
      } else {
        await bookingApi.update(drawerBooking.id, { booking_status_id: newStatusId });
        toast.success('Booking status updated');
      }

      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update status')); }
    finally { setStatusSaving(false); }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!paymentStatus || !drawerBooking) return;
    
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
      await bookingApi.updatePaymentStatus(drawerBooking.id, payload);
      toast.success('Payment status updated');
      closeDrawer();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update payment status')); }
    finally { setPayStatusSaving(false); }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0 || !drawerBooking) { toast.error('Enter valid amount'); return; }
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
      {/* ── Header (matches My Leads workspace) ── */}
      <header className="lead-workspace__header">
        <div>
          <h1>Bookings</h1>
          <p className="hide-mobile">Manage all property bookings and collections</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={loadBookings} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* ── Toolbar (search) ── */}
      <div className="lead-workspace__toolbar">
        <div className="lead-workspace__toolbar-search">
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings by number, customer, project or unit"
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="crm-card">
        <div className="crm-card-body-flush">
          {/* Tabs + record count — same pill row as My Leads */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
            <div className="filter-tabs mobile-compact-tabs">
              {BOOKING_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`filter-tab ${activeTab === t.value ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.value)}
                >
                  <span className="hide-mobile">{t.label}</span>
                  <span className="show-mobile">{t.short}</span>
                  {t.value === 'Today Follow-up' && todayFollowUpCount > 0 && <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{todayFollowUpCount}</span>}
                  {t.value === 'Missed Follow-up' && missedFollowUpCount > 0 && <span style={{ marginLeft: 4, background: '#EF4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{missedFollowUpCount}</span>}
                </button>
              ))}
              <small className="filter-tabs__records">{filteredBookings.length} record{filteredBookings.length === 1 ? '' : 's'}</small>
            </div>
          </div>

          {loading ? (
            <div className="simple-loader">
              <div className="simple-spinner" />
              <p>Loading...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">{searchQuery ? 'No bookings match your search' : 'No bookings found'}</div>
              <div className="col-empty-desc">{searchQuery ? 'Try a different search term' : 'Bookings from Sales Head will appear here'}</div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th className="show-mobile lead-col-toggle"></th>
                    <th className="lead-col-lead" style={{ width: 'auto' }}>Booking</th>
                    <th className="hide-mobile" style={{ width: 160 }}>Project · Unit</th>
                    <th className="hide-mobile" style={{ width: 120 }}>Net Value</th>
                    <th className="hide-mobile" style={{ width: 110 }}>Progress</th>
                    <th className="lead-col-status">Status</th>
                    <th className="hide-mobile" style={{ width: 130 }}>Payment Status</th>
                    <th className="lead-col-followup" style={{ textAlign: 'right' }}>Follow-up</th>
                    <th className="hide-mobile" style={{ textAlign: 'center', width: 200 }}>Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((booking) => {
                    const pct = booking.payment_percentage || 0;
                    const isExpanded = expandedMobileBookingId === booking.id;
                    const totalValue = getComputedTotalValue(booking);
                    const collected = parseFloat(booking.total_paid || 0);
                    const balance = totalValue - collected;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const fStr = booking.next_follow_up_at ? new Date(booking.next_follow_up_at).toISOString().slice(0, 10) : null;
                    const isToday = fStr === todayStr;
                    const isMissed = fStr && fStr < todayStr;
                    const fuColor = isMissed ? '#EF4444' : isToday ? '#3B82F6' : 'var(--text-muted)';
                    const fuShort = booking.next_follow_up_at
                      ? (isToday ? '📅 Today' : `${isMissed ? '⚠ ' : ''}${new Date(booking.next_follow_up_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`)
                      : '—';
                    const paymentBadge = booking.payment_status ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 12,
                        background: booking.payment_status === 'Full Payment Received' ? '#DCFCE7' : booking.payment_status === 'Follow Up' ? '#FEF3C7' : '#DBEAFE',
                        color: booking.payment_status === 'Full Payment Received' ? '#166534' : booking.payment_status === 'Follow Up' ? '#92400E' : '#1E40AF',
                      }}>{booking.payment_status}</span>
                    ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>;
                    return (
                      <React.Fragment key={booking.id}>
                        <tr>
                          <td className="show-mobile lead-col-toggle" style={{ padding: '10px 0', textAlign: 'center' }}>
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              onClick={(e) => { e.stopPropagation(); setExpandedMobileBookingId(isExpanded ? null : booking.id); }}
                              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                            >
                              {isExpanded ? <ChevronDownIcon style={{ width: 14, height: 14 }} /> : <ChevronRightIcon style={{ width: 14, height: 14 }} />}
                            </button>
                          </td>
                          <td className="lead-col-lead">
                            <p className="lead-title">{booking.customer_name || booking.buyer_name || '-'}</p>
                            <small>
                              <button type="button" className="col-booking-link" onClick={(e) => { e.stopPropagation(); onSelectBooking(booking.id); }}>
                                {booking.booking_number}
                              </button>
                            </small>
                          </td>
                          <td className="hide-mobile">
                            <p className="lead-title">{booking.project_name || '-'}</p>
                            <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Unit: {booking.unit_display || booking.unit_number || 'TBD'}</small>
                          </td>
                          <td className="hide-mobile" style={{ fontWeight: 600 }}>{formatCurrency(totalValue)}</td>
                          <td className="hide-mobile" style={{ minWidth: 90 }}>
                            <div className="col-progress" style={{ height: 6, width: '100%' }}>
                              <div className={`col-progress-bar ${getProgressClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{pct}%</div>
                          </td>
                          <td className="lead-col-status">
                            <span className="col-badge" style={{ background: `${booking.status_color}22`, color: booking.status_color }}>
                              <span className="col-badge-dot" style={{ background: booking.status_color }} />
                              {booking.status_label}
                            </span>
                          </td>
                          <td className="hide-mobile">{paymentBadge}</td>
                          <td className="lead-col-followup" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: fuColor }}>{fuShort}</span>
                          </td>
                          <td className="hide-mobile">
                            {renderQuickActions(booking)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="lead-workspace__expanded-row show-mobile">
                            <td colSpan={4}>
                              <div className="lead-workspace__expanded-card">
                                <div className="expanded-info-grid">
                                  <div className="expanded-info-item">
                                    <label>Project / Unit</label>
                                    <p>{booking.project_name || '-'}{(booking.unit_display || booking.unit_number) ? ` / ${booking.unit_display || booking.unit_number}` : ''}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Net Value</label>
                                    <p>{formatCurrency(totalValue)}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Collected</label>
                                    <p>{formatCurrency(collected)} · {pct}%</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Balance</label>
                                    <p>{formatCurrency(balance)}</p>
                                  </div>
                                  <div className="expanded-info-item">
                                    <label>Payment Status</label>
                                    <p>{booking.payment_status || '—'}</p>
                                  </div>
                                  {booking.next_follow_up_at && (
                                    <div className="expanded-info-item">
                                      <label>Next Follow-Up</label>
                                      <p style={{ display: 'flex', alignItems: 'center', gap: 4, color: fuColor, fontWeight: 600 }}>
                                        <CalendarDaysIcon style={{ width: 14, height: 14 }} />
                                        <span>{new Date(booking.next_follow_up_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}{isToday ? ' · Today' : isMissed ? ' · Missed' : ''}</span>
                                      </p>
                                    </div>
                                  )}
                                  {booking.lead?.lead_number && (
                                    <div className="expanded-info-item">
                                      <label>Lead</label>
                                      <p>{booking.lead.lead_number}</p>
                                    </div>
                                  )}
                                  <div className="expanded-info-item full-width">
                                    <label>Quick Actions</label>
                                    {renderQuickActions(booking, true)}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredBookings.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
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

                  {/* Contextual fields by selected booking status */}
                  {(() => {
                    const sel = quickStatusOptions.find(s => String(s.id) === newStatusId);
                    if (sel?.status_code === 'EMI') {
                      return (
                        <div style={{ marginTop: 14 }}>
                          <label className="qa-drawer-field-label">EMI Remarks *</label>
                          <textarea className="qa-drawer-remark-ta" rows={2} placeholder="Enter EMI remarks"
                            value={statusRemarks} onChange={e => setStatusRemarks(e.target.value)} />
                        </div>
                      );
                    }
                    if (sel?.status_code === 'REGISTERED') {
                      return (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8, padding: 10, fontSize: 12, color: '#166534', marginBottom: 12 }}>
                            <strong>Registration requires document upload.</strong> Fill in the details below and attach the registered document file to complete this status.
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

            {/* ── PAYMENT STATUS UPDATE MODE ── */}
            {drawerMode === 'payStatus' && (
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
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Current follow-up info */}
                  {drawerBooking.next_follow_up_at && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarDaysIcon style={{width:14,height:14}} />
                      Current follow-up: <strong>{new Date(drawerBooking.next_follow_up_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</strong>
                      {drawerBooking.custom_fields?.last_payment_remarks && <span> · {drawerBooking.custom_fields.last_payment_remarks}</span>}
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
                  {(() => {
                    const buckets = getDrawerCategoryBuckets(drawerBooking);
                    const selectedBucket = buckets.find(b => b.key === payForm.payment_category);
                    return (
                      <>
                        <div className="bkd-form-row">
                          <div className="bkd-form-group" style={{ flex: 1 }}>
                            <label className="bkd-form-label">Payment For (Category) *</label>
                            <select className="bkd-form-control" value={payForm.payment_category}
                              onChange={e => setPayForm(p => ({ ...p, payment_category: e.target.value }))}>
                              <option value="">Select what this payment is for</option>
                              {PAYMENT_CATEGORIES.map((cat) => {
                                const bucket = buckets.find(b => b.key === cat);
                                const target = bucket?.target || 0;
                                const paid = bucket?.paid || 0;
                                const balance = Math.max(target - paid, 0);
                                const suffix = target > 0
                                  ? ` — Balance ${formatCurrency(balance)} of ${formatCurrency(target)}`
                                  : (paid > 0 ? ` — Paid ${formatCurrency(paid)}` : '');
                                return <option key={cat} value={cat}>{categoryLabel(cat)}{suffix}</option>;
                              })}
                            </select>
                          </div>
                        </div>
                        {selectedBucket && (() => {
                          const c = CATEGORY_COLORS[selectedBucket.key] || CATEGORY_COLORS.Other;
                          const balance = Math.max(selectedBucket.target - selectedBucket.paid, 0);
                          const pct = selectedBucket.target > 0 ? Math.min(100, Math.round((selectedBucket.paid / selectedBucket.target) * 100)) : 0;
                          return (
                            <div style={{
                              marginBottom: 12, padding: '10px 12px', background: c.bg, border: `1px solid ${c.border}`,
                              borderRadius: 8, color: c.text, fontSize: 12, fontWeight: 600,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span>{categoryLabel(selectedBucket.key)}</span>
                                <span>Target {formatCurrency(selectedBucket.target)} · Paid {formatCurrency(selectedBucket.paid)} · Balance {formatCurrency(balance)}</span>
                              </div>
                              <div style={{ height: 6, background: '#FFFFFF80', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: c.text, transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    );
                  })()}
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
                  <button className="qa-drawer-save-btn" disabled={paySaving || !payForm.amount || !payForm.payment_category || !payForm.payment_type || !payForm.payment_mode_id || (payForm.payment_mode !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim()))} onClick={handleAddPayment}>
                    {paySaving ? 'Saving...' : 'Submit Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ══════════ WORKFLOW MODAL ══════════ */}
      {workflowBooking && workflowMode && (
        <div className="col-modal-overlay" onClick={closeWorkflow}>
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
                  <div className="qa-drawer-meta">{workflowBooking.booking_number} · {workflowBooking.customer_name || workflowBooking.buyer_name}</div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={closeWorkflow}>×</button>
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
                  <input type="file" className="bkd-form-control" multiple
                    onChange={e => setRegisterFiles(Array.from(e.target.files || []))} />
                  {registerFiles.length > 0 && <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>{registerFiles.map(f => f.name).join(', ')}</div>}
                </div>
                <div className="qa-drawer-save-row" style={{ marginTop: 16 }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#22C55E' }} disabled={registerSaving} onClick={handleRegister}>
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
                  <button className="qa-drawer-save-btn" style={{ background: '#F59E0B' }} disabled={emiSaving || !emiRemarks.trim()} onClick={handleEMI}>
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
                  <button className="qa-drawer-save-btn" style={{ background: '#EF4444' }} disabled={reqCancelSaving || !cancelReasonId} onClick={handleRequestCancel}>
                    {reqCancelSaving ? 'Submitting...' : 'Request Cancellation'}
                  </button>
                </div>
              </div>
            )}

            {workflowMode === 'confirmCancel' && (() => {
              const totalPaidAmt = parseFloat(workflowBooking?.total_paid || 0);
              return (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ background: '#FEE2E2', border: '1px solid #EF444444', borderRadius: 8, padding: 16, marginBottom: 16, fontSize: 13 }}>
                  <strong>⚠ Confirm Cancellation</strong>
                  <p style={{ margin: '8px 0 0', color: '#991B1B' }}>SH has approved this cancellation. This action is permanent: the booking is cancelled, the unit is released back to <strong>Available</strong>, and the lead is moved to <strong>Lost</strong>.</p>
                </div>

                <div style={{ background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Collected</span>
                    <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaidAmt)}</strong>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  Refund (required — must equal total collected amount)
                </div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Amount (₹)</label>
                    <input type="number" min="0" max={totalPaidAmt} className="bkd-form-control"
                      placeholder={`Up to ${formatCurrency(totalPaidAmt)}`}
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
                  <button className="qa-drawer-save-btn" style={{ background: '#DC2626' }} disabled={confirmCancelSaving} onClick={handleConfirmCancel}>
                    {confirmCancelSaving ? 'Processing...' : 'Confirm Cancel Booking'}
                  </button>
                </div>
              </div>
              );
            })()}

            {workflowMode === 'refund' && (() => {
              const totalPaidAmt = parseFloat(workflowBooking?.total_paid || 0);
              return (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: '#92400E' }}>
                  <strong>Record Refund Payment</strong>
                  <p style={{ margin: '6px 0 0' }}>Use this when the refund is paid out after the booking was already cancelled (split refunds, delayed payouts).</p>
                </div>

                <div style={{ background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Remaining collected (refundable)</span>
                    <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaidAmt)}</strong>
                  </div>
                </div>

                <div className="bkd-form-row">
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Refund Amount (₹) *</label>
                    <input type="number" min="0" max={totalPaidAmt} className="bkd-form-control"
                      placeholder={`Up to ${formatCurrency(totalPaidAmt)}`}
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
                    onClick={handleProcessRefund}>
                    {refundSaving ? 'Recording...' : 'Record Refund'}
                  </button>
                </div>
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Send-for-approval confirmation modal */}
      {confirmBooking && (
        <div onClick={() => sendingId === null && setConfirmBooking(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: 'min(100%, 440px)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-blue-bg, #eff4ff)', color: 'var(--accent-blue, #2563eb)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircleIcon style={{ width: 18, height: 18 }} />
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Send for approval</h3>
            </div>
            <div style={{ padding: 20, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Send booking <strong style={{ color: 'var(--text-primary)' }}>{confirmBooking.booking_number}</strong>
              {' '}({confirmBooking.customer_name || confirmBooking.buyer_name || 'customer'}) for Super Admin approval?
              The unit will be <strong style={{ color: 'var(--text-primary)' }}>reserved</strong>.
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setConfirmBooking(null)} disabled={sendingId === confirmBooking.id}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={doSendForApproval} disabled={sendingId === confirmBooking.id}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-blue, #2563eb)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckCircleIcon style={{ width: 14, height: 14 }} /> {sendingId === confirmBooking.id ? 'Sending…' : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionBookings;
