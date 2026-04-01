import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import followUpApi from '../../../api/followUpApi';
import { formatDateTime } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';

const TelecallerFollowUps = ({ user }) => {
  const [followUps, setFollowUps] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null);
  const [completeForm, setCompleteForm] = useState({ outcome: '', notes: '', call_disposition: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allResp, overdueResp] = await Promise.all([
        followUpApi.getAll({ is_completed: filter === 'completed' ? 'true' : 'false' })
          .then(r => r.data),
        followUpApi.getOverdue().then(r => r.data),
      ]);
      setFollowUps(allResp?.rows || allResp?.data || allResp || []);
      setOverdue(overdueResp?.rows || overdueResp?.data || overdueResp || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load follow-ups'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (id) => {
    try {
      await followUpApi.complete(id, completeForm);
      toast.success('Follow-up completed');
      setCompleting(null);
      setCompleteForm({ outcome: '', notes: '', call_disposition: '' });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete follow-up'));
    }
  };

  const isOverdue = (scheduledAt) => {
    return new Date(scheduledAt) < new Date() && filter !== 'completed';
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Follow-ups</h1>
          <p>Manage your scheduled calls & follow-ups</p>
        </div>
        <div className="page-header-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="crm-form-select" style={{ width: 140 }}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <button className="crm-btn crm-btn-ghost" onClick={load}>↻ Refresh</button>
        </div>
      </div>

      {/* Overdue Banner */}
      {overdue.length > 0 && filter === 'pending' && (
        <div className="handoff-banner" style={{ background: 'var(--accent-red-bg)', borderColor: 'var(--accent-red)', marginBottom: 20 }}>
          <div className="handoff-banner-icon" style={{ background: 'var(--accent-red-bg)', color: 'var(--accent-red)' }}>⚠️</div>
          <div className="handoff-banner-text">
            <div className="handoff-banner-title" style={{ color: 'var(--accent-red)' }}>
              You have {overdue.length} overdue follow-up{overdue.length > 1 ? 's' : ''}
            </div>
            <div className="handoff-banner-desc">Please address these as soon as possible to maintain lead temperature.</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          Loading follow-ups...
        </div>
      )}

      {!loading && (
        <div className="crm-card">
          <div className="crm-card-body-flush">
            {(Array.isArray(followUps) ? followUps : []).length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📞</div>
                <div className="empty-title">No {filter} follow-ups found</div>
                <div className="empty-desc">You're all caught up for {filter === 'pending' ? 'now' : 'this period'}.</div>
              </div>
            )}

            <div className="followup-list">
              {(Array.isArray(followUps) ? followUps : []).map((fu) => {
                const isLate = isOverdue(fu.scheduled_at);
                const schedDate = new Date(fu.scheduled_at);
                
                return (
                  <div key={fu.id} className="followup-item" style={isLate ? { background: 'var(--accent-red-bg)' } : {}}>
                    <div className="followup-time-block">
                      <div className="followup-time" style={isLate ? { color: 'var(--accent-red)' } : {}}>
                        {fu.scheduled_at ? schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'}
                      </div>
                      <div className="followup-period">
                        {fu.scheduled_at ? (schedDate.getHours() >= 12 ? 'PM' : 'AM') : ''}
                      </div>
                      <div className="followup-period" style={{ marginTop: 2 }}>
                        {fu.scheduled_at ? schedDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                      </div>
                      {isLate && <div className="followup-overdue-tag">OVERDUE</div>}
                    </div>

                    <div className="followup-content">
                      <div className="followup-name">
                        {fu.lead?.first_name} {fu.lead?.last_name || ''}
                        <span className={`crm-badge badge-${(fu.follow_up_mode || 'call').toLowerCase()}`}>
                          {fu.follow_up_mode || 'Call'}
                        </span>
                        {fu.lead?.stage && (
                          <span className="crm-badge" style={{ backgroundColor: fu.lead.stage.color_code + '22', color: fu.lead.stage.color_code }}>
                            {fu.lead.stage.stage_name}
                          </span>
                        )}
                      </div>
                      <div className="followup-note">{fu.notes}</div>
                      <div className="followup-meta">
                        {fu.lead?.phone && <span>📱 {fu.lead.phone}</span>}
                        {fu.lead?.project && <span>📍 {fu.lead.project.project_name}</span>}
                      </div>

                      {/* Complete Form (expand on click) */}
                      {!fu.is_completed && completing === fu.id && (
                        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <select
                            value={completeForm.outcome}
                            onChange={(e) => setCompleteForm(p => ({ ...p, outcome: e.target.value }))}
                            className="crm-form-select"
                            style={{ width: 180 }}
                          >
                            <option value="">Select outcome...</option>
                            <option value="Interested">Interested</option>
                            <option value="Not Interested">Not Interested</option>
                            <option value="Callback">Callback Requested</option>
                            <option value="Not Reachable">Not Reachable</option>
                            <option value="Wrong Number">Wrong Number</option>
                            <option value="Voicemail">Voicemail</option>
                            <option value="SV Scheduled">Site Visit Scheduled</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Completion notes..."
                            value={completeForm.notes}
                            onChange={(e) => setCompleteForm(p => ({ ...p, notes: e.target.value }))}
                            className="crm-form-input"
                            style={{ flex: 1 }}
                          />
                          <button className="crm-btn crm-btn-success" onClick={() => handleComplete(fu.id)}>
                            ✓ Save
                          </button>
                          <button className="crm-btn crm-btn-ghost" onClick={() => setCompleting(null)}>
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="followup-actions">
                      {!fu.is_completed && completing !== fu.id && (
                        <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => setCompleting(fu.id)}>
                          ✓ Complete
                        </button>
                      )}
                      {fu.is_completed && (
                        <div style={{ textAlign: 'right' }}>
                          <span className="crm-badge badge-won"><span className="crm-badge-dot"></span>Completed</span>
                          {fu.outcome && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fu.outcome}</div>}
                          {fu.completed_at && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateTime(fu.completed_at)}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelecallerFollowUps;
