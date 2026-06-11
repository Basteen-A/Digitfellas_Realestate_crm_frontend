import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../api/bookingApi';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import {
  CreditCardIcon, ArrowPathIcon, CheckCircleIcon, XCircleIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import './BookingApprovals.css';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'top' };

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const customerName = (b) => (b.customer?.buyer_name
  || `${b.customer?.first_name || ''} ${b.customer?.last_name || ''}`.trim()
  || b.buyer_name || '—');
const fullName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '');
// Display-only label overrides (keys/values on the record are unchanged).
const SPLIT_LABEL_OVERRIDES = { registration_expenses: 'Regn Misc. Expenses' };
const labelize = (k) => SPLIT_LABEL_OVERRIDES[k]
  || k.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const toAmount = (v) => { const n = parseFloat(v || 0); return Number.isFinite(n) ? n : 0; };
const sumSplit = (split) => Object.values(split || {}).reduce((s, v) => s + toAmount(v), 0);
// Actual rupee value with Indian grouping — no Lakh/Crore shortening (matches
// the "Update Cost Breakdown" modal).
const fmtFull = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// Mirror the "Update Cost Breakdown" modal exactly: derive the figures from
// guideline value × area with ROUNDUP(…, -2), falling back to stored values.
const computeSummary = (b) => {
  const guideline = toAmount(b.guideline_value);
  const area = toAmount(b.plot_area);
  const perSqft = toAmount(b.development_cost_per_sqft);

  let plotValue;
  let stampValue;
  let registrationValue;
  if (guideline > 0 && area > 0) {
    plotValue = Math.ceil((guideline * area) / 100) * 100;        // ROUNDUP(rate × sqft, -2)
    stampValue = Math.ceil((plotValue * 0.07) / 100) * 100;       // 7%, rounded up to 100
    registrationValue = Math.ceil((plotValue * 0.02) / 100) * 100; // 2%, rounded up to 100
  } else {
    plotValue = toAmount(b.plot_value || b.base_price || b.total_amount || b.net_amount);
    stampValue = toAmount(b.stamp_value || b.stamp_duty);
    registrationValue = toAmount(b.registration_exp || b.registration_charges);
  }
  const developmentValue = (perSqft > 0 && area > 0)
    ? Math.round(area * perSqft * 1.18 * 100) / 100                // area × cost/sqft + 18% GST
    : toAmount(b.development_charges);
  const cb = b.custom_fields?.cost_breakdown || {};
  const regSplit = cb.registration_split || {};
  const modtSplit = cb.modt_enabled ? (cb.modt_split || {}) : {};
  const otherCharges = sumSplit(regSplit) + sumSplit(modtSplit);
  const computed = plotValue + stampValue + registrationValue + developmentValue + otherCharges;
  const totalValue = computed > 0 ? computed : toAmount(b.net_amount || b.total_amount);
  const collected = toAmount(b.total_paid);
  const balance = totalValue - collected;
  const pct = totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0;
  return { plotValue, stampValue, registrationValue, developmentValue, otherCharges, regSplit, modtSplit, totalValue, collected, balance, pct };
};

const phaseOf = (b) => b.phase?.phase_name || b.inventoryUnit?.phase?.phase_name || null;
const unitOf = (b) => b.unit_number || b.inventoryUnit?.unit_number || (b.unit_display && b.unit_display !== 'N/A' ? b.unit_display : null);

const BookingApprovals = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [approveFor, setApproveFor] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getAll({ status_code: 'BOOKING_PENDING', limit: 100 });
      setRows(resp.data?.data || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load pending bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = (booking) => setApproveFor(booking);
  const closeApprove = () => setApproveFor(null);
  const confirmApprove = async () => {
    const booking = approveFor;
    if (!booking) return;
    setBusyId(booking.id);
    try {
      await bookingApi.approveBooking(booking.id);
      toast.success('Booking approved');
      setApproveFor(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to approve booking'));
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (booking) => { setRejectFor(booking); setRejectRemarks(''); };
  const closeReject = () => { setRejectFor(null); setRejectRemarks(''); };

  const renderDetailContent = (b, showActions = true) => {
    const s = computeSummary(b);
    const regSubtotal = sumSplit(s.regSplit);
    const modtSubtotal = sumSplit(s.modtSplit);
    const breakdown = [
      { k: 'Plot Value', v: s.plotValue },
      { k: 'Stamp Duty (7%)', v: s.stampValue },
      { k: 'Registration (2%)', v: s.registrationValue },
      { k: 'Development', v: s.developmentValue },
      { k: 'Reg. Split Subtotal', v: regSubtotal },
      { k: 'MODT Subtotal', v: modtSubtotal },
    ];
    const splitRows = [
      ...Object.entries(s.regSplit).filter(([, v]) => toAmount(v) > 0).map(([k, v]) => [labelize(k), v]),
      ...Object.entries(s.modtSplit).filter(([, v]) => toAmount(v) > 0).map(([k, v]) => [`MODT · ${labelize(k)}`, v]),
    ];

    return (
      <div className="ba-detail">
        <div className="ba-detail-grid">
          <div className="ba-block">
            <h4>Customer</h4>
            <div className="ba-info-row"><span className="k">Buyer Name</span><span className="v">{customerName(b)}</span></div>
            <div className="ba-info-row"><span className="k">Phone</span><span className="v">{b.customer?.phone || '—'}</span></div>
            <div className="ba-info-row"><span className="k">PAN</span><span className="v">{b.customer?.pan_number || '—'}</span></div>
            <div className="ba-info-row"><span className="k">Aadhaar</span><span className="v">{b.customer?.aadhar_number || '—'}</span></div>
            <div className="ba-info-row"><span className="k">Email</span><span className="v">{b.customer?.email || '—'}</span></div>

            <h4>Booking</h4>
            <div className="ba-info-row"><span className="k">Booking #</span><span className="v">{b.booking_number}</span></div>
            <div className="ba-info-row"><span className="k">Project</span><span className="v">{b.project?.project_name || b.project_name || '—'}</span></div>
            <div className="ba-info-row"><span className="k">Phase</span><span className="v">{phaseOf(b) || '—'}</span></div>
            <div className="ba-info-row"><span className="k">Unit</span><span className="v">{unitOf(b) || '—'}</span></div>
            <div className="ba-info-row"><span className="k">Payment Plan</span><span className="v">{b.paymentPlan?.plan_name || '—'}</span></div>
            <div className="ba-info-row"><span className="k">Guideline Value (per sq.ft)</span><span className="v">{b.guideline_value ? fmtFull(b.guideline_value) : '—'}</span></div>
            <div className="ba-info-row"><span className="k">Plot Area (sqft)</span><span className="v">{b.plot_area ? `${toAmount(b.plot_area).toLocaleString('en-IN')} sqft` : '—'}</span></div>
            <div className="ba-info-row"><span className="k">Booking Date</span><span className="v">{fmtDate(b.booking_date)}</span></div>
            <div className="ba-info-row"><span className="k">Created By</span><span className="v">{fullName(b.creator) || '—'}</span></div>
          </div>

          <div className="ba-block">
            <div className="ba-summary-head">
              <h3>Payment Summary</h3>
              <p>Financial overview &amp; collection progress</p>
            </div>

            <div className="ba-stat-grid">
              <div className="ba-stat total"><div className="label">Total Value</div><div className="value">{fmtFull(s.totalValue)}</div></div>
              <div className="ba-stat collected"><div className="label">Collected</div><div className="value">{fmtFull(s.collected)}</div></div>
              <div className="ba-stat balance"><div className="label">Balance Due</div><div className="value">{fmtFull(s.balance)}</div></div>
              <div className="ba-stat"><div className="label">Collected %</div><div className="value">{s.pct}%</div></div>
            </div>

            <div className="ba-breakdown">
              {breakdown.map((x) => (
                <div className="bd" key={x.k}><span className="bd-k">{x.k}</span><span className="bd-v">{fmtFull(x.v)}</span></div>
              ))}
            </div>

            {splitRows.length > 0 && (
              <>
                <h4 style={{ margin: '4px 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Regn Misc. Expenses (Detailed Split)
                </h4>
                <div className="ba-breakdown">
                  {splitRows.map(([k, v]) => (
                    <div className="bd" key={k}><span className="bd-k">{k}</span><span className="bd-v">{fmtFull(toAmount(v))}</span></div>
                  ))}
                </div>
              </>
            )}

            <div className="ba-breakdown" style={{ gridTemplateColumns: '1fr' }}>
              <div className="bd" style={{ background: '#eef2ff', borderColor: '#c7d2fe' }}>
                <span className="bd-k" style={{ fontWeight: 800, color: '#3730a3' }}>Grand Total</span>
                <span className="bd-v" style={{ fontSize: 16, color: '#3730a3' }}>{fmtFull(s.totalValue)}</span>
              </div>
            </div>

            <div className="ba-progress-wrap">
              <div className="ba-progress-top">
                <span><strong>{fmtFull(s.collected)}</strong> collected</span>
                <span>of <strong>{fmtFull(s.totalValue)}</strong></span>
              </div>
              <div className="ba-progress-bar"><div className="ba-progress-fill" style={{ width: `${Math.min(100, s.pct)}%` }} /></div>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="ba-actions">
            <button className="ba-btn ba-btn--reject" disabled={busyId === b.id} onClick={() => openReject(b)}>
              <XCircleIcon className="ba-btn-icon" /> Reject
            </button>
            <button className="ba-btn ba-btn--approve" disabled={busyId === b.id} onClick={() => handleApprove(b)}>
              <CheckCircleIcon className="ba-btn-icon" /> Approve
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleReject = async () => {
    if (!rejectRemarks.trim()) { toast.error('Rejection remarks are required'); return; }
    setBusyId(rejectFor.id);
    try {
      await bookingApi.rejectBooking(rejectFor.id, { remarks: rejectRemarks.trim() });
      toast.success('Booking rejected');
      closeReject();
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reject booking'));
    } finally {
      setBusyId(null);
    }
  };

  const renderDetail = (b) => {
    return (
      <tr>
        <td colSpan={7} style={{ padding: 0, background: 'transparent' }}>
          {renderDetailContent(b)}
        </td>
      </tr>
    );
  };

  const renderMobileCard = (b) => {
    const isOpen = expandedId === b.id;
    const summary = computeSummary(b);
    return (
      <div key={b.id} className={`ba-mobile-card ${isOpen ? 'is-open' : ''}`}>
        <div className="ba-mobile-card__head">
          <button
            type="button"
            className="ba-mobile-card__toggle"
            onClick={() => setExpandedId(isOpen ? null : b.id)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} booking ${b.booking_number}`}
          >
            <ChevronRightIcon className={`ba-chevron ${isOpen ? 'open' : ''}`} />
          </button>
          <div className="ba-mobile-card__main">
            <button type="button" className="ba-booking-link ba-mobile-card__booking" onClick={() => setExpandedId(isOpen ? null : b.id)}>
              {b.booking_number}
            </button>
            <div className="ba-mobile-card__customer">{customerName(b)}</div>
            <div className="ba-muted">{formatCurrency(summary.totalValue)} total · {Math.round(summary.pct)}% collected</div>
          </div>
          <div className="ba-mobile-card__actions" onClick={(e) => e.stopPropagation()}>
            <button className="ba-btn ba-btn--reject" disabled={busyId === b.id} onClick={() => openReject(b)}>
              <XCircleIcon className="ba-btn-icon" /> Reject
            </button>
            <button className="ba-btn ba-btn--approve" disabled={busyId === b.id} onClick={() => handleApprove(b)}>
              <CheckCircleIcon className="ba-btn-icon" /> Approve
            </button>
          </div>
        </div>
        {isOpen && renderDetailContent(b, false)}
      </div>
    );
  };

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(rows, 25);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><CreditCardIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Booking Approvals</h1>
          <p className="hidden sm:block">Review bookings sent by Collection and approve or reject them</p>
        </div>
        <button className="crm-btn crm-btn-ghost" onClick={load} disabled={loading}>
          <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="crm-card ba-card">
        <div className="ba-table-desktop">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }}></th>
              <th style={th}>Booking #</th>
              <th style={th}>Customer</th>
              <th style={th}>Project / Phase / Unit</th>
              <th style={th}>Value</th>
              <th style={th}>Collected</th>
              <th style={{ ...th, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>No bookings pending approval</td></tr>
            )}
            {!loading && pageItems.map((b) => {
              const s = computeSummary(b);
              const isOpen = expandedId === b.id;
              return (
                <React.Fragment key={b.id}>
                  <tr className={`ba-row ${isOpen ? 'is-open' : ''}`}>
                    <td style={{ ...td, cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : b.id)}>
                      <ChevronRightIcon className={`ba-chevron ${isOpen ? 'open' : ''}`} />
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      <button type="button" className="ba-booking-link" onClick={() => setExpandedId(isOpen ? null : b.id)}>
                        {b.booking_number}
                      </button>
                    </td>
                    <td style={td}>{customerName(b)}</td>
                    <td style={td}>
                      {b.project?.project_name || b.project_name || '—'}
                      <div className="ba-muted">
                        {phaseOf(b) ? `${phaseOf(b)}` : 'No phase'}{unitOf(b) ? ` · Unit ${unitOf(b)}` : ''}
                      </div>
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>{formatCurrency(s.totalValue)}</td>
                    <td style={td}>{formatCurrency(s.collected)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="crm-btn crm-btn-sm"
                        style={{ background: '#16a34a', color: '#fff', border: 'none', marginRight: 8 }}
                        disabled={busyId === b.id}
                        onClick={() => handleApprove(b)}
                      >
                        <CheckCircleIcon style={{ width: 15, height: 15 }} /> Approve
                      </button>
                      <button
                        className="crm-btn crm-btn-sm"
                        style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                        disabled={busyId === b.id}
                        onClick={() => openReject(b)}
                      >
                        <XCircleIcon style={{ width: 15, height: 15 }} /> Reject
                      </button>
                    </td>
                  </tr>
                  {isOpen && renderDetail(b)}
                </React.Fragment>
              );
            })}
          </tbody>
          </table>
        </div>
        <div className="ba-mobile-list">
          {loading && <div className="ba-mobile-empty">Loading…</div>}
          {!loading && rows.length === 0 && <div className="ba-mobile-empty">No bookings pending approval</div>}
          {!loading && pageItems.map(renderMobileCard)}
        </div>
        {!loading && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* Reject-remarks modal */}
      {approveFor && (
        <div className="col-modal-overlay" onClick={() => busyId !== approveFor.id && closeApprove()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: 'min(100%, 460px)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green, #059669)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircleIcon style={{ width: 18, height: 18 }} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Approve booking {approveFor.booking_number}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{customerName(approveFor)}</p>
              </div>
            </div>
            <div style={{ padding: 20, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Approve this booking? It moves to <strong style={{ color: 'var(--text-primary)' }}>Booking Confirmed</strong> and the reserved unit is committed.
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={closeApprove} disabled={busyId === approveFor.id}>Cancel</button>
              <button className="crm-btn crm-btn-sm" style={{ background: 'var(--accent-green, #059669)', color: '#fff', border: 'none' }}
                disabled={busyId === approveFor.id} onClick={confirmApprove}>
                <CheckCircleIcon style={{ width: 14, height: 14 }} /> {busyId === approveFor.id ? 'Approving…' : 'Approve Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectFor && (
        <div className="col-modal-overlay" onClick={closeReject}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: 'min(100%, 460px)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Reject booking {rejectFor.booking_number}</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {customerName(rejectFor)} · the lead returns to the Sales Head and any payment becomes refundable.
              </p>
            </div>
            <div style={{ padding: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Rejection remarks *</label>
              <textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Why is this booking being rejected?"
                rows={4}
                style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border-input, #cbd5e1)', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={closeReject} disabled={busyId === rejectFor.id}>Cancel</button>
              <button className="crm-btn crm-btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none' }}
                disabled={busyId === rejectFor.id || !rejectRemarks.trim()} onClick={handleReject}>
                {busyId === rejectFor.id ? 'Rejecting…' : 'Reject Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingApprovals;
