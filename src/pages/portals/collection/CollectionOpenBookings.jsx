import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowPathIcon, ClipboardDocumentListIcon, PaperAirplaneIcon, EyeIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
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

  return (
    <div className="col-bookings-page">
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>New Bookings</h1>
          <p className="hidden sm:block">Open bookings from Sales Head — review and send for Super Admin approval</p>
        </div>
        <div className="page-header-actions flex-wrap" style={{ gap: 8 }}>
          <div style={{ position: 'relative', minWidth: 220 }}>
            <MagnifyingGlassIcon style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--text-muted)' }} />
            <input type="text" placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="col-form-input" style={{ paddingLeft: 32, height: 36, fontSize: 13, width: '100%' }} />
          </div>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={load}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
          </button>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          {loading ? (
            <div className="simple-loader"><div className="simple-spinner" /><p>Loading...</p></div>
          ) : filtered.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ClipboardDocumentListIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">No new bookings</div>
              <div className="col-empty-desc">New bookings from Sales Head will appear here to send for approval.</div>
            </div>
          ) : (
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Booking #</th>
                    <th>Buyer</th>
                    <th>Project · Unit</th>
                    <th>Value</th>
                    <th>Booking Date</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
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
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="col-action-group">
                          <button type="button" className="col-qa-btn" title="View details" onClick={() => onSelectBooking?.(b.id)}>
                            <EyeIcon style={{ width: 15, height: 15 }} />
                          </button>
                          <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" disabled={sendingId === b.id} onClick={() => setConfirmBooking(b)}>
                            <PaperAirplaneIcon style={{ width: 14, height: 14 }} /> {sendingId === b.id ? 'Sending…' : 'Send for Approval'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
