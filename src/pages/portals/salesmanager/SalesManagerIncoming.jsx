import React, { useState, useEffect, useCallback } from 'react';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { formatDateTime } from '../../../utils/formatters';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/helpers';

const SalesManagerIncoming = ({ onNavigate }) => {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const fetchHandoffs = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await leadWorkflowApi.getHandoffs({
        type: 'incoming',
        stageCode: 'SV_COMPLETED',
        currentOnly: true,
        limit: 100,
      });
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      setHandoffs(rows);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load incoming leads.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHandoffs();
  }, [fetchHandoffs]);

  const handleAccept = async (handoff) => {
    setProcessingId(handoff.id);
    try {
      await leadWorkflowApi.transitionLead(handoff.leadId, 'SM_ACCEPT_HANDOFF', {
        note: 'Incoming handoff accepted by Sales Manager',
      });
      toast.success('Lead accepted successfully!');
      fetchHandoffs();
      onNavigate?.('leads');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to accept lead.'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (handoff) => {
    if (!handoff.fromUserId) {
      toast.error('Source owner not found for this handoff');
      return;
    }

    setProcessingId(handoff.id);
    try {
      await leadWorkflowApi.assignLead(handoff.leadId, handoff.fromUserId, 'Handoff rejected by Sales Manager');
      toast.success('Lead rejected.');
      fetchHandoffs();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reject lead.'));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="loading-state">Loading handoffs...</div>;
  if (error) return <div className="error-state">{error}</div>;

  return (
    <div className="incoming-leads-page">
      <div className="page-header flex-col md:flex-row md:items-center gap-3">
        <div className="page-header-left">
          <h1>Incoming Leads</h1>
          <p className="hidden sm:block">Leads handed off from telecallers after site visit completion</p>
        </div>
      </div>

      <div className="incoming-grid grid grid-cols-1 md:grid-cols-2 gap-4">
        {handoffs.length === 0 ? (
          <div className="crm-card" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <div className="empty-icon">⚡</div>
              <div className="empty-title">No incoming leads at the moment</div>
              <div className="empty-desc">When telecallers complete site visits and hand off leads, they'll appear here.</div>
            </div>
          </div>
        ) : (
          handoffs.map((handoff) => (
            <div key={handoff.id} className="approval-card" style={{ borderLeft: '4px solid var(--accent-yellow)', background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div className="approval-header" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="approval-title" style={{ fontSize: '1.2rem', fontWeight: 600 }}>{handoff.leadName || 'Unnamed Lead'}</div>
                      <div className="approval-sub" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        From {handoff.fromUserName || 'Telecaller'} · {formatDateTime(handoff.handedOffAt)}
                      </div>
                    </div>
                  <span className={`crm-badge ${handoff.stageCode === 'SV_COMPLETED' ? 'badge-interested' : 'badge-neutral'}`} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>
                    {handoff.stageName || 'Pending'}
                  </span>
                </div>
              </div>
                <div className="approval-grid grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <div>
                  <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Lead #</div>
                  <div className="approval-field-value">{handoff.leadNumber || '—'}</div>
                </div>
                  <div>
                    <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Phone</div>
                    <div className="approval-field-value">{handoff.leadPhone || '—'}</div>
                  </div>
                  <div>
                    <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Project</div>
                    <div className="approval-field-value">{handoff.leadProjectName || '—'}</div>
                  </div>
                  <div>
                    <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Owner</div>
                    <div className="approval-field-value">{handoff.currentAssigneeName || '—'}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>TC Remarks</div>
                    <div className="approval-field-value" style={{ fontStyle: 'italic' }}>"{handoff.remarks || 'Awaiting details'}"</div>
                  </div>
                </div>
                <div className="approval-actions" style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" style={{ flex: 1 }} onClick={() => handleReject(handoff)} disabled={processingId === handoff.id}>{processingId === handoff.id ? 'Please wait...' : 'Reject'}</button>
                  <button className="crm-btn crm-btn-success crm-btn-sm" style={{ flex: 2 }} onClick={() => handleAccept(handoff)} disabled={processingId === handoff.id}>{processingId === handoff.id ? 'Please wait...' : '✓ Accept Lead'}</button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default SalesManagerIncoming;
