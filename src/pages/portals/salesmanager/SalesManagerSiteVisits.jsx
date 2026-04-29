import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import siteVisitApi from '../../../api/siteVisitApi';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import customerTypeApi from '../../../api/customerTypeApi';
import motivationApi from '../../../api/motivationApi';
import { getActionsForRole } from '../common/workflowConfig';
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
    // New fields matching incoming leads SV capture
    customer_requirement: '',
    customer_type_id: '',
    motivation_type: '',
    time_spent: '',
    sales_head_id: '',
    action_code: '',
    next_follow_up_at: '',
    closure_reason_id: '',
    reason_note: '',
    call_status: '',
  });
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [salesHeads, setSalesHeads] = useState([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  const [motivationOptions, setMotivationOptions] = useState([]);
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [closureReasons, setClosureReasons] = useState([]);
  const [creating, setCreating] = useState(false);

  // Phone search state
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneResults, setPhoneResults] = useState([]);
  const [phoneSearchLoading, setPhoneSearchLoading] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [selectedLeadInfo, setSelectedLeadInfo] = useState(null);
  const phoneDropdownRef = useRef(null);
  const phoneSearchTimer = useRef(null);

  const siteVisitActionOptions = getActionsForRole(workflowConfig?.actions || {}, 'SM').filter((action) => (
    ['SM_SCHEDULE_REVISIT', 'SM_FOLLOW_UP', 'SM_NEGOTIATION_HOT', 'SM_LOST', 'SM_SITE_VISIT'].includes(action.code)
  ));
  const selectedAction = siteVisitActionOptions.find((action) => action.code === createForm.action_code) || null;
  const isSiteVisitAction = selectedAction?.code === 'SM_SITE_VISIT';
  // Site visit fields shown always, but required only for SM_SITE_VISIT
  const svFieldsRequired = isSiteVisitAction;

  useEffect(() => {
    const loadActionReasons = async () => {
      if (!selectedAction?.needsReason) {
        setClosureReasons([]);
        return;
      }

      try {
        const category = selectedAction.reasonCategory === 'LOST' ? '' : (selectedAction.reasonCategory || '');
        const resp = await leadWorkflowApi.getClosureReasons(category);
        setClosureReasons(resp?.data?.rows || resp?.data || []);
      } catch {
        setClosureReasons([]);
      }
    };

    loadActionReasons();
  }, [selectedAction]);

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

  // Close phone dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(e.target)) {
        setShowPhoneDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      groupedByLead[leadId] = { lead: v.lead, visits: [] };
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
      const [projResp, leadsResp, incomingResp, ctResp, motResp, shResp, wfResp] = await Promise.all([
        projectApi.getDropdown(),
        leadWorkflowApi.getLeads({ roleCode: 'SM', limit: 200 }),
        leadWorkflowApi.getHandoffs({
          type: 'incoming',
          stageCode: 'SITE_VISIT',
          statusCode: 'SV_DONE',
          currentOnly: true,
          pendingAcceptance: true,
          crossSmIncoming: true,
          limit: 200,
        }),
        customerTypeApi.getDropdown(),
        motivationApi.getDropdown(),
        leadWorkflowApi.getAssignableUsers('SH'),
        leadWorkflowApi.getWorkflowConfig(),
      ]);
      setProjects(projResp.data || []);
      const ownLeads = leadsResp.data?.rows || leadsResp.data || [];
      const incomingRows = incomingResp.data || [];
      const incomingLeads = incomingRows.map((row) => ({
        id: row.leadId,
        fullName: row.leadName,
        phone: row.leadPhone,
        leadNumber: row.leadNumber,
        projectId: row.leadProjectId,
        projectName: row.leadProjectName,
      }));
      const mergedLeads = [...(Array.isArray(ownLeads) ? ownLeads : []), ...incomingLeads]
        .filter((lead) => lead?.id)
        .reduce((acc, lead) => {
          if (!acc.some((item) => item.id === lead.id)) acc.push(lead);
          return acc;
        }, []);
      setLeads(mergedLeads);
      setSalesHeads(shResp.data || []);
      setWorkflowConfig(wfResp?.data || null);
      setCustomerTypeOptions(ctResp.data || []);
      setMotivationOptions(motResp.data || []);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const handleOpenCreate = async () => {
    setShowCreateModal(true);
    setPhoneSearch('');
    setPhoneResults([]);
    setSelectedLeadInfo(null);
    await loadCreateOptions();
  };

  // Phone number search with debounce
  const handlePhoneSearchChange = (value) => {
    setPhoneSearch(value);
    setSelectedLeadInfo(null);
    setCreateForm(p => ({ ...p, lead_id: '' }));

    if (phoneSearchTimer.current) clearTimeout(phoneSearchTimer.current);

    if (value.length < 3) {
      setPhoneResults([]);
      setShowPhoneDropdown(false);
      return;
    }

    setPhoneSearchLoading(true);
    phoneSearchTimer.current = setTimeout(async () => {
      try {
        // Search from loaded leads (already filtered to SITE_VISIT stage)
        const localMatches = leads.filter(l => {
          const phone = l.phone || l.phone_number || '';
          const name = (l.fullName || l.first_name || '').toLowerCase();
          return phone.includes(value) || name.includes(value.toLowerCase());
        });

        if (localMatches.length > 0) {
          setPhoneResults(localMatches.slice(0, 10));
        } else {
          // Fallback: search via API (all SM leads)
          try {
            const [ownResp, incomingResp] = await Promise.all([
              leadWorkflowApi.getLeads({ roleCode: 'SM', search: value, limit: 10 }),
              leadWorkflowApi.getHandoffs({
                type: 'incoming',
                stageCode: 'SITE_VISIT',
                statusCode: 'SV_DONE',
                currentOnly: true,
                pendingAcceptance: true,
                crossSmIncoming: true,
                search: value,
                limit: 10,
              }),
            ]);
            const ownLeads = ownResp.data?.rows || ownResp.data || [];
            const incomingLeads = (incomingResp.data || []).map((row) => ({
              id: row.leadId,
              fullName: row.leadName,
              phone: row.leadPhone,
              leadNumber: row.leadNumber,
              projectId: row.leadProjectId,
              projectName: row.leadProjectName,
            }));
            const merged = [...(Array.isArray(ownLeads) ? ownLeads : []), ...incomingLeads]
              .filter((lead) => lead?.id)
              .reduce((acc, lead) => {
                if (!acc.some((item) => item.id === lead.id)) acc.push(lead);
                return acc;
              }, [])
              .slice(0, 10);
            setPhoneResults(merged);
          } catch {
            setPhoneResults([]);
          }
        }
        setShowPhoneDropdown(true);
      } finally {
        setPhoneSearchLoading(false);
      }
    }, 300);
  };

  const handleSelectLead = (lead) => {
    setSelectedLeadInfo(lead);
    setPhoneSearch(lead.phone || lead.phone_number || '');
    setCreateForm(p => ({
      ...p,
      lead_id: lead.id,
      project_id: lead.projectId || lead.project_id || p.project_id,
    }));
    setShowPhoneDropdown(false);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.lead_id) { toast.error('Please search and select a lead by phone number'); return; }
    if (!createForm.action_code) { toast.error('Please select an action'); return; }

    const selectedAction = siteVisitActionOptions.find((action) => action.code === createForm.action_code);
    if (!selectedAction) { toast.error('Selected action is invalid'); return; }

    const isSiteVisitAction = selectedAction.code === 'SM_SITE_VISIT';
    const svFieldsRequired = isSiteVisitAction;

    // Validate only site-visit fields when SM_SITE_VISIT is selected
    if (svFieldsRequired) {
      if (!createForm.project_id) { toast.error('Project is required'); return; }
      if (!createForm.scheduled_date) { toast.error('Visit date is required'); return; }
      if (!createForm.customer_type_id) { toast.error('Customer Type is required'); return; }
      if (!createForm.motivation_type) { toast.error('Motivation is required'); return; }
      if (!createForm.customer_requirement?.trim()) { toast.error('Customer Requirement is required'); return; }
      if (!createForm.time_spent) { toast.error('Time Spent is required'); return; }
    }

    if (selectedAction.needsAssignee && !createForm.sales_head_id) {
      toast.error('Assignee is required for selected action');
      return;
    }
    if (selectedAction.needsFollowUp && !createForm.next_follow_up_at) {
      toast.error('Next follow up date & time is required for selected action');
      return;
    }
    if (selectedAction.needsReason && !createForm.closure_reason_id) {
      toast.error('Closure reason is required for selected action');
      return;
    }
    if (selectedAction.needsRemark && !createForm.remarks?.trim()) {
      toast.error('Remarks are required for selected action');
      return;
    }
    if (selectedAction.needsCallStatus && !createForm.call_status) {
      toast.error('Call status is required for selected action');
      return;
    }

    setCreating(true);
    try {
      await leadWorkflowApi.transitionLead(createForm.lead_id, createForm.action_code, {
        note: createForm.remarks || createForm.feedback || `Action updated via ${selectedAction.label}`,
        assignToUserId: selectedAction.needsAssignee ? (createForm.sales_head_id || undefined) : undefined,
        // Always send site-visit data if filled, regardless of action
        svDate: createForm.scheduled_date ? new Date(createForm.scheduled_date).toISOString() : undefined,
        svProjectId: createForm.project_id || undefined,
        nextFollowUpAt: createForm.next_follow_up_at ? new Date(createForm.next_follow_up_at).toISOString() : undefined,
        closureReasonId: createForm.closure_reason_id || undefined,
        reason: createForm.reason_note || undefined,
        customerTypeId: createForm.customer_type_id || undefined,
        motivationType: createForm.motivation_type || undefined,
        customerRequirement: createForm.customer_requirement || undefined,
        time_spent: createForm.time_spent ? Number(createForm.time_spent) : undefined,
        remarks: createForm.remarks || undefined,
        callStatus: createForm.call_status || undefined,
      });
      toast.success('Site visit recorded and lead updated successfully');
      setShowCreateModal(false);
      setCreateForm({
        lead_id: '', project_id: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time_slot: '', attended_by: '', remarks: '', feedback: '',
        rating: '', interested_after_visit: null,
        customer_requirement: '', customer_type_id: '', motivation_type: '', time_spent: '', sales_head_id: '',
        action_code: '',
        next_follow_up_at: '', closure_reason_id: '', reason_note: '', call_status: '',
      });
      setSelectedLeadInfo(null);
      setPhoneSearch('');
      loadVisits();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create site visit'));
    } finally {
      setCreating(false);
    }
  };

  const fieldLabelStyle = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 };
  const fieldInputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-card, #fff)', color: 'var(--text-primary)' };

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
              <button key={f} className={`crm-btn ${filter === f ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setFilter(f)}>
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

      {/* Create Site Visit Modal (wider, matching incoming leads fields) */}
      {showCreateModal && (
        <div className="col-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="col-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 780 }}>
            <div className="col-modal-header">
              <h2>Add Site Visit</h2>
              <button className="col-modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="col-modal-body">

                {/* ── Phone Number Search ── */}
                <div style={{ marginBottom: 16, position: 'relative' }} ref={phoneDropdownRef}>
                  <label style={fieldLabelStyle}>Search Lead by Phone / Name *</label>
                  <input
                    type="text"
                    value={phoneSearch}
                    onChange={(e) => handlePhoneSearchChange(e.target.value)}
                    onFocus={() => { if (phoneResults.length > 0) setShowPhoneDropdown(true); }}
                    placeholder="Enter phone number or name to search..."
                    style={{ ...fieldInputStyle, paddingRight: 40 }}
                    autoComplete="off"
                  />
                  {phoneSearchLoading && (
                    <div style={{ position: 'absolute', right: 12, top: 30, fontSize: 11, color: 'var(--text-muted)' }}>Searching...</div>
                  )}
                  {showPhoneDropdown && phoneResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary)', borderRadius: 8, zIndex: 100, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                      {phoneResults.map(lead => (
                        <div key={lead.id} onClick={() => handleSelectLead(lead)}
                          style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{lead.fullName || lead.first_name || 'Unnamed'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lead.phone || lead.phone_number} · {lead.leadNumber || lead.lead_number || ''}</div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{lead.projectName || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {showPhoneDropdown && phoneResults.length === 0 && phoneSearch.length >= 3 && !phoneSearchLoading && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary)', borderRadius: 8, zIndex: 100, padding: '14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      No leads found matching "{phoneSearch}"
                    </div>
                  )}
                </div>

                {/* Selected lead info card */}
                {selectedLeadInfo && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--accent-blue-bg)', borderRadius: 8, border: '1px solid var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                      {(selectedLeadInfo.fullName || selectedLeadInfo.first_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedLeadInfo.fullName || selectedLeadInfo.first_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{selectedLeadInfo.phone || selectedLeadInfo.phone_number} · {selectedLeadInfo.leadNumber || selectedLeadInfo.lead_number || ''}</div>
                    </div>
                    <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }} onClick={() => { setSelectedLeadInfo(null); setPhoneSearch(''); setCreateForm(p => ({ ...p, lead_id: '' })); }}>×</button>
                  </div>
                )}

                {/* ── Action Selection ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={fieldLabelStyle}>Action *</label>
                    <select value={createForm.action_code} onChange={(e) => setCreateForm(p => ({ ...p, action_code: e.target.value, next_follow_up_at: '', closure_reason_id: '', reason_note: '' }))} style={fieldInputStyle} required>
                      <option value="">Select action...</option>
                      {siteVisitActionOptions.map((action) => (
                        <option key={action.code} value={action.code}>{action.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ── Site Visit Details Section ── */}
                <div style={{ marginBottom: 20, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Site Visit Details {svFieldsRequired ? '(Required)' : '(Optional)'}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={fieldLabelStyle}>Visit Date {svFieldsRequired ? '*' : ''}</label>
                      <input type="date" value={createForm.scheduled_date} onChange={(e) => setCreateForm(p => ({ ...p, scheduled_date: e.target.value }))} style={fieldInputStyle} required={svFieldsRequired} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Project {svFieldsRequired ? '*' : ''}</label>
                      <select value={createForm.project_id} onChange={(e) => setCreateForm(p => ({ ...p, project_id: e.target.value }))} style={fieldInputStyle} required={svFieldsRequired}>
                        <option value="">Select project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Time Slot</label>
                      <input type="text" value={createForm.scheduled_time_slot} onChange={(e) => setCreateForm(p => ({ ...p, scheduled_time_slot: e.target.value }))} placeholder="e.g. 10AM-12PM" style={fieldInputStyle} />
                    </div>
                  </div>

                {selectedAction?.needsFollowUp && (
                  <div style={{ marginBottom: 20, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Action Details (Required)</div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={fieldLabelStyle}>Next Follow Up Date & Time *</label>
                      <input
                        type="datetime-local"
                        value={createForm.next_follow_up_at}
                        onChange={(e) => setCreateForm((p) => ({ ...p, next_follow_up_at: e.target.value }))}
                        style={fieldInputStyle}
                        required
                      />
                    </div>
                  </div>
                )}

                {selectedAction?.needsReason && (
                  <div style={{ marginBottom: 20, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Action Details (Required)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                      <div>
                        <label style={fieldLabelStyle}>Closure Reason *</label>
                        <select
                          value={createForm.closure_reason_id}
                          onChange={(e) => setCreateForm((p) => ({ ...p, closure_reason_id: e.target.value }))}
                          style={fieldInputStyle}
                          required
                        >
                          <option value="">Select reason...</option>
                          {closureReasons.map((r) => (
                            <option key={r.id} value={r.id}>{r.reason_name || r.reason_text || r.reason}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={fieldLabelStyle}>Reason Notes</label>
                        <textarea
                          value={createForm.reason_note}
                          onChange={(e) => setCreateForm((p) => ({ ...p, reason_note: e.target.value }))}
                          rows={2}
                          placeholder="Optional details..."
                          style={fieldInputStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={fieldLabelStyle}>Customer Type {svFieldsRequired ? '*' : ''}</label>
                      <select value={createForm.customer_type_id || ''} onChange={(e) => setCreateForm(p => ({ ...p, customer_type_id: e.target.value }))} style={fieldInputStyle} required={svFieldsRequired}>
                        <option value="">Select...</option>
                        {customerTypeOptions.map(ct => <option key={ct.id} value={ct.id}>{ct.type_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Motivation {svFieldsRequired ? '*' : ''}</label>
                      <select value={createForm.motivation_type || ''} onChange={(e) => setCreateForm(p => ({ ...p, motivation_type: e.target.value }))} style={fieldInputStyle} required={svFieldsRequired}>
                        <option value="">Select...</option>
                        {motivationOptions.map(m => <option key={m.id} value={m.motivation_name}>{m.motivation_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Customer Requirement {svFieldsRequired ? '*' : ''}</label>
                      <input value={createForm.customer_requirement} onChange={(e) => setCreateForm(p => ({ ...p, customer_requirement: e.target.value }))} placeholder="e.g. 2BHK near school" style={fieldInputStyle} required={svFieldsRequired} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Time Spent (mins) {svFieldsRequired ? '*' : ''}</label>
                      <input type="number" min="0" value={createForm.time_spent} onChange={(e) => setCreateForm(p => ({ ...p, time_spent: e.target.value }))} placeholder="e.g. 30" style={fieldInputStyle} required={svFieldsRequired} />
                    </div>
                    {selectedAction?.needsAssignee && (
                      <div>
                        <label style={fieldLabelStyle}>Sales Head (Assignee) *</label>
                        <select value={createForm.sales_head_id} onChange={(e) => setCreateForm(p => ({ ...p, sales_head_id: e.target.value }))} style={fieldInputStyle} required>
                          <option value="">Select Sales Head...</option>
                          {salesHeads.map(sh => <option key={sh.id} value={sh.id}>{sh.fullName || `${sh.firstName || ''} ${sh.lastName || ''}`.trim()}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={fieldLabelStyle}>Rating (1-5)</label>
                      <select value={createForm.rating} onChange={(e) => setCreateForm(p => ({ ...p, rating: e.target.value }))} style={fieldInputStyle}>
                        <option value="">Select rating...</option>
                        {[1,2,3,4,5].map(r => <option key={r} value={r}>{'★'.repeat(r)}{'☆'.repeat(5-r)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Interested After Visit</label>
                      <select value={createForm.interested_after_visit === null ? '' : createForm.interested_after_visit} onChange={(e) => setCreateForm(p => ({ ...p, interested_after_visit: e.target.value === '' ? null : e.target.value === 'true' }))} style={fieldInputStyle}>
                        <option value="">Select...</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={fieldLabelStyle}>Feedback</label>
                      <textarea value={createForm.feedback} onChange={(e) => setCreateForm(p => ({ ...p, feedback: e.target.value }))} rows={2} placeholder="Enter feedback..." style={fieldInputStyle} />
                    </div>
                    <div>
                      <label style={fieldLabelStyle}>Remarks {selectedAction?.needsRemark ? '*' : ''}</label>
                      <textarea value={createForm.remarks} onChange={(e) => setCreateForm(p => ({ ...p, remarks: e.target.value }))} rows={2} placeholder="Additional remarks..." style={fieldInputStyle} required={selectedAction?.needsRemark} />
                    </div>
                  </div>

                  {selectedAction?.needsCallStatus && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={fieldLabelStyle}>Call Status *</label>
                      <select value={createForm.call_status} onChange={(e) => setCreateForm(p => ({ ...p, call_status: e.target.value }))} style={fieldInputStyle} required>
                        <option value="">Select call status...</option>
                        <option value="answered">Answered</option>
                        <option value="no_answer">No Answer</option>
                        <option value="switched_off">Switched Off</option>
                        <option value="busy">Busy</option>
                        <option value="not_reachable">Not Reachable</option>
                        <option value="invalid_number">Invalid Number</option>
                      </select>
                    </div>
                  )}
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
