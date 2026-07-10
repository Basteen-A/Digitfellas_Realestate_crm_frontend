import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../api/bookingApi';
import bookingStatusApi from '../../api/bookingStatusApi';
import { formatCurrency } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/helpers';
import {
  CreditCardIcon, ArrowPathIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { useAuthContext } from '../../contexts/AuthContext';
import CollectionBookingDetail from '../portals/collection/CollectionBookingDetail';
import { badgeStyle } from '../../utils/badgeColors';
import './BookingApprovals.css';

// Status filter tabs are built at runtime from the admin-managed Booking
// Statuses master (see statusTabs below), so there is no hardcoded list here.

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

// Stored booking values first — they are what was billed and collected
// against. The guideline × area formula (ROUNDUP(…, -2), Stamp 7%,
// Registration 2%) only fills values that were never stored, so the summary
// always reconciles with total_paid.
const computeSummary = (b) => {
  const guideline = toAmount(b.guideline_value);
  const area = toAmount(b.plot_area);
  const perSqft = toAmount(b.development_cost_per_sqft);

  const formulaPlotValue = (guideline > 0 && area > 0)
    ? Math.ceil((guideline * area) / 100) * 100 // ROUNDUP(rate × sqft, -2)
    : 0;
  const plotValue = toAmount(b.plot_value) > 0
    ? toAmount(b.plot_value)
    : (formulaPlotValue > 0 ? formulaPlotValue : toAmount(b.base_price || b.total_amount || b.net_amount));
  const storedStamp = toAmount(b.stamp_value || b.stamp_duty);
  const storedReg = toAmount(b.registration_exp || b.registration_charges);
  const stampValue = storedStamp > 0 ? storedStamp : plotValue * 0.07;
  const registrationValue = storedReg > 0 ? storedReg : plotValue * 0.02;
  const developmentValue = toAmount(b.development_charges) > 0
    ? toAmount(b.development_charges)
    : ((perSqft > 0 && area > 0) ? Math.round(area * perSqft * 1.18) : 0); // area × cost/sqft + 18% GST
  const cb = b.custom_fields?.cost_breakdown || {};
  const storedCommission = toAmount((cb.registration_split || {}).stamp_commission);
  const stampCommission = storedCommission > 0 ? storedCommission : Math.round(stampValue * 0.01); // 1% fallback
  const regSplit = { ...(cb.registration_split || {}), stamp_commission: stampCommission };
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

// Status badge label/color. The list endpoint (getAll) does NOT flatten
// status_label/status_color onto the row the way getMyBookings does, so derive
// them from the bookingStatus association. Mirrors Collection Bookings' display,
// including the "Cancel Pending" override for an SH-approved cancel request.
const statusOf = (b) => {
  const code = b.bookingStatus?.status_code || b.status_code;
  const cancelApproved = code === 'REQUEST_TO_CANCEL' && !!b.custom_fields?.cancel_approved_by;
  if (cancelApproved) return { label: 'Cancel Pending', color: '#C2410C' };
  return {
    label: b.status_label || b.bookingStatus?.status_name || '—',
    color: b.status_color || b.bookingStatus?.color_code || '#6B7280',
  };
};

const BookingApprovals = () => {
  const { user } = useAuthContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [statusTab, setStatusTab] = useState('all');
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [statusList, setStatusList] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Super Admin sees ALL bookings across every status, not just pending.
      const resp = await bookingApi.getAll({ limit: 200 });
      setRows(resp.data?.data || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pull the filter tabs from the admin-managed Booking Statuses master so that
  // adding / renaming / recoloring / reordering / deactivating a status there is
  // reflected here automatically (getDropdown returns active rows, status_order ASC).
  useEffect(() => {
    bookingStatusApi.getDropdown()
      .then((r) => setStatusList(r.data?.data || r.data || []))
      .catch(() => {});
  }, []);

  const statusTabs = useMemo(() => ([
    { key: 'all', label: 'All', codes: null, color: null },
    ...statusList.map((s) => ({
      key: s.status_code,
      label: s.status_name,
      codes: [s.status_code],
      color: s.color_code,
    })),
  ]), [statusList]);

  const activeCodes = statusTabs.find((t) => t.key === statusTab)?.codes || null;
  const filteredRows = activeCodes
    ? rows.filter((b) => activeCodes.includes(b.bookingStatus?.status_code || b.status_code))
    : rows;

  const renderDetailContent = (b) => {
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
      </div>
    );
  };

  const renderDetail = (b) => {
    return (
      <tr>
        <td colSpan={8} style={{ padding: 0, background: 'transparent' }}>
          {renderDetailContent(b)}
        </td>
      </tr>
    );
  };

  const renderMobileCard = (b) => {
    const isOpen = expandedId === b.id;
    const summary = computeSummary(b);
    const st = statusOf(b);
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
            <button type="button" className="ba-booking-link ba-mobile-card__booking" onClick={() => setSelectedBookingId(b.id)}>
              {b.booking_number}
            </button>
            <div className="ba-mobile-card__customer">{customerName(b)}</div>
            <div className="ba-muted">{formatCurrency(summary.totalValue)} total · {Math.round(summary.pct)}% collected</div>
            <div style={{ marginTop: 4 }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, ...badgeStyle(st.color) }}>{st.label}</span>
            </div>
          </div>
          <div className="ba-mobile-card__actions" onClick={(e) => e.stopPropagation()}>
            <button className="ba-btn" onClick={() => setSelectedBookingId(b.id)}>View</button>
          </div>
        </div>
        {isOpen && renderDetailContent(b)}
      </div>
    );
  };

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filteredRows, 25);

  // When a booking is selected, show the full detail page (with SA payment editing).
  if (selectedBookingId) {
    return (
      <CollectionBookingDetail
        user={user}
        bookingId={selectedBookingId}
        onBack={() => { setSelectedBookingId(null); load(); }}
      />
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><CreditCardIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Bookings</h1>
          <p className="hidden sm:block">All bookings across every status — approve or reject those pending, open any booking to view or edit payments</p>
        </div>
        <button className="crm-btn crm-btn-ghost" onClick={load} disabled={loading}>
          <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Status filter tabs — sourced from the admin Booking Statuses master */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {statusTabs.map((t) => {
          const count = t.codes
            ? rows.filter((b) => t.codes.includes(b.bookingStatus?.status_code || b.status_code)).length
            : rows.length;
          const active = statusTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={`crm-btn crm-btn-sm ${active ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {t.color && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              )}
              {t.label} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
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
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>Loading…</td></tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>No bookings in this view</td></tr>
            )}
            {!loading && pageItems.map((b) => {
              const s = computeSummary(b);
              const st = statusOf(b);
              const isOpen = expandedId === b.id;
              return (
                <React.Fragment key={b.id}>
                  <tr className={`ba-row ${isOpen ? 'is-open' : ''}`}>
                    <td style={{ ...td, cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : b.id)}>
                      <ChevronRightIcon className={`ba-chevron ${isOpen ? 'open' : ''}`} />
                    </td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      <button type="button" className="ba-booking-link" onClick={() => setSelectedBookingId(b.id)}>
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
                    <td style={td}>
                      <span className="ba-status-badge" style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                        ...badgeStyle(st.color),
                      }}>{st.label}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="crm-btn crm-btn-ghost crm-btn-sm"
                        onClick={() => setSelectedBookingId(b.id)}
                      >
                        View
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
          {!loading && filteredRows.length === 0 && <div className="ba-mobile-empty">No bookings in this view</div>}
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
    </div>
  );
};

export default BookingApprovals;
