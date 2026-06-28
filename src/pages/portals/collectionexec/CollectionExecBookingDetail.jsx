import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import paymentStatusApi from '../../../api/paymentStatusApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency } from '../../../utils/formatters';
import {
  ArrowLeftIcon, ArrowPathIcon, PencilSquareIcon, CreditCardIcon, PlusIcon,
  CloudArrowUpIcon, DocumentTextIcon, ArrowDownTrayIcon, UserIcon, ClockIcon,
  CheckCircleIcon, ExclamationTriangleIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import '../common/LeadWorkspacePage.css';
import '../collection/CollectionWorkspace.css';

const fmtD = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const humanFileSize = (bytes) => {
  if (!bytes) return '';
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

const InfoRow = ({ label, value, mono, color }) => (
  <div className="bkd-info-item">
    <div className="bkd-info-label">{label}</div>
    <div className={`bkd-info-value${mono ? ' mono' : ''}`} style={color ? { color } : undefined}>{value || '—'}</div>
  </div>
);

const PAYMENT_CATEGORIES = ['Plot Value', 'Stamp Duty', 'Development', 'Registration', 'Registration Expenses', 'Other Registration Expenses', 'MODT', 'Other'];
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

const CollectionExecBookingDetail = ({ bookingId, onBack }) => {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // documents + activity
  const [documents, setDocuments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      setBooking(resp.data?.data || resp.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking'));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const loadDocuments = useCallback(async () => {
    try {
      const resp = await bookingApi.getDocuments(bookingId);
      setDocuments(resp.data?.data || resp.data || []);
    } catch { /* non-fatal */ }
  }, [bookingId]);

  const loadActivities = useCallback(async () => {
    try {
      const resp = await bookingApi.getActivities(bookingId);
      setActivities(resp.data?.data || resp.data || []);
    } catch { /* non-fatal */ }
  }, [bookingId]);

  useEffect(() => { loadBooking(); loadDocuments(); loadActivities(); }, [loadBooking, loadDocuments, loadActivities]);
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

  const refresh = () => { loadBooking(); loadActivities(); };

  const quickStatusOptions = statusOptions.filter((s) => QUICK_STATUS_CODES.includes(s.status_code));

  const openAction = (mode) => {
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
  const closeAction = () => setActionMode(null);

  const handleStatusUpdate = async () => {
    if (!newStatusId) return;
    const sel = quickStatusOptions.find((s) => String(s.id) === newStatusId);
    if (!sel) { toast.error('Select a valid status'); return; }
    if (sel.status_code === 'REGISTERED' && !registerDate) { toast.error('Registration date is required'); return; }
    if (sel.status_code === 'EMI' && !statusRemarks.trim()) { toast.error('Remarks are mandatory for EMI'); return; }
    if (sel.status_code === 'REQUEST_TO_CANCEL' && !cancelReasonId) { toast.error('Select a cancellation reason'); return; }
    setStatusSaving(true);
    try {
      if (sel.status_code === 'EMI') {
        await bookingApi.updateToEMI(bookingId, { remarks: statusRemarks.trim() });
        toast.success('Booking moved to EMI');
      } else if (sel.status_code === 'REQUEST_TO_CANCEL') {
        await bookingApi.requestToCancel(bookingId, { cancel_reason_id: cancelReasonId, cancel_remarks: cancelRemarks });
        toast.success('Cancellation requested');
      } else if (sel.status_code === 'REGISTERED') {
        const fd = new FormData();
        fd.append('registration_date', registerDate);
        await bookingApi.registerBooking(bookingId, fd);
        toast.success('Booking registered');
      } else {
        await bookingApi.update(bookingId, { booking_status_id: newStatusId });
        toast.success('Status updated');
      }
      closeAction(); refresh();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update status')); }
    finally { setStatusSaving(false); }
  };

  const handlePaymentStatusUpdate = async () => {
    if (!paymentStatus) { toast.error('Select a payment status'); return; }
    setPayStatusSaving(true);
    try {
      const payload = { payment_status: paymentStatus, payment_status_id: paymentStatusId || null };
      if (followUpDate) payload.next_follow_up_at = followUpDate;
      if (payStatusRemarks.trim()) payload.remarks = payStatusRemarks.trim();
      await bookingApi.updatePaymentStatus(bookingId, payload);
      toast.success('Payment status updated');
      closeAction(); refresh();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to update payment status')); }
    finally { setPayStatusSaving(false); }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (!payForm.payment_category) { toast.error('Select what this payment is for'); return; }
    if (!payForm.payment_type) { toast.error('Select a payment type'); return; }
    const selMode = paymentModeOptions.find((m) => String(m.id) === String(payForm.payment_mode_id));
    const modeName = selMode?.mode_name || payForm.payment_mode;
    if (!payForm.payment_mode_id || !modeName) { toast.error('Select a payment mode'); return; }
    if (modeName !== 'Cash' && !payForm.transaction_ref.trim()) { toast.error(`Reference / UTR / Cheque No. is required for ${modeName}`); return; }
    setPaySaving(true);
    try {
      await bookingApi.addPayment(bookingId, { ...payForm, payment_mode: modeName, amount: parseFloat(payForm.amount) });
      toast.success('Payment recorded');
      closeAction(); refresh();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to record payment')); }
    finally { setPaySaving(false); }
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) { toast.error('Select at least one file'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      selectedFiles.forEach((f) => fd.append('documents', f));
      fd.append('document_type', 'Collection Document');
      await bookingApi.uploadDocuments(bookingId, fd);
      toast.success('Documents uploaded');
      setSelectedFiles([]);
      loadDocuments(); loadActivities();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed to upload documents')); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="simple-loader"><div className="simple-spinner" /><p>Loading...</p></div>;
  if (!booking) return (
    <div className="col-empty">
      <div className="col-empty-title">Booking not found</div>
      <button className="bkd-btn bkd-btn-ghost bkd-btn-sm" onClick={onBack}>Go Back</button>
    </div>
  );

  const statusColor = booking.status_color || '#6B7280';
  const buyerName = booking.buyer_name || booking.customer_name || '—';
  const customer = booking.customer || {};
  const phoneRaw = customer.phone || customer.phone_number || '';
  const phone = /^\s*LD[-_ ]?\d+\s*$/i.test(String(phoneRaw || '')) ? '—' : (phoneRaw || '—');

  return (
    <div className="bkd-page">
      <div className="bkd-header">
        <div className="bkd-header-left">
          <button className="bkd-back-btn" onClick={onBack}><ArrowLeftIcon style={{ width: 16, height: 16 }} /></button>
          <div>
            <h1 className="bkd-title">
              Booking {booking.booking_number}{' '}
              <span className="bkd-status-badge" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                {booking.status_label || '—'}
              </span>
            </h1>
            <p className="bkd-subtitle">{booking.project_name} · {booking.unit_display || booking.unit_number || 'N/A'}</p>
          </div>
        </div>
        <div className="bkd-header-actions">
          <button className="bkd-btn bkd-btn-outline" onClick={() => openAction('payStatus')}><CreditCardIcon style={{ width: 14, height: 14 }} /> Payment Status</button>
          <button className="bkd-btn bkd-btn-outline" onClick={() => openAction('status')}><PencilSquareIcon style={{ width: 14, height: 14 }} /> Booking Status</button>
          <button className="bkd-btn bkd-btn-primary" onClick={() => openAction('pay')}><PlusIcon style={{ width: 14, height: 14 }} /> Add Payment</button>
          <button className="bkd-btn bkd-btn-ghost" onClick={refresh} title="Refresh"><ArrowPathIcon style={{ width: 14, height: 14 }} /></button>
        </div>
      </div>

      {/* Single column — booking data + uploads + activity. No financial summary. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820 }}>
        <div className="bkd-card">
          <div className="bkd-card-header"><div className="bkd-card-title"><UserIcon style={{ width: 15, height: 15 }} /> Booking Details</div></div>
          <div className="bkd-card-body">
            <div className="bkd-info-grid">
              <InfoRow label="Buyer Name" value={buyerName} />
              <InfoRow label="Customer Phone" value={phone} mono />
              <InfoRow label="Booking Number" value={booking.booking_number} mono />
              <InfoRow label="Booking Date" value={fmtD(booking.booking_date)} />
              <InfoRow label="Project" value={booking.project_name} />
              <InfoRow label="Phase" value={booking.phase_name || '—'} />
              <InfoRow label="Unit" value={booking.unit_display || booking.unit_number || '—'} />
              <InfoRow label="Booking Status" value={booking.status_label} color={statusColor} />
              <InfoRow label="Payment Status" value={booking.payment_status || '—'} />
              <InfoRow label="Next Follow-up" value={fmtD(booking.next_follow_up_at)} />
              {booking.lead?.lead_number && <InfoRow label="Lead" value={booking.lead.lead_number} mono />}
            </div>
          </div>
        </div>

        {/* Uploads */}
        <div className="bkd-card">
          <div className="bkd-card-header"><div className="bkd-card-title"><CloudArrowUpIcon style={{ width: 15, height: 15 }} /> Documents</div></div>
          <div className="bkd-card-body">
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: '1.5px dashed var(--border-primary, #cbd5e1)', borderRadius: 10, padding: 18, textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
            >
              <CloudArrowUpIcon style={{ width: 26, height: 26, color: 'var(--text-muted)', margin: '0 auto 6px' }} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Click to choose files</div>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { setSelectedFiles((p) => [...p, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
            </div>
            {selectedFiles.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {selectedFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 10px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6, marginBottom: 6 }}>
                    <span>📎 {f.name} <span style={{ color: 'var(--text-muted)' }}>· {humanFileSize(f.size)}</span></span>
                    <button type="button" onClick={() => setSelectedFiles((p) => p.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}
                <button className="bkd-btn bkd-btn-primary" disabled={uploading} onClick={handleUpload}><CloudArrowUpIcon style={{ width: 14, height: 14 }} /> {uploading ? 'Uploading…' : 'Upload'}</button>
              </div>
            )}
            {documents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No documents yet.</div>
            ) : documents.map((doc) => {
              const href = doc.file_url || doc.download_url;
              const uploader = doc.uploader ? `${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`.trim() : '';
              return (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                  <DocumentTextIcon style={{ width: 22, height: 22, color: 'var(--text-muted)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{doc.document_name || doc.file_name || 'Document'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                      {uploader && <span>{uploader}</span>}
                      <span>{fmtDateTime(doc.created_at)}</span>
                    </div>
                  </div>
                  {href && <a className="bkd-btn bkd-btn-ghost bkd-btn-sm" href={href} target="_blank" rel="noreferrer"><ArrowDownTrayIcon style={{ width: 13, height: 13 }} /></a>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity (creator + assignee shared updates) */}
        <div className="bkd-card">
          <div className="bkd-card-header"><div className="bkd-card-title"><ClockIcon style={{ width: 15, height: 15 }} /> Activity</div></div>
          <div className="bkd-card-body">
            {activities.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No activity yet.</div>
            ) : activities.slice(0, 20).map((act, i) => (
              <div key={act.id || i} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: i < Math.min(activities.length, 20) - 1 ? '1px solid var(--border-primary, #e2e8f0)' : 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{act.title}</div>
                {act.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{act.description}</div>}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                  {act.performedBy ? `${act.performedBy.first_name} ${act.performedBy.last_name}` : ''} · {fmtDateTime(act.performed_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action modals ── */}
      {actionMode && (
        <div className="col-modal-overlay" onClick={closeAction}>
          <div className="qa-modal-panel" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="qa-drawer-handle" />
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar">
                  {actionMode === 'status' ? '✏️' : actionMode === 'payStatus' ? '💳' : '＋'}
                </div>
                <div>
                  <div className="qa-drawer-name">{buyerName}</div>
                  <div className="qa-drawer-meta">{booking.booking_number} · {booking.project_name}</div>
                  <div className="qa-drawer-budget" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(getComputedTotalValue(booking))}</strong> · Paid: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(booking.total_paid || 0)}</span> · Balance: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{formatCurrency(getComputedTotalValue(booking) - (booking.total_paid || 0))}</span>
                  </div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={closeAction}>×</button>
            </div>

            <div className="qa-drawer-divider" />

            {/* ── BOOKING STATUS UPDATE MODE ── */}
            {actionMode === 'status' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '580px' }}>
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
                  {booking.next_follow_up_at && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CalendarDaysIcon style={{ width: 14, height: 14 }} />
                      Current follow-up: <strong>{new Date(booking.next_follow_up_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                      {booking.custom_fields?.last_payment_remarks && <span> · {booking.custom_fields.last_payment_remarks}</span>}
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
              <div style={{ display: 'flex', flexDirection: 'column', height: '580px' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
                    <div>Net: <strong>{formatCurrency(getComputedTotalValue(booking))}</strong></div>
                    <div>Paid: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(booking.total_paid || 0)}</strong></div>
                    <div>Balance: <strong style={{ color: 'var(--accent-red)' }}>{formatCurrency(getComputedTotalValue(booking) - (booking.total_paid || 0))}</strong></div>
                  </div>
                  <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>Record New Payment</div>
                  {(() => {
                    const buckets = getDrawerCategoryBuckets(booking);
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

export default CollectionExecBookingDetail;
