import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import siteVisitApi from '../../../api/siteVisitApi';
import { getErrorMessage } from '../../../utils/helpers';

const SalesHeadSiteVisits = () => {
  const [team, setTeam] = useState([]);
  const [selectedSM, setSelectedSM] = useState('');
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedVisit, setSelectedVisit] = useState(null);

  const loadTeam = useCallback(async () => {
    try {
      const resp = await leadWorkflowApi.getMySMTeam();
      setTeam(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load SM team'));
    }
  }, []);

  const loadVisits = useCallback(async (smId) => {
    setLoading(true);
    try {
      const resp = await siteVisitApi.getBySM(smId, { limit: 200 });
      const data = resp.data?.data || resp.data?.rows || resp.data || [];
      setVisits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load site visits'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    if (selectedSM) {
      loadVisits(selectedSM);
    } else {
      setVisits([]);
      setLoading(false);
    }
  }, [selectedSM, loadVisits]);

  const filteredVisits = visits.filter(v => {
    if (filter === 'upcoming') return ['Scheduled', 'Confirmed', 'Rescheduled'].includes(v.status);
    if (filter === 'completed') return v.status === 'Completed';
    if (filter === 'cancelled') return v.status === 'Cancelled';
    return true;
  });

  const getStatusBadge = (status) => {
    const colors = {
      Scheduled: { bg: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' },
      Confirmed: { bg: 'var(--accent-purple-bg)', color: 'var(--accent-purple)' },
      Completed: { bg: 'var(--accent-green-bg)', color: 'var(--accent-green)' },
      Cancelled: { bg: 'var(--accent-red-bg)', color: 'var(--accent-red)' },
      'No Show': { bg: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' },
      Rescheduled: { bg: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)' },
    };
    const c = colors[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };
    return (
      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>
        {status}
      </span>
    );
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>🏠 Team Site Visits</h1>
          <p>Monitor site visits across your Sales Manager team</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: 12 }}>
          <select 
            className="crm-form-select" 
            value={selectedSM} 
            onChange={(e) => setSelectedSM(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">Select Sales Manager...</option>
            {team.map(sm => (
              <option key={sm.id} value={sm.id}>{sm.fullName}</option>
            ))}
          </select>
          <div className="crm-btn-group">
            {['all', 'upcoming', 'completed', 'cancelled'].map(f => (
              <button
                key={f}
                className={`crm-btn ${filter === f ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
                onClick={() => setFilter(f)}
                disabled={!selectedSM}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="crm-btn crm-btn-ghost" onClick={() => selectedSM && loadVisits(selectedSM)} disabled={!selectedSM}>↻ Refresh</button>
        </div>
      </div>

      {!selectedSM ? (
        <div className="crm-card" style={{ padding: 80, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👆</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Select a Sales Manager</div>
          <div style={{ fontSize: 13 }}>Please select a Sales Manager from the dropdown above to view their leads' site visits.</div>
        </div>
      ) : loading ? (
        <div className="crm-card" style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading site visits...</p>
        </div>
      ) : filteredVisits.length === 0 ? (
        <div className="crm-card">
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <div className="empty-title">No site visits found</div>
            <div className="empty-desc">No site visit records match the current filters for this Sales Manager.</div>
          </div>
        </div>
      ) : (
        <div className="crm-card">
          <div className="crm-card-body-flush">
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Project</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Rating</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisits.map(v => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.lead?.first_name} {v.lead?.last_name || ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.lead?.phone}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{v.project?.project_name || '—'}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{formatDate(v.scheduled_date)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Slot: {v.scheduled_time_slot || formatTime(v.scheduled_date) || '—'}</div>
                      </td>
                      <td>{getStatusBadge(v.status)}</td>
                      <td>
                        {v.rating ? (
                          <span style={{ fontWeight: 700, fontSize: 13, color: v.rating >= 4 ? '#16a34a' : v.rating >= 3 ? '#d97706' : '#dc2626' }}>
                            {'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setSelectedVisit(v)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Visit Detail Modal (reused similarly from SM page) */}
      {selectedVisit && (
        <div className="col-modal-overlay" onClick={() => setSelectedVisit(null)}>
          <div className="col-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="col-modal-header">
              <h2>Site Visit Details</h2>
              <button className="col-modal-close" onClick={() => setSelectedVisit(null)}>×</button>
            </div>
            <div className="col-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Lead</div><div style={{ fontWeight: 600 }}>{selectedVisit.lead?.first_name} {selectedVisit.lead?.last_name || ''}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Phone</div>{selectedVisit.lead?.phone || '—'}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Project</div>{selectedVisit.project?.project_name || '—'}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Scheduled Date</div>{formatDate(selectedVisit.scheduled_date)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Status</div>{getStatusBadge(selectedVisit.status)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Attended By</div>{selectedVisit.attendedBy ? `${selectedVisit.attendedBy.first_name} ${selectedVisit.attendedBy.last_name || ''}` : '—'}</div>
              </div>
              {selectedVisit.feedback && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Feedback</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.feedback}</div>
                </div>
              )}
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setSelectedVisit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default SalesHeadSiteVisits;
