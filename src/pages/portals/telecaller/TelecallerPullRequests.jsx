import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import { getErrorMessage } from '../../../utils/helpers';
import { formatDateTime } from '../../../utils/formatters';
import '../common/LeadWorkspacePage.css';

const TelecallerPullRequests = ({ user }) => {
  const [pullRequests, setPullRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({});

  const loadPullRequests = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await leadWorkflowApi.getPullRequests('incoming');
      setPullRequests(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load pull requests'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPullRequests(); }, [loadPullRequests]);

  const handleRespond = async (prId, status) => {
    setResponding((p) => ({ ...p, [prId]: true }));
    try {
      await leadWorkflowApi.respondToPullRequest(prId, status, '');
      toast.success(status === 'ACCEPTED' ? 'Pull request accepted — lead transferred' : 'Pull request rejected');
      loadPullRequests();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to respond'));
    } finally {
      setResponding((p) => ({ ...p, [prId]: false }));
    }
  };

  const pending = pullRequests.filter((pr) => pr.status === 'PENDING');
  const history = pullRequests.filter((pr) => pr.status !== 'PENDING');

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1> Pull Requests</h1>
          <p className="hidden sm:block">Sales Managers requesting to take over your leads</p>
        </div>
        <div className="page-header-right">
          <button className="crm-btn crm-btn-ghost" onClick={loadPullRequests} disabled={loading}>
             Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="crm-card" style={{ textAlign: 'center', padding: 40 }}>⏳ Loading...</div>
      ) : (
        <>
          {/* Pending Requests */}
          {pending.length > 0 && (
            <div className="crm-card" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 700, color: 'var(--accent-yellow)' }}>
                ⚠️ Pending Requests ({pending.length})
              </h3>
              {pending.map((pr) => (
                <div key={pr.id} style={{
                  border: '1px solid var(--accent-yellow)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 12,
                  background: 'rgba(245, 158, 11, 0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {pr.leadName} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>({pr.leadNumber})</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>📞 {pr.leadPhone}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        <span className="crm-badge" style={{ background: pr.leadStageColor + '22', color: pr.leadStageColor, fontSize: 11 }}>
                          {pr.leadStage}
                        </span>
                        <span className="crm-badge" style={{ fontSize: 11 }}>{pr.leadStatus}</span>
                        {pr.leadProject && <span className="crm-badge" style={{ fontSize: 11 }}>🏗️ {pr.leadProject}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-purple)' }}>
                        Requested by: {pr.requesterName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pr.requesterRole}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {formatDateTime(pr.createdAt)}
                      </div>
                    </div>
                  </div>

                  {pr.note && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      💬 {pr.note}
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      className="crm-btn crm-btn-danger crm-btn-sm"
                      onClick={() => handleRespond(pr.id, 'REJECTED')}
                      disabled={responding[pr.id]}
                    >
                      ❌ Reject
                    </button>
                    <button
                      className="crm-btn crm-btn-success crm-btn-sm"
                      onClick={() => handleRespond(pr.id, 'ACCEPTED')}
                      disabled={responding[pr.id]}
                    >
                      ✅ Accept & Transfer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Pending */}
          {pending.length === 0 && (
            <div className="crm-card" style={{ marginBottom: 20 }}>
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <div className="empty-title">No pending requests</div>
                <div className="empty-desc">You have no pending pull requests from Sales Managers</div>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="crm-card">
              <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
                📋 History ({history.length})
              </h3>
              {history.map((pr) => (
                <div key={pr.id} style={{
                  border: '1px solid var(--border-primary)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 8,
                  opacity: 0.7,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{pr.leadName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> ({pr.leadNumber})</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> → {pr.requesterName}</span>
                  </div>
                  <span className={`crm-badge ${pr.status === 'ACCEPTED' ? '' : ''}`} style={{
                    background: pr.status === 'ACCEPTED' ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)',
                    color: pr.status === 'ACCEPTED' ? 'var(--accent-green)' : 'var(--accent-red)',
                    fontSize: 11,
                  }}>
                    {pr.status === 'ACCEPTED' ? '✅ Accepted' : '❌ Rejected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TelecallerPullRequests;
