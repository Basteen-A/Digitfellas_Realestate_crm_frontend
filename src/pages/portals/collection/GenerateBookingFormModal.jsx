import React, { useMemo, useState } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { generateBookingConfirmationPDF } from '../../../utils/BookingConfirmationPDF';

/* ── helpers ── */
const toNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = (v) => `₹${toNum(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const last4 = (acc) => String(acc || '').replace(/\s/g, '').slice(-4);

// Same rules the PDF renderer (BookingConfirmationPDF.js) uses: stored booking
// values win (they are what was billed and collected), and the guideline × area
// formula only fills values that were never stored — so the prefilled totals
// match what the generated document shows.
export const computeBookingTotals = (booking) => {
  const empty = { plotTotal: 0, devTotal: 0, stamp: 0, reg: 0, commission: 0, regExpenses: 0, other: 0, documentation: 0, totalValue: 0 };
  if (!booking) return empty;
  const guidelineRate = toNum(booking.guideline_value);
  const plotAreaSqft = toNum(booking.plot_area);
  const perSqftCost = toNum(booking.development_cost_per_sqft);
  const formulaPlot = (guidelineRate > 0 && plotAreaSqft > 0)
    ? Math.ceil((guidelineRate * plotAreaSqft) / 100) * 100
    : 0;
  const plotTotal = toNum(booking.plot_value) > 0
    ? toNum(booking.plot_value)
    : (formulaPlot > 0 ? formulaPlot : toNum(booking.base_price || booking.total_amount || booking.net_amount));
  const devTotal = toNum(booking.development_charges) > 0
    ? toNum(booking.development_charges)
    : ((perSqftCost > 0 && plotAreaSqft > 0) ? Math.round(plotAreaSqft * perSqftCost * 1.18) : 0);
  // Documentation charges (stored-first, same fallbacks + rounding the PDF uses).
  const rs = booking.custom_fields?.cost_breakdown?.registration_split || {};
  const storedStamp = toNum(booking.stamp_value || booking.stamp_duty);
  const storedReg = toNum(booking.registration_exp || booking.registration_charges);
  const stamp = storedStamp > 0 ? storedStamp : plotTotal * 0.07;
  const reg = storedReg > 0 ? storedReg : plotTotal * 0.02;
  const commission = toNum(rs.stamp_commission) > 0 ? toNum(rs.stamp_commission) : Math.round(stamp * 0.01);
  const regExpenses = toNum(rs.registration_expenses) + toNum(rs.writer_expenses) + toNum(rs.patta_charges);
  const other = toNum(rs.other_registration_expenses);
  const documentation = stamp + commission + reg + regExpenses + other;
  const totalValue = plotTotal + devTotal + documentation;
  return { plotTotal, devTotal, stamp, reg, commission, regExpenses, other, documentation, totalValue };
};

/* ── shared inline styles ── */
const inputStyle = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8,
  border: '1px solid var(--border-input, #cbd5e1)', padding: '8px 10px',
  fontSize: 13, fontFamily: 'inherit', background: 'var(--bg-card, #fff)', color: 'var(--text-primary, #0f172a)',
};
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #475569)', marginBottom: 6 };
const iconBtnStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, width: 36,
  borderRadius: 8, border: '1px solid var(--border-input, #cbd5e1)', background: 'var(--bg-card, #fff)',
  color: '#DC2626', cursor: 'pointer', flexShrink: 0,
};
const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 2,
  background: 'var(--bg-card, #fff)', border: '1px solid var(--border-input, #cbd5e1)', borderRadius: 8,
  boxShadow: '0 12px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0,
};

/* ── searchable bank dropdown ── */
const BankSelect = ({ banks, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = banks.find((b) => b.id === value);
  const label = (b) => `${b.bank_name}${b.account_number ? ` (…${last4(b.account_number)})` : ''}`;
  const filtered = query
    ? banks.filter((b) => `${b.bank_name} ${b.account_number}`.toLowerCase().includes(query.toLowerCase()))
    : banks;
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={open ? query : (selected ? label(selected) : '')}
        placeholder="Search bank account…"
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={inputStyle}
      />
      {open && (
        <ul style={dropdownStyle}>
          {filtered.length === 0 && (
            <li style={{ padding: '8px 10px', color: '#94a3b8', fontSize: 12 }}>No matching bank accounts</li>
          )}
          {filtered.map((b) => (
            <li
              key={b.id}
              onMouseDown={() => { onChange(b); setOpen(false); }}
              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)' }}
            >
              <div style={{ fontWeight: 600 }}>{label(b)}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {b.branch_name || ''}{b.branch_name && b.ifsc_code ? ' · ' : ''}{b.ifsc_code || ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── a split section (Plot Amount / Development Charges) ── */
const SplitSection = ({ title, total, banks, rows, setRows, optional }) => {
  const sum = rows.reduce((s, r) => s + toNum(r.amount), 0);
  const remaining = Math.round((total - sum) * 100) / 100;
  const balanced = Math.abs(remaining) < 1;
  const addRow = () => setRows([...rows, { bank_id: '', account_name: '', amount: '' }]);
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const update = (i, patch) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const onBank = (i, b) => update(i, { bank_id: b.id, account_name: b.bank_name || '' });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
          {title}
          {optional && <span style={{ fontWeight: 500, fontSize: 11.5, color: '#94a3b8', marginLeft: 6 }}>(optional)</span>}
        </h4>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total: {fmt(total)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 0.9fr auto', gap: 8, marginBottom: 6, fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
        <span>Bank account</span><span>Account name (prints on form)</span><span>Amount</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 0.9fr auto', gap: 8, marginBottom: 8, alignItems: 'start' }}>
          <BankSelect banks={banks} value={r.bank_id} onChange={(b) => onBank(i, b)} />
          <input type="text" placeholder="Account name" value={r.account_name} onChange={(e) => update(i, { account_name: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Amount" value={r.amount} onChange={(e) => update(i, { amount: e.target.value })} style={inputStyle} />
          <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1} title="Remove row" style={{ ...iconBtnStyle, opacity: rows.length === 1 ? 0.4 : 1, cursor: rows.length === 1 ? 'not-allowed' : 'pointer' }}>
            <TrashIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <button type="button" className="bkd-btn bkd-btn-outline bkd-btn-sm" onClick={addRow}>
          <PlusIcon style={{ width: 14, height: 14 }} /> Add Bank Account
        </button>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: balanced ? '#16A34A' : '#64748b' }}>
          {balanced ? 'Balanced ✓' : `Allocated: ${fmt(sum)} / ${fmt(total)}`}
        </span>
      </div>
    </div>
  );
};

/* ── modal ── */
const GenerateBookingFormModal = ({ booking, banks, terms, onClose }) => {
  const { plotTotal, devTotal, stamp, reg, commission, regExpenses, other, totalValue } = useMemo(() => computeBookingTotals(booking), [booking]);
  const activeBanks = useMemo(() => (banks || []).filter((b) => b.is_active !== false), [banks]);

  const [formName, setFormName] = useState(booking?.buyer_name || booking?.customer?.buyer_name || booking?.customer_name || '');
  const [plotRows, setPlotRows] = useState([{ bank_id: '', account_name: '', amount: plotTotal ? String(plotTotal) : '' }]);
  const [devRows, setDevRows] = useState(devTotal > 0 ? [{ bank_id: '', account_name: '', amount: String(devTotal) }] : []);
  const initRows = (total) => [{ bank_id: '', account_name: '', amount: total ? String(total) : '' }];
  const [stampRows, setStampRows] = useState(() => initRows(stamp));
  const [regRows, setRegRows] = useState(() => initRows(reg));
  const [commissionRows, setCommissionRows] = useState(() => initRows(commission));
  const [regExpRows, setRegExpRows] = useState(() => initRows(regExpenses));
  const [otherRows, setOtherRows] = useState(() => initRows(other));

  const buildSplits = (rows) => rows.filter((r) => r.bank_id).map((r) => {
    const b = activeBanks.find((x) => x.id === r.bank_id) || {};
    return {
      bank_id: r.bank_id,
      account_name: (r.account_name || b.bank_name || '').trim(),
      account_number: b.account_number || '',
      ifsc_code: b.ifsc_code || '',
      branch_name: b.branch_name || '',
      amount: toNum(r.amount),
    };
  });

  const sectionValid = (rows) => rows.every((r) => !r.bank_id || toNum(r.amount) > 0);

  const canGenerate = sectionValid(plotRows)
    && sectionValid(devRows)
    && sectionValid(stampRows)
    && sectionValid(regRows)
    && sectionValid(commissionRows)
    && sectionValid(regExpRows)
    && sectionValid(otherRows);

  const handleGenerate = () => {
    if (!canGenerate) return;
    const chargeSplits = {
      stamp: buildSplits(stampRows),
      registration: buildSplits(regRows),
      commission: buildSplits(commissionRows),
      reg_expenses: buildSplits(regExpRows),
      other_reg_expenses: buildSplits(otherRows),
    };
    generateBookingConfirmationPDF(booking, buildSplits(plotRows), buildSplits(devRows), terms, { formName, chargeSplits });
    onClose();
  };

  return (
    <div className="col-modal-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card, #fff)', borderRadius: 16, width: 'min(800px, calc(100vw - 40px))', maxWidth: 800,
          height: 'min(90vh, 640px)', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>Generate Booking Form</h3>
          <button type="button" onClick={onClose} style={{ ...iconBtnStyle, color: 'var(--text-secondary, #64748b)', border: 'none', width: 32, height: 32 }} title="Close">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Buyer Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. K. Arthi" style={inputStyle} />
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Prints as the buyer name on the form and is used as the PDF file name.</div>
          </div>

          <SplitSection title="Plot Amount" total={plotTotal} banks={activeBanks} rows={plotRows} setRows={setPlotRows} />

          {devTotal > 0 && (
            <SplitSection title="Development Charges" total={devTotal} banks={activeBanks} rows={devRows} setRows={setDevRows} />
          )}

          {/* Remaining charges — optionally assign a bank account to each (prints in the
              PDF's Account Details). Leave blank to just show the charge total. */}
          {stamp > 0 && (
            <SplitSection title="Stamp Duty (7%)" total={stamp} banks={activeBanks} rows={stampRows} setRows={setStampRows} optional />
          )}
          {reg > 0 && (
            <SplitSection title="Registration Fees (2%)" total={reg} banks={activeBanks} rows={regRows} setRows={setRegRows} optional />
          )}
          {commission > 0 && (
            <SplitSection title="Stamp Commission (1%)" total={commission} banks={activeBanks} rows={commissionRows} setRows={setCommissionRows} optional />
          )}
          {regExpenses > 0 && (
            <SplitSection title="Registration Expenses" total={regExpenses} banks={activeBanks} rows={regExpRows} setRows={setRegExpRows} optional />
          )}
          {other > 0 && (
            <SplitSection title="Other Registration Expenses" total={other} banks={activeBanks} rows={otherRows} setRows={setOtherRows} optional />
          )}

          {/* Grand total */}
          <div style={{ marginTop: 4, borderTop: '2px solid var(--border-primary, #e2e8f0)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
            <span>Total Value</span>
            <span>{fmt(totalValue)}</span>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="bkd-btn bkd-btn-outline" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="bkd-btn bkd-btn-primary"
            disabled={!canGenerate}
            onClick={handleGenerate}
            title={canGenerate ? 'Generate Booking Form' : 'Ensure all entered bank rows have both a bank and a valid amount selected'}
          >
            <ArrowDownTrayIcon style={{ width: 14, height: 14 }} /> Generate Booking Form
          </button>
        </div>
      </div>
    </div>
  );
};

export default GenerateBookingFormModal;
