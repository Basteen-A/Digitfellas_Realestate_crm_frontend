import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowPathIcon, CheckCircleIcon, XCircleIcon, ClipboardDocumentListIcon,
  ExclamationTriangleIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import '../collection/CollectionWorkspace.css';

const SalesHeadCancellationRequests = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBooking, setActionBooking] = useState(null);
  const [actionMode, setActionMode] = useState(null); // 'approve' | 'reject'
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await bookingApi.getCancellationRequests();
      setRequests(resp.data?.data || resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const openActionModal = (bookingRequest, mode) => {
    setActionBooking(bookingRequest);
    setActionMode(mode);
    setRemarks('');
  };

  const handleApprove = async () => {
    if (!remarks.trim()) { toast.error('Remarks are mandatory'); return; }
    setSaving(true);
    try {
      await bookingApi.approveCancellation(actionBooking.id, { remarks });
      toast.success('Cancellation approved');
      setActionBooking(null); setActionMode(null); setRemarks('');
      loadRequests();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!remarks.trim()) { toast.error('Remarks are mandatory'); return; }
    setSaving(true);
    try {
      await bookingApi.rejectCancellation(actionBooking.id, { remarks });
      toast.success('Cancellation rejected');
      setActionBooking(null); setActionMode(null); setRemarks('');
      loadRequests();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setSaving(false); }
  };

  const getDaysBadge = (req) => {
    if (req.cancel_approved) {
      const label = req.cancel_auto_approved ? '✓ Auto-approved' : '✓ Approved';
      return <span style={{ ...badgeStyle, background: '#16A34A22', color: '#16A34A' }}>{label}</span>;
    }
    if (req.cancel_rejected) {
      return <span style={{ ...badgeStyle, background: '#EF444422', color: '#EF4444' }}>Rejected - no auto-approve</span>;
    }
    const daysLeft = req.days_until_auto_approve ?? Math.max(0, 7 - (req.days_since_request || 0));
    if (daysLeft <= 0) return <span style={{ ...badgeStyle, background: '#EF444422', color: '#EF4444' }}>Auto-approving…</span>;
    return <span style={{ ...badgeStyle, background: '#F59E0B22', color: '#F59E0B' }}>Auto-approves in {daysLeft} day{daysLeft === 1 ? '' : 's'}</span>;
  };

  const badgeStyle = { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'inline-block' };

  const { pageItems, page, setPage, pageSize, setPageSize, total } = usePagination(requests, 25);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Cancellation Requests</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Approve or reject cancellation requests any time - untouched requests auto-approve after the 7-day follow-up window</p>
        </div>
        <button className="crm-btn crm-btn-ghost" onClick={loadRequests} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowPathIcon style={{ width: 16, height: 16 }} /> Refresh
        </button>
      </div>

      <div className="crm-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Loading cancellation requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <ClipboardDocumentListIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.4 }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>No pending cancellation requests</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>All clear! No bookings are awaiting cancellation review.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="crm-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-primary)' }}>
                  <th style={thStyle}>Booking #</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Project · Unit</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Cancel Reason</th>
                  <th style={thStyle}>Remarks</th>
                  <th style={thStyle}>Previous Status</th>
                  <th style={thStyle}>Follow-Up Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--accent-blue)' }}>{req.booking_number}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{req.customer?.buyer_name || req.buyer_name || req.customer_name || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{req.customer?.phone || ''}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{req.project?.project_name || req.project_name || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unit: {req.inventoryUnit?.unit_number || req.unit_number || 'TBD'}</div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(req.net_amount || req.total_amount || 0)}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{req.cancelReason?.reason_name || '-'}</td>
                    <td style={{ ...tdStyle, fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.cancel_remarks || '-'}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{req.previous_status_name || '-'}</td>
                    <td style={tdStyle}>{getDaysBadge(req)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {!req.cancel_approved ? (
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => openActionModal(req, 'reject')}
                            style={{ ...actionBtnStyle, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}
                          >
                            <XCircleIcon style={{ width: 13, height: 13 }} /> Cancel
                          </button>
                          <button
                            onClick={() => openActionModal(req, 'approve')}
                            style={{
                              ...actionBtnStyle,
                              background: '#DCFCE7',
                              color: '#16A34A',
                              border: '1px solid #BBF7D0',
                            }}
                          >
                            <CheckCircleIcon style={{ width: 13, height: 13 }} /> Approve
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>Approved ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && requests.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><strong>{requests.length}</strong> total requests</span>
          <span><strong style={{ color: '#16A34A' }}>{requests.filter(r => !r.cancel_approved).length}</strong> pending decision</span>
          <span><strong style={{ color: '#F59E0B' }}>{requests.filter(r => !r.cancel_approved && (r.days_until_auto_approve ?? 7) <= 2).length}</strong> auto-approving soon</span>
          <span><strong style={{ color: '#16A34A' }}>{requests.filter(r => r.cancel_approved).length}</strong> approved</span>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {actionBooking && actionMode && (
        <div className="col-modal-overlay" onClick={() => { setActionBooking(null); setActionMode(null); setRemarks(''); }}>
          <div className="qa-modal-panel" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="qa-drawer-handle" />
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{
                  background: actionMode === 'approve' ? '#16A34A22' : '#EF444422',
                  color: actionMode === 'approve' ? '#16A34A' : '#EF4444',
                  border: `2px solid ${actionMode === 'approve' ? '#16A34A' : '#EF4444'}`,
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {actionMode === 'approve' ? '✓' : '✕'}
                </div>
                <div>
                  <div className="qa-drawer-name">{actionMode === 'approve' ? 'Approve Cancellation' : 'Reject Cancellation'}</div>
                  <div className="qa-drawer-meta">{actionBooking.booking_number} · {actionBooking.customer?.buyer_name || actionBooking.buyer_name || actionBooking.customer_name}</div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={() => { setActionBooking(null); setActionMode(null); setRemarks(''); }}>×</button>
            </div>
            <div className="qa-drawer-divider" />
            <div style={{ padding: '16px 20px' }}>
              {actionMode === 'approve' && (
                <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B44', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#92400E' }}>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ExclamationTriangleIcon style={{ width: 14, height: 14, flexShrink: 0 }} /> Important:
                  </strong> Approving releases the booked plot to <strong>Available</strong> immediately (even before any refund) and lets the Collection Manager finalize the cancellation. Make sure you have completed follow-up with the customer.
                </div>
              )}
              {actionMode === 'reject' && (
                <div style={{ background: '#DBEAFE', border: '1px solid #3B82F644', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#1E40AF' }}>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <InformationCircleIcon style={{ width: 14, height: 14, flexShrink: 0 }} /> Note:
                  </strong> Rejecting will record your remarks. The booking will stay in Request to Cancel. The Collection Manager will discuss with the customer to decide whether to reactivate the booking or resubmit the cancellation.
                </div>
              )}
              <div className="bkd-form-group">
                <label className="bkd-form-label">Remarks *</label>
                <textarea className="bkd-form-control" rows={3}
                  placeholder={actionMode === 'approve' ? 'Document follow-up outcome...' : 'Reason for rejection (e.g., customer approached another unit)...'}
                  value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-primary)' }}>
              <button className="qa-drawer-save-btn" style={{
                background: actionMode === 'approve' ? '#16A34A' : '#EF4444',
                width: '100%', padding: '10px 20px', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
                disabled={saving || !remarks.trim()}
                onClick={actionMode === 'approve' ? handleApprove : handleReject}>
                {saving ? 'Processing...' : actionMode === 'approve' ? 'Approve Cancellation' : 'Reject Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const thStyle = { padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const tdStyle = { padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)' };
const actionBtnStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' };

export default SalesHeadCancellationRequests;
