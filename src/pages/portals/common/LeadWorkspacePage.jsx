import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import siteVisitApi from '../../../api/siteVisitApi';
import statusRemarkApi from '../../../api/statusRemarkApi';
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

const BUDGET_STEPS = [0, 5, 8, 10, 15, 20, 25, 30, 40, 50];
const BUDGET_MAX_VAL = BUDGET_STEPS.length - 1;
const NEW_LEAD_REMARK_CHIPS = ['Hot lead', 'Requested call back', 'Needs brochure', 'Budget discussed', 'Location priority'];
const budgetLabel = (idx) => {
  const v = BUDGET_STEPS[idx];
  if (v === 0) return '0';
  if (v >= 50) return '50L+';
  return `${v}L`;
};

const initialNewLead = {
  full_name: '',
  phone: '',
  whatsappSameAsPhone: true,
  whatsapp_number: '',
  alternate_phone: '',
  email: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_ids: [],
  project_id: '',
  location_id: '',
  location_ids: [],
  budgetMin: '',
  budgetMax: '',
  budgetRange: '',
  budgetMinIdx: 0,
  budgetMaxIdx: BUDGET_MAX_VAL,
  nextFollowUpAt: '',
  lead_status_id: '',
  motivationType: '',
  motivationNote: '',
  primaryRequirement: '',
  secondaryRequirement: '',
  latitude: null,
  longitude: null,
  assigned_to: '', // '' = unassigned, user.id = assigned to that user
  closure_reason_id: '',
  remark: '',
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

const getQuickFollowUpForWeekday = (weekday, hour, minute = 0) => {
  const date = new Date();
  date.setSeconds(0, 0);
  const currentDay = date.getDay();
  const dayOffset = (weekday - currentDay + 7) % 7;
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return toDateTimeLocalValue(date.toISOString());
};

const getAssigneeRoleForAction = (action, workspaceRole) => {
  if (!action) return 'SM';
  if (action.code === 'TC_SV_DONE') return 'SM';
  if (action.code === 'SM_SITE_VISIT') return 'SH';
  if (workspaceRole === 'SM' && action.needsSvDetails) return 'SH';
  if (action.assigneeRole) return action.assigneeRole;
  if (workspaceRole === 'SH') return 'COL';
  if (workspaceRole === 'SM') return 'SH';
  return 'SM';
};

const getClosureReasonCategoryForAction = (action) => {
  if (!action?.needsReason) return null;
  if (action.reasonCategory) return action.reasonCategory;

  switch (action.code) {
    case 'TC_SPAM':
      return 'SPAM';
    case 'TC_JUNK':
      return 'JUNK';
    case 'TC_LOST':
      return 'LOST';
    default:
      return null;
  }
};

const SectionLabel = ({ children }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.09em',
      color: 'var(--text-secondary, #64748b)',
      textTransform: 'uppercase',
      padding: '14px 0 10px',
      borderBottom: '1px solid var(--border-primary, #e2e8f0)',
      marginBottom: 14,
    }}
  >
    {children}
  </div>
);

const FieldWrap = ({ label, required, optional, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
    <label
      style={{
        fontSize: 11.5,
        fontWeight: 500,
        color: 'var(--text-secondary, #64748b)',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {required && <span style={{ color: 'var(--accent-red, #ef4444)' }}>*</span>}
      {optional && <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400, fontSize: 11 }}>(optional)</span>}
    </label>
    {children}
  </div>
);

const inputStyle = (borderColor) => ({
  width: '100%',
  height: 36,
  background: 'var(--bg-primary, #fff)',
  border: `1px solid ${borderColor || 'var(--border-primary, #e2e8f0)'}`,
  borderRadius: 7,
  color: 'var(--text-primary, #0f172a)',
  fontSize: 12.5,
  padding: '0 10px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s',
});

const selectStyle = (borderColor, disabled) => ({
  width: '100%',
  height: 36,
  background: 'var(--bg-primary, #fff)',
  border: `1px solid ${borderColor || 'var(--border-primary, #e2e8f0)'}`,
  borderRadius: 7,
  color: disabled ? 'var(--text-muted, #94a3b8)' : 'var(--text-primary, #0f172a)',
  fontSize: 12.5,
  padding: '0 10px',
  outline: 'none',
  fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'border-color 0.15s',
});

const validationMsg = (type) => ({
  fontSize: 10,
  fontWeight: 600,
  color: type === 'error' ? 'var(--accent-red, #ef4444)' : 'var(--accent-green, #22c55e)',
  marginTop: 2,
  display: 'block',
});

const FilterDropdown = ({ label, options, selectedValues, onToggle, onClear }) => (
  <details className="lead-filter-dropdown">
    <summary className="lead-filter-dropdown__summary">
      <span>{label}</span>
      <span className="lead-filter-dropdown__count">{selectedValues.length ? selectedValues.length : 'All'}</span>
    </summary>
    <div className="lead-filter-dropdown__menu">
      <div className="lead-filter-dropdown__menu-head">
        <strong>{label}</strong>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onClear();
          }}
        >
          Clear
        </button>
      </div>
      {!options.length ? (
        <p className="lead-filter-dropdown__empty">No options</p>
      ) : (
        options.map((opt) => (
          <label key={opt.value} className="lead-filter-dropdown__item">
            <input
              type="checkbox"
              checked={selectedValues.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))
      )}
    </div>
  </details>
);

const LeadWorkspacePage = ({ user, workspaceRole, autoOpenCreate = false }) => {
  const navigate = useNavigate();
  const wsTitle = getWorkspaceTitle(workspaceRole);


  // ── Pipeline config from API ──
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);

  // ── Leads ──
  const [filters, setFilters] = useState({ search: '', stageCode: '', statusCode: '', includeClosed: false });
  const [multiFilters, setMultiFilters] = useState({ stageCodes: [], statusCodes: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

  // ── Quick Action Popup ──
  const [quickActionLead, setQuickActionLead] = useState(null);
  const [quickActionActivities, setQuickActionActivities] = useState([]);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [quickWorkflowAction, setQuickWorkflowAction] = useState(null);
  const [quickActionSiteVisits, setQuickActionSiteVisits] = useState([]);
  const [quickWorkflowForm, setQuickWorkflowForm] = useState({
    note: '',
    statusRemarkText: '',
    nextFollowUpAt: '',
    assignToUserId: '',
    closureReasonId: '',
    reason: '',
    svDate: '',
    svProjectId: '',
    motivationType: '',
    primaryRequirement: '',
    secondaryRequirement: '',
    latitude: null,
    longitude: null,
    timeSpent: '',
  });

  // ── Dynamic Status Remarks ──
  const [quickStatusRemarks, setQuickStatusRemarks] = useState([]);
  const [quickRemarkAnsNonAns, setQuickRemarkAnsNonAns] = useState(null); // 'Answered' | 'Not-Answered' | null
  const [closureReasons, setClosureReasons] = useState([]);
  const [activeTab, setActiveTab] = useState('mine'); // 'all' | 'new' | 'mine'

  // ── Create lead ──
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState(initialNewLead);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [subSourceMap, setSubSourceMap] = useState({});
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [creating, setCreating] = useState(false);

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
    assignToUserId: '',
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

  // ── Phone Validation States ──
  const [phoneCheck, setPhoneCheck] = useState({ status: 'idle', leadInfo: null, duplicateLead: null });
  const [altPhoneCheck, setAltPhoneCheck] = useState({ status: 'idle', leadInfo: null, duplicateLead: null });
  const [reengageLeadId, setReengageLeadId] = useState(null);

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

  const toolbarStageOptions = useMemo(() => {
    if (workspaceRole === 'SM') {
      return stageOptions.filter((o) => ['SITE_VISIT', 'OPPORTUNITY'].includes(o.value));
    }
    if (workspaceRole === 'SH') {
      return stageOptions.filter((o) => ['OPPORTUNITY', 'BOOKING'].includes(o.value));
    }
    return stageOptions.filter((o) => ['LEAD', 'CONTACTED', 'QUALIFIED'].includes(o.value));
  }, [workspaceRole, stageOptions]);

  const sourceFilterOptions = useMemo(() => {
    const sourceSet = new Set();

    sourceOptions.forEach((s) => {
      const name = (s?.source_name || s?.name || '').trim();
      if (name) sourceSet.add(name);
    });

    leads.forEach((l) => {
      const name = (l?.source || '').trim();
      if (name) sourceSet.add(name);
    });

    return Array.from(sourceSet)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name.toLowerCase(), label: name }));
  }, [sourceOptions, leads]);

  const filteredLeads = useMemo(() => {
    const searchText = (filters.search || '').trim().toLowerCase();

    return leads.filter((lead) => {
      if (searchText) {
        const haystack = [
          lead.fullName,
          lead.phone,
          lead.email,
          lead.leadNumber,
          lead.source,
          lead.subSource,
          lead.project,
          lead.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(searchText)) return false;
      }

      if (multiFilters.stageCodes.length && !multiFilters.stageCodes.includes(lead.stageCode)) return false;
      if (multiFilters.statusCodes.length && !multiFilters.statusCodes.includes(lead.statusCode)) return false;

      if (multiFilters.sources.length) {
        const sourceKey = (lead.source || '').toLowerCase();
        if (!multiFilters.sources.includes(sourceKey)) return false;
      }

      return true;
    });
  }, [leads, filters.search, multiFilters]);

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
      // Build query params based on active tab for TC
      const queryParams = {
        roleCode: workspaceRole,
        page: 1,
        limit: 100,
        ...filters,
      };

      // Add tab-specific filters for TC
      if (workspaceRole === 'TC') {
        if (activeTab === 'new') {
          queryParams.unassigned = true;
        } else {
          // 'mine' (default) — only show leads assigned to this user
          queryParams.assignedToMe = true;
        }
      }

      const resp = await leadWorkflowApi.getLeads(queryParams);

      const data = resp.data || [];
      setLeads(data);
      setMeta(resp.meta || { total: data.length, page: 1, totalPages: 1 });

      const selectedExists = data.some((l) => l.id === selectedLeadId);
      if (selectedLeadId && !selectedExists) {
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
  }, [filters, workspaceRole, selectedLeadId, activeTab]);

  // Load closure reasons for new lead form when a terminal status is selected
  useEffect(() => {
    if (!newLeadOpen || !newLeadForm.lead_status_id) return;
    
    const selectedStatus = statusOptions.find(st => st.id === newLeadForm.lead_status_id || st.value === newLeadForm.lead_status_id);
    if (!selectedStatus) return;

    let category = null;
    if (selectedStatus.value === 'LOST') category = 'COLD';
    if (selectedStatus.value === 'JUNK') category = 'JUNK';
    if (selectedStatus.value === 'SPAM') category = 'SPAM';

    if (category) {
      const fetchReasons = async () => {
        try {
          const resp = await leadWorkflowApi.getClosureReasons(category);
          setClosureReasons(resp.data?.rows || resp.data || []);
        } catch {
          setClosureReasons([]);
        }
      };
      fetchReasons();
    } else {
      setClosureReasons([]);
    }
  }, [newLeadOpen, newLeadForm.lead_status_id, statusOptions]);

  // ── Duplicate Phone Check ──
  const checkDuplicatePhone = async (phone, type) => {
    if (!phone || phone.length < 10) {
      if (type === 'primary') setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      else setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      return;
    }

    if (type === 'primary') setPhoneCheck({ status: 'checking', leadInfo: null, duplicateLead: null });
    else setAltPhoneCheck({ status: 'checking', leadInfo: null, duplicateLead: null });

    try {
      const resp = await leadWorkflowApi.searchLeadByPhone(phone);
      const results = resp.data || [];
      const exactMatch = results.find(l =>
        l.phone === phone ||
        l.alternate_phone === phone ||
        l.whatsapp_number === phone
      );

      if (exactMatch) {
        // Fetch complete lead details
        try {
          const detailResp = await leadWorkflowApi.getLeadById(exactMatch.id);
          const fullLead = detailResp?.data || exactMatch;
          const duplicateLeadName = (
            fullLead.fullName
            || fullLead.full_name
            || `${fullLead.firstName || fullLead.first_name || ''} ${fullLead.lastName || fullLead.last_name || ''}`.trim()
          ).trim();
          const info = `${fullLead.leadNumber || fullLead.lead_number || 'Lead'} - ${duplicateLeadName || 'Unnamed'} (${fullLead.stage?.stage_name || fullLead.stageLabel || 'No Stage'})`;
          if (type === 'primary') setPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: fullLead });
          else setAltPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: fullLead });
        } catch {
          // Fallback: use search result only
          const info = `${exactMatch.leadNumber || 'Lead'} - ${exactMatch.fullName || ''} (${exactMatch.stageLabel || 'No Stage'})`;
          if (type === 'primary') setPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: exactMatch });
          else setAltPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: exactMatch });
        }
      } else {
        if (type === 'primary') setPhoneCheck({ status: 'valid', leadInfo: null, duplicateLead: null });
        else setAltPhoneCheck({ status: 'valid', leadInfo: null, duplicateLead: null });
      }
    } catch {
      if (type === 'primary') setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      else setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
    }
  };

  // Populate form with duplicate lead details
  const prefillFormFromDuplicateLead = useCallback((lead) => {
    if (!lead) return;

    const fullName = (
      lead.fullName
      || lead.full_name
      || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim()
    ).trim();
    
    setNewLeadForm((prev) => ({
      ...prev,
      full_name: fullName || prev.full_name,
      email: lead.email || prev.email,
      whatsapp_number: lead.whatsapp_number || prev.whatsapp_number,
      lead_source_id: lead.lead_source_id || lead.leadSourceId || prev.lead_source_id,
      lead_sub_source_id: lead.lead_sub_source_id || lead.leadSubSourceId || prev.lead_sub_source_id,
      project_ids: lead.interested_projects && lead.interested_projects.length > 0 
        ? lead.interested_projects 
        : (lead.interestedProjects && lead.interestedProjects.length > 0
          ? lead.interestedProjects
          : (lead.project_id || lead.projectId ? [lead.project_id || lead.projectId] : prev.project_ids)),
      location_ids: lead.interested_locations || lead.interestedLocations || prev.location_ids,
      location_id: lead.interested_locations && lead.interested_locations.length > 0 
        ? lead.interested_locations[0]
        : (lead.interestedLocations && lead.interestedLocations.length > 0
          ? lead.interestedLocations[0]
          : prev.location_id),
      budgetMin: lead.budget_min || lead.budgetMin || prev.budgetMin,
      budgetMax: lead.budget_max || lead.budgetMax || prev.budgetMax,
      motivationType: lead.motivation_type || lead.motivationType || prev.motivationType,
      motivationNote: lead.motivation_note || lead.motivationNote || prev.motivationNote,
      primaryRequirement: lead.primary_requirement || lead.primaryRequirement || prev.primaryRequirement,
      secondaryRequirement: lead.secondary_requirement || lead.secondaryRequirement || prev.secondaryRequirement,
      remarks: lead.remarks || '',
    }));

    setReengageLeadId(lead.id || null);
    
    toast.success('Form pre-filled with duplicate lead details');
  }, []);

  useEffect(() => {
    if (!reengageLeadId) return;
    const currentDuplicateIds = [phoneCheck.duplicateLead?.id, altPhoneCheck.duplicateLead?.id].filter(Boolean);
    if (!currentDuplicateIds.includes(reengageLeadId)) {
      setReengageLeadId(null);
    }
  }, [reengageLeadId, phoneCheck.duplicateLead, altPhoneCheck.duplicateLead]);


  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicatePhone(newLeadForm.phone, 'primary');
    }, 600);
    return () => clearTimeout(timer);
  }, [newLeadForm.phone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicatePhone(newLeadForm.alternate_phone, 'alt');
    }, 600);
    return () => clearTimeout(timer);
  }, [newLeadForm.alternate_phone]);

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
  useEffect(() => { loadLeads(); }, [filters, workspaceRole, activeTab]);
  useEffect(() => { loadLeadDetail(selectedLeadId); }, [selectedLeadId, loadLeadDetail]);

  const toggleMultiFilter = (key, value) => {
    setMultiFilters((prev) => {
      const existing = prev[key] || [];
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      return { ...prev, [key]: next };
    });
  };

  const clearMultiFilters = () => {
    setMultiFilters({ stageCodes: [], statusCodes: [], sources: [] });
    setFilters((prev) => ({ ...prev, search: '' }));
  };

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
    loadCreateOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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


  const filteredProjectOptions = useMemo(() => {
    let opts = projectOptions;
    if (newLeadForm.location_id) {
      opts = opts.filter((p) => String(p.location_id) === String(newLeadForm.location_id));
    }
    if (!projectSearch.trim()) return opts;
    const s = projectSearch.toLowerCase();
    return opts.filter((p) => (p.project_name || '').toLowerCase().includes(s) || (p.project_code || '').toLowerCase().includes(s));
  }, [projectOptions, projectSearch, newLeadForm.location_id]);


  // ── Handlers ──
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadForm.full_name || !newLeadForm.phone) { toast.error('Full name and phone are required'); return; }
    if (!newLeadForm.lead_source_id) { toast.error('Lead source is required'); return; }

    // TC-specific mandatory fields
    if (workspaceRole === 'TC') {
      if (!newLeadForm.lead_sub_source_id) { toast.error('Lead sub-source is required'); return; }
      if (!newLeadForm.lead_status_id) { toast.error('Lead status is required'); return; }

      // Validation for terminal statuses
      const selectedStatus = statusOptions.find(st => st.id === newLeadForm.lead_status_id || st.value === newLeadForm.lead_status_id);
      const isTerminal = selectedStatus && (['JUNK', 'SPAM', 'LOST', 'COLD_LOST'].includes(selectedStatus.value));

      if (!isTerminal && !newLeadForm.nextFollowUpAt) {
        toast.error('Next follow up date is required');
        return;
      }

      if (isTerminal) {
        if (['JUNK', 'SPAM'].includes(selectedStatus.value) && !newLeadForm.remark?.trim()) {
          toast.error(`A reason/remark is mandatory when marking a lead as ${selectedStatus.label}`);
          return;
        }
        if (selectedStatus.value === 'LOST' || selectedStatus.value === 'COLD_LOST') {
          // Closure reason is handled by remark in creation form
          if (!newLeadForm.remark?.trim() && !newLeadForm.note?.trim()) {
            toast.error('Please enter a closure reason in remarks');
            return;
          }
        }
      }
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

      setCreating(true);
      // Handle assigned_to - convert "self" to actual user ID
      const assignedToValue = newLeadForm.assigned_to === 'self' ? user?.id : (newLeadForm.assigned_to || null);

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
        assigned_to: assignedToValue,
        closure_reason_id: newLeadForm.closure_reason_id || undefined,
        remark: newLeadForm.remark || undefined,
        reengage: Boolean(reengageLeadId),
        reengageLeadId: reengageLeadId || undefined,
      });
      toast.success('Lead created successfully');
      setNewLeadForm({ ...initialNewLead, latitude: null, longitude: null });
      setReengageLeadId(null);
      setNewLeadOpen(false);
      setProjectDropdownOpen(false);
      if (workspaceRole === 'TC') {
        const targetTab = assignedToValue ? 'mine' : 'new';
        if (activeTab !== targetTab) {
          setActiveTab(targetTab);
        } else {
          loadLeads({ silent: true });
        }
      } else {
        loadLeads({ silent: true });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to create lead'));
    } finally {
      setCreating(false);
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
    if (action.code === 'TC_SV_DONE') {
      setSvDoneForm({ assignToUserId: '', svDate: '', svProjectId: '', note: actionState.note || '' });
      setSvDoneModalOpen(true);
      loadAssignableUsers('SM');
      if (!projectOptions.length) loadCreateOptions();
      return;
    }

    if (action.code === 'SM_SITE_VISIT' || (workspaceRole === 'SM' && action.needsSvDetails)) {
      setRecordSvForm({
        svDate: new Date().toISOString().split('T')[0],
        svProjectId: selectedLead.projectId || '',
        assignToUserId: '',
        motivationType: selectedLead.motivationType || '',
        primaryRequirement: selectedLead.primaryRequirement || '',
        secondaryRequirement: selectedLead.secondaryRequirement || '',
        latitude: null,
        longitude: null,
        timeSpent: '',
        note: actionState.note || '',
      });
      setRecordSvModalOpen(true);
      loadAssignableUsers('SH');
      if (!projectOptions.length) loadCreateOptions();
      return;
    }

    // SH Close Won: open Customer Profile modal
    if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
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
    if (action.needsReason) {
      const category = getClosureReasonCategoryForAction(action);
      setClosureModalAction(action);
      setClosureForm({ closureReasonId: '', reason: '' });
      // LOST should fetch all active reasons, while other actions fetch by category.
      const categoryParam = category === 'LOST' ? '' : (category || '');
      try {
        const resp = await leadWorkflowApi.getClosureReasons(categoryParam);
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
    if (!recordSvForm.assignToUserId) { toast.error('Sales Head selection is mandatory'); return; }
    if (!recordSvForm.svProjectId) { toast.error('Project visited is mandatory'); return; }
    if (!recordSvForm.motivationType) { toast.error('Buying Motivation is mandatory'); return; }
    if (!recordSvForm.latitude) { toast.error('Geo-location is mandatory'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'SM_SITE_VISIT', {
        assignToUserId: recordSvForm.assignToUserId,
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
      toast.success('Site visit recorded and lead moved to selected Sales Head');
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
      await leadWorkflowApi.transitionLead(selectedLead.id, 'TC_SV_DONE', {
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

      await leadWorkflowApi.transitionLead(selectedLead.id, 'SH_BOOKING', {
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
    if (popupAction?.needsCustomerProfile || popupAction?.code === 'SH_BOOKING') {
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

  const resetQuickWorkflowForm = useCallback(() => {
    setQuickWorkflowAction(null);
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
    setQuickWorkflowForm({
      note: '',
      statusRemarkText: '',
      nextFollowUpAt: '',
      assignToUserId: '',
      closureReasonId: '',
      reason: '',
      svDate: '',
      svProjectId: '',
      motivationType: '',
      primaryRequirement: '',
      secondaryRequirement: '',
      latitude: null,
      longitude: null,
      timeSpent: '',
    });
  }, []);

  const runQuickWorkflowAction = useCallback(async (action, payload = {}) => {
    if (!quickActionLead || !action) return;

    setQuickActionLoading(true);
    try {
      await leadWorkflowApi.transitionLead(quickActionLead.id, action.code, payload);
      toast.success(`${action.label} updated successfully`);
      resetQuickWorkflowForm();
      setQuickActionLead(null);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${action.label.toLowerCase()}`));
    } finally {
      setQuickActionLoading(false);
    }
  }, [quickActionLead, loadLeads, resetQuickWorkflowForm]);

  const handleQuickWorkflowActionSelect = async (action) => {
    if (!action) return;

    const targetAssigneeRole = getAssigneeRoleForAction(action, workspaceRole);

    const needsInput = Boolean(
      action.needsFollowUp
      || action.needsAssignee
      || action.needsReason
      || action.needsSvDetails
      || action.needsCustomerProfile
      || action.code === 'TC_SV_DONE'
    );

    if (!needsInput) {
      await runQuickWorkflowAction(action, {});
      return;
    }

    // Apply selection and initialize form first so button/UI responds instantly.
    setQuickWorkflowAction(action);
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
    setQuickWorkflowForm({
      note: '',
      statusRemarkText: '',
      nextFollowUpAt: '',
      assignToUserId: '',
      closureReasonId: '',
      reason: '',
      svDate: new Date().toISOString().split('T')[0],
      svProjectId: quickActionLead?.projectId || '',
      motivationType: quickActionLead?.motivationType || '',
      primaryRequirement: quickActionLead?.primaryRequirement || '',
      secondaryRequirement: quickActionLead?.secondaryRequirement || '',
      latitude: quickActionLead?.geoLat || null,
      longitude: quickActionLead?.geoLong || null,
      timeSpent: '',
    });

    if (action.needsAssignee) {
      loadAssignableUsers(targetAssigneeRole);
    }
    if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
      loadAssignableUsers('COL');
    }

    if (action.needsSvDetails || action.code === 'TC_SV_DONE') {
      loadAssignableUsers(targetAssigneeRole);
      if (!projectOptions.length) loadCreateOptions();
    }

    if (action.needsReason) {
      try {
        // Fetch specific category if not 'LOST', otherwise fetch all active reasons
        const reasonCategory = getClosureReasonCategoryForAction(action);
        const category = reasonCategory === 'LOST' ? '' : (reasonCategory || '');
        const resp = await leadWorkflowApi.getClosureReasons(category);
        setClosureReasons(resp.data?.rows || resp.data || []);
      } catch {
        setClosureReasons([]);
      }
    }

    // Fetch dynamic remarks for the selected action's target status
    if (action.targetStatusCode) {
      try {
        const resp = await statusRemarkApi.getByStatusCode(action.targetStatusCode);
        const remarks = resp.data?.remarks || [];
        setQuickStatusRemarks(remarks);

        // Initialize Ans/Non-Ans based on first remark or action
        if (remarks.length > 0) {
          const firstRemark = remarks[0];
          if (firstRemark.has_ans_non_ans) {
            // Default to the remark's default or 'Answered' if not specified
            setQuickRemarkAnsNonAns(firstRemark.ans_non_ans_default || 'Answered');
          } else {
            setQuickRemarkAnsNonAns(null);
          }
        } else {
          setQuickRemarkAnsNonAns(null);
        }
      } catch (err) {
        console.error('Failed to fetch remarks:', err);
        setQuickStatusRemarks([]);
        setQuickRemarkAnsNonAns(null);
      }
    }

    // Pre-load TCs for reassignment dropdown
    loadAssignableUsers('TC');
  };


  const handleQuickWorkflowSubmit = async () => {
    if (!quickActionLead) return;
    if (!quickWorkflowAction) {
      toast.error('Please select an action button first');
      return;
    }
    setQuickActionLoading(true);

    try {
      const f = quickWorkflowForm;


      // 2. Handle Workflow Transition if action selected
      if (quickWorkflowAction) {
        // Validation: Follow-up date is required for certain actions
        if (quickWorkflowAction.needsFollowUp && !f.nextFollowUpAt) {
          toast.error('Please select a follow-up date');
          setQuickActionLoading(false);
          return;
        }

        if (quickWorkflowAction.needsAssignee && !f.assignToUserId) {
          toast.error(quickWorkflowAction.code === 'TC_SV_DONE' ? 'Please select a Sales Manager' : 'Please select an assignee');
          setQuickActionLoading(false);
          return;
        }

        if (quickWorkflowAction.needsSvDetails && !f.svDate) {
          toast.error('Please select the site visit date');
          setQuickActionLoading(false);
          return;
        }

        if (quickWorkflowAction.needsSvDetails && !f.svProjectId) {
          toast.error('Please select the project visited');
          setQuickActionLoading(false);
          return;
        }

        // Validation: Customer Profile for specific actions
        if (quickWorkflowAction.needsCustomerProfile || quickWorkflowAction.code === 'SH_BOOKING') {
          const cpF = customerProfileForm;
          if (!cpF.date_of_birth || !cpF.pan_number || !cpF.aadhar_number || !cpF.current_address || !cpF.occupation) {
            toast.error('Please fill all mandatory (*) customer profile fields (DOB, PAN, Aadhar, Address, Occupation).');
            setQuickActionLoading(false);
            return;
          }
        }

        // Validation: Reason selection is mandatory for reason-based actions
        if (quickWorkflowAction.needsReason && !f.closureReasonId) {
          toast.error('Please select Reason *');
          setQuickActionLoading(false);
          return;
        }

        const payload = {
          note: f.note.trim() || undefined,
          statusRemarkText: f.statusRemarkText?.trim() || undefined,
          statusRemarkResponseType: quickRemarkAnsNonAns || undefined,
          nextFollowUpAt: f.nextFollowUpAt ? new Date(f.nextFollowUpAt).toISOString() : undefined,
          assignToUserId: f.assignToUserId || undefined,
          closureReasonId: f.closureReasonId || undefined,
          reason: f.reason.trim() || undefined,
          svDate: f.svDate || undefined,
          svProjectId: f.svProjectId || undefined,
          motivationType: f.motivationType || undefined,
          primaryRequirement: f.primaryRequirement || undefined,
          secondaryRequirement: f.secondaryRequirement || undefined,
          latitude: f.latitude || undefined,
          longitude: f.longitude || undefined,
          timeSpent: f.timeSpent || undefined,
        };

        // Enrich payload with customer profile if needed
        if (quickWorkflowAction.needsCustomerProfile || quickWorkflowAction.code === 'SH_BOOKING') {
          const pF = customerProfileForm;
          const permAddr = pF.sameAsCurrent ? {
            permanent_address: pF.current_address,
            permanent_city: pF.current_city,
            permanent_state: pF.current_state,
            permanent_pincode: pF.current_pincode,
          } : {
            permanent_address: pF.permanent_address,
            permanent_city: pF.permanent_city,
            permanent_state: pF.permanent_state,
            permanent_pincode: pF.permanent_pincode,
          };
          payload.customerProfile = {
            date_of_birth: pF.date_of_birth ? new Date(pF.date_of_birth).toISOString() : undefined,
            pan_number: pF.pan_number,
            aadhar_number: pF.aadhar_number,
            occupation: pF.occupation,
            current_post: pF.current_post,
            purchase_type: pF.purchase_type,
            marital_status: pF.marital_status,
            current_address: pF.current_address,
            current_city: pF.current_city,
            current_state: pF.current_state,
            current_pincode: pF.current_pincode,
            ...permAddr,
            assignToUserId: pF.assignToUserId,
            note: pF.note,
          };
        }

        if (quickWorkflowAction.code === 'TC_REASSIGN') {
          if (!f.assignToUserId) {
            toast.error('Please select a telecaller to reassign');
            setQuickActionLoading(false);
            return;
          }
          await leadWorkflowApi.assignLead(quickActionLead.id, f.assignToUserId, f.note.trim() || 'Telecaller manual reassignment');
        } else {
          await leadWorkflowApi.transitionLead(quickActionLead.id, quickWorkflowAction.code, payload);
        }
      }

      toast.success('Lead updated successfully');
      resetQuickWorkflowForm();
      setQuickActionLead(null);
      setSelectedLeadId(null);
      loadLeads({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update lead'));
    } finally {
      setQuickActionLoading(false);
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

      {/* ── Stats (KPI cards) - Hide for Telecaller ── */}
      {workspaceRole !== 'TC' && workspaceRole !== 'SM' && (
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
      )}

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
        {workspaceRole !== 'TC' && (
          <FilterDropdown
            label="Stages"
            options={toolbarStageOptions}
            selectedValues={multiFilters.stageCodes}
            onToggle={(value) => toggleMultiFilter('stageCodes', value)}
            onClear={() => setMultiFilters((prev) => ({ ...prev, stageCodes: [] }))}
          />
        )}
        <FilterDropdown
          label="Statuses"
          options={workspaceRole === 'TC' ? statusOptions.filter(opt => ['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(opt.value)) : statusOptions}
          selectedValues={multiFilters.statusCodes}
          onToggle={(value) => toggleMultiFilter('statusCodes', value)}
          onClear={() => setMultiFilters((prev) => ({ ...prev, statusCodes: [] }))}
        />
        <FilterDropdown
          label="Sources"
          options={sourceFilterOptions}
          selectedValues={multiFilters.sources}
          onToggle={(value) => toggleMultiFilter('sources', value)}
          onClear={() => setMultiFilters((prev) => ({ ...prev, sources: [] }))}
        />
        <button type="button" className="lead-workspace__clear-filters" onClick={clearMultiFilters}>
          Clear All
        </button>
      </div>

      {/* ── Main Grid ── */}
      <div className="lead-workspace__grid">
        {/* Lead List */}
        <div className="lead-workspace__list-card">
          <div className="lead-workspace__list-header">
            <h2>Leads</h2>
            <small>
              {filteredLeads.length}
              {meta.total !== filteredLeads.length ? ` / ${meta.total}` : ''} records
            </small>
          </div>

          {/* Tabs for TC */}
          {workspaceRole === 'TC' && (
            <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', borderBottom: '1px solid var(--border-secondary)' }}>
              <button
                onClick={() => setActiveTab('mine')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'mine' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'mine' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                My Leads
              </button>
              <button
                onClick={() => setActiveTab('new')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'new' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'new' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                New (Unassigned)
              </button>
            </div>
          )}

          <div className="lead-workspace__table-wrap">
            <table className="lead-workspace__table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Medium</th>
                  <th>Project/Location</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="lead-workspace__empty">Loading leads...</td></tr>
                )}
                {!loading && !filteredLeads.length && (
                  <tr><td colSpan={8} className="lead-workspace__empty">No leads found for current filters</td></tr>
                )}
                {!loading && filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/portal/lead/${lead.id}`)}
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
                      <span
                        className={`status-chip ${lead.isClosed ? 'status-chip--closed' : ''}`}
                        style={{ backgroundColor: lead.statusColor + '22', color: lead.statusColor, borderColor: lead.statusColor }}
                      >
                        {lead.statusLabel}
                      </span>
                    </td>
                    <td>
                      <p>{lead.source || '-'}</p>
                    </td>
                    <td>
                      <p>{lead.subSource || '-'}</p>
                    </td>
                    <td>
                      <small>{(() => {
                        const projText = lead.interestedProjects?.length > 0
                          ? lead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean).join(', ')
                          : lead.project;
                        return projText || '-';
                      })()}</small>
                      {(() => {
                        const locText = lead.interestedLocations?.length > 0
                          ? lead.interestedLocations.map((lid) => locationOptions.find((l) => l.id === lid)?.location_name).filter(Boolean).join(', ')
                          : lead.location;
                        return locText ? (
                          <small style={{ display: 'block', color: '#64748b', fontSize: 10 }}>Location: {locText}</small>
                        ) : null;
                      })()}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!lead.assignedToUserId && activeTab === 'new' && (
                        <button
                          className="crm-btn crm-btn-sm"
                          style={{ marginRight: 4, background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await leadWorkflowApi.assignLead(lead.id, user.id, 'Self-assigned from pool');
                              toast.success(`Lead claimed: ${lead.fullName}`);
                              setSelectedLeadId(null);
                              setActiveTab('mine');
                            } catch (err) {
                              toast.error(getErrorMessage(err, 'Failed to claim lead'));
                            }
                          }}
                        >
                          🙋 Claim
                        </button>
                      )}
                      <button
                        className="crm-btn crm-btn-primary crm-btn-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          resetQuickWorkflowForm();
                          setQuickActionLead(lead);
                          // Load site visits for this lead
                          try {
                            const [svResp, actResp] = await Promise.all([
                              siteVisitApi.getAll({ lead_id: lead.id }),
                              leadWorkflowApi.getLeadActivities(lead.id)
                            ]);
                            setQuickActionSiteVisits(svResp.data?.rows || svResp.data || []);
                            setQuickActionActivities(actResp.data || []);
                          } catch {
                            setQuickActionSiteVisits([]);
                            setQuickActionActivities([]);
                          }
                        }}
                      >
                        Action
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
                          {selectedLead.timeSpent != null && (
                            <div className="lead-detail__info-item">
                              <div className="crm-form-label">Time Spent (mins)</div>
                              <div className="lead-detail__info-value">{selectedLead.timeSpent}</div>
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
                          {/* SV Recording moved to roleActions in drawer */}
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
                            // Special modals (SV Done / Site Visit / Closure) go through handleAction
                            if (action.code === 'TC_SV_DONE' || action.needsSvDetails || action.needsReason || action.needsCustomerProfile) {
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
          <div
            className="lead-workspace__modal-panel"
            style={{
              background: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-primary, #e2e8f0)',
              borderRadius: 12,
              width: '100%',
              maxWidth: 780,
              overflow: 'hidden',
              fontFamily: 'inherit',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-primary, #e2e8f0)',
              }}
            >
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #0f172a)', margin: 0 }}>Create New Lead</h2>
              <button
                type="button"
                onClick={() => {
                  setReengageLeadId(null);
                  setNewLeadOpen(false);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: '1px solid var(--border-primary, #e2e8f0)',
                  background: 'var(--bg-secondary, #f8fafc)',
                  color: 'var(--text-secondary, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>

            <form className="lead-workspace__new-form" onSubmit={handleCreateLead} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <SectionLabel>Contact Information</SectionLabel>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.7fr auto', gap: 12, alignItems: 'end', marginBottom: 14 }}>
                <FieldWrap label="Full Name" required>
                  <input
                    value={newLeadForm.full_name}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, full_name: e.target.value }))}
                    required
                    placeholder="Enter buyer full name"
                    style={inputStyle()}
                  />
                </FieldWrap>

                <FieldWrap label="Phone" required>
                  <input
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: e.target.value.replace(/[^0-9+]/g, '') }))}
                    required
                    placeholder="Primary contact number"
                    style={inputStyle(phoneCheck.status === 'exists' ? 'var(--accent-red)' : phoneCheck.status === 'valid' ? 'var(--accent-green)' : undefined)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div>
                      {phoneCheck.status === 'exists' && <span style={validationMsg('error')}>⚠ Exists: {phoneCheck.leadInfo}</span>}
                      {phoneCheck.status === 'valid' && <span style={validationMsg('success')}>✓ Valid</span>}
                    </div>
                    {phoneCheck.status === 'exists' && phoneCheck.duplicateLead && (
                      <button
                        type="button"
                        onClick={() => prefillFormFromDuplicateLead(phoneCheck.duplicateLead)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          background: reengageLeadId === phoneCheck.duplicateLead.id ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f8fafc)',
                          color: reengageLeadId === phoneCheck.duplicateLead.id ? '#fff' : 'var(--accent-blue, #2563eb)',
                          border: reengageLeadId === phoneCheck.duplicateLead.id ? 'none' : '1px solid var(--accent-blue, #2563eb)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {reengageLeadId === phoneCheck.duplicateLead.id ? 'Reengage' : 'Use this lead'}
                      </button>
                    )}
                  </div>
                </FieldWrap>

                <div style={{ height: 36, display: 'flex', alignItems: 'center', paddingBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary, #64748b)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      style={{ width: 14, height: 14, accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                      checked={newLeadForm.whatsappSameAsPhone}
                      onChange={(e) =>
                        setNewLeadForm((p) => ({
                          ...p,
                          whatsappSameAsPhone: e.target.checked,
                          whatsapp_number: e.target.checked ? '' : p.whatsapp_number,
                        }))
                      }
                    />
                    WhatsApp same as phone
                  </label>
                </div>
              </div>

              {!newLeadForm.whatsappSameAsPhone && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <FieldWrap label="WhatsApp Number">
                    <input
                      value={newLeadForm.whatsapp_number}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, whatsapp_number: e.target.value.replace(/[^0-9+]/g, '') }))}
                      placeholder="Enter WhatsApp number"
                      style={inputStyle()}
                    />
                  </FieldWrap>
                  <div />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, alignItems: 'start' }}>
                <FieldWrap label="Alternate Phone" optional>
                  <input
                    value={newLeadForm.alternate_phone}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, alternate_phone: e.target.value.replace(/[^0-9+]/g, '') }))}
                    placeholder="Secondary contact"
                    style={inputStyle(altPhoneCheck.status === 'exists' ? 'var(--accent-red)' : altPhoneCheck.status === 'valid' ? 'var(--accent-green)' : undefined)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div>
                      {altPhoneCheck.status === 'exists' && <span style={validationMsg('error')}>⚠ Already exists: {altPhoneCheck.leadInfo}</span>}
                      {altPhoneCheck.status === 'valid' && <span style={validationMsg('success')}>✓ Valid Number</span>}
                    </div>
                    {altPhoneCheck.status === 'exists' && altPhoneCheck.duplicateLead && (
                      <button
                        type="button"
                        onClick={() => prefillFormFromDuplicateLead(altPhoneCheck.duplicateLead)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          background: reengageLeadId === altPhoneCheck.duplicateLead.id ? 'var(--accent-blue, #2563eb)' : 'var(--bg-secondary, #f8fafc)',
                          color: reengageLeadId === altPhoneCheck.duplicateLead.id ? '#fff' : 'var(--accent-blue, #2563eb)',
                          border: reengageLeadId === altPhoneCheck.duplicateLead.id ? 'none' : '1px solid var(--accent-blue, #2563eb)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {reengageLeadId === altPhoneCheck.duplicateLead.id ? 'Reengage' : 'Use this lead'}
                      </button>
                    )}
                  </div>
                </FieldWrap>

                <FieldWrap label="Email" optional>
                  <input
                    type="email"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    style={inputStyle()}
                  />
                </FieldWrap>
              </div>

              <SectionLabel>Lead Classification</SectionLabel>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FieldWrap label="Lead Status" required>
                  {workspaceRole === 'TC' ? (
                    <select
                      value={newLeadForm.lead_status_id}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_status_id: e.target.value }))}
                      required
                      style={selectStyle(!newLeadForm.lead_status_id ? '#fca5a5' : undefined)}
                    >
                      <option value="">Select status</option>
                      {statusOptions.filter((st) => ['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED', 'LOST', 'JUNK', 'SPAM'].includes(st.value)).map((st) => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={newLeadForm.lead_status_id}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_status_id: e.target.value }))}
                      style={selectStyle()}
                    >
                      <option value="">Select status</option>
                      {statusOptions.map((st) => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  )}
                </FieldWrap>
                <div />
              </div>

              {['LOST', 'JUNK', 'SPAM'].includes(statusOptions.find((s) => s.id === newLeadForm.lead_status_id || s.value === newLeadForm.lead_status_id)?.value) && (
                <div style={{ background: 'var(--accent-red-bg, #fef2f2)', border: '1px solid var(--accent-red, #ef4444)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--accent-red, #ef4444)', textTransform: 'uppercase', marginBottom: 10 }}>
                    Closure Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FieldWrap label="Closure Reason" required>
                      <select
                        value={newLeadForm.closure_reason_id}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, closure_reason_id: e.target.value })}
                        style={selectStyle()}
                      >
                        <option value="">Select reason...</option>
                        {closureReasons.map((r) => (
                          <option key={r.id} value={r.id}>{r.reason_name}</option>
                        ))}
                      </select>
                    </FieldWrap>

                    <FieldWrap label="Remarks / Context" required>
                      <textarea
                        rows={1}
                        value={newLeadForm.remark}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, remark: e.target.value })}
                        placeholder="Why is this lead being closed/disqualified?"
                        style={{ ...inputStyle(), height: 36, resize: 'none', padding: '8px 10px' }}
                      />
                    </FieldWrap>
                  </div>
                </div>
              )}

              <SectionLabel>Location &amp; Projects</SectionLabel>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FieldWrap label="Location" required>
                  <select
                    value={newLeadForm.location_id}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, location_id: e.target.value, project_ids: [] }))}
                    required
                    style={selectStyle()}
                  >
                    <option value="">Select location</option>
                    {locationOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.location_name}{loc.city ? `, ${loc.city}` : ''}</option>
                    ))}
                  </select>
                </FieldWrap>

                <FieldWrap label="Project" required>
                  <div ref={projectDropdownRef} style={{ position: 'relative' }}>
                    <div
                      onClick={() => setProjectDropdownOpen((p) => !p)}
                      style={{ cursor: 'pointer', minHeight: 36, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '0 10px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 7, background: 'var(--bg-primary, #fff)', fontSize: 12.5 }}
                    >
                      {selectedProjectNames.length === 0 && <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>Select projects...</span>}
                      {selectedProjectNames.map((name, i) => (
                        <span key={i} style={{ background: 'var(--accent-blue-bg, #dbeafe)', color: 'var(--accent-blue, #2563eb)', padding: '2px 7px', borderRadius: 10, fontSize: 10.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          {name}
                          <span onClick={(ev) => { ev.stopPropagation(); toggleProject((newLeadForm.project_ids || [])[i]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1, color: 'var(--accent-blue, #2563eb)' }}>×</span>
                        </span>
                      ))}
                    </div>

                    {projectDropdownOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxHeight: 240, marginTop: 4 }}>
                        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                          <input
                            type="text"
                            placeholder="Search projects..."
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: '100%', height: 32, padding: '0 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)', outline: 'none' }}
                          />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto', padding: '6px 8px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                          {filteredProjectOptions.map((project) => (
                            <label key={project.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary, #0f172a)', cursor: 'pointer', padding: '5px 6px', borderRadius: 5 }}>
                              <input
                                type="checkbox"
                                style={{ width: 13, height: 13, accentColor: '#3b82f6', cursor: 'pointer', flexShrink: 0 }}
                                checked={(newLeadForm.project_ids || []).includes(project.id)}
                                onChange={() => toggleProject(project.id)}
                              />
                              <span>
                                {project.project_name}
                                {project.project_code ? ` (${project.project_code})` : ''}
                              </span>
                            </label>
                          ))}
                          {filteredProjectOptions.length === 0 && (
                            <div style={{ padding: 12, color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center', gridColumn: '1/-1' }}>No projects found</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </FieldWrap>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <FieldWrap label="Lead Source" required>
                  <select
                    value={newLeadForm.lead_source_id}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_source_id: e.target.value, lead_sub_source_id: '' }))}
                    required
                    style={selectStyle()}
                  >
                    <option value="">Select lead source</option>
                    {sourceOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.source_name}</option>
                    ))}
                  </select>
                </FieldWrap>

                <FieldWrap label={`Lead Sub-Source${workspaceRole === 'TC' ? '' : ''}`} required={workspaceRole === 'TC'}>
                  <select
                    value={newLeadForm.lead_sub_source_id}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))}
                    disabled={!newLeadForm.lead_source_id || !selectedSourceSubSources.length}
                    required={workspaceRole === 'TC'}
                    style={selectStyle(
                      workspaceRole === 'TC' && newLeadForm.lead_source_id && !newLeadForm.lead_sub_source_id ? '#fca5a5' : undefined,
                      !newLeadForm.lead_source_id || !selectedSourceSubSources.length
                    )}
                  >
                    <option value="">Select sub-source</option>
                    {selectedSourceSubSources.map((s) => (
                      <option key={s.id} value={s.id}>{s.sub_source_name}</option>
                    ))}
                  </select>
                </FieldWrap>
              </div>

              <SectionLabel>Budget</SectionLabel>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: 8 }}>
                  Budget Range: {budgetLabel(newLeadForm.budgetMinIdx || 0)} - {budgetLabel(newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL)}
                </div>
                <div style={{ position: 'relative', height: 42, display: 'flex', alignItems: 'center', padding: 0, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 8, right: 8, height: 6, borderRadius: 3, background: 'var(--border-primary, #e2e8f0)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      left: `calc(8px + ${((newLeadForm.budgetMinIdx || 0) / BUDGET_MAX_VAL)} * (100% - 16px))`,
                      right: `calc(8px + ${(1 - ((newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL) / BUDGET_MAX_VAL))} * (100% - 16px))`,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--accent-blue, #3b82f6)',
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={BUDGET_MAX_VAL}
                    value={newLeadForm.budgetMinIdx || 0}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value), (newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL) - 1);
                      setNewLeadForm((p) => ({
                        ...p,
                        budgetMinIdx: v,
                        budgetMin: BUDGET_STEPS[v] * 100000,
                        budgetRange: `${budgetLabel(v)} - ${budgetLabel(p.budgetMaxIdx ?? BUDGET_MAX_VAL)}`,
                      }));
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 42, opacity: 0, cursor: 'pointer', zIndex: 3 }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={BUDGET_MAX_VAL}
                    value={newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL}
                    onChange={(e) => {
                      const v = Math.max(Number(e.target.value), (newLeadForm.budgetMinIdx || 0) + 1);
                      setNewLeadForm((p) => ({
                        ...p,
                        budgetMaxIdx: v,
                        budgetMax: BUDGET_STEPS[v] * 100000,
                        budgetRange: `${budgetLabel(p.budgetMinIdx || 0)} - ${budgetLabel(v)}`,
                      }));
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 42, opacity: 0, cursor: 'pointer', zIndex: 4 }}
                  />
                  <div style={{ position: 'absolute', left: `calc(8px + ${((newLeadForm.budgetMinIdx || 0) / BUDGET_MAX_VAL)} * (100% - 16px))`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue, #3b82f6)', border: '3px solid var(--bg-card, #fff)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', zIndex: 5, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: `calc(8px + ${((newLeadForm.budgetMaxIdx ?? BUDGET_MAX_VAL) / BUDGET_MAX_VAL)} * (100% - 16px))`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue, #3b82f6)', border: '3px solid var(--bg-card, #fff)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', zIndex: 5, pointerEvents: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary, #94a3b8)', padding: '0 8px' }}>
                  {BUDGET_STEPS.filter((_, i) => i % 2 === 0).map((v) => <span key={v}>{v >= 50 ? '50L+' : `${v}L`}</span>)}
                </div>
              </div>

              <SectionLabel>Follow-Up &amp; Assignment</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, alignItems: 'start' }}>
                {workspaceRole === 'TC' &&
                  !['LOST', 'JUNK', 'SPAM', 'COLD_LOST'].includes(
                    statusOptions.find((s) => s.id === newLeadForm.lead_status_id || s.value === newLeadForm.lead_status_id)?.value
                  ) && (
                    <FieldWrap label="Next Follow-Up Date" required>
                      <CalendarPicker
                        type="date"
                        value={newLeadForm.nextFollowUpAt}
                        onChange={(val) => setNewLeadForm((p) => ({ ...p, nextFollowUpAt: val }))}
                        placeholder="Select follow-up date..."
                        minDate={new Date().toISOString()}
                      />
                    </FieldWrap>
                  )}

                {workspaceRole === 'TC' && (
                  <FieldWrap label="Assign To">
                    <select
                      value={newLeadForm.assigned_to}
                      onChange={(e) => setNewLeadForm((p) => ({ ...p, assigned_to: e.target.value }))}
                      style={selectStyle()}
                    >
                      <option value="">- Unassigned (new lead pool) -</option>
                      <option value="self">Assign to Me</option>
                    </select>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary, #64748b)', marginTop: 3, display: 'block', minHeight: 14 }}>Leave unassigned to add to pool</span>
                  </FieldWrap>
                )}
              </div>

              <SectionLabel>Notes &amp; Remarks</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {NEW_LEAD_REMARK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNewLeadForm((p) => ({ ...p, remark: chip }))}
                    style={{
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 20,
                      border: '1px solid var(--border-primary, #e2e8f0)',
                      background: newLeadForm.remark === chip ? 'var(--accent-blue-bg, #dbeafe)' : 'var(--bg-secondary, #f8fafc)',
                      color: newLeadForm.remark === chip ? 'var(--accent-blue, #2563eb)' : 'var(--text-secondary, #64748b)',
                      borderColor: newLeadForm.remark === chip ? 'var(--accent-blue, #3b82f6)' : 'var(--border-primary, #e2e8f0)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                      lineHeight: 1.3,
                    }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={newLeadForm.remark}
                onChange={(e) => setNewLeadForm((p) => ({ ...p, remark: e.target.value }))}
                placeholder="Add notes or remarks..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--border-primary, #e2e8f0)',
                  background: 'var(--bg-primary, #fff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: 12.5,
                  minHeight: 64,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  marginBottom: 4,
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 16, marginTop: 6, borderTop: '1px solid var(--border-primary, #e2e8f0)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setReengageLeadId(null);
                    setNewLeadOpen(false);
                  }}
                  style={{ height: 36, padding: '0 20px', borderRadius: 8, border: '1px solid var(--border-primary, #e2e8f0)', background: 'var(--bg-secondary, #f8fafc)', color: 'var(--text-secondary, #64748b)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    creating
                    || ((phoneCheck.status === 'exists' || altPhoneCheck.status === 'exists')
                      && ![
                        phoneCheck.duplicateLead?.id,
                        altPhoneCheck.duplicateLead?.id,
                      ].filter(Boolean).includes(reengageLeadId))
                    || (workspaceRole === 'TC' && !newLeadForm.lead_status_id)
                  }
                  style={{ height: 36, padding: '0 20px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {creating ? 'Creating...' : 'Create Lead'}
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
                Select Sales Head (Negotiator) *
                <select
                  value={recordSvForm.assignToUserId}
                  onChange={(e) => setRecordSvForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="">Select Sales Head...</option>
                  {(assignableUsers.SH || []).map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                  ))}
                </select>
                <small style={{ display: 'block', marginTop: 4, color: 'var(--text-muted)' }}>
                  Any Sales Manager can log visit details; lead ownership does not move to that SM. Lead will transfer to selected Sales Head.
                </small>
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
                  disabled={!recordSvForm.assignToUserId || !recordSvForm.latitude || !recordSvForm.svProjectId || !recordSvForm.motivationType}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
              </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  City
                  <input type="text" value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  State
                  <input type="text" value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                </label>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Pincode
                <input type="text" maxLength={6} value={customerProfileForm.current_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_pincode: e.target.value.replace(/\D/g, '') }))} style={{ width: '100%', marginTop: 4 }} />
              </label>

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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      City
                      <input type="text" value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      State
                      <input type="text" value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))} style={{ width: '100%', marginTop: 4 }} />
                    </label>
                  </div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Pincode
                    <input type="text" maxLength={6} value={customerProfileForm.permanent_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_pincode: e.target.value.replace(/\D/g, '') }))} style={{ width: '100%', marginTop: 4 }} />
                  </label>
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

      {/* Quick Action Drawer Modal */}
      {quickActionLead && (
        <div className="lead-workspace__modal" role="dialog" aria-modal="true" onClick={() => {
          setQuickActionLead(null);
              resetQuickWorkflowForm();
        }}>
          <div className="qa-modal-panel" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Handle */}
            <div className="qa-drawer-handle" />

            {/* ── Drawer Header: Avatar + Name + Meta + Close ── */}
            <div className="qa-drawer-header">
              <div className="qa-drawer-header-left">
                <div
                  className="qa-drawer-avatar"
                  style={{
                    background: '#E3EEFB',
                    color: '#1A5FA8',
                  }}
                >
                  {(quickActionLead.fullName || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="qa-drawer-name">{quickActionLead.fullName}</div>
                  <div className="qa-drawer-meta">
                    {quickActionLead.phone}
                    {quickActionLead.project ? ` · ${quickActionLead.project}` : ''}
                    {quickActionLead.location ? ` - ${quickActionLead.location}` : ''}
                  </div>
                  <div className="qa-drawer-budget">
                    {quickActionLead.source || 'No Source'}
                    {quickActionLead.subSource ? ` · ${quickActionLead.subSource}` : ''}
                    {(quickActionLead.budgetMin || quickActionLead.budgetMax) && (
                      <span style={{ opacity: 0.8, marginLeft: 8 }}>
                        ({quickActionLead.budgetMin ? formatCurrency(quickActionLead.budgetMin) : ''}{quickActionLead.budgetMax ? `–${formatCurrency(quickActionLead.budgetMax)}` : ''})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="qa-header-comms">
                  <button 
                    className="qa-header-icon-btn"
                    title="Call Now"
                    onClick={() => window.open(`tel:${quickActionLead.phone}`)}
                  >
                    📞
                  </button>
                  <button 
                    className="qa-header-icon-btn"
                    title="WhatsApp"
                    onClick={() => window.open(`https://wa.me/${(quickActionLead.whatsappNumber || quickActionLead.phone || '').replace(/\D/g, '')}`, '_blank')}
                  >
                    💬
                  </button>
                </div>
                <button
                  className="qa-drawer-close"
                  onClick={() => {
                    setQuickActionLead(null);
                    resetQuickWorkflowForm();
                  }}
                >
                  ✕
                </button>
              </div>
            </div>



            {/* ── Scrollable Drawer Body ── */}
            <div className="qa-drawer-body">

              {/* ── Update Status (Status Grid) ── */}
              {!quickActionLead.isClosed && (
                <>
                  <div className="qa-drawer-section">Update status</div>
                  <div className="qa-drawer-status-grid">
                    {roleActions.filter(a => a.tone !== 'danger').map((action) => {
                      let icon = '📋';
                      let selClass = 'sel-default';
                      if (action.code.includes('RNR')) { icon = '🔄'; selClass = 'sel-rnr'; }
                      else if (action.code.includes('SV_DONE') || action.code.includes('SITE_VISIT')) { icon = '✅'; selClass = 'sel-sv-done'; }
                      else if (action.code.includes('SCHEDULE') || action.code.includes('REVISIT')) { icon = '📅'; selClass = 'sel-sv-scheduled'; }
                      else if (action.code.includes('FOLLOW_UP')) { icon = '📞'; selClass = 'sel-follow-up'; }
                      else if (action.code.includes('NEGOTIATION')) { icon = '🤝'; selClass = 'sel-negotiation'; }
                      else if (action.code.includes('BOOKING')) { icon = '🎉'; selClass = 'sel-booking'; }
                      else if (action.code.includes('PAYMENT')) { icon = '💸'; selClass = 'sel-booking'; }
                      else if (action.code.includes('REASSIGN')) { icon = '👤'; selClass = 'sel-follow-up'; }

                      return (
                        <button
                          key={action.code}
                          type="button"
                          className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? selClass : ''}`}
                          disabled={quickActionLoading}
                          onClick={() => handleQuickWorkflowActionSelect(action)}
                        >
                          <div className="qa-drawer-st-icon">{icon}</div>
                          <div className="qa-drawer-st-label">{action.label}</div>
                        </button>
                      );
                    })}
                    {/* Danger / Disqualification actions in the grid */}
                    {roleActions.filter(a => a.tone === 'danger').map((action) => (
                      <button
                        key={action.code}
                        type="button"
                        className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? 'sel-junk' : ''}`}
                        disabled={quickActionLoading}
                        onClick={() => handleQuickWorkflowActionSelect(action)}
                      >
                        <div className="qa-drawer-st-icon">{action.code.includes('JUNK') ? '🚫' : action.code.includes('SPAM') ? '🗑️' : '⚠️'}</div>
                        <div className="qa-drawer-st-label">{action.label}</div>
                      </button>
                    ))}
                  </div>

                </>
              )}

              {/* ── Dynamic Form: Shows only after selecting a status ── */}
              {quickWorkflowAction && (
                <div style={{ animation: 'qa-fade-in 0.3s ease' }}>
                  {/* ── Contextual: Follow-up Date (when action needs follow-up) ── */}
                  {quickWorkflowAction?.needsFollowUp && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Next follow-up date</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(0, 14, 0) }))}>Today 2PM</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today 6PM</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tmrw 11AM</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(2, 11, 0) }))}>In 2 days</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickWorkflowForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(7, 11, 0) }))}>Next week</button>
                      </div>
                      <CalendarPicker
                        type="datetime"
                        value={quickWorkflowForm.nextFollowUpAt}
                        onChange={(val) => setQuickWorkflowForm((p) => ({ ...p, nextFollowUpAt: val }))}
                        placeholder="Select follow-up date & time..."
                        minDate={new Date().toISOString()}
                      />
                    </div>
                  )}

                  {/* ── Contextual: Closure Reason (when action needs reason) ── */}
                  {quickWorkflowAction?.needsReason && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Reason *</div>
                      <select
                        className="qa-drawer-field-select"
                        value={quickWorkflowForm.closureReasonId}
                        onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                        style={{ width: '100%', marginBottom: 8 }}
                      >
                        <option value="">Select a reason...</option>
                        {closureReasons.map(r => (
                          <option key={r.id} value={r.id}>{r.reason_name || r.reason_text || r.reason}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ── Contextual: Assignee (when action needs assignee or SV details) ── */}
                  {(quickWorkflowAction?.needsAssignee || quickWorkflowAction?.needsSvDetails || quickWorkflowAction?.code === 'TC_SV_DONE') && (
                    <div className="qa-drawer-ctx-block">
                      <label className="qa-drawer-field-label">
                        {getAssigneeRoleForAction(quickWorkflowAction, workspaceRole) === 'SH' ? 'Select Sales Head (Negotiator) *' : 'Assign To *'}
                      </label>
                      <select
                        className="qa-drawer-field-select"
                        value={quickWorkflowForm.assignToUserId}
                        onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                        style={{ width: '100%' }}
                      >
                        <option value="">
                          {getAssigneeRoleForAction(quickWorkflowAction, workspaceRole) === 'SH' ? 'Select Sales Head...' :
                           getAssigneeRoleForAction(quickWorkflowAction, workspaceRole) === 'COL' ? 'Select Collection Manager...' : 'Select user...'}
                        </option>
                        {(assignableUsers[getAssigneeRoleForAction(quickWorkflowAction, workspaceRole)] || [])
                          .filter((u) => {
                            if (quickWorkflowAction?.code !== 'TC_REASSIGN') return true;
                            const currentAssigneeId = quickActionLead?.assignedToUserId || selectedLead?.assignedToUserId || null;
                            return !currentAssigneeId || u.id !== currentAssigneeId;
                          })
                          .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}
                          </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* ── Contextual: Site Visit Details ── */}
                  {(quickWorkflowAction?.needsSvDetails || quickWorkflowAction?.code === 'TC_SV_DONE') && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Visit details</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Visit Date *</label>
                          <input
                            type="date"
                            className="qa-drawer-field-input"
                            value={quickWorkflowForm.svDate}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, svDate: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Project *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickWorkflowForm.svProjectId}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, svProjectId: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {projectOptions.map((p) => (
                              <option key={p.id} value={p.id}>{p.project_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && (
                        <>
                          <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                              <label className="qa-drawer-field-label">Motivation</label>
                              <select
                                className="qa-drawer-field-select"
                                value={quickWorkflowForm.motivationType}
                                onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, motivationType: e.target.value }))}
                                style={{ width: '100%' }}
                              >
                                <option value="">Select...</option>
                                <option value="End Use">End Use</option>
                                <option value="Investment">Investment</option>
                                <option value="Rental">Rental</option>
                                <option value="Expansion">Expansion</option>
                                <option value="Gift">Gift</option>
                              </select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <label className="qa-drawer-field-label">Time Spent (min)</label>
                              <input
                                type="number"
                                className="qa-drawer-field-input"
                                placeholder="e.g. 45"
                                value={quickWorkflowForm.timeSpent}
                                onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, timeSpent: e.target.value }))}
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <label className="qa-drawer-field-label">Requirement (Primary)</label>
                            <input
                              type="text"
                              className="qa-drawer-field-input"
                              placeholder="e.g. 3BHK, East facing"
                              value={quickWorkflowForm.primaryRequirement}
                              onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, primaryRequirement: e.target.value }))}
                              style={{ width: '100%' }}
                            />
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <label className="qa-drawer-field-label">Requirements / Remarks</label>
                            <textarea
                              className="qa-drawer-remark-ta"
                              rows={2}
                              placeholder="Specific preferences, configuration, budget notes..."
                              value={quickWorkflowForm.secondaryRequirement}
                              onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, secondaryRequirement: e.target.value }))}
                            />
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <label className="qa-drawer-field-label" style={{ marginBottom: 0 }}>Geo-Location</label>
                              <button
                                type="button"
                                className="qa-drawer-rchip"
                                style={{ fontSize: '10px', padding: '4px 10px' }}
                                onClick={() => {
                                  if (navigator.geolocation) {
                                    navigator.geolocation.getCurrentPosition((pos) => {
                                      setQuickWorkflowForm(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                                      toast.success('Location captured!');
                                    }, () => toast.error('Check location permissions'));
                                  }
                                }}
                              >
                                🎯 Get Position
                              </button>
                            </div>
                            <div className="qa-drawer-field-row">
                              <input type="number" step="any" placeholder="Latitude" className="qa-drawer-field-input"
                                value={quickWorkflowForm.latitude || ''}
                                onChange={(e) => setQuickWorkflowForm(p => ({ ...p, latitude: e.target.value }))}
                              />
                              <input type="number" step="any" placeholder="Longitude" className="qa-drawer-field-input"
                                value={quickWorkflowForm.longitude || ''}
                                onChange={(e) => setQuickWorkflowForm(p => ({ ...p, longitude: e.target.value }))}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Contextual: Customer Profile ── */}
                  {(quickWorkflowAction?.needsCustomerProfile || quickWorkflowAction?.code === 'SH_BOOKING') && (
                    <div className="qa-drawer-profile-block">
                      <div className="qa-drawer-profile-section">🏆 Customer Profile Details</div>

                      <div className="qa-drawer-profile-section">👤 Personal Details</div>
                      <div className="qa-drawer-profile-grid-3">
                        <div>
                          <label className="qa-drawer-field-label">Date of Birth *</label>
                          <input type="date" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.date_of_birth} onChange={(e) => setCustomerProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Marital Status</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.marital_status} onChange={(e) => setCustomerProfileForm(p => ({ ...p, marital_status: e.target.value }))}>
                            <option value="">Select...</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Purchase Type</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.purchase_type} onChange={(e) => setCustomerProfileForm(p => ({ ...p, purchase_type: e.target.value }))}>
                            <option value="">Select...</option>
                            <option value="Investment">Investment</option>
                            <option value="Self Use">Self Use</option>
                            <option value="Rental">Rental</option>
                            <option value="Gift">Gift</option>
                          </select>
                        </div>
                      </div>
                      <div className="qa-drawer-profile-grid">
                        <div>
                          <label className="qa-drawer-field-label">Occupation *</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.occupation} onChange={(e) => setCustomerProfileForm(p => ({ ...p, occupation: e.target.value }))} placeholder="e.g. Business, Salaried" />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Current Post</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_post} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_post: e.target.value }))} placeholder="e.g. Manager" />
                        </div>
                      </div>

                      <div className="qa-drawer-profile-section">🪪 Identity Documents</div>
                      <div className="qa-drawer-profile-grid">
                        <div>
                          <label className="qa-drawer-field-label">PAN Number *</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%', textTransform: 'uppercase' }} maxLength={10} value={customerProfileForm.pan_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Aadhar Number *</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} maxLength={12} value={customerProfileForm.aadhar_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, aadhar_number: e.target.value.replace(/\D/g, '') }))} placeholder="1234 5678 9012" />
                        </div>
                      </div>

                      <div className="qa-drawer-profile-section">📍 Current Address *</div>
                      <div>
                        <label className="qa-drawer-field-label">Address</label>
                        <textarea className="qa-drawer-remark-ta" rows={2} value={customerProfileForm.current_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_address: e.target.value }))} placeholder="Street address..." />
                      </div>
                      <div className="qa-drawer-profile-grid-3">
                        <div>
                          <label className="qa-drawer-field-label">City</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">State</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Pincode</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} maxLength={6} value={customerProfileForm.current_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_pincode: e.target.value.replace(/\D/g, '') }))} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="qa-drawer-profile-section" style={{ flex: 1, marginBottom: 0 }}>🏠 Permanent Address</div>
                        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input type="checkbox" checked={customerProfileForm.sameAsCurrent} onChange={(e) => setCustomerProfileForm(p => ({ ...p, sameAsCurrent: e.target.checked }))} /> Same as Current
                        </label>
                      </div>
                      {!customerProfileForm.sameAsCurrent && (
                        <>
                          <div>
                            <label className="qa-drawer-field-label">Address</label>
                            <textarea className="qa-drawer-remark-ta" rows={2} value={customerProfileForm.permanent_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_address: e.target.value }))} />
                          </div>
                          <div className="qa-drawer-profile-grid-3">
                            <div>
                              <label className="qa-drawer-field-label">City</label>
                              <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} />
                            </div>
                            <div>
                              <label className="qa-drawer-field-label">State</label>
                              <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))} />
                            </div>
                            <div>
                              <label className="qa-drawer-field-label">Pincode</label>
                              <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} maxLength={6} value={customerProfileForm.permanent_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_pincode: e.target.value.replace(/\D/g, '') }))} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Quick Remarks (secondary fields shown after action-required fields) ── */}
                  {quickStatusRemarks.length > 0 && (
                    <>
                      <div className="qa-drawer-section">Quick remarks — tap to fill</div>
                      <div className="qa-drawer-rchip-row">
                        {quickStatusRemarks.map(remark => (
                          <button
                            key={remark.id}
                            type="button"
                            className={`qa-drawer-rchip ${quickWorkflowForm.statusRemarkText === remark.remark_text ? 'sel' : ''}`}
                            onClick={() => {
                              setQuickWorkflowForm(p => ({ ...p, statusRemarkText: remark.remark_text, note: remark.remark_text }));
                              if (remark.has_ans_non_ans) {
                                setQuickRemarkAnsNonAns(remark.ans_non_ans_default || quickRemarkAnsNonAns || 'Answered');
                              } else {
                                setQuickRemarkAnsNonAns(null);
                              }
                            }}
                          >
                            {remark.remark_text}
                          </button>
                        ))}
                      </div>

                      {/* ── Ans/Non-Ans Toggle (if needed) ── */}
                      {quickStatusRemarks.some(r => r.has_ans_non_ans) && (
                        <div style={{ margin: '10px 0', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Response Type:</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              style={{
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 600,
                                border: quickRemarkAnsNonAns === 'Answered' ? '2px solid #0F7B5C' : '1px solid var(--border-primary)',
                                background: quickRemarkAnsNonAns === 'Answered' ? '#E0F4EE' : 'transparent',
                                color: quickRemarkAnsNonAns === 'Answered' ? '#0F7B5C' : 'var(--text-primary)',
                                borderRadius: 4,
                                cursor: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 'not-allowed' : 'pointer',
                                opacity: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 0.5 : 1,
                              }}
                              disabled={quickStatusRemarks.some(r => r.ans_non_ans_disabled)}
                              onClick={() => setQuickRemarkAnsNonAns('Answered')}
                            >
                              ✓ Answered
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 600,
                                border: quickRemarkAnsNonAns === 'Not-Answered' ? '2px solid #B45309' : '1px solid var(--border-primary)',
                                background: quickRemarkAnsNonAns === 'Not-Answered' ? '#FEF3C7' : 'transparent',
                                color: quickRemarkAnsNonAns === 'Not-Answered' ? '#B45309' : 'var(--text-primary)',
                                borderRadius: 4,
                                cursor: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 'not-allowed' : 'pointer',
                                opacity: quickStatusRemarks.some(r => r.ans_non_ans_disabled) ? 0.5 : 1,
                              }}
                              disabled={quickStatusRemarks.some(r => r.ans_non_ans_disabled)}
                              onClick={() => setQuickRemarkAnsNonAns('Not-Answered')}
                            >
                              ✗ Not Answered
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="qa-drawer-remark-wrap">
                    <textarea
                      className="qa-drawer-remark-ta"
                      rows={2}
                      value={quickWorkflowForm.note}
                      onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, note: e.target.value }))}
                      placeholder="What was discussed? What's the next step?"
                    />
                  </div>
                </div>
              )}



              <div className="qa-drawer-divider" />

              {/* ── Lead Activity Timeline ── */}
              <div className="qa-drawer-section">Lead Activity</div>
              <div className="qa-drawer-history">
                {quickActionActivities.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No history yet.</p>
                ) : (
                  quickActionActivities.slice(0, 5).map((act, i) => {
                    const isStage = act.type === 'STAGE_CHANGE';
                    const isNote = act.type === 'NOTE_ADDED';
                    const dotColor = isStage ? '#5B3FA6' : isNote ? '#B45309' : '#1A5FA8';
                    const dotBg = isStage ? '#EEE9FC' : isNote ? '#FEF3C7' : '#E3EEFB';
                    return (
                      <div key={act.id} className="qa-drawer-hist-item">
                        <div className="qa-drawer-hist-col">
                          <div className="qa-drawer-hist-dot" style={{ background: dotBg, borderColor: dotColor }} />
                          {i < Math.min(quickActionActivities.length, 5) - 1 && <div className="qa-drawer-hist-line" />}
                        </div>
                        <div className="qa-drawer-hist-right">
                          <div className="qa-drawer-hist-header">
                            <span className="qa-drawer-hist-status" style={{ color: dotColor }}>{act.title}</span>
                            <span className="qa-drawer-hist-date">{formatDateTime(act.at || act.created_at)}</span>
                          </div>
                          {act.description && <div className="qa-drawer-hist-remark">{act.description}</div>}
                          {act.metadata?.statusRemarkResponseType && (
                            <div className="qa-drawer-hist-remark" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              Response: {act.metadata.statusRemarkResponseType}
                            </div>
                          )}
                          <div className="qa-drawer-hist-by">By {act.by || 'System'}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Site Visit History ── */}
              {quickActionSiteVisits.length > 0 && (
                <>
                  <div className="qa-drawer-divider" />
                  <div className="qa-drawer-section">🏠 Recent site visits</div>
                  <div style={{ padding: '0 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {quickActionSiteVisits.slice(0, 4).map((sv) => (
                      <div key={sv.id} style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <strong style={{ fontSize: 12 }}>{sv.project?.project_name || 'Unknown'}</strong>
                          <span style={{ fontSize: 10, color: sv.status === 'Completed' ? '#0F7B5C' : '#B45309', fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: sv.status === 'Completed' ? '#E0F4EE' : '#FEF3C7' }}>{sv.status}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                          {sv.actual_visit_date ? `✓ ${formatDateTime(sv.actual_visit_date)}` : `📅 ${formatDateTime(sv.scheduled_date)}`}
                        </div>
                        {sv.attendedBy && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3 }}>
                            By {sv.attendedBy.first_name} {sv.attendedBy.last_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {quickActionSiteVisits.length > 4 && (
                    <div style={{ textAlign: 'center', paddingBottom: 10, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      +{quickActionSiteVisits.length - 4} more
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Save Row (sticky bottom) ── */}
            <div className="qa-drawer-save-row">
              <button
                className="qa-drawer-skip-btn"
                onClick={() => {
                  setQuickActionLead(null);
                              resetQuickWorkflowForm();
                }}
              >
               Close
              </button>
              <button
                className="qa-drawer-save-btn"
                disabled={
                  quickActionLoading
                  || !quickWorkflowAction
                  || ((quickWorkflowAction?.needsAssignee
                    || quickWorkflowAction?.code === 'TC_SV_DONE'
                    || quickWorkflowAction?.code === 'TC_REASSIGN')
                    && !quickWorkflowForm.assignToUserId)
                  || (quickWorkflowAction?.needsFollowUp && !quickWorkflowForm.nextFollowUpAt)
                  || (quickWorkflowAction?.needsReason && !quickWorkflowForm.closureReasonId)
                }
                onClick={handleQuickWorkflowSubmit}
              >
                {quickActionLoading ? 'Saving...' : 'Save & next lead →'}
              </button>
            </div>
          </div>
        </div>
        )}
    </section>
  );
};

export default LeadWorkspacePage;
