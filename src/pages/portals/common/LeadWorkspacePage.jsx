import React, { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { getRoleCode } from '../../../utils/permissions';
import {
  getWorkspaceTitle,
  buildStageOptions,
  buildStatusOptions,
  getActionsForRole,
  ACTION_TONE_CLASS,
  ROLE_LABELS,
} from './workflowConfig';
import './LeadWorkspacePage.css';

const initialNewLead = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  secondary_phone_1: '',
  secondary_phone_2: '',
  secondary_phone_3: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_id: '',
  location_id: '',
  budgetMin: '',
  budgetMax: '',
  budgetRange: '',
  priority: 'Medium',
};

const LeadWorkspacePage = ({ user, workspaceRole }) => {
  const wsTitle = getWorkspaceTitle(workspaceRole);
  const userRoleCode = getRoleCode(user);

  // ── Pipeline config from API ──
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  // ── Leads ──
  const [filters, setFilters] = useState({ search: '', stageCode: '', statusCode: '', includeClosed: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  // ── Create lead ──
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState(initialNewLead);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [subSourceMap, setSubSourceMap] = useState({});
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);

  // ── Workflow actions ──
  const [noteDraft, setNoteDraft] = useState('');
  const [actionState, setActionState] = useState({ note: '', nextFollowUpAt: '', assignToUserId: '' });
  const [manualStatus, setManualStatus] = useState('');

  // ── SV Done Modal ──
  const [svDoneModalOpen, setSvDoneModalOpen] = useState(false);
  const [svDoneForm, setSvDoneForm] = useState({ assignToUserId: '', svDate: '', svProjectId: '', note: '' });

  // ── Closure Reason Modal ──
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureModalAction, setClosureModalAction] = useState(null);
  const [closureForm, setClosureForm] = useState({ closureReasonId: '', reason: '' });
  const [closureReasons, setClosureReasons] = useState([]);

  // ── Assignment ──
  const [assignableUsers, setAssignableUsers] = useState({});
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState({ userId: '', note: '' });

  // ── Derived from config ──
  const stageOptions = useMemo(
    () => buildStageOptions(workflowConfig?.stages || [], workspaceRole),
    [workflowConfig, workspaceRole]
  );

  const statusOptions = useMemo(
    () => buildStatusOptions(workflowConfig?.statuses || []),
    [workflowConfig]
  );

  const roleActions = useMemo(
    () => getActionsForRole(workflowConfig?.actions || {}, workspaceRole),
    [workflowConfig, workspaceRole]
  );

  const selectedSourceSubSources = useMemo(
    () => subSourceMap[newLeadForm.lead_source_id] || [],
    [subSourceMap, newLeadForm.lead_source_id]
  );

  // ── Stats ──
  const computedStats = useMemo(() => {
    const open = leads.filter((l) => !l.isClosed).length;
    const dueFollowUps = leads.filter(
      (l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() <= Date.now() && !l.isClosed
    ).length;
    const won = leads.filter((l) => l.stageCode === 'CLOSED_WON' || l.isPositive).length;
    const dropped = leads.filter((l) => l.isClosed && !l.isPositive).length;

    return [
      { label: 'Open Leads', value: open, cls: 'stat--open' },
      { label: 'Follow-ups Due', value: dueFollowUps, cls: 'stat--due' },
      { label: 'Closed Won', value: won, cls: 'stat--won' },
      { label: 'Dropped', value: dropped, cls: 'stat--dropped' },
    ];
  }, [leads]);

  // ── Load workflow config on mount ──
  const loadWorkflowConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const resp = await leadWorkflowApi.getWorkflowConfig();
      setWorkflowConfig(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load workflow config'));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflowConfig();
  }, [loadWorkflowConfig]);

  // ── Load assignable users for roles that need them ──
  const loadAssignableUsers = useCallback(async (roleCode) => {
    if (assignableUsers[roleCode]) return;
    try {
      const resp = await leadWorkflowApi.getAssignableUsers(roleCode);
      setAssignableUsers((prev) => ({ ...prev, [roleCode]: resp.data || [] }));
    } catch {
      // silently fail
    }
  }, [assignableUsers]);

  // Pre-load assignable users for relevant handoff roles
  useEffect(() => {
    if (workspaceRole === 'TC') loadAssignableUsers('SM');
    if (workspaceRole === 'SM') loadAssignableUsers('SH');
    if (workspaceRole === 'SH') loadAssignableUsers('COL');
  }, [workspaceRole, loadAssignableUsers]);

  // ── Load leads ──
  const loadLeads = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const resp = await leadWorkflowApi.getLeads({
        roleCode: workspaceRole,
        page: 1,
        limit: 100,
        ...filters,
      });

      const data = resp.data || [];
      setLeads(data);
      setMeta(resp.meta || { total: data.length, page: 1, totalPages: 1 });

      const selectedExists = data.some((l) => l.id === selectedLeadId);
      if ((!selectedLeadId || !selectedExists) && data.length) {
        setSelectedLeadId(data[0].id);
      } else if (!data.length) {
        setSelectedLeadId(null);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load leads'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, workspaceRole, selectedLeadId]);

  // ── Load lead detail ──
  const loadLeadDetail = useCallback(async (leadId) => {
    if (!leadId) { setSelectedLead(null); return; }
    try {
      const resp = await leadWorkflowApi.getLeadById(leadId);
      setSelectedLead(resp.data || null);
      setManualStatus(resp.data?.statusCode || '');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load lead details'));
      setSelectedLead(null);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [filters, workspaceRole]);
  useEffect(() => { loadLeadDetail(selectedLeadId); }, [selectedLeadId, loadLeadDetail]);

  // ── Create lead options ──
  const loadCreateOptions = async () => {
    if (createOptionsLoading) return;
    setCreateOptionsLoading(true);
    try {
      const [pResp, lResp, sResp] = await Promise.all([
        projectApi.getDropdown(),
        locationApi.getDropdown(),
        leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown()),
      ]);
      const projects = pResp.data || [];
      const locations = lResp.data || [];
      const sources = sResp.data || [];
      const map = {};
      sources.forEach((s) => { map[s.id] = s.subSources || []; });

      if (Object.values(map).every((v) => v.length === 0)) {
        await Promise.all(sources.map(async (s) => {
          try {
            const sub = await leadSubSourceApi.getBySource(s.id);
            map[s.id] = sub.data || [];
          } catch { map[s.id] = []; }
        }));
      }

      setProjectOptions(projects);
      setLocationOptions(locations);
      setSourceOptions(sources);
      setSubSourceMap(map);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load options'));
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!newLeadOpen) return;
    if (projectOptions.length && sourceOptions.length && locationOptions.length) return;
    loadCreateOptions();
  }, [newLeadOpen]);

  // ── Handlers ──
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.firstName || !newLeadForm.phone) { toast.error('First name and phone are required'); return; }
    if (!newLeadForm.lead_source_id) { toast.error('Lead source is required'); return; }

    const selectedProject = projectOptions.find((p) => p.id === newLeadForm.project_id) || null;
    const selectedSource = sourceOptions.find((s) => s.id === newLeadForm.lead_source_id) || null;
    const selectedLocation = locationOptions.find((l) => l.id === newLeadForm.location_id) || null;
    const selectedSubSource = selectedSourceSubSources.find((s) => s.id === newLeadForm.lead_sub_source_id) || null;

    try {
      await leadWorkflowApi.createLead({
        ...newLeadForm,
        lead_source_id: newLeadForm.lead_source_id || null,
        lead_sub_source_id: newLeadForm.lead_sub_source_id || null,
        project_id: newLeadForm.project_id || null,
        location_id: newLeadForm.location_id || null,
        source: selectedSource?.source_name || null,
        project: selectedProject?.project_name || null,
        location: selectedLocation ? `${selectedLocation.location_name}${selectedLocation.city ? `, ${selectedLocation.city}` : ''}` : null,
      });
      toast.success('Lead created successfully');
      setNewLeadForm(initialNewLead);
      setNewLeadOpen(false);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to create lead'));
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead || !noteDraft.trim()) return;
    try {
      await leadWorkflowApi.addNote(selectedLead.id, noteDraft.trim());
      setNoteDraft('');
      toast.success('Note added');
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to add note'));
    }
  };

  const handleAction = async (action) => {
    if (!selectedLead) return;

    // SV Done: open SV Done modal instead of direct action
    if (action.code === 'TC_SV_COMPLETED') {
      setSvDoneForm({ assignToUserId: '', svDate: '', svProjectId: '', note: actionState.note || '' });
      setSvDoneModalOpen(true);
      // Load SM users
      loadAssignableUsers('SM');
      return;
    }

    // Cold/Junk/Spam/Drop: open closure reason modal
    if (action.needsReason && action.reasonCategory) {
      setClosureModalAction(action);
      setClosureForm({ closureReasonId: '', reason: '' });
      // Load reasons for category
      try {
        const resp = await leadWorkflowApi.getClosureReasons(action.reasonCategory);
        setClosureReasons(resp.data?.rows || resp.data || []);
      } catch { setClosureReasons([]); }
      setClosureModalOpen(true);
      return;
    }

    const payload = {
      note: actionState.note?.trim() || undefined,
      nextFollowUpAt: actionState.nextFollowUpAt || undefined,
      assignToUserId: actionState.assignToUserId || undefined,
    };

    if (action.needsFollowUp && !payload.nextFollowUpAt) { toast.error('Follow-up date is required'); return; }
    if (action.needsAssignee && !payload.assignToUserId) { toast.error('Please select user to assign'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, action.code, payload);
      toast.success('Lead updated');
      setActionState({ note: '', nextFollowUpAt: '', assignToUserId: '' });
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update lead'));
    }
  };

  // ── SV Done submit ──
  const handleSvDoneSubmit = async () => {
    if (!selectedLead) return;
    if (!svDoneForm.assignToUserId) { toast.error('Sales Manager is mandatory'); return; }
    if (!svDoneForm.svDate) { toast.error('Site Visit date is mandatory'); return; }
    if (!svDoneForm.svProjectId) { toast.error('Project visited is mandatory'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'TC_SV_COMPLETED', {
        assignToUserId: svDoneForm.assignToUserId,
        svDate: svDoneForm.svDate,
        svProjectId: svDoneForm.svProjectId,
        note: svDoneForm.note?.trim() || undefined,
      });
      toast.success('SV Done — Lead handed off to Sales Manager');
      setSvDoneModalOpen(false);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to mark SV Done'));
    }
  };

  // ── Closure reason submit ──
  const handleClosureSubmit = async () => {
    if (!selectedLead || !closureModalAction) return;
    if (!closureForm.closureReasonId && !closureForm.reason.trim()) {
      toast.error('A closure reason is mandatory');
      return;
    }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, closureModalAction.code, {
        closureReasonId: closureForm.closureReasonId || undefined,
        reason: closureForm.reason.trim() || undefined,
        note: closureForm.reason.trim() || undefined,
      });
      toast.success(`Lead marked as ${closureModalAction.label}`);
      setClosureModalOpen(false);
      setClosureModalAction(null);
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update lead'));
    }
  };

  const handleManualStatusUpdate = async () => {
    if (!selectedLead || !manualStatus) return;
    try {
      await leadWorkflowApi.updateLeadStatus(selectedLead.id, manualStatus, {
        note: actionState.note?.trim() || undefined,
      });
      toast.success('Status updated');
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update status'));
    }
  };

  const handleAssignLead = async () => {
    if (!selectedLead || !assignTarget.userId) return;
    try {
      await leadWorkflowApi.assignLead(selectedLead.id, assignTarget.userId, assignTarget.note?.trim() || '');
      toast.success('Lead assigned successfully');
      setAssignTarget({ userId: '', note: '' });
      setAssignModalOpen(false);
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to assign lead'));
    }
  };

  // All users from all loaded roles (for assignment modal)
  const allAssignableUsers = useMemo(() => {
    const all = [];
    Object.entries(assignableUsers).forEach(([role, users]) => {
      users.forEach((u) => all.push({ ...u, _role: role }));
    });
    return all;
  }, [assignableUsers]);

  // Loading state
  if (configLoading) {
    return (
      <section className="lead-workspace">
        <div className="lead-workspace__loading">
          <div className="loading-spinner" />
          <p>Loading workspace configuration...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="lead-workspace">
      {/* ── Header ── */}
      <header className="lead-workspace__header">
        <div>
          <h1>{wsTitle.title}</h1>
          <p>{wsTitle.subtitle}</p>
        </div>
        <div className="lead-workspace__header-actions">
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => loadLeads({ silent: true })}>
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
          <button type="button" className="workspace-btn workspace-btn--primary" onClick={() => setNewLeadOpen(true)}>
            + New Lead
          </button>
        </div>
      </header>

      {/* ── Stats ── */}
      <div className="lead-workspace__stats">
        {computedStats.map((card) => (
          <article key={card.label} className={`workspace-stat-card ${card.cls}`}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="lead-workspace__toolbar">
        <input
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          placeholder="Search by name, phone, email, lead number..."
        />
        <select value={filters.stageCode} onChange={(e) => setFilters((p) => ({ ...p, stageCode: e.target.value }))}>
          <option value="">All Stages</option>
          {stageOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={filters.statusCode} onChange={(e) => setFilters((p) => ({ ...p, statusCode: e.target.value }))}>
          <option value="">All Statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="lead-workspace__closed-toggle">
          <input
            type="checkbox"
            checked={filters.includeClosed}
            onChange={(e) => setFilters((p) => ({ ...p, includeClosed: e.target.checked }))}
          />
          <span>Include Closed</span>
        </label>
      </div>

      {/* ── Main Grid ── */}
      <div className="lead-workspace__grid">
        {/* Lead List */}
        <div className="lead-workspace__list-card">
          <div className="lead-workspace__list-header">
            <h2>Leads</h2>
            <small>{meta.total} records</small>
          </div>

          <div className="lead-workspace__table-wrap">
            <table className="lead-workspace__table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Source / Project</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Follow-up</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="lead-workspace__empty">Loading leads...</td></tr>
                )}
                {!loading && !leads.length && (
                  <tr><td colSpan={7} className="lead-workspace__empty">No leads found for current filters</td></tr>
                )}
                {!loading && leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={selectedLeadId === lead.id ? 'is-selected' : ''}
                  >
                    <td>
                      <p className="lead-title">{lead.fullName}</p>
                      <small>{lead.leadNumber}</small>
                    </td>
                    <td>
                      <p>{lead.phone}</p>
                      <small>{lead.email || '-'}</small>
                    </td>
                    <td>
                      <p>{lead.source || '-'}</p>
                      <small>{lead.project || '-'}</small>
                    </td>
                    <td>
                      <span className="stage-chip" style={{ backgroundColor: lead.stageColor + '22', color: lead.stageColor, borderColor: lead.stageColor }}>
                        {lead.stageLabel}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-chip ${lead.isClosed ? 'status-chip--closed' : ''}`}
                        style={{ backgroundColor: lead.statusColor + '22', color: lead.statusColor, borderColor: lead.statusColor }}
                      >
                        {lead.statusLabel}
                      </span>
                    </td>
                    <td>
                      <p className="assigned-name">{lead.assignedToUserName || <em>Unassigned</em>}</p>
                      {lead.assignedRole && (
                        <small className="assigned-role">{ROLE_LABELS[lead.assignedRole] || lead.assignedRole}</small>
                      )}
                    </td>
                    <td>{lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedLeadId(lead.id); }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Detail Panel — matches revised.html modal layout ── */}
        {selectedLead && (
          <div className="lead-workspace__modal">
            <div className="lead-workspace__modal-panel lead-workspace__modal-panel--lg">
              <div className="lead-workspace__modal-header">
                <h2>Lead Details</h2>
                <button type="button" onClick={() => setSelectedLeadId(null)}>×</button>
              </div>
              <div className="lead-workspace__detail-card" style={{ padding: 24, maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Header with name, phone, badges */}
              <div className="lead-detail__header">
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedLead.fullName}</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {selectedLead.phone}{selectedLead.email ? ` · ${selectedLead.email}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="crm-badge"
                    style={{ backgroundColor: selectedLead.stageColor + '22', color: selectedLead.stageColor }}
                  >
                    <span className="crm-badge-dot" style={{ background: selectedLead.stageColor }} />
                    {selectedLead.stageLabel}
                  </span>
                  <span
                    className="crm-badge"
                    style={{ backgroundColor: selectedLead.statusColor + '22', color: selectedLead.statusColor, border: `1px solid ${selectedLead.statusColor}33` }}
                  >
                    {selectedLead.statusIcon || ''} {selectedLead.statusLabel}
                  </span>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="lead-detail__two-col">
                {/* Left Column */}
                <div className="lead-detail__left">
                  {/* Lead Details Grid */}
                  <h3 className="lead-detail__section-title">Lead Details</h3>
                  <div className="lead-detail__info-grid">
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Source</div>
                      <div className="lead-detail__info-value">{selectedLead.source || '-'}</div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Project</div>
                      <div className="lead-detail__info-value">{selectedLead.project || '-'}</div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Location</div>
                      <div className="lead-detail__info-value">{selectedLead.location || '-'}</div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Budget</div>
                      <div className="lead-detail__info-value">
                        {selectedLead.budgetMin ? formatCurrency(selectedLead.budgetMin) : '-'} – {selectedLead.budgetMax ? formatCurrency(selectedLead.budgetMax) : '-'}
                      </div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Assigned To</div>
                      <div className="lead-detail__info-value" style={{ color: 'var(--accent-blue)' }}>
                        {selectedLead.assignedToUserName || 'Unassigned'}
                        {selectedLead.assignedRole && (
                          <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({ROLE_LABELS[selectedLead.assignedRole] || selectedLead.assignedRole})</small>
                        )}
                      </div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Lead Number</div>
                      <div className="lead-detail__info-value">{selectedLead.leadNumber}</div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {!selectedLead.isClosed && (
                    <>
                      <h3 className="lead-detail__section-title">Quick Actions</h3>
                      <div className="lead-detail__quick-actions">
                        <button className="crm-btn crm-btn-success crm-btn-sm" onClick={handleAddNote}>📞 Log Call</button>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm">💬 WhatsApp</button>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm">📧 Email</button>
                        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => document.getElementById('note-input')?.focus()}>📝 Add Note</button>
                        <button
                          className="crm-btn crm-btn-warning crm-btn-sm"
                          onClick={() => {
                            setAssignModalOpen(true);
                            ['TC', 'SM', 'SH', 'COL'].forEach((r) => loadAssignableUsers(r));
                          }}
                        >
                          🔄 Reassign
                        </button>
                      </div>
                    </>
                  )}

                  {/* Workflow Actions */}
                  {!selectedLead.isClosed && roleActions.length > 0 && (
                    <>
                      <h3 className="lead-detail__section-title">Workflow Actions</h3>
                      <div className="lead-detail__quick-actions">
                        {roleActions.map((action) => (
                          <button
                            key={action.code}
                            type="button"
                            className={`crm-btn crm-btn-sm crm-btn-${action.tone === 'primary' ? 'primary' : action.tone === 'success' ? 'success' : action.tone === 'danger' ? 'danger' : 'ghost'}`}
                            onClick={() => handleAction(action)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>

                      {/* Action inputs: note, follow-up, assignee */}
                      <div className="lead-detail__action-form">
                        <textarea
                          className="crm-form-input"
                          value={actionState.note}
                          onChange={(e) => setActionState((p) => ({ ...p, note: e.target.value }))}
                          placeholder="Action note / reason..."
                          rows={2}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div>
                            <div className="crm-form-label">Next Follow Up</div>
                            <input
                              className="crm-form-input"
                              type="datetime-local"
                              value={actionState.nextFollowUpAt}
                              onChange={(e) => setActionState((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                            />
                          </div>
                          {roleActions.some((a) => a.needsAssignee) && (
                            <div>
                              <div className="crm-form-label">Assign To</div>
                              <select
                                className="crm-form-select"
                                value={actionState.assignToUserId}
                                onChange={(e) => setActionState((p) => ({ ...p, assignToUserId: e.target.value }))}
                              >
                                <option value="">Select user...</option>
                                {roleActions
                                  .filter((a) => a.needsAssignee)
                                  .map((a) => a.assigneeRole)
                                  .filter((v, i, arr) => arr.indexOf(v) === i)
                                  .flatMap((role) => (assignableUsers[role] || []))
                                  .map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.fullName} ({ROLE_LABELS[u.role] || u.roleName})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Update Lead — Stage + Status dropdowns */}
                  <h3 className="lead-detail__section-title">Update Lead</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div className="crm-form-label">Stage</div>
                      <select className="crm-form-select" value={selectedLead.stageCode || ''} disabled>
                        <option>{selectedLead.stageLabel} (current)</option>
                      </select>
                    </div>
                    <div>
                      <div className="crm-form-label">Status</div>
                      <select className="crm-form-select" value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}>
                        <option value="">Select status</option>
                        {statusOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}{o.value === selectedLead.statusCode ? ' (current)' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="crm-form-label">Notes</div>
                    <textarea
                      id="note-input"
                      className="crm-form-input"
                      rows={2}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add notes..."
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    {noteDraft.trim() && (
                      <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={handleAddNote}>
                        📝 Save Note
                      </button>
                    )}
                    <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" onClick={handleManualStatusUpdate} disabled={!manualStatus}>
                      💾 Save Changes
                    </button>
                  </div>
                </div>

                {/* Right Column — Activity Timeline */}
                <div className="lead-detail__right">
                  <h3 className="lead-detail__section-title">Activity Timeline</h3>
                  <div className="crm-timeline">
                    {(selectedLead.timeline || []).length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                        No activity yet
                      </p>
                    )}
                    {(selectedLead.timeline || []).map((evt) => {
                      const typeClass = evt.type === 'NOTE_ADDED' ? 'tl-note'
                        : evt.type === 'STAGE_CHANGE' ? 'tl-stage'
                        : evt.type === 'STATUS_CHANGE' ? 'tl-stage'
                        : evt.type === 'REASSIGNMENT' ? 'tl-handoff'
                        : evt.type === 'CREATED' ? 'tl-system'
                        : evt.type === 'CLOSED_WON' ? 'tl-call'
                        : evt.type === 'CLOSED_LOST' ? 'tl-note'
                        : 'tl-system';

                      const typeIcon = evt.type === 'NOTE_ADDED' ? '📝'
                        : evt.type === 'STAGE_CHANGE' ? '🔄'
                        : evt.type === 'STATUS_CHANGE' ? '🏷️'
                        : evt.type === 'REASSIGNMENT' ? '🔀'
                        : evt.type === 'CREATED' ? '➕'
                        : evt.type === 'CLOSED_WON' ? '🎉'
                        : evt.type === 'CLOSED_LOST' ? '❌'
                        : '📌';

                      const typeLabel = evt.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

                      return (
                        <div key={evt.id} className={`tl-item ${typeClass}`}>
                          <div className="tl-header">
                            <span className="tl-type">{typeIcon} {evt.title || typeLabel}</span>
                            <span className="tl-date">{formatDateTime(evt.at)}</span>
                          </div>
                          {evt.description && <div className="tl-text">{evt.description}</div>}
                          <div className="tl-by">By {evt.by || 'System'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ── Create Lead Modal ── */}
      {newLeadOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel">
            <div className="lead-workspace__modal-header">
              <h2>Create New Lead</h2>
              <button type="button" onClick={() => setNewLeadOpen(false)}>✕</button>
            </div>

            <form className="lead-workspace__new-form" onSubmit={handleCreateLead}>
              <label>
                First Name*
                <input value={newLeadForm.firstName} onChange={(e) => setNewLeadForm((p) => ({ ...p, firstName: e.target.value }))} required />
              </label>
              <label>
                Last Name
                <input value={newLeadForm.lastName} onChange={(e) => setNewLeadForm((p) => ({ ...p, lastName: e.target.value }))} />
              </label>
              <label>
                Phone*
                <input value={newLeadForm.phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: e.target.value }))} required />
              </label>
              <label>
                Secondary Phone 1
                <input value={newLeadForm.secondary_phone_1} onChange={(e) => setNewLeadForm((p) => ({ ...p, secondary_phone_1: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                Secondary Phone 2
                <input value={newLeadForm.secondary_phone_2} onChange={(e) => setNewLeadForm((p) => ({ ...p, secondary_phone_2: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                Secondary Phone 3
                <input value={newLeadForm.secondary_phone_3} onChange={(e) => setNewLeadForm((p) => ({ ...p, secondary_phone_3: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                Email
                <input type="email" value={newLeadForm.email} onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))} />
              </label>
              <label>
                Project
                <select
                  value={newLeadForm.project_id}
                  onChange={(e) => {
                    const pId = e.target.value;
                    const proj = projectOptions.find((p) => p.id === pId) || null;
                    setNewLeadForm((p) => ({ ...p, project_id: pId, location_id: proj?.location_id || p.location_id }));
                  }}
                >
                  <option value="">Select project</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name}{p.project_code ? ` (${p.project_code})` : ''}</option>
                  ))}
                </select>
              </label>
              <label>
                Lead Source*
                <select
                  value={newLeadForm.lead_source_id}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_source_id: e.target.value, lead_sub_source_id: '' }))}
                  required
                >
                  <option value="">Select lead source</option>
                  {sourceOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.source_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Lead Sub-Source
                <select
                  value={newLeadForm.lead_sub_source_id}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))}
                  disabled={!newLeadForm.lead_source_id || !selectedSourceSubSources.length}
                >
                  <option value="">Select sub-source</option>
                  {selectedSourceSubSources.map((s) => (
                    <option key={s.id} value={s.id}>{s.sub_source_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <select value={newLeadForm.location_id} onChange={(e) => setNewLeadForm((p) => ({ ...p, location_id: e.target.value }))}>
                  <option value="">Select location</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>{l.location_name}{l.city ? `, ${l.city}` : ''}{l.state ? ` (${l.state})` : ''}</option>
                  ))}
                </select>
              </label>
              <label>
                Budget Min
                <input type="number" value={newLeadForm.budgetMin} onChange={(e) => setNewLeadForm((p) => ({ ...p, budgetMin: e.target.value }))} />
              </label>
              <label>
                Budget Max
                <input type="number" value={newLeadForm.budgetMax} onChange={(e) => setNewLeadForm((p) => ({ ...p, budgetMax: e.target.value }))} />
              </label>
              <label>
                Budget Range
                <select value={newLeadForm.budgetRange} onChange={(e) => setNewLeadForm((p) => ({ ...p, budgetRange: e.target.value }))}>
                  <option value="">Select range</option>
                  <option value="Below 8L">Below 8 Lakhs</option>
                  <option value="8-15L">8 - 15 Lakhs</option>
                  <option value="15-25L">15 - 25 Lakhs</option>
                  <option value="Above 25L">Above 25 Lakhs</option>
                </select>
              </label>
              <label>
                Priority
                <select value={newLeadForm.priority} onChange={(e) => setNewLeadForm((p) => ({ ...p, priority: e.target.value }))}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </label>

              <div className="lead-workspace__new-form-footer">
                {createOptionsLoading && <small>Loading options...</small>}
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setNewLeadOpen(false)}>Cancel</button>
                <button type="submit" className="workspace-btn workspace-btn--primary" disabled={createOptionsLoading}>
                  {createOptionsLoading ? 'Loading...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Lead Modal ── */}
      {assignModalOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header">
              <h2>Reassign Lead</h2>
              <button type="button" onClick={() => setAssignModalOpen(false)}>✕</button>
            </div>

            <div className="assign-modal__body">
              <p className="assign-modal__lead">
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
              </p>
              <p className="assign-modal__current">
                Currently assigned to: <strong>{selectedLead?.assignedToUserName || 'Unassigned'}</strong>
              </p>

              <label>
                Assign to:
                <select value={assignTarget.userId} onChange={(e) => setAssignTarget((p) => ({ ...p, userId: e.target.value }))}>
                  <option value="">Select user...</option>
                  {['TC', 'SM', 'SH', 'COL'].map((role) => {
                    const users = assignableUsers[role] || [];
                    if (!users.length) return null;
                    return (
                      <optgroup key={role} label={ROLE_LABELS[role] || role}>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>

              <label>
                Note (optional):
                <textarea
                  rows={2}
                  value={assignTarget.note}
                  onChange={(e) => setAssignTarget((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Reason for reassignment"
                />
              </label>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setAssignModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  onClick={handleAssignLead}
                  disabled={!assignTarget.userId}
                >
                  Assign Lead
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SV Done Modal ── */}
      {svDoneModalOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header">
              <h2>Mark Site Visit Done</h2>
              <button type="button" onClick={() => setSvDoneModalOpen(false)}>✕</button>
            </div>

            <div className="assign-modal__body">
              <p className="assign-modal__lead">
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Marking SV Done will transfer this lead to the selected Sales Manager. You will lose access to this lead.
              </p>

              <label>
                Sales Manager *
                <select
                  value={svDoneForm.assignToUserId}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                  required
                >
                  <option value="">Select Sales Manager...</option>
                  {(assignableUsers.SM || []).map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </label>

              <label>
                Date of Site Visit *
                <input
                  type="date"
                  value={svDoneForm.svDate}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, svDate: e.target.value }))}
                  required
                />
              </label>

              <label>
                Project Visited *
                <select
                  value={svDoneForm.svProjectId}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, svProjectId: e.target.value }))}
                  required
                >
                  <option value="">Select Project...</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.project_name}</option>
                  ))}
                </select>
              </label>

              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  value={svDoneForm.note}
                  onChange={(e) => setSvDoneForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Site visit remarks..."
                />
              </label>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setSvDoneModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  onClick={handleSvDoneSubmit}
                  disabled={!svDoneForm.assignToUserId || !svDoneForm.svDate || !svDoneForm.svProjectId}
                >
                  ✓ Confirm SV Done & Handoff
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Closure Reason Modal ── */}
      {closureModalOpen && closureModalAction && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header">
              <h2>{closureModalAction.label}</h2>
              <button type="button" onClick={() => { setClosureModalOpen(false); setClosureModalAction(null); }}>✕</button>
            </div>

            <div className="assign-modal__body">
              <p className="assign-modal__lead">
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
              </p>

              {closureModalAction.code?.includes('JUNK') || closureModalAction.code?.includes('SPAM') ? (
                <div style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--accent-red)' }}>
                  ⚠️ Warning: Marking as {closureModalAction.label.replace('Mark ', '')} will increment the junk/spam strike counter.
                  After 3 strikes, the lead will be permanently deactivated.
                  {selectedLead && <span> (Current strikes: {selectedLead.junkStrikeCount || 0}/3)</span>}
                </div>
              ) : null}

              <label>
                Reason *
                <select
                  value={closureForm.closureReasonId}
                  onChange={(e) => setClosureForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                >
                  <option value="">Select reason...</option>
                  {closureReasons.map((r) => (
                    <option key={r.id} value={r.id}>{r.reason_name}</option>
                  ))}
                </select>
              </label>

              <label>
                Additional Remarks
                <textarea
                  rows={2}
                  value={closureForm.reason}
                  onChange={(e) => setClosureForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Additional details..."
                />
              </label>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => { setClosureModalOpen(false); setClosureModalAction(null); }}>Cancel</button>
                <button
                  type="button"
                  className={`workspace-btn workspace-btn--${closureModalAction.tone === 'danger' ? 'danger' : 'primary'}`}
                  onClick={handleClosureSubmit}
                  disabled={!closureForm.closureReasonId && !closureForm.reason.trim()}
                >
                  Confirm {closureModalAction.label}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LeadWorkspacePage;
