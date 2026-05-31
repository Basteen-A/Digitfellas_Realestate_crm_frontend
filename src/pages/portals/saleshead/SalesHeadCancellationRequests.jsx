import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import bookingApi from '../../../api/bookingApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import { formatCurrency } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import {
  ArrowPathIcon, CheckCircleIcon, XCircleIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import '../collection/CollectionWorkspace.css';

const SalesHeadCancellationRequests = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBooking, setActionBooking] = useState(null);
  const [actionMode, setActionMode] = useState(null); // 'approve' | 'reject'
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);
  const [revertStatusId, setRevertStatusId] = useState('');

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
  useEffect(() => {
    bookingStatusApi.getDropdown().then((r) => {
      setStatusOptions(r.data?.data || r.data || []);
    }).catch(() => {
      setStatusOptions([]);
    });
  }, []);

  const getRevertStatusOptions = useCallback((bookingRequest) => {
    if (!bookingRequest) return [];

    const preferredCodes = new Set(['BOOKED', 'REGISTERED', 'EMI']);
    const nonCancellationStatuses = statusOptions.filter((status) => !['REQUEST_TO_CANCEL', 'CANCEL', 'CANCELLED'].includes(status.status_code));
    const preferredStatuses = nonCancellationStatuses.filter((status) => preferredCodes.has(status.status_code));
    const fallbackList = preferredStatuses.length > 0 ? preferredStatuses : nonCancellationStatuses;

    const previousStatusId = bookingRequest.previous_status_id;
    if (!previousStatusId) return fallbackList;

    const hasPreviousInList = fallbackList.some((status) => String(status.id) === String(previousStatusId));
    if (hasPreviousInList) return fallbackList;

    const previousStatus = statusOptions.find((status) => String(status.id) === String(previousStatusId));
    return previousStatus ? [previousStatus, ...fallbackList] : fallbackList;
  }, [statusOptions]);

  const openActionModal = (bookingRequest, mode) => {
    setActionBooking(bookingRequest);
    setActionMode(mode);
    setRemarks('');

    if (mode === 'reject') {
      const options = getRevertStatusOptions(bookingRequest);
      const previousStatusId = bookingRequest.previous_status_id ? String(bookingRequest.previous_status_id) : '';
      if (previousStatusId && options.some((status) => String(status.id) === previousStatusId)) {
        setRevertStatusId(previousStatusId);
      } else {
        setRevertStatusId(options[0] ? String(options[0].id) : '');
      }
    } else {
      setRevertStatusId('');
    }
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
    if (!revertStatusId) { toast.error('Select revert status'); return; }
    setSaving(true);
    try {
      await bookingApi.rejectCancellation(actionBooking.id, { remarks, previous_status_id: revertStatusId });
      toast.success('Cancellation rejected — booking reverted');
      setActionBooking(null); setActionMode(null); setRemarks(''); setRevertStatusId('');
      loadRequests();
    } catch (err) { toast.error(getErrorMessage(err, 'Failed')); }
    finally { setSaving(false); }
  };

  const getDaysBadge = (days, canApprove, isApproved) => {
    if (isApproved) return <span style={{...badgeStyle, background:'#10B98122', color:'#10B981'}}>✓ Approved</span>;
    if (canApprove) return <span style={{...badgeStyle, background: days > 10 ? '#EF444422' : '#22C55E22', color: days > 10 ? '#EF4444' : '#22C55E'}}>{days} days — Ready</span>;
    return <span style={{...badgeStyle, background:'#F59E0B22', color:'#F59E0B'}}>Day {days}/7 — Follow up</span>;
  };

  const badgeStyle = { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'inline-block' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Cancellation Requests</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Review and approve/reject cancellation requests after 7-day follow-up</p>
        </div>
        <button className="crm-btn crm-btn-ghost" onClick={loadRequests} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowPathIcon style={{width:16,height:16}}/> Refresh
        </button>
      </div>

      <div className="crm-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{padding:48,textAlign:'center'}}>
            <ArrowPathIcon style={{width:32,height:32,color:'var(--text-muted)',margin:'0 auto',animation:'spin 1s linear infinite'}}/>
            <div style={{marginTop:12,color:'var(--text-muted)'}}>Loading...</div>
          </div>
        ) : requests.length === 0 ? (
          <div style={{padding:48,textAlign:'center',color:'var(--text-muted)'}}>
            <ClipboardDocumentListIcon style={{width:48,height:48,margin:'0 auto 12px',opacity:0.4}}/>
            <div style={{fontWeight:600, fontSize:15}}>No pending cancellation requests</div>
            <div style={{fontSize:13,marginTop:4}}>All clear! No bookings are awaiting cancellation review.</div>
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
                    <th style={{...thStyle, textAlign:'center'}}>Actions</th>
                  </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <td style={{...tdStyle, fontWeight:700, color:'var(--accent-blue)'}}>{req.booking_number}</td>
                    <td style={tdStyle}>
                      <div style={{fontWeight:600}}>{req.customer?.buyer_name || req.buyer_name || req.customer_name || '—'}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>{req.customer?.phone || ''}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{fontWeight:500}}>{req.project?.project_name || req.project_name || '—'}</div>
                      <div style={{fontSize:11,color:'var(--text-muted)'}}>Unit: {req.inventoryUnit?.unit_number || req.unit_number || 'TBD'}</div>
                    </td>
                    <td style={{...tdStyle, fontWeight:600}}>{formatCurrency(req.net_amount || req.total_amount || 0)}</td>
                    <td style={{...tdStyle, fontSize:12}}>{req.cancelReason?.reason_name || '—'}</td>
                    <td style={{...tdStyle, fontSize:12, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{req.cancel_remarks || '—'}</td>
                    <td style={{...tdStyle, fontSize:12}}>{req.previous_status_name || '—'}</td>
                    <td style={tdStyle}>{getDaysBadge(req.days_since_request, req.can_approve, req.cancel_approved)}</td>
                    <td style={{...tdStyle, textAlign:'center'}}>
                      {!req.cancel_approved ? (
                        <div style={{display:'flex',gap:6,justifyContent:'center'}}>
                          <button
                            onClick={() => openActionModal(req, 'reject')}
                            style={{...actionBtnStyle, background:'#FEE2E2', color:'#DC2626', border:'1px solid #FECACA'}}
                          >
                            <XCircleIcon style={{width:13,height:13}}/> Reject
                          </button>
                          <button
                            disabled={!req.can_approve}
                            title={req.can_approve ? 'Approve cancellation' : `${7 - req.days_since_request} days remaining`}
                            onClick={() => openActionModal(req, 'approve')}
                            style={{
                              ...actionBtnStyle,
                              background: req.can_approve ? '#DCFCE7' : '#F3F4F6',
                              color: req.can_approve ? '#16A34A' : '#9CA3AF',
                              border: `1px solid ${req.can_approve ? '#BBF7D0' : '#E5E7EB'}`,
                              cursor: req.can_approve ? 'pointer' : 'not-allowed',
                              opacity: req.can_approve ? 1 : 0.6,
                            }}
                          >
                            <CheckCircleIcon style={{width:13,height:13}}/> Approve
                          </button>
                        </div>
                      ) : (
                        <span style={{fontSize:11,color:'#10B981',fontWeight:600}}>Approved ✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && requests.length > 0 && (
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><strong>{requests.length}</strong> total requests</span>
          <span><strong style={{color:'#22C55E'}}>{requests.filter(r => r.can_approve && !r.cancel_approved).length}</strong> ready for decision</span>
          <span><strong style={{color:'#F59E0B'}}>{requests.filter(r => !r.can_approve && !r.cancel_approved).length}</strong> in follow-up period</span>
          <span><strong style={{color:'#10B981'}}>{requests.filter(r => r.cancel_approved).length}</strong> approved</span>
        </div>
      )}

      {/* Approve/Reject Modal */}
      {actionBooking && actionMode && (
        <div className="col-modal-overlay" onClick={() => { setActionBooking(null); setActionMode(null); setRevertStatusId(''); }}>
          <div className="qa-modal-panel" style={{maxWidth:500}} onClick={e => e.stopPropagation()}>
            <div className="qa-drawer-handle"/>
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div className="qa-drawer-avatar" style={{
                  background: actionMode === 'approve' ? '#22C55E22' : '#EF444422',
                  color: actionMode === 'approve' ? '#22C55E' : '#EF4444',
                  border: `2px solid ${actionMode === 'approve' ? '#22C55E' : '#EF4444'}`,
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {actionMode === 'approve' ? '✓' : '✕'}
                </div>
                <div>
                  <div className="qa-drawer-name">{actionMode === 'approve' ? 'Approve Cancellation' : 'Reject Cancellation'}</div>
                  <div className="qa-drawer-meta">{actionBooking.booking_number} · {actionBooking.customer?.buyer_name || actionBooking.buyer_name || actionBooking.customer_name}</div>
                </div>
              </div>
              <button className="qa-drawer-close" onClick={() => { setActionBooking(null); setActionMode(null); setRevertStatusId(''); }}>×</button>
            </div>
            <div className="qa-drawer-divider"/>
            <div style={{padding:'16px 20px'}}>
              {actionMode === 'approve' && (
                <div style={{background:'#FEF3C7', border:'1px solid #F59E0B44', borderRadius:8, padding:12, marginBottom:16, fontSize:12, color:'#92400E'}}>
                  <strong>⚠ Important:</strong> This will allow the Collection Manager to finalize the cancellation. Make sure you have completed follow-up with the customer.
                </div>
              )}
              {actionMode === 'reject' && (
                <div style={{background:'#DBEAFE', border:'1px solid #3B82F644', borderRadius:8, padding:12, marginBottom:16, fontSize:12, color:'#1E40AF'}}>
                  <strong>ℹ Note:</strong> Rejecting will revert the booking to its previous status. The customer will continue as existing.
                </div>
              )}
              {actionMode === 'reject' && (
                <div className="bkd-form-group">
                  <label className="bkd-form-label">Revert To Status *</label>
                  <select className="bkd-form-control" value={revertStatusId} onChange={(e) => setRevertStatusId(e.target.value)}>
                    <option value="">Select status</option>
                    {getRevertStatusOptions(actionBooking).map((status) => (
                      <option key={status.id} value={status.id}>{status.status_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="bkd-form-group">
                <label className="bkd-form-label">Remarks *</label>
                <textarea className="bkd-form-control" rows={3}
                  placeholder={actionMode === 'approve' ? 'Document follow-up outcome...' : 'Reason for rejection (e.g., customer approached another unit)...'}
                  value={remarks} onChange={e => setRemarks(e.target.value)}/>
              </div>
            </div>
            <div style={{padding:'16px 20px', borderTop:'1px solid var(--border-primary)'}}>
              <button className="qa-drawer-save-btn" style={{
                background: actionMode === 'approve' ? '#22C55E' : '#EF4444',
                width: '100%', padding: '10px 20px', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
                disabled={saving || !remarks.trim() || (actionMode === 'reject' && !revertStatusId)}
                onClick={actionMode === 'approve' ? handleApprove : handleReject}>
                {saving ? 'Processing...' : actionMode === 'approve' ? 'Approve Cancellation' : 'Reject & Revert'}
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
