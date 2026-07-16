import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency } from '../../../utils/formatters';
import {
  MagnifyingGlassIcon, ArrowPathIcon, ClipboardDocumentListIcon,
  PlusIcon, CreditCardIcon, PencilSquareIcon,
  ChevronRightIcon, ChevronDownIcon, CalendarDaysIcon,
  CheckCircleIcon, ExclamationTriangleIcon, ArrowDownLeftIcon,
  FunnelIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import KebabMenu from '../../../components/common/KebabMenu';
import usePagination from '../../../hooks/usePagination';
import { badgeStyle, badgeColors } from '../../../utils/badgeColors';
import '../common/LeadWorkspacePage.css';
import '../collection/CollectionWorkspace.css';

// Collection-Exec row actions (collapsed into the ⋮ kebab; View stays visible).
const execQaItems = (booking, openAction) => [
  { key: 'pay', label: 'Add Payment', Icon: PlusIcon, onClick: (e) => { e.stopPropagation(); openAction(booking, 'pay'); } },
  { key: 'payStatus', label: 'Payment Status / Follow-up', Icon: CreditCardIcon, onClick: (e) => { e.stopPropagation(); openAction(booking, 'payStatus'); } },
  { key: 'status', label: 'Update Booking Status', Icon: PencilSquareIcon, onClick: (e) => { e.stopPropagation(); openAction(booking, 'status'); } },
];

const PAYMENT_CATEGORIES = ['Plot Value', 'Stamp Duty', 'Development', 'Registration', 'Registration Expenses', 'MODT', 'Other'];
const QUICK_STATUS_CODES = ['BOOKED', 'REGISTERED', 'EMI', 'REQUEST_TO_CANCEL'];

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
const CATEGORY_LABELS = { 'Registration': 'Registration Fees', 'Registration Expenses': 'Regn Misc. Expenses' };
const categoryLabel = (cat) => CATEGORY_LABELS[cat] || cat;

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
    { key: 'Development', target: developmentTarget, paid: paidByCategory['Development'] || 0 },
    { key: 'Registration', target: registrationTarget, paid: paidByCategory['Registration'] || 0 },
    { key: 'Registration Expenses', target: regExpensesTarget, paid: paidByCategory['Registration Expenses'] || 0 },
    { key: 'Other Registration Expenses', target: otherRegExpensesTarget, paid: paidByCategory['Other Registration Expenses'] || 0 },
    { key: 'MODT', target: modtTarget, paid: paidByCategory['MODT'] || 0 },
    { key: 'Other', target: 0, paid: paidByCategory['Other'] || 0 },
  ];
};

// Collection Executive list — only bookings assigned to this executive (scoped
// server-side via getMyBookings → collection_executive_id).
const BOOKING_TABS = [
  { value: 'All', label: 'All', short: 'All' },
  { value: 'Today Follow-up', label: 'Today Follow-up', short: 'Today' },
  { value: 'Missed Follow-up', label: 'Missed Follow-up', short: 'Missed' },
];

const CollectionExecBookings = ({ onSelectBooking }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  const [selectedProjects, setSelectedProjects] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showProjectFilter, setShowProjectFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const projectFilterRef = React.useRef(null);
  const statusFilterRef = React.useRef(null);

  // Modals & Active Booking state
  const [activeBooking, setActiveBooking] = useState(null);
  const [actionMode, setActionMode] = useState(null); // 'status' | 'payStatus' | 'pay'

  const [statusOptions, setStatusOptions] = useState([]);
  const [paymentStatusOptions, setPaymentStatusOptions] = useState([]);
  const [paymentModeOptions, setPaymentModeOptions] = useState([]);
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([]);
  const [cancelReasons, setCancelReasons] = useState([]);

  // status form
  const [newStatusId, setNewStatusId] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [registerDate, setRegisterDate] = useState('');
  const [cancelReasonId, setCancelReasonId] = useState('');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // payment status form
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentStatusId, setPaymentStatusId] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [payStatusRemarks, setPayStatusRemarks] = useState('');
  const [payStatusSaving, setPayStatusSaving] = useState(false);

  // add payment form
  const [payForm, setPayForm] = useState({ payment_type: '', payment_category: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', remarks: '' });
  const [paySaving, setPaySaving] = useState(false);

  // mobile expansion
  const [expandedMobileBookingId, setExpandedMobileBookingId] = useState(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getMyBookings({ limit: 200, is_cancelled: 'false' });
      const raw = resp.data?.data?.rows || resp.data?.data || [];
      setBookings(Array.isArray(raw) ? raw : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load assigned bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    bookingStatusApi.getDropdown().then((r) => setStatusOptions(r.data?.data || r.data || [])).catch(() => {});
    paymentStatusApi.getDropdown().then((r) => setPaymentStatusOptions(r.data?.data || r.data || [])).catch(() => {});
    bookingApi.getCancelReasons().then((r) => setCancelReasons(r.data?.data || r.data || [])).catch(() => {});
    bookingApi.getPaymentFormMasters().then((r) => {
      const payload = r.data?.data || r.data || {};
      setPaymentModeOptions(payload.payment_modes || []);
      setPaymentTypeOptions(payload.payment_types || []);
    }).catch(() => {});
  }, []);

  const projects = useMemo(() => {
    const projectMap = new Map();
    bookings.forEach((b) => {
      const id = b.project_id || b.project?.id;
      const name = b.project?.project_name || b.project_name;
      if (id && name && !projectMap.has(id)) {
        projectMap.set(id, { id, name });
      }
    });
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings]);

  const handleProjectToggle = (projectId) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleStatusToggle = (statusCode) => {
    setSelectedStatuses((prev) =>
      prev.includes(statusCode)
        ? prev.filter((code) => code !== statusCode)
        : [...prev, statusCode]
    );
  };

  const clearProjectFilter = () => setSelectedProjects([]);
  const clearStatusFilter = () => setSelectedStatuses([]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target)) {
        setShowProjectFilter(false);
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target)) {
        setShowStatusFilter(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const quickStatusOptions = useMemo(() => statusOptions.filter((s) => QUICK_STATUS_CODES.includes(s.status_code)), [statusOptions]);

  const openAction = (booking, mode) => {
    setActiveBooking(booking);
    setActionMode(mode);
    if (mode === 'status') {
      setNewStatusId(QUICK_STATUS_CODES.includes(booking?.status_code) ? String(booking?.booking_status_id || '') : '');
      setStatusRemarks(''); setRegisterDate(''); setCancelReasonId(''); setCancelRemarks('');
    } else if (mode === 'payStatus') {
      setPaymentStatus(booking?.payment_status || '');
      const matched = paymentStatusOptions.find((p) => p.status_name === booking?.payment_status || p.status_code === booking?.payment_status);
      setPaymentStatusId(booking?.payment_status_id || matched?.id || '');
      setFollowUpDate(''); setPayStatusRemarks('');
    } else if (mode === 'pay') {
      setPayForm({ payment_type: '', payment_category: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', remarks: '' });
    }
  };

  const closeAction = () => {
    setActionMode(null);
    setActiveBooking(null);
  };

  const handleStatusUpdate = async () => {
    if (!newStatusId || !activeBooking) return;
    const sel = quickStatusOptions.find((s) => String(s.id) === newStatusId);
    if (!sel) { toast.error('Select a valid status'); return; }
    if (sel.status_code === 'REGISTERED' && !registerDate) { toast.error('Registration date is required'); return; }
    if (sel.status_code === 'EMI' && !statusRemarks.trim()) { toast.error('Remarks are mandatory for EMI'); return; }
    if (sel.status_code === 'REQUEST_TO_CANCEL' && !cancelReasonId) { toast.error('Select a cancellation reason'); return; }
    setStatusSaving(true);
    try {
      if (sel.status_code === 'EMI') {
        await bookingApi.updateToEMI(activeBooking.id, { remarks: statusRemarks.trim() });
        toast.success('Booking moved to EMI');
      } else if (sel.status_code === 'REQUEST_TO_CANCEL') {
        await bookingApi.requestToCancel(activeBooking.id, { cancel_reason_id: cancelReasonId, cancel_remarks: cancelRemarks });
        toast.success('Cancellation requested');
      } else if (sel.status_code === 'REGISTERED') {
        const fd = new FormData();
        fd.append('registration_date', registerDate);
        await bookingApi.registerBooking(activeBooking.id, fd);
        toast.success('Booking registered');
      } else {
        await bookingApi.update(activeBooking.id, { booking_status_id: newStatusId });
        toast.success('Status updated');
      }
      closeAction();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update status')); }
    finally { setStatusSaving(false); }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!paymentStatus || !activeBooking) { toast.error('Select a payment status'); return; }
    setPayStatusSaving(true);
    try {
      const payload = { payment_status: paymentStatus, payment_status_id: paymentStatusId || null };
      if (followUpDate) payload.next_follow_up_at = followUpDate;
      if (payStatusRemarks.trim()) payload.remarks = payStatusRemarks.trim();
      await bookingApi.updatePaymentStatus(activeBooking.id, payload);
      toast.success('Payment status updated');
      closeAction();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update payment status')); }
    finally { setPayStatusSaving(false); }
  };

  const handleAddPayment = async () => {
    if (!activeBooking) return;
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!payForm.payment_category) { toast.error('Select what this payment is for'); return; }
    if (!payForm.payment_type) { toast.error('Select a payment type'); return; }
    const selMode = paymentModeOptions.find((m) => String(m.id) === String(payForm.payment_mode_id));
    const modeName = selMode?.mode_name || payForm.payment_mode;
    if (!payForm.payment_mode_id || !modeName) { toast.error('Select a payment mode'); return; }
    if (modeName !== 'Cash' && !payForm.transaction_ref.trim()) { toast.error(`Reference / UTR / Cheque No. is required for ${modeName}`); return; }
    setPaySaving(true);
    try {
      await bookingApi.addPayment(activeBooking.id, { ...payForm, payment_mode: modeName, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded');
      closeAction();
      loadBookings();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to record payment')); }
    finally { setPaySaving(false); }
  };

  const filtered = useMemo(() => {
    let list = bookings;
    if (activeTab === 'Today Follow-up') {
      const todayStr = new Date().toISOString().slice(0, 10);
      list = list.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) === todayStr);
    } else if (activeTab === 'Missed Follow-up') {
      const todayStr = new Date().toISOString().slice(0, 10);
      list = list.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) < todayStr);
    }
    if (selectedProjects.length > 0) {
      list = list.filter((b) => {
        const projectId = b.project_id || b.project?.id;
        return selectedProjects.includes(projectId);
      });
    }
    if (selectedStatuses.length > 0) {
      list = list.filter((b) => selectedStatuses.includes(b.status_code));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((b) => [
      b.booking_number, b.customer_name, b.buyer_name, b.project_name,
      b.unit_display, b.unit_number, b.phase_name,
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [bookings, searchQuery, activeTab, selectedProjects, selectedStatuses]);

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 25);

  const todayFollowUpCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return bookings.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) === todayStr).length;
  }, [bookings]);
  const missedFollowUpCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return bookings.filter(b => b.next_follow_up_at && new Date(b.next_follow_up_at).toISOString().slice(0, 10) < todayStr).length;
  }, [bookings]);

  return (
    <div className="col-bookings-page">
      <header className="lead-workspace__header">
        <div>
          <h1>My Collections</h1>
          <p className="hide-mobile">Bookings assigned to you — update status, follow-ups and record payments</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={loadBookings} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="lead-workspace__toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
        <div className="lead-workspace__toolbar-search" style={{ flex: '0 1 400px', minWidth: '200px', order: 1 }}>
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by booking number, buyer, project or unit"
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, order: 2 }}>
          <div style={{ position: 'relative' }} ref={projectFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedProjects.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowProjectFilter(!showProjectFilter)}
              style={{ position: 'relative' }}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Project
              {selectedProjects.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedProjects.length}
                </span>
              )}
            </button>
            {showProjectFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Project</span>
                  {selectedProjects.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={clearProjectFilter}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {projects.map((p) => (
                    <label key={p.id} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(p.id)}
                        onChange={() => handleProjectToggle(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }} ref={statusFilterRef}>
            <button
              type="button"
              className={`workspace-btn workspace-btn--ghost ${selectedStatuses.length > 0 ? 'has-filter' : ''}`}
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              style={{ position: 'relative' }}
            >
              <FunnelIcon style={{ width: 14, height: 14 }} />
              Status
              {selectedStatuses.length > 0 && (
                <span style={{ marginLeft: 4, background: '#3B82F6', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                  {selectedStatuses.length}
                </span>
              )}
            </button>
            {showStatusFilter && (
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Status</span>
                  {selectedStatuses.length > 0 && (
                    <button type="button" className="filter-clear-btn" onClick={clearStatusFilter}>Clear</button>
                  )}
                </div>
                <div className="filter-dropdown-list">
                  {statusOptions.map((s) => (
                    <label key={s.id} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(s.status_code)}
                        onChange={() => handleStatusToggle(s.status_code)}
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color_code || '#6B7280' }} />
                        {s.status_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(selectedProjects.length > 0 || selectedStatuses.length > 0) && (
            <button
              type="button"
              className="workspace-btn workspace-btn--ghost"
              onClick={() => { setSelectedProjects([]); setSelectedStatuses([]); }}
              style={{ color: '#EF4444' }}
            >
              <XMarkIcon style={{ width: 14, height: 14 }} /> Clear all
            </button>
          )}
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
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
            </div>
            <small className="filter-tabs__records">{filtered.length} assigned booking{filtered.length === 1 ? '' : 's'}</small>
          </div>

          {loading ? (
            <div className="simple-loader"><div className="simple-spinner" /><p>Loading...</p></div>
          ) : filtered.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">{searchQuery ? 'No bookings match your search' : 'No bookings assigned to you yet'}</div>
              <div className="col-empty-desc">{searchQuery ? 'Try a different search term' : 'Your Collection Manager will assign bookings to you'}</div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th className="show-mobile lead-col-toggle"></th>
                    <th style={{ width: 'auto' }}>Booking</th>
                    <th className="hide-mobile" style={{ width: 200 }}>Project · Unit</th>
                    <th className="lead-col-status">Status</th>
                    <th className="hide-mobile" style={{ width: 140 }}>Payment Status</th>
                    <th className="lead-col-followup" style={{ textAlign: 'right' }}>Follow-up</th>
                    <th className="hide-mobile" style={{ textAlign: 'center', width: 150 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((booking) => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const fStr = booking.next_follow_up_at ? new Date(booking.next_follow_up_at).toISOString().slice(0, 10) : null;
                    const isMissed = fStr && fStr < todayStr;
                    const fuColor = isMissed ? '#e80d0dff' : '#000000';
                    const arrowColor = isMissed ? '#e80d0dff' : '#000000';
                    const fuDateStr = booking.next_follow_up_at
                      ? new Date(booking.next_follow_up_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—';
                    const isExpanded = expandedMobileBookingId === booking.id;

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
                            <p className="lead-title">{booking.customer_name || booking.buyer_name || '—'}</p>
                            <small>
                              <button type="button" className="col-booking-link" onClick={(e) => { e.stopPropagation(); onSelectBooking(booking.id); }}>
                                {booking.booking_number}
                              </button>
                            </small>
                          </td>
                          <td className="hide-mobile">
                            <p className="lead-title">{booking.project_name || '—'}</p>
                            <small style={{ display: 'block', color: '#64748b', fontSize: 11 }}>Unit: {booking.unit_display || booking.unit_number || 'TBD'}</small>
                          </td>
                          <td className="lead-col-status">
                            <span className="col-badge" style={badgeStyle(booking.status_color)}>
                              <span className="col-badge-dot" style={{ background: badgeColors(booking.status_color).text }} />
                              {booking.status_label || '—'}
                            </span>
                          </td>
                          <td className="hide-mobile">
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{booking.payment_status || '—'}</span>
                          </td>
                          <td className="lead-col-followup" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 400, color: fuColor }}>
                              {fuDateStr}
                              {booking.next_follow_up_at && <ArrowDownLeftIcon style={{ width: 12, height: 12, color: arrowColor }} />}
                            </span>
                          </td>
                          <td className="hide-mobile" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <button type="button" className="view-link" title="View details" onClick={() => onSelectBooking(booking.id)}>View</button>
                              <KebabMenu items={execQaItems(booking, openAction)} />
                            </div>
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
                                    <label>Payment Status</label>
                                    <p>{booking.payment_status || '—'}</p>
                                  </div>
                                  {booking.next_follow_up_at && (
                                    <div className="expanded-info-item">
                                      <label>Next Follow-Up</label>
                                      <p style={{ display: 'flex', alignItems: 'center', gap: 4, color: fuColor, fontWeight: 400 }}>
                                        <span>{fuDateStr}</span>
                                        <ArrowDownLeftIcon style={{ width: 12, height: 12, color: arrowColor }} />
                                      </p>
                                    </div>
                                  )}
                                  <div className="expanded-info-item full-width">
                                    <label>Quick Actions</label>
                                    <div className="col-qa-actions col-qa-actions--mobile" onClick={(e) => e.stopPropagation()}>
                                      <button type="button" className="view-link" title="View details" onClick={() => onSelectBooking(booking.id)}>View</button>
                                      <KebabMenu items={execQaItems(booking, openAction)} />
                                    </div>
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
          {!loading && filtered.length > 0 && (
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </div>
      </div>

      {/* ── Action modals ── */}
      {actionMode && activeBooking && (
        <div className="col-modal-overlay" onClick={closeAction}>
          <div className="qa-modal-panel" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="qa-drawer-handle" />

            {/* Header */}
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{ background: badgeColors(activeBooking.status_color).bg, color: badgeColors(activeBooking.status_color).text, border: `2px solid ${badgeColors(activeBooking.status_color).border}` }}>
                  {(activeBooking.customer_name || 'B')[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="qa-drawer-name">{activeBooking.customer_name || activeBooking.buyer_name || 'Customer'}</div>
                  <div className="qa-drawer-meta">{activeBooking.booking_number} · {activeBooking.project_name}</div>
                  <div className="qa-drawer-budget" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(getComputedTotalValue(activeBooking))}</strong> · Paid: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(activeBooking.total_paid || 0)}</span> · Balance: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{formatCurrency(getComputedTotalValue(activeBooking) - (activeBooking.total_paid || 0))}</span>
                  </div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={closeAction}>×</button>
            </div>

            <div className="qa-drawer-divider" />

            {/* ── BOOKING STATUS UPDATE MODE ── */}
            {actionMode === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 'min(580px, calc(100vh - 170px))' }}>
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
                            <strong>Registration.</strong> Enter the date of registration to complete this status.
                          </div>
                          <div className="bkd-form-group">
                            <label className="bkd-form-label">Date of Registration *</label>
                            <input type="date" className="bkd-form-control" value={registerDate}
                              onChange={(e) => setRegisterDate(e.target.value)} />
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
                            {cancelReasons.map(r => <option key={r.id} value={r.id}>{r.reason_name || r.name}</option>)}
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
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button
                    className="qa-drawer-save-btn"
                    disabled={
                      !newStatusId
                      || statusSaving
                      || (quickStatusOptions.find(s => String(s.id) === newStatusId)?.status_code === 'REGISTERED' && !registerDate)
                      || (quickStatusOptions.find(s => String(s.id) === newStatusId)?.status_code === 'EMI' && !statusRemarks.trim())
                      || (quickStatusOptions.find(s => String(s.id) === newStatusId)?.status_code === 'REQUEST_TO_CANCEL' && !cancelReasonId)
                    }
                    onClick={handleStatusUpdate}
                  >
                    {statusSaving ? 'Updating...' : (
                      <>
                        <CheckCircleIcon style={{ width: 14, height: 14, marginRight: 4 }} />
                        Update Booking Status
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── PAYMENT STATUS UPDATE MODE ── */}
            {actionMode === 'payStatus' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 'min(580px, calc(100vh - 170px))' }}>
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
                            setFollowUpDate(''); setPayStatusRemarks('');
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

                  {/* Contextual fields per payment status */}
                  {(() => {
                    const sel = paymentStatusOptions.find(p => p.id === paymentStatusId);
                    if (!sel) return null;
                    const needsFollowup = sel.needs_followup;
                    const needsRemarks = sel.needs_remarks;
                    return (
                      <div style={{ marginTop: 16, background: 'var(--bg-secondary, #F8FAFC)', border: '1px solid var(--border-primary, #E2E8F0)', borderRadius: 10, padding: '14px 16px' }}>
                        {needsFollowup && (
                          <div className="bkd-form-group" style={{ marginBottom: 10 }}>
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
                  {activeBooking.next_follow_up_at && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarDaysIcon style={{ width: 14, height: 14 }} />
                      Current follow-up: <strong>{new Date(activeBooking.next_follow_up_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                      {activeBooking.custom_fields?.last_payment_remarks && <span> · {activeBooking.custom_fields.last_payment_remarks}</span>}
                    </div>
                  )}
                </div>
                <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
                  <button className="qa-drawer-save-btn" style={{ background: '#6366F1' }} disabled={!paymentStatus || payStatusSaving} onClick={handlePaymentStatusUpdate}>
                    {payStatusSaving ? 'Updating...' : <><CreditCardIcon style={{ width: 14, height: 14, marginRight: 4 }} />Update Payment Status</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── RECORD PAYMENT MODE ── */}
            {actionMode === 'pay' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 'min(580px, calc(100vh - 170px))' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
                    <div>Net: <strong>{formatCurrency(getComputedTotalValue(activeBooking))}</strong></div>
                    <div>Paid: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(activeBooking.total_paid || 0)}</strong></div>
                    <div>Balance: <strong style={{ color: 'var(--accent-red)' }}>{formatCurrency(getComputedTotalValue(activeBooking) - (activeBooking.total_paid || 0))}</strong></div>
                  </div>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Record New Payment</div>
                  {(() => {
                    const buckets = getDrawerCategoryBuckets(activeBooking);
                    const selectedBucket = buckets.find(b => b.key === payForm.payment_category);
                    return (
                      <>
                        <div className="bkd-form-row">
                          <div className="bkd-form-group" style={{ flex: 1 }}>
                            <label className="bkd-form-label">Payment For (Category) *</label>
                            <select className="bkd-form-control" value={payForm.payment_category}
                              onChange={e => setPayForm(p => ({ ...p, payment_category: e.target.value }))}>
                              <option value="">Select what this payment is for</option>
                              {PAYMENT_CATEGORIES.filter((cat) => {
                                if (cat === 'Other') return false;
                                // Collection Executives don't collect "Other Registration Expenses".
                                if (cat === 'Other Registration Expenses') return false;
                                const bucket = buckets.find(b => b.key === cat);
                                if (cat === 'MODT') return (bucket?.target || 0) > 0 || (bucket?.paid || 0) > 0;
                                return true;
                              }).map((cat) => {
                                const bucket = buckets.find(b => b.key === cat);
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
                      <input type="date" className="bkd-form-control" value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                    </div>
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Amount (₹) *</label>
                      <input type="number" className="bkd-form-control" placeholder="e.g. 500000" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
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
                      <input type="text" className="bkd-form-control" placeholder="e.g. UTR123456" value={payForm.transaction_ref} onChange={e => setPayForm(p => ({ ...p, transaction_ref: e.target.value }))} />
                    </div>
                  </div>
                  <div className="bkd-form-row">
                    <div className="bkd-form-group">
                      <label className="bkd-form-label">Payment Type *</label>
                      <select className="bkd-form-control" value={payForm.payment_type} onChange={e => setPayForm(p => ({ ...p, payment_type: e.target.value }))}>
                        <option value="">Select payment type</option>
                        {paymentTypeOptions.map((type) => <option key={type.id} value={type.type_name}>{type.type_name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="bkd-form-group">
                    <label className="bkd-form-label">Remarks</label>
                    <textarea className="bkd-form-control" rows={2} placeholder="Remarks..." value={payForm.remarks} onChange={e => setPayForm(p => ({ ...p, remarks: e.target.value }))} />
                  </div>
                  <div className="bkd-info-banner">This payment will be sent to <strong>Accounts Executive</strong> for verification. Status will show as <em>Unverified</em> until approved.</div>
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
    </div>
  );
};

export default CollectionExecBookings;
