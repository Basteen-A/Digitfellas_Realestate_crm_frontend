import React, { useState, useEffect, useCallback } from 'react';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import customerTypeApi from '../../../api/customerTypeApi';
import { formatDateTime } from '../../../utils/formatters';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/helpers';

const SalesManagerIncoming = ({ onNavigate }) => {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [motivationOptions, setMotivationOptions] = useState([]);
  const [acceptForms, setAcceptForms] = useState({});

  const loadProjects = useCallback(async () => {
    try {
      const resp = await projectApi.getDropdown();
      setProjectOptions(resp.data || []);
    } catch {
      setProjectOptions([]);
    }
  }, []);

  const loadMotivationOptions = useCallback(async () => {
    try {
      const resp = await customerTypeApi.getDropdown();
      setMotivationOptions(resp.data || []);
    } catch {
      setMotivationOptions([]);
    }
  }, []);

  const fetchHandoffs = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await leadWorkflowApi.getHandoffs({
        type: 'incoming',
        stageCode: 'SITE_VISIT',
        statusCode: 'SV_DONE',
        currentOnly: true,
        pendingAcceptance: true,
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

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadMotivationOptions();
  }, [loadMotivationOptions]);

  const updateAcceptForm = (handoffId, patch) => {
    setAcceptForms((prev) => {
      const current = prev[handoffId] || {};
      return { ...prev, [handoffId]: { ...current, ...patch } };
    });
  };

  const handleAccept = async (handoff) => {
    const form = acceptForms[handoff.id] || {};
    const selectedProjectId = form.svProjectId || handoff.leadProjectId || '';
    if (!form.svDate) {
      toast.error('Please enter Site Visit date before accepting.');
      return;
    }
    if (!selectedProjectId) {
      toast.error('Please select visited project before accepting.');
      return;
    }
    if (form.latitude === undefined || form.latitude === null || form.latitude === '' || form.longitude === undefined || form.longitude === null || form.longitude === '') {
      toast.error('Please capture location before accepting.');
      return;
    }

    setProcessingId(handoff.id);
    try {
      await leadWorkflowApi.acceptIncomingLead(handoff.leadId, {
        svDate: form.svDate,
        svProjectId: selectedProjectId,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        motivationType: form.motivationType || null,
        primaryRequirement: form.primaryRequirement || null,
        secondaryRequirement: form.secondaryRequirement || null,
        note: form.note || 'Incoming handoff accepted by Sales Manager and moved to My Leads',
        timeSpent: form.timeSpent ? Number(form.timeSpent) : null,
      });
      setHandoffs((prev) => prev.filter((item) => item.id !== handoff.id));
      toast.success('Lead accepted successfully!');
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

  const isAcceptReady = (handoff) => {
    const form = acceptForms[handoff.id] || {};
    const selectedProjectId = form.svProjectId || handoff.leadProjectId || '';
    const hasLocation = form.latitude !== undefined && form.latitude !== null && form.latitude !== ''
      && form.longitude !== undefined && form.longitude !== null && form.longitude !== '';
    return Boolean(form.svDate && selectedProjectId && hasLocation);
  };

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
                  <span className={`crm-badge ${handoff.stageCode === 'SITE_VISIT' ? 'badge-interested' : 'badge-neutral'}`} style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>
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

                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Accept With Site Visit Details</div>
                  <div className="approval-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>SV Date *</div>
                      <input
                        type="date"
                        className="crm-form-input"
                        value={acceptForms[handoff.id]?.svDate || ''}
                        onChange={(e) => updateAcceptForm(handoff.id, { svDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Visited Project *</div>
                      <select
                        className="crm-form-input"
                        value={acceptForms[handoff.id]?.svProjectId || handoff.leadProjectId || ''}
                        onChange={(e) => updateAcceptForm(handoff.id, { svProjectId: e.target.value })}
                      >
                        <option value="">Select project</option>
                        {projectOptions.map((p) => (
                          <option key={p.id} value={p.id}>{p.project_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Motivation Type</div>
                      <select
                        className="crm-form-input"
                        value={acceptForms[handoff.id]?.motivationType || ''}
                        onChange={(e) => updateAcceptForm(handoff.id, { motivationType: e.target.value })}
                      >
                        <option value="">Select motivation type</option>
                        {motivationOptions.map((m) => (
                          <option key={m.id} value={m.type_name || m.name || ''}>
                            {m.type_name || m.name || 'Unnamed'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Time Spent (mins)</div>
                      <input
                        type="number"
                        min="0"
                        className="crm-form-input"
                        value={acceptForms[handoff.id]?.timeSpent || ''}
                        onChange={(e) => updateAcceptForm(handoff.id, { timeSpent: e.target.value })}
                        placeholder="e.g. 30"
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Location *</div>
                        <button
                          type="button"
                          className="crm-btn crm-btn-ghost crm-btn-sm"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              toast.error('Geolocation not supported in this browser.');
                              return;
                            }
                            navigator.geolocation.getCurrentPosition(
                              (pos) => {
                                updateAcceptForm(handoff.id, {
                                  latitude: pos.coords.latitude,
                                  longitude: pos.coords.longitude,
                                });
                                toast.success('Location captured');
                              },
                              () => toast.error('Unable to capture location. Check browser permissions.')
                            );
                          }}
                        >
                          Capture Location
                        </button>
                      </div>
                      <div className="approval-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="number"
                          step="any"
                          className="crm-form-input"
                          value={acceptForms[handoff.id]?.latitude ?? ''}
                          onChange={(e) => updateAcceptForm(handoff.id, { latitude: e.target.value })}
                          placeholder="Latitude"
                        />
                        <input
                          type="number"
                          step="any"
                          className="crm-form-input"
                          value={acceptForms[handoff.id]?.longitude ?? ''}
                          onChange={(e) => updateAcceptForm(handoff.id, { longitude: e.target.value })}
                          placeholder="Longitude"
                        />
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Primary Requirement</div>
                      <input
                        className="crm-form-input"
                        value={acceptForms[handoff.id]?.primaryRequirement || ''}
                        onChange={(e) => updateAcceptForm(handoff.id, { primaryRequirement: e.target.value })}
                        placeholder="e.g. 2BHK near school"
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="approval-field-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Secondary Requirement / Notes</div>
                      <textarea
                        className="crm-form-input"
                        rows={2}
                        value={acceptForms[handoff.id]?.secondaryRequirement || ''}
                        onChange={(e) => updateAcceptForm(handoff.id, { secondaryRequirement: e.target.value })}
                        placeholder="Additional details from SM"
                        style={{ minHeight: 66 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="approval-actions" style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" style={{ flex: 1 }} onClick={() => handleReject(handoff)} disabled={processingId === handoff.id}>{processingId === handoff.id ? 'Please wait...' : 'Reject'}</button>
                  <button className="crm-btn crm-btn-success crm-btn-sm" style={{ flex: 2 }} onClick={() => handleAccept(handoff)} disabled={processingId === handoff.id || !isAcceptReady(handoff)}>{processingId === handoff.id ? 'Please wait...' : '✓ Accept Lead'}</button>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default SalesManagerIncoming;
