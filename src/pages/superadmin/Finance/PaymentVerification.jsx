// Super Admin / Admin › Payments › Payment Verification.
//
// One screen for every "Other Registration Expenses" payment in the organisation -
// the single cost item that needs TWO signatures before its money counts: Accounts,
// and an Admin or Super Admin. Both states live here on purpose: the entries still
// waiting for a signature AND the ones already verified, because "show me what this
// customer has paid towards other registration expenses" is asked at least as often
// as "what is left for me to sign".
//
// Why this page exists: the Admin half of the signature previously lived ONLY on a
// row inside a booking on the Booking Approvals screen, which an Admin cannot open
// (roleDefaults gives ADM booking_approvals:'none'), and which a Super Admin has to
// find by opening bookings one at a time. There was no queue.
//
// GOTCHA worth knowing before you report this screen as broken: dual verification is
// stamped on a payment when it is CREATED. Every payment recorded before that
// migration ran was grandfathered to a single signature, so it shows as "Not required"
// in the Admin column and offers no button - correctly. If the queue looks empty,
// check `dual_verification_required`, not this page.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrencyExact as formatCurrency, formatDate } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { useAuthContext } from '../../../contexts/AuthContext';
import {
  ShieldCheckIcon, ArrowPathIcon, MagnifyingGlassIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import PaymentDetailModal from '../../../components/common/PaymentDetailModal';
import '../../portals/collection/CollectionWorkspace.css';
import '../../portals/common/LeadWorkspacePage.css';

// Kept in step with PAYMENT_VERIFICATION_STAGES in bookingController.getPaymentVerifications.
const TABS = [
  { value: 'awaiting_admin', label: 'Awaiting My Verification', short: 'Awaiting' },
  { value: 'awaiting_accounts', label: 'Awaiting Accounts', short: 'Accounts' },
  { value: 'verified', label: 'Verified', short: 'Verified' },
  { value: 'rejected', label: 'Rejected', short: 'Rejected' },
  { value: 'all', label: 'All Entries', short: 'All' },
];

const EMPTY_SUMMARY = {
  total: 0, awaiting_admin: 0, awaiting_accounts: 0, fully_verified: 0,
  single_signature: 0, rejected: 0,
  total_amount: 0, verified_amount: 0, awaiting_admin_amount: 0,
};

const personName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '');

// One signature cell. A signature nobody has given yet reads as "Pending" rather than
// blank, so a missing one is visible instead of merely absent.
const SignatureCell = ({ done, user, at, notRequired }) => {
  if (notRequired) {
    return (
      <span
        style={{ fontSize: 12, color: 'var(--text-muted)' }}
        title="Recorded before the second signature was introduced - one signature is all this payment ever needed."
      >
        Not required
      </span>
    );
  }
  if (!done) return <span className="bkd-badge bkd-badge-warning">Pending</span>;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.35 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#166534', fontWeight: 500 }}>
        <CheckCircleIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
        {personName(user) || 'Verified'}
      </span>
      {at && <small style={{ color: 'var(--text-muted)' }}>{formatDate(at)}</small>}
    </span>
  );
};

const PaymentVerification = () => {
  const { user } = useAuthContext();

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [stage, setStage] = useState('awaiting_admin');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [confirming, setConfirming] = useState(null);   // the payment awaiting confirmation
  const [note, setNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Debounce the search box - each keystroke would otherwise be a round trip.
  const searchTimer = useRef(null);
  useEffect(() => {
    searchTimer.current = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getPaymentVerifications({
        stage, search: search || undefined, page, limit: pageSize,
      });
      const body = res.data || {};
      setRows(Array.isArray(body.data) ? body.data : []);
      setTotal(body.meta?.total || 0);
      setSummary({ ...EMPTY_SUMMARY, ...(body.meta?.summary || {}) });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load payment verifications'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [stage, search, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const openConfirm = (p) => { setConfirming(p); setNote(''); };

  // Every rule lives on the server (the payment must actually require a second
  // signature, must not already carry one, and must not be signed by whoever gave the
  // Accounts signature). This only surfaces its refusal, so the two cannot drift.
  const confirmVerify = async () => {
    if (!confirming || verifying) return;
    setVerifying(true);
    try {
      await bookingApi.verifyPaymentAdmin(confirming.booking_id, confirming.id, {
        verification_note: note.trim() || undefined,
      });
      toast.success('Admin verification recorded');
      setConfirming(null);
      setNote('');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to record the Admin verification'));
    } finally {
      setVerifying(false);
    }
  };

  const changeStage = (value) => { setStage(value); setPage(1); };

  // The one case where an empty list is expected rather than wrong: nothing requires a
  // second signature because every entry predates dual verification.
  const allGrandfathered = summary.total > 0
    && summary.awaiting_admin === 0
    && summary.single_signature === summary.total;

  return (
    <div className="col-bookings-page">
      <header className="lead-workspace__header">
        <div>
          <h1><ShieldCheckIcon style={{ width: 22, height: 22, marginRight: 6 }} />Payment Verification</h1>
          <p className="hide-mobile">
            Every Other Registration Expenses payment across all customers - give the Admin signature, or review one already verified
          </p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Counts describe the whole queue, not the current tab or search - so "what is
          waiting on me" stays readable while filtering. */}
      <div className="col-stat-grid-new" style={{ marginBottom: 16 }}>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Total Entries</div>
          <div className="col-stat-value-new">{summary.total}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatCurrency(summary.total_amount)}</div>
        </div>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Awaiting Admin</div>
          <div className="col-stat-value-new">{summary.awaiting_admin}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatCurrency(summary.awaiting_admin_amount)}</div>
        </div>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Awaiting Accounts</div>
          <div className="col-stat-value-new">{summary.awaiting_accounts}</div>
        </div>
        <div className="col-stat-card-new">
          <div className="col-stat-label-new">Fully Verified</div>
          <div className="col-stat-value-new">{summary.fully_verified}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatCurrency(summary.verified_amount)}</div>
        </div>
      </div>

      {allGrandfathered && (
        <div className="crm-card" style={{ padding: 12, marginBottom: 14, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            None of these {summary.total} entries need a second signature. Dual verification is stamped on a payment
            when it is recorded, and everything listed here was recorded before that was switched on - so each one is
            complete with the Accounts signature alone. New Other Registration Expenses payments will appear here for
            your verification.
          </div>
        </div>
      )}

      <div className="lead-workspace__toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="lead-workspace__toolbar-search" style={{ flex: '0 1 400px', minWidth: 200 }}>
          <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by customer, booking #, payment # or reference"
          />
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body-flush">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
            <div className="filter-tabs mobile-compact-tabs">
              {TABS.map((t) => {
                const count = t.value === 'awaiting_admin' ? summary.awaiting_admin
                  : t.value === 'awaiting_accounts' ? summary.awaiting_accounts
                    : t.value === 'verified' ? summary.fully_verified
                      : t.value === 'rejected' ? summary.rejected
                        : summary.total;
                return (
                  <button
                    key={t.value}
                    type="button"
                    className={`filter-tab ${stage === t.value ? 'active' : ''}`}
                    onClick={() => changeStage(t.value)}
                  >
                    <span className="hide-mobile">{t.label}</span>
                    <span className="show-mobile">{t.short}</span>
                    {count > 0 && (
                      <span style={{
                        marginLeft: 4,
                        background: t.value === 'awaiting_admin' ? '#EF4444' : '#3B82F6',
                        color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              <small className="filter-tabs__records">{total} record{total === 1 ? '' : 's'}</small>
            </div>
          </div>

          {loading ? (
            <div className="simple-loader">
              <div className="simple-spinner" />
              <p>Loading...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="col-empty">
              <div className="col-empty-icon"><ShieldCheckIcon style={{ width: 48, height: 48, color: 'var(--text-muted)' }} /></div>
              <div className="col-empty-title">
                {search ? 'No entries match your search'
                  : stage === 'awaiting_admin' ? 'Nothing is waiting for your verification'
                    : 'No entries here'}
              </div>
              <div className="col-empty-desc">
                {search ? 'Try a different customer, booking or payment number'
                  : 'Other Registration Expenses payments appear here as they are recorded against bookings'}
              </div>
            </div>
          ) : (
            <div className="lead-workspace__table-wrap">
              <table className="lead-workspace__table">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Payment #</th>
                    <th style={{ width: 'auto' }}>Customer / Booking</th>
                    <th className="hide-mobile" style={{ width: 150 }}>Project</th>
                    <th style={{ width: 120 }}>Amount</th>
                    <th className="hide-mobile" style={{ width: 100 }}>Mode</th>
                    <th className="hide-mobile" style={{ width: 105 }}>Date</th>
                    <th style={{ width: 130 }}>Accounts</th>
                    <th style={{ width: 130 }}>Admin</th>
                    <th style={{ width: 110 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      className={p.is_bounced ? 'col-payment-bounced' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedPayment(p)}
                      title="View payment details"
                    >
                      <td style={{ fontWeight: 600, color: '#2563eb' }}>{p.payment_number}</td>
                      <td>
                        <p className="lead-title">{p.customer_name || '-'}</p>
                        <small>{p.booking_number}{p.unit_number ? ` · ${p.unit_number}` : ''}</small>
                      </td>
                      <td className="hide-mobile">{p.project_name || '-'}</td>
                      <td style={{ fontWeight: 500 }}>{formatCurrency(p.amount)}</td>
                      <td className="hide-mobile">{p.payment_mode}</td>
                      <td className="hide-mobile">{formatDate(p.payment_date)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <SignatureCell
                          done={p.accounts_verified}
                          user={p.verifier}
                          at={p.verified_at}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <SignatureCell
                          done={p.admin_verified}
                          user={p.adminVerifier}
                          at={p.admin_verified_at}
                          notRequired={!p.dual_verification_required}
                        />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {p.can_admin_verify ? (
                          <button
                            type="button"
                            className="workspace-btn workspace-btn--primary"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => openConfirm(p)}
                          >
                            Verify
                          </button>
                        ) : (
                          <button type="button" className="view-link" onClick={() => setSelectedPayment(p)}>
                            View
                          </button>
                        )}
                        {/* The one refusal worth explaining in place: the same person
                            must not be able to give both signatures. */}
                        {!p.can_admin_verify && p.dual_verification_required && !p.admin_verified && !p.is_bounced
                          && String(p.verified_by || '') === String(user?.id || '') && (
                            <div style={{ fontSize: 10, color: '#B45309', marginTop: 2 }}>
                              You gave the Accounts signature
                            </div>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          )}
        </div>
      </div>

      {selectedPayment && (
        <PaymentDetailModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} onSaved={load} />
      )}

      {/* Confirm before signing - this moves money into the verified column, where it
          becomes refundable and starts counting on every finance report. */}
      {confirming && (
        <div className="col-modal-overlay" onClick={() => !verifying && setConfirming(null)}>
          <div className="col-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="col-modal-header">
              <h2>Confirm Admin Verification</h2>
              <button className="col-modal-close" onClick={() => !verifying && setConfirming(null)}>×</button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                Give the Admin signature on <strong>{formatCurrency(confirming.amount)}</strong> towards
                Other Registration Expenses for <strong>{confirming.customer_name || 'this customer'}</strong>
                {confirming.booking_number ? ` (${confirming.booking_number})` : ''}?
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {confirming.accounts_verified
                  ? 'Accounts have already signed, so this completes the verification and the money becomes verified.'
                  : 'Accounts have not signed yet - the money stays unverified until they do.'}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                  Note <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything worth recording against this verification"
                  style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setConfirming(null)} disabled={verifying}>
                Cancel
              </button>
              <button type="button" className="workspace-btn workspace-btn--primary" onClick={confirmVerify} disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVerification;
