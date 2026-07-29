import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../api/bookingApi';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import { badgeColors } from '../../utils/badgeColors';
import { computeStampValue, computeRegistrationValue, computeStampCommission, registrationRateOf } from '../../utils/bookingRates';
import '../../pages/portals/common/LeadWorkspacePage.css';
import '../../pages/portals/collection/CollectionWorkspace.css';

/**
 * The rich Record / Edit Payment modal — the same model used on the booking
 * detail page (CollectionBookingDetail), extracted so other pages (e.g. the
 * Collection Payments transaction list) can open it. Give it a `bookingId`; it
 * fetches the full booking itself so the per-category budget buckets and bars
 * are real. Pass `paymentId` to edit an existing payment (prefilled), or omit
 * it to record a new one. Calls `onSaved()` then `onClose()` after a save.
 */

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
const CATEGORY_LABELS = {
  'Registration': 'Registration Fees',
  'Registration Expenses': 'Registration Expenses',
};
const categoryLabel = (cat) => CATEGORY_LABELS[cat] || cat;

const toAmount = (v) => {
  const n = parseFloat(v || 0);
  return Number.isFinite(n) ? n : 0;
};

// Derive net value + per-category targets/collected from a full booking. This
// mirrors the computation in CollectionBookingDetail so the buckets match.
const computeBudget = (booking) => {
  const payments = booking?.payments || [];
  const guidelineRate = toAmount(booking?.guideline_value);
  const plotAreaSqft = toAmount(booking?.plot_area);
  const perSqftCost = toAmount(booking?.development_cost_per_sqft);
  let plotValue;
  let stampValue;
  let registrationValue;
  if (guidelineRate > 0 && plotAreaSqft > 0) {
    plotValue = Math.ceil((guidelineRate * plotAreaSqft) / 100) * 100; // ROUNDUP to nearest 100
    stampValue = computeStampValue(plotValue);                                     // ROUNDUP(7%, -1)
    registrationValue = computeRegistrationValue(plotValue, registrationRateOf(booking)); // ROUNDUP(rate%, -1)
  } else {
    plotValue = toAmount(booking?.plot_value || booking?.base_price || booking?.total_amount || booking?.net_amount);
    stampValue = toAmount(booking?.stamp_value || booking?.stamp_duty);
    registrationValue = toAmount(booking?.registration_exp || booking?.registration_charges);
  }
  const developmentValue = (perSqftCost > 0 && plotAreaSqft > 0)
    ? Math.round(plotAreaSqft * perSqftCost * 1.18)
    : toAmount(booking?.development_charges);

  const sumSplit = (split) => Object.values(split || {}).reduce((sum, v) => sum + toAmount(v), 0);
  const costBreakdown = booking?.custom_fields?.cost_breakdown || {};
  // Stamp Commission is always 1% of Stamp Value (computed).
  const stampCommission = computeStampCommission(stampValue);
  const savedRegSplit = { ...(costBreakdown.registration_split || {}), stamp_commission: stampCommission };
  const savedModtEnabled = !!costBreakdown.modt_enabled;
  const savedModtSplit = costBreakdown.modt_split || {};
  const regSplitTotal = sumSplit(savedRegSplit);
  const modtSplitTotal = savedModtEnabled ? sumSplit(savedModtSplit) : 0;
  const otherChargesTotal = regSplitTotal + modtSplitTotal;

  const computedTotalValue = plotValue + stampValue + registrationValue + developmentValue + otherChargesTotal;
  const totalValue = computedTotalValue > 0 ? computedTotalValue : toAmount(booking?.net_amount || booking?.total_amount);
  const totalPaid = toAmount(booking?.total_paid);

  const paidByCategory = payments.reduce((acc, p) => {
    if (p.is_bounced) return acc;
    const cat = p.payment_category || 'Other';
    acc[cat] = (acc[cat] || 0) + toAmount(p.amount);
    return acc;
  }, {});

  const filteredCategories = PAYMENT_CATEGORIES.filter((cat) => {
    if (cat === 'MODT') return savedModtEnabled || (paidByCategory['MODT'] > 0);
    if (cat === 'Other') return false;
    return true;
  });

  const otherRegExpensesTarget = toAmount(savedRegSplit.other_registration_expenses);
  const regMiscExpensesTarget = regSplitTotal - otherRegExpensesTarget;
  const categoryBuckets = [
    { key: 'Plot Value', target: plotValue, paid: paidByCategory['Plot Value'] || 0 },
    { key: 'Stamp Duty', target: stampValue, paid: paidByCategory['Stamp Duty'] || 0 },
    { key: 'Development', target: developmentValue, paid: paidByCategory['Development'] || 0 },
    { key: 'Registration', target: registrationValue, paid: paidByCategory['Registration'] || 0 },
    { key: 'Registration Expenses', target: regMiscExpensesTarget, paid: paidByCategory['Registration Expenses'] || 0 },
    { key: 'Other Registration Expenses', target: otherRegExpensesTarget, paid: paidByCategory['Other Registration Expenses'] || 0 },
    { key: 'MODT', target: modtSplitTotal, paid: paidByCategory['MODT'] || 0 },
    { key: 'Other', target: 0, paid: paidByCategory['Other'] || 0 },
  ];

  return { totalValue, totalPaid, filteredCategories, categoryBuckets };
};

const emptyForm = { payment_category: '', payment_mode_id: '', payment_mode: '', amount: '', payment_date: '', transaction_ref: '', bank_id: '', remarks: '' };

const RecordPaymentModal = ({ bookingId, paymentId = null, readOnly = false, onClose, onSaved }) => {
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentModeOptions, setPaymentModeOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [payForm, setPayForm] = useState(emptyForm);

  const isEditing = !!paymentId;

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const resp = await bookingApi.getById(bookingId);
      const b = resp.data?.data || resp.data;
      setBooking(b);
      if (paymentId) {
        const p = (b?.payments || []).find((x) => String(x.id) === String(paymentId));
        if (p) {
          setPayment(p);
          setPayForm({
            payment_category: p.payment_category || '',
            payment_mode_id: p.payment_mode_id || '',
            payment_mode: p.payment_mode || '',
            amount: p.amount ?? '',
            payment_date: p.payment_date ? String(p.payment_date).slice(0, 10) : '',
            transaction_ref: p.transaction_ref || p.utr_number || p.cheque_dd_number || '',
            bank_id: p.bank_id || '',
            remarks: p.remarks || '',
          });
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load booking'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, paymentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bookingApi.getPaymentFormMasters().then((r) => {
      const payload = r.data?.data || r.data || {};
      setPaymentModeOptions(payload.payment_modes || []);
      setBankOptions(payload.banks || []);
    }).catch(() => {
      setPaymentModeOptions([]);
      setBankOptions([]);
    });
  }, []);

  const handleSave = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    if (!payForm.payment_category) {
      toast.error('Please select what this payment is for (Plot, Stamp, Registration, Development, or MODT)');
      return;
    }
    const selectedMode = paymentModeOptions.find((mode) => String(mode.id) === String(payForm.payment_mode_id));
    const selectedModeName = selectedMode?.mode_name || payForm.payment_mode;
    if (!payForm.payment_mode_id || !selectedModeName) { toast.error('Please select a payment mode'); return; }
    if (selectedModeName !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim())) {
      toast.error(`Reference / UTR / Cheque No. is required for ${selectedModeName}`);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...payForm, payment_mode: selectedModeName, amount: parseFloat(payForm.amount) };
      if (isEditing) {
        await bookingApi.updatePayment(bookingId, paymentId, payload);
        toast.success('Payment updated');
      } else {
        await bookingApi.addPayment(bookingId, payload);
        toast.success('Payment recorded');
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const { totalValue, totalPaid, filteredCategories, categoryBuckets } = computeBudget(booking || {});
  const statusBadge = badgeColors(booking?.status_color, '#1D4ED8');

  const saveDisabled = saving || !payForm.amount || !payForm.payment_category || !payForm.payment_mode_id || (payForm.payment_mode !== 'Cash' && (!payForm.transaction_ref || !payForm.transaction_ref.trim()));
  const statusLabel = payment?.is_verified ? 'verified' : payment?.is_bounced ? 'rejected' : payment?.is_refund ? 'a refund' : 'locked';

  return (
    <div className="col-modal-overlay" onClick={onClose}>
      <div className="qa-modal-panel" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
        <div className="qa-drawer-handle" />
        <div className="qa-drawer-header">
          <div className="qa-drawer-header-left">
            <div className="qa-drawer-avatar" style={{ background: statusBadge.bg, color: statusBadge.text, border: `2px solid ${statusBadge.border}` }}>
              {(booking?.customer_name || 'B')[0]?.toUpperCase()}
            </div>
            <div>
              <div className="qa-drawer-name">{booking?.customer_name || booking?.buyer_name || 'Customer'}</div>
              <div className="qa-drawer-meta">{booking?.booking_number || ''}{booking?.project_name ? ` · ${booking.project_name}` : ''}</div>
              <div className="qa-drawer-budget" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                Net: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalValue)}</strong> · Paid: <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{formatCurrency(totalPaid)}</span> · Balance: <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>{formatCurrency(totalValue - totalPaid)}</span>
              </div>
            </div>
          </div>
          <button className="qa-drawer-close" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, maxHeight: 520 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <fieldset disabled={readOnly} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                {/* Net / Paid / Balance already sits in the drawer header — no repeat here. */}
                <div className="qa-drawer-section" style={{ padding: '0 0 10px' }}>{readOnly ? 'Payment Details' : isEditing ? 'Edit Payment' : 'Record New Payment'}</div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group" style={{ flex: 1 }}>
                    <label className="bkd-form-label">Payment Towards *</label>
                    <select className="bkd-form-control" value={payForm.payment_category}
                      onChange={(e) => setPayForm((p) => ({ ...p, payment_category: e.target.value }))}>
                      <option value="">Select what this payment is for</option>
                      {filteredCategories.map((cat) => {
                        const bucket = categoryBuckets.find((b) => b.key === cat);
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
                  const bucket = categoryBuckets.find((b) => b.key === payForm.payment_category);
                  if (!bucket) return null;
                  const c = CATEGORY_COLORS[payForm.payment_category] || CATEGORY_COLORS.Other;
                  const balance = Math.max(bucket.target - bucket.paid, 0);
                  const pct = bucket.target > 0 ? Math.min(100, Math.round((bucket.paid / bucket.target) * 100)) : 0;
                  return (
                    <div style={{ marginBottom: 12, padding: '10px 12px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 12, fontWeight: 600 }}>
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
                  <div className="bkd-form-group"><label className="bkd-form-label">Payment Date *</label><input type="date" className="bkd-form-control" value={payForm.payment_date} onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))} /></div>
                  <div className="bkd-form-group"><label className="bkd-form-label">Amount (₹) *</label><input type="number" className="bkd-form-control" placeholder="e.g. 500000" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} /></div>
                </div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group"><label className="bkd-form-label">Payment Mode *</label>
                    <select className="bkd-form-control" value={payForm.payment_mode_id} onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedMode = paymentModeOptions.find((mode) => String(mode.id) === String(selectedId));
                      setPayForm((p) => ({ ...p, payment_mode_id: selectedId, payment_mode: selectedMode?.mode_name || '' }));
                    }}>
                      <option value="">Select payment mode</option>
                      {paymentModeOptions.map((mode) => <option key={mode.id} value={mode.id}>{mode.mode_name}</option>)}
                    </select></div>
                  <div className="bkd-form-group"><label className="bkd-form-label">Reference / UTR / Cheque No. {payForm.payment_mode !== 'Cash' ? '*' : ''}</label><input type="text" className="bkd-form-control" placeholder="e.g. UTR123456" value={payForm.transaction_ref} onChange={(e) => setPayForm((p) => ({ ...p, transaction_ref: e.target.value }))} /></div>
                </div>
                <div className="bkd-form-row">
                  <div className="bkd-form-group"><label className="bkd-form-label">Company Bank</label>
                    <select className="bkd-form-control" value={payForm.bank_id || ''} onChange={(e) => setPayForm((p) => ({ ...p, bank_id: e.target.value }))}>
                      <option value="">Select bank</option>
                      {bankOptions.map((bank) => (
                        <option key={bank.id} value={bank.id}>{bank.bank_name} - {bank.account_number}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bkd-form-group"><label className="bkd-form-label">Remarks</label><textarea className="bkd-form-control" rows={2} placeholder="Notes for accounts team..." value={payForm.remarks} onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.target.value }))} /></div>
                {readOnly ? (
                  <div className="bkd-info-banner">This payment is {statusLabel} and can no longer be edited.</div>
                ) : (
                  <div className="bkd-info-banner">This payment will be sent to <strong>Accounts Executive</strong> for verification. Status will show as <em>Unverified</em> until approved.</div>
                )}
              </fieldset>
            </div>
            <div className="qa-drawer-save-row" style={{ padding: '16px 20px', position: 'relative', borderTop: '1px solid var(--border-primary)' }}>
              {readOnly ? (
                <button className="qa-drawer-save-btn" onClick={onClose}>Close</button>
              ) : (
                <button className="qa-drawer-save-btn" disabled={saveDisabled} onClick={handleSave}>
                  {saving ? 'Saving...' : (isEditing ? 'Update Payment' : 'Submit Payment')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordPaymentModal;
