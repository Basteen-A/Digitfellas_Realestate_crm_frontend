import React, { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import leadTypeApi from '../../../api/leadTypeApi';
import customerTypeApi from '../../../api/customerTypeApi';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';

import {
  getWorkspaceTitle,
  buildStageOptions,
  buildStatusOptions,
  getActionsForRole,
  ROLE_LABELS,
} from './workflowConfig';
import './LeadWorkspacePage.css';

const initialNewLead = {
  firstName: '',
  lastName: '',
  phone: '',
  alternate_phone: '',
  whatsapp_number: '',
  email: '',
  secondary_phone_1: '',
  secondary_phone_2: '',
  secondary_phone_3: '',
  lead_type_id: '',
  customer_type_id: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_id: '',
  location_id: '',
  configuration: '',
  purpose: '',
  budgetMin: '',
  budgetMax: '',
  budgetRange: '',
  campaign_name: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  referral_code: '',
  note: '',
  priority: 'Medium',
};

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getQuickFollowUpValue = (dayOffset, hour, minute = 0) => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toDateTimeLocalValue(date.toISOString());
};

const LeadWorkspacePage = ({ user, workspaceRole }) => {
  const wsTitle = getWorkspaceTitle(workspaceRole);


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
  const [leadTypeOptions, setLeadTypeOptions] = useState([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  const [subSourceMap, setSubSourceMap] = useState({});
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);

  // ── Workflow actions ──
  const [noteDraft, setNoteDraft] = useState('');
  const [actionState, setActionState] = useState({ note: '', nextFollowUpAt: '', assignToUserId: '' });
  const [manualStatus, setManualStatus] = useState('');
  const [manualNextFollowUpAt, setManualNextFollowUpAt] = useState('');
  const [manualUpdateSaving, setManualUpdateSaving] = useState(false);

  // ── Stage Transition Popup ──
  const [stagePopupOpen, setStagePopupOpen] = useState(false);
  const [stagePopupData, setStagePopupData] = useState({ actionCode: '', stageLabel: '', followUpAt: '', reason: '', needsFollowUp: false });

  // ── SV Done Modal ──
  const [svDoneModalOpen, setSvDoneModalOpen] = useState(false);
  const [svDoneForm, setSvDoneForm] = useState({ assignToUserId: '', svDate: '', svProjectId: '', note: '' });

  // ── Closure Reason Modal ──
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureModalAction, setClosureModalAction] = useState(null);
  const [closureForm, setClosureForm] = useState({ closureReasonId: '', reason: '' });
  const [closureReasons, setClosureReasons] = useState([]);

  // ── Customer Profile Modal (SH Close Won) ──
  const [customerProfileOpen, setCustomerProfileOpen] = useState(false);
  const [customerProfileForm, setCustomerProfileForm] = useState({
    date_of_birth: '', pan_number: '', aadhar_number: '',
    occupation: '', current_post: '', purchase_type: '', marital_status: '',
    current_address: '', current_city: '', current_state: '', current_pincode: '',
    permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
    sameAsCurrent: false, assignToUserId: '', note: '',
  });

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

  const stageByCode = useMemo(() => {
    const map = {};
    (workflowConfig?.stages || []).forEach((stage) => {
      map[stage.stage_code] = stage;
    });
    return map;
  }, [workflowConfig]);

  const stageTransitionOptions = useMemo(() => roleActions
    .filter((action) => (
      action.targetStageCode
      && action.targetStageCode !== selectedLead?.stageCode
      && !action.needsAssignee
      && !action.needsReason
      && !action.needsSvDetails
      && !action.needsCustomerProfile
    ))
    .map((action) => {
      const stage = stageByCode[action.targetStageCode];
      return {
        value: action.code,
        actionLabel: action.label,
        stageCode: action.targetStageCode,
        stageLabel: stage?.stage_name || action.targetStageCode,
        needsFollowUp: Boolean(action.needsFollowUp),
      };
    }), [roleActions, selectedLead?.stageCode, stageByCode]);

  const selectedSourceSubSources = useMemo(
    () => subSourceMap[newLeadForm.lead_source_id] || [],
    [subSourceMap, newLeadForm.lead_source_id]
  );

  // ── Stats (Telecaller KPI cards) ──
  const computedStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const totalLeads = leads.length;
    const newToday = leads.filter((l) => l.createdAt && new Date(l.createdAt) >= todayStart).length;
    const todayFollowUps = leads.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) >= todayStart && new Date(l.nextFollowUpAt) < todayEnd && !l.isClosed).length;
    const overdueFollowUps = leads.filter((l) => l.nextFollowUpAt && new Date(l.nextFollowUpAt) < now && !l.isClosed).length;
    const svScheduled = leads.filter((l) => l.stageCode && l.stageCode.includes('SV_SCHED')).length;
    const svCompleted = leads.filter((l) => l.stageCode && (l.stageCode.includes('SV_DONE') || l.stageCode.includes('SV_COMPLET'))).length;
    const missedFollowups = overdueFollowUps;
    return { totalLeads, newToday, todayFollowUps, overdueFollowUps, svScheduled, svCompleted, missedFollowups };
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
      setManualNextFollowUpAt(toDateTimeLocalValue(resp.data?.nextFollowUpAt));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load lead details'));
      setSelectedLead(null);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLeads(); }, [filters, workspaceRole]);
  useEffect(() => { loadLeadDetail(selectedLeadId); }, [selectedLeadId, loadLeadDetail]);

  // ── Create lead options ──
  const loadCreateOptions = async () => {
    if (createOptionsLoading) return;
    setCreateOptionsLoading(true);
    try {
      const [pResp, lResp, sResp, ltResp, ctResp] = await Promise.all([
        projectApi.getDropdown(),
        locationApi.getDropdown(),
        leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown()),
        leadTypeApi.getDropdown().catch(() => ({ data: [] })),
        customerTypeApi.getDropdown().catch(() => ({ data: [] })),
      ]);
      const projects = pResp.data || [];
      const locations = lResp.data || [];
      const sources = sResp.data || [];
      const leadTypes = ltResp.data || [];
      const customerTypes = ctResp.data || [];
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
      setLeadTypeOptions(leadTypes);
      setCustomerTypeOptions(customerTypes);
      setSubSourceMap(map);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to load options'));
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!newLeadOpen) return;
    loadCreateOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newLeadOpen]);

  // ── Handlers ──
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.firstName || !newLeadForm.phone) { toast.error('First name and phone are required'); return; }
    if (!newLeadForm.lead_source_id) { toast.error('Lead source is required'); return; }

    const budgetMin = newLeadForm.budgetMin ? Number(newLeadForm.budgetMin) : null;
    const budgetMax = newLeadForm.budgetMax ? Number(newLeadForm.budgetMax) : null;
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      toast.error('Budget Max must be greater than or equal to Budget Min');
      return;
    }

    const selectedProject = projectOptions.find((p) => p.id === newLeadForm.project_id) || null;
    const selectedSource = sourceOptions.find((s) => s.id === newLeadForm.lead_source_id) || null;
    const selectedLocation = locationOptions.find((l) => l.id === newLeadForm.location_id) || null;


    try {
      await leadWorkflowApi.createLead({
        ...newLeadForm,
        budgetMin,
        budgetMax,
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
      loadAssignableUsers('SM');
      if (!projectOptions.length) loadCreateOptions();
      return;
    }

    // SH Close Won: open Customer Profile modal
    if (action.needsCustomerProfile || action.code === 'SH_BOOKING_APPROVE') {
      setStagePopupOpen(false);
      setCustomerProfileForm({
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false, assignToUserId: '', note: actionState.note || '',
      });
      setCustomerProfileOpen(true);
      loadAssignableUsers('COL');
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
      nextFollowUpAt: actionState.nextFollowUpAt ? new Date(actionState.nextFollowUpAt).toISOString() : undefined,
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
        svDate: svDoneForm.svDate ? new Date(svDoneForm.svDate).toISOString() : undefined,
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

  // ── Customer Profile Submit (SH Close Won) ──
  const handleCustomerProfileSubmit = async () => {
    if (!selectedLead) return;
    const f = customerProfileForm;
    if (!f.date_of_birth) { toast.error('Date of Birth is required'); return; }
    if (!f.pan_number) { toast.error('PAN Number is required'); return; }
    if (!f.aadhar_number) { toast.error('Aadhar Number is required'); return; }
    if (!f.current_address) { toast.error('Current Address is required'); return; }
    if (!f.occupation) { toast.error('Occupation is required'); return; }
    if (!f.assignToUserId) { toast.error('Please select a Collection Manager'); return; }

    setManualUpdateSaving(true);
    try {
      const permAddr = f.sameAsCurrent ? {
        permanent_address: f.current_address,
        permanent_city: f.current_city,
        permanent_state: f.current_state,
        permanent_pincode: f.current_pincode,
      } : {
        permanent_address: f.permanent_address,
        permanent_city: f.permanent_city,
        permanent_state: f.permanent_state,
        permanent_pincode: f.permanent_pincode,
      };

      await leadWorkflowApi.transitionLead(selectedLead.id, 'SH_BOOKING_APPROVE', {
        assignToUserId: f.assignToUserId,
        note: f.note?.trim() || 'Booking approved by Sales Head',
        customerProfile: {
          date_of_birth: f.date_of_birth ? new Date(f.date_of_birth).toISOString() : undefined,
          pan_number: f.pan_number,
          aadhar_number: f.aadhar_number,
          occupation: f.occupation,
          current_post: f.current_post,
          purchase_type: f.purchase_type,
          marital_status: f.marital_status,
          current_address: f.current_address,
          current_city: f.current_city,
          current_state: f.current_state,
          current_pincode: f.current_pincode,
          ...permAddr,
        },
      });
      toast.success('Booking approved! Customer profile saved. Lead returned to Sales Manager.');
      setCustomerProfileOpen(false);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to approve booking'));
    } finally {
      setManualUpdateSaving(false);
    }
  };

  // ── Open the stage transition popup when user selects a stage ──
  const openStagePopup = (actionCode) => {
    const option = stageTransitionOptions.find((o) => o.value === actionCode);
    if (!option) return;
    setStagePopupData({
      actionCode,
      stageLabel: option.stageLabel || option.actionLabel || actionCode,
      followUpAt: '',
      reason: '',
      needsFollowUp: Boolean(option.needsFollowUp),
    });
    setStagePopupOpen(true);
  };

  // ── Confirm stage transition from popup ──
  const handleStagePopupConfirm = async () => {
    if (!selectedLead || !stagePopupData.actionCode) return;

    const popupAction = roleActions.find((a) => a.code === stagePopupData.actionCode);
    if (popupAction?.needsCustomerProfile || popupAction?.code === 'SH_BOOKING_APPROVE') {
      setStagePopupOpen(false);
      setCustomerProfileForm({
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false, assignToUserId: '', note: stagePopupData.reason || actionState.note || '',
      });
      setCustomerProfileOpen(true);
      loadAssignableUsers('COL');
      return;
    }

    if (stagePopupData.needsFollowUp && !stagePopupData.followUpAt) {
      toast.error('Follow-up date & time is required for this stage');
      return;
    }
    if (!stagePopupData.reason.trim()) {
      toast.error('Please provide a reason / note for the stage change');
      return;
    }

    setManualUpdateSaving(true);
    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, stagePopupData.actionCode, {
        note: stagePopupData.reason.trim(),
        nextFollowUpAt: stagePopupData.followUpAt ? new Date(stagePopupData.followUpAt).toISOString() : undefined,
      });
      toast.success('Stage updated successfully');
      setStagePopupOpen(false);
      setStagePopupData({ actionCode: '', stageLabel: '', followUpAt: '', reason: '', needsFollowUp: false });
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update stage'));
    } finally {
      setManualUpdateSaving(false);
    }
  };

  const handleManualStatusUpdate = async () => {
    if (!selectedLead) return;

    const statusChanged = manualStatus && manualStatus !== selectedLead.statusCode;
    const followUpChanged = Boolean(manualNextFollowUpAt)
      && manualNextFollowUpAt !== toDateTimeLocalValue(selectedLead.nextFollowUpAt);

    if (!statusChanged && !followUpChanged && !noteDraft.trim()) {
      toast('No changes to update');
      return;
    }

    const commonPayload = {
      note: noteDraft.trim() || undefined,
      nextFollowUpAt: manualNextFollowUpAt ? new Date(manualNextFollowUpAt).toISOString() : undefined,
    };

    setManualUpdateSaving(true);
    try {
      if (statusChanged || followUpChanged) {
        await leadWorkflowApi.updateLeadStatus(selectedLead.id, manualStatus || selectedLead.statusCode, commonPayload);
      }
      toast.success('Lead updated successfully');
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to update lead'));
    } finally {
      setManualUpdateSaving(false);
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

      {/* ── Stats (5-column telecaller KPI cards) ── */}
      <div className="lead-workspace__stats">
        <article className="workspace-stat-card">
          <div className="stat-card__header">
            <div className="stat-card__label">Total Leads</div>
            <div className="stat-card__icon" style={{ background: '#dbeafe', color: '#2563eb' }}>👥</div>
          </div>
          <div className="stat-card__value">{computedStats.totalLeads}</div>
          <div className="stat-card__change change-up">↑ {computedStats.newToday} new today</div>
        </article>
        <article className="workspace-stat-card">
          <div className="stat-card__header">
            <div className="stat-card__label">Today's Follow Ups</div>
            <div className="stat-card__icon" style={{ background: '#fef3c7', color: '#d97706' }}>📞</div>
          </div>
          <div className="stat-card__value" style={{ color: '#d97706' }}>{computedStats.todayFollowUps}</div>
          <div className={`stat-card__change ${computedStats.overdueFollowUps > 0 ? 'change-down' : 'change-neutral'}`}>{computedStats.overdueFollowUps} overdue</div>
        </article>
        <article className="workspace-stat-card">
          <div className="stat-card__header">
            <div className="stat-card__label">SV Scheduled</div>
            <div className="stat-card__icon" style={{ background: '#cffafe', color: '#0891b2' }}>🏠</div>
          </div>
          <div className="stat-card__value" style={{ color: '#0891b2' }}>{computedStats.svScheduled}</div>
          <div className="stat-card__change change-neutral">Active</div>
        </article>
        <article className="workspace-stat-card">
          <div className="stat-card__header">
            <div className="stat-card__label">SV Completed</div>
            <div className="stat-card__icon" style={{ background: '#dcfce7', color: '#16a34a' }}>✅</div>
          </div>
          <div className="stat-card__value" style={{ color: '#16a34a' }}>{computedStats.svCompleted}</div>
          <div className="stat-card__change change-neutral">This month</div>
        </article>
        <article className="workspace-stat-card">
          <div className="stat-card__header">
            <div className="stat-card__label">Missed Followups</div>
            <div className="stat-card__icon" style={{ background: '#fee2e2', color: '#dc2626' }}>📵</div>
          </div>
          <div className="stat-card__value" style={{ color: '#dc2626' }}>{computedStats.missedFollowups}</div>
          <div className="stat-card__change change-neutral">Retry needed</div>
        </article>
      </div>

      {/* ── Toolbar ── */}
      <div className="lead-workspace__toolbar">
        <div className="lead-workspace__toolbar-search">
          <span className="search-icon">🔍</span>
          <input
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Search leads by name, phone, email..."
          />
        </div>
        <select value={filters.stageCode} onChange={(e) => setFilters((p) => ({ ...p, stageCode: e.target.value }))}>
          <option value="">All Stages</option>
          {stageOptions.filter((o) => ['NEW', 'CONTACTED', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(o.value)).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={filters.statusCode} onChange={(e) => setFilters((p) => ({ ...p, statusCode: e.target.value }))}>
          <option value="">All Statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
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
                  <tr><td colSpan={8} className="lead-workspace__empty">Loading leads...</td></tr>
                )}
                {!loading && !leads.length && (
                  <tr><td colSpan={8} className="lead-workspace__empty">No leads found for current filters</td></tr>
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
                      {lead.handoff?.fromUserName && (
                        <small className="assigned-handoff">
                          ↪ from {lead.handoff.fromUserName}
                        </small>
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

        {/* ── Detail Panel — Corporate Standard Modal ── */}
        {selectedLead && (
          <div className="lead-workspace__modal" onClick={(e) => { if (e.target === e.currentTarget) setSelectedLeadId(null); }}>
            <div className="lead-workspace__modal-panel lead-workspace__modal-panel--lg">
              <div className="lead-workspace__modal-header">
                <div>
                  <h2>{selectedLead.fullName}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', marginTop: 2 }}>
                    {selectedLead.phone}{selectedLead.email ? ` · ${selectedLead.email}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="crm-badge" style={{ backgroundColor: selectedLead.stageColor + '22', color: selectedLead.stageColor }}>
                    <span className="crm-badge-dot" style={{ background: selectedLead.stageColor }} />
                    {selectedLead.stageLabel}
                  </span>
                  <span className="crm-badge" style={{ backgroundColor: selectedLead.statusColor + '22', color: selectedLead.statusColor, border: `1px solid ${selectedLead.statusColor}33` }}>
                    {selectedLead.statusIcon || ''} {selectedLead.statusLabel}
                  </span>
                  <button type="button" onClick={() => setSelectedLeadId(null)}>✕</button>
                </div>
              </div>
              <div className="lead-workspace__modal-body">

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
                      <div className="crm-form-label">WhatsApp</div>
                      <div className="lead-detail__info-value">{selectedLead.whatsappNumber || '-'}</div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Alternate Phone</div>
                      <div className="lead-detail__info-value">{selectedLead.alternatePhone || '-'}</div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Purpose / Config</div>
                      <div className="lead-detail__info-value">{selectedLead.purpose || '-'} / {selectedLead.configuration || '-'}</div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Campaign</div>
                      <div className="lead-detail__info-value">{selectedLead.campaignName || '-'}</div>
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
                      <div className="crm-form-label">Last Handoff</div>
                      <div className="lead-detail__info-value">
                        {selectedLead.handoff?.fromUserName
                          ? `${selectedLead.handoff.fromUserName} → ${selectedLead.handoff.toUserName || 'Unassigned'}`
                          : 'No handoff yet'}
                      </div>
                      {selectedLead.handoff?.handedOffAt && (
                        <small>{formatDateTime(selectedLead.handoff.handedOffAt)}</small>
                      )}
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

                  {/* Workflow Action Dropdown (replaces chips) */}
                  {!selectedLead.isClosed && roleActions.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="crm-form-label">Workflow Action</div>
                      <select
                        className="crm-form-select"
                        value=""
                        onChange={(e) => {
                          const ac = e.target.value;
                          if (!ac) return;
                          const action = roleActions.find((a) => a.code === ac);
                          if (!action) return;
                          // Special modals (SV Done, Closure) go through handleAction
                          if (action.code === 'TC_SV_COMPLETED' || action.needsReason || action.needsCustomerProfile) {
                            handleAction(action);
                          } else {
                            // All other actions go through the stage popup for follow-up + reason
                            setStagePopupData({
                              actionCode: action.code,
                              stageLabel: action.label,
                              followUpAt: '',
                              reason: '',
                              needsFollowUp: Boolean(action.needsFollowUp),
                            });
                            setStagePopupOpen(true);
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="">Select an action...</option>
                        {roleActions.map((action) => (
                          <option key={action.code} value={action.code}>{action.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Update Lead — Stage triggers popup, Status + Follow-up inline */}
                  <h3 className="lead-detail__section-title">Update Lead</h3>
                  <div className="lead-detail__update-grid">
                    <div>
                      <div className="crm-form-label">Stage</div>
                      <select className="crm-form-select" value="" onChange={(e) => { if (e.target.value) openStagePopup(e.target.value); }}>
                        <option value="">{selectedLead.stageLabel} (current)</option>
                        {stageTransitionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.stageLabel}</option>
                        ))}
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
                  <div style={{ marginTop: 16 }}>
                    <div className="crm-form-label">Next Follow Up</div>
                    <input className="lead-detail__calendar-input" type="datetime-local" step={300} value={manualNextFollowUpAt} onChange={(e) => setManualNextFollowUpAt(e.target.value)} />
                    <div className="lead-detail__calendar-shortcuts">
                      <button type="button" className="calendar-shortcut-btn" onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(0, 14, 0))}>Today 2 PM</button>
                      <button type="button" className="calendar-shortcut-btn" onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(0, 18, 0))}>Today 6 PM</button>
                      <button type="button" className="calendar-shortcut-btn" onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(1, 11, 0))}>Tomorrow 11 AM</button>
                      <button type="button" className="calendar-shortcut-btn" onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(1, 16, 0))}>Tomorrow 4 PM</button>
                      <button type="button" className="calendar-shortcut-btn calendar-shortcut-btn--clear" onClick={() => setManualNextFollowUpAt('')}>✕ Clear</button>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <div className="crm-form-label">Notes</div>
                    <textarea id="note-input" className="crm-form-input" rows={2} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add notes..." />
                  </div>
                  <div className="lead-detail__save-bar">
                    {noteDraft.trim() && (
                      <button type="button" className="workspace-btn workspace-btn--ghost" onClick={handleAddNote}>📝 Save Note</button>
                    )}
                    <button type="button" className="workspace-btn workspace-btn--primary" onClick={handleManualStatusUpdate} disabled={manualUpdateSaving}>
                      {manualUpdateSaving ? 'Saving...' : '💾 Save Changes'}
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
      {/* ── Stage Transition Popup Modal ── */}
      {stagePopupOpen && (
        <div className="lead-workspace__modal" onClick={(e) => { if (e.target === e.currentTarget) { setStagePopupOpen(false); } }}>
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm" style={{ marginTop: '10vh' }}>
            <div className="lead-workspace__modal-header" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)' }}>
              <div>
                <h2 style={{ fontSize: 16 }}>🔄 Change Stage</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {selectedLead?.stageLabel} → <strong style={{ color: '#4f46e5' }}>{stagePopupData.stageLabel}</strong>
                </div>
              </div>
              <button type="button" onClick={() => setStagePopupOpen(false)}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {/* Follow-up Date & Time */}
              <div style={{ marginBottom: 18 }}>
                <div className="crm-form-label" style={{ marginBottom: 6 }}>
                  📅 Follow-up Date & Time {stagePopupData.needsFollowUp && <span style={{ color: '#dc2626' }}>*</span>}
                </div>
                <input
                  className="lead-detail__calendar-input"
                  type="datetime-local"
                  step={300}
                  value={stagePopupData.followUpAt}
                  onChange={(e) => setStagePopupData((p) => ({ ...p, followUpAt: e.target.value }))}
                  style={{ marginBottom: 8 }}
                />
                <div className="lead-detail__calendar-shortcuts">
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(0, 14, 0) }))}>Today 2 PM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today 6 PM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tomorrow 11 AM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(1, 16, 0) }))}>Tomorrow 4 PM</button>
                  <button type="button" className="calendar-shortcut-btn calendar-shortcut-btn--clear" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: '' }))}>✕ Clear</button>
                </div>
                {stagePopupData.needsFollowUp && !stagePopupData.followUpAt && (
                  <div className="followup-warning">⚠️ Follow-up date & time is required for this stage.</div>
                )}
              </div>

              {/* Reason / Notes */}
              <div style={{ marginBottom: 18 }}>
                <div className="crm-form-label" style={{ marginBottom: 6 }}>📝 Reason / Notes <span style={{ color: '#dc2626' }}>*</span></div>
                <textarea
                  className="crm-form-input"
                  rows={3}
                  value={stagePopupData.reason}
                  onChange={(e) => setStagePopupData((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="Enter reason for this stage change..."
                  style={{ resize: 'vertical' }}
                  autoFocus
                />
              </div>

              {/* Current Lead Summary */}
              {selectedLead && (
                <div style={{ background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, padding: '10px 14px', marginBottom: 18, border: '1px solid var(--border-primary, #e2e8f0)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Lead Summary</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLead.fullName} · {selectedLead.phone}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{selectedLead.project || 'No project'} · {selectedLead.source || 'Unknown source'}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setStagePopupOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  disabled={manualUpdateSaving || !stagePopupData.reason.trim() || (stagePopupData.needsFollowUp && !stagePopupData.followUpAt)}
                  onClick={handleStagePopupConfirm}
                >
                  {manualUpdateSaving ? 'Saving...' : '✅ Confirm Stage Change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Lead Modal ── */}
      {newLeadOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel">
            <div className="lead-workspace__modal-header">
              <h2>Create New Lead</h2>
              <button type="button" onClick={() => setNewLeadOpen(false)}>✕</button>
            </div>

            <form className="lead-workspace__new-form" onSubmit={handleCreateLead}>
              <div className="lead-workspace__new-form-section">Contact Information</div>
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
                Alternate Phone
                <input value={newLeadForm.alternate_phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, alternate_phone: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                WhatsApp Number
                <input value={newLeadForm.whatsapp_number} onChange={(e) => setNewLeadForm((p) => ({ ...p, whatsapp_number: e.target.value }))} placeholder="Optional" />
              </label>
              {/* <label>
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
              </label> */}
              <label>
                Email
                <input type="email" value={newLeadForm.email} onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))} />
              </label>

              <div className="lead-workspace__new-form-section">Lead Classification</div>
              <label>
                Lead Type
                <select value={newLeadForm.lead_type_id} onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_type_id: e.target.value }))}>
                  <option value="">Select lead type</option>
                  {leadTypeOptions.map((lt) => (
                    <option key={lt.id} value={lt.id}>{lt.type_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Customer Type
                <select value={newLeadForm.customer_type_id} onChange={(e) => setNewLeadForm((p) => ({ ...p, customer_type_id: e.target.value }))}>
                  <option value="">Select customer type</option>
                  {customerTypeOptions.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.type_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Purpose
                <select value={newLeadForm.purpose} onChange={(e) => setNewLeadForm((p) => ({ ...p, purpose: e.target.value }))}>
                  <option value="">Select purpose</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Investment">Investment</option>
                  <option value="Rental">Rental</option>
                </select>
              </label>
              <label>
                Configuration
                <select value={newLeadForm.configuration} onChange={(e) => setNewLeadForm((p) => ({ ...p, configuration: e.target.value }))}>
                  <option value="">Select configuration</option>
                  <option value="1RK">1RK</option>
                  <option value="1BHK">1BHK</option>
                  <option value="2BHK">2BHK</option>
                  <option value="3BHK">3BHK</option>
                  <option value="4BHK">4BHK</option>
                  <option value="Villa">Villa</option>
                  <option value="Plot">Plot</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </label>

              <div className="lead-workspace__new-form-section">Source & Project</div>
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

              <div className="lead-workspace__new-form-section">Budget & Priority</div>
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

              {/* <div className="lead-workspace__new-form-section">Campaign Tracking</div>
              <label>
                Campaign Name
                <input value={newLeadForm.campaign_name} onChange={(e) => setNewLeadForm((p) => ({ ...p, campaign_name: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                UTM Source
                <input value={newLeadForm.utm_source} onChange={(e) => setNewLeadForm((p) => ({ ...p, utm_source: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                UTM Medium
                <input value={newLeadForm.utm_medium} onChange={(e) => setNewLeadForm((p) => ({ ...p, utm_medium: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                UTM Campaign
                <input value={newLeadForm.utm_campaign} onChange={(e) => setNewLeadForm((p) => ({ ...p, utm_campaign: e.target.value }))} placeholder="Optional" />
              </label>
              <label>
                Referral Code
                <input value={newLeadForm.referral_code} onChange={(e) => setNewLeadForm((p) => ({ ...p, referral_code: e.target.value }))} placeholder="Optional" />
              </label> */}
              <label className="lead-workspace__new-form-span">
                Initial Notes
                <textarea
                  rows={3}
                  value={newLeadForm.note}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Add context, requirements, or comments"
                />
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
                  {(workspaceRole === 'TC' ? ['TC'] : ['TC', 'SM', 'SH', 'COL']).map((role) => {
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

              {closureModalAction.code?.includes('JUNK') || closureModalAction.code?.includes('WRONG_NUMBER') ? (
                <div style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--accent-red)' }}>
                  ⚠️ Warning: Marking as {closureModalAction.label.replace('Mark ', '')} will increment the strike counter.
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

      {/* ── Customer Profile Modal (SH Close Won) ── */}
      {customerProfileOpen && (
        <div className="lead-workspace__modal lead-workspace__modal--stacked" onClick={() => setCustomerProfileOpen(false)}>
          <div className="lead-workspace__modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', padding: '18px 24px', borderRadius: '12px 12px 0 0', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>🏆 Close Won — Customer Profile</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>Fill customer details before creating booking</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerProfileOpen(false)}
                aria-label="Close customer profile modal"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.5)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Personal Details */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6 }}>👤 Personal Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Date of Birth *
                  <input type="date" value={customerProfileForm.date_of_birth} onChange={(e) => setCustomerProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Marital Status
                  <select value={customerProfileForm.marital_status} onChange={(e) => setCustomerProfileForm(p => ({ ...p, marital_status: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">Select...</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Purchase Type
                  <select value={customerProfileForm.purchase_type} onChange={(e) => setCustomerProfileForm(p => ({ ...p, purchase_type: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">Select...</option>
                    <option value="Investment">Investment</option>
                    <option value="Self Use">Self Use</option>
                    <option value="Rental">Rental</option>
                    <option value="Gift">Gift</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Occupation *
                  <input type="text" value={customerProfileForm.occupation} onChange={(e) => setCustomerProfileForm(p => ({ ...p, occupation: e.target.value }))} placeholder="e.g. Business, Salaried, Professional" style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Current Post
                  <input type="text" value={customerProfileForm.current_post} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_post: e.target.value }))} placeholder="e.g. Manager, Director" style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>

              {/* Identity */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4 }}>🪪 Identity Documents</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  PAN Number *
                  <input type="text" maxLength={10} value={customerProfileForm.pan_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" style={{ width: '100%', marginTop: 4, textTransform: 'uppercase' }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Aadhar Number *
                  <input type="text" maxLength={12} value={customerProfileForm.aadhar_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, aadhar_number: e.target.value.replace(/\D/g, '') }))} placeholder="1234 5678 9012" style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>

              {/* Current Address */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4 }}>📍 Current Address *</div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Address
                <textarea rows={2} value={customerProfileForm.current_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_address: e.target.value }))} placeholder="Street address, locality..." style={{ width: '100%', marginTop: 4 }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  City
                  <input type="text" value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  State
                  <input type="text" value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Pincode
                  <input type="text" maxLength={6} value={customerProfileForm.current_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_pincode: e.target.value.replace(/\D/g, '') }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>

              {/* Permanent Address */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, flex: 1 }}>🏠 Permanent Address</div>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 12 }}>
                  <input type="checkbox" checked={customerProfileForm.sameAsCurrent} onChange={(e) => setCustomerProfileForm(p => ({ ...p, sameAsCurrent: e.target.checked }))} />
                  Same as Current
                </label>
              </div>
              {!customerProfileForm.sameAsCurrent && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Address
                    <textarea rows={2} value={customerProfileForm.permanent_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_address: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      City
                      <input type="text" value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      State
                      <input type="text" value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Pincode
                      <input type="text" maxLength={6} value={customerProfileForm.permanent_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_pincode: e.target.value.replace(/\D/g, '') }))} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                  </div>
                </>
              )}

              {/* Collection Manager Assignment */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, marginTop: 4 }}>👤 Assign Collection Manager *</div>
              <select value={customerProfileForm.assignToUserId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, assignToUserId: e.target.value }))} style={{ width: '100%' }}>
                <option value="">Select Collection Manager...</option>
                {(assignableUsers['COL'] || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                ))}
              </select>

              {/* Notes */}
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Notes
                <textarea rows={2} value={customerProfileForm.note} onChange={(e) => setCustomerProfileForm(p => ({ ...p, note: e.target.value }))} placeholder="Additional remarks..." style={{ width: '100%', marginTop: 4 }} />
              </label>

              <div className="assign-modal__footer" style={{ marginTop: 8 }}>
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setCustomerProfileOpen(false)}>Cancel</button>
                <button type="button" className="workspace-btn workspace-btn--success" onClick={handleCustomerProfileSubmit} disabled={manualUpdateSaving}>
                  {manualUpdateSaving ? 'Processing...' : '🏆 Approve Booking & Create Customer'}
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
