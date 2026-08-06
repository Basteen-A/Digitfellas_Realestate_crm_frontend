import React, { useState, useEffect, useCallback } from 'react';
import bookingApi from '../../../api/bookingApi';
import dashboardApi from '../../../api/dashboardApi';
import { formatCurrencyExact as formatCurrency } from '../../../utils/formatters';
import Pagination from '../../../components/common/Pagination';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import '../collection/CollectionWorkspace.css';

const fmt = (v) => formatCurrency(v);
const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isVerifiedPayment = (p) => !!p?.is_verified || p?.approval_status === 'APPROVED' || !!p?.management_approved || !!p?.accounts_approved;
const isCashPayment = (p) => String(p?.payment_mode || '').trim().toLowerCase() === 'cash';
const extractRows = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.payments)) return data.payments;
  return [];
};

const AccountsVerifyPayments = ({ user, initialFilter = 'unverified' }) => {
  const roleCode = user?.userTypeCode || user?.user_type_code || user?.userType?.short_code || null;
  const isAccountsManager = roleCode && String(roleCode).toUpperCase() === 'AM';

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter);
  // Accounts Manager sees the CASH queue by default; "Show all payments" lifts
  // the cash filter (server-side too) for a full overview across every mode.
  const [showAll, setShowAll] = useState(false);
  const cashOnly = isAccountsManager && !showAll;
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
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
    if (cashOnly && !isCashPayment(p)) return false;
    if (normalizedFilter === 'verified') return isVerifiedPayment(p) && !p.is_bounced;
    if (normalizedFilter === 'rejected') return !!p.is_bounced;
    if (normalizedFilter === 'unverified') return !isVerifiedPayment(p) && !p.is_bounced;
    return true;
  }, [normalizedFilter, cashOnly]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const apiStatus = ['unverified', 'verified', 'rejected'].includes(normalizedFilter) ? normalizedFilter : undefined;
      // AM's queue is cash-scoped server-side; show_all lifts that for a full view.
      const baseParams = { page, limit };
      if (isAccountsManager && showAll) baseParams.show_all = 'true';
      const res = await bookingApi.getAllPayments({ ...baseParams, status: apiStatus });
      const data = res.data?.data || res.data;
      let rows = extractRows(data);
      let filteredRows = rows.filter(matchesFilter);

      if (apiStatus && normalizedFilter !== 'unverified' && filteredRows.length === 0) {
        const fallbackRes = await bookingApi.getAllPayments(baseParams);
        const fallbackData = fallbackRes.data?.data || fallbackRes.data;
        const fallbackRows = extractRows(fallbackData);
        const fallbackFilteredRows = fallbackRows.filter(matchesFilter);
        if (fallbackFilteredRows.length > 0) {
          rows = fallbackRows;
          filteredRows = fallbackFilteredRows;
        }
      }

      if (normalizedFilter === 'verified' && filteredRows.length === 0) {
        const statsResp = await dashboardApi.getAccountsStats();
        const stats = statsResp.data?.data || statsResp.data || {};
        const fallbackRows = (stats.recentPayments || []).filter(matchesFilter);
        if (fallbackRows.length > 0) {
          setPayments(fallbackRows);
          setTotal(fallbackRows.length);
          return;
        }
      }

      if (normalizedFilter === 'unverified' && filteredRows.length === 0) {
        const statsResp = await dashboardApi.getAccountsStats();
        const stats = statsResp.data?.data || statsResp.data || {};
        const fallbackRows = (stats.recentPayments || []).filter(matchesFilter);
        setPayments(fallbackRows);
        setTotal(fallbackRows.length);
      } else {
        setPayments(filteredRows);
        const reportedTotal = data?.pagination?.totalItems || data?.count || rows.length || 0;
        setTotal(Math.max(reportedTotal, filteredRows.length));
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [normalizedFilter, page, limit, matchesFilter, isAccountsManager, showAll]);

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
    if (p.is_bounced) return <span className="col-badge-new col-badge-rejected">Rejected</span>;
    if (isVerifiedPayment(p)) return <span className="col-badge-new col-badge-verified">Verified</span>;
    return <span className="col-badge-new col-badge-unverified">Unverified</span>;
  };

  const getAge = (d) => {
    if (!d) return '-';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const visiblePayments = payments.filter((p) => {
    if (cashOnly && !isCashPayment(p)) return false;
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
      <div className="col-greeting-new" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {normalizedFilter === 'unverified' ? 'Payment Verification'
              : normalizedFilter === 'verified' ? 'Verified Payments'
                : normalizedFilter === 'rejected' ? 'Rejected Payments'
                  : 'All Payments'}
          </h1>
          <p style={{ color: 'var(--col-text-secondary)', marginTop: 4, fontSize: '0.875rem' }}>
            {normalizedFilter === 'unverified' ? 'Review payments submitted by Collection Managers and verify against bank records'
              : normalizedFilter === 'verified' ? 'History of all verified payments'
                : normalizedFilter === 'rejected' ? 'Payments that were rejected during verification'
                  : 'All payments across every verification status'}
          </p>
        </div>
        {/* Accounts Manager: cash by default, tick to show every payment mode */}
        {isAccountsManager && (
          <label
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--col-text-secondary)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
          >
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => { setShowAll(e.target.checked); setPage(1); setSelected(null); }}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--col-primary, #4f46e5)' }}
            />
            Show all payments
          </label>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="acct-verify-tabs">
        {['unverified', 'verified', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); setSelected(null); }}
            className={`acct-verify-tab ${filter === f ? 'active' : ''}`}
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

      {/* Main Panel - queue + detail sidebar */}
      <div className="acct-verify-layout">
        {/* LEFT: Payment Queue Table */}
        <div className="col-card-new acct-verify-queue">
          <div className="acct-verify-queue-head">
            <input
              type="text"
              placeholder="Search booking, customer, UTR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="acct-verify-search"
            />
            <span className="acct-verify-count">
              {total} payment{total !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="col-table-scroll acct-verify-table-wrap">
            {loading ? (
              <div className="acct-verify-empty">Loading payments...</div>
            ) : payments.length === 0 ? (
              <div className="acct-verify-empty">
                No {normalizedFilter === 'unverified' ? 'pending ' : normalizedFilter === 'all' ? '' : `${normalizedFilter} `}payments found
              </div>
            ) : (
              <table className="col-table-new">
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
                      className={`acct-verify-row ${selected?.id === p.id ? 'selected' : ''}`}
                    >
                      <td style={{ fontWeight: 500 }}>{p.booking_number || p.payment_number}</td>
                      <td><strong>{p.customer_name || '-'}</strong></td>
                      <td style={{ fontWeight: 700 }}>{fmt(p.amount)}</td>
                      <td>{p.payment_mode}</td>
                      <td style={{ fontWeight: 500 }}>{p.transaction_ref || p.utr_number || p.cheque_dd_number || '-'}</td>
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
          <Pagination
            page={page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setLimit(size); setPage(1); }}
          />
        </div>

        {/* RIGHT: Detail Sidebar or Placeholder */}
        {selected ? (
          <div className="acct-verify-sidebar">
            <div className="acct-detail-header">
              <h3>Payment Details</h3>
              <button className="acct-detail-close" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="acct-detail-amount-card">
              <span className="acct-detail-amount-label">Amount</span>
              <span className="acct-detail-amount-value">{fmt(selected.amount)}</span>
            </div>

            <div className="acct-detail-list">
              <div className="acct-detail-item">
                <span className="acct-detail-label">Payment #</span>
                <span className="acct-detail-value" style={{ fontWeight: 500 }}>{selected.payment_number}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Booking #</span>
                <span className="acct-detail-value" style={{ fontWeight: 500 }}>{selected.booking_number}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Customer</span>
                <span className="acct-detail-value">{selected.customer_name}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Project</span>
                <span className="acct-detail-value">{selected.project_name || '-'}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Phase</span>
                <span className="acct-detail-value">{selected.phase_name || '-'}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Plot</span>
                <span className="acct-detail-value">{selected.unit_number || '-'}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Payment Mode</span>
                <span className="acct-detail-value">{selected.payment_mode}</span>
              </div>
              <div className="acct-detail-item">
                <span className="acct-detail-label">Payment Date</span>
                <span className="acct-detail-value">{fmtDate(selected.payment_date)}</span>
              </div>
              {selected.cheque_dd_number && (
                <div className="acct-detail-item">
                  <span className="acct-detail-label">Cheque/DD #</span>
                  <span className="acct-detail-value" style={{ fontWeight: 500 }}>{selected.cheque_dd_number}</span>
                </div>
              )}
              {selected.bank_name && (
                <div className="acct-detail-item">
                  <span className="acct-detail-label">Bank</span>
                  <span className="acct-detail-value">{selected.bank_name}</span>
                </div>
              )}
              {(selected.transaction_ref || selected.utr_number) && (
                <div className="acct-detail-item">
                  <span className="acct-detail-label">UTR / Ref</span>
                  <span className="acct-detail-value" style={{ fontWeight: 500 }}>{selected.transaction_ref || selected.utr_number}</span>
                </div>
              )}
              {selected.remarks && (
                <div className="acct-detail-item">
                  <span className="acct-detail-label">Remarks</span>
                  <span className="acct-detail-value" style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>{selected.remarks}</span>
                </div>
              )}
              <div className="acct-detail-item" style={{ borderTop: '1px solid var(--border-primary, #e5e7eb)', paddingTop: 10, marginTop: 4 }}>
                <span className="acct-detail-label">Status</span>
                <span className="acct-detail-value">{getStatusBadge(selected)}</span>
              </div>
              {selected.is_bounced && selected.bounce_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, fontSize: '0.75rem', marginTop: 6 }}>
                  <strong style={{ color: '#dc2626' }}>Rejection Reason:</strong><br />
                  {selected.bounce_reason}
                </div>
              )}
            </div>

            {/* Action Buttons - only for unverified (AM acts on cash only) */}
            {normalizedFilter === 'unverified' && !isVerifiedPayment(selected) && !selected.is_bounced && (!isAccountsManager || isCashPayment(selected)) && (
              <div className="acct-verify-action-panel">
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--col-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Transaction / UTR ID
                  </label>
                  <input
                    type="text"
                    value={verifyTxnId}
                    onChange={(e) => setVerifyTxnId(e.target.value)}
                    placeholder="Enter bank transaction ID..."
                    className="acct-verify-search"
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
                    className="acct-verify-note"
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="col-btn col-btn-success"
                    onClick={handleVerify}
                    disabled={actionLoading}
                  >
                    {!actionLoading && <CheckCircleIcon style={{ width: 16, height: 16 }} />}
                    {actionLoading ? 'Processing...' : 'Verify Payment'}
                  </button>
                  <button
                    className="col-btn col-btn-danger"
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                  >
                    <XCircleIcon style={{ width: 16, height: 16 }} /> Reject
                  </button>
                </div>
              </div>
            )}

            {/* AM sees non-cash rows under "Show all" but can't verify them */}
            {isAccountsManager && normalizedFilter === 'unverified' && !isVerifiedPayment(selected) && !selected.is_bounced && !isCashPayment(selected) && (
              <div className="acct-verify-action-panel" style={{ fontSize: '0.75rem', color: 'var(--col-text-secondary)', lineHeight: 1.5 }}>
                Non-cash payments are verified by the Accountant. This record is view-only here - only cash payments can be verified by the Accounts Manager.
              </div>
            )}
          </div>
        ) : (
          <div className="acct-verify-sidebar-placeholder">
            <CheckCircleIcon style={{ width: 48, height: 48, strokeWidth: 1, color: 'var(--text-muted, #9ca3af)', marginBottom: 12 }} />
            <h4>No Payment Selected</h4>
            <p>Select a payment from the queue to view UTR references, customer metadata, and process bank verification.</p>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="col-modal-overlay">
          <div className="col-modal" style={{ maxWidth: 420 }}>
            <div className="col-modal-header">
              <h2>Reject Payment</h2>
              <button className="col-modal-close" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>×</button>
            </div>
            <div className="col-modal-body">
              <p style={{ fontSize: '0.8rem', color: 'var(--col-text-secondary)', marginBottom: 12 }}>
                Rejecting <strong>{selected?.payment_number}</strong> - {fmt(selected?.amount)} from {selected?.customer_name}
              </p>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--col-text-secondary)', display: 'block', marginBottom: 4 }}>
                Rejection Reason *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="acct-verify-note"
              />
            </div>
            <div className="col-modal-footer">
              <button className="col-btn col-btn-ghost" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                Cancel
              </button>
              <button
                className="col-btn col-btn-danger"
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
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
