import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import customerTypeApi from '../../../api/customerTypeApi';
import motivationApi from '../../../api/motivationApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import siteVisitApi from '../../../api/siteVisitApi';
import statusRemarkApi from '../../../api/statusRemarkApi';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
// userApi import removed — TC locations now fetched via leadWorkflowApi.getMyMappedLocations
// customerTypeApi removed — Customer Type field removed from TC lead creation
import { formatCurrency, formatDateTime, formatDateTimeInTimeZone } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';

import {
  getWorkspaceTitle,
  buildStageOptions,
  buildStatusOptions,
  getActionsForRole,
  ROLE_LABELS,
} from './workflowConfig';
import CalendarPicker from '../../../components/common/CalendarPicker';
import {
  PlusCircleIcon,
  XMarkIcon,
  UserIcon,
  TagIcon,
  MapPinIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PhoneIcon,
  ChatBubbleLeftIcon,
  ClipboardDocumentListIcon,
  NoSymbolIcon,
  TrashIcon,
  HandRaisedIcon,
  SparklesIcon,
  BanknotesIcon,
  HomeIcon,
  HomeModernIcon,
  IdentificationIcon,
  TrophyIcon,
  TableCellsIcon,
  BoltIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import './LeadWorkspacePage.css';
const NEW_LEAD_REMARK_CHIPS = ['Hot lead', 'Requested call back', 'Needs brochure', 'Budget discussed', 'Location priority'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOLLOW_UP_MINUTES_AHEAD = 5;

const NEW_LEAD_FOLLOW_UP_SHORTCUTS = [
  { label: 'Today 2 PM', kind: 'dayOffset', dayOffset: 0, hour: 14, minute: 0 },
  { label: 'Today 6 PM', kind: 'dayOffset', dayOffset: 0, hour: 18, minute: 0 },
  { label: 'Tomorrow 11 AM', kind: 'dayOffset', dayOffset: 1, hour: 11, minute: 0 },
  { label: 'This Sat 11 AM', kind: 'weekday', weekday: 6, hour: 11, minute: 0 },
  { label: 'This Sun 11 AM', kind: 'weekday', weekday: 0, hour: 11, minute: 0 },
];

const sanitizePhoneNumberInput = (value) => String(value || '').replace(/\D/g, '').slice(0, 12);

const hasValidPhoneLength = (value) => {
  const len = sanitizePhoneNumberInput(value).length;
  return len >= 10 && len <= 12;
};

const isClosedLostLead = (lead) => {
  const stageCode = String(lead?.stageCode || lead?.stage?.stage_code || '').trim().toUpperCase();
  return stageCode === 'CLOSED_LOST';
};

const getLeadOwnerName = (lead) => {
  const ownerFromFlat = String(lead?.assignedToName || '').trim();
  if (ownerFromFlat) return ownerFromFlat;

  const ownerFromNested = `${lead?.assignedTo?.first_name || ''} ${lead?.assignedTo?.last_name || ''}`.trim();
  return ownerFromNested || 'Unassigned';
};

const FOLLOW_UP_WORKSPACE_ROLES = ['TC', 'SM', 'SH'];

const getProjectDisplayName = (project) => {
  const raw = String(project?.project_name || '').trim();
  if (!raw) return '';
  return raw.replace(/\s*\(\d+\)\s*$/, '').trim();
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
  nextFollowUpAt: '',
  lead_status_id: '',
  customerRequirement: '',
  customerTypeId: '',
  motivationType: '',
  svDate: new Date().toISOString().split('T')[0],
  timeSpent: '',
  latitude: null,
  longitude: null,
  assignment_mode: 'ME',
  assigned_to: '',
  assignment_mode_manual: false,
  closure_reason_id: '',
  remark: '',
  callResult: 'Answered',
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

const toDayStart = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isFollowUpMissedByDate = (value, referenceDate = new Date()) => {
  const followUpDate = toDayStart(value);
  if (!followUpDate) return false;

  const referenceStart = new Date(referenceDate);
  referenceStart.setHours(0, 0, 0, 0);
  return followUpDate.getTime() < referenceStart.getTime();
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

const getFollowUpMinimumTime = (minutesAhead = FOLLOW_UP_MINUTES_AHEAD) => new Date(Date.now() + (minutesAhead * 60 * 1000));

const isFollowUpAtLeastMinutesAhead = (value, minutesAhead = FOLLOW_UP_MINUTES_AHEAD) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() > getFollowUpMinimumTime(minutesAhead).getTime();
};

const buildNewLeadFollowUpShortcut = (shortcut) => {
  if (shortcut.kind === 'weekday') {
    return getQuickFollowUpForWeekday(shortcut.weekday, shortcut.hour, shortcut.minute);
  }

  return getQuickFollowUpValue(shortcut.dayOffset, shortcut.hour, shortcut.minute);
};

const SYSTEM_REMARK_PREFIXES = ['Lead created with status:', 'Response:', 'Quick action:', 'Follow-up call scheduled for', 'Action:'];
const FOLLOW_UP_SCHEDULED_PREFIX = 'Follow-up call scheduled for';

const MANDATORY_REMARK_STATUS_CODES = new Set([
  'NEW',
  'RNR',
  'FOLLOW_UP',
  'SV_SCHEDULED',
  'SV_DONE',
  'REVISIT',
  'NEGOTIATION_HOT',
  'NEGOTIATION_WARM',
  'NEGOTIATION_COLD',
]);

const isRemarkMandatoryForAction = (action) => {
  if (!action) return false;
  const statusCode = String(action.targetStatusCode || '').trim().toUpperCase();
  return MANDATORY_REMARK_STATUS_CODES.has(statusCode);
};

const normalizeStatusCode = (value) => String(value || '').trim().toUpperCase();

const normalizeStatusKey = (value) => normalizeStatusCode(value).replace(/[\s-]+/g, '_');

const TC_NEW_LEAD_STATUS_ALIASES = {
  NEW: ['NEW', 'FRESH', 'NEW_LEAD'],
  RNR: ['RNR', 'NO_RESPONSE', 'NOT_RESPONDED'],
  FOLLOW_UP: ['FOLLOW_UP', 'FOLLOWUP', 'CALL_BACK', 'CALLBACK'],
  SV_SCHEDULED: ['SV_SCHEDULED', 'SITE_VISIT_SCHEDULED', 'VISIT_SCHEDULED'],
  LOST: ['LOST', 'CLOSED_LOST', 'COLD_LOST'],
  JUNK: ['JUNK'],
  SPAM: ['SPAM'],
};

const TC_STATUS_ALIAS_TO_CANONICAL = Object.entries(TC_NEW_LEAD_STATUS_ALIASES)
  .reduce((acc, [canonical, aliases]) => {
    aliases.forEach((alias) => {
      acc[normalizeStatusKey(alias)] = canonical;
    });
    return acc;
  }, {});

const toCanonicalStatusCode = (statusCode) => {
  const key = normalizeStatusKey(statusCode);
  return TC_STATUS_ALIAS_TO_CANONICAL[key] || key;
};

const isTcAllowedCreateStatus = (statusCode) => {
  const canonical = toCanonicalStatusCode(statusCode);
  return Object.prototype.hasOwnProperty.call(TC_NEW_LEAD_STATUS_ALIASES, canonical);
};

const statusCodeToLabel = (statusCode, workflowConfig) => {
  const normalized = normalizeStatusCode(statusCode);
  if (!normalized) return '';

  if (normalized === 'BOOKED') return 'Booked';

  const statuses = Array.isArray(workflowConfig?.statuses) ? workflowConfig.statuses : [];
  const match = statuses.find((status) => normalizeStatusCode(status?.status_code) === normalized);
  if (match?.status_name) return match.status_name;

  return normalized.replace(/_/g, ' ');
};

const getActionByCode = (workflowConfig, actionCode) => {
  if (!actionCode || !workflowConfig?.actions) return null;
  const actionGroups = Object.values(workflowConfig.actions);
  for (const group of actionGroups) {
    if (!Array.isArray(group)) continue;
    const found = group.find((action) => action?.code === actionCode);
    if (found) return found;
  }
  return null;
};

const getRemarkHistoryStatusLabel = (activity, workflowConfig) => {
  const explicitStatusName = [
    activity?.metadata?.statusName,
    activity?.metadata?.createdStatus,
    activity?.metadata?.targetStatusName,
    activity?.metadata?.newStatusName,
  ].find((value) => typeof value === 'string' && value.trim());
  if (explicitStatusName) return explicitStatusName.trim();

  const fromStatusCode = [
    activity?.metadata?.statusCode,
    activity?.metadata?.targetStatusCode,
    activity?.metadata?.newStatusCode,
  ].find((value) => typeof value === 'string' && value.trim());
  if (fromStatusCode) return statusCodeToLabel(fromStatusCode, workflowConfig);

  if (typeof activity?.title === 'string' && activity.title.startsWith('Status updated to ')) {
    return activity.title.replace('Status updated to ', '').trim();
  }

  const actionCode = activity?.metadata?.actionCode;
  if (actionCode) {
    const action = getActionByCode(workflowConfig, actionCode);
    if (action?.targetStatusCode) {
      return statusCodeToLabel(action.targetStatusCode, workflowConfig);
    }
  }

  return '';
};

const getUserRemarkText = (activity) => {
  if (['ASSIGNMENT', 'REASSIGNMENT', 'FOLLOW_UP_SCHEDULED'].includes(activity?.type)) {
    return '';
  }

  const statusRemark = typeof activity?.metadata?.statusRemarkText === 'string'
    ? activity.metadata.statusRemarkText.trim()
    : '';
  if (statusRemark) return statusRemark;

  const description = typeof activity?.description === 'string' ? activity.description.trim() : '';
  if (!description) return '';

  if (SYSTEM_REMARK_PREFIXES.some((prefix) => description.startsWith(prefix))) return '';

  const parts = description.split('|').map((part) => part.trim()).filter(Boolean);
  const remarkPart = parts.find((part) => /^remark\s*:/i.test(part));
  if (remarkPart) return remarkPart.replace(/^remark\s*:/i, '').trim();

  const notePart = parts.find((part) => /^note\s*:/i.test(part));
  if (notePart) return notePart.replace(/^note\s*:/i, '').trim();

  const nonSystemParts = parts.filter((part) => (
    !/^action\s*:/i.test(part)
    && !/^response\s*:/i.test(part)
    && !/^call\s*status\s*:/i.test(part)
    && !/^status\s*:/i.test(part)
  ));

  if (!nonSystemParts.length) return '';
  return nonSystemParts.join(' | ');
};

const getScheduledFollowUpIso = (activity) => {
  const metadata = activity?.metadata || {};
  const candidates = [
    metadata.nextFollowUpAt,
    metadata.next_follow_up_at,
    metadata.followUpAt,
    metadata.follow_up_at,
    metadata.scheduledFor,
    metadata.scheduled_for,
  ];

  const firstValid = candidates.find((value) => {
    if (!value) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  });

  return firstValid ? new Date(firstValid).toISOString() : null;
};

const parseAsUtcIfNeeded = (rawDateText) => {
  const direct = new Date(rawDateText);
  if (!Number.isNaN(direct.getTime())) {
    // If timezone is absent, backend activity text generally carries UTC clock time.
    const hasExplicitTimeZone = /\b(UTC|GMT|IST)\b|Z$|[+-]\d{2}:?\d{2}$/i.test(rawDateText);
    if (hasExplicitTimeZone) return direct;
  }

  const utcFallback = new Date(`${rawDateText} UTC`);
  if (!Number.isNaN(utcFallback.getTime())) return utcFallback;
  return direct;
};

const formatActivityDescription = (description, activity) => {
  if (typeof description !== 'string') return '';
  const text = description.trim();
  if (!text.startsWith(FOLLOW_UP_SCHEDULED_PREFIX)) return text;

  const metadataIso = getScheduledFollowUpIso(activity);
  if (metadataIso) {
    return `${FOLLOW_UP_SCHEDULED_PREFIX} ${formatDateTimeInTimeZone(metadataIso)} IST`;
  }

  const rawDateText = text.slice(FOLLOW_UP_SCHEDULED_PREFIX.length).trim();
  if (!rawDateText) return text;

  const parsed = parseAsUtcIfNeeded(rawDateText);
  if (Number.isNaN(parsed.getTime())) return text;

  return `${FOLLOW_UP_SCHEDULED_PREFIX} ${formatDateTimeInTimeZone(parsed.toISOString())} IST`;
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
  const CALL_STATUS_CODES = ['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED'];

  const shouldShowCallStatus = (statusCode) => CALL_STATUS_CODES.includes(toCanonicalStatusCode(statusCode));

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
    callResult: 'Answered',
  });
  const [timeTick, setTimeTick] = useState(() => Date.now());

  // ── Dynamic Status Remarks ──
  const [quickStatusRemarks, setQuickStatusRemarks] = useState([]);
  const [quickRemarkAnsNonAns, setQuickRemarkAnsNonAns] = useState(null); // 'Answered' | 'Not-Answered' | null
  const [quickMissingLocationId, setQuickMissingLocationId] = useState('');
  const [quickMissingProjectIds, setQuickMissingProjectIds] = useState([]);
  const [quickLocationSearch, setQuickLocationSearch] = useState('');
  const [quickProjectSearch, setQuickProjectSearch] = useState('');
  const [quickLocationDropdownOpen, setQuickLocationDropdownOpen] = useState(false);
  const [quickProjectDropdownOpen, setQuickProjectDropdownOpen] = useState(false);
  const [closureReasons, setClosureReasons] = useState([]);
  const [activeTab, setActiveTab] = useState('today'); // 'all' | 'new' | 'today' | 'missed' | 'sh_leads' | 'sm_leads'
  const [qaActiveTab, setQaActiveTab] = useState('history'); // 'activity' | 'history'

  // ── Create lead ──
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState(initialNewLead);
  const [projectOptions, setProjectOptions] = useState([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  const [motivationOptions, setMotivationOptions] = useState([]);
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
  const [stagePopupData, setStagePopupData] = useState({ actionCode: '', stageLabel: '', followUpAt: '', reason: '', needsFollowUp: false, callResult: 'Answered' });

  // ── SV Done Modal (TC Handoff) ──
  const [svDoneModalOpen, setSvDoneModalOpen] = useState(false);
  const [svDoneForm, setSvDoneForm] = useState({ assignToUserId: '', svDate: '', svProjectId: '', budgetMin: '', budgetMax: '', note: '' });

  // ── Record Site Visit Modal (SM Analysis) ──
  const [recordSvModalOpen, setRecordSvModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [workspaceRole, user?.id]);
  const [recordSvForm, setRecordSvForm] = useState({
    svDate: new Date().toISOString().split('T')[0],
    svProjectId: '',
    assignToUserId: '',
    budgetMin: '',
    budgetMax: '',
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
  const [newLeadStatusRemarks, setNewLeadStatusRemarks] = useState([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [tcMappedLocationIds, setTcMappedLocationIds] = useState([]);
  const [isMappingsLoading, setIsMappingsLoading] = useState(false);

  // ── Customer Profile Modal (SH Close Won) ──
  const [customerProfileOpen, setCustomerProfileOpen] = useState(false);
  const [customerProfileForm, setCustomerProfileForm] = useState({
    date_of_birth: '', pan_number: '', aadhar_number: '',
    occupation: '', current_post: '', purchase_type: '', marital_status: '',
    current_address: '', current_city: '', current_state: '', current_pincode: '',
    permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
    sameAsCurrent: false, assignToUserId: '', note: '', inventoryUnitId: '',
  });
  const [availableUnits, setAvailableUnits] = useState([]);

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

  const stagePopupAction = useMemo(
    () => roleActions.find((action) => action.code === stagePopupData.actionCode) || null,
    [roleActions, stagePopupData.actionCode]
  );

  const isSmHandoffReadOnlyLead = useCallback((lead) => {
    if (workspaceRole !== 'SM' || !lead || !user?.id) return false;
    const assignedToOtherUser = lead.assignedToUserId && String(lead.assignedToUserId) !== String(user.id);
    return assignedToOtherUser
      && lead.assignedRole === 'SH'
      && lead.previousAssignedTo
      && String(lead.previousAssignedTo) === String(user.id);
  }, [workspaceRole, user?.id]);

  const isShTaggedReadOnlyLead = useCallback((lead) => {
    if (workspaceRole !== 'SH' || !lead || !user?.id) return false;

    const taggedSalesHeadId = lead?.customFields?.assigned_sales_head;
    if (!taggedSalesHeadId || String(taggedSalesHeadId) !== String(user.id)) return false;

    const assignedToMe = lead.assignedToUserId && String(lead.assignedToUserId) === String(user.id);
    return !assignedToMe;
  }, [workspaceRole, user?.id]);

  const isLeadReadOnly = useCallback(
    (lead) => isSmHandoffReadOnlyLead(lead) || isShTaggedReadOnlyLead(lead),
    [isSmHandoffReadOnlyLead, isShTaggedReadOnlyLead]
  );

  const selectedLeadReadOnly = useMemo(
    () => isLeadReadOnly(selectedLead),
    [isLeadReadOnly, selectedLead]
  );

  const quickActionLeadReadOnly = useMemo(
    () => isLeadReadOnly(quickActionLead),
    [isLeadReadOnly, quickActionLead]
  );

  const quickWorkflowIsTerminalAction = useMemo(
    () => ['TC_JUNK', 'TC_SPAM', 'TC_LOST', 'SM_LOST', 'COL_CANCELLED'].includes(quickWorkflowAction?.code),
    [quickWorkflowAction]
  );

  const quickWorkflowIsRnrAction = useMemo(
    () => quickWorkflowAction?.targetStatusCode === 'RNR' || quickWorkflowAction?.code?.includes('RNR'),
    [quickWorkflowAction]
  );

  const quickWorkflowNeedsMissingLocationProject = useMemo(
    () => workspaceRole === 'TC' && Boolean(quickWorkflowAction) && !quickWorkflowIsTerminalAction && !quickWorkflowIsRnrAction,
    [workspaceRole, quickWorkflowAction, quickWorkflowIsTerminalAction, quickWorkflowIsRnrAction]
  );

  const quickLeadHasLocation = useMemo(
    () => {
      const locId = quickActionLead?.locationId;
      const intLocs = (quickActionLead?.interestedLocations || []).filter(id => id && String(id).trim() !== '');
      return Boolean(locId || intLocs.length > 0);
    },
    [quickActionLead]
  );
  
  const quickLeadHasProject = useMemo(
    () => {
      const projId = quickActionLead?.projectId;
      const intProjs = (quickActionLead?.interestedProjects || []).filter(id => id && String(id).trim() !== '');
      return Boolean(projId || intProjs.length > 0);
    },
    [quickActionLead]
  );

  const selectedLeadHasLocation = useMemo(
    () => Boolean(
      selectedLead?.interestedLocations?.length
      || selectedLead?.locationId
      || selectedLead?.location
      || quickMissingLocationId
    ),
    [selectedLead, quickMissingLocationId]
  );

  const selectedLeadHasProject = useMemo(
    () => Boolean(
      selectedLead?.interestedProjects?.length
      || selectedLead?.projectId
      || selectedLead?.project
      || quickMissingProjectIds?.length > 0
    ),
    [selectedLead, quickMissingProjectIds]
  );

  // Variant that only checks whether the lead already has a project (ignores quick picks)
  const selectedLeadHasProjectFromLead = useMemo(
    () => Boolean(
      selectedLead?.interestedProjects?.length
      || selectedLead?.projectId
      || selectedLead?.project
    ),
    [selectedLead]
  );

  const quickMissingProjectOptions = useMemo(
    () => {
      const activeLocId = quickWorkflowForm.locationId || quickMissingLocationId;
      if (!activeLocId) return projectOptions;
      return projectOptions.filter((project) => {
        const projectLocationId = project.location_id || project.locationId || '';
        return String(projectLocationId) === String(activeLocId);
      });
    },
    [projectOptions, quickWorkflowForm.locationId, quickMissingLocationId]
  );

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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const useFollowUpTabs = FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole);

    return leads.filter((lead) => {
      if (useFollowUpTabs) {
        const isSmReadOnlyLead = workspaceRole === 'SM' && isSmHandoffReadOnlyLead(lead);
        const isShReadOnlyLead = workspaceRole === 'SH' && isShTaggedReadOnlyLead(lead);
        const isCrossRoleReadOnlyLead = isSmReadOnlyLead || isShReadOnlyLead;

        if (workspaceRole === 'SM' && activeTab === 'sh_leads') {
          if (!isSmReadOnlyLead) return false;
        } else if (workspaceRole === 'SH' && activeTab === 'sm_leads') {
          if (!isShReadOnlyLead) return false;
        } else {
          // Today/Missed tabs must never mix in cross-role read-only leads.
          if (isCrossRoleReadOnlyLead) return false;

          if (lead.isClosed) return false;

          const followUpAt = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null;
          const followUpDay = followUpAt ? toDayStart(followUpAt) : null;
          if (!followUpDay) return false;

          const isTodayFollowUp = followUpDay.getTime() === todayStart.getTime();
          const isMissedFollowUp = isFollowUpMissedByDate(followUpDay, todayStart);

          if (activeTab === 'today' && !isTodayFollowUp) return false;
          if (activeTab === 'missed' && !isMissedFollowUp) return false;

          if (
            activeTab !== 'today'
            && activeTab !== 'missed'
            && activeTab !== 'new'
            && !isTodayFollowUp
            && !isMissedFollowUp
          ) return false;
        }
      }

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
  }, [leads, filters.search, multiFilters, activeTab, workspaceRole, isSmHandoffReadOnlyLead, isShTaggedReadOnlyLead]);

  const selectedSourceSubSources = useMemo(
    () => subSourceMap[newLeadForm.lead_source_id] || [],
    [subSourceMap, newLeadForm.lead_source_id]
  );

  const newLeadStatusChipOptions = useMemo(() => {
    if (!Array.isArray(statusOptions) || statusOptions.length === 0) return [];

    if (workspaceRole === 'TC') {
      const filtered = statusOptions.filter((st) => isTcAllowedCreateStatus(st.value));
      return filtered.length >= 3 ? filtered : statusOptions;
    }

    if (workspaceRole === 'SM') {
      const allowedSmCreateStatuses = new Set(['FOLLOW_UP', 'NEGOTIATION_HOT', 'LOST', 'REVISIT', 'SV_SCHEDULED']);
      const filtered = statusOptions
        .filter((st) => allowedSmCreateStatuses.has(toCanonicalStatusCode(st.value)))
        .map((st) => {
          // Rename Scheduled Revisit / SV Scheduled to Revisit
          const code = toCanonicalStatusCode(st.value);
          if (code === 'REVISIT') {
            return { ...st, label: 'Revisit' };
          }
          return st;
        });
      return filtered.length > 0 ? filtered : statusOptions;
    }

    const actionStatusCodes = new Set(
      roleActions
        .map((action) => action?.targetStatusCode)
        .filter(Boolean)
        .map((code) => String(code).toUpperCase())
    );

    if (!actionStatusCodes.size) return statusOptions;

    actionStatusCodes.add('NEW');

    const filtered = statusOptions.filter((st) => actionStatusCodes.has(String(st.value || '').toUpperCase()));
    return filtered.length > 0 ? filtered : statusOptions;
  }, [workspaceRole, roleActions, statusOptions]);

  const selectedNewLeadStatusCode = useMemo(() => {
    const selected = statusOptions.find((s) => s.id === newLeadForm.lead_status_id || s.value === newLeadForm.lead_status_id);
    return toCanonicalStatusCode(selected?.value || newLeadForm.lead_status_id || '');
  }, [statusOptions, newLeadForm.lead_status_id]);

  const selectedCreateLocationIds = useMemo(() => {
    const ids = [
      ...(Array.isArray(newLeadForm.location_ids) ? newLeadForm.location_ids : []),
      newLeadForm.location_id,
    ]
      .filter(Boolean)
      .map((id) => String(id));
    return [...new Set(ids)];
  }, [newLeadForm.location_ids, newLeadForm.location_id]);

  const tcCanSelfAssignSelectedLocation = useMemo(() => {
    if (workspaceRole !== 'TC') return true;
    if (isMappingsLoading) return true; // Default to true while loading to avoid premature pool-flip
    if (!selectedCreateLocationIds.length) return true;
    if (!tcMappedLocationIds.length) return false;

    const mapped = new Set(tcMappedLocationIds.map((id) => String(id)));
    return selectedCreateLocationIds.some((id) => mapped.has(String(id)));
  }, [workspaceRole, selectedCreateLocationIds, tcMappedLocationIds, isMappingsLoading]);

  const tcStatusNeedsFullDetails = ['NEW', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(selectedNewLeadStatusCode);
  const tcStatusNeedsFollowUp = ['NEW', 'FOLLOW_UP', 'SV_SCHEDULED', 'RNR'].includes(selectedNewLeadStatusCode);
  const isTerminalCreateStatus = ['LOST', 'JUNK', 'SPAM', 'COLD_LOST'].includes(selectedNewLeadStatusCode);
    const needsRemark = Boolean(selectedNewLeadStatusCode) && selectedNewLeadStatusCode !== 'NEW';
  const smStatusNeedsFollowUp = workspaceRole === 'SM' && ['FOLLOW_UP', 'NEW', 'REVISIT', 'SV_SCHEDULED'].includes(selectedNewLeadStatusCode);
  const smStatusNeedsReason = workspaceRole === 'SM' && selectedNewLeadStatusCode === 'LOST';
  const smStatusNeedsAssignee = false; // SM/SH leads are now automatically self-assigned as per user request
  const smStatusNeedsCallStatus = workspaceRole === 'SM' && ['FOLLOW_UP', 'LOST'].includes(selectedNewLeadStatusCode);
  const smStatusNeedsRemark = workspaceRole === 'SM' && ['FOLLOW_UP', 'NEGOTIATION_HOT', 'LOST', 'REVISIT', 'SV_SCHEDULED'].includes(selectedNewLeadStatusCode);
  const createLeadNeedsRemark = workspaceRole === 'SM' ? smStatusNeedsRemark : needsRemark;
  const shouldShowCreateCallStatus = workspaceRole === 'SM'
    ? smStatusNeedsCallStatus
    : shouldShowCallStatus(selectedNewLeadStatusCode);

  const newLeadFollowUpShortcutOptions = useMemo(() => {
    const thresholdTime = timeTick + (FOLLOW_UP_MINUTES_AHEAD * 60 * 1000);
    return NEW_LEAD_FOLLOW_UP_SHORTCUTS
      .map((shortcut) => ({
        ...shortcut,
        value: buildNewLeadFollowUpShortcut(shortcut),
      }))
      .filter((shortcut) => {
        const shortcutTime = new Date(shortcut.value).getTime();
        return Number.isFinite(shortcutTime) && shortcutTime > thresholdTime;
      });
  }, [timeTick]);

  const newLeadValidation = useMemo(() => {
    const errors = [];
    const primaryPhone = sanitizePhoneNumberInput(newLeadForm.phone);
    const alternatePhone = sanitizePhoneNumberInput(newLeadForm.alternate_phone);
    const whatsappPhone = sanitizePhoneNumberInput(newLeadForm.whatsapp_number);

    if (!newLeadForm.full_name?.trim()) errors.push('Full name is required');
    if (!hasValidPhoneLength(primaryPhone)) errors.push('Phone number must be 10 to 12 digits');

    if (alternatePhone && !hasValidPhoneLength(alternatePhone)) {
      errors.push('Alternate phone number must be 10 to 12 digits');
    }

    if (!newLeadForm.whatsappSameAsPhone && whatsappPhone && !hasValidPhoneLength(whatsappPhone)) {
      errors.push('WhatsApp number must be 10 to 12 digits');
    }

    if (newLeadForm.email?.trim() && !EMAIL_REGEX.test(newLeadForm.email.trim())) {
      errors.push('Please enter a valid email address');
    }

    if (!newLeadForm.lead_source_id) errors.push('Lead source is required');

    if (workspaceRole === 'TC') {
      if (!newLeadForm.lead_sub_source_id) errors.push('Lead sub-source is required');
      if (!newLeadForm.lead_status_id) errors.push('Lead status is required');

      if (tcStatusNeedsFullDetails) {
        if (!newLeadForm.location_id) errors.push('Location is required');
        if (!newLeadForm.project_ids?.length) errors.push('At least one project is required');
        if (!newLeadForm.callResult) errors.push('Call status is required');
      }

      if (tcStatusNeedsFollowUp && !newLeadForm.nextFollowUpAt) {
        errors.push('Next follow up date is required');
      }

      if (needsRemark && !newLeadForm.remark?.trim()) {
        errors.push('Notes & Remarks are required');
      }

      if (newLeadForm.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(newLeadForm.nextFollowUpAt)) {
        errors.push('Next follow up must be at least 5 minutes from now');
      }

      if (isTerminalCreateStatus) {
        if (!newLeadForm.closure_reason_id) errors.push('Closure reason is required');
      }
    }

    if (workspaceRole === 'SM') {
      if (!newLeadForm.lead_status_id) errors.push('Lead status is required');
      if (!newLeadForm.location_id) errors.push('Location is required');
      if (!newLeadForm.project_ids?.length) errors.push('At least one project is required');
      if (!newLeadForm.customerTypeId) errors.push('Customer type is required');
      if (!newLeadForm.motivationType) errors.push('Motivation is required');

      if (smStatusNeedsFollowUp && !newLeadForm.nextFollowUpAt) {
        errors.push('Next follow up date is required');
      }

      if (smStatusNeedsReason && !newLeadForm.closure_reason_id) {
        errors.push('Closure reason is required');
      }

      if (smStatusNeedsAssignee && !newLeadForm.assigned_to) {
        errors.push('Sales Head is required for Negotiation (Hot)');
      }

      if (smStatusNeedsCallStatus && !newLeadForm.callResult) {
        errors.push('Call status is required');
      }

      if (smStatusNeedsRemark && !newLeadForm.remark?.trim()) {
        errors.push('Notes & Remarks are required');
      }

      if (newLeadForm.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(newLeadForm.nextFollowUpAt)) {
        errors.push('Next follow up must be at least 5 minutes from now');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: {
        primaryPhone,
        alternatePhone,
        whatsappPhone,
      },
    };
  }, [
    newLeadForm,
    workspaceRole,
    tcStatusNeedsFullDetails,
    tcStatusNeedsFollowUp,
    isTerminalCreateStatus,
    needsRemark,
    smStatusNeedsFollowUp,
    smStatusNeedsReason,
    smStatusNeedsAssignee,
    smStatusNeedsCallStatus,
    smStatusNeedsRemark,
  ]);

  // ── Stats (Telecaller KPI cards) ──
  const computedStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const totalLeads = leads.length;
    const newToday = leads.filter((l) => l.createdAt && new Date(l.createdAt) >= todayStart).length;
    const todayFollowUps = leads.filter((l) => l.nextFollowUpAt && toDayStart(l.nextFollowUpAt)?.getTime() === todayStart.getTime() && !l.isClosed).length;
    const overdueFollowUps = leads.filter((l) => l.nextFollowUpAt && isFollowUpMissedByDate(l.nextFollowUpAt, todayStart) && !l.isClosed).length;
    const svScheduled = leads.filter((l) => l.stageCode && l.stageCode.includes('SV_SCHED')).length;
    const svCompleted = leads.filter((l) => l.stageCode && (l.stageCode.includes('SV_DONE') || l.stageCode.includes('SV_COMPLET'))).length;
    const missedFollowups = overdueFollowUps;
    return { totalLeads, newToday, todayFollowUps, overdueFollowUps, svScheduled, svCompleted, missedFollowups };
  }, [leads]);

  const hasPendingMissedFollowupsForMe = useMemo(() => {
    if (!FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole)) return false;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return leads.some((lead) => {
      if (lead.isClosed) return false;
      if (!lead.nextFollowUpAt) return false;

      const assignedToMe = lead.assignedToUserId && String(lead.assignedToUserId) === String(user?.id);
      if (!assignedToMe) return false;

      return isFollowUpMissedByDate(lead.nextFollowUpAt, todayStart);
    });
  }, [leads, workspaceRole, user?.id]);

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

  useEffect(() => {
    const loadTcMappedLocations = async () => {
      if (workspaceRole !== 'TC' || !user?.id) {
        setTcMappedLocationIds([]);
        return;
      }

      setIsMappingsLoading(true);
      try {
        const response = await leadWorkflowApi.getMyMappedLocations();
        const locationIds = response?.data?.location_ids || [];
        const normalized = [...new Set(locationIds.filter(Boolean).map((id) => String(id)))];
        setTcMappedLocationIds(normalized);
      } catch (err) {
        console.error('Failed to load TC mapped locations:', err);
        setTcMappedLocationIds([]);
      } finally {
        setIsMappingsLoading(false);
      }
    };

    loadTcMappedLocations();
  }, [workspaceRole, user?.id]);

  useEffect(() => {
    if (workspaceRole !== 'TC') return;
    if (tcCanSelfAssignSelectedLocation) return;

    setNewLeadForm((prev) => {
      if (prev.assignment_mode === 'POOL' && !prev.assigned_to) return prev;
      return { ...prev, assignment_mode: 'POOL', assigned_to: '', assignment_mode_manual: false };
    });
  }, [workspaceRole, tcCanSelfAssignSelectedLocation]);

  useEffect(() => {
    if (workspaceRole !== 'TC' || isMappingsLoading) return;
    if (selectedNewLeadStatusCode === 'RNR') return;
    if (!selectedCreateLocationIds.length) return;
    if (newLeadForm.assignment_mode_manual) return;

    setNewLeadForm((prev) => {
      if (!tcCanSelfAssignSelectedLocation) {
        if (prev.assignment_mode === 'POOL' && !prev.assigned_to) return prev;
        return { ...prev, assignment_mode: 'POOL', assigned_to: '', assignment_mode_manual: false };
      }

      if (prev.assignment_mode === 'ME' && String(prev.assigned_to || '') === String(user?.id || '')) return prev;
      return { ...prev, assignment_mode: 'ME', assigned_to: user?.id || '', assignment_mode_manual: false };
    });
  }, [workspaceRole, selectedNewLeadStatusCode, selectedCreateLocationIds, tcCanSelfAssignSelectedLocation, user?.id, isMappingsLoading, newLeadForm.assignment_mode_manual]);

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
    if (workspaceRole === 'TC') {
      loadAssignableUsers('SM');
      loadAssignableUsers('TC');
    }
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

      // Add tab-specific filters for follow-up roles
      if (FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole)) {
        if (activeTab === 'new') {
          queryParams.unassigned = true;
        } else if ((workspaceRole === 'SM' && activeTab === 'sh_leads') || (workspaceRole === 'SH' && activeTab === 'sm_leads')) {
          // Keep role visibility broad for cross-role read-only tabs; filtering is handled client-side.
        } else {
          // Assigned lead tabs (today / missed) — only show leads assigned to this user
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

  // Fetch status-specific remarks for New Lead creation chips
  useEffect(() => {
    if (!newLeadOpen || !newLeadForm.lead_status_id) {
      setNewLeadStatusRemarks([]);
      return;
    }

    const fetchRemarks = async () => {
      setRemarksLoading(true);
      try {
        // Try to find status object to get code
        const statusObj = statusOptions.find(st => st.id === newLeadForm.lead_status_id || st.value === newLeadForm.lead_status_id);
        if (!statusObj) {
          setRemarksLoading(false);
          return;
        }

        const resp = await statusRemarkApi.getByStatusCode(statusObj.value);
        // Correctly extract the remarks array from the response object
        setNewLeadStatusRemarks(resp.data?.remarks || resp.data || []);
      } catch (err) {
        console.error('Failed to fetch new lead status remarks:', err);
        setNewLeadStatusRemarks([]);
      } finally {
        setRemarksLoading(false);
      }
    };

    fetchRemarks();
  }, [newLeadOpen, newLeadForm.lead_status_id, statusOptions]);

  // ── Duplicate Phone Check ──
  const checkDuplicatePhone = async (phone, type) => {
    const normalizedPhone = sanitizePhoneNumberInput(phone);

    if (!normalizedPhone || normalizedPhone.length < 10) {
      if (type === 'primary') setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      else setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
      return;
    }

    if (type === 'primary') setPhoneCheck({ status: 'checking', leadInfo: null, duplicateLead: null });
    else setAltPhoneCheck({ status: 'checking', leadInfo: null, duplicateLead: null });

    try {
      const resp = await leadWorkflowApi.searchLeadByPhone(normalizedPhone);
      const results = resp.data || [];
      const exactMatch = results.find((l) => {
        const candidatePhones = [
          l.phone,
          l.alternate_phone,
          l.alternatePhone,
          l.whatsapp_number,
          l.whatsappNumber,
          l.secondary_phone_1,
          l.secondaryPhone1,
          l.secondary_phone_2,
          l.secondaryPhone2,
          l.secondary_phone_3,
          l.secondaryPhone3,
        ];
        return candidatePhones.some((num) => sanitizePhoneNumberInput(num) === normalizedPhone);
      });

      const matchedLead = exactMatch || results[0] || null;

      if (matchedLead) {
        // Fetch complete lead details
        try {
          const detailResp = await leadWorkflowApi.getLeadById(matchedLead.id);
          const fullLead = detailResp?.data || matchedLead;
          const duplicateLeadName = (
            fullLead.fullName
            || fullLead.full_name
            || `${fullLead.firstName || fullLead.first_name || ''} ${fullLead.lastName || fullLead.last_name || ''}`.trim()
          ).trim();
          const stageName = fullLead.stage?.stage_name || fullLead.stageLabel || 'No Stage';
          const statusName = fullLead.status?.status_name || fullLead.statusLabel || 'No Status';
          const ownerName = getLeadOwnerName(fullLead);
          const blockedNote = isClosedLostLead(fullLead)
            ? 'Use this lead to re-engage.'
            : 'New lead cannot be created for this contact.';
          const info = `${fullLead.leadNumber || fullLead.lead_number || 'Lead'} - ${duplicateLeadName || 'Unnamed'} | Stage: ${stageName} | Status: ${statusName} | Owner: ${ownerName} | ${blockedNote}`;
          if (type === 'primary') setPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: fullLead });
          else setAltPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: fullLead });
        } catch {
          // Fallback: use search result only
          const blockedNote = isClosedLostLead(matchedLead)
            ? 'Use this lead to re-engage.'
            : 'New lead cannot be created for this contact.';
          const info = `${matchedLead.leadNumber || 'Lead'} - ${matchedLead.fullName || ''} | Stage: ${matchedLead.stageLabel || 'No Stage'} | Status: ${matchedLead.statusLabel || 'No Status'} | Owner: ${getLeadOwnerName(matchedLead)} | ${blockedNote}`;
          if (type === 'primary') setPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: matchedLead });
          else setAltPhoneCheck({ status: 'exists', leadInfo: info, duplicateLead: matchedLead });
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
    if (!isClosedLostLead(lead)) {
      toast.error(`New lead cannot be created. Existing lead is active with owner ${getLeadOwnerName(lead)}.`);
      return;
    }

    const fullName = (
      lead.fullName
      || lead.full_name
      || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim()
    ).trim();
    const leadPhone = lead.phone || lead.phone_number || lead.mobile || '';
    const leadEmail = lead.email || '';

    setNewLeadForm((prev) => ({
      ...prev,
      full_name: fullName || prev.full_name,
      phone: leadPhone || prev.phone,
      email: leadEmail || prev.email,
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
      const [pResp, ctResp, motResp, lResp, sResp] = await Promise.all([
        projectApi.getDropdown(),
        customerTypeApi.getDropdown(),
        motivationApi.getDropdown(),
        locationApi.getDropdown(),
        leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown()),
      ]);
      const projects = pResp.data || [];
      const customerTypes = ctResp.data || [];
      const motivations = motResp.data || [];
      const locations = lResp.data || [];
      const sources = sResp.data || [];
      const normalizedSourceName = (source) => String(source?.source_name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const filteredSources = workspaceRole === 'SM'
        ? sources.filter((source) => ['walkin', 'others'].includes(normalizedSourceName(source)))
        : sources;
      const map = {};
      filteredSources.forEach((s) => { map[s.id] = s.subSources || []; });

      if (Object.values(map).every((v) => v.length === 0)) {
        await Promise.all(filteredSources.map(async (s) => {
          try {
            const sub = await leadSubSourceApi.getBySource(s.id);
            map[s.id] = sub.data || [];
          } catch { map[s.id] = []; }
        }));
      }

      setProjectOptions(projects);
      setCustomerTypeOptions(customerTypes);
      setMotivationOptions(motivations);
      setLocationOptions(locations);
      setSourceOptions(filteredSources);
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
    () => (newLeadForm.project_ids || [])
      .map((id) => getProjectDisplayName(projectOptions.find((p) => p.id === id)))
      .filter(Boolean),
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
  const resetNewLeadModal = useCallback(() => {
    setNewLeadForm({ 
      ...initialNewLead, 
      latitude: null, 
      longitude: null,
      assigned_to: (workspaceRole === 'SM' || workspaceRole === 'SH') ? (user?.id || '') : ''
    });
    setPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
    setAltPhoneCheck({ status: 'idle', leadInfo: null, duplicateLead: null });
    setReengageLeadId(null);
    setProjectDropdownOpen(false);
    setProjectSearch('');
    setNewLeadOpen(false);
  }, [workspaceRole, user?.id]);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!newLeadValidation.isValid) {
      toast.error(newLeadValidation.errors[0] || 'Please complete all required fields');
      return;
    }

    const { primaryPhone, alternatePhone, whatsappPhone } = newLeadValidation.sanitized;

    // For TC: use first selected project from multi-select
    const primaryProjectId = newLeadForm.project_ids?.[0] || newLeadForm.project_id || null;
    const selectedProject = primaryProjectId ? projectOptions.find((p) => p.id === primaryProjectId) : null;
    const selectedSource = sourceOptions.find((s) => s.id === newLeadForm.lead_source_id) || null;
    const selectedLocation = locationOptions.find((l) => l.id === newLeadForm.location_id) || null;

    try {
      setCreating(true);
      const createResponse = await leadWorkflowApi.createLead({
        ...newLeadForm,
        phone: primaryPhone,
        alternate_phone: alternatePhone || undefined,
        whatsapp_number: newLeadForm.whatsappSameAsPhone ? primaryPhone : (whatsappPhone || undefined),
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
        callResult: newLeadForm.callResult,
        customerRequirement: newLeadForm.customerRequirement || undefined,
          customerTypeId: newLeadForm.customerTypeId || undefined,
          motivationType: newLeadForm.motivationType || undefined,
        svDate: newLeadForm.svDate ? new Date(newLeadForm.svDate).toISOString() : undefined,
        timeSpent: newLeadForm.timeSpent ? Number(newLeadForm.timeSpent) : undefined,
        assignment_mode: ['SM', 'SH', 'TC'].includes(workspaceRole) ? (newLeadForm.assignment_mode || 'ME') : undefined,
        assigned_to: (workspaceRole === 'SM' || workspaceRole === 'SH')
          ? (user?.id || null)
          : (workspaceRole === 'TC'
            ? (selectedNewLeadStatusCode === 'RNR'
              ? (user?.id || null)
              : (newLeadForm.assignment_mode === 'POOL' ? null : (user?.id || null)))
            : (newLeadForm.assigned_to || null)),
        closure_reason_id: newLeadForm.closure_reason_id || undefined,
        note: newLeadForm.remark || undefined,
        remark: newLeadForm.remark || undefined,
        reengage: Boolean(reengageLeadId),
        reengageLeadId: reengageLeadId || undefined,
      });
      toast.success('Lead created successfully');
      resetNewLeadModal();
      if (workspaceRole === 'TC') {
        const createdLead = createResponse?.data || null;
        const targetTab = createdLead?.assignedToUserId ? 'today' : 'new';
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
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
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
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    // SV Done: open SV Done modal instead of direct action
    if (action.code === 'TC_SV_DONE') {
      setSvDoneForm({
        assignToUserId: '',
        svDate: '',
        svProjectId: '',
        budgetMin: selectedLead.budgetMin ?? '',
        budgetMax: selectedLead.budgetMax ?? '',
        note: actionState.note || '',
      });
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
        budgetMin: selectedLead.budgetMin ?? '',
        budgetMax: selectedLead.budgetMax ?? '',
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
        sameAsCurrent: false, assignToUserId: '', note: actionState.note || '', inventoryUnitId: '',
      });
      setCustomerProfileOpen(true);
      loadAssignableUsers('COL');
      // Load available inventory units for the lead's project
      if (selectedLead?.projectId) {
        inventoryUnitApi.getDropdown({ project_id: selectedLead.projectId }).then(resp => {
          setAvailableUnits(resp.data || []);
        }).catch(() => setAvailableUnits([]));
      }
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
    if (action.needsFollowUp && actionState.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(actionState.nextFollowUpAt)) {
      toast.error('Follow-up time must be greater than current time');
      return;
    }
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
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    if (!recordSvForm.assignToUserId) { toast.error('Sales Head selection is mandatory'); return; }
    if (!recordSvForm.svProjectId) { toast.error('Project visited is mandatory'); return; }
    if (recordSvForm.budgetMin === '' || recordSvForm.budgetMax === '') { toast.error('Budget Min and Budget Max are mandatory'); return; }
    if (Number(recordSvForm.budgetMax) < Number(recordSvForm.budgetMin)) { toast.error('Budget Max must be greater than or equal to Budget Min'); return; }
    if (!recordSvForm.motivationType) { toast.error('Buying Motivation is mandatory'); return; }
    if (!recordSvForm.latitude) { toast.error('Geo-location is mandatory'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'SM_SITE_VISIT', {
        assignToUserId: recordSvForm.assignToUserId,
        svDate: recordSvForm.svDate,
        svProjectId: recordSvForm.svProjectId,
        budgetMin: Number(recordSvForm.budgetMin),
        budgetMax: Number(recordSvForm.budgetMax),
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
    if (!svDoneForm.svProjectId) { toast.error('Project visited is mandatory'); return; }
    if ((svDoneForm.budgetMin !== '' || svDoneForm.budgetMax !== '') && (svDoneForm.budgetMin === '' || svDoneForm.budgetMax === '')) { toast.error('Budget Min and Budget Max must both be provided when entering budget details'); return; }
    if (svDoneForm.budgetMin !== '' && svDoneForm.budgetMax !== '' && Number(svDoneForm.budgetMax) < Number(svDoneForm.budgetMin)) { toast.error('Budget Max must be greater than or equal to Budget Min'); return; }

    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, 'TC_SV_DONE', {
        assignToUserId: svDoneForm.assignToUserId,
        svDate: svDoneForm.svDate ? new Date(svDoneForm.svDate).toISOString() : undefined,
        svProjectId: svDoneForm.svProjectId,
        budgetMin: svDoneForm.budgetMin !== '' ? Number(svDoneForm.budgetMin) : undefined,
        budgetMax: svDoneForm.budgetMax !== '' ? Number(svDoneForm.budgetMax) : undefined,
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
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
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
        inventoryUnitId: f.inventoryUnitId || undefined,
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
      toast.success('Booking approved! Customer profile saved. Lead transferred to Collection Manager.');
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
    const action = roleActions.find((a) => a.code === actionCode);
    const nextStatusCode = action?.targetStatusCode || '';
    if (!option) return;
    setStagePopupData({
      actionCode,
      stageLabel: option.stageLabel || option.actionLabel || actionCode,
      followUpAt: '',
      reason: '',
      assignToUserId: '',
      needsFollowUp: Boolean(option.needsFollowUp),
      callResult: nextStatusCode === 'RNR' ? 'Not Answered' : 'Answered',
    });

    if (action?.needsAssignee) {
      const role = getAssigneeRoleForAction(action, workspaceRole);
      loadAssignableUsers(role);
    }
    // Initialize missing-location/project picks from the selected lead so validation works
    setQuickMissingLocationId(
      selectedLead?.interestedLocations?.[0]
        ? String(selectedLead.interestedLocations[0])
        : (selectedLead?.locationId ? String(selectedLead.locationId) : '')
    );
    setQuickMissingProjectIds(
      selectedLead?.interestedProjects?.length
        ? selectedLead.interestedProjects.map((id) => String(id))
        : (selectedLead?.projectId ? [String(selectedLead.projectId)] : [])
    );
    setQuickLocationSearch('');
    setQuickProjectSearch('');
    setStagePopupOpen(true);
  };

  // ── Confirm stage transition from popup ──
  const handleStagePopupConfirm = async () => {
    if (!selectedLead || !stagePopupData.actionCode) return;
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    const popupAction = roleActions.find((a) => a.code === stagePopupData.actionCode);
    if (popupAction?.needsCustomerProfile || popupAction?.code === 'SH_BOOKING') {
      setStagePopupOpen(false);
      setCustomerProfileForm({
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false, assignToUserId: '', note: stagePopupData.reason || actionState.note || '', inventoryUnitId: '',
      });
      setCustomerProfileOpen(true);
      loadAssignableUsers('COL');
      // Load inventory units
      if (selectedLead?.projectId) {
        inventoryUnitApi.getDropdown({ project_id: selectedLead.projectId }).then(resp => {
          setAvailableUnits(resp.data || []);
        }).catch(() => setAvailableUnits([]));
      }
      return;
    }

    if (stagePopupData.needsFollowUp && !stagePopupData.followUpAt) {
      toast.error('Follow-up date & time is required for this stage');
      return;
    }

    if (stagePopupData.followUpAt && !isFollowUpAtLeastMinutesAhead(stagePopupData.followUpAt)) {
      toast.error('Follow-up time must be greater than current time');
      return;
    }

    if (!selectedLeadHasLocation || !selectedLeadHasProject) {
      if (!selectedLeadHasLocation && !quickMissingLocationId) {
        toast.error('Please select a location for this lead');
        return;
      }
      if (!selectedLeadHasProject && quickMissingProjectIds.length === 0) {
        toast.error('Please select a project for this lead');
        return;
      }
    }

    if (stagePopupAction?.needsAssignee && !stagePopupData.assignToUserId) {
      toast.error(stagePopupAction.code === 'TC_SV_DONE' ? 'Please select a Sales Manager' : 'Please select an assignee');
      return;
    }

    setManualUpdateSaving(true);
    try {
      await leadWorkflowApi.transitionLead(selectedLead.id, stagePopupData.actionCode, {
        note: stagePopupData.reason.trim(),
        nextFollowUpAt: stagePopupData.followUpAt ? new Date(stagePopupData.followUpAt).toISOString() : undefined,
        callResult: shouldShowCallStatus(stagePopupAction?.targetStatusCode) ? stagePopupData.callResult : undefined,
        assignToUserId: stagePopupData.assignToUserId || undefined,
        location_id: quickMissingLocationId || undefined,
        location_ids: quickMissingLocationId ? [quickMissingLocationId] : undefined,
        project_id: quickMissingProjectIds[0] || undefined,
        project_ids: quickMissingProjectIds.length > 0 ? quickMissingProjectIds : undefined,
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
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

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
      location_id: quickMissingLocationId || undefined,
      location_ids: quickMissingLocationId ? [quickMissingLocationId] : undefined,
      project_id: quickMissingProjectIds[0] || undefined,
      project_ids: quickMissingProjectIds.length > 0 ? quickMissingProjectIds : undefined,
    };

    if (manualNextFollowUpAt && !isFollowUpAtLeastMinutesAhead(manualNextFollowUpAt)) {
      toast.error('Follow-up time must be greater than current time');
      return;
    }

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
    if (selectedLeadReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
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
    setQuickMissingLocationId('');
    setQuickMissingProjectIds([]);
    setQuickLocationSearch('');
    setQuickProjectSearch('');
    setQuickLocationDropdownOpen(false);
    setQuickProjectDropdownOpen(false);
    setQuickWorkflowForm({
      note: '',
      statusRemarkText: '',
      nextFollowUpAt: '',
      assignToUserId: '',
      closureReasonId: '',
      reason: '',
      svDate: '',
      svProjectId: '',
      budgetMin: '',
      budgetMax: '',
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
    if (isLeadReadOnly(quickActionLead)) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

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
  }, [quickActionLead, loadLeads, resetQuickWorkflowForm, isLeadReadOnly]);

  const handleQuickWorkflowActionSelect = async (action) => {
    if (!action) return;
    if (isLeadReadOnly(quickActionLead)) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

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
    setQuickMissingLocationId(
      quickActionLead?.interestedLocations?.[0]
        ? String(quickActionLead.interestedLocations[0])
        : (quickActionLead?.locationId ? String(quickActionLead.locationId) : '')
    );
    setQuickMissingProjectIds(
      quickActionLead?.interestedProjects?.length
        ? quickActionLead.interestedProjects.map((id) => String(id))
        : (quickActionLead?.projectId ? [String(quickActionLead.projectId)] : [])
    );
    setQuickWorkflowForm({
      note: '',
      statusRemarkText: '',
      nextFollowUpAt: '',
      assignToUserId: '',
      closureReasonId: '',
      reason: '',
      svDate: new Date().toISOString().split('T')[0],
      svProjectId: quickActionLead?.projectId || '',
      budgetMin: quickActionLead?.budgetMin ?? '',
      budgetMax: quickActionLead?.budgetMax ?? '',
      motivationType: quickActionLead?.motivationType || '',
      primaryRequirement: quickActionLead?.primaryRequirement || '',
      secondaryRequirement: quickActionLead?.secondaryRequirement || '',
      latitude: quickActionLead?.geoLat || null,
      longitude: quickActionLead?.geoLong || null,
      timeSpent: '',
      callResult: action.targetStatusCode === 'RNR' ? 'Not Answered' : 'Answered',
      locationId: quickActionLead?.interestedLocations?.[0]
        ? String(quickActionLead.interestedLocations[0])
        : (quickActionLead?.locationId ? String(quickActionLead.locationId) : ''),
      projectIds: quickActionLead?.interestedProjects?.length
        ? quickActionLead.interestedProjects.map((id) => String(id))
        : (quickActionLead?.projectId ? [String(quickActionLead.projectId)] : []),
    });

    if (action.needsAssignee) {
      loadAssignableUsers(targetAssigneeRole);
    }
    if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
      loadAssignableUsers('COL');
      // Load available inventory units for the lead's project
      if (quickActionLead?.projectId) {
        inventoryUnitApi.getDropdown({ project_id: quickActionLead.projectId }).then(resp => {
          setAvailableUnits(resp.data || []);
        }).catch(() => setAvailableUnits([]));
      }
    }

    if (action.needsSvDetails && action.code !== 'TC_SV_DONE') {
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
    if (isLeadReadOnly(quickActionLead)) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
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

        if (f.nextFollowUpAt && !isFollowUpAtLeastMinutesAhead(f.nextFollowUpAt)) {
          toast.error('Follow-up time must be greater than current time');
          setQuickActionLoading(false);
          return;
        }

        if (isRemarkMandatoryForAction(quickWorkflowAction)) {
          const hasRemark = Boolean((f.statusRemarkText || '').trim() || (f.note || '').trim());
          if (!hasRemark) {
            toast.error('Remark is mandatory for this status/action');
            setQuickActionLoading(false);
            return;
          }
        }

        if (quickWorkflowNeedsMissingLocationProject) {
          const hasLocationForSubmit = quickLeadHasLocation
            || (f.locationId && String(f.locationId).trim() !== '')
            || (quickMissingLocationId && String(quickMissingLocationId).trim() !== '');
          const hasProjectForSubmit = quickLeadHasProject
            || (f.projectIds && f.projectIds.length > 0)
            || (quickMissingProjectIds && quickMissingProjectIds.length > 0);

          if (!hasLocationForSubmit) {
            toast.error('Please select a location for this lead before performing this action.');
            setQuickActionLoading(false);
            return;
          }

          if (!hasProjectForSubmit) {
            toast.error('Please select a project for this lead before performing this action.');
            setQuickActionLoading(false);
            return;
          }
        }

        if (quickWorkflowAction.needsAssignee && !f.assignToUserId) {
          toast.error(quickWorkflowAction.code === 'TC_SV_DONE' ? 'Please select a Sales Manager' : 'Please select an assignee');
          setQuickActionLoading(false);
          return;
        }

        if (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && !f.svDate) {
          toast.error('Please select the site visit date');
          setQuickActionLoading(false);
          return;
        }

        if ((quickWorkflowAction.needsSvDetails || quickWorkflowAction.code === 'TC_SV_DONE') && !f.svProjectId) {
          toast.error('Please select the project visited');
          setQuickActionLoading(false);
          return;
        }

        if (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && (f.budgetMin === '' || f.budgetMax === '')) {
          toast.error('Please enter Budget Min and Budget Max');
          setQuickActionLoading(false);
          return;
        }

        if (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && Number(f.budgetMax) < Number(f.budgetMin)) {
          toast.error('Budget Max must be greater than or equal to Budget Min');
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
          statusRemarkResponseType: quickRemarkAnsNonAns || f.callResult || undefined,
          nextFollowUpAt: f.nextFollowUpAt ? new Date(f.nextFollowUpAt).toISOString() : undefined,
          assignToUserId: f.assignToUserId || undefined,
          closureReasonId: f.closureReasonId || undefined,
          callResult: undefined,
          reason: f.reason.trim() || undefined,
          svDate: quickWorkflowAction.code !== 'TC_SV_DONE' ? (f.svDate || undefined) : undefined,
          svProjectId: f.svProjectId || undefined,
          budgetMin: (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && f.budgetMin !== '') ? Number(f.budgetMin) : undefined,
          budgetMax: (quickWorkflowAction.needsSvDetails && quickWorkflowAction.code !== 'TC_SV_DONE' && f.budgetMax !== '') ? Number(f.budgetMax) : undefined,
          motivationType: f.motivationType || undefined,
          primaryRequirement: f.primaryRequirement || undefined,
          secondaryRequirement: f.secondaryRequirement || undefined,
          latitude: f.latitude || undefined,
          longitude: f.longitude || undefined,
          // server expects `time_spent`; keep camel-case for compatibility elsewhere
          time_spent: f.timeSpent ? Number(f.timeSpent) : undefined,
        };
        
        // ── ALWAYS include location/project IDs from form state, quickMissing state, OR existing lead data ──
        const intLocs = (quickActionLead?.interestedLocations || []).filter(id => id && String(id).trim() !== '');
        const formLocId = (f.locationId && String(f.locationId).trim() !== '') ? f.locationId : '';
        const missingLocId = (quickMissingLocationId && String(quickMissingLocationId).trim() !== '') ? quickMissingLocationId : '';
        const resolvedLocationId = formLocId
          || missingLocId
          || quickActionLead?.locationId
          || (intLocs.length > 0 ? intLocs[0] : '');
        
        const intProjs = (quickActionLead?.interestedProjects || []).filter(id => id && String(id).trim() !== '');
        const formProjIds = (f.projectIds && f.projectIds.length > 0)
          ? f.projectIds.filter(id => id && String(id).trim() !== '')
          : [];
        const missingProjIds = (quickMissingProjectIds && quickMissingProjectIds.length > 0)
          ? quickMissingProjectIds.filter(id => id && String(id).trim() !== '')
          : [];
        const resolvedProjectIds = formProjIds.length > 0
          ? formProjIds
          : (missingProjIds.length > 0
              ? missingProjIds
              : (intProjs.length > 0 
                  ? intProjs.map(String)
                  : (quickActionLead?.projectId ? [String(quickActionLead.projectId)] : [])));

        // eslint-disable-next-line no-console
        console.warn('[TRANSITION PAYLOAD DEBUG]', {
          formLocationId: f.locationId,
          formProjectIds: f.projectIds,
          quickMissingLocationId,
          quickMissingProjectIds,
          leadLocationId: quickActionLead?.locationId,
          leadInterestedLocations: quickActionLead?.interestedLocations,
          resolvedLocationId,
          resolvedProjectIds,
        });

        if (resolvedLocationId) {
          payload.location_id = resolvedLocationId;
          payload.locationId = resolvedLocationId;
          payload.location_ids = [resolvedLocationId];
        }

        if (resolvedProjectIds.length > 0) {
          payload.project_id = resolvedProjectIds[0];
          payload.projectId = resolvedProjectIds[0];
          payload.project_ids = resolvedProjectIds;
        }

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
          payload.inventoryUnitId = pF.inventoryUnitId || undefined;
        }

        if (quickWorkflowAction.code === 'TC_REASSIGN') {
          if (!f.assignToUserId) {
            toast.error('Please select a telecaller to reassign');
            setQuickActionLoading(false);
            return;
          }
          await leadWorkflowApi.assignLead(quickActionLead.id, f.assignToUserId, f.note.trim() || 'Telecaller manual reassignment');
        } else {
          // Log payload to help debug 400 errors from server
          // eslint-disable-next-line no-console
          console.debug('Submitting transition payload', { leadId: quickActionLead.id, action: quickWorkflowAction.code, payload });
          try {
            await leadWorkflowApi.transitionLead(quickActionLead.id, quickWorkflowAction.code, payload);
          } catch (apiErr) {
            // If server returned structured error, show it
            if (apiErr?.response?.data) {
              const msg = apiErr.response.data.message || apiErr.response.data.error || JSON.stringify(apiErr.response.data);
              toast.error(msg);
            }
            throw apiErr;
          }
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
          <button type="button" className="workspace-btn workspace-btn--ghost" onClick={() => loadLeads({ silent: true })} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="workspace-btn workspace-btn--primary" onClick={() => setNewLeadOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PlusCircleIcon style={{ width: 16, height: 16 }} /> New Lead
          </button>
        </div>
      </header>

      {/* ── Stats (KPI cards) - shown only for admin workspaces ── */}
      {workspaceRole !== 'TC' && workspaceRole !== 'SM' && workspaceRole !== 'SH' && workspaceRole !== 'COL' && (
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

          {/* Tabs for follow-up roles */}
          {FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && (
            <div style={{ display: 'flex', gap: 4, padding: '10px 16px 12px', borderBottom: '1px solid var(--border-secondary)' }}>
              <button
                onClick={() => setActiveTab('today')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'today' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'today' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Today&apos;s Follow Ups
              </button>
              {FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && (
              <button
                onClick={() => setActiveTab('missed')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'missed' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'missed' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Missed Follow Ups
              </button>
              )}
              {workspaceRole === 'TC' && (
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
              )}
              {workspaceRole === 'SM' && (
              <button
                onClick={() => setActiveTab('sh_leads')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'sh_leads' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'sh_leads' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                SH Leads (Read Only)
              </button>
              )}
              {workspaceRole === 'SH' && (
              <button
                onClick={() => setActiveTab('sm_leads')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeTab === 'sm_leads' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'sm_leads' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                SM Leads (Read Only)
              </button>
              )}
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
                  <th>Assignment / Ownership</th>
                  <th style={{ textAlign: 'right' }}>Follow up</th>
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
                    className={selectedLeadId === lead.id ? 'is-selected' : ''}
                  >
                    <td>
                      <p className="lead-title">{lead.fullName}</p>
                      <small>
                        <a 
                          href={`/portal/lead/${lead.id}`}
                          onClick={(e) => { e.preventDefault(); navigate(`/portal/lead/${lead.id}`); }}
                          style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          {lead.leadNumber}
                        </a>
                      </small>
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
                    <td>
                      <p className="assigned-name">{lead.assignedToUserName || 'Unassigned'}</p>
                      <small className="assigned-role">
                        {lead.assignedRoleLabel || lead.ownerRoleLabel || lead.assignedRole || lead.ownerRole || 'Pool'}
                      </small>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {activeTab !== 'new' && activeTab !== 'unassigned' && (
                        <button
                          className="crm-btn crm-btn-sm"
                          style={{ marginRight: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/portal/lead/${lead.id}`); }}
                        >
                          <EyeIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> View
                        </button>
                      )}
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
                              setActiveTab('today');
                            } catch (err) {
                              toast.error(getErrorMessage(err, 'Failed to claim lead'));
                            }
                          }}
                        >
                          🙋 Claim
                        </button>
                      )}
                      {(lead.assignedToUserId || activeTab !== 'new') && (
                        <button
                          className="crm-btn crm-btn-primary crm-btn-sm"
                          disabled={
                            isLeadReadOnly(lead)
                            || (FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && activeTab === 'today' && hasPendingMissedFollowupsForMe)
                          }
                          title={
                            FOLLOW_UP_WORKSPACE_ROLES.includes(workspaceRole) && activeTab === 'today' && hasPendingMissedFollowupsForMe
                              ? 'Complete missed follow-ups first to enable today actions'
                              : undefined
                          }
                          onClick={async (e) => {
                            e.stopPropagation();
                            resetQuickWorkflowForm();
                            setQuickActionLead(lead);
                            setQaActiveTab('history');
                            // Load site visits and activities for this lead
                            let activities = [];
                            try {
                              const [svResp, actResp] = await Promise.all([
                                siteVisitApi.getAll({ lead_id: lead.id }),
                                leadWorkflowApi.getLeadActivities(lead.id)
                              ]);
                              setQuickActionSiteVisits(svResp.data?.rows || svResp.data || []);
                              activities = actResp.data || [];
                              setQuickActionActivities(activities);
                            } catch {
                              setQuickActionSiteVisits([]);
                              setQuickActionActivities([]);
                            }

                            // Auto-select last action based on the lead's current status
                            if (!lead.isClosed) {
                              const leadStatus = lead.statusCode || '';
                              if (leadStatus) {
                                const matchingAction = roleActions.find(
                                  (a) => a.targetStatusCode === leadStatus && a.tone !== 'danger'
                                );
                                if (matchingAction) {
                                  setTimeout(() => handleQuickWorkflowActionSelect(matchingAction), 100);
                                }
                              }
                            }
                          }}
                        >
                          <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Follow up
                        </button>
                      )}
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
                  {selectedLeadReadOnly && (
                    <span
                      className="crm-badge"
                      style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontWeight: 700 }}
                      title="You can view this lead but cannot update it after handoff to Sales Head"
                    >
                      Read-Only
                    </span>
                  )}
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
                        {selectedLeadReadOnly && (
                          <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>This lead is currently view-only for you after handoff to Sales Head.</p>
                        )}
                        <div className="lead-detail__quick-actions">
                          <button className="crm-btn crm-btn-success crm-btn-sm" onClick={handleAddNote} disabled={selectedLeadReadOnly}>📞 Log Call</button>
                          {/* SV Recording moved to roleActions in drawer */}
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={selectedLeadReadOnly}>💬 WhatsApp</button>
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={selectedLeadReadOnly}>📧 Email</button>
                          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => document.getElementById('note-input')?.focus()} disabled={selectedLeadReadOnly}>📝 Add Note</button>
                          <button
                            className="crm-btn crm-btn-warning crm-btn-sm"
                            disabled={selectedLeadReadOnly}
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
                          disabled={selectedLeadReadOnly}
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
                        <select className="crm-form-select" value="" disabled={selectedLeadReadOnly} onChange={(e) => { if (e.target.value) openStagePopup(e.target.value); }}>
                          <option value="">{selectedLead.stageLabel} (current)</option>
                          {stageTransitionOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.stageLabel}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="crm-form-label">Status</div>
                        <select className="crm-form-select" value={manualStatus} disabled={selectedLeadReadOnly} onChange={(e) => setManualStatus(e.target.value)}>
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
                        value={manualNextFollowUpAt || ''}
                        onChange={(val) => setManualNextFollowUpAt(val ? val.slice(0, 16) : '')}
                        placeholder="Select Date & Time..."
                        className="lead-detail__calendar-input"
                        minDate={getFollowUpMinimumTime().toISOString()}
                        disabled={selectedLeadReadOnly}
                      />
                      <div className="lead-detail__calendar-shortcuts">
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(0, 14, 0))}>Today 2 PM</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(0, 18, 0))}>Today 6 PM</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpValue(1, 11, 0))}>Tomorrow 11 AM</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpForWeekday(6, 11, 0))}>This Sat 11 AM</button>
                        <button type="button" className="calendar-shortcut-btn" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt(getQuickFollowUpForWeekday(0, 11, 0))}>This Sun 11 AM</button>
                        <button type="button" className="calendar-shortcut-btn calendar-shortcut-btn--clear" disabled={selectedLeadReadOnly} onClick={() => setManualNextFollowUpAt('')}>✕ Clear</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <div className="crm-form-label">Notes</div>
                      <textarea id="note-input" className="crm-form-input" rows={2} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Add notes..." disabled={selectedLeadReadOnly} />
                    </div>
                    <div className="lead-detail__save-bar">
                      {noteDraft.trim() && (
                        <button type="button" className="workspace-btn workspace-btn--ghost" onClick={handleAddNote} disabled={selectedLeadReadOnly}>📝 Save Note</button>
                      )}
                      <button
                        type="button"
                        className="workspace-btn workspace-btn--primary"
                        onClick={handleManualStatusUpdate}
                        disabled={
                          manualUpdateSaving
                          || selectedLeadReadOnly
                          || (['NEW', 'RNR', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(toCanonicalStatusCode(manualStatus)) && !manualNextFollowUpAt)
                          || (Boolean(manualNextFollowUpAt) && !isFollowUpAtLeastMinutesAhead(manualNextFollowUpAt))
                        }
                      >
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
                            {evt.description && <div className="tl-text">{formatActivityDescription(evt.description, evt)}</div>}
                            {(evt.metadata?.statusRemarkResponseType || evt.metadata?.callResult || evt.metadata?.last_call_result) && (
                              <div className="tl-text" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                Call Status: {(evt.metadata?.statusRemarkResponseType || evt.metadata?.callResult || evt.metadata?.last_call_result || '').replace('-', ' ')}
                              </div>
                            )}
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
                  value={stagePopupData.followUpAt || ''}
                  onChange={(val) => setStagePopupData((p) => ({ ...p, followUpAt: val ? val.slice(0, 16) : '' }))}
                  placeholder="Select Date & Time..."
                  className="lead-detail__calendar-input"
                  minDate={getFollowUpMinimumTime().toISOString()}
                />
                <div className="lead-detail__calendar-shortcuts">
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(0, 14, 0) }))}>Today 2 PM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today 6 PM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tomorrow 11 AM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat 11 AM</button>
                  <button type="button" className="calendar-shortcut-btn" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun 11 AM</button>
                  <button type="button" className="calendar-shortcut-btn calendar-shortcut-btn--clear" onClick={() => setStagePopupData((p) => ({ ...p, followUpAt: '' }))}>✕ Clear</button>
                </div>
                <div className="followup-warning">⚠️ Follow-up date & time is required for this stage.</div>
              </div>

              {/* Assignee selection in Modal */}
              {stagePopupAction?.needsAssignee && (
                <div style={{ marginBottom: 18 }}>
                  <div className="crm-form-label" style={{ marginBottom: 6 }}>
                    {getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SH' ? 'Select Sales Head (Negotiator) *' :
                     getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SM' ? 'Select Sales Manager *' : 'Assign To *'}
                  </div>
                  <select
                    className="crm-form-select"
                    value={stagePopupData.assignToUserId}
                    onChange={(e) => setStagePopupData(p => ({ ...p, assignToUserId: e.target.value }))}
                  >
                    <option value="">
                      {getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SH' ? 'Select Sales Head...' :
                       getAssigneeRoleForAction(stagePopupAction, workspaceRole) === 'SM' ? 'Select Sales Manager...' : 'Select user...'}
                    </option>
                    {(assignableUsers[getAssigneeRoleForAction(stagePopupAction, workspaceRole)] || [])
                      .filter((u) => {
                        const currentAssigneeId = selectedLead?.assignedToUserId || null;
                        if (String(u.id) === String(currentAssigneeId)) return false;

                        if (stagePopupAction?.code === 'TC_REASSIGN') {
                          const leadLocationId = selectedLead?.locationId || (selectedLead?.interestedLocations?.[0]) || null;
                          if (!leadLocationId) return true;
                          return Array.isArray(u.locationIds) && u.locationIds.some(locId => String(locId) === String(leadLocationId));
                        }
                        return true;
                      })
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Call Result Toggle */}
              {shouldShowCallStatus(stagePopupAction?.targetStatusCode) && (
                <div className="call-result-wrap">
                  <div className="call-result-label">Call Status</div>
                  <div className="call-result-toggle">
                    <button
                      type="button"
                      className={`call-result-btn ${stagePopupData.callResult === 'Answered' ? 'active' : ''}`}
                      onClick={() => setStagePopupData(p => ({ ...p, callResult: 'Answered' }))}
                    >
                      Answered
                    </button>
                    <button
                      type="button"
                      className={`call-result-btn ${stagePopupData.callResult === 'Not Answered' ? 'active' : ''}`}
                      onClick={() => setStagePopupData(p => ({ ...p, callResult: 'Not Answered' }))}
                    >
                      Not Answered
                    </button>
                  </div>
                </div>
              )}

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

              {/* Missing Information Block for Modal */}
              {(!selectedLeadHasLocation || !selectedLeadHasProjectFromLead) && (
                <div className="qa-drawer-ctx-block" style={{ border: '1px solid #fee2e2', background: '#fff1f1', margin: '0 0 15px', padding: '12px', borderRadius: '8px' }}>
                  <div className="qa-drawer-section" style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 8px', fontSize: 13, fontWeight: 700 }}>
                    <ExclamationTriangleIcon style={{ width: 16, height: 16 }} /> Missing Information
                  </div>
                  {!selectedLeadHasLocation && (
                    <div style={{ marginBottom: 10 }}>
                      <label className="qa-drawer-field-label" style={{ color: '#7f1d1d' }}>Primary Location *</label>
                      <select
                        className="qa-drawer-field-select"
                        style={{ width: '100%', borderColor: '#fca5a5' }}
                        value={quickMissingLocationId}
                        onChange={(e) => setQuickMissingLocationId(e.target.value)}
                      >
                        <option value="">Select Location...</option>
                        {locationOptions.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                      </select>
                    </div>
                  )}
                  {!selectedLeadHasProject && (
                    <div>
                      <label className="qa-drawer-field-label" style={{ color: '#7f1d1d' }}>Interested Project *</label>
                      <select
                        className="qa-drawer-field-select"
                        style={{ width: '100%', borderColor: '#fca5a5' }}
                        value={quickMissingProjectIds[0] || ''}
                        onChange={(e) => setQuickMissingProjectIds(e.target.value ? [e.target.value] : [])}
                      >
                        <option value="">Select Project...</option>
                        {projectOptions.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

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
                  disabled={
                    manualUpdateSaving
                    || (stagePopupData.needsFollowUp && !stagePopupData.followUpAt)
                    || (Boolean(stagePopupData.followUpAt) && !isFollowUpAtLeastMinutesAhead(stagePopupData.followUpAt))
                  }
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
          <div className="lead-workspace__modal-panel create-lead-panel">
            {/* ── Gradient Header ── */}
            <div className="create-lead-header">
              <div className="create-lead-header__title">
                <div className="create-lead-header__icon"><PlusCircleIcon style={{ width: 24, height: 24 }} /></div>
                <div>
                  <h2>Create New Lead</h2>
                  <div className="create-lead-header__subtitle">Fill in the details to register a new lead</div>
                </div>
              </div>
              <button
                type="button"
                className="create-lead-header__close"
                onClick={resetNewLeadModal}
              >
                <XMarkIcon style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleCreateLead}>
              <div className="create-lead-body">

                {/* ══ Section: Contact Information ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--contact"><UserIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Contact Information</div>
                      <div className="create-lead-section__subtitle">Primary contact details of the lead</div>
                    </div>
                  </div>

                  <div className="create-lead-grid create-lead-grid--3col">
                    {/* Full Name */}
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Full Name <span className="create-lead-field__required">*</span>
                      </label>
                      <input
                        className="create-lead-input"
                        value={newLeadForm.full_name}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, full_name: e.target.value }))}
                        required
                        placeholder="Enter buyer full name"
                      />
                    </div>

                    {/* Phone */}
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Phone <span className="create-lead-field__required">*</span>
                      </label>
                      <input
                        className={`create-lead-input ${phoneCheck.status === 'exists' ? 'create-lead-input--error' : phoneCheck.status === 'valid' ? 'create-lead-input--success' : ''}`}
                        value={newLeadForm.phone}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: sanitizePhoneNumberInput(e.target.value) }))}
                        maxLength={12}
                        required
                        placeholder="Primary contact number"
                      />
                      <div className="create-lead-phone-status">
                        <div>
                          {phoneCheck.status === 'exists' && <span className="create-lead-phone-status__msg create-lead-phone-status__msg--error"><ExclamationTriangleIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Exists: {phoneCheck.leadInfo}</span>}
                          {phoneCheck.status === 'valid' && <span className="create-lead-phone-status__msg create-lead-phone-status__msg--success"><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Valid</span>}
                        </div>
                        {phoneCheck.status === 'exists' && phoneCheck.duplicateLead && isClosedLostLead(phoneCheck.duplicateLead) && (
                          <button
                            type="button"
                            className={`create-lead-phone-status__btn ${reengageLeadId === phoneCheck.duplicateLead.id ? 'create-lead-phone-status__btn--active' : ''}`}
                            onClick={() => prefillFormFromDuplicateLead(phoneCheck.duplicateLead)}
                          >
                            {reengageLeadId === phoneCheck.duplicateLead.id ? <><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Reengage</> : 'Use this lead'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* WhatsApp Toggle */}
                    <label className="create-lead-whatsapp-toggle">
                      <input
                        type="checkbox"
                        checked={newLeadForm.whatsappSameAsPhone}
                        onChange={(e) =>
                          setNewLeadForm((p) => ({
                            ...p,
                            whatsappSameAsPhone: e.target.checked,
                            whatsapp_number: e.target.checked ? '' : p.whatsapp_number,
                          }))
                        }
                      />
                      WhatsApp same
                    </label>
                  </div>

                  {/* WhatsApp Number (if different) */}
                  {!newLeadForm.whatsappSameAsPhone && (
                    <div className="create-lead-grid" style={{ marginTop: 16 }}>
                      <div className="create-lead-field">
                        <label className="create-lead-field__label">WhatsApp Number</label>
                        <input
                          className="create-lead-input"
                          value={newLeadForm.whatsapp_number}
                          onChange={(e) => setNewLeadForm((p) => ({ ...p, whatsapp_number: sanitizePhoneNumberInput(e.target.value) }))}
                          maxLength={12}
                          placeholder="Enter WhatsApp number"
                        />
                      </div>
                      <div />
                    </div>
                  )}

                  {/* Alternate Phone & Email */}
                  <div className="create-lead-grid" style={{ marginTop: 16 }}>
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Alternate Phone <span className="create-lead-field__optional">(Optional)</span>
                      </label>
                      <input
                        className={`create-lead-input ${altPhoneCheck.status === 'exists' ? 'create-lead-input--error' : altPhoneCheck.status === 'valid' ? 'create-lead-input--success' : ''}`}
                        value={newLeadForm.alternate_phone}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, alternate_phone: sanitizePhoneNumberInput(e.target.value) }))}
                        maxLength={12}
                        placeholder="Secondary contact"
                      />
                      <div className="create-lead-phone-status">
                        <div>
                          {altPhoneCheck.status === 'exists' && <span className="create-lead-phone-status__msg create-lead-phone-status__msg--error"><ExclamationTriangleIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Already exists: {altPhoneCheck.leadInfo}</span>}
                          {altPhoneCheck.status === 'valid' && <span className="create-lead-phone-status__msg create-lead-phone-status__msg--success"><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Valid Number</span>}
                        </div>
                        {altPhoneCheck.status === 'exists' && altPhoneCheck.duplicateLead && isClosedLostLead(altPhoneCheck.duplicateLead) && (
                          <button
                            type="button"
                            className={`create-lead-phone-status__btn ${reengageLeadId === altPhoneCheck.duplicateLead.id ? 'create-lead-phone-status__btn--active' : ''}`}
                            onClick={() => prefillFormFromDuplicateLead(altPhoneCheck.duplicateLead)}
                          >
                            {reengageLeadId === altPhoneCheck.duplicateLead.id ? <><CheckIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Reengage</> : 'Use this lead'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Email <span className="create-lead-field__optional">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        className="create-lead-input"
                        value={newLeadForm.email}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* ══ Section: Lead Classification ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--classify"><TagIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Lead Classification</div>
                      <div className="create-lead-section__subtitle">Set status and source information</div>
                    </div>
                  </div>

                  <div className="create-lead-grid">
                    <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                      <label className="create-lead-field__label">
                        Lead Status <span className="create-lead-field__required">*</span>
                      </label>
                      <div className="create-lead-status-chips">
                        {newLeadStatusChipOptions.map((st) => {
                          const isSelected = newLeadForm.lead_status_id === st.value || newLeadForm.lead_status_id === st.id;
                          const isTerminal = ['LOST', 'JUNK', 'SPAM'].includes(toCanonicalStatusCode(st.value));
                          return (
                            <button
                              key={st.value}
                              type="button"
                              className={`status-chip-btn ${isSelected ? 'status-chip-btn--active' : ''} ${isTerminal ? 'status-chip-btn--terminal' : ''}`}
                              onClick={() => {
                                const val = st.value;
                                setNewLeadForm((p) => ({
                                  ...p,
                                  lead_status_id: p.lead_status_id === val ? '' : val,
                                  callResult: toCanonicalStatusCode(val) === 'RNR' ? 'Not Answered' : p.callResult,
                                  assignment_mode: toCanonicalStatusCode(val) === 'RNR' ? 'ME' : p.assignment_mode,
                                  assigned_to: toCanonicalStatusCode(val) === 'RNR' ? (user?.id || '') : p.assigned_to,
                                  assignment_mode_manual: toCanonicalStatusCode(val) === 'RNR' ? false : p.assignment_mode_manual,
                                }));
                              }}
                            >
                              {isSelected && <CheckCircleIcon style={{ width: 15, height: 15, flexShrink: 0 }} />}
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Closure Details for terminal statuses */}
                  {['LOST', 'JUNK', 'SPAM', 'COLD_LOST'].includes(selectedNewLeadStatusCode) && (
                    <div className="create-lead-closure">
                      <div className="create-lead-closure__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ExclamationTriangleIcon style={{ width: 18, height: 18 }} /> Closure Details</div>
                      <div className="create-lead-grid">
                        <div className="create-lead-field">
                          <label className="create-lead-field__label">
                            Closure Reason <span className="create-lead-field__required">*</span>
                          </label>
                          <select
                            className="create-lead-select"
                            value={newLeadForm.closure_reason_id}
                            onChange={(e) => setNewLeadForm((p) => ({ ...p, closure_reason_id: e.target.value }))}
                          >
                            <option value="">Select reason...</option>
                            {closureReasons.map((r) => (
                              <option key={r.id} value={r.id}>{r.reason_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ══ Section: Location & Source ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--location"><MapPinIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Location, Projects &amp; Source</div>
                      <div className="create-lead-section__subtitle">Where the lead is interested and how they found us</div>
                    </div>
                  </div>

                    {(workspaceRole === 'SM' || ['NEW', 'FOLLOW_UP', 'SV_SCHEDULED'].includes(selectedNewLeadStatusCode)) && (
                      <div className="create-lead-grid">
                        {/* Location */}
                        <div className="create-lead-field">
                          <label className="create-lead-field__label">
                            Location <span className="create-lead-field__required">*</span>
                          </label>
                          <select
                            className="create-lead-select"
                            value={newLeadForm.location_id}
                            onChange={(e) => setNewLeadForm((p) => ({
                              ...p,
                              location_id: e.target.value,
                              location_ids: e.target.value ? [e.target.value] : [],
                              project_ids: [],
                            }))}
                            required
                          >
                            <option value="">Select location</option>
                            {locationOptions.map((loc) => (
                              <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Project Multi-Select */}
                        <div className="create-lead-field">
                          <label className="create-lead-field__label">
                            Project <span className="create-lead-field__required">*</span>
                          </label>
                          <div ref={projectDropdownRef} style={{ position: 'relative' }}>
                            <div
                              className="create-lead-project-trigger"
                              onClick={() => setProjectDropdownOpen((p) => !p)}
                            >
                              {selectedProjectNames.length === 0 && <span className="create-lead-project-trigger__placeholder">Select projects...</span>}
                              {selectedProjectNames.map((name, i) => (
                                <span key={i} className="create-lead-project-chip">
                                  {name}
                                  <span
                                    className="create-lead-project-chip__remove"
                                    onClick={(ev) => { ev.stopPropagation(); toggleProject((newLeadForm.project_ids || [])[i]); }}
                                  >×</span>
                                </span>
                              ))}
                            </div>

                            {projectDropdownOpen && (
                              <div className="create-lead-project-dropdown" style={{ zIndex: 100 }}>
                                <div className="create-lead-project-dropdown__search">
                                  <input
                                    type="text"
                                    placeholder="Search projects..."
                                    value={projectSearch}
                                    onChange={(e) => setProjectSearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="create-lead-project-dropdown__list">
                                  {filteredProjectOptions.map((project) => (
                                    <label key={project.id} className="create-lead-project-dropdown__item">
                                      <input
                                        type="checkbox"
                                        checked={(newLeadForm.project_ids || []).includes(project.id)}
                                        onChange={() => toggleProject(project.id)}
                                      />
                                      <span>
                                        {getProjectDisplayName(project)}
                                      </span>
                                    </label>
                                  ))}
                                  {filteredProjectOptions.length === 0 && (
                                    <div className="create-lead-project-dropdown__empty">No projects found</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Source & Sub-Source */}
                  <div className="create-lead-grid" style={{ marginTop: 16 }}>
                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Lead Source <span className="create-lead-field__required">*</span>
                      </label>
                      <select
                        className="create-lead-select"
                        value={newLeadForm.lead_source_id}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_source_id: e.target.value, lead_sub_source_id: '' }))}
                        required
                      >
                        <option value="">Select lead source</option>
                        {sourceOptions.map((s) => (
                          <option key={s.id} value={s.id}>{s.source_name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="create-lead-field">
                      <label className="create-lead-field__label">
                        Lead Sub-Source {workspaceRole === 'TC' && <span className="create-lead-field__required">*</span>}
                      </label>
                      <select
                        className={`create-lead-select ${workspaceRole === 'TC' && newLeadForm.lead_source_id && !newLeadForm.lead_sub_source_id ? 'create-lead-select--highlight' : ''}`}
                        value={newLeadForm.lead_sub_source_id}
                        onChange={(e) => setNewLeadForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))}
                        disabled={!newLeadForm.lead_source_id || !selectedSourceSubSources.length}
                        required={workspaceRole === 'TC'}
                      >
                        <option value="">Select sub-source</option>
                        {selectedSourceSubSources.map((s) => (
                          <option key={s.id} value={s.id}>{s.sub_source_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ══ Section: Follow-Up & Assignment ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-grid">
                    {workspaceRole === 'SM' && smStatusNeedsAssignee && (
                      <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                        <label className="create-lead-field__label">
                          Sales Head <span className="create-lead-field__required">*</span>
                        </label>
                        <select
                          className="create-lead-select"
                          value={newLeadForm.assigned_to}
                          onChange={(e) => setNewLeadForm((p) => ({ ...p, assigned_to: e.target.value }))}
                          required
                        >
                          <option value="">Select Sales Head</option>
                          {(assignableUsers.SH || []).map((u) => (
                            <option key={u.id} value={u.id}>{u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {((workspaceRole === 'TC' && ['NEW', 'RNR', 'SV_SCHEDULED', 'FOLLOW_UP'].includes(selectedNewLeadStatusCode))
                      || (workspaceRole === 'SM' && smStatusNeedsFollowUp)) && (
                        <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                          <label className="create-lead-field__label">
                            Next Follow-Up Date <span className="create-lead-field__required">*</span>
                          </label>
                          <div className="create-lead-followup-chips" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
                            {newLeadFollowUpShortcutOptions.map((shortcut) => (
                              <button
                                key={shortcut.label}
                                type="button"
                                className="calendar-shortcut-btn"
                                style={{ width: '100%', minWidth: 0, whiteSpace: 'nowrap' }}
                                onClick={() => setNewLeadForm((p) => ({ ...p, nextFollowUpAt: shortcut.value }))}
                              >
                                {shortcut.label}
                              </button>
                            ))}
                          </div>
                          <CalendarPicker
                            type="datetime"
                            value={newLeadForm.nextFollowUpAt}
                            onChange={(val) => setNewLeadForm((p) => ({ ...p, nextFollowUpAt: val }))}
                            placeholder="Select follow-up date & time..."
                            minDate={getFollowUpMinimumTime().toISOString()}
                          />
                        </div>
                      )}

                    {/* Call Status Selection for New Lead */}
                    {shouldShowCreateCallStatus && (
                        <div className="create-lead-field" style={{ gridColumn: 'span 2' }}>
                          <div className="call-result-label">Call Status <span className="create-lead-field__required">*</span></div>
                          <div className="call-result-toggle">
                            <button
                              type="button"
                              className={`call-result-btn ${newLeadForm.callResult === 'Answered' ? 'active' : ''}`}
                              onClick={() => setNewLeadForm((p) => ({ ...p, callResult: 'Answered' }))}
                            >
                              Answered
                            </button>
                            <button
                              type="button"
                              className={`call-result-btn ${newLeadForm.callResult === 'Not Answered' ? 'active' : ''}`}
                              onClick={() => setNewLeadForm((p) => ({ ...p, callResult: 'Not Answered' }))}
                            >
                              Not Answered
                            </button>
                          </div>
                        </div>
                      )}

                  </div>
                </div>

                  {workspaceRole === 'SM' && (
                    <div className="create-lead-section">
                      <div className="create-lead-section__header">
                        <div className="create-lead-section__icon create-lead-section__icon--location"><HomeModernIcon style={{ width: 20, height: 20 }} /></div>
                        <div>
                          <div className="create-lead-section__title">Site Visit Details</div>
                          <div className="create-lead-section__subtitle">Capture visit details while creating lead</div>
                        </div>
                      </div>

                      <div className="create-lead-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                        <div className="create-lead-field">
                          <label className="create-lead-field__label">Visit Date</label>
                          <input
                            type="date"
                            className="create-lead-input"
                            value={newLeadForm.svDate}
                            onChange={(e) => setNewLeadForm((p) => ({ ...p, svDate: e.target.value }))}
                          />
                        </div>
                        <div className="create-lead-field">
                          <label className="create-lead-field__label">Customer Type</label>
                          <select className="create-lead-input" value={newLeadForm.customerTypeId || ''} onChange={(e) => setNewLeadForm((p) => ({ ...p, customerTypeId: e.target.value }))}>
                            <option value="">Select...</option>
                            {customerTypeOptions.map((ct) => <option key={ct.id} value={ct.id}>{ct.type_name}</option>)}
                          </select>
                        </div>

                        <div className="create-lead-field">
                          <label className="create-lead-field__label">Motivation</label>
                          <select className="create-lead-input" value={newLeadForm.motivationType || ''} onChange={(e) => setNewLeadForm((p) => ({ ...p, motivationType: e.target.value }))}>
                            <option value="">Select...</option>
                            {motivationOptions.map((m) => <option key={m.id} value={m.motivation_name}>{m.motivation_name}</option>)}
                          </select>
                        </div>

                        <div className="create-lead-field">
                          <label className="create-lead-field__label">Customer Requirement</label>
                          <input
                            className="create-lead-input"
                            value={newLeadForm.customerRequirement}
                            onChange={(e) => setNewLeadForm((p) => ({ ...p, customerRequirement: e.target.value }))}
                            placeholder="e.g. 2BHK near metro"
                          />
                        </div>

                        <div className="create-lead-field">
                          <label className="create-lead-field__label">Time Spent (mins)</label>
                          <input
                            type="number"
                            min="0"
                            className="create-lead-input"
                            value={newLeadForm.timeSpent}
                            onChange={(e) => setNewLeadForm((p) => ({ ...p, timeSpent: e.target.value }))}
                            placeholder="e.g. 30"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                {/* ══ Section: Notes & Remarks ══ */}
                <div className="create-lead-section">
                  <div className="create-lead-section__header">
                    <div className="create-lead-section__icon create-lead-section__icon--notes"><PencilSquareIcon style={{ width: 20, height: 20 }} /></div>
                    <div>
                      <div className="create-lead-section__title">Notes &amp; Remarks{createLeadNeedsRemark ? ' *' : ''}</div>
                      <div className="create-lead-section__subtitle">Add quick tags or custom notes</div>
                    </div>
                  </div>

                  <div className="create-lead-chips">
                    {remarksLoading ? (
                      <div className="create-lead-remarks-loading">
                        <div className="create-lead-shimmer" />
                        <div className="create-lead-shimmer" />
                        <div className="create-lead-shimmer" />
                      </div>
                    ) : (
                      (() => {
                        const chips = newLeadStatusRemarks.length > 0
                          ? newLeadStatusRemarks
                          : NEW_LEAD_REMARK_CHIPS.map(c => ({ remark_text: c }));

                        return chips.map((remark, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className={`create-lead-chip ${newLeadForm.remark.trim() === remark.remark_text ? 'create-lead-chip--active' : ''}`}
                            onClick={() => {
                              const text = remark.remark_text;
                              setNewLeadForm((p) => ({ ...p, remark: p.remark.trim() === text ? '' : text }));
                            }}
                          >
                            + {remark.remark_text}
                          </button>
                        ))
                      })()
                    )}
                  </div>

                  <textarea
                    className="create-lead-textarea"
                    rows={2}
                    value={newLeadForm.remark}
                    onChange={(e) => setNewLeadForm((p) => ({ ...p, remark: e.target.value }))}
                    required={createLeadNeedsRemark}
                    placeholder="Add notes or remarks about the lead..."
                  />
                </div>

              </div>

              {/* ── Footer ── */}
              <div className="create-lead-footer">
                {workspaceRole === 'TC' && selectedNewLeadStatusCode !== 'RNR' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginRight: 'auto' }}>
                    <div className="call-result-label" style={{ marginBottom: 0 }}>Lead Assignment</div>
                    <div className="call-result-toggle" style={{ marginBottom: 0 }}>
                      <button
                        type="button"
                        className={`call-result-btn ${newLeadForm.assignment_mode !== 'POOL' ? 'active' : ''}`}
                        onClick={() => setNewLeadForm((p) => ({ ...p, assignment_mode: 'ME', assigned_to: user?.id || '', assignment_mode_manual: true }))}
                        disabled={!tcCanSelfAssignSelectedLocation && selectedCreateLocationIds.length > 0}
                        title={!tcCanSelfAssignSelectedLocation && selectedCreateLocationIds.length > 0 ? 'Selected location is not mapped to you' : undefined}
                      >
                        Assign to me
                      </button>
                      <button
                        type="button"
                        className={`call-result-btn ${newLeadForm.assignment_mode === 'POOL' ? 'active' : ''}`}
                        onClick={() => setNewLeadForm((p) => ({ ...p, assignment_mode: 'POOL', assigned_to: '', assignment_mode_manual: true }))}
                      >
                        Unassigned pool
                      </button>
                    </div>
                    {!tcCanSelfAssignSelectedLocation && selectedCreateLocationIds.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Selected location is outside your mapped locations. Lead will go to unassigned pool.
                      </div>
                    )}
                  </div>
                )}

                {workspaceRole === 'TC' && selectedNewLeadStatusCode === 'RNR' && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 'auto' }}>
                    RNR leads are auto-assigned to you.
                  </div>
                )}

                <button
                  type="button"
                  className="create-lead-footer__cancel"
                  onClick={resetNewLeadModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="create-lead-footer__submit"
                  disabled={
                    creating
                    || !newLeadValidation.isValid
                    || ((phoneCheck.status === 'exists' || altPhoneCheck.status === 'exists')
                      && ![
                        phoneCheck.duplicateLead?.id,
                        altPhoneCheck.duplicateLead?.id,
                      ].filter(Boolean).includes(reengageLeadId))
                  }
                >
                  {creating ? 'Creating...' : <><CheckIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Create Lead</>}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <label>
                  Budget Min
                  <input
                    type="number"
                    min="0"
                    value={recordSvForm.budgetMin}
                    onChange={(e) => setRecordSvForm((p) => ({ ...p, budgetMin: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Minimum budget"
                  />
                </label>
                <label>
                  Budget Max
                  <input
                    type="number"
                    min="0"
                    value={recordSvForm.budgetMax}
                    onChange={(e) => setRecordSvForm((p) => ({ ...p, budgetMax: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Maximum budget"
                  />
                </label>
              </div>

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
                  disabled={!recordSvForm.assignToUserId || !recordSvForm.latitude || !recordSvForm.svProjectId || !recordSvForm.motivationType || recordSvForm.budgetMin === '' || recordSvForm.budgetMax === ''}
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
                Date of Site Visit
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Budget Min
                  <input
                    type="number"
                    min="0"
                    value={svDoneForm.budgetMin}
                    onChange={(e) => setSvDoneForm((p) => ({ ...p, budgetMin: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Minimum budget"
                  />
                </label>
                <label>
                  Budget Max
                  <input
                    type="number"
                    min="0"
                    value={svDoneForm.budgetMax}
                    onChange={(e) => setSvDoneForm((p) => ({ ...p, budgetMax: e.target.value }))}
                    style={{ width: '100%' }}
                    placeholder="Maximum budget"
                  />
                </label>
              </div>

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
                  disabled={!svDoneForm.assignToUserId || !svDoneForm.svProjectId || svDoneForm.budgetMin === '' || svDoneForm.budgetMax === ''}
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
                >
                  {(quickActionLead.fullName || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="qa-drawer-name">{quickActionLead.fullName}</div>
                  {quickActionLeadReadOnly && (
                    <div>
                      <span
                        className="crm-badge"
                        style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D', fontWeight: 700, marginTop: 4 }}
                        title="You can view this lead but cannot update it after handoff to Sales Head"
                      >
                        Read-Only
                      </span>
                    </div>
                  )}
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
                    <PhoneIcon style={{ width: 18, height: 18 }} />
                  </button>
                  <button
                    className="qa-header-icon-btn"
                    title="WhatsApp"
                    onClick={() => window.open(`https://wa.me/${(quickActionLead.whatsappNumber || quickActionLead.phone || '').replace(/\D/g, '')}`, '_blank')}
                  >
                    <ChatBubbleLeftIcon style={{ width: 18, height: 18 }} />
                  </button>
                </div>
                <button
                  className="qa-drawer-close"
                  onClick={() => {
                    setQuickActionLead(null);
                    resetQuickWorkflowForm();
                  }}
                >
                  <XMarkIcon style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* ── Scrollable Drawer Body ── */}
            <div className="qa-drawer-body">

              {/* ── Update Status (Status Grid) ── */}
              {!quickActionLead.isClosed && (
                <>
                  <div className="qa-drawer-section">Update status</div>
                  {quickActionLeadReadOnly && (
                    <p style={{ margin: '0 20px 8px', fontSize: 12, color: 'var(--text-muted)' }}>This lead is view-only for you after handoff to Sales Head.</p>
                  )}
                  <div className="qa-drawer-status-grid">
                    {roleActions.filter((a) => {
                      const isNegotiation = a.code.includes('NEGOTIATION');
                      const isHotNegotiation = a.code.includes('NEGOTIATION_HOT') || a.targetStatusCode === 'NEGOTIATION_HOT';
                      const allowNegotiationAction = workspaceRole === 'SH' ? true : (!isNegotiation || isHotNegotiation);
                      return a.tone !== 'danger' && allowNegotiationAction;
                    }).map((action) => {
                      let icon = <ClipboardDocumentListIcon style={{ width: 18, height: 18 }} />;
                      let selClass = 'sel-default';
                      if (action.code.includes('RNR')) { icon = <ArrowPathIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-rnr'; }
                      else if (action.code.includes('SV_DONE') || action.code.includes('SITE_VISIT')) { icon = <CheckCircleIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-done'; }
                      else if (action.code.includes('SCHEDULE') || action.code.includes('REVISIT')) { icon = <CalendarDaysIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-scheduled'; }
                      else if (action.code.includes('FOLLOW_UP')) { icon = <PhoneIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }
                      else if (action.code.includes('NEGOTIATION')) { icon = <HandRaisedIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-negotiation'; }
                      else if (action.code.includes('BOOKING')) { icon = <SparklesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                      else if (action.code.includes('PAYMENT')) { icon = <BanknotesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                      else if (action.code.includes('REASSIGN')) { icon = <UserIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }

                      return (
                        <button
                          key={action.code}
                          type="button"
                          className={`qa-drawer-st-btn ${quickWorkflowAction?.code === action.code ? selClass : ''}`}
                          disabled={quickActionLoading || quickActionLeadReadOnly}
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
                        disabled={quickActionLoading || quickActionLeadReadOnly}
                        onClick={() => handleQuickWorkflowActionSelect(action)}
                      >
                        <div className="qa-drawer-st-icon">{action.code.includes('JUNK') ? <NoSymbolIcon style={{ width: 18, height: 18 }} /> : action.code.includes('SPAM') ? <TrashIcon style={{ width: 18, height: 18 }} /> : <ExclamationTriangleIcon style={{ width: 18, height: 18 }} />}</div>
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
                        minDate={getFollowUpMinimumTime().toISOString()}
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
                            const currentAssigneeId = quickActionLead?.assignedToUserId || selectedLead?.assignedToUserId || null;
                            if (u.id === currentAssigneeId) return false;

                            if (quickWorkflowAction?.code === 'TC_REASSIGN') {
                              const leadLocationId = quickActionLead?.locationId || (quickActionLead?.interestedLocations?.[0]) || null;
                              if (!leadLocationId) return true; // fallback if lead has no location
                              return Array.isArray(u.locationIds) && u.locationIds.some(locId => String(locId) === String(leadLocationId));
                            }
                            return true;
                          })
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim()}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {quickWorkflowNeedsMissingLocationProject && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Lead details {quickLeadHasLocation && quickLeadHasProject ? '✓' : ''}</div>

                      <div style={{ display: 'flex', gap: 12 }}>
                        {/* Location Dropdown */}
                        {!quickLeadHasLocation && (
                          <div style={{ flex: 1, position: 'relative' }}>
                            <label className="qa-drawer-field-label">Location *</label>
                            <div
                              className="qa-drawer-field-select"
                              onClick={() => setQuickLocationDropdownOpen(p => !p)}
                              style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}
                            >
                              {!quickWorkflowForm.locationId && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select location...</span>}
                              {quickWorkflowForm.locationId && locationOptions.find(l => String(l.id) === String(quickWorkflowForm.locationId)) && (
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {locationOptions.find(l => String(l.id) === String(quickWorkflowForm.locationId))?.location_name}
                                  <span onClick={(e) => { e.stopPropagation(); setQuickWorkflowForm(prev => ({ ...prev, locationId: '', projectIds: [] })); setQuickMissingLocationId(''); setQuickMissingProjectIds([]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                                </span>
                              )}
                            </div>
                            {quickLocationDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <input type="text" placeholder="Search locations..." value={quickLocationSearch} onChange={(e) => setQuickLocationSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                  {(quickLocationSearch.trim() ? locationOptions.filter(l => (l.location_name || '').toLowerCase().includes(quickLocationSearch.toLowerCase()) || (l.city || '').toLowerCase().includes(quickLocationSearch.toLowerCase())) : locationOptions).map((loc) => (
                                    <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <input type="radio" checked={String(quickWorkflowForm.locationId) === String(loc.id)} onChange={() => { setQuickWorkflowForm(prev => ({ ...prev, locationId: String(loc.id), projectIds: [] })); setQuickMissingLocationId(String(loc.id)); setQuickMissingProjectIds([]); setQuickLocationDropdownOpen(false); setQuickLocationSearch(''); }} />
                                      {loc.location_name}{loc.city ? `, ${loc.city}` : ''}{loc.state ? ` (${loc.state})` : ''}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Project Dropdown */}
                        {!quickLeadHasProject && (
                          <div style={{ flex: 1, position: 'relative' }}>
                            <label className="qa-drawer-field-label">Project * {quickWorkflowForm.projectIds?.length > 0 && `(${quickWorkflowForm.projectIds.length})`}</label>
                            <div
                              className="qa-drawer-field-select"
                              onClick={() => setQuickProjectDropdownOpen(p => !p)}
                              style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}
                            >
                              {(quickWorkflowForm.projectIds || []).length === 0 && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select projects...</span>}
                              {(quickWorkflowForm.projectIds || []).map((projId, i) => {
                                const projName = projectOptions.find(p => String(p.id) === String(projId))?.project_name;
                                return projName ? (
                                  <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    {projName}
                                    <span onClick={(e) => { e.stopPropagation(); setQuickWorkflowForm(prev => ({ ...prev, projectIds: (prev.projectIds || []).filter((id) => String(id) !== String(projId)) })); setQuickMissingProjectIds(prev => (prev || []).filter((id) => String(id) !== String(projId))); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                                  </span>
                                ) : null;
                              })}
                            </div>
                            {quickProjectDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <input type="text" placeholder="Search projects..." value={quickProjectSearch} onChange={(e) => setQuickProjectSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                  {(quickProjectSearch.trim() ? quickMissingProjectOptions.filter(p => (p.project_name || '').toLowerCase().includes(quickProjectSearch.toLowerCase()) || (p.project_code || '').toLowerCase().includes(quickProjectSearch.toLowerCase())) : quickMissingProjectOptions).map((project) => (
                                    <label key={project.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <input type="checkbox" checked={(quickWorkflowForm.projectIds || []).map(String).includes(String(project.id))} onChange={() => { setQuickWorkflowForm(prev => { const pIds = (prev.projectIds || []).map(String); const newIds = pIds.includes(String(project.id)) ? pIds.filter(id => id !== String(project.id)) : [...pIds, String(project.id)]; return { ...prev, projectIds: newIds }; }); setQuickMissingProjectIds(prev => { const pIds = (prev || []).map(String); return pIds.includes(String(project.id)) ? pIds.filter(id => id !== String(project.id)) : [...pIds, String(project.id)]; }); }} />
                                      {project.project_name}{project.project_code ? ` (${project.project_code})` : ''}
                                    </label>
                                  ))}
                                  {quickMissingProjectOptions.length === 0 && <div style={{ padding: '12px', color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center' }}>No projects found</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {quickWorkflowAction?.code === 'TC_SV_DONE' && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Visit details</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Project Visited *</label>
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
                    </div>
                  )}

                  {/* ── Contextual: Site Visit Details ── */}
                  {(quickWorkflowAction?.needsSvDetails && quickWorkflowAction?.code !== 'TC_SV_DONE') && (
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

                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Budget Min *</label>
                          <input
                            type="number"
                            min="0"
                            className="qa-drawer-field-input"
                            placeholder="Minimum budget"
                            value={quickWorkflowForm.budgetMin}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, budgetMin: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Budget Max *</label>
                          <input
                            type="number"
                            min="0"
                            className="qa-drawer-field-input"
                            placeholder="Maximum budget"
                            value={quickWorkflowForm.budgetMax}
                            onChange={(e) => setQuickWorkflowForm((p) => ({ ...p, budgetMax: e.target.value }))}
                            style={{ width: '100%' }}
                          />
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
                                <MapPinIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Get Position
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
                      <div className="qa-drawer-profile-section"><TrophyIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Customer Profile Details</div>

                      {/* ── Inventory Unit Selection ── */}
                      {availableUnits.length > 0 && (
                        <>
                          <div className="qa-drawer-profile-section"><HomeModernIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Select Unit / Plot</div>
                          <div>
                            <label className="qa-drawer-field-label">Available Unit</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.inventoryUnitId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, inventoryUnitId: e.target.value }))}>
                              <option value="">— Select Unit (Optional) —</option>
                              {availableUnits.filter(u => u.unit_status === 'Available').map(unit => (
                                <option key={unit.id} value={unit.id}>
                                  {unit.unit_number}{unit.configuration ? ` — ${unit.configuration}` : ''}{unit.unit_area ? ` — ${unit.unit_area} ${unit.area_unit || 'sq.ft.'}` : ''}{unit.total_price ? ` — ₹${Number(unit.total_price).toLocaleString('en-IN')}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          {customerProfileForm.inventoryUnitId && (() => {
                            const su = availableUnits.find(u => u.id === customerProfileForm.inventoryUnitId);
                            if (!su) return null;
                            return (
                              <div style={{ margin: '8px 0', padding: '10px 12px', background: 'var(--bg-tertiary, #f0fdf4)', border: '1px solid #86efac', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>{su.unit_number}</div>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  {su.configuration && <span>Config: {su.configuration}</span>}
                                  {su.unit_area && <span>Area: {su.unit_area} {su.area_unit || 'sq.ft.'}</span>}
                                  {su.total_price && <span>Price: ₹{Number(su.total_price).toLocaleString('en-IN')}</span>}
                                  {su.facing && <span>Facing: {su.facing}</span>}
                                  {su.tower_block && <span>Block: {su.tower_block}</span>}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      <div className="qa-drawer-profile-section"><UserIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Personal Details</div>
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

                      <div className="qa-drawer-profile-section"><IdentificationIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Identity Documents</div>
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

                      <div className="qa-drawer-profile-section"><MapPinIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Current Address *</div>
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
                        <div className="qa-drawer-profile-section" style={{ flex: 1, marginBottom: 0 }}><HomeIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Permanent Address</div>
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
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Call Status</span>
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
                              <CheckIcon style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Answered
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
                              <XMarkIcon style={{ width: 12, height: 12, display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Not Answered
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

              {/* ── Tabbed: Lead Activity / Remark History ── */}
              <div className="qa-drawer-tabs">
                <button
                  type="button"
                  className={`qa-drawer-tab ${qaActiveTab === 'history' ? 'qa-drawer-tab--active' : ''}`}
                  onClick={() => setQaActiveTab('history')}
                >
                  <TableCellsIcon style={{ width: 15, height: 15 }} /> Remark History
                </button>
                <button
                  type="button"
                  className={`qa-drawer-tab ${qaActiveTab === 'activity' ? 'qa-drawer-tab--active' : ''}`}
                  onClick={() => setQaActiveTab('activity')}
                >
                  <BoltIcon style={{ width: 15, height: 15 }} /> Lead Activity
                </button>
              </div>

              {/* ── Lead Activity Timeline (tab) ── */}
              {qaActiveTab === 'activity' && (
                <>
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
                                <span className="qa-drawer-hist-date">{formatDateTimeInTimeZone(act.at || act.created_at)}</span>
                              </div>
                              {act.description && <div className="qa-drawer-hist-remark">{formatActivityDescription(act.description, act)}</div>}
                              {(act.metadata?.statusRemarkResponseType || act.metadata?.callResult || act.metadata?.last_call_result) && (
                                <div className="qa-drawer-hist-remark" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                  Call Status: {(act.metadata?.statusRemarkResponseType || act.metadata?.callResult || act.metadata?.last_call_result || '').replace('-', ' ')}
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
                      <div className="qa-drawer-section" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HomeModernIcon style={{ width: 16, height: 16 }} /> Recent site visits</div>
                      <div style={{ padding: '0 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {quickActionSiteVisits.slice(0, 4).map((sv) => (
                          <div key={sv.id} style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <strong style={{ fontSize: 12 }}>{sv.project?.project_name || 'Unknown'}</strong>
                              <span style={{ fontSize: 10, color: sv.status === 'Completed' ? '#0F7B5C' : '#B45309', fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: sv.status === 'Completed' ? '#E0F4EE' : '#FEF3C7' }}>{sv.status}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {sv.actual_visit_date
                                ? <><CheckCircleIcon style={{ width: 12, height: 12 }} /> {formatDateTime(sv.actual_visit_date)}</>
                                : <><CalendarDaysIcon style={{ width: 12, height: 12 }} /> {formatDateTime(sv.scheduled_date)}</>}
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
                </>
              )}

              {/* ══ Remark History Tab ══ */}
              {qaActiveTab === 'history' && (
                <div className="qa-remark-history">
                  {(() => {
                    const remarkActivities = quickActionActivities.filter((act) => {
                      const remarkText = getUserRemarkText(act);
                      const statusLabel = getRemarkHistoryStatusLabel(act, workflowConfig);
                      const callStatus = act.metadata?.statusRemarkResponseType
                        || act.metadata?.callResult
                        || act.metadata?.last_call_result
                        || '';
                      const closureReason = act.metadata?.closureReasonName || act.metadata?.closure_reason || '';
                      const hasMeaningfulRemark = Boolean(remarkText || closureReason);
                      const hasWorkflowContext = Boolean(statusLabel || callStatus || closureReason);
                      return hasMeaningfulRemark && hasWorkflowContext;
                    });
                    if (remarkActivities.length === 0) {
                      return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>No remarks recorded yet.</p>;
                    }
                    return (
                      <div className="qa-remark-table-wrap">
                        <table className="qa-remark-table">
                          <thead>
                            <tr>
                              <th>Status</th>
                              <th>Remarks</th>
                              <th>Call / Response</th>
                              <th>By</th>
                              <th>Date & Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {remarkActivities.map((act) => {
                              const remarkText = getUserRemarkText(act);
                              const statusLabel = getRemarkHistoryStatusLabel(act, workflowConfig);
                              const callStatus = act.metadata?.statusRemarkResponseType
                                || act.metadata?.callResult
                                || act.metadata?.last_call_result
                                || '';
                              const byName = act.by || 'System';
                              const byRole = act.metadata?.performedByRole || act.metadata?.role || '';
                              const closureReason = act.metadata?.closureReasonName || act.metadata?.closure_reason || '';
                              return (
                                <tr key={act.id}>
                                  <td>
                                    <span className="qa-remark-status-badge">{statusLabel || '—'}</span>
                                  </td>
                                  <td>
                                    <div>{remarkText || '—'}</div>
                                    {closureReason && (
                                      <div className="qa-remark-closure">Reason: {closureReason}</div>
                                    )}
                                  </td>
                                  <td>
                                    {callStatus ? (
                                      <span className={`qa-remark-call-badge ${callStatus.toLowerCase().includes('not') ? 'qa-remark-call-badge--missed' : 'qa-remark-call-badge--answered'}`}>
                                        {callStatus.replace('-', ' ')}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td>
                                    <div className="qa-remark-by-name">{byName}</div>
                                    {byRole && <div className="qa-remark-by-role">{byRole}</div>}
                                  </td>
                                  <td className="qa-remark-date">{formatDateTime(act.at || act.created_at)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
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
                  || quickActionLeadReadOnly
                  || !quickWorkflowAction
                  || (isRemarkMandatoryForAction(quickWorkflowAction)
                    && !(quickWorkflowForm.statusRemarkText || '').trim()
                    && !(quickWorkflowForm.note || '').trim())
                  || ((quickWorkflowAction?.needsAssignee
                    || quickWorkflowAction?.code === 'TC_SV_DONE'
                    || quickWorkflowAction?.code === 'TC_REASSIGN')
                    && !quickWorkflowForm.assignToUserId)
                  || (quickWorkflowAction?.needsFollowUp && !quickWorkflowForm.nextFollowUpAt)
                  || (Boolean(quickWorkflowForm.nextFollowUpAt) && !isFollowUpAtLeastMinutesAhead(quickWorkflowForm.nextFollowUpAt))
                  || (quickWorkflowAction?.needsReason && !quickWorkflowForm.closureReasonId)
                }
                onClick={handleQuickWorkflowSubmit} style={{ backgroundColor: '#625afa' }}
              >
                {quickActionLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LeadWorkspacePage;
