import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import leadTypeApi from '../../../api/leadTypeApi';
// customerTypeApi removed — Customer Type field removed from TC lead creation
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';

import {
  getWorkspaceTitle,
  buildStageOptions,
  buildStatusOptions,
  getActionsForRole,
  ROLE_LABELS,
} from './workflowConfig';
import CalendarPicker from '../../../components/common/CalendarPicker';
import './LeadWorkspacePage.css';

const initialNewLead = {
  full_name: '',
  phone: '',
  whatsappSameAsPhone: true,
  whatsapp_number: '',
  alternate_phone: '',
  email: '',
  lead_type_id: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_ids: [],
  project_id: '',
  location_id: '',
  location_ids: [],
  budgetMin: '',
  budgetMax: '',
  budgetRange: '',
  priority: 'Medium',
  nextFollowUpAt: '',
  lead_status_id: '',
  motivationType: '',
  primaryRequirement: '',
  secondaryRequirement: '',
  latitude: null,
  longitude: null,
};

const BUDGET_STEPS = [0, 5, 8, 10, 15, 20, 25, 30, 40, 50, 75, 100];
const BUDGET_MAX_VAL = BUDGET_STEPS.length - 1;
const budgetLabel = (idx) => {
  const v = BUDGET_STEPS[idx];
  if (v === 0) return '0';
  if (v >= 100) return '1 Cr+';
  return `${v}L`;
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

const LeadWorkspacePage = ({ user, workspaceRole, autoOpenCreate = false }) => {
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
  const [subSourceMap, setSubSourceMap] = useState({});
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef(null);
  const [locationSearch, setLocationSearch] = useState('');

  // ── Workflow actions ──
  const [noteDraft, setNoteDraft] = useState('');
  const [actionState, setActionState] = useState({ note: '', nextFollowUpAt: '', assignToUserId: '' });
  const [manualStatus, setManualStatus] = useState('');
  const [manualNextFollowUpAt, setManualNextFollowUpAt] = useState('');
  const [manualUpdateSaving, setManualUpdateSaving] = useState(false);

  // ── Stage Transition Popup ──
  const [stagePopupOpen, setStagePopupOpen] = useState(false);
  const [stagePopupData, setStagePopupData] = useState({ actionCode: '', stageLabel: '', followUpAt: '', reason: '', needsFollowUp: false });

  // ── SV Done Modal (TC Handoff) ──
  const [svDoneModalOpen, setSvDoneModalOpen] = useState(false);
  const [svDoneForm, setSvDoneForm] = useState({ assignToUserId: '', svDate: '', svProjectId: '', note: '' });

  // ── Record Site Visit Modal (SM Analysis) ──
  const [recordSvModalOpen, setRecordSvModalOpen] = useState(false);
  const [recordSvForm, setRecordSvForm] = useState({
    svDate: new Date().toISOString().split('T')[0],
    svProjectId: '',
    motivationType: '',
    primaryRequirement: '',
    secondaryRequirement: '',
    latitude: null,
    longitude: null,
    timeSpent: '',
    note: '',
  });

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
      if (selectedLeadId && !selectedExists) {
        // Previously selected lead is no longer in list (filtered out) — clear selection
        setSelectedLeadId(null);
      }
      if (!data.length) {
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
      const [pResp, lResp, sResp, ltResp] = await Promise.all([
        projectApi.getDropdown(),
        locationApi.getDropdown(),
        leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown()),
        leadTypeApi.getDropdown().catch(() => ({ data: [] })),
      ]);
      const projects = pResp.data || [];
      const locations = lResp.data || [];
      const sources = sResp.data || [];
      const leadTypes = ltResp.data || [];
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

  // Auto-open create modal when navigated from dashboard
  useEffect(() => {
    if (autoOpenCreate && !newLeadOpen) {
      setNewLeadOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setProjectDropdownOpen(false); setProjectSearch('');
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setLocationDropdownOpen(false); setLocationSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleProject = (projectId) => {
    setNewLeadForm((prev) => {
      const ids = (prev.project_ids || []).includes(projectId)
        ? prev.project_ids.filter((id) => id !== projectId)
        : [...(prev.project_ids || []), projectId];
      return { ...prev, project_ids: ids };
    });
  };

  const selectedProjectNames = useMemo(
    () => (newLeadForm.project_ids || []).map((id) => projectOptions.find((p) => p.id === id)?.project_name).filter(Boolean),
    [newLeadForm.project_ids, projectOptions]
  );

  const toggleLocation = (locId) => {
    setNewLeadForm((prev) => {
      const ids = (prev.location_ids || []).includes(locId)
        ? prev.location_ids.filter((id) => id !== locId)
        : [...(prev.location_ids || []), locId];
      return { ...prev, location_ids: ids, location_id: ids[0] || '' };
    });
  };

  const selectedLocationNames = useMemo(
    () => (newLeadForm.location_ids || []).map((id) => {
      const l = locationOptions.find((loc) => loc.id === id);
      return l ? `${l.location_name}${l.city ? ', ' + l.city : ''}` : null;
    }).filter(Boolean),
    [newLeadForm.location_ids, locationOptions]
  );

  const filteredProjectOptions = useMemo(() => {
    if (!projectSearch.trim()) return projectOptions;
    const s = projectSearch.toLowerCase();
    return projectOptions.filter((p) => (p.project_name || '').toLowerCase().includes(s) || (p.project_code || '').toLowerCase().includes(s));
  }, [projectOptions, projectSearch]);

  const filteredLocationOptions = useMemo(() => {
    if (!locationSearch.trim()) return locationOptions;
    const s = locationSearch.toLowerCase();
    return locationOptions.filter((l) => (l.location_name || '').toLowerCase().includes(s) || (l.city || '').toLowerCase().includes(s));
  }, [locationOptions, locationSearch]);

  // ── Handlers ──
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.full_name || !newLeadForm.phone) { toast.error('Full name and phone are required'); return; }
    if (!newLeadForm.lead_source_id) { toast.error('Lead source is required'); return; }

    // TC-specific mandatory fields
    if (workspaceRole === 'TC') {
      if (!newLeadForm.lead_sub_source_id) { toast.error('Lead sub-source is required'); return; }
      if (!newLeadForm.nextFollowUpAt) { toast.error('Next follow up date is required'); return; }
      if (!newLeadForm.lead_status_id) { toast.error('Lead status is required'); return; }
    }

    const budgetMin = newLeadForm.budgetMin ? Number(newLeadForm.budgetMin) : null;
    const budgetMax = newLeadForm.budgetMax ? Number(newLeadForm.budgetMax) : null;
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      toast.error('Budget Max must be greater than or equal to Budget Min');
      return;
    }

    // For TC: use first selected project from multi-select
    const primaryProjectId = workspaceRole === 'TC'
      ? (newLeadForm.project_ids?.[0] || null)
      : (newLeadForm.project_id || null);
    const selectedProject = primaryProjectId ? projectOptions.find((p) => p.id === primaryProjectId) : null;
    const selectedSource = sourceOptions.find((s) => s.id === newLeadForm.lead_source_id) || null;
    const selectedLocation = locationOptions.find((l) => l.id === newLeadForm.location_id) || null;

    try {
      if (workspaceRole === 'SM' && (!newLeadForm.latitude || !newLeadForm.longitude)) {
        toast.error('Location is mandatory for SM lead creation');
        return;
      }

      await leadWorkflowApi.createLead({
        ...newLeadForm,
        budgetMin,
        budgetMax,
        whatsapp_number: newLeadForm.whatsappSameAsPhone ? newLeadForm.phone : newLeadForm.whatsapp_number,
        lead_source_id: newLeadForm.lead_source_id || null,
        lead_sub_source_id: newLeadForm.lead_sub_source_id || null,
        project_id: primaryProjectId,
        project_ids: newLeadForm.project_ids?.length ? newLeadForm.project_ids : undefined,
        location_id: newLeadForm.location_ids?.[0] || newLeadForm.location_id || null,
        location_ids: newLeadForm.location_ids?.length ? newLeadForm.location_ids : undefined,
        source: selectedSource?.source_name || (workspaceRole === 'SM' ? 'Walk In' : null),
        project: selectedProject?.project_name || null,
        location: selectedLocation ? `${selectedLocation.location_name}${selectedLocation.city ? `, ${selectedLocation.city}` : ''}` : null,
        nextFollowUpAt: newLeadForm.nextFollowUpAt ? new Date(newLeadForm.nextFollowUpAt).toISOString() : undefined,
        lead_status_id: newLeadForm.lead_status_id || undefined,
      });
      toast.success('Lead created successfully');
      setNewLeadForm({ ...initialNewLead, latitude: null, longitude: null });
      setNewLeadOpen(false);
      setProjectDropdownOpen(false);
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

  const handleRecordSvSubmit = async () => {
    if (!selectedLead) return;
    if (!recordSvForm.svProjectId) { toast.error('Project visited is mandatory'); return; }
    if (!recordSvForm.motivationType) { toast.error('Buying Motivation is mandatory'); return; }
    if (!recordSvForm.latitude) { toast.error('Geo-location is mandatory'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'SM_SITE_VISIT', {
        svDate: recordSvForm.svDate,
        svProjectId: recordSvForm.svProjectId,
        motivationType: recordSvForm.motivationType,
        primaryRequirement: recordSvForm.primaryRequirement,
        secondaryRequirement: recordSvForm.secondaryRequirement,
        latitude: recordSvForm.latitude,
        longitude: recordSvForm.longitude,
        time_spent: recordSvForm.timeSpent ? Number(recordSvForm.timeSpent) : undefined,
        note: recordSvForm.note?.trim() || undefined,
      });
      toast.success('Site visit recorded successfully');
      setRecordSvModalOpen(false);
      loadLeadDetail(selectedLead.id);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to record site visit'));
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
          {workspaceRole === 'SM' ? (
            <option value="NEGOTIATION">Negotiation</option>
          ) : (
            stageOptions.filter((o) => ['NEW', 'CONTACTED', 'FOLLOW_UP', 'SV_SCHEDULED', 'SV_COMPLETED'].includes(o.value)).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))
          )}
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
                      <small>{(lead.interestedProjects?.length > 0
                        ? lead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean).join(', ')
                        : lead.project) || '-'}</small>
                      {(lead.interestedLocations?.length > 0 || lead.location) && (
                        <small style={{ display: 'block', color: '#64748b', fontSize: 10 }}>📍 {lead.interestedLocations?.length > 0
                          ? lead.interestedLocations.map((lid) => locationOptions.find((l) => l.id === lid)?.location_name).filter(Boolean).join(', ')
                          : lead.location}</small>
                      )}
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
                      <div className="crm-form-label">Project(s)</div>
                      <div className="lead-detail__info-value" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(selectedLead.interestedProjects?.length > 0
                          ? selectedLead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean)
                          : [selectedLead.project].filter(Boolean)
                        ).length > 0
                          ? (selectedLead.interestedProjects?.length > 0
                              ? selectedLead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean)
                              : [selectedLead.project].filter(Boolean)
                            ).map((name, i) => (
                              <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{name}</span>
                            ))
                          : '-'
                        }
                      </div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Location(s)</div>
                      <div className="lead-detail__info-value" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(selectedLead.interestedLocations?.length > 0
                          ? selectedLead.interestedLocations.map((lid) => {
                              const l = locationOptions.find((loc) => loc.id === lid);
                              return l ? `${l.location_name}${l.city ? ', ' + l.city : ''}` : null;
                            }).filter(Boolean)
                          : [selectedLead.location].filter(Boolean)
                        ).length > 0
                          ? (selectedLead.interestedLocations?.length > 0
                              ? selectedLead.interestedLocations.map((lid) => {
                                  const l = locationOptions.find((loc) => loc.id === lid);
                                  return l ? `${l.location_name}${l.city ? ', ' + l.city : ''}` : null;
                                }).filter(Boolean)
                              : [selectedLead.location].filter(Boolean)
                            ).map((name, i) => (
                              <span key={i} style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{name}</span>
                            ))
                          : '-'
                        }
                      </div>
                    </div>
                    <div className="lead-detail__info-item">
                      <div className="crm-form-label">Budget</div>
                      <div className="lead-detail__info-value">
                        {(selectedLead.budgetMin != null || selectedLead.budgetMax != null)
                          ? `${selectedLead.budgetMin != null ? formatCurrency(selectedLead.budgetMin) : '0'} – ${selectedLead.budgetMax != null ? formatCurrency(selectedLead.budgetMax) : 'No limit'}`
                          : 'Not specified'}
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

                  {/* Behavioral Analysis (New) */}
                  {(selectedLead.motivationType || selectedLead.primaryRequirement || selectedLead.geoLat) && (
                    <>
                      <h3 className="lead-detail__section-title" style={{ marginTop: 24 }}>🧠 Behavioral Analysis</h3>
                      <div className="lead-detail__info-grid">
                        {selectedLead.motivationType && (
                          <div className="lead-detail__info-item">
                            <div className="crm-form-label">Buying Motivation</div>
                            <div className="lead-detail__info-value">
                              <span className="crm-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontSize: 11 }}>
                                {selectedLead.motivationType}
                              </span>
                            </div>
                          </div>
                        )}
                        {selectedLead.primaryRequirement && (
                          <div className="lead-detail__info-item" style={{ gridColumn: 'span 2' }}>
                            <div className="crm-form-label">Primary Requirement</div>
                            <div className="lead-detail__info-value">{selectedLead.primaryRequirement}</div>
                          </div>
                        )}
                        {selectedLead.secondaryRequirement && (
                          <div className="lead-detail__info-item" style={{ gridColumn: 'span 2' }}>
                            <div className="crm-form-label">Secondary / Site Remarks</div>
                            <div className="lead-detail__info-value" style={{ fontSize: 13, lineHeight: 1.4 }}>{selectedLead.secondaryRequirement}</div>
                          </div>
                        )}
                        {selectedLead.geoLat && (
                          <div className="lead-detail__info-item" style={{ gridColumn: 'span 2' }}>
                            <div className="crm-form-label">Creation Location</div>
                            <div className="lead-detail__info-value">
                              <a 
                                href={`https://www.google.com/maps?q=${selectedLead.geoLat},${selectedLead.geoLong}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                              >
                                📍 View Location on Map
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Quick Actions */}
                  {!selectedLead.isClosed && (
                    <>
                      <h3 className="lead-detail__section-title">Quick Actions</h3>
                      <div className="lead-detail__quick-actions">
                        <button className="crm-btn crm-btn-success crm-btn-sm" onClick={handleAddNote}>📞 Log Call</button>
                        {workspaceRole === 'SM' && (
                          <button 
                            className="crm-btn crm-btn-primary crm-btn-sm" 
                            onClick={() => {
                              setRecordSvForm({
                                svDate: new Date().toISOString().split('T')[0],
                                svProjectId: selectedLead.projectId || '',
                                motivationType: selectedLead.motivationType || '',
                                primaryRequirement: selectedLead.primaryRequirement || '',
                                secondaryRequirement: selectedLead.secondaryRequirement || '',
                                latitude: null,
                                longitude: null,
                                timeSpent: '',
                                note: '',
                              });
                              setRecordSvModalOpen(true);
                              if (!projectOptions.length) loadCreateOptions();
                            }}
                          >
                            🏠 Record Site Visit
                          </button>
                        )}
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
                    <CalendarPicker
                      type="datetime"
                      value={manualNextFollowUpAt ? manualNextFollowUpAt + ':00Z' : ''}
                      onChange={(val) => setManualNextFollowUpAt(val ? val.slice(0, 16) : '')}
                      placeholder="Select Date & Time..."
                      className="lead-detail__calendar-input"
                    />
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
                <CalendarPicker
                  type="datetime"
                  value={stagePopupData.followUpAt ? stagePopupData.followUpAt + ':00Z' /* approximate valid ISO string if it is just a local format */ : ''}
                  onChange={(val) => setStagePopupData((p) => ({ ...p, followUpAt: val ? val.slice(0, 16) : '' }))}
                  placeholder="Select Date & Time..."
                  className="lead-detail__calendar-input"
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
                <div className="crm-form-label" style={{ marginBottom: 6 }}>📝 Reason / Notes (Optional)</div>
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
                  disabled={manualUpdateSaving || (stagePopupData.needsFollowUp && !stagePopupData.followUpAt)}
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
                Full Name*
                <input value={newLeadForm.full_name} onChange={(e) => setNewLeadForm((p) => ({ ...p, full_name: e.target.value }))} required placeholder="Enter buyer full name" />
              </label>
              <label>
                Phone*
                <input value={newLeadForm.phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: e.target.value }))} required placeholder="Primary contact number" />
              </label>
              
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  <input 
                    type="checkbox" 
                    checked={newLeadForm.whatsappSameAsPhone} 
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, whatsappSameAsPhone: e.target.checked, whatsapp_number: e.target.checked ? '' : p.whatsapp_number }))} 
                  />
                  WhatsApp same as phone
                </label>
                {!newLeadForm.whatsappSameAsPhone && (
                  <label style={{ marginTop: 0 }}>
                    WhatsApp Number
                    <input 
                      value={newLeadForm.whatsapp_number} 
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, whatsapp_number: e.target.value }))} 
                      placeholder="Enter WhatsApp number"
                    />
                  </label>
                )}
              </div>

              <label>
                Alternate Phone (Optional)
                <input value={newLeadForm.alternate_phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, alternate_phone: e.target.value }))} placeholder="Secondary contact" />
              </label>
              <label>
                Email (Optional)
                <input type="email" value={newLeadForm.email} onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </label>

              <div className="lead-workspace__new-form-section">Lead Classification</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Lead Type
                  <select value={newLeadForm.lead_type_id} onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_type_id: e.target.value }))}>
                    <option value="">Select lead type</option>
                    {leadTypeOptions.map((lt) => (
                      <option key={lt.id} value={lt.id}>{lt.type_name}</option>
                    ))}
                  </select>
                </label>
                {workspaceRole === 'TC' && (
                  <label>
                    Lead Status*
                    <select
                      value={newLeadForm.lead_status_id}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_status_id: e.target.value }))}
                      required
                      style={{ borderColor: !newLeadForm.lead_status_id ? '#fca5a5' : undefined }}
                    >
                      <option value="">Select lead status</option>
                      {statusOptions.map((st) => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="lead-workspace__new-form-section">Source & Project</div>
              {/* Multi-select Project for TC, single select for others */}
              {/* Searchable Multi-Select Project */}
              <div ref={projectDropdownRef} style={{ position: 'relative', gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Project (Multi-Select)</label>
                <div
                  onClick={() => setProjectDropdownOpen((p) => !p)}
                  style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '6px 10px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, background: 'var(--bg-primary, #fff)', fontSize: 13 }}
                >
                  {selectedProjectNames.length === 0 && <span style={{ color: '#94a3b8' }}>Select projects...</span>}
                  {selectedProjectNames.map((name, i) => (
                    <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {name}
                      <span onClick={(ev) => { ev.stopPropagation(); toggleProject((newLeadForm.project_ids || [])[i]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
                {projectDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 240, marginTop: 4 }}>
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>
                      <input type="text" placeholder="Search projects..." value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {filteredProjectOptions.map((project) => (
                        <label key={project.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={(ev) => ev.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                        >
                          <input type="checkbox" checked={(newLeadForm.project_ids || []).includes(project.id)} onChange={() => toggleProject(project.id)} />
                          {project.project_name}{project.project_code ? ` (${project.project_code})` : ''}
                        </label>
                      ))}
                      {filteredProjectOptions.length === 0 && <div style={{ padding: 12, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No projects found</div>}
                    </div>
                  </div>
                )}
              </div>
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
                Lead Sub-Source{workspaceRole === 'TC' ? '*' : ''}
                <select
                  value={newLeadForm.lead_sub_source_id}
                  onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))}
                  disabled={!newLeadForm.lead_source_id || !selectedSourceSubSources.length}
                  required={workspaceRole === 'TC'}
                  style={{ borderColor: workspaceRole === 'TC' && newLeadForm.lead_source_id && !newLeadForm.lead_sub_source_id ? '#fca5a5' : undefined }}
                >
                  <option value="">Select sub-source</option>
                  {selectedSourceSubSources.map((s) => (
                    <option key={s.id} value={s.id}>{s.sub_source_name}</option>
                  ))}
                </select>
              </label>
              {/* Searchable Multi-Select Location */}
              <div ref={locationDropdownRef} style={{ position: 'relative', gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: 4 }}>Location (Multi-Select)</label>
                <div
                  onClick={() => setLocationDropdownOpen((p) => !p)}
                  style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '6px 10px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, background: 'var(--bg-primary, #fff)', fontSize: 13 }}
                >
                  {selectedLocationNames.length === 0 && <span style={{ color: '#94a3b8' }}>Select locations...</span>}
                  {selectedLocationNames.map((name, i) => (
                    <span key={i} style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {name}
                      <span onClick={(ev) => { ev.stopPropagation(); toggleLocation((newLeadForm.location_ids || [])[i]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
                {locationDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 240, marginTop: 4 }}>
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>
                      <input type="text" placeholder="Search locations..." value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, outline: 'none' }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {filteredLocationOptions.map((loc) => (
                        <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={(ev) => ev.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(ev) => ev.currentTarget.style.background = 'transparent'}
                        >
                          <input type="checkbox" checked={(newLeadForm.location_ids || []).includes(loc.id)} onChange={() => toggleLocation(loc.id)} />
                          {loc.location_name}{loc.city ? `, ${loc.city}` : ''}{loc.state ? ` (${loc.state})` : ''}
                        </label>
                      ))}
                      {filteredLocationOptions.length === 0 && <div style={{ padding: 12, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>No locations found</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="lead-workspace__new-form-section">Budget & Priority</div>
              {/* Budget Range Slider */}
              <div className="lead-workspace__new-form-span" style={{ padding: '4px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Budget Range: <strong>{budgetLabel(newLeadForm.budgetMinIdx || 0)} – {budgetLabel(newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL)}</strong></div>
                <div style={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                  <div style={{ position: 'absolute', left: 8, right: 8, height: 6, borderRadius: 3, background: '#e2e8f0' }} />
                  <div style={{ position: 'absolute', left: `calc(${((newLeadForm.budgetMinIdx || 0) / BUDGET_MAX_VAL) * 100}% + 8px)`, right: `calc(${(1 - (newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL) / BUDGET_MAX_VAL) * 100}% + 8px)`, height: 6, borderRadius: 3, background: 'var(--accent-blue, #3b82f6)' }} />
                  <input type="range" min={0} max={BUDGET_MAX_VAL} value={newLeadForm.budgetMinIdx || 0}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value), (newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL) - 1);
                      setNewLeadForm((p) => ({ ...p, budgetMinIdx: v, budgetMin: BUDGET_STEPS[v] * 100000 }));
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 40, opacity: 0, cursor: 'pointer', zIndex: 3 }}
                  />
                  <input type="range" min={0} max={BUDGET_MAX_VAL} value={newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL}
                    onChange={(e) => {
                      const v = Math.max(Number(e.target.value), (newLeadForm.budgetMinIdx || 0) + 1);
                      setNewLeadForm((p) => ({ ...p, budgetMaxIdx: v, budgetMax: BUDGET_STEPS[v] * 100000 }));
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 40, opacity: 0, cursor: 'pointer', zIndex: 4 }}
                  />
                  <div style={{ position: 'absolute', left: `calc(${((newLeadForm.budgetMinIdx || 0) / BUDGET_MAX_VAL) * 100}%)`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue, #3b82f6)', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 5, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: `calc(${((newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL) / BUDGET_MAX_VAL) * 100}%)`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue, #3b82f6)', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 5, pointerEvents: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', padding: '0 8px' }}>
                  {BUDGET_STEPS.filter((_, i) => i % 2 === 0).map((v) => <span key={v}>{v >= 100 ? '1Cr' : `${v}L`}</span>)}
                </div>
              </div>
              <label>
                Priority
                <select value={newLeadForm.priority} onChange={(e) => setNewLeadForm((p) => ({ ...p, priority: e.target.value }))}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </label>

              {/* Next Follow Up Date — CalendarPicker for TC */}
              {workspaceRole === 'TC' && (
                <div className="lead-workspace__new-form-span">
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Next Follow Up Date*</div>
                  <CalendarPicker
                    type="datetime"
                    value={newLeadForm.nextFollowUpAt}
                    onChange={(val) => setNewLeadForm((p) => ({ ...p, nextFollowUpAt: val }))}
                    placeholder="Select Date & Time..."
                    minDate={new Date().toISOString()}
                  />
                </div>
              )}

              {/* SM Behavioral Metadata */}
              {workspaceRole === 'SM' && (
                <>
                  <div className="lead-workspace__new-form-section">Site Visit Details (Behavioral)</div>
                  <label>
                    Buying Motivation*
                    <select
                      value={newLeadForm.motivationType}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, motivationType: e.target.value }))}
                      required
                    >
                      <option value="">Select motivation...</option>
                      <option value="Necessity">Necessity (High Intent)</option>
                      <option value="Comfort">Comfort</option>
                      <option value="Emotional">Emotional</option>
                      <option value="Prestige">Prestige</option>
                      <option value="Thrill">Thrill / Investment</option>
                    </select>
                  </label>
                  <label>
                    Primary Requirement
                    <input
                      value={newLeadForm.primaryRequirement}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, primaryRequirement: e.target.value }))}
                      placeholder="Principal requirement"
                    />
                  </label>
                  <label className="lead-workspace__new-form-span">
                    Secondary Requirements & Site Remarks
                    <textarea
                      rows={2}
                      value={newLeadForm.secondaryRequirement}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, secondaryRequirement: e.target.value }))}
                      placeholder="Additional requirements or site visit remarks"
                    />
                  </label>
                  
                  <div className="lead-workspace__new-form-span" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, display: 'block' }}>📍 Geo-location*</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {newLeadForm.latitude ? `Captured: ${newLeadForm.latitude.toFixed(6)}, ${newLeadForm.longitude.toFixed(6)}` : 'Mandatory for Walk-in leads'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`workspace-btn ${newLeadForm.latitude ? 'workspace-btn--ghost' : 'workspace-btn--primary'}`}
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => {
                        if (!navigator.geolocation) {
                          toast.error('Geolocation is not supported by your browser');
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setNewLeadForm(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                            toast.success('Location captured!');
                          },
                          (err) => toast.error(`Error: ${err.message}`)
                        );
                      }}
                    >
                      {newLeadForm.latitude ? 'Update Location' : 'Get Location'}
                    </button>
                  </div>
                </>
              )}

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

      {/* ── Record Site Visit Modal (SM) ── */}
      {recordSvModalOpen && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true">
          <div className="lead-workspace__modal-panel lead-workspace__modal-panel--sm">
            <div className="lead-workspace__modal-header" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}>
              <h2 style={{ color: '#fff' }}>🏠 Record Site Visit</h2>
              <button type="button" style={{ color: '#fff' }} onClick={() => setRecordSvModalOpen(false)}>✕</button>
            </div>

            <div className="assign-modal__body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <strong>{selectedLead?.fullName}</strong> ({selectedLead?.leadNumber})
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Log a visit analysis for this lead.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label>
                  Date *
                  <CalendarPicker 
                    type="date"
                    value={recordSvForm.svDate ? new Date(recordSvForm.svDate).toISOString() : ''}
                    onChange={(val) => setRecordSvForm(p => ({ ...p, svDate: val ? val.split('T')[0] : '' }))}
                  />
                </label>
                <label>
                  Time Spent (Mins)
                  <input type="number" placeholder="Duration" value={recordSvForm.timeSpent} onChange={(e) => setRecordSvForm(p => ({ ...p, timeSpent: e.target.value }))} style={{ width: '100%' }} />
                </label>
              </div>

              <label style={{ marginBottom: 14 }}>
                Project Visited *
                <select value={recordSvForm.svProjectId} onChange={(e) => setRecordSvForm(p => ({ ...p, svProjectId: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select Project...</option>
                  {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
              </label>

              <label style={{ marginBottom: 14 }}>
                Buying Motivation *
                <select value={recordSvForm.motivationType} onChange={(e) => setRecordSvForm(p => ({ ...p, motivationType: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Select motivation...</option>
                  <option value="Necessity">Necessity</option>
                  <option value="Comfort">Comfort</option>
                  <option value="Emotional">Emotional</option>
                  <option value="Prestige">Prestige</option>
                  <option value="Thrill">Thrill / Investment</option>
                </select>
              </label>

              <label style={{ marginBottom: 14 }}>
                Primary Requirement
                <input type="text" value={recordSvForm.primaryRequirement} onChange={(e) => setRecordSvForm(p => ({ ...p, primaryRequirement: e.target.value }))} placeholder="Key highlight" style={{ width: '100%' }} />
              </label>

              <label style={{ marginBottom: 14 }}>
                Secondary Requirements / Remarks
                <textarea rows={2} value={recordSvForm.secondaryRequirement} onChange={(e) => setRecordSvForm(p => ({ ...p, secondaryRequirement: e.target.value }))} placeholder="Additional details..." style={{ width: '100%' }} />
              </label>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>📍 Geo-location*</div>
                  <button
                    type="button"
                    className={`workspace-btn ${recordSvForm.latitude ? 'workspace-btn--ghost' : 'workspace-btn--primary'} workspace-btn--sm`}
                    onClick={() => {
                      if (!navigator.geolocation) { toast.error('Not supported'); return; }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setRecordSvForm(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                          toast.success('Location captured');
                        },
                        (err) => toast.error(err.message)
                      );
                    }}
                  >
                    {recordSvForm.latitude ? 'Update location' : 'Get Location'}
                  </button>
                </div>
                {recordSvForm.latitude && (
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Lat: {recordSvForm.latitude.toFixed(6)}, Lng: {recordSvForm.longitude.toFixed(6)}
                  </div>
                )}
              </div>

              <div className="assign-modal__footer">
                <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => setRecordSvModalOpen(false)}>Cancel</button>
                <button
                  type="button"
                  className="workspace-btn workspace-btn--primary"
                  onClick={handleRecordSvSubmit}
                  disabled={!recordSvForm.latitude || !recordSvForm.svProjectId || !recordSvForm.motivationType}
                >
                  ✓ Record Visit
                </button>
              </div>
            </div>
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
                <CalendarPicker 
                  type="date"
                  value={svDoneForm.svDate ? new Date(svDoneForm.svDate).toISOString() : ''}
                  onChange={(val) => setSvDoneForm(p => ({ ...p, svDate: val ? val.split('T')[0] : '' }))}
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
