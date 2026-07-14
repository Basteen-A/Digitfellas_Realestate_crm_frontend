import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowPathIcon, ClipboardDocumentListIcon, PaperAirplaneIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import { badgeStyle, badgeColors } from '../../../utils/badgeColors';
import '../common/LeadWorkspacePage.css';
import './CollectionWorkspace.css';

const toAmount = (v) => { const n = parseFloat(v || 0); return Number.isFinite(n) ? n : 0; };

// Total value, mirroring the bookings list / approval screen.
const computedTotal = (b) => {
  const plot = toAmount(b.plot_value || b.base_price || b.total_amount || b.net_amount);
  const stamp = toAmount(b.stamp_value || b.stamp_duty);
  const reg = toAmount(b.registration_exp || b.registration_charges);
  const dev = toAmount(b.development_charges);
  const total = plot + stamp + reg + dev;
  return total > 0 ? total : toAmount(b.net_amount || b.total_amount);
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// New Bookings — bookings still at "Booking Open" (created by Sales Head). The
// collection manager reviews them here and sends them for Super Admin approval;
// once sent (Booking Pending) they move into the main Bookings list.
export const CollectionOpenBookings = ({ onSelectBooking }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [confirmBooking, setConfirmBooking] = useState(null); // booking awaiting send confirmation

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getMyBookings({ limit: 200 });
      const raw = resp.data?.data?.rows || resp.data?.data || [];
      setRows((Array.isArray(raw) ? raw : []).filter((b) => b.status_code === 'BOOKING_OPEN'));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const b = confirmBooking;
    if (!b) return;
    setSendingId(b.id);
    try {
      await bookingApi.sendForApproval(b.id);
      toast.success('Booking sent for approval');
      setConfirmBooking(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send for approval'));
    } finally {
      setSendingId(null);
    }
  };

  const filtered = rows.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (b.booking_number || '').toLowerCase().includes(q)
      || (b.customer_name || b.buyer_name || '').toLowerCase().includes(q)
      || (b.project_name || '').toLowerCase().includes(q);
  });

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(filtered, 25);

  return (
    <div className="col-bookings-page">
      {/* ── Header (matches My Leads workspace) ── */}
      <header className="lead-workspace__header">
        <div>
          <h1>Open Bookings</h1>
          <p className="hide-mobile">Open bookings from Sales Head — review and send for Super Admin approval</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={load} disabled={loading}>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookings by number, customer or project"
          />
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          {/* Record count row — same header band as the other booking lists */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
            <small className="filter-tabs__records" style={{ marginLeft: 0 }}>{filtered.length} record{filtered.length === 1 ? '' : 's'} to send for approval</small>
          </div>

          {loading ? (
            <div className="simple-loader"><div className="simple-spinner" /><p>Loading...</p></div>
          ) : filtered.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">No new bookings</div>
              <div className="col-empty-desc">New bookings from Sales Head will appear here to send for approval.</div>
            </div>
          ) : (
            <>
              <div className="crm-table-wrap col-bookings-table-desktop">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Booking #</th>
                      <th>Buyer</th>
                      <th>Project · Unit</th>
                      <th>Value</th>
                      <th>Booking Date</th>
                      <th>Booking Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <button type="button" className="col-booking-link" onClick={() => onSelectBooking?.(b.id)}>
                            {b.booking_number}
                          </button>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{b.customer_name || b.buyer_name || '-'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.lead?.lead_number || ''}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{b.project_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unit: {b.unit_display || b.unit_number || 'TBD'}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(computedTotal(b))}</td>
                        <td>{fmtDate(b.booking_date)}</td>
                        <td>
                          <span className="col-badge" style={badgeStyle(b.status_color)}>
                            <span className="col-badge-dot" style={{ background: badgeColors(b.status_color).text }} />
                            {b.status_label || b.status_name}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div className="col-action-group">
                            <button type="button" className="view-link" title="View details" onClick={() => onSelectBooking?.(b.id)}>View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Mobile card list (shown ≤768px; the table is hidden there) ── */}
              <div className="col-bookings-mobile">
                {pageItems.map((b) => (
                  <div key={b.id} className="col-bookings-mobile-card">
                    <div className="col-bookings-mobile-card__head">
                      <div className="col-bookings-mobile-card__main">
                        <button type="button" className="col-booking-link col-bookings-mobile-card__booking" onClick={() => onSelectBooking?.(b.id)}>
                          {b.booking_number}
                        </button>
                        <div className="col-bookings-mobile-card__customer">{b.customer_name || b.buyer_name || '-'}</div>
                        <div className="col-bookings-mobile-card__meta">{b.project_name || '—'} · {b.unit_display || b.unit_number || 'TBD'}</div>
                      </div>
                      <div className="col-bookings-mobile-card__actions">
                        <button type="button" className="view-link" title="View details" onClick={() => onSelectBooking?.(b.id)}>View</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderTop: '1px solid var(--border-primary, #e2e8f0)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{formatCurrency(computedTotal(b))}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(b.booking_date)}</div>
                      </div>
                      <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" disabled={sendingId === b.id} onClick={() => setConfirmBooking(b)} style={{ flexShrink: 0 }}>
                        <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> {sendingId === b.id ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      </div>

      {/* Send-for-approval confirmation modal */}
      {confirmBooking && (
        <div onClick={() => sendingId === null && setConfirmBooking(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-card, #fff)', borderRadius: 14, width: 'min(100%, 440px)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-blue-bg, #eff4ff)', color: 'var(--accent-blue, #2563eb)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PaperAirplaneIcon style={{ width: 18, height: 18 }} />
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Send for approval</h3>
            </div>
            <div style={{ padding: 20, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Send booking <strong style={{ color: 'var(--text-primary)' }}>{confirmBooking.booking_number}</strong>
              {' '}({confirmBooking.customer_name || confirmBooking.buyer_name || 'customer'}) for Super Admin approval?
              The unit will be <strong style={{ color: 'var(--text-primary)' }}>reserved</strong> and payments can be recorded once it becomes pending.
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setConfirmBooking(null)} disabled={sendingId === confirmBooking.id}>
                Cancel
              </button>
              <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" onClick={handleSend} disabled={sendingId === confirmBooking.id}>
                <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> {sendingId === confirmBooking.id ? 'Sending…' : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionOpenBookings;
