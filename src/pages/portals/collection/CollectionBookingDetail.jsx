import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';
import paymentPlanApi from '../../../api/paymentPlanApi';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import userApi from '../../../api/userApi';
import VoiceNoteField from '../../../components/common/VoiceNoteField';
import RecordPaymentModal from '../../../components/common/RecordPaymentModal';
import DangerDeleteModal from '../../../components/common/DangerDeleteModal';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { getRoleCode } from '../../../utils/permissions';
import { ROLE_CODES } from '../../../utils/constants';
import GenerateBookingFormModal from './GenerateBookingFormModal';
import termsAndConditionsApi from '../../../api/termsAndConditionsApi';
import {
  ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, CreditCardIcon,
  BanknotesIcon, UserIcon, ClockIcon,
  ExclamationTriangleIcon, PlusIcon,
  CheckCircleIcon, CalendarDaysIcon, ClipboardDocumentListIcon, ShieldCheckIcon,
  DocumentTextIcon, CloudArrowUpIcon, ArrowDownTrayIcon, FolderOpenIcon, XCircleIcon, EyeIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { badgeColors } from '../../../utils/badgeColors';
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

const BkdStatCell = ({ label, value, border = true }) => {
  return (
    <div style={{
      flex: 1,
      padding: "10px 14px",
      borderRight: border ? "1px solid var(--col-border, #e2e8f0)" : "none",
      minWidth: 120,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
        color: "var(--col-text, #000000)", textTransform: "uppercase", marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 600, color: "var(--col-text, #000000)",
        fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
      }}>{value}</div>
    </div>
  );
};

const BkdLedgerRow = ({ label, note, valueText, indent = 0, onClick, expandIcon }) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 4px", paddingLeft: 4 + indent,
        borderBottom: "1px solid var(--col-border, #e2e8f0)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500,
            color: "var(--col-text, #000000)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}>
            {label}
            {expandIcon}
          </div>
          {note && (
            <div style={{ fontSize: 12, color: "var(--col-text, #000000)", marginTop: 1 }}>{note}</div>
          )}
        </div>
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600,
        color: "var(--col-text, #000000)", fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap", marginLeft: 12,
      }}>{valueText}</div>
    </div>
  );
};


// Deterministic avatar colour + initials (shared look with the task assignee UI).
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
const colorFor = (id) => {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
const initialsOf = (u) => `${(u?.first_name || '?')[0] || ''}${(u?.last_name || '')[0] || ''}`.toUpperCase();
const execName = (u) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || 'Executive';

const CollectionBookingDetail = ({ user, bookingId, onBack }) => {
  const [booking, setBooking] = useState(null);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [actionMode, setActionMode] = useState(null); // 'pay' | 'status' | 'payStatus' | 'devCost'
  const [activeTab, setActiveTab] = useState('payment-history');
  const [showDeleteBooking, setShowDeleteBooking] = useState(false);
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
  const [smPointsValue, setSmPointsValue] = useState('');
  const [shPointsValue, setShPointsValue] = useState('');
  // Payment editing — reuses the rich Record-Payment modal, prefilled. Only
  // pending/unverified (and non-refund/non-bounced) payments are editable.
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  // Verified / rejected / refund payments aren't editable, but can be opened
  // read-only in the same rich modal (matches the Payments page view).
  const [viewPaymentId, setViewPaymentId] = useState(null);
  const [regExpanded, setRegExpanded] = useState(false);
  // Super-Admin approve / reject (from the detail page)
  const [approvalAction, setApprovalAction] = useState(null); // 'approve' | 'reject'
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalSaving, setApprovalSaving] = useState(false);
  // Generate Booking Form modal (multi-account plot/dev amount split → PDF).
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
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

  // ── Assign to Collection Executives (Collection Manager, multi-assign) ──
  const [assignOpen, setAssignOpen] = useState(false);
  const [executives, setExecutives] = useState([]);
  const [selectedExecIds, setSelectedExecIds] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [assignAddOpen, setAssignAddOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const assignAddRef = useRef(null);
  useEffect(() => {
    if (!assignAddOpen) return undefined;
    const onDoc = (e) => { if (assignAddRef.current && !assignAddRef.current.contains(e.target)) setAssignAddOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [assignAddOpen]);
  const openAssign = () => {
    const current = (booking?.collectionExecutives || []).map((e) => String(e.id));
    setSelectedExecIds(current.length ? current : (booking?.collection_executive_id ? [String(booking.collection_executive_id)] : []));
    setAssignOpen(true);
    bookingApi.getCollectionExecutives()
      .then((r) => setExecutives(r.data?.data || r.data || []))
      .catch(() => setExecutives([]));
  };
  const toggleExec = (id) => {
    const key = String(id);
    setSelectedExecIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };
  const handleAssignExecutive = async () => {
    setAssigning(true);
    try {
      await bookingApi.assignCollectionExecutive(bookingId, { collection_executive_ids: selectedExecIds });
      toast.success(selectedExecIds.length ? 'Collection Executives assigned' : 'Assignment cleared');
      setAssignOpen(false);
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to assign'));
    } finally {
      setAssigning(false);
    }
  };

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
  const [registerForm, setRegisterForm] = useState({ registration_date: '' });
  const [registerSaving, setRegisterSaving] = useState(false);
  const [emiRemarks, setEmiRemarks] = useState('');
  const [emiSaving, setEmiSaving] = useState(false);
  const [reqCancelSaving, setReqCancelSaving] = useState(false);
  const [confirmCancelSaving, setConfirmCancelSaving] = useState(false);
  const [revertRemarks, setRevertRemarks] = useState('');
  const [revertSaving, setRevertSaving] = useState(false);
  const [cancelRefundForm, setCancelRefundForm] = useState({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
  const [refundForm, setRefundForm] = useState({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
  const [refundSaving, setRefundSaving] = useState(false);

  const QUICK_STATUS_CODES = ['BOOKED', 'REGISTERED', 'EMI', 'REQUEST_TO_CANCEL'];
  const PAYMENT_CATEGORIES = ['Plot Value', 'Stamp Duty', 'Development', 'Registration', 'Registration Expenses', 'Other Registration Expenses', 'MODT', 'Other'];
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
  // Display-only label overrides for the Record Payment modal. The stored
  // payment_category value is kept unchanged (e.g. 'Registration Expenses') so
  // existing payments, per-category buckets, colors, and the backend keep working.
  const CATEGORY_LABELS = {
    'Registration': 'Registration Fees',
    'Registration Expenses': 'Registration Expenses',
  };
  const categoryLabel = (cat) => CATEGORY_LABELS[cat] || cat;

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
    termsAndConditionsApi.getDropdown().then(r => setTerms(r.data?.data || r.data || [])).catch(() => {});
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
    const roleCode = person.userType?.short_code || person.user_type?.short_code || person.short_code;
    return roleCode ? `${name} (${roleCode})` : name;
  };

  const leadAssignee = booking?.lead?.assignedTo || null;
  const previousLeadAssignee = booking?.lead?.previousAssignedToUser || null;
  const paymentPlanLabel = booking?.paymentPlan?.plan_name || paymentPlans.find((plan) => String(plan.id) === String(booking?.payment_plan_id))?.plan_name || '—';
  const paymentPlanType = booking?.paymentPlan?.plan_type || paymentPlans.find((plan) => String(plan.id) === String(booking?.payment_plan_id))?.plan_type || '';
  const quickStatusOptions = statusOptions.filter((status) => QUICK_STATUS_CODES.includes(status.status_code));
  const isCancelStatusCode = (code) => ['CANCEL', 'CANCELLED'].includes(code);
  // "Cancelled" is offered in the status grid ONLY once SH has approved (or the
  // 7-day window auto-approved) the cancellation request. There is no direct
  // cancel — it always goes through the approval gate, and the full collected
  // amount must be refunded before it can be applied (enforced below + server-side).
  const cancelApprovedForGrid = (booking?.bookingStatus?.status_code || booking?.status_code) === 'REQUEST_TO_CANCEL'
    && !!booking?.custom_fields?.cancel_approved_by;
  const cancelStatusOption = statusOptions.find((s) => isCancelStatusCode(s.status_code));
  const statusGridOptions = cancelApprovedForGrid && cancelStatusOption
    ? [...quickStatusOptions, cancelStatusOption]
    : quickStatusOptions;

  // The actual SM/SH who handled this lead — resolved from assignment history by the
  // API (booking.salesManager / booking.salesHead). Fall back to the reports_to chain.
  const salesManager = booking?.salesManager || leadAssignee?.manager || null;
  const salesHead = booking?.salesHead || salesManager?.manager || null;

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
      setRegisterForm({ registration_date: '' });
      setCancelRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
      setSmPointsValue('');
      setShPointsValue('');
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
      setEditingPaymentId(null);
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

  const closeActionModal = () => { setActionMode(null); setEditingPaymentId(null); };

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
      const payload = { ...payForm, payment_mode: selectedModeName, amount: parseFloat(payForm.amount) };
      if (editingPaymentId) {
        await bookingApi.updatePayment(bookingId, editingPaymentId, payload);
        toast.success('Payment updated');
      } else {
        await bookingApi.addPayment(bookingId, payload);
        toast.success('Payment recorded');
      }
      closeActionModal();
      setPayForm({ payment_type:'', payment_category:'', payment_mode_id:'', payment_mode:'', amount:'', payment_date:'', transaction_ref:'', bank_id:'', remarks:'' });
      loadBooking();
      loadActivities();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setPaySaving(false); }
  };

  // Only pending/unverified, non-refund, non-bounced payments can be edited.
  const canEditThisPayment = (p) => !!p && !p.is_refund && !p.is_bounced && !p.is_verified;

  // Edit reuses the rich Record-Payment modal, prefilled with the payment.
  const openEditPayment = (p) => {
    if (!canEditThisPayment(p)) return;
    setEditingPaymentId(p.id);
    setActionMode('pay');
    setPayForm({
      payment_type: p.payment_type || '',
      payment_category: p.payment_category || '',
      payment_mode_id: p.payment_mode_id || '',
      payment_mode: p.payment_mode || '',
      amount: p.amount ?? '',
      payment_date: p.payment_date ? String(p.payment_date).slice(0, 10) : '',
      transaction_ref: p.transaction_ref || p.utr_number || p.cheque_dd_number || '',
      bank_id: p.bank_id || '',
      remarks: p.remarks || '',
    });
  };

  const handleApproveBooking = async () => {
    setApprovalSaving(true);
    try {
      await bookingApi.approveBooking(bookingId);
      toast.success('Booking approved');
      setApprovalAction(null);
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to approve booking'));
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleRejectBooking = async () => {
    if (!approvalRemarks.trim()) { toast.error('Rejection remarks are required'); return; }
    setApprovalSaving(true);
    try {
      await bookingApi.rejectBooking(bookingId, { remarks: approvalRemarks.trim() });
      toast.success('Booking rejected');
      setApprovalAction(null);
      setApprovalRemarks('');
      loadBooking();
      loadActivities();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reject booking'));
    } finally {
      setApprovalSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatusId) return;
    const selectedStatus = statusGridOptions.find((s) => String(s.id) === newStatusId);
    if (!selectedStatus) {
      toast.error('Select a valid status');
      return;
    }

    // ── Cancelled: only from an SH-approved request, only once fully refunded ──
    // Routed through confirmCancel so the approval + refund gates are enforced
    // server-side too (never a direct status flip to Cancelled).
    if (isCancelStatusCode(selectedStatus.status_code)) {
      const paid = parseFloat(booking?.total_paid || 0);
      const amt = parseFloat(cancelRefundForm.refund_amount || 0);
      if (paid > 0.01 && Math.abs(amt - paid) > 0.01) {
        toast.error(`Outstanding collected amount of ${formatCurrency(paid)} must be fully refunded before cancelling.`);
        return;
      }
      setStatusSaving(true);
      try {
        await bookingApi.confirmCancel(bookingId, amt > 0 ? cancelRefundForm : {});
        toast.success(amt > 0 ? 'Booking cancelled and refund recorded' : 'Booking cancelled');
        setCancelRefundForm({ refund_amount: '', refund_mode_id: '', refund_reference: '', refund_date: '', refund_remarks: '' });
        closeActionModal();
        loadBooking();
        loadActivities();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to cancel booking'));
      } finally {
        setStatusSaving(false);
      }
      return;
    }
    if (selectedStatus.status_code === 'REGISTERED') {
      if (!registerForm.registration_date) {
        toast.error('Registration date is required');
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
        formData.append('registration_date', registerForm.registration_date);
        await bookingApi.registerBooking(bookingId, formData);
        toast.success('Booking registered');
        setRegisterForm({ registration_date: '' });
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
    if (guideline <= 0 || area <= 0) {
      toast.error('Enter valid Guideline Value and Plot Area');
      return;
    }
    const cleanSplit = (split) => Object.fromEntries(
      Object.entries(split).map(([k, v]) => [k, parseFloat(v) || 0])
    );
    // Stamp Commission always saved as 1% of Stamp Value (7% of Plot Value).
    const savedStampCommission = Math.round(Math.ceil((guideline * area) / 100) * 100 * 0.07 * 0.01);
    setDevCostSaving(true);
    try {
      await bookingApi.updateDevelopmentCost(bookingId, {
        guideline_value: guideline,
        plot_area: area,
        development_cost_per_sqft: perSqft,
        registration_split: { ...cleanSplit(devCostForm.registration_split), stamp_commission: savedStampCommission },
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
  // Show the STORED booking values first — they are what was actually billed
  // and collected against — and only fall back to the guideline × area formula
  // (Plot = ROUNDUP(rate × sqft, -2); Stamp 7%; Registration 2%) when a stored
  // value is missing. Recomputing over stored values drifts from total_paid
  // whenever the stored charges used different rounding or manual amounts.
  // Registration does NOT hide or zero any of these — the full breakdown stays
  // visible for the life of the booking.
  const guidelineRate = toAmount(booking.guideline_value);
  const plotAreaSqft = toAmount(booking.plot_area);
  const perSqftCost = toAmount(booking.development_cost_per_sqft);
  const formulaPlotValue = (guidelineRate > 0 && plotAreaSqft > 0)
    ? Math.ceil((guidelineRate * plotAreaSqft) / 100) * 100
    : 0;
  const plotValue = toAmount(booking.plot_value) > 0
    ? toAmount(booking.plot_value)
    : (formulaPlotValue > 0 ? formulaPlotValue : toAmount(booking.base_price || booking.total_amount || booking.net_amount));
  const storedStampValue = toAmount(booking.stamp_value || booking.stamp_duty);
  const storedRegistrationValue = toAmount(booking.registration_exp || booking.registration_charges);
  const stampValue = storedStampValue > 0 ? storedStampValue : plotValue * 0.07;
  const registrationValue = storedRegistrationValue > 0 ? storedRegistrationValue : plotValue * 0.02;
  const developmentValue = toAmount(booking.development_charges) > 0
    ? toAmount(booking.development_charges)
    : ((perSqftCost > 0 && plotAreaSqft > 0) ? Math.round(plotAreaSqft * perSqftCost * 1.18) : 0);

  // Detailed split + optional MODT stored in custom_fields.cost_breakdown
  const sumSplit = (split) => Object.values(split || {}).reduce((sum, v) => sum + toAmount(v), 0);
  const labelize = (k) => categoryLabel(k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  const costBreakdown = booking.custom_fields?.cost_breakdown || {};
  // Stamp Commission: use the stored split value (what was billed); only derive
  // 1% of Stamp Value when nothing was stored.
  const storedStampCommission = toAmount((costBreakdown.registration_split || {}).stamp_commission);
  const computedStampCommission = storedStampCommission > 0 ? storedStampCommission : Math.round(stampValue * 0.01);
  const savedRegSplit = { ...(costBreakdown.registration_split || {}), stamp_commission: computedStampCommission };
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

  // Every payment category stays available after registration — nothing is
  // hidden from the Add Payment dropdown or the progress bars.
  const filteredCategories = PAYMENT_CATEGORIES.filter(cat => {
    if (cat === 'MODT') {
      return savedModtEnabled || (paidByCategory['MODT'] > 0);
    }
    if (cat === 'Other') {
      return false;
    }
    return true;
  });
  // Registration charges break into three independently-collected buckets (no
  // double-counting — grand total is unchanged):
  //   • Registration            → the base 2% legal charge only.
  //   • Registration Expenses    → ONE combined bar for all of the misc split
  //                                items (Stamp Commission, Regn Misc. Expenses,
  //                                Writer Expenses, Patta Charges, …) EXCEPT
  //                                "Other Registration Expenses".
  //   • Other Registration Expenses → its own separate bar.
  const otherRegExpensesTarget = toAmount(savedRegSplit.other_registration_expenses);
  const regMiscExpensesTarget = regSplitTotal - toAmount(savedRegSplit.other_registration_expenses);
  const registrationTarget = registrationValue;
  const categoryBuckets = [
    { key: 'Plot Value', target: plotValue, paid: paidByCategory['Plot Value'] || 0 },
    { key: 'Stamp Duty', target: stampValue, paid: paidByCategory['Stamp Duty'] || 0 },
    { key: 'Development', target: developmentValue, paid: paidByCategory['Development'] || 0 },
    { key: 'Registration', target: registrationTarget, paid: paidByCategory['Registration'] || 0 },
    { key: 'Registration Expenses', target: regMiscExpensesTarget, paid: paidByCategory['Registration Expenses'] || 0 },
    { key: 'Other Registration Expenses', target: otherRegExpensesTarget, paid: paidByCategory['Other Registration Expenses'] || 0 },
    { key: 'MODT', target: modtSplitTotal, paid: paidByCategory['MODT'] || 0 },
    { key: 'Other', target: 0, paid: paidByCategory['Other'] || 0 },
  ];

  const isCollectionManager = getRoleCode(user) === ROLE_CODES.COLLECTION;
  const canEditPayments = getRoleCode(user) === ROLE_CODES.SUPER_ADMIN;
  // Permanent booking delete is restricted to Super Admin / Admin.
  const canDeleteBooking = [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN].includes(getRoleCode(user));
  const devCostGuidelineValue = toAmount(devCostForm.guideline_value || booking.guideline_value);
  const devCostPlotAreaValue = toAmount(devCostForm.plot_area || booking.plot_area);
  const devCostPerSqftValue = toAmount(devCostForm.development_cost_per_sqft || booking.development_cost_per_sqft);
  // Plot Value = ROUNDUP(rate × sqft, -2) — nearest 100; Stamp (7%) & Registration (2%) exact, no rounding.
  const previewPlotValue = Math.ceil((devCostGuidelineValue * devCostPlotAreaValue) / 100) * 100;
  const previewStampValue = previewPlotValue * 0.07;
  const previewRegistrationValue = previewPlotValue * 0.02;
  const previewDevelopmentValue = Math.round((devCostPlotAreaValue * devCostPerSqftValue) * 1.18);
  // Stamp Commission auto-derives from the previewed Stamp Value (1%).
  const previewStampCommission = Math.round(previewStampValue * 0.01);
  const previewRegSplit = { ...devCostForm.registration_split, stamp_commission: previewStampCommission };
  const previewRegSplitTotal = sumSplit(previewRegSplit);
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

  // Cancel-approved status override — show "Cancel Pending" once SH approves the cancellation request
  // (the booking is only truly "Cancelled" after Collection finalizes the refund/cancellation)
  const isCancelApproved = (booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && !!booking.custom_fields?.cancel_approved_by;
  const effectiveStatusLabel = isCancelApproved ? 'Cancel Pending' : booking.status_label;
  const effectiveStatusColor = isCancelApproved ? '#C2410C' : booking.status_color;
  const effectiveStatusBadge = badgeColors(effectiveStatusColor);

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
                    act.activity_type === 'PAYMENT_RECORDED' ? '#10B98122' :
                    act.activity_type === 'POINTS_AWARDED' ? '#EAB30822' : '#6B728022',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: act.activity_type === 'STATUS_CHANGE' ? '#3B82F6' :
                    act.activity_type === 'PAYMENT_STATUS_CHANGE' ? '#6366F1' :
                    act.activity_type === 'PAYMENT_RECORDED' ? '#10B981' :
                    act.activity_type === 'POINTS_AWARDED' ? '#EAB308' : '#6B7280',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {act.activity_type === 'STATUS_CHANGE' ? <ClipboardDocumentListIcon style={{ width: 13, height: 13 }} /> :
                   act.activity_type === 'PAYMENT_STATUS_CHANGE' ? <CreditCardIcon style={{ width: 13, height: 13 }} /> :
                   act.activity_type === 'PAYMENT_RECORDED' ? <BanknotesIcon style={{ width: 13, height: 13 }} /> :
                   act.activity_type === 'PAYMENT_VERIFIED' ? <ShieldCheckIcon style={{ width: 13, height: 13 }} /> :
                   act.activity_type === 'POINTS_AWARDED' ? <span style={{ fontSize: 13 }}>🏆</span> : <PencilSquareIcon style={{ width: 13, height: 13 }} />}
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
    <div className="bkd-page" style={{ maxWidth: '100%' }}>
      {/* Page Header */}
      <div className="bkd-header">
        <div className="bkd-header-left">
          <button className="bkd-back-btn" onClick={onBack}><ArrowLeftIcon style={{width:16,height:16}}/></button>
          <div>
            <h1 className="bkd-title">
              Booking Details — {booking.booking_number}{' '}
                
        <span className="bkd-status-badge" style={{background:effectiveStatusBadge.bg,color:effectiveStatusBadge.text,border:`1px solid ${effectiveStatusBadge.border}`}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:effectiveStatusBadge.text,display:'inline-block'}}/> {effectiveStatusLabel}
        </span>
     
            </h1>
            <p className="bkd-subtitle">{booking.project_name} · {booking.unit_display || booking.unit_number || 'N/A'} · {fmtD(booking.booking_date)}</p>
          </div>
        </div>
        <div className="bkd-header-actions">
          {/* Workflow action buttons */}
          {!booking.is_cancelled && !isCancelApproved && ['BOOKING_OPEN', 'BOOKING_PENDING', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'BOOKED', 'REGISTERED', 'EMI', 'TOKEN_RECEIVED', 'FORM_SUBMITTED', 'AGREEMENT_DRAFT', 'AGREEMENT_SIGNED'].includes(booking.bookingStatus?.status_code || booking.status_code) && (
            <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#EF4444',color:'#EF4444'}} onClick={() => setWorkflowMode('requestCancel')}><ExclamationTriangleIcon style={{width:14,height:14}}/> Request Cancel</button>
          )}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && booking.custom_fields?.cancel_approved_by && (
            <button className="bkd-btn bkd-btn-primary" style={{background:'#DC2626'}} onClick={() => setWorkflowMode('confirmCancel')}><XCircleIcon style={{width:14,height:14}}/> Confirm Cancel</button>
          )}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && !booking.custom_fields?.cancel_approved_by && !booking.custom_fields?.cancel_rejected_by && (
            <span style={{fontSize:12, color:'#F59E0B', fontWeight:600, padding:'6px 12px', background:'#F59E0B18', borderRadius:6}}>⏳ Awaiting SH Approval</span>
          )}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && booking.custom_fields?.cancel_rejected_by && (
            <>
              <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#16A34A',color:'#16A34A'}} onClick={() => setWorkflowMode('revertCancel')}><ArrowPathIcon style={{width:14,height:14}}/> Customer Wants to Continue</button>
              <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#EF4444',color:'#EF4444'}} onClick={() => setWorkflowMode('requestCancel')}><ExclamationTriangleIcon style={{width:14,height:14}}/> Resubmit Cancellation</button>
            </>
          )}
          {booking.is_cancelled && totalPaid > 0 && (
            <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#F59E0B',color:'#F59E0B'}} onClick={() => setWorkflowMode('refund')}>
              <BanknotesIcon style={{width:14,height:14}}/> Process Refund ({formatCurrency(totalPaid)} pending)
            </button>
          )}
          {/* Booking Open → send to Super Admin for approval (unit reserved).
              This is a Collection action — the Super Admin never sends for approval. */}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'BOOKING_OPEN' && !canEditPayments && (
            <button className="bkd-btn bkd-btn-primary" disabled={sendingApproval} onClick={() => setShowApprovalConfirm(true)}>
              <CheckCircleIcon style={{width:14,height:14}}/> {sendingApproval ? 'Sending…' : 'Send for Approval'}
            </button>
          )}
          {/* Booking Pending → Super Admin approves/rejects right here; others just wait. */}
          {(booking.bookingStatus?.status_code || booking.status_code) === 'BOOKING_PENDING' && (
            canEditPayments ? (
              <>
                <button className="bkd-btn bkd-btn-primary" style={{background:'#16A34A'}} disabled={approvalSaving} onClick={() => setApprovalAction('approve')}>
                  <CheckCircleIcon style={{width:14,height:14}}/> Approve
                </button>
                <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#DC2626',color:'#DC2626'}} disabled={approvalSaving} onClick={() => { setApprovalRemarks(''); setApprovalAction('reject'); }}>
                  <XCircleIcon style={{width:14,height:14}}/> Reject
                </button>
              </>
            ) : (
              <span style={{fontSize:12, color:'#B45309', fontWeight:600, padding:'6px 12px', background:'#F59E0B18', borderRadius:6}}>⏳ Awaiting Super Admin Approval</span>
            )
          )}
          {/* Collection-only actions — hidden for the Super Admin review view.
              Also blocked while still Booking Open (not yet sent for approval). */}
          {(booking.bookingStatus?.status_code || booking.status_code) !== 'BOOKING_OPEN' && !canEditPayments && (
            <>
              <button className="bkd-btn bkd-btn-ghost" onClick={() => openActionModal('payStatus')}><CreditCardIcon style={{width:14,height:14}}/> Payment Status</button>
              <button className="bkd-btn bkd-btn-ghost" onClick={() => openActionModal('status')}><PencilSquareIcon style={{width:14,height:14}}/> Booking Status</button>
              <button className="bkd-btn bkd-btn-primary" onClick={() => openActionModal('pay')}><PlusIcon style={{width:14,height:14}}/> Add Payment</button>
            </>
          )}
          {canDeleteBooking && (
            <button className="bkd-btn bkd-btn-outline" style={{borderColor:'#DC2626',color:'#DC2626'}} onClick={() => setShowDeleteBooking(true)} title="Permanently delete this booking">
              <ExclamationTriangleIcon style={{width:14,height:14}}/> Delete Booking
            </button>
          )}
          {[ROLE_CODES.COLLECTION, ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN].includes(getRoleCode(user)) && !booking.is_cancelled && (
            <button className="bkd-btn bkd-btn-ghost" onClick={openAssign} title="Assign this booking to a Collection Executive">
              <UserIcon style={{width:14,height:14}}/> {(() => {
                const execs = booking.collectionExecutives || [];
                if (execs.length === 0) return 'Assign Executives';
                if (execs.length === 1) return `Executive: ${execs[0].first_name}`;
                return `Executives: ${execs.length}`;
              })()}
            </button>
          )}
          {[ROLE_CODES.COLLECTION, ROLE_CODES.SUPER_ADMIN].includes(getRoleCode(user)) && (booking.bookingStatus?.status_code || booking.status_code) === 'BOOKING_APPROVED' && (
            <button
              className="bkd-btn bkd-btn-primary"
              style={{ background: '#16A34A', boxShadow: '0 1px 2px rgba(22,163,74,0.25)' }}
              onClick={() => setPdfModalOpen(true)}
              title="Generate the Booking Form PDF — split the plot & development amounts across bank accounts"
            >
              <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> Generate Booking Form
            </button>
          )}
          <button className="bkd-btn bkd-btn-ghost bkd-btn-icon" onClick={loadBooking} title="Refresh"><ArrowPathIcon style={{width:16,height:16}}/></button>
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

      {/* SH Rejection banner */}
      {(booking.bookingStatus?.status_code || booking.status_code) === 'REQUEST_TO_CANCEL' && booking.custom_fields?.cancel_rejected_by && (
        <div className="bkd-alert-banner" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0, color: '#DC2626' }} />
          <div>
            <span className="bkd-alert-title" style={{ color: '#991B1B' }}>Cancellation Request Rejected by Sales Head</span>
            <span className="bkd-alert-text">
              Remarks: {booking.custom_fields?.cancel_rejection_remarks || 'No remarks provided.'}
              <br />
              Please consult with the customer. If they want to continue the booking, click <strong>Customer Wants to Continue</strong> above. If they still want to cancel, you can <strong>Resubmit Cancellation</strong>.
            </span>
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
        {/* Left column: Customer Information + Award Points stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div className="bkd-card">
              <div className="bkd-card-header">
                <div className="bkd-card-title"><UserIcon style={{width:15,height:15}}/> Customer Information</div>
              </div>
              <div className="bkd-card-body">
                <div className="bkd-info-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <InfoRow label="Buyer Name" value={buyerName}/>
                  <InfoRow label="Lead Name" value={leadFullName}/>
                  <InfoRow label="Customer Phone" value={customerPhone} mono/>
                  <InfoRow label="PAN" value={customer.pan_number} mono/>
                  <InfoRow label="Aadhaar" value={customer.aadhar_number} mono/>
                  <InfoRow label="Booking Date" value={fmtD(booking.booking_date)}/>
                </div>
                <hr className="bkd-divider"/>
                <div className="bkd-info-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <InfoRow label="Project" value={booking.project_name}/>
                  <InfoRow label="Unit" value={booking.unit_display || booking.unit_number}/>
                  <InfoRow label="Area" value={booking.carpet_area ? `${booking.carpet_area} sq.ft` : '—'}/>
                  
                
                  <InfoRow label="Previous Handler" value={previousLeadAssignee ? getUserLabel(previousLeadAssignee) : '—'} />
                  <InfoRow label="Payment Plan" value={paymentPlanLabel} />
                  <InfoRow label="Plan Type" value={paymentPlanType || '—'} />
                  <InfoRow label="Sales Manager" value={salesManager ? getUserLabel(salesManager) : '—'} />
                  <InfoRow label="Sales Head" value={salesHead ? getUserLabel(salesHead) : '—'} />
                  <InfoRow label="Collection Owner" value={leadAssignee ? getUserLabel(leadAssignee) : '—'} />
                  <InfoRow label="Booking Status" value={effectiveStatusLabel} color={effectiveStatusColor} />
                  <InfoRow label="Payment Status" value={booking.payment_status || '—'} />
                  <InfoRow label="Unit Reserved" value={fmtD(booking.created_at || booking.booking_date)} />
                </div>
              </div>
            </div>

            {leadAssignee && (
              <div className="bkd-card">
                <div className="bkd-card-header">
                  <div className="bkd-card-title">Award Points (Optional)</div>
                </div>
                <div className="bkd-card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Sales Manager Row */}
                    {salesManager ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-secondary, #F9FAFB)', borderRadius: 8, border: '1px solid var(--col-border, #E5E7EB)' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: 'var(--col-text, #000000)', opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Sales Manager</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--col-text, #000000)' }}>
                            {salesManager.first_name} {salesManager.last_name}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            className="bkd-form-control"
                            placeholder="Points"
                            value={smPointsValue}
                            onChange={(e) => setSmPointsValue(e.target.value)}
                            style={{ width: 80, fontSize: 13, textAlign: 'center' }}
                          />
                          <button
                            type="button"
                            className="crm-btn crm-btn-sm"
                            disabled={!smPointsValue || statusSaving}
                            style={{ border: '1px solid var(--col-text, #000000)', background: 'var(--col-surface, #ffffff)', color: 'var(--col-text, #000000)', fontWeight: 600 }}
                            onClick={async () => {
                              if (!smPointsValue || isNaN(parseInt(smPointsValue)) || parseInt(smPointsValue) === 0) {
                                toast.error('Enter valid points value');
                                  return;
                                }
                                const points = parseInt(smPointsValue, 10);
                                setStatusSaving(true);
                try {
                  const reason = `Lead conversion / Booking ${booking.booking_number}`;
                  // Use updatePointsForBooking to replace existing points
                  await userApi.updatePointsForBooking(salesManager.id, points, reason, bookingId, booking.lead?.id);
                  toast.success(`Updated ${points} points for SM`);
                  // Keep the saved value in the input for editing
                  setSmPointsValue(String(points));
                  loadActivities();
                } catch (err) {
                  toast.error(getErrorMessage(err, 'Failed to award points'));
                } finally {
                  setStatusSaving(false);
                }
                              }}
                            >
                              {statusSaving ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--col-text, #000000)', opacity: 0.7, textAlign: 'center', padding: 12, background: 'var(--bg-secondary, #F9FAFB)', borderRadius: 8 }}>
                          No Sales Manager assigned
                        </div>
                      )}
  
                      {/* Sales Head Row */}
                      {salesHead ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-secondary, #F9FAFB)', borderRadius: 8, border: '1px solid var(--col-border, #E5E7EB)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: 'var(--col-text, #000000)', opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Sales Head</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--col-text, #000000)' }}>
                              {salesHead.first_name} {salesHead.last_name}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="number"
                              className="bkd-form-control"
                              placeholder="Points"
                              value={shPointsValue}
                              onChange={(e) => setShPointsValue(e.target.value)}
                              style={{ width: 80, fontSize: 13, textAlign: 'center' }}
                            />
                            <button
                              type="button"
                              className="crm-btn crm-btn-sm"
                              disabled={!shPointsValue || statusSaving}
                              style={{ border: '1px solid var(--col-text, #000000)', background: 'var(--col-surface, #ffffff)', color: 'var(--col-text, #000000)', fontWeight: 600 }}
                              onClick={async () => {
                                if (!shPointsValue || isNaN(parseInt(shPointsValue)) || parseInt(shPointsValue) === 0) {
                                  toast.error('Enter valid points value');
                                  return;
                                }
                                const points = parseInt(shPointsValue, 10);
                                setStatusSaving(true);
                try {
                  const reason = `Lead conversion / Booking ${booking.booking_number}`;
                  // Use updatePointsForBooking to replace existing points
                  await userApi.updatePointsForBooking(salesHead.id, points, reason, bookingId, booking.lead?.id);
                  toast.success(`Updated ${points} points for SH`);
                  // Keep the saved value in the input for editing
                  setShPointsValue(String(points));
                  loadActivities();
                } catch (err) {
                  toast.error(getErrorMessage(err, 'Failed to award points'));
                } finally {
                  setStatusSaving(false);
                }
                              }}
                            >
                              {statusSaving ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--col-text, #000000)', opacity: 0.7, textAlign: 'center', padding: 12, background: 'var(--bg-secondary, #F9FAFB)', borderRadius: 8 }}>
                          No Sales Head assigned
                        </div>
                      )}
                    {activities.filter((a) => a.activity_type === 'POINTS_AWARDED').length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            color: 'var(--text-secondary)',
                            marginBottom: 8,
                          }}
                        >
                          Award History
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activities
                            .filter((a) => a.activity_type === 'POINTS_AWARDED')
                            .map((act, idx) => (
                              <div
                                key={act.id || idx}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  border: '1px solid var(--border-primary, #e2e8f0)',
                                  background: 'var(--bg-secondary, #f8fafc)',
                                  fontSize: 12.5,
                                }}
                              >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                                {act.description && (
                                  <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 2 }}>
                                    {act.description}
                                  </div>
                                )}
                                <div style={{ color: 'var(--text-muted, #9ca3af)', fontSize: 10.5, marginTop: 4 }}>
                                  By {act.performedBy ? `${act.performedBy.first_name} ${act.performedBy.last_name}` : 'System'} on{' '}
                                  {new Date(act.performed_at).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
        </div>
        {/* Right column: Payment Summary */}

            <div style={{
              background: "var(--col-surface, #ffffff)",
              borderRadius: 12,
              border: "1px solid var(--col-border, #e2e8f0)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              overflow: "hidden"
            }}>
              {/* Payment Summary Header */}
              <div style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--col-border, #e2e8f0)"
              }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, background: "var(--bg-secondary, #f1f5f9)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    <CreditCardIcon style={{ width: 16, height: 16, color: "var(--col-text, #000000)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: "var(--col-text, #000000)" }}>Financial Summary</div>
                  </div>
                </div>
              </div>

              {/* Stat Strip */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--col-border, #e2e8f0)", flexWrap: "wrap" }}>
                <BkdStatCell label="Total value" value={fmtFull(liveTotalValue)} />
                <BkdStatCell label="Collected" value={fmtFull(totalPaid)} />
                <BkdStatCell label="Balance due" value={fmtFull(liveTotalValue - totalPaid)} />
                <BkdStatCell label="Unverified" value={fmtFull(unverifiedAmt)} border={false} />
              </div>

              {/* Cost Breakdown */}
              <div style={{ padding: "18px 24px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--col-text, #000000)" }}>Cost Breakdown</div>
                    <div style={{ fontSize: 12, color: "var(--col-text, #000000)" }}>Detailed property pricing structure</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openActionModal('devCost')}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 12px", borderRadius: 8, border: "1px solid var(--col-text, #000000)",
                      background: "var(--col-surface, #ffffff)", color: "var(--col-text, #000000)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <PencilSquareIcon style={{ width: 13, height: 13 }} /> Edit
                  </button>
                </div>

                <BkdLedgerRow label="Plot Value" note="90% of total" valueText={fmtFull(plotValue)} />
                <BkdLedgerRow label="Stamp Duty" note="Govt Charge" valueText={fmtFull(stampValue)} />
                <BkdLedgerRow label="Registration Fees" note="Legal Charge" valueText={fmtFull(registrationValue)} />
                <BkdLedgerRow label="Development" note="Infrastructure" valueText={fmtFull(developmentValue)} />

                {(otherChargesTotal > 0) && (
                  <>
                    <BkdLedgerRow
                      label="Registration Charges"
                      note={`Subtotal: ${fmtFull(otherChargesTotal)}`}
                      valueText={fmtFull(otherChargesTotal)}
                      onClick={() => setRegExpanded((v) => !v)}
                      expandIcon={regExpanded ? <ChevronDownIcon style={{ width: 14, height: 14, color: "var(--col-text, #000000)" }} /> : <ChevronDownIcon style={{ width: 14, height: 14, color: "var(--col-text, #000000)", transform: "rotate(-90deg)" }} />}
                    />
                    {regExpanded && (
                      <>
                        {Object.entries(savedRegSplit).filter(([, v]) => toAmount(v) > 0).map(([k, v]) => (
                          <BkdLedgerRow key={k} label={labelize(k)} valueText={fmtFull(toAmount(v))} indent={22} />
                        ))}
                        {savedModtEnabled && Object.entries(savedModtSplit).filter(([, v]) => toAmount(v) > 0).map(([k, v]) => (
                          <BkdLedgerRow key={`modt-${k}`} label={`MODT · ${labelize(k)}`} valueText={fmtFull(toAmount(v))} indent={22} />
                        ))}
                      </>
                    )}
                  </>
                )}

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  marginTop: 10, paddingTop: 14, borderTop: "3px double var(--col-text, #000000)",
                }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--col-text, #000000)" }}>Grand Total</span>
                  <span style={{ fontSize: 22, fontWeight: 600, color: "var(--col-text, #000000)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtFull(totalValue)}
                  </span>
                </div>
              </div>

              {/* Collection Progress */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--col-border, #e2e8f0)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--col-text, #000000)" }}>Collection Progress</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>
                    {pctCollected}%
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--col-text, #000000)" }}>
                  <span>{fmtFull(totalPaid)} collected out of {fmtFull(liveTotalValue)}</span>
                  <span style={{ fontWeight: 600, color: liveTotalValue - totalPaid > 0 ? "#dc2626" : "var(--col-text, #000000)" }}>
                    {fmtFull(liveTotalValue - totalPaid)} pending
                  </span>
                </div>
              </div>

              {/* Payments Strip */}
              <div style={{ display: "flex", borderTop: "1px solid var(--col-border, #e2e8f0)" }}>
                <BkdStatCell label="Payments" value={payments.length} />
                <BkdStatCell label="Verified" value={verifiedCount} />
                <BkdStatCell label="Pending" value={pendingCount} border={false} />
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
            {/* Payments blocked until sent for approval (Pending+); hidden for Super Admin review. */}
            {(booking.bookingStatus?.status_code || booking.status_code) !== 'BOOKING_OPEN' && !canEditPayments && (
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
                const editable = canEditThisPayment(p);
                return (
                <tr key={p.id} className={p.is_bounced ? 'bkd-row-bounced' : ''}
                  style={{ cursor: 'pointer' }}
                  title={editable ? 'Click to edit this payment' : 'Click to view this payment'}
                  onClick={editable ? () => openEditPayment(p) : () => setViewPaymentId(p.id)}>
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
                  <td>
                    {editable ? (
                      <button className="bkd-btn bkd-btn-ghost bkd-btn-sm" onClick={(e) => { e.stopPropagation(); openEditPayment(p); }}>
                        <PencilSquareIcon style={{ width: 13, height: 13 }} /> Edit
                      </button>
                    ) : (
                      <button className="bkd-btn bkd-btn-ghost bkd-btn-sm" onClick={(e) => { e.stopPropagation(); setViewPaymentId(p.id); }}>
                        <EyeIcon style={{ width: 13, height: 13 }} /> View
                      </button>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody></table>
          )}</div>
        </div>
      )}

      {viewPaymentId && (
        <RecordPaymentModal
          bookingId={bookingId}
          paymentId={viewPaymentId}
          readOnly
          onClose={() => setViewPaymentId(null)}
          onSaved={loadBooking}
        />
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
                  const color = act.activity_type==='PAYMENT_RECORDED'?'#10b981':act.activity_type==='STATUS_CHANGE'?'#3b82f6':act.activity_type==='POINTS_AWARDED'?'#eab308':act.activity_type==='CANCELLED'?'#ef4444':'#6b7280';
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
                        <div className="bkd-document-item" key={doc.id} style={{ alignItems: 'flex-start', minWidth: 0 }}>
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

      {/* ── SUPER ADMIN: Approve / Reject booking ── */}
      {approvalAction && (
        <div className="col-modal-overlay" onClick={() => !approvalSaving && setApprovalAction(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: 'min(100%, 460px)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {approvalAction === 'approve' ? 'Approve' : 'Reject'} booking {booking.booking_number}
              </h3>
            </div>
            {approvalAction === 'approve' ? (
              <div style={{ padding: 20, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                Approve this booking? It moves to <strong style={{ color: 'var(--text-primary)' }}>Booking Confirmed</strong> and the reserved unit is committed.
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Rejection remarks *</label>
                <textarea
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="Why is this booking being rejected?"
                  rows={4}
                  style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-input, #cbd5e1)', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
            )}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="bkd-btn bkd-btn-outline" onClick={() => setApprovalAction(null)} disabled={approvalSaving}>Cancel</button>
              {approvalAction === 'approve' ? (
                <button type="button" className="bkd-btn bkd-btn-primary" style={{ background: '#16A34A' }} disabled={approvalSaving} onClick={handleApproveBooking}>
                  <CheckCircleIcon style={{ width: 14, height: 14 }} /> {approvalSaving ? 'Approving…' : 'Approve Booking'}
                </button>
              ) : (
                <button type="button" className="bkd-btn bkd-btn-primary" style={{ background: '#DC2626' }} disabled={approvalSaving || !approvalRemarks.trim()} onClick={handleRejectBooking}>
                  <XCircleIcon style={{ width: 14, height: 14 }} /> {approvalSaving ? 'Rejecting…' : 'Reject Booking'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {pdfModalOpen && (
        <GenerateBookingFormModal
          booking={booking}
          banks={bankOptions}
          terms={terms}
          onClose={() => setPdfModalOpen(false)}
        />
      )}

      {actionMode && (
        <div className="col-modal-overlay" onClick={closeActionModal}>
          <div className="qa-modal-panel" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="qa-drawer-handle" />
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{ background: badgeColors(booking.status_color).bg, color: badgeColors(booking.status_color).text, border: `2px solid ${badgeColors(booking.status_color).border}` }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, maxHeight: 520 }}>
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

                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>{editingPaymentId ? 'Edit Payment' : 'Record New Payment'}</div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group" style={{ flex: 1 }}>
                      <label className="bkd-form-label">Payment For (Category) *</label>
                      <select className="bkd-form-control" value={payForm.payment_category}
                        onChange={e => setPayForm(p => ({ ...p, payment_category: e.target.value }))}>
                        <option value="">Select what this payment is for</option>
                        {filteredCategories.map((cat) => {
                          const bucket = categoryBuckets.find(b => b.key === cat);
                          const target = bucket?.target || 0;
                          const paid = bucket?.paid || 0;
                          const balance = Math.max(target - paid, 0);
                          const suffix = target > 0
                            ? ` — Balance ${formatCurrency(balance)}`
                            : (paid > 0 ? ` — Paid ${formatCurrency(paid)}` : '');
                          return <option key={cat} value={cat}>{categoryLabel(cat)}{suffix}</option>;
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
                          <span>{categoryLabel(payForm.payment_category)}</span>
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
                    {paySaving ? 'Saving...' : (editingPaymentId ? 'Update Payment' : 'Submit Payment')}
                  </button>
                </div>
              </div>
            )}

            {actionMode === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, maxHeight: 520 }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Select New Booking Status</div>
                  <div className="qa-drawer-status-grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {statusGridOptions.map(s => (
                      <button key={s.id} className={`qa-drawer-st-btn ${newStatusId === String(s.id) ? 'sel-default' : ''}`}
                        onClick={() => setNewStatusId(String(s.id))}>
                        <div className="qa-drawer-st-icon" style={{ fontSize: 16 }}>
                          {isCancelStatusCode(s.status_code) ? (
                            <XCircleIcon style={{ width: 18, height: 18, color: s.color_code || '#DC2626' }} />
                          ) : s.status_code === 'REQUEST_TO_CANCEL' ? (
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
                    const sel = statusGridOptions.find(s => String(s.id) === newStatusId);
                    if (isCancelStatusCode(sel?.status_code)) {
                      return (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ background: '#FEE2E2', border: '1px solid #EF444444', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: '#991B1B' }}>
                            <strong>⚠ Cancelling is permanent.</strong> The unit is released back to <strong>Available</strong> and the lead is moved to <strong>Lost</strong>. {totalPaid > 0.01 ? 'The full collected amount must be refunded first.' : 'No amount has been collected, so no refund is required.'}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12 }}>
                            <span>Total Collected</span>
                            <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalPaid)}</strong>
                          </div>
                          {totalPaid > 0.01 && (
                            <>
                              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Refund (required — must equal total collected)</div>
                              <div className="bkd-form-row">
                                <div className="bkd-form-group">
                                  <label className="bkd-form-label">Refund Amount (₹) *</label>
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
                                <textarea rows={2} className="bkd-form-control" placeholder="Refund details..."
                                  value={cancelRefundForm.refund_remarks}
                                  onChange={(e) => setCancelRefundForm(p => ({ ...p, refund_remarks: e.target.value }))} />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }
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
                            <strong>Registration.</strong> Enter the date of registration to complete this status.
                          </div>
                          <div className="bkd-form-group">
                            <label className="bkd-form-label">Date of Registration *</label>
                            <input type="date" className="bkd-form-control" value={registerForm.registration_date}
                              onChange={(e) => setRegisterForm((p) => ({ ...p, registration_date: e.target.value }))} />
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
                  {(() => {
                    const sel = statusGridOptions.find(s => String(s.id) === newStatusId);
                    const isCancel = isCancelStatusCode(sel?.status_code);
                    const refundShort = isCancel && totalPaid > 0.01
                      && Math.abs(parseFloat(cancelRefundForm.refund_amount || 0) - totalPaid) > 0.01;
                    return (
                      <button
                        className="qa-drawer-save-btn"
                        style={isCancel ? { background: '#DC2626' } : undefined}
                        disabled={
                          !newStatusId
                          || statusSaving
                          || (sel?.status_code === 'REGISTERED' && !registerForm.registration_date)
                          || (sel?.status_code === 'EMI' && !statusRemarks.trim())
                          || (sel?.status_code === 'REQUEST_TO_CANCEL' && !cancelReasonId)
                          || refundShort
                        }
                        onClick={handleStatusUpdate}
                      >
                        {statusSaving ? (isCancel ? 'Cancelling...' : 'Updating...') : (
                          <>
                            {isCancel
                              ? <XCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />
                              : <CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />}
                            {isCancel ? 'Cancel Booking' : 'Update Booking Status'}
                          </>
                        )}
                      </button>
                    );
                  })()}
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
                    <label className="bkd-form-label">Development Cost / Sqft</label>
                    <input type="number" className="bkd-form-control" placeholder="e.g. 250"
                      value={devCostForm.development_cost_per_sqft}
                      onChange={e => setDevCostForm(p => ({ ...p, development_cost_per_sqft: e.target.value }))} />
                  </div>
                  <div className="bkd-dev-hint">
                    Plot Value = ROUNDUP(Guideline × Area) · Stamp Duty = 7% of Plot Value · Registration = 2% of Plot Value · Stamp Commission = 1% of Stamp Duty · Development = Area × Cost/sqft × 1.18 (GST).
                  </div>

                  <div className="qa-drawer-section" style={{ padding: '14px 0 8px' }}>
                    Registration Expenses (Detailed Split)
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                      Subtotal: {fmtFull(previewRegSplitTotal)}
                    </span>
                  </div>
                  <div className="bkd-form-row" style={{ flexWrap: 'wrap' }}>
                    <div className="bkd-form-group" style={{ flex: '1 1 45%' }}>
                      <label className="bkd-form-label">Stamp Commission (1% of Stamp)</label>
                      <input type="number" className="bkd-form-control" value={previewStampCommission} readOnly disabled
                        title="Auto-computed as 1% of Stamp Value" />
                    </div>
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
          <div className="qa-modal-panel" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div className="qa-drawer-handle" />
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{
                  background: (workflowMode === 'register' || workflowMode === 'revertCancel') ? '#16A34A22' : workflowMode === 'emi' ? '#F59E0B22' : '#EF444422',
                  color: (workflowMode === 'register' || workflowMode === 'revertCancel') ? '#16A34A' : workflowMode === 'emi' ? '#F59E0B' : '#EF4444',
                  border: `2px solid ${(workflowMode === 'register' || workflowMode === 'revertCancel') ? '#16A34A' : workflowMode === 'emi' ? '#F59E0B' : '#EF4444'}`,
                }}>
                  {workflowMode === 'register' ? '📋' : workflowMode === 'emi' ? '💰' : workflowMode === 'confirmCancel' ? '✕' : (workflowMode === 'refund' || workflowMode === 'revertCancel') ? '↩' : '⚠'}
                </div>
                <div>
                  <div className="qa-drawer-name">
                    {workflowMode === 'register' ? 'Register Booking' : workflowMode === 'emi' ? 'Move to EMI' : workflowMode === 'confirmCancel' ? 'Confirm Cancellation' : workflowMode === 'refund' ? 'Record Refund' : workflowMode === 'revertCancel' ? 'Reactivate Booking (Revert)' : 'Request to Cancel'}
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
                <div className="qa-drawer-save-row" style={{ marginTop: 16 }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#16A34A' }} disabled={registerSaving || !registerForm.registration_date} onClick={async () => {
                    if (!registerForm.registration_date) { toast.error('Registration date is mandatory'); return; }
                    setRegisterSaving(true);
                    try {
                      const formData = new FormData();
                      formData.append('registration_date', registerForm.registration_date);
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

            {workflowMode === 'revertCancel' && (
              <div style={{ padding: '16px 20px' }}>
                <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#166534' }}>
                  <strong>ℹ Note:</strong> This will reactivate the booking and revert it back to its original active status (<strong>{booking.custom_fields?.previous_status_name || 'Booked'}</strong>).
                </div>
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Remarks / Follow-up Notes</label>
                  <textarea className="bkd-form-control" rows={3} placeholder="Customer decided to continue because..."
                    value={revertRemarks} onChange={e => setRevertRemarks(e.target.value)} />
                </div>
                <div className="qa-drawer-save-row" style={{ marginTop: 16 }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#16A34A' }} disabled={revertSaving} onClick={async () => {
                    setRevertSaving(true);
                    try {
                      await bookingApi.revertCancellation(bookingId, { remarks: revertRemarks });
                      toast.success('Booking reactivated successfully');
                      setWorkflowMode(null);
                      setRevertRemarks('');
                      loadBooking();
                      loadActivities();
                    } catch (err) {
                      toast.error(getErrorMessage(err, 'Failed to reactivate booking'));
                    } finally {
                      setRevertSaving(false);
                    }
                  }}>
                    {revertSaving ? 'Reactivating...' : 'Confirm Reactivation'}
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
                  Refund (required — must equal total collected amount)
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
                    if (totalPaid > 0.01) {
                      if (Math.abs(amt - totalPaid) > 0.01) {
                        toast.error(`Outstanding collected amount of ${formatCurrency(totalPaid)} must be fully refunded to confirm cancellation.`);
                        return;
                      }
                    }
                    setConfirmCancelSaving(true);
                    try {
                      await bookingApi.confirmCancel(bookingId, amt > 0 ? cancelRefundForm : {});
                      toast.success('Booking cancelled and refund recorded');
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

      {assignOpen && (
        <div className="col-modal-overlay" onClick={() => setAssignOpen(false)}>
          <div className="qa-modal-panel" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="qa-drawer-header">
              <div className="qa-drawer-name">Assign Collection Executives</div>
              <button className="qa-drawer-close" onClick={() => setAssignOpen(false)}>×</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <label className="bkd-form-label">Collection Executives {selectedExecIds.length > 0 && <span style={{ color: '#6366F1' }}>({selectedExecIds.length})</span>}</label>
              {(() => {
                const selectedExecs = executives.filter((ex) => selectedExecIds.includes(String(ex.id)));
                const q = assignSearch.trim().toLowerCase();
                const availableExecs = executives.filter((ex) => !selectedExecIds.includes(String(ex.id))
                  && (!q || `${execName(ex)} ${ex.email || ''}`.toLowerCase().includes(q)));
                return (
                  <div className="bkd-assignee-chips">
                    {selectedExecs.map((ex) => (
                      <span className="bkd-assignee-chip" key={ex.id}>
                        <span className="bkd-assignee-avatar" style={{ background: colorFor(ex.id) }}>{initialsOf(ex)}</span>
                        {execName(ex)}
                        <button type="button" className="bkd-assignee-x" title="Remove" onClick={() => toggleExec(ex.id)}>✕</button>
                      </span>
                    ))}
                    <div className="bkd-assignee-add-wrap" ref={assignAddRef}>
                      <button type="button" className="bkd-assignee-add" onClick={() => { setAssignAddOpen((o) => !o); setAssignSearch(''); }}>
                        <PlusIcon style={{ width: 14, height: 14 }} /> Add <ChevronDownIcon style={{ width: 12, height: 12 }} />
                      </button>
                      {assignAddOpen && (
                        <div className="bkd-assignee-menu">
                          <input
                            className="bkd-assignee-search"
                            type="text"
                            autoFocus
                            value={assignSearch}
                            placeholder="Search executives…"
                            onChange={(e) => setAssignSearch(e.target.value)}
                          />
                          {availableExecs.length === 0 && <div className="bkd-assignee-menu-empty">No executives found</div>}
                          {availableExecs.map((ex) => (
                            <div className="bkd-assignee-menu-item" key={ex.id} onClick={() => { toggleExec(ex.id); setAssignSearch(''); }}>
                              <span className="bkd-assignee-avatar sm" style={{ background: colorFor(ex.id) }}>{initialsOf(ex)}</span>
                              {execName(ex)}
                              {ex.email && <span className="bkd-assignee-email">{ex.email}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedExecs.length === 0 && !assignAddOpen && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No executives assigned yet</span>
                    )}
                  </div>
                );
              })()}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                Assigned executives can update status, follow-ups and record payments for this booking — without seeing financial summary details. All assignees and the manager share the same activity timeline.
              </p>
              <button className="bkd-btn bkd-btn-primary" style={{ marginTop: 16, width: '100%' }} disabled={assigning} onClick={handleAssignExecutive}>
                {assigning ? 'Saving…' : (selectedExecIds.length ? `Save Assignment (${selectedExecIds.length})` : 'Clear Assignment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {canDeleteBooking && (
        <DangerDeleteModal
          open={showDeleteBooking}
          entityLabel="booking"
          entityName={`Booking ${booking.booking_number}`}
          confirmValue={String(booking.booking_number ?? '')}
          confirmLabel="Booking ID"
          extraWarning="All payments, activity history and points for this booking will be removed, and any linked unit will be released back to Available."
          onClose={() => setShowDeleteBooking(false)}
          onConfirm={async () => {
            await bookingApi.hardDelete(booking.id);
            toast.success('Booking permanently deleted');
            setShowDeleteBooking(false);
            onBack?.();
          }}
        />
      )}
    </div>
  );
};

export default CollectionBookingDetail;
