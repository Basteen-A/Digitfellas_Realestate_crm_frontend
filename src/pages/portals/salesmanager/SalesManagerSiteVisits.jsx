import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import siteVisitApi from '../../../api/siteVisitApi';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import { getErrorMessage } from '../../../utils/helpers';

const SalesManagerSiteVisits = ({ onNavigate }) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedLead, setExpandedLead] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    lead_id: '',
    project_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time_slot: '',
    attended_by: '',
    remarks: '',
    feedback: '',
    rating: '',
    interested_after_visit: null,
  });
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [creating, setCreating] = useState(false);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await siteVisitApi.getMyLeadVisits({ limit: 200 });
      const data = resp.data?.data || resp.data?.rows || resp.data || [];
      setVisits(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load site visits'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const filteredVisits = visits.filter(v => {
    if (filter === 'upcoming') return ['Scheduled', 'Confirmed', 'Rescheduled'].includes(v.status);
    if (filter === 'completed') return v.status === 'Completed';
    if (filter === 'cancelled') return v.status === 'Cancelled';
    return true;
  });

  // Group visits by lead
  const groupedByLead = {};
  filteredVisits.forEach(v => {
    const leadId = v.lead?.id || 'unknown';
    if (!groupedByLead[leadId]) {
      groupedByLead[leadId] = {
        lead: v.lead,
        visits: [],
      };
    }
    groupedByLead[leadId].visits.push(v);
  });

  const leadGroups = Object.values(groupedByLead);

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

  const loadCreateOptions = async () => {
    try {
      const [projResp, leadsResp] = await Promise.all([
        projectApi.getDropdown(),
        leadWorkflowApi.getLeads({ roleCode: 'SM', limit: 100 }),
      ]);
      setProjects(projResp.data || []);
      setLeads(Array.isArray(leadsResp.data) ? leadsResp.data : []);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const handleOpenCreate = async () => {
    setShowCreateModal(true);
    await loadCreateOptions();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.lead_id || !createForm.project_id || !createForm.scheduled_date) {
      toast.error('Lead, Project and Date are required');
      return;
    }
    setCreating(true);
    try {
      await siteVisitApi.create({
        ...createForm,
        rating: createForm.rating ? Number(createForm.rating) : null,
      });
      toast.success('Site visit created successfully');
      setShowCreateModal(false);
      setCreateForm({
        lead_id: '',
        project_id: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time_slot: '',
        attended_by: '',
        remarks: '',
        feedback: '',
        rating: '',
        interested_after_visit: null,
      });
      loadVisits();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create site visit'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1> Site Visit Records</h1>
          <p className="hidden sm:block">View all site visits for your leads</p>
        </div>
        <div className="page-header-actions flex-wrap">
          <div className="crm-btn-group">
            {['all', 'upcoming', 'completed', 'cancelled'].map(f => (
              <button
                key={f}
                className={`crm-btn ${filter === f ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="crm-btn crm-btn-ghost" onClick={loadVisits}>↻ Refresh</button>
          <button className="crm-btn crm-btn-primary" onClick={handleOpenCreate}>+ Add Site Visit</button>
        </div>
      </div>

      {loading ? (
        <div className="crm-card" style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--accent-blue-bg)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading site visits...</p>
        </div>
      ) : leadGroups.length === 0 ? (
        <div className="crm-card">
          <div className="empty-state">
            <div className="empty-icon">🏠</div>
            <div className="empty-title">No site visits found</div>
            <div className="empty-desc">Site visit records will appear here when visits are recorded for your leads.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {leadGroups.map(({ lead, visits: leadVisits }) => {
            const leadId = lead?.id || 'unknown';
            const isExpanded = expandedLead === leadId;
            const completedCount = leadVisits.filter(v => v.status === 'Completed').length;

            return (
              <div key={leadId} className="crm-card" style={{ overflow: 'hidden' }}>
                {/* Lead Header */}
                <div
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExpanded ? 'var(--bg-tertiary)' : 'transparent', transition: 'background 0.2s' }}
                  onClick={() => setExpandedLead(isExpanded ? null : leadId)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                      {(lead?.first_name?.[0] || '').toUpperCase()}{(lead?.last_name?.[0] || '').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{lead?.first_name} {lead?.last_name || ''}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lead?.lead_number} · {lead?.phone}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {lead?.stage && (
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: lead.stage.color_code + '22', color: lead.stage.color_code }}>
                        {lead.stage.stage_name}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {leadVisits.length} visit{leadVisits.length !== 1 ? 's' : ''} · {completedCount} done
                    </span>
                    <span style={{ fontSize: 18, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▾</span>
                  </div>
                </div>

                {/* Expanded Visit List */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-primary)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="crm-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Visit #</th>
                            <th>Project</th>
                            <th>Date</th>
                            <th>Time Slot</th>
                            <th>Status</th>
                            <th>Rating</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadVisits.map(v => (
                            <tr key={v.id}>
                              <td style={{ fontWeight: 600 }}>{v.visit_number || '—'}</td>
                              <td>{v.project?.project_name || 'N/A'}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{formatDate(v.scheduled_date)}</div>
                                {v.actual_visit_date && v.status === 'Completed' && (
                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Actual: {formatDate(v.actual_visit_date)}</div>
                                )}
                              </td>
                              <td>{v.scheduled_time_slot || formatTime(v.scheduled_date) || '—'}</td>
                              <td>{getStatusBadge(v.status)}</td>
                              <td>
                                {v.rating ? (
                                  <span style={{ fontWeight: 700, color: v.rating >= 4 ? 'var(--accent-green)' : v.rating >= 3 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                                    {'★'.repeat(v.rating)}{'☆'.repeat(5 - v.rating)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td>
                                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setSelectedVisit(v)}>
                                  Details
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
            );
          })}
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
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Visit Number</div><div style={{ fontWeight: 700 }}>{selectedVisit.visit_number || '—'}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Status</div>{getStatusBadge(selectedVisit.status)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Lead</div><div style={{ fontWeight: 600 }}>{selectedVisit.lead?.first_name} {selectedVisit.lead?.last_name || ''}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Phone</div>{selectedVisit.lead?.phone || '—'}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Project</div>{selectedVisit.project?.project_name || '—'}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Scheduled Date</div>{formatDate(selectedVisit.scheduled_date)}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Time Slot</div>{selectedVisit.scheduled_time_slot || '—'}</div>
                <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Attended By</div>{selectedVisit.attendedBy ? `${selectedVisit.attendedBy.first_name} ${selectedVisit.attendedBy.last_name || ''}` : '—'}</div>
                {selectedVisit.rating && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Rating</div><span style={{ fontWeight: 700, fontSize: 16 }}>{'★'.repeat(selectedVisit.rating)}{'☆'.repeat(5 - selectedVisit.rating)}</span></div>}
                {selectedVisit.time_spent && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Time Spent</div>{selectedVisit.time_spent} mins</div>}
                {selectedVisit.interested_after_visit !== null && selectedVisit.interested_after_visit !== undefined && <div><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>Interested After Visit</div>{selectedVisit.interested_after_visit ? '✅ Yes' : '❌ No'}</div>}
              </div>
              {selectedVisit.feedback && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Feedback</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.feedback}</div>
                </div>
              )}
              {selectedVisit.remarks && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Remarks</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.remarks}</div>
                </div>
              )}
              {selectedVisit.requirement_details && (
                <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Requirement Details</div>
                  <div style={{ fontSize: 13 }}>{selectedVisit.requirement_details}</div>
                </div>
              )}
              {selectedVisit.geo_lat && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                  📍 Location: {selectedVisit.geo_lat}, {selectedVisit.geo_long}
                </div>
              )}
            </div>
            <div className="col-modal-footer">
              <button className="crm-btn crm-btn-ghost" onClick={() => setSelectedVisit(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Site Visit Modal */}
      {showCreateModal && (
        <div className="col-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="col-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="col-modal-header">
              <h2>Add Site Visit</h2>
              <button className="col-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="col-modal-body">
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Lead *</label>
                  <select
                    value={createForm.lead_id}
                    onChange={(e) => setCreateForm(p => ({ ...p, lead_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                    required
                  >
                    <option value="">Select lead...</option>
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>{l.fullName || l.first_name} - {l.phone}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Project *</label>
                  <select
                    value={createForm.project_id}
                    onChange={(e) => setCreateForm(p => ({ ...p, project_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                    required
                  >
                    <option value="">Select project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Visit Date *</label>
                    <input
                      type="date"
                      value={createForm.scheduled_date}
                      onChange={(e) => setCreateForm(p => ({ ...p, scheduled_date: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Time Slot</label>
                    <input
                      type="text"
                      value={createForm.scheduled_time_slot}
                      onChange={(e) => setCreateForm(p => ({ ...p, scheduled_time_slot: e.target.value }))}
                      placeholder="e.g., 10:00 AM - 12:00 PM"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Rating (1-5)</label>
                    <select
                      value={createForm.rating}
                      onChange={(e) => setCreateForm(p => ({ ...p, rating: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                    >
                      <option value="">Select rating...</option>
                      {[1,2,3,4,5].map(r => (
                        <option key={r} value={r}>{'★'.repeat(r)}{'☆'.repeat(5-r)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Interested After Visit</label>
                    <select
                      value={createForm.interested_after_visit === null ? '' : createForm.interested_after_visit}
                      onChange={(e) => setCreateForm(p => ({ ...p, interested_after_visit: e.target.value === '' ? null : e.target.value === 'true' }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                    >
                      <option value="">Select...</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Feedback</label>
                  <textarea
                    value={createForm.feedback}
                    onChange={(e) => setCreateForm(p => ({ ...p, feedback: e.target.value }))}
                    rows={3}
                    placeholder="Enter feedback..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Remarks</label>
                  <textarea
                    value={createForm.remarks}
                    onChange={(e) => setCreateForm(p => ({ ...p, remarks: e.target.value }))}
                    rows={2}
                    placeholder="Additional remarks..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14 }}
                  />
                </div>
              </div>
              <div className="col-modal-footer">
                <button type="button" className="crm-btn crm-btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="crm-btn crm-btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Site Visit'}
                </button>
              </div>
            </form>
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

export default SalesManagerSiteVisits;
