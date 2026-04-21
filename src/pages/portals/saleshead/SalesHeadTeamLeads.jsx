import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import siteVisitApi from '../../../api/siteVisitApi';
import { getErrorMessage } from '../../../utils/helpers';

const SalesHeadTeamLeads = () => {
  const [smTeam, setSMTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSM, setSelectedSM] = useState(null);
  const [smLeads, setSMLeads] = useState([]);
  const [smLeadsLoading, setSMLeadsLoading] = useState(false);
  const [smVisits, setSMVisits] = useState([]);
  const [smVisitsLoading, setSMVisitsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('leads');
  const [selectedVisit, setSelectedVisit] = useState(null);

  // Reassign
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignLead, setReassignLead] = useState(null);
  const [reassignTarget, setReassignTarget] = useState('');
  const [reassignNote, setReassignNote] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await leadWorkflowApi.getMySMTeam();
      setSMTeam(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load SM team'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const handleSelectSM = async (sm) => {
    setSelectedSM(sm);
    setActiveTab('leads');
    setSMLeadsLoading(true);
    setSMVisitsLoading(true);
    try {
      const [leadsResp, visitsResp] = await Promise.all([
        leadWorkflowApi.getLeadsBySM(sm.id, { limit: 200 }),
        siteVisitApi.getBySM(sm.id, { limit: 200 }),
      ]);
      setSMLeads(leadsResp.data || []);
      const vData = visitsResp.data?.data || visitsResp.data?.rows || visitsResp.data || [];
      setSMVisits(Array.isArray(vData) ? vData : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load SM data'));
    } finally {
      setSMLeadsLoading(false);
      setSMVisitsLoading(false);
    }
  };

  const handleReassignOpen = (lead) => {
    setReassignLead(lead);
    setReassignTarget('');
    setReassignNote('');
    setReassignModalOpen(true);
  };

  const handleReassignSubmit = async () => {
    if (!reassignTarget) { toast.error('Please select a Sales Manager'); return; }
    if (reassignTarget === selectedSM?.id) { toast.error('Cannot reassign to the same SM'); return; }
    setReassigning(true);
    try {
      await leadWorkflowApi.reassignLeadToSM(reassignLead.id, reassignTarget, reassignNote.trim() || undefined);
      toast.success('Lead reassigned successfully');
      setReassignModalOpen(false);
      setReassignLead(null);
      // Refresh current SM's leads
      if (selectedSM) handleSelectSM(selectedSM);
      loadTeam();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reassign lead'));
    } finally {
      setReassigning(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const getStatusBadge = (status) => {
    const colors = {
      Scheduled: { bg: '#dbeafe', color: '#2563eb' }, Confirmed: { bg: '#ede9fe', color: '#7c3aed' },
      Completed: { bg: '#dcfce7', color: '#16a34a' }, Cancelled: { bg: '#fee2e2', color: '#dc2626' },
    };
    const c = colors[status] || { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };
    return (<span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{status}</span>);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1> Sales Manager Team</h1>
          <p className="hidden sm:block">View your team's leads, site visits, and reassign between managers</p>
        </div>
        <div className="page-header-actions">
          <button className="crm-btn crm-btn-ghost" onClick={loadTeam} disabled={loading}> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedSM ? '300px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
        {/* SM List Panel */}
        <div className="crm-card" style={{ position: 'sticky', top: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, fontSize: 14 }}>
            Sales Managers ({smTeam.length})
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading team...</div>
          ) : smTeam.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
              <div>No Sales Managers report to you</div>
            </div>
          ) : (
            <div>
              {smTeam.map(sm => {
                const isActive = selectedSM?.id === sm.id;
                return (
                  <div
                    key={sm.id}
                    onClick={() => handleSelectSM(sm)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-primary)',
                      background: isActive ? 'var(--accent-blue-bg)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => !isActive && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseOut={e => !isActive && (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                        color: isActive ? '#fff' : 'var(--text-primary)',
                        fontWeight: 700, fontSize: 13
                      }}>
                        {(sm.firstName?.[0] || '').toUpperCase()}{(sm.lastName?.[0] || '').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{sm.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sm.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {sm.relationshipType === 'shared' && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
                          Shared
                        </span>
                      )}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        {sm.activeLeads} active
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-green-bg)', color: 'var(--accent-green)', fontWeight: 600 }}>
                        {sm.completedVisits} visits
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--accent-yellow-bg)', color: 'var(--accent-yellow)', fontWeight: 600 }}>
                        {sm.upcomingVisits} upcoming
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: SM Detail */}
        {selectedSM && (
          <div>
            {/* SM Info Banner */}
            <div className="crm-card" style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                  {(selectedSM.firstName?.[0] || '').toUpperCase()}{(selectedSM.lastName?.[0] || '').toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedSM.fullName}</div>
                    {selectedSM.relationshipType === 'shared' && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#fef3c7', color: '#d97706', fontWeight: 600 }}>
                        SHARED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedSM.email} · {selectedSM.phone}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-blue)' }}>{selectedSM.activeLeads}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Active</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-green)' }}>{selectedSM.completedVisits}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Visits Done</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedSM.totalLeads}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total</div></div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              <button className={`crm-btn ${activeTab === 'leads' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setActiveTab('leads')}>📋 Leads ({smLeads.length})</button>
              <button className={`crm-btn ${activeTab === 'visits' ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setActiveTab('visits')}>🏠 Site Visits ({smVisits.length})</button>
            </div>

            {/* Leads Tab */}
            {activeTab === 'leads' && (
              <div className="crm-card">
                {smLeadsLoading ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading leads...</div>
                ) : smLeads.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No leads assigned</div>
                    <div style={{ fontSize: 13 }}>This SM has no active leads in their pipeline.</div>
                  </div>
                ) : (
                  <div className="crm-card-body-flush">
                    <div className="crm-table-wrap">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Lead</th>
                            <th>Phone</th>
                            <th>Stage</th>
                            <th>Status</th>
                            <th>Project</th>
                            <th>Last Contact</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {smLeads.map(lead => (
                            <tr key={lead.id}>
                              <td>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{lead.fullName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lead.leadNumber}</div>
                              </td>
                              <td style={{ fontSize: 13 }}>{lead.phone}</td>
                              <td>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (lead.stageColor || '#6B7280') + '22', color: lead.stageColor || '#6B7280' }}>
                                  {lead.stageLabel}
                                </span>
                              </td>
                              <td>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: (lead.statusColor || '#6B7280') + '22', color: lead.statusColor || '#6B7280' }}>
                                  {lead.statusLabel}
                                </span>
                              </td>
                              <td style={{ fontSize: 12 }}>{lead.project || '—'}</td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateTime(lead.lastContactedAt)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => handleReassignOpen(lead)} title="Reassign to another SM">
                                  🔄 Reassign
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Site Visits Tab */}
            {activeTab === 'visits' && (
              <div className="crm-card">
                {smVisitsLoading ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading visits...</div>
                ) : smVisits.length === 0 ? (
                  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🏠</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No site visits recorded</div>
                    <div style={{ fontSize: 13 }}>Site visits for this SM's leads will appear here.</div>
                  </div>
                ) : (
                  <div className="crm-card-body-flush">
                    <div className="crm-table-wrap">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Lead</th>
                            <th>Project</th>
                            <th>Visit Date</th>
                            <th>Status</th>
                            <th>Rating</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {smVisits.map(v => (
                            <tr key={v.id}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{v.lead?.first_name} {v.lead?.last_name || ''}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v.lead?.phone}</div>
                              </td>
                              <td style={{ fontSize: 12 }}>{v.project?.project_name || '—'}</td>
                              <td style={{ fontSize: 12 }}>{formatDate(v.scheduled_date)}</td>
                              <td>{getStatusBadge(v.status)}</td>
                              <td>
                                {v.rating ? (
                                  <span style={{ fontWeight: 700, fontSize: 12, color: v.rating >= 4 ? '#16a34a' : v.rating >= 3 ? '#d97706' : '#dc2626' }}>
                                    {'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td>
                                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setSelectedVisit(v)}>Details</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state when no SM selected */}
        {!selectedSM && !loading && smTeam.length > 0 && (
          <div className="crm-card" style={{ padding: 80, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Select a Sales Manager</div>
            <div style={{ fontSize: 13 }}>Click on a Sales Manager from the left panel to view their leads and site visits.</div>
          </div>
        )}
      </div>

      {/* Reassign Modal */}
      {reassignModalOpen && reassignLead && (
        <div className="col-modal-overlay" onClick={() => setReassignModalOpen(false)}>
          <div className="col-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="col-modal-header">
              <h2>Reassign Lead</h2>
              <button className="col-modal-close" onClick={() => setReassignModalOpen(false)}>×</button>
            </div>
            <div className="col-modal-body">
              <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 700 }}>{reassignLead.fullName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{reassignLead.leadNumber} · {reassignLead.phone}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Currently with: <strong>{selectedSM?.fullName}</strong></div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Assign to Sales Manager *</label>
                <select className="crm-form-select" value={reassignTarget} onChange={e => setReassignTarget(e.target.value)}>
                  <option value="">Select Sales Manager</option>
                  {smTeam.filter(sm => sm.id !== selectedSM?.id).map(sm => (
                    <option key={sm.id} value={sm.id}>{sm.fullName} ({sm.activeLeads} leads)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Reassignment Note</label>
                <textarea className="crm-form-input" rows={3} value={reassignNote} onChange={e => setReassignNote(e.target.value)} placeholder="Reason for reassignment..." />
              </div>
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setReassignModalOpen(false)}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={handleReassignSubmit} disabled={reassigning}>
                {reassigning ? 'Reassigning...' : '🔄 Reassign Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visit Detail Modal */}
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
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Visit Date</div>{formatDate(selectedVisit.scheduled_date)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Status</div>{getStatusBadge(selectedVisit.status)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Attended By</div>{selectedVisit.attendedBy ? `${selectedVisit.attendedBy.first_name} ${selectedVisit.attendedBy.last_name || ''}` : '—'}</div>
                {selectedVisit.rating && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Rating</div><span style={{ fontWeight: 700, fontSize: 16 }}>{'★'.repeat(selectedVisit.rating)}{'☆'.repeat(5 - selectedVisit.rating)}</span></div>}
                {selectedVisit.time_spent && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Time Spent</div>{selectedVisit.time_spent} mins</div>}
              </div>
              {selectedVisit.feedback && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Feedback</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.feedback}</div>
                </div>
              )}
              {selectedVisit.requirement_details && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Requirement</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.requirement_details}</div>
                </div>
              )}
              {selectedVisit.remarks_long && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Remarks</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.remarks_long}</div>
                </div>
              )}
              {selectedVisit.geo_lat && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>📍 Location: {selectedVisit.geo_lat}, {selectedVisit.geo_long}</div>
              )}
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setSelectedVisit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default SalesHeadTeamLeads;
