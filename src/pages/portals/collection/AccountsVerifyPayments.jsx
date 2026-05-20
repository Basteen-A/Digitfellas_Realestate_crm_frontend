import React, { useState, useEffect, useCallback } from 'react';
import bookingApi from '../../../api/bookingApi';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrency } from '../../../utils/formatters';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import './CollectionWorkspace.css';

const fmt = (v) => formatCurrency(v);
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AccountsVerifyPayments = ({ user, initialFilter = 'unverified' }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Verify form
  const [verifyTxnId, setVerifyTxnId] = useState('');
  const [verifyNote, setVerifyNote] = useState('');

  const normalizedFilter = filter === 'pending' ? 'unverified' : filter;

  const matchesFilter = useCallback((p) => {
    if (normalizedFilter === 'verified') return !!p.is_verified && !p.is_bounced;
    if (normalizedFilter === 'rejected') return !!p.is_bounced;
    if (normalizedFilter === 'unverified') return !p.is_verified && !p.is_bounced;
    return true;
  }, [normalizedFilter]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const apiStatus = ['unverified', 'verified', 'rejected'].includes(normalizedFilter) ? normalizedFilter : undefined;
      const res = await bookingApi.getAllPayments({ status: apiStatus, page, limit: 20 });
      const data = res.data?.data || res.data;
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const filteredRows = rows.filter(matchesFilter);

      if (normalizedFilter === 'unverified' && filteredRows.length === 0) {
        const statsResp = await dashboardApi.getAccountsStats();
        const stats = statsResp.data?.data || statsResp.data || {};
        const fallbackRows = (stats.recentPayments || []).filter((p) => !p.is_verified && !p.is_bounced);
        setPayments(fallbackRows);
        setTotal(fallbackRows.length);
      } else {
        setPayments(filteredRows);
        setTotal(data?.pagination?.totalItems || data?.count || filteredRows.length || 0);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [normalizedFilter, page, matchesFilter]);

  useEffect(() => {
    setFilter(initialFilter || 'unverified');
    setPage(1);
    setSelected(null);
  }, [initialFilter]);

  useEffect(() => {
    fetchPayments();
    setSelected(null);
  }, [fetchPayments]);

  const handleVerify = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await bookingApi.verifyPayment(selected.booking_id, selected.id, {
        transaction_id: verifyTxnId || selected.transaction_ref,
        verification_note: verifyNote,
      });
      setSelected(null);
      setVerifyTxnId('');
      setVerifyNote('');
      fetchPayments();
    } catch (err) {
      console.error('Verify failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await bookingApi.rejectPayment(selected.booking_id, selected.id, {
        rejection_reason: rejectReason,
      });
      setShowRejectModal(false);
      setRejectReason('');
      setSelected(null);
      fetchPayments();
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (p) => {
    if (p.is_bounced) return <span className="col-badge-new col-badge-danger">Rejected</span>;
    if (p.is_verified) return <span className="col-badge-new col-badge-success">Verified</span>;
    return <span className="col-badge-new col-badge-warning">Unverified</span>;
  };

  const getAge = (d) => {
    if (!d) return '—';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const totalPages = Math.ceil(total / 20);
  const visiblePayments = payments.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.booking_number || '').toLowerCase().includes(s) ||
      (p.customer_name || '').toLowerCase().includes(s) ||
      (p.payment_number || '').toLowerCase().includes(s) ||
      (p.transaction_ref || '').toLowerCase().includes(s) ||
      (p.utr_number || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="col-dashboard-new">
      {/* Page Header */}
      <div className="col-greeting-new">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {filter === 'unverified' ? 'Payment Verification' : filter === 'verified' ? 'Verified Payments' : 'Rejected Payments'}
        </h1>
        <p style={{ color: 'var(--col-text-secondary)', marginTop: 4, fontSize: '0.875rem' }}>
          {filter === 'unverified'
            ? 'Review payments submitted by Collection Managers and verify against bank records'
            : filter === 'verified'
            ? 'History of all verified payments'
            : 'Payments that were rejected during verification'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['unverified', 'verified', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); setSelected(null); }}
            className={`col-badge-new ${filter === f ? 'col-badge-primary' : ''}`}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.8rem',
              background: filter === f ? 'var(--col-primary)' : 'var(--col-surface)',
              color: filter === f ? '#fff' : 'var(--col-text-secondary)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {f === 'unverified' && <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />}
              {f === 'verified' && <CheckCircleIcon style={{ width: 14, height: 14 }} />}
              {f === 'rejected' && <XCircleIcon style={{ width: 14, height: 14 }} />}
              {f === 'unverified' ? 'Pending' : f === 'verified' ? 'Verified' : 'Rejected'}
            </span>
          </button>
        ))}
      </div>

      {/* Main Panel — queue + detail sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT: Payment Queue Table */}
        <div className="col-card-new" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--col-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search booking, customer, UTR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--col-border)',
                background: 'var(--col-surface)', fontSize: '0.8rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--col-text-secondary)' }}>
              {total} payment{total !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="col-table-new" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--col-text-secondary)' }}>Loading payments...</div>
            ) : payments.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--col-text-secondary)' }}>
                No {normalizedFilter === 'unverified' ? 'pending' : normalizedFilter} payments found
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Age</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayments.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => {
                          setSelected(p);
                          setVerifyTxnId(p.transaction_ref || p.utr_number || '');
                          setVerifyNote('');
                        }}
                        style={{
                          cursor: 'pointer',
                          background: selected?.id === p.id ? 'rgba(79, 70, 229, 0.06)' : undefined,
                          borderLeft: selected?.id === p.id ? '3px solid var(--col-primary)' : '3px solid transparent',
                        }}
                      >
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.booking_number || p.payment_number}</td>
                        <td><strong>{p.customer_name || '—'}</strong></td>
                        <td style={{ fontWeight: 700 }}>{fmt(p.amount)}</td>
                        <td>{p.payment_mode}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.transaction_ref || p.utr_number || p.cheque_dd_number || '—'}</td>
                        <td style={{ fontSize: '0.75rem' }}>{fmtDate(p.payment_date)}</td>
                        <td style={{ fontSize: '0.75rem' }}>{getAge(p.payment_date)}</td>
                        <td>{getStatusBadge(p)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--col-border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--col-text-secondary)' }}>
                Page {page} of {totalPages} · {total} total
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--col-border)', background: 'var(--col-surface)', cursor: 'pointer', fontSize: '0.75rem' }}>← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--col-border)', background: 'var(--col-surface)', cursor: 'pointer', fontSize: '0.75rem' }}>Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Detail Sidebar */}
        {selected && (
          <div className="col-card-new" style={{ position: 'sticky', top: 80 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Payment Details</h3>

            <div style={{ display: 'grid', gap: 10, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Payment #</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selected.payment_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Booking #</span>
                <span style={{ fontFamily: 'monospace' }}>{selected.booking_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Customer</span>
                <span style={{ fontWeight: 600 }}>{selected.customer_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Project</span>
                <span>{selected.project_name || '—'}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--col-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Amount</span>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--col-primary)' }}>{fmt(selected.amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Payment Mode</span>
                <span>{selected.payment_mode}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Payment Type</span>
                <span>{selected.payment_type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Payment Date</span>
                <span>{fmtDate(selected.payment_date)}</span>
              </div>
              {selected.cheque_dd_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--col-text-secondary)' }}>Cheque/DD #</span>
                  <span style={{ fontFamily: 'monospace' }}>{selected.cheque_dd_number}</span>
                </div>
              )}
              {selected.bank_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--col-text-secondary)' }}>Bank</span>
                  <span>{selected.bank_name}</span>
                </div>
              )}
              {(selected.transaction_ref || selected.utr_number) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--col-text-secondary)' }}>UTR / Ref</span>
                  <span style={{ fontFamily: 'monospace' }}>{selected.transaction_ref || selected.utr_number}</span>
                </div>
              )}
              {selected.remarks && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--col-text-secondary)' }}>Remarks</span>
                  <span style={{ fontSize: '0.75rem' }}>{selected.remarks}</span>
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--col-border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--col-text-secondary)' }}>Status</span>
                {getStatusBadge(selected)}
              </div>
              {selected.is_bounced && selected.bounce_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, fontSize: '0.75rem' }}>
                  <strong style={{ color: '#dc2626' }}>Rejection Reason:</strong><br />
                  {selected.bounce_reason}
                </div>
              )}
            </div>

            {/* Action Buttons — only for unverified */}
            {normalizedFilter === 'unverified' && !selected.is_verified && !selected.is_bounced && (
              <div style={{ marginTop: 20 }}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--col-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Transaction / UTR ID
                  </label>
                  <input
                    type="text"
                    value={verifyTxnId}
                    onChange={(e) => setVerifyTxnId(e.target.value)}
                    placeholder="Enter bank transaction ID..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--col-border)', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--col-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Verification Note (optional)
                  </label>
                  <textarea
                    value={verifyNote}
                    onChange={(e) => setVerifyNote(e.target.value)}
                    placeholder="Optional note..."
                    rows={2}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--col-border)', fontSize: '0.8rem', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleVerify}
                    disabled={actionLoading}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#059669', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    {!actionLoading && <CheckCircleIcon style={{ width: 16, height: 16 }} />}
                    {actionLoading ? 'Processing...' : 'Verify Payment'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <XCircleIcon style={{ width: 16, height: 16 }} /> Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="col-card-new" style={{ width: 420, maxWidth: '90vw' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>Reject Payment</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--col-text-secondary)', marginBottom: 16 }}>
              Rejecting <strong>{selected?.payment_number}</strong> — {fmt(selected?.amount)} from {selected?.customer_name}
            </p>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--col-text-secondary)', display: 'block', marginBottom: 4 }}>
              Rejection Reason *
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--col-border)', fontSize: '0.8rem', resize: 'vertical', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--col-border)', background: 'var(--col-surface)', cursor: 'pointer', fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsVerifyPayments;
