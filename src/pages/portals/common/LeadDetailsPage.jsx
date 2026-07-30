import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import AuthedAudio from '../../../components/AuthedAudio';
import SmartfloCallButton from '../../../components/telephony/SmartfloCallButton';
import RecordingCell from '../../../components/telephony/RecordingCell';
import CallDirectionIcon from '../../../components/telephony/CallDirectionIcon';
import telephonyApi from '../../../api/telephonyApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import siteVisitApi from '../../../api/siteVisitApi';
import customerTypeApi from '../../../api/customerTypeApi';
import motivationApi from '../../../api/motivationApi';
import {
  VISIT_DETAIL_KEYS, VISIT_DETAIL_LABELS, displayVisitDetailValue,
  FACING_OPTIONS, PAYMENT_TYPE_OPTIONS, DECISION_MAKER_OPTIONS, AGE_BRACKET_OPTIONS,
  TIMELINE_OPTIONS, EMPTY_VISIT_DETAILS, isVisitDetailsComplete, pickVisitDetails,
  parseVisitDetailsValue, hasVisitDetailsData,
} from './siteVisitFields';
import statusRemarkApi from '../../../api/statusRemarkApi';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
import paymentPlanApi from '../../../api/paymentPlanApi';
import projectPhaseApi from '../../../api/projectPhaseApi';

import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency, formatDate, formatDateTime, formatDateTimeInTimeZone, formatLocation, cleanRepeatingLocation } from '../../../utils/formatters';
import { getRoleCode } from '../../../utils/permissions';
import { badgeStyle } from '../../../utils/badgeColors';
import { getActionsForRole } from './workflowConfig';
import {
  XMarkIcon,
  UserIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PhoneIcon,
  ClipboardDocumentListIcon,
  NoSymbolIcon,
  TrashIcon,
  HandRaisedIcon,
  SparklesIcon,
  BanknotesIcon,
  IdentificationIcon,
  HomeIcon,
  BoltIcon,
  TableCellsIcon,
  HomeModernIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';
import CalendarPicker from '../../../components/common/CalendarPicker';
import VoiceNoteField from '../../../components/common/VoiceNoteField';
import { canUseVoiceNotes } from '../../../utils/voiceNotes';
import { followUpMaxDate, followUpLimitError } from '../../../utils/followUpLimits';
import './LeadDetailsPage.css';

const QUICK_REMARKS = [
  'Interested', 'Shared Details', 'Callback Later', 'Busy', 
  'Not Reachable', 'RNR', 'Wrong Number', 'Follow-up Scheduled'
];

const INDIAN_STATES_UTS = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];


const iconForTimeline = (type) => {
  if (type === 'NOTE_ADDED') return ClipboardDocumentListIcon;
  if (type === 'STAGE_CHANGED' || type === 'STAGE_CHANGE') return MapPinIcon;
  if (type === 'STATUS_CHANGED' || type === 'STATUS_CHANGE') return ArrowPathIcon;
  if (type === 'REASSIGNMENT' || type === 'ASSIGNMENT') return UserIcon;
  if (type === 'FOLLOW_UP_SCHEDULED') return CalendarDaysIcon;
  if (type === 'CREATED') return SparklesIcon;
  return null;
};

const getAssigneeRoleForAction = (action, roleCode) => {
  if (!action) return 'SM';
  if (action.code === 'TC_SV_DONE') return 'SM';
  if (action.code === 'SM_SITE_VISIT') return 'SH';
  if (roleCode === 'SM' && action.needsSvDetails) return 'SH';
  if (action.assigneeRole) return action.assigneeRole;
  if (roleCode === 'SH') return 'COL';
  if (roleCode === 'SM') return 'SH';
  return 'SM';
};

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

// Follow-ups are date-only — shortcuts resolve to the chosen calendar day.
const toDateOnlyValue = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getQuickFollowUpDate = (dayOffset) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return toDateOnlyValue(date);
};

const getQuickFollowUpForWeekday = (weekday) => {
  const date = new Date();
  const currentDay = date.getDay();
  const dayOffset = (weekday - currentDay + 7) % 7;
  date.setDate(date.getDate() + dayOffset);
  return toDateOnlyValue(date);
};

const MISSED_FOLLOW_UP_BLOCK_ROLES = ['TC', 'SM', 'SH'];

// Follow-ups are date-only: the minimum selectable value is the start of today.
const getFollowUpMinimumTime = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

// A follow-up date is valid when it is today or later (no time comparison).
const isFollowUpAtLeastMinutesAhead = (value) => {
  const day = toDayStart(value);
  if (!day) return false;
  return day.getTime() >= getFollowUpMinimumTime().getTime();
};

const SYSTEM_REMARK_PREFIXES = ['Lead created with status:', 'Response:', 'Quick action:', 'Follow-up call scheduled for', 'Action:'];
const FOLLOW_UP_SCHEDULED_PREFIX = 'Follow-up call scheduled for';

const normalizeStatusCode = (value) => String(value || '').trim().toUpperCase();

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

// Two dates fall on the same local calendar day.
const isSameLocalDay = (a, b) => (
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate()
);

// Convert a follow-up ISO timestamp to the date-only value the follow-up input expects.
const followUpIsoToInputValue = (iso) => (iso ? toDateOnlyValue(new Date(iso)) : '');

const parseAsUtcIfNeeded = (rawDateText) => {
  const direct = new Date(rawDateText);
  if (!Number.isNaN(direct.getTime())) {
    const hasExplicitTimeZone = /\b(UTC|GMT|IST)\b|Z$|[+-]\d{2}:?\d{2}$/i.test(rawDateText);
    if (hasExplicitTimeZone) return direct;
  }

  const utcFallback = new Date(`${rawDateText} UTC`);
  if (!Number.isNaN(utcFallback.getTime())) return utcFallback;
  return direct;
};

const getUserDisplayName = (user) => {
  if (!user) return '';
  const fullName = `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim();
  return fullName || user.fullName || '';
};

const ROLE_PORTAL_CONFIG = {
  TC: { basePath: '/telecaller/leads', fallbackScreen: 'leads' },
  SM: { basePath: '/sales-manager/leads', fallbackScreen: 'leads' },
  SH: { basePath: '/sales-head/leads', fallbackScreen: 'negotiations' },
  COL: { basePath: '/collection/leads', fallbackScreen: 'leads' },
  ACCT: { basePath: '/accounts/dashboard', fallbackScreen: 'dashboard' },
  SA: { basePath: '/super-admin/lead-management', fallbackScreen: '' },
  ADM: { basePath: '/super-admin/lead-management', fallbackScreen: '' },
  SE: { basePath: '/task-portal/dashboard', fallbackScreen: 'dashboard' },
};

const getPortalScreenStorageKey = (basePath) => (basePath ? `portalActiveScreen:${basePath}` : '');

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

const isWorkflowNoteActivity = (activity) => {
  const title = String(activity?.title || '').trim().toLowerCase();
  const type = String(activity?.type || '').trim().toUpperCase();

  if (title.includes('workflow note')) return true;

  if (type === 'NOTE_ADDED') {
    const hasWorkflowMetadata = Boolean(
      activity?.metadata?.statusRemarkText
      || activity?.metadata?.actionCode
      || activity?.metadata?.targetStatusCode
      || activity?.metadata?.statusCode
    );
    if (hasWorkflowMetadata) return true;
  }

  return false;
};



const actionInitialState = {
  nextFollowUpAt: '',
  assignToUserId: '',
  closureReasonId: '',
  reason: '',
  note: '',
  statusRemarkText: '',
  svDate: '',
  svProjectId: '',
  budgetMin: '',
  budgetMax: '',
  motivationType: '',
  primaryRequirement: '',
  secondaryRequirement: '',
  timeSpent: '',
  scheduledTimeSlot: '',
  customerTypeId: '',
  customerRequirement: '',
  ...EMPTY_VISIT_DETAILS,
  callResult: 'Answered',
};

const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(authUser);
  // Lead opened from a search result: the user deliberately looked this lead up
  // (e.g. a customer calling in), so the missed-follow-ups-first gate must not
  // block updating it. The gate stays in force for normal tab navigation.
  const viaSearch = location.state?.viaSearch === true;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  const [motivationOptions, setMotivationOptions] = useState([]);
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('followups');
  const [enquiries, setEnquiries] = useState(null); // { firstEnquiry, reEnquiries } — lazy-loaded on tab open
  const [callLogs, setCallLogs] = useState(null); // Smartflo calls for this lead — lazy-loaded on tab open
  const [siteVisits, setSiteVisits] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [assignedUser, setAssignedUser] = useState(null);
  const [userTotalScore, setUserTotalScore] = useState(0);

  const [qaActiveTab, setQaActiveTab] = useState('history');
  const [actionCode, setActionCode] = useState('');
  const [actionForm, setActionForm] = useState(actionInitialState);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [closureReasons, setClosureReasons] = useState([]);
  const [actionSaving, setActionSaving] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState('');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [actionStatusRemarks, setActionStatusRemarks] = useState([]);
  const [actionRemarkAnsNonAns, setActionRemarkAnsNonAns] = useState(null);
  const [quickActionCode, setQuickActionCode] = useState('');
  const [quickActionForm, setQuickActionForm] = useState(actionInitialState);
  const [quickAssignableUsers, setQuickAssignableUsers] = useState([]);
  const [quickClosureReasons, setQuickClosureReasons] = useState([]);
  const [quickStatusRemarks, setQuickStatusRemarks] = useState([]);
  const [quickRemarkAnsNonAns, setQuickRemarkAnsNonAns] = useState(null);
  const [quickActionSaving, setQuickActionSaving] = useState(false);
  const [quickActionActivities, setQuickActionActivities] = useState([]);
  // Voice note recorded with a quick-action remark (SM/SH only). { blob, url, duration }
  const [quickVoice, setQuickVoice] = useState(null);
  const [hasPendingMissedFollowupsForMe, setHasPendingMissedFollowupsForMe] = useState(false);
  const [quickMissingLocationId, setQuickMissingLocationId] = useState('');
  const [quickMissingProjectIds, setQuickMissingProjectIds] = useState([]);
  const [quickLocationSearch, setQuickLocationSearch] = useState('');
  const [quickProjectSearch, setQuickProjectSearch] = useState('');
  const [quickLocationDropdownOpen, setQuickLocationDropdownOpen] = useState(false);
  const [quickProjectDropdownOpen, setQuickProjectDropdownOpen] = useState(false);
  const [customerProfileForm, setCustomerProfileForm] = useState({
    buyer_name: '',
    date_of_birth: '', marital_status: '', purchase_type: '',
    occupation: '', current_post: '',
    pan_number: '', aadhar_number: '',
    current_address: '', current_area: '', current_city: '', current_state: '', current_pincode: '',
    sameAsCurrent: true,
    permanent_address: '', permanent_area: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
    inventoryUnitId: '',
    paymentPlanId: '',
    bookingProjectId: '',
    bookingLocationId: '',
    bookingPhaseId: '',
    bookingDate: new Date().toISOString().split('T')[0],
  });
  const [availableUnits, setAvailableUnits] = useState([]);
  const [bookingPhases, setBookingPhases] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const handleBackToWorkspace = useCallback(() => {
    const rolePortalConfig = ROLE_PORTAL_CONFIG[roleCode] || ROLE_PORTAL_CONFIG.TC;
    const directReturnPath = location.state?.fromPath;

    if (directReturnPath) {
      navigate(directReturnPath);
      return;
    }

    // If the user navigated here from another page within the app, go back in history.
    // This preserves their exact list view, search parameters, pagination, and scroll state.
    if (location.key && location.key !== 'default') {
      navigate(-1);
      return;
    }

    let targetScreen = rolePortalConfig.fallbackScreen;
    if (typeof window !== 'undefined') {
      try {
        const savedScreen = window.sessionStorage.getItem(getPortalScreenStorageKey(rolePortalConfig.basePath));
        if (savedScreen && savedScreen !== 'dashboard') {
          targetScreen = savedScreen;
        }
      } catch {
        // ignore storage failures
      }
    }

    if (roleCode === 'SA' || roleCode === 'ADM') {
      navigate(rolePortalConfig.basePath);
    } else {
      navigate(`${rolePortalConfig.basePath}?screen=${encodeURIComponent(targetScreen)}`);
    }
  }, [location, navigate, roleCode]);

  const handleSaveName = async () => {
    if (!editNameValue.trim() || !lead?.id) return;
    setSavingName(true);
    try {
      const parts = editNameValue.trim().split(' ');
      const first_name = parts[0];
      const last_name = parts.slice(1).join(' ') || undefined;
      await leadWorkflowApi.updateLeadDetails(lead.id, { first_name, last_name });
      toast.success('Lead name updated successfully');
      setEditingName(false);
      await loadLeadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update lead name'));
    } finally {
      setSavingName(false);
    }
  };

  const roleActions = useMemo(() => getActionsForRole(workflowConfig?.actions || {}, roleCode), [workflowConfig, roleCode]);
  const selectedAction = useMemo(() => roleActions.find((a) => a.code === actionCode) || null, [roleActions, actionCode]);
  const quickSelectedAction = useMemo(() => roleActions.find((a) => a.code === quickActionCode) || null, [roleActions, quickActionCode]);
  const isSmHandoffReadOnly = useMemo(() => {
    if (roleCode !== 'SM' || !lead || !authUser?.id) return false;

    const assignedRoleCode = String(lead.assignedRole || '').toUpperCase();
    const ownerRoleCode = String(lead.ownerRole || '').toUpperCase();
    const stageOrder = Number(lead.stageOrder || 0);
    const nowWithSalesHead = assignedRoleCode === 'SH' || ownerRoleCode === 'SH' || stageOrder >= 6;

    // SM should have read-only access once lead moves to SH-owned stages/workspace.
    return nowWithSalesHead;
  }, [authUser?.id, lead, roleCode]);

  const isSmShUnassignedReadOnly = useMemo(() => {
    if (!lead) return false;
    if (!['SM', 'SH'].includes(roleCode)) return false;
    return !lead.assignedToUserId;
  }, [lead, roleCode]);


  const getProjectNames = useMemo(() => {
    if (!lead) return [];
    if (lead.interestedProjects?.length > 0) {
      return lead.interestedProjects.map((pid) => projectOptions.find((p) => p.id === pid)?.project_name).filter(Boolean);
    }
    return lead.project ? [lead.project] : [];
  }, [lead, projectOptions]);

  const getLocationNames = useMemo(() => {
    if (!lead) return [];
    if (lead.interestedLocations?.length > 0) {
      return lead.interestedLocations
        .map((lid) => {
          const loc = locationOptions.find((item) => item.id === lid);
          return loc ? formatLocation(loc.location_name, loc.city) : null;
        })
        .filter(Boolean);
    }
    return lead.location ? [cleanRepeatingLocation(lead.location)] : [];
  }, [lead, locationOptions]);

  const getSourceMediumLabel = useMemo(() => {
    const source = typeof lead?.source === 'string' ? lead.source.trim() : '';
    const subSource = typeof lead?.subSource === 'string' ? lead.subSource.trim() : '';
    if (!source && !subSource) return '-';
    if (source && subSource) return `${source} / ${subSource}`;
    return source || subSource || '-';
  }, [lead?.source, lead?.subSource]);

  const latestLeadVisitDetails = useMemo(() => {
    const directVisitDetails = parseVisitDetailsValue(lead?.customFields?.last_visit_details);
    if (hasVisitDetailsData(directVisitDetails)) return directVisitDetails;

    const metadataVisitDetails = parseVisitDetailsValue(lead?.metadata?.last_visit_details);
    if (hasVisitDetailsData(metadataVisitDetails)) return metadataVisitDetails;

    return null;
  }, [lead?.customFields, lead?.metadata]);

  const getTcLocationNames = useMemo(() => {
    if (!lead) return [];
    if (lead.interestedLocations?.length > 0) {
      return lead.interestedLocations
        .map((lid) => {
          const loc = locationOptions.find((item) => item.id === lid);
          return loc?.location_name || null;
        })
        .filter(Boolean);
    }

    if (typeof lead.location === 'string' && lead.location.trim()) {
      const onlyLocation = lead.location.split(',')[0].trim();
      return onlyLocation ? [onlyLocation] : [];
    }

    if (lead.location?.location_name) {
      return [lead.location.location_name];
    }

    return [];
  }, [lead, locationOptions]);

  const followupRemarkActivities = useMemo(() => {
    const timeline = Array.isArray(lead?.timeline) ? lead.timeline : [];

    const sorted = [...timeline]
      .filter((evt) => {
        const remarkText = getUserRemarkText(evt);
        const statusLabel = getRemarkHistoryStatusLabel(evt, workflowConfig);
        const callStatus = evt.metadata?.statusRemarkResponseType
          || evt.metadata?.callResult
          || evt.metadata?.last_call_result
          || '';
        const closureReason = evt.metadata?.closureReasonName || evt.metadata?.closure_reason || '';
        const hasMeaningfulRemark = Boolean(remarkText || closureReason);
        const hasWorkflowContext = Boolean(statusLabel || callStatus || closureReason);

        return hasMeaningfulRemark && hasWorkflowContext;
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // Same-day updates collapse into a single entry (the day's latest). The full
    // timeline still shows every entry via visibleTimelineActivities.
    const seenDays = new Set();
    return sorted.filter((evt) => {
      const d = new Date(evt.at);
      if (Number.isNaN(d.getTime())) return true;
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (seenDays.has(dayKey)) return false;
      seenDays.add(dayKey);
      return true;
    });
  }, [lead?.timeline, workflowConfig]);

  const visibleTimelineActivities = useMemo(() => {
    const timeline = Array.isArray(lead?.timeline) ? lead.timeline : [];
    return timeline.filter((evt) => !isWorkflowNoteActivity(evt));
  }, [lead?.timeline]);

  const isCurrentLeadMissedFollowup = useMemo(() => {
    if (!lead?.nextFollowUpAt || lead?.isClosed) return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return isFollowUpMissedByDate(lead.nextFollowUpAt, todayStart);
  }, [lead?.nextFollowUpAt, lead?.isClosed]);

  const isMissedFirstBlocked = useMemo(() => {
    if (viaSearch) return false;
    // New/Hot-flagged leads (fresh API/call lead or re-enquiry awaiting its first
    // update) must be actionable immediately — the missed-follow-ups-first gate
    // never blocks them. The flag clears on the first update, restoring the gate.
    if (lead?.newHotSince) return false;
    if (!MISSED_FOLLOW_UP_BLOCK_ROLES.includes(roleCode)) return false;
    if (!hasPendingMissedFollowupsForMe) return false;
    return !isCurrentLeadMissedFollowup;
  }, [viaSearch, lead?.newHotSince, roleCode, hasPendingMissedFollowupsForMe, isCurrentLeadMissedFollowup]);

  const loadLeadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      const [leadResp, projResp, locResp, wfResp, svResp, followUpAssignedResp, ctResp, motResp] = await Promise.all([
        leadWorkflowApi.getLeadById(id),
        projectApi.getDropdown(),
        locationApi.getDropdown(),
        leadWorkflowApi.getWorkflowConfig().catch(() => ({ data: null })),
        siteVisitApi.getAll({ lead_id: id }).catch(() => ({ data: { rows: [] } })),
        MISSED_FOLLOW_UP_BLOCK_ROLES.includes(roleCode)
          ? leadWorkflowApi.getLeads({ roleCode, assignedToMe: true, followUpFilter: 'missed', page: 1, limit: 1 }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        customerTypeApi.getDropdown().catch(() => ({ data: [] })),
        motivationApi.getDropdown().catch(() => ({ data: [] })),
      ]);

      const leadData = leadResp.data;
      setLead(leadData);
      setProjectOptions(projResp.data || []);
      setLocationOptions(locResp.data || []);
      setCustomerTypeOptions(ctResp.data || []);
      setMotivationOptions(motResp.data || []);
      setWorkflowConfig(wfResp.data || null);
      const siteVisitRows = svResp?.data?.rows || svResp?.data?.data || svResp?.data || [];
      setSiteVisits(Array.isArray(siteVisitRows) ? siteVisitRows : []);

      if (MISSED_FOLLOW_UP_BLOCK_ROLES.includes(roleCode)) {
        const totalMissed = followUpAssignedResp?.data?.total || 0;
        const assignedLeadRows = followUpAssignedResp?.data?.rows || followUpAssignedResp?.data?.data || followUpAssignedResp?.data || followUpAssignedResp?.rows || [];
        const hasMissed = totalMissed > 0 || assignedLeadRows.length > 0;
        setHasPendingMissedFollowupsForMe(hasMissed);
      } else {
        setHasPendingMissedFollowupsForMe(false);
      }

      if (leadData?.assignedToUserId) {
        try {
          const userResp = await leadWorkflowApi.getUserWithScore(leadData.assignedToUserId);
          setAssignedUser(userResp.data || null);
          setUserTotalScore(userResp.data?.totalScore || 0);
        } catch {
          setAssignedUser(null);
          setUserTotalScore(0);
        }
      } else {
        setAssignedUser(null);
        setUserTotalScore(0);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load lead'));
      handleBackToWorkspace();
    } finally {
      setLoading(false);
    }
  }, [handleBackToWorkspace, id, roleCode]);

  useEffect(() => {
    loadLeadData();
  }, [loadLeadData]);

  // Lazy-load the enquiry history (first enquiry + marketing re-enquiries)
  // the first time the Enquiries tab is opened.
  useEffect(() => {
    if (activeTab !== 'enquiries' || enquiries || !id) return;
    leadWorkflowApi.getLeadEnquiries(id)
      .then((resp) => setEnquiries(resp.data || { firstEnquiry: null, reEnquiries: [] }))
      .catch((err) => toast.error(getErrorMessage(err, 'Failed to load enquiries')));
  }, [activeTab, enquiries, id]);

  // Lazy-load this lead's Smartflo call logs the first time the Call Logs tab
  // is opened.
  useEffect(() => {
    if (activeTab !== 'calls' || callLogs || !id) return;
    telephonyApi.getCallLogs({ lead_id: id, limit: 100 })
      .then((resp) => setCallLogs(resp.data || []))
      .catch((err) => {
        setCallLogs([]);
        toast.error(getErrorMessage(err, 'Failed to load call logs'));
      });
  }, [activeTab, callLogs, id]);

  const handleAddNote = async () => {
    if (!noteDraft.trim() || !lead?.id) return;
    if (isSmHandoffReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }
    try {
      await leadWorkflowApi.addNote(lead.id, noteDraft.trim());
      setNoteDraft('');
      toast.success('Note added');
      await loadLeadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add note'));
    }
  };

  const loadActionDependencies = useCallback(async (action, setUsers, setReasons) => {
    if (action.needsAssignee || action.needsSvDetails || action.code === 'TC_SV_DONE' || action.needsCustomerProfile || action.code === 'SH_BOOKING') {
      try {
        const roleTarget = (action.needsCustomerProfile || action.code === 'SH_BOOKING') ? 'COL' : getAssigneeRoleForAction(action, roleCode);
        const resp = await leadWorkflowApi.getAssignableUsers(roleTarget);
        setUsers(resp.data || []);
      } catch {
        setUsers([]);
      }
      // Load inventory units for SH_BOOKING
      if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
        const projectIdForUnits = customerProfileForm.bookingProjectId || lead?.projectId;
        if (projectIdForUnits) {
          // Load phases for the project first
          projectPhaseApi.dropdown(projectIdForUnits).then(resp => {
            const phases = resp.data?.data || resp.data || [];
            setBookingPhases(phases);
            // If no phases, load all units directly
            if (phases.length === 0) {
              inventoryUnitApi.getDropdown({ project_id: projectIdForUnits }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
            }
          }).catch(() => {
            setBookingPhases([]);
            inventoryUnitApi.getDropdown({ project_id: projectIdForUnits }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([]));
          });
        } else {
          setBookingPhases([]);
          setAvailableUnits([]);
        }
        // Load payment plans for booking
        paymentPlanApi.getDropdown().then(resp => {
          setPaymentPlans(resp.data || []);
        }).catch(() => setPaymentPlans([]));
      }
    } else {
      setUsers([]);
    }

    if (action.needsReason && action.reasonCategory) {
      try {
        const category = action.reasonCategory === 'LOST' ? '' : action.reasonCategory;
        const resp = await leadWorkflowApi.getClosureReasons(category);
        setReasons(resp.data?.rows || resp.data || []);
      } catch {
        setReasons([]);
      }
    } else {
      setReasons([]);
    }
  }, [roleCode, lead?.projectId, customerProfileForm.bookingProjectId]);

  const closeQuickActionsModal = useCallback(() => {
    setQuickActionsOpen(false);
    setQuickActionCode('');
    setQuickActionForm(actionInitialState);
    setQuickAssignableUsers([]);
    setQuickClosureReasons([]);
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
    setQuickMissingLocationId('');
    setQuickMissingProjectIds([]);
    setQuickLocationSearch('');
    setQuickProjectSearch('');
    setQuickLocationDropdownOpen(false);
    setQuickProjectDropdownOpen(false);
    setQuickActionActivities([]);
    setQuickVoice(null);
  }, []);

  const loadStatusRemarks = useCallback(async (action, setRemarks, setAnsNonAns) => {
    if (!action?.targetStatusCode) {
      setRemarks([]);
      setAnsNonAns(null);
      return;
    }

    try {
      const resp = await statusRemarkApi.getByStatusCode(action.targetStatusCode);
      const remarks = resp.data?.remarks || [];
      setRemarks(remarks);

      const firstRemark = remarks.find((item) => item.has_ans_non_ans);
      setAnsNonAns(firstRemark ? (firstRemark.ans_non_ans_default || 'Answered') : null);
    } catch {
      setRemarks([]);
      setAnsNonAns(null);
    }
  }, []);

  const handleActionPick = async (code) => {
    setActionCode(code);
    const action = roleActions.find((item) => item.code === code);
    setActionForm((p) => ({
      ...actionInitialState,
      budgetMin: lead?.budgetMin ?? '',
      budgetMax: lead?.budgetMax ?? '',
      customerTypeId: lead?.customerTypeId ?? '',
      customerRequirement: lead?.primaryRequirement ?? '',
      callResult: action?.targetStatusCode === 'RNR' || action?.code.includes('RNR') ? 'Not Answered' : 'Answered',
    }));
    setAssignableUsers([]);
    setClosureReasons([]);
    setActionStatusRemarks([]);
    setActionRemarkAnsNonAns(null);

    if (!code) return;

    if (!action) return;

    await loadActionDependencies(action, setAssignableUsers, setClosureReasons);
    await loadStatusRemarks(action, setActionStatusRemarks, setActionRemarkAnsNonAns);
  };

  const handleRunAction = async () => {
    if (!lead?.id || !selectedAction) return;
    if (isMissedFirstBlocked) {
      toast.error('Complete missed follow-ups first to enable this action.');
      return;
    }
    if (isSmHandoffReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    if (selectedAction.needsCustomerProfile || selectedAction.code === 'SH_BOOKING') {
      toast.error('This action needs full customer profile. Use workspace booking flow.');
      return;
    }

    const payload = {
      note: actionForm.note.trim() || undefined,
      callResult: undefined,
      statusRemarkText: actionForm.statusRemarkText.trim() || undefined,
      statusRemarkResponseType: actionRemarkAnsNonAns || actionForm.callResult || undefined,
    };

    if (selectedAction.needsFollowUp) {
      if (!actionForm.nextFollowUpAt) {
        toast.error('Follow-up date is required');
        return;
      }
      const actionCapError = followUpLimitError(
        actionForm.nextFollowUpAt,
        selectedAction?.targetStatusCode || lead?.statusCode
      );
      if (actionCapError) { toast.error(actionCapError); return; }
      payload.nextFollowUpAt = new Date(actionForm.nextFollowUpAt).toISOString();
    }

    if (selectedAction.needsAssignee) {
      if (!actionForm.assignToUserId) {
        toast.error(getAssigneeRoleForAction(selectedAction, roleCode) === 'SH' ? 'Please select Sales Head negotiator' : 'Please select assignee');
        return;
      }
      payload.assignToUserId = actionForm.assignToUserId;
    }

    if (selectedAction.needsReason) {
      if (!actionForm.closureReasonId && !actionForm.reason.trim()) {
        toast.error('Reason is required for this action');
        return;
      }
      payload.closureReasonId = actionForm.closureReasonId || undefined;
      payload.reason = actionForm.reason.trim() || undefined;
    }

    if (selectedAction.needsSvDetails || selectedAction.code === 'TC_SV_DONE') {
      if (selectedAction.code === 'TC_SV_DONE' && !actionForm.assignToUserId) {
        toast.error('Please select Sales Manager');
        return;
      }
      if (selectedAction.code === 'SM_SITE_VISIT' && !actionForm.assignToUserId) {
        toast.error('Please select Sales Head negotiator');
        return;
      }
      if (!actionForm.svDate) {
        toast.error('Site visit date is required');
        return;
      }
      if (!actionForm.svProjectId) {
        toast.error('Project visited is required');
        return;
      }
      if (selectedAction.code === 'SM_SITE_VISIT') {
        if (!actionForm.customerTypeId) { toast.error('Customer Type is required'); return; }
        if (!actionForm.motivationType) { toast.error('Motivation is required'); return; }
        if (!actionForm.customerRequirement?.trim()) { toast.error('Customer Requirement is required'); return; }
        if (!actionForm.timeSpent) { toast.error('Time Spent is required'); return; }
        if (!isVisitDetailsComplete(actionForm)) { toast.error('All site visit detail fields are required'); return; }
      }
      payload.assignToUserId = actionForm.assignToUserId || payload.assignToUserId;
      if (actionForm.svDate) {
        payload.svDate = new Date(actionForm.svDate).toISOString();
      }
      payload.svProjectId = actionForm.svProjectId;
      payload.motivationType = actionForm.motivationType || undefined;
      payload.time_spent = actionForm.timeSpent ? Number(actionForm.timeSpent) : undefined;

      // SM "Record Site Visit" — full capture matching the Add Site Visit modal.
      // Record the Sales Head as negotiator rather than reassigning the lead.
      if (selectedAction.code === 'SM_SITE_VISIT') {
        payload.salesHeadUserId = actionForm.assignToUserId || undefined;
        payload.assignToUserId = undefined;
        payload.customerTypeId = actionForm.customerTypeId || undefined;
        payload.customerRequirement = actionForm.customerRequirement?.trim() || undefined;
        payload.primaryRequirement = actionForm.customerRequirement?.trim() || undefined;
        payload.scheduled_time_slot = actionForm.scheduledTimeSlot?.trim() || undefined;
        Object.assign(payload, pickVisitDetails(actionForm));
      }
    }

    setActionSaving(true);
    try {
      await leadWorkflowApi.transitionLead(lead.id, selectedAction.code, payload);
      toast.success(`${selectedAction.label} completed`);
      setActionCode('');
      setActionForm(actionInitialState);
      setAssignableUsers([]);
      setClosureReasons([]);
      await loadLeadData();
      setActiveTab('followups');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update lead'));
    } finally {
      setActionSaving(false);
    }
  };



  const handleQuickActionPick = async (code, prefill = null) => {
    if (isSmShUnassignedReadOnly) {
      toast.error('Actions are disabled for unassigned leads. Assign the lead first.');
      return;
    }

    const action = roleActions.find((item) => item.code === code);
    if (!action) return;

    setQuickActionCode(code);

    setQuickActionForm((p) => ({
      ...actionInitialState,
      budgetMin: lead?.budgetMin ?? '',
      budgetMax: lead?.budgetMax ?? '',
      customerTypeId: lead?.customerTypeId ?? '',
      customerRequirement: lead?.primaryRequirement ?? '',
      callResult: action.targetStatusCode === 'RNR' || action.code.includes('RNR') ? 'Not Answered' : 'Answered',
      // Prefill from the same-day previous update so it can be edited (rewritten).
      ...(prefill?.statusRemarkText ? { statusRemarkText: prefill.statusRemarkText, note: prefill.statusRemarkText } : {}),
      // Only actions that actually ask for a follow-up date get the prefill. The
      // field is hidden for the rest, so a prefilled value would be invisible and
      // unclearable — that is what blocked a second booking on an already-booked
      // lead, whose stale follow-up date is in the past.
      ...(prefill?.nextFollowUpAt && action.needsFollowUp ? { nextFollowUpAt: prefill.nextFollowUpAt } : {}),
      ...(prefill?.callResult ? { callResult: prefill.callResult } : {}),
    }));

    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);

    if (action.needsCustomerProfile || action.code === 'SH_BOOKING') {
      setCustomerProfileForm({
        buyer_name: `${lead?.first_name || ''} ${lead?.last_name || ''}`.trim(),
        date_of_birth: '', pan_number: '', aadhar_number: '',
        occupation: '', current_post: '', purchase_type: '', marital_status: '',
        current_address: '', current_area: '', current_city: '', current_state: '', current_pincode: '',
        permanent_address: '', permanent_area: '', permanent_city: '', permanent_state: '', permanent_pincode: '',
        sameAsCurrent: false,
        assignToUserId: '',
        note: '',
        inventoryUnitId: '',
        paymentPlanId: '',
        bookingProjectId: lead?.projectId || '',
        bookingLocationId: lead?.locationId || '',
        bookingPhaseId: '',
        bookingDate: new Date().toISOString().split('T')[0],
      });
    }

    // Pre-fill missing location/project selectors from current lead data
    setQuickMissingLocationId(lead?.interestedLocations?.[0] ? String(lead.interestedLocations[0]) : '');
    setQuickMissingProjectIds(
      lead?.interestedProjects?.length
        ? lead.interestedProjects.map((id) => String(id))
        : (lead?.projectId ? [String(lead.projectId)] : [])
    );

    // For TC_REASSIGN, load TCs as assignable users
    if (code === 'TC_REASSIGN') {
      try {
        const resp = await leadWorkflowApi.getAssignableUsers('TC');
        setQuickAssignableUsers(resp.data || []);
      } catch {
        setQuickAssignableUsers([]);
      }
      return;
    }

    await loadActionDependencies(action, setQuickAssignableUsers, setQuickClosureReasons);
    await loadStatusRemarks(action, setQuickStatusRemarks, setQuickRemarkAnsNonAns);
  };

  const handleQuickActionSubmit = async () => {
    if (!lead?.id || !quickSelectedAction) return;
    if (isSmShUnassignedReadOnly) {
      toast.error('Actions are disabled for unassigned leads. Assign the lead first.');
      return;
    }
    if (isMissedFirstBlocked) {
      toast.error('Complete missed follow-ups first to enable this action.');
      return;
    }
    if (isSmHandoffReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    const leadHasLocation = Boolean(
      lead?.interestedLocations?.length || lead?.locationId
    );
    const leadHasProject = Boolean(
      lead?.interestedProjects?.length || lead?.projectId
    );
    const isTerminalAction = ['TC_JUNK', 'TC_SPAM', 'TC_LOST', 'SM_LOST', 'COL_CANCELLED'].includes(quickSelectedAction.code);
    const isRnrAction = quickSelectedAction?.targetStatusCode === 'RNR' || quickSelectedAction?.code?.includes('RNR');

    if (isRemarkMandatoryForAction(quickSelectedAction)) {
      const hasRemark = Boolean((quickActionForm.statusRemarkText || '').trim() || (quickActionForm.note || '').trim());
      if (!hasRemark) {
        toast.error('Remark is mandatory for this status/action.');
        return;
      }
    }

    if (!isTerminalAction && !isRnrAction && roleCode === 'TC') {
      const hasLocationForSubmit = leadHasLocation || Boolean(quickMissingLocationId);
      const hasProjectForSubmit = leadHasProject || quickMissingProjectIds.length > 0;
      
      if (!hasLocationForSubmit) {
        toast.error('Please select a location for this lead before performing this action.');
        return;
      }
      if (!hasProjectForSubmit) {
        toast.error('Please select a project for this lead before performing this action.');
        return;
      }
    }

    // The follow-up field only renders for actions that need one, so anything left
    // in state for the others is invisible to the user and must not be validated
    // or submitted.
    const quickFollowUpAt = quickSelectedAction.needsFollowUp ? quickActionForm.nextFollowUpAt : '';

    if (quickFollowUpAt && !isFollowUpAtLeastMinutesAhead(quickFollowUpAt)) {
      toast.error('Follow-up date cannot be in the past');
      return;
    }
    const quickCapError = followUpLimitError(quickFollowUpAt, quickSelectedAction?.targetStatusCode || lead?.statusCode);
    if (quickCapError) { toast.error(quickCapError); return; }

    if (quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') {
      const pF = customerProfileForm;
      if (!pF.date_of_birth || !pF.pan_number || !pF.aadhar_number || !pF.current_address || !pF.occupation) {
        toast.error('Please fill all mandatory (*) customer profile fields (DOB, PAN, Aadhar, Address, Occupation).');
        return;
      }
      if (quickSelectedAction.code === 'SH_BOOKING' && !pF.bookingDate) {
        toast.error('Booking Date is required');
        return;
      }
    }

    const payload = {
      note: quickActionForm.note.trim() || undefined,
      callResult: undefined,
      statusRemarkText: quickActionForm.statusRemarkText.trim() || undefined,
      statusRemarkResponseType: quickSelectedAction.code === 'SH_BOOKING'
        ? undefined
        : (quickRemarkAnsNonAns || quickActionForm.callResult || undefined),
      nextFollowUpAt: quickFollowUpAt ? new Date(quickFollowUpAt).toISOString() : undefined,
      assignToUserId: quickActionForm.assignToUserId || undefined,
      closureReasonId: quickActionForm.closureReasonId || undefined,
      reason: quickActionForm.reason.trim() || undefined,
      svDate: quickActionForm.svDate || undefined,
      svProjectId: quickActionForm.svProjectId || undefined,
      budgetMin: (quickSelectedAction.needsSvDetails && quickSelectedAction.code !== 'TC_SV_DONE' && quickActionForm.budgetMin !== '') ? Number(quickActionForm.budgetMin) : undefined,
      budgetMax: (quickSelectedAction.needsSvDetails && quickSelectedAction.code !== 'TC_SV_DONE' && quickActionForm.budgetMax !== '') ? Number(quickActionForm.budgetMax) : undefined,
      motivationType: quickActionForm.motivationType || undefined,
      primaryRequirement: quickActionForm.primaryRequirement || undefined,
      secondaryRequirement: quickActionForm.secondaryRequirement || undefined,
      time_spent: quickActionForm.timeSpent ? Number(quickActionForm.timeSpent) : undefined,
    };

    // SM "Record Site Visit" — full capture matching the Add Site Visit modal.
    // Record the Sales Head as negotiator rather than reassigning the lead.
    if (quickSelectedAction.code === 'SM_SITE_VISIT') {
      payload.salesHeadUserId = quickActionForm.assignToUserId || undefined;
      payload.assignToUserId = undefined;
      payload.customerTypeId = quickActionForm.customerTypeId || undefined;
      payload.customerRequirement = quickActionForm.customerRequirement?.trim() || undefined;
      payload.primaryRequirement = quickActionForm.customerRequirement?.trim() || undefined;
      payload.scheduled_time_slot = quickActionForm.scheduledTimeSlot?.trim() || undefined;
      Object.assign(payload, pickVisitDetails(quickActionForm));
    }

    if (quickMissingLocationId) {
      payload.location_id = quickMissingLocationId;
      payload.location_ids = [quickMissingLocationId];
    }

    if (quickMissingProjectIds.length > 0) {
      payload.project_id = quickMissingProjectIds[0];
      payload.project_ids = quickMissingProjectIds;
    }

    if (quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') {
      const pF = customerProfileForm;
      payload.customerProfile = {
        buyer_name: pF.buyer_name || undefined,
        date_of_birth: pF.date_of_birth ? new Date(pF.date_of_birth).toISOString() : undefined,
        pan_number: pF.pan_number,
        aadhar_number: pF.aadhar_number,
        occupation: pF.occupation,
        current_post: pF.current_post,
        purchase_type: pF.purchase_type,
        marital_status: pF.marital_status,
        current_address: pF.current_address,
        current_area: pF.current_area,
        current_city: pF.current_city,
        current_state: pF.current_state,
        current_pincode: pF.current_pincode,
      };
      payload.buyer_name = pF.buyer_name || undefined;
      payload.bookingDate = pF.bookingDate || undefined;
      payload.inventoryUnitId = pF.inventoryUnitId || undefined;
      payload.payment_plan_id = pF.paymentPlanId || undefined;
      payload.bookingLocationId = pF.bookingLocationId || undefined;
      payload.bookingProjectId = pF.bookingProjectId || undefined;
      payload.location_id = pF.bookingLocationId || undefined;
      payload.project_id = pF.bookingProjectId || undefined;
    }

    if (quickSelectedAction.needsFollowUp) {
      if (!quickFollowUpAt) {
        toast.error('Follow-up date is required');
        return;
      }
      if (!isFollowUpAtLeastMinutesAhead(quickFollowUpAt)) {
        toast.error('Follow-up date cannot be in the past');
        return;
      }
    }

    if (quickSelectedAction.needsSvDetails || quickSelectedAction.code === 'TC_SV_DONE') {
      if (quickSelectedAction.code === 'TC_SV_DONE' && !quickActionForm.assignToUserId) {
        toast.error('Please select Sales Manager');
        return;
      }
      if (quickSelectedAction.code === 'SM_SITE_VISIT' && !quickActionForm.assignToUserId) {
        toast.error('Please select Sales Head negotiator');
        return;
      }
      if (!quickActionForm.svDate) {
        toast.error('Site visit date is required');
        return;
      }
      if (!quickActionForm.svProjectId) {
        toast.error('Project visited is required');
        return;
      }
      if (quickSelectedAction.code === 'SM_SITE_VISIT') {
        if (!quickActionForm.customerTypeId) { toast.error('Customer Type is required'); return; }
        if (!quickActionForm.motivationType) { toast.error('Motivation is required'); return; }
        if (!quickActionForm.customerRequirement?.trim()) { toast.error('Customer Requirement is required'); return; }
        if (!quickActionForm.timeSpent) { toast.error('Time Spent is required'); return; }
        if (!isVisitDetailsComplete(quickActionForm)) { toast.error('All site visit detail fields are required'); return; }
      }
    }

    if (['TC_SPAM', 'TC_JUNK'].includes(quickSelectedAction.code) && !quickActionForm.reason.trim() && !quickActionForm.note.trim()) {
      toast.error('Please enter a reason for ' + quickSelectedAction.label);
      return;
    }

    setQuickActionSaving(true);
    try {
      if (quickSelectedAction.code === 'TC_REASSIGN') {
        if (!quickActionForm.assignToUserId) {
          toast.error('Please select a telecaller to reassign');
          return;
        }
        await leadWorkflowApi.assignLead(lead.id, quickActionForm.assignToUserId, quickActionForm.note.trim() || 'Telecaller manual reassignment');
        toast.success('Lead reassigned successfully');
      } else {
        if (quickSelectedAction.needsAssignee || quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING' || quickSelectedAction.code === 'TC_SV_DONE') {
          if (!quickActionForm.assignToUserId) {
            toast.error(getAssigneeRoleForAction(quickSelectedAction, roleCode) === 'SH' ? 'Please select Sales Head negotiator' : 'Please select assignee');
            return;
          }
        }
        await leadWorkflowApi.transitionLead(lead.id, quickSelectedAction.code, payload);
        toast.success(`${quickSelectedAction.label} completed`);
      }
      // Persist the recorded voice note (if any) as a timeline activity on the lead.
      if (quickVoice?.blob) {
        try {
          await leadWorkflowApi.addVoiceNote(lead.id, quickVoice.blob, {
            duration: quickVoice.duration,
            content: (quickActionForm.statusRemarkText || quickActionForm.note || '').trim() || undefined,
          });
        } catch {
          toast.error('The action saved, but the voice note could not be uploaded.');
        }
      }
      closeQuickActionsModal();
      await loadLeadData();
    } finally {
      setQuickActionSaving(false);
    }
  };





  if (loading) {
    return (
      <div className="lead-details-page">
        <div className="lead-details-loading">
          <div className="lead-details-spinner" />
          <p>Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="lead-details-page">
        <div className="lead-details-error">
          <p>Lead not found</p>
          <button onClick={handleBackToWorkspace}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lead-details-page">
      <header className="lead-details-header">
        <div className="lead-details-header-left">
          <button className="lead-details-back" onClick={handleBackToWorkspace}>« Back</button>
          <div>
            <h1>{lead.fullName}</h1>
            <p>{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
          </div>
        </div>
        <div className="lead-details-header-right">
          {isSmHandoffReadOnly && (
            <span
              className="lead-details-status"
              style={{
                backgroundColor: '#FEF3C7',
                color: '#B45309',
                border: '1px solid #FCD34D',
                fontWeight: 700,
              }}
              title="You can view this lead but cannot update it after handoff to Sales Head"
            >
              Read-Only
            </span>
          )}
          {isSmShUnassignedReadOnly && (
            <span
              className="lead-details-status"
              style={{
                backgroundColor: '#FEE2E2',
                color: '#B91C1C',
                border: '1px solid #FCA5A5',
                fontWeight: 700,
              }}
              title="Unassigned lead: actions are disabled for Sales Manager and Sales Head"
            >
              Unassigned - Action Disabled
            </span>
          )}
          <button
            type="button"
            className="lead-details-quick-btn"
            disabled={isSmHandoffReadOnly || isSmShUnassignedReadOnly || isMissedFirstBlocked}
            onClick={async () => {
              if (isSmHandoffReadOnly || isSmShUnassignedReadOnly || isMissedFirstBlocked) {
                return;
              }

              setQuickActionsOpen(true);
              setQaActiveTab('history');

              // Load activities first so a same-day reopen can prefill the last update.
              let activities = [];
              try {
                const actResp = await leadWorkflowApi.getLeadActivities(lead.id);
                activities = actResp.data || [];
                setQuickActionActivities(activities);
              } catch {
                setQuickActionActivities([]);
              }

              // Pre-select the action based on lead's current status (last activity)
              const currentAction = roleActions.find(a => a.targetStatusCode === lead.statusCode);
              if (currentAction) {
                // If this lead was already updated today, prefill that update so a same-day
                // edit rewrites it instead of adding a new remark-history row.
                const todayUpdate = activities.find((a) => {
                  const d = new Date(a.at || a.created_at);
                  return !Number.isNaN(d.getTime())
                    && isSameLocalDay(d, new Date())
                    && getUserRemarkText(a);
                });
                const prefill = todayUpdate ? {
                  statusRemarkText: getUserRemarkText(todayUpdate),
                  // Activity metadata doesn't carry the follow-up date; fall back to the
                  // lead's current next_follow_up_date (set by the same-day update).
                  nextFollowUpAt: followUpIsoToInputValue(getScheduledFollowUpIso(todayUpdate) || lead.nextFollowUpAt),
                  callResult: todayUpdate.metadata?.statusRemarkResponseType
                    || todayUpdate.metadata?.callResult
                    || todayUpdate.metadata?.last_call_result
                    || '',
                } : null;
                await handleQuickActionPick(currentAction.code, prefill);
              } else {
                setQuickActionCode('');
                setQuickActionForm(actionInitialState);
              }
            }}
            title={isSmShUnassignedReadOnly
              ? 'Unassigned lead: assign first to enable actions'
              : (isMissedFirstBlocked ? 'Complete missed follow-ups first to enable today actions' : 'Quick actions')}
          >
            <BoltIcon style={{ width: 16, height: 16, marginRight: 6 }} />
            Quick update
          </button>
          {roleCode !== 'TC' && (
            <span
              className="lead-details-stage"
              style={badgeStyle(lead.stageColor)}
            >
              {lead.stageLabel}
            </span>
          )}
          <span
            className="lead-details-status"
            style={badgeStyle(lead.statusColor)}
          >
            {lead.statusIcon || ''} {lead.statusLabel}
          </span>
          {lead.leadScore != null && (
            <span className={`lead-details-score ${lead.leadScore >= 0 ? 'positive' : 'negative'}`}>
              Lead: {lead.leadScore >= 0 ? '+' : ''}{lead.leadScore}
            </span>
          )}
          {userTotalScore !== 0 && (
            <span className={`lead-details-score ${userTotalScore >= 0 ? 'positive' : 'negative'}`} title={`${assignedUser?.fullName || 'User'} Total Score`}>
              User: {userTotalScore >= 0 ? '+' : ''}{userTotalScore}
            </span>
          )}
        </div>
      </header>

      <div className="lead-details-metrics">
        <article className="lead-details-metric-card">
          <span>Priority</span>
          <strong>{lead.priority || '-'}</strong>
        </article>
        <article className="lead-details-metric-card">
          <span>Next Follow-Up</span>
          <strong>{lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : 'Not scheduled'}</strong>
        </article>
        <article className="lead-details-metric-card">
          <span>Last Contacted</span>
          <strong>{lead.lastContactedAt ? formatDateTime(lead.lastContactedAt) : 'Never'}</strong>
        </article>
        <article className="lead-details-metric-card">
          <span>Total Follow-Ups</span>
          <strong>{lead.totalFollowUps || 0}</strong>
        </article>
      </div>



      <div className="lead-details-content">
        <div className="lead-details-left">
          <section className="lead-details-card">
            <button type="button" className="lead-accordion-head" onClick={() => setAccordionOpen((prev) => (prev === 'contact' ? '' : 'contact'))}>
              <span className="lead-details-card-title">Contact Information</span>
              <span className="lead-accordion-icon">{accordionOpen === 'contact' ? '−' : '+'}</span>
            </button>
            {accordionOpen === 'contact' && (
              <div className="lead-details-info-grid">
                <div className="lead-details-info-item">
                  <span className="lead-details-label">Full Name</span>
                  <span className="lead-details-value">
                    {editingName ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="crm-form-input"
                          style={{ padding: '4px 8px', fontSize: '13px', width: '200px' }}
                          disabled={savingName}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                        />
                        <button 
                          className="crm-btn crm-btn-sm crm-btn-success" 
                          onClick={handleSaveName}
                          disabled={savingName}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Save
                        </button>
                        <button 
                          className="crm-btn crm-btn-sm crm-btn-secondary" 
                          onClick={() => setEditingName(false)}
                          disabled={savingName}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span>{lead.fullName}</span>
                        {!isSmHandoffReadOnly && (
                          <button 
                            onClick={() => { setEditNameValue(lead.fullName); setEditingName(true); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline', fontSize: '11px', padding: 0 }}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </span>
                </div>
                <div className="lead-details-info-item"><span className="lead-details-label">Phone</span><span className="lead-details-value">{lead.phone || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">WhatsApp</span><span className="lead-details-value">{lead.whatsappNumber || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Alternate Phone</span><span className="lead-details-value">{lead.alternatePhone || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Email</span><span className="lead-details-value">{lead.email || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Lead Number</span><span className="lead-details-value">{lead.leadNumber}</span></div>
                <div className="lead-details-info-item" style={{ gridColumn: 'span 2' }}><span className="lead-details-label">Source / Medium</span><span className="lead-details-value">{getSourceMediumLabel}</span></div>
                {roleCode === 'TC' && (
                  <>
                    <div className="lead-details-info-item">
                      <span className="lead-details-label">Project(s)</span>
                      <div className="lead-details-tags">
                        {getProjectNames.length > 0
                          ? getProjectNames.map((name, index) => <span key={index} className="lead-details-tag lead-details-tag--project">{name}</span>)
                          : <span className="lead-details-value">-</span>}
                      </div>
                    </div>
                    <div className="lead-details-info-item">
                      <span className="lead-details-label">Location(s)</span>
                      <div className="lead-details-tags">
                        {getTcLocationNames.length > 0
                          ? getTcLocationNames.map((name, index) => <span key={index} className="lead-details-tag lead-details-tag--location">{name}</span>)
                          : <span className="lead-details-value">-</span>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          {roleCode !== 'TC' && (
          <>
          <section className="lead-details-card">
            <button type="button" className="lead-accordion-head" onClick={() => setAccordionOpen((prev) => (prev === 'interest' ? '' : 'interest'))}>
              <span className="lead-details-card-title">Requirements & Interest</span>
              <span className="lead-accordion-icon">{accordionOpen === 'interest' ? '−' : '+'}</span>
            </button>
            {accordionOpen === 'interest' && (
              <div className="lead-details-info-grid">
                <div className="lead-details-info-item">
                  <span className="lead-details-label">Project(s)</span>
                  <div className="lead-details-tags">
                    {getProjectNames.length > 0
                      ? getProjectNames.map((name, index) => <span key={index} className="lead-details-tag lead-details-tag--project">{name}</span>)
                      : <span className="lead-details-value">-</span>}
                  </div>
                </div>
                <div className="lead-details-info-item">
                  <span className="lead-details-label">Location(s)</span>
                  <div className="lead-details-tags">
                    {getLocationNames.length > 0
                      ? getLocationNames.map((name, index) => <span key={index} className="lead-details-tag lead-details-tag--location">{name}</span>)
                      : <span className="lead-details-value">-</span>}
                  </div>
                </div>
                <div className="lead-details-info-item">
                  <span className="lead-details-label">Budget</span>
                  <span className="lead-details-value">
                    {(lead.budgetMin != null || lead.budgetMax != null)
                      ? `${lead.budgetMin != null ? formatCurrency(lead.budgetMin) : '0'} - ${lead.budgetMax != null ? formatCurrency(lead.budgetMax) : 'No limit'}`
                      : 'Not specified'}
                  </span>
                </div>
                <div className="lead-details-info-item"><span className="lead-details-label">Configuration</span><span className="lead-details-value">{lead.configuration || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Purpose</span><span className="lead-details-value">{lead.purpose || '-'}</span></div>
                {lead.motivationType && (
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Buying Motivation</span>
                    <span className="lead-details-value">
                      <span className="crm-badge" style={{ background: 'var(--accent-blue-bg)', color: 'var(--accent-blue)', fontSize: 11 }}>
                        {lead.motivationType}
                      </span>
                    </span>
                  </div>
                )}
                {lead.customerType && (
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Customer Type</span>
                    <span className="lead-details-value">
                      <span className="crm-badge" style={{ background: 'var(--accent-green-bg)', color: '#15803d', fontSize: 11 }}>
                        {lead.customerType}
                      </span>
                    </span>
                  </div>
                )}
                {lead.primaryRequirement && (
                  <div className="lead-details-info-item" style={{ gridColumn: 'span 2' }}>
                    <span className="lead-details-label">Primary Requirement</span>
                    <span className="lead-details-value">{lead.primaryRequirement}</span>
                  </div>
                )}
                {lead.secondaryRequirement && (
                  <div className="lead-details-info-item" style={{ gridColumn: 'span 2' }}>
                    <span className="lead-details-label">Secondary / Site Remarks</span>
                    <span className="lead-details-value" style={{ fontSize: 13, lineHeight: 1.4 }}>{lead.secondaryRequirement}</span>
                  </div>
                )}
                {lead.timeSpent != null && (
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Time Spent (mins)</span>
                    <span className="lead-details-value">{lead.timeSpent}</span>
                  </div>
                )}
                {latestLeadVisitDetails && (
                  <div className="lead-details-info-item" style={{ gridColumn: 'span 2' }}>
                    <span className="lead-details-label">Latest Site Visit Details</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 8 }}>
                      {VISIT_DETAIL_KEYS.map((key) => (
                        <div key={key}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>
                            {VISIT_DETAIL_LABELS[key]}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {displayVisitDetailValue(key, latestLeadVisitDetails[key])}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
          </>
          )}

          <section className="lead-details-card">
            <button type="button" className="lead-accordion-head" onClick={() => setAccordionOpen((prev) => (prev === 'assignment' ? '' : 'assignment'))}>
              <span className="lead-details-card-title">Assignment</span>
              <span className="lead-accordion-icon">{accordionOpen === 'assignment' ? '−' : '+'}</span>
            </button>
            {accordionOpen === 'assignment' && (
              <div className="lead-details-info-grid">
                <div className="lead-details-info-item"><span className="lead-details-label">Assigned To</span><span className="lead-details-value lead-details-value--primary">{lead.assignedToUserName || 'Unassigned'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Assigned By</span><span className="lead-details-value">{lead.assignedByUserName || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Assigned At</span><span className="lead-details-value">{lead.assignedAt ? formatDateTime(lead.assignedAt) : '-'}</span></div>
                {/* <div className="lead-details-info-item"><span className="lead-details-label">Current Assigned User</span><span className="lead-details-value">{lead.ownerRoleLabel || lead.ownerRole || '-'}</span></div> */}
                {lead.handoff?.fromUserName && (
                  <div className="lead-details-info-item">
                    <span className="lead-details-label">Last Handoff</span>
                    <span className="lead-details-value">{lead.handoff.fromUserName} → {lead.handoff.toUserName || 'Unassigned'}</span>
                    {lead.handoff.handedOffAt && <small>{formatDateTime(lead.handoff.handedOffAt)}</small>}
                  </div>
                )}
              </div>
            )}
          </section>

          {roleCode !== 'TC' && (
          <section className="lead-details-card">
            <button type="button" className="lead-accordion-head" onClick={() => setAccordionOpen((prev) => (prev === 'campaign' ? '' : 'campaign'))}>
              <span className="lead-details-card-title">Campaign & Audit</span>
              <span className="lead-accordion-icon">{accordionOpen === 'campaign' ? '−' : '+'}</span>
            </button>
            {accordionOpen === 'campaign' && (
              <div className="lead-details-info-grid">
                <div className="lead-details-info-item"><span className="lead-details-label">Campaign</span><span className="lead-details-value">{lead.campaignName || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">UTM Source</span><span className="lead-details-value">{lead.utmSource || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">UTM Medium</span><span className="lead-details-value">{lead.utmMedium || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">UTM Campaign</span><span className="lead-details-value">{lead.utmCampaign || '-'}</span></div>
                {(lead.customFields?.telephony_did_number || lead.customFields?.telephony_dialled_number) && (
                  <div className="lead-details-info-item"><span className="lead-details-label">Ad Number Dialled</span><span className="lead-details-value">{lead.customFields?.telephony_did_number || lead.customFields?.telephony_dialled_number}</span></div>
                )}
                {lead.customFields?.telephony_call_id && (
                  <div className="lead-details-info-item"><span className="lead-details-label">First Call ID</span><span className="lead-details-value">{lead.customFields.telephony_call_id}</span></div>
                )}
                {lead.customFields?.marketing_external_ref && (
                  <div className="lead-details-info-item"><span className="lead-details-label">External Ref</span><span className="lead-details-value">{lead.customFields.marketing_external_ref}</span></div>
                )}
                <div className="lead-details-info-item"><span className="lead-details-label">Created At</span><span className="lead-details-value">{lead.createdAt ? formatDateTime(lead.createdAt) : '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Updated At</span><span className="lead-details-value">{lead.updatedAt ? formatDateTime(lead.updatedAt) : '-'}</span></div>
              </div>
            )}
          </section>
          )}
        </div>

        <div className="lead-details-right">
          <div className="lead-details-tabs">
            <button className={`lead-details-tab ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveTab('followups')}>Follow Up</button>
            <button className={`lead-details-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
            <button className={`lead-details-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>Notes</button>
            <button className={`lead-details-tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>Call Logs</button>
            <button className={`lead-details-tab ${activeTab === 'enquiries' ? 'active' : ''}`} onClick={() => setActiveTab('enquiries')}>Enquiries</button>
            {roleCode !== 'TC' && (
              <button className={`lead-details-tab ${activeTab === 'sitevisits' ? 'active' : ''}`} onClick={() => setActiveTab('sitevisits')}>Site Visits</button>
            )}
          </div>

          <div className="lead-details-tab-content">
            {false && activeTab === 'actions' && (
              <div className="lead-actions-panel">
                {isSmHandoffReadOnly && (
                  <p className="lead-actions-hint" style={{ marginBottom: 12 }}>This lead is currently view-only for you after handoff to Sales Head.</p>
                )}
                {roleActions.length === 0 ? (
                  <p className="lead-details-empty">No workflow actions configured for your role.</p>
                ) : (
                  <>
                    <label className="lead-actions-label">
                      Select Action
                      <select value={actionCode} onChange={(e) => handleActionPick(e.target.value)} disabled={isSmHandoffReadOnly}>
                        <option value="">Choose an action...</option>
                        {roleActions.map((action) => (
                          <option key={action.code} value={action.code}>{action.label}</option>
                        ))}
                      </select>
                    </label>

                    {selectedAction && (
                      <div className="lead-actions-form">
                        <div className="lead-actions-meta">
                          <strong>{selectedAction.label}</strong>
                          <span>{selectedAction.code}</span>
                        </div>

                        {selectedAction.needsFollowUp && (
                          <label className="lead-actions-label">
                            <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Follow up Date *
                            <CalendarPicker
                              type="date"
                              value={actionForm.nextFollowUpAt}
                              onChange={(val) => setActionForm((p) => ({ ...p, nextFollowUpAt: val || '' }))}
                              placeholder="Select Date..."
                              minDate={getFollowUpMinimumTime().toISOString()}
                              maxDate={followUpMaxDate(selectedAction?.targetStatusCode || lead?.statusCode).toISOString()}
                            />
                            <div className="qa-remarks-wrap" style={{ marginTop: 8 }}>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0) }))}>Today</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(1) }))}>Tomorrow</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6) }))}>This Sat</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0) }))}>This Sun</button>
                            </div>
                          </label>
                        )}

                        {(selectedAction.needsAssignee || selectedAction.needsSvDetails || selectedAction.code === 'TC_SV_DONE') && (
                          <label className="lead-actions-label">
                            {getAssigneeRoleForAction(selectedAction, roleCode) === 'SH' ? 'Select Sales Head (Negotiator) *' : 'Assign To *'}
                            <select
                              value={actionForm.assignToUserId}
                              onChange={(e) => setActionForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                            >
                              <option value="">{getAssigneeRoleForAction(selectedAction, roleCode) === 'SH' ? 'Select Sales Head...' : 'Select user...'}</option>
                              {assignableUsers.map((item) => (
                                <option key={item.id} value={item.id}>{item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim()}</option>
                              ))}
                            </select>
                          </label>
                        )}

                        {selectedAction.code === 'TC_SV_DONE' && (
                          <div className="lead-actions-grid">
                            <label className="lead-actions-label">
                              Site Visit Date *
                              <input
                                type="date"
                                value={actionForm.svDate}
                                onChange={(e) => setActionForm((p) => ({ ...p, svDate: e.target.value }))}
                              />
                            </label>

                            <label className="lead-actions-label">
                              Project Visited *
                              <select
                                value={actionForm.svProjectId}
                                onChange={(e) => setActionForm((p) => ({ ...p, svProjectId: e.target.value }))}
                              >
                                <option value="">Select project...</option>
                                {projectOptions.map((project) => (
                                  <option key={project.id} value={project.id}>{project.project_name}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        {selectedAction.needsSvDetails && selectedAction.code !== 'TC_SV_DONE' && (
                          <>
                            {/* 📅 Visit Details */}
                            <div className="lead-actions-section-head" style={{ fontWeight: 700, marginTop: 6, marginBottom: 4 }}>📅 Visit Details</div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Visit Date *
                                <input
                                  type="date"
                                  value={actionForm.svDate}
                                  onChange={(e) => setActionForm((p) => ({ ...p, svDate: e.target.value }))}
                                />
                              </label>
                              <label className="lead-actions-label">
                                Project *
                                <select
                                  value={actionForm.svProjectId}
                                  onChange={(e) => setActionForm((p) => ({ ...p, svProjectId: e.target.value }))}
                                >
                                  <option value="">Select project...</option>
                                  {projectOptions.map((project) => (
                                    <option key={project.id} value={project.id}>{project.project_name}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Time Slot
                                <input
                                  value={actionForm.scheduledTimeSlot}
                                  onChange={(e) => setActionForm((p) => ({ ...p, scheduledTimeSlot: e.target.value }))}
                                  placeholder="e.g. 10 AM - 12 PM"
                                />
                              </label>
                              <label className="lead-actions-label">
                                Time Spent (mins) *
                                <input
                                  type="number"
                                  min="0"
                                  value={actionForm.timeSpent}
                                  onChange={(e) => setActionForm((p) => ({ ...p, timeSpent: e.target.value }))}
                                  placeholder="30"
                                />
                              </label>
                            </div>

                            {/* 👤 Customer Profile */}
                            <div className="lead-actions-section-head" style={{ fontWeight: 700, marginTop: 10, marginBottom: 4 }}>👤 Customer Profile</div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Buyer Profile *
                                <select
                                  value={actionForm.customerTypeId}
                                  onChange={(e) => setActionForm((p) => ({ ...p, customerTypeId: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {customerTypeOptions.map((ct) => (
                                    <option key={ct.id} value={ct.id}>{ct.type_name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="lead-actions-label">
                                Age Bracket *
                                <select
                                  value={actionForm.ageBracket}
                                  onChange={(e) => setActionForm((p) => ({ ...p, ageBracket: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {AGE_BRACKET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </label>
                            </div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Decision Maker Present *
                                <select
                                  value={actionForm.decisionMaker}
                                  onChange={(e) => setActionForm((p) => ({ ...p, decisionMaker: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {DECISION_MAKER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </label>
                              <label className="lead-actions-label">
                                Secondary Contact *
                                <input
                                  value={actionForm.secondaryContact}
                                  onChange={(e) => setActionForm((p) => ({ ...p, secondaryContact: e.target.value }))}
                                  placeholder="Secondary phone"
                                />
                              </label>
                            </div>

                            {/* 🏠 Property Requirement */}
                            <div className="lead-actions-section-head" style={{ fontWeight: 700, marginTop: 10, marginBottom: 4 }}>🏠 Property Requirement</div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Customer Requirement *
                                <input
                                  value={actionForm.customerRequirement}
                                  onChange={(e) => setActionForm((p) => ({ ...p, customerRequirement: e.target.value }))}
                                  placeholder="e.g. 2BHK near school"
                                />
                              </label>
                              <label className="lead-actions-label">
                                Budget *
                                <input
                                  value={actionForm.budget}
                                  onChange={(e) => setActionForm((p) => ({ ...p, budget: e.target.value }))}
                                  placeholder="e.g. 60L"
                                />
                              </label>
                            </div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Timeline to Buy *
                                <select
                                  value={actionForm.timelineToBuy}
                                  onChange={(e) => setActionForm((p) => ({ ...p, timelineToBuy: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {TIMELINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </label>
                              <label className="lead-actions-label">
                                Preferred Facing *
                                <select
                                  value={actionForm.preferredFacing}
                                  onChange={(e) => setActionForm((p) => ({ ...p, preferredFacing: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {FACING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </label>
                            </div>
                            <label className="lead-actions-label">
                              Address *
                              <textarea
                                rows={2}
                                value={actionForm.address}
                                onChange={(e) => setActionForm((p) => ({ ...p, address: e.target.value }))}
                                placeholder="Customer address"
                              />
                            </label>
                            <label className="lead-actions-label">
                              Specific Concerns *
                              <textarea
                                rows={2}
                                value={actionForm.specificConcerns}
                                onChange={(e) => setActionForm((p) => ({ ...p, specificConcerns: e.target.value }))}
                                placeholder="Customer concerns"
                              />
                            </label>

                            {/* 💰 Purchase Intent */}
                            <div className="lead-actions-section-head" style={{ fontWeight: 700, marginTop: 10, marginBottom: 4 }}>💰 Purchase Intent</div>
                            <div className="lead-actions-grid">
                              <label className="lead-actions-label">
                                Purpose Of Purchase *
                                <select
                                  value={actionForm.motivationType}
                                  onChange={(e) => setActionForm((p) => ({ ...p, motivationType: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {motivationOptions.map((m) => (
                                    <option key={m.id} value={m.motivation_name}>{m.motivation_name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="lead-actions-label">
                                Payment Type *
                                <select
                                  value={actionForm.paymentType}
                                  onChange={(e) => setActionForm((p) => ({ ...p, paymentType: e.target.value }))}
                                >
                                  <option value="">Select...</option>
                                  {PAYMENT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </label>
                            </div>
                          </>
                        )}

                        <div style={{ marginBottom: '16px' }}>
                          <div className="lead-actions-label" style={{ marginBottom: 8 }}>Status Remarks</div>
                          <div className="qa-remarks-wrap">
                            {(actionStatusRemarks.length > 0 ? actionStatusRemarks : QUICK_REMARKS.map((remarkText) => ({ remark_text: remarkText }))).map((remark) => {
                                const remarkText = remark.remark_text || remark.text || remark.label || '';
                                if (!remarkText) return null;
                                return (
                                  <button
                                    key={remark.id || remarkText}
                                    type="button"
                                    className={`qa-remark-chip ${actionForm.statusRemarkText === remarkText ? 'active' : ''}`}
                                    onClick={() => {
                                      setActionForm((p) => ({
                                        ...p,
                                        statusRemarkText: remarkText,
                                        note: remarkText,
                                        callResult: remark.has_ans_non_ans ? (remark.ans_non_ans_default || actionRemarkAnsNonAns || 'Answered') : p.callResult,
                                      }));
                                      if (remark.has_ans_non_ans) {
                                        setActionRemarkAnsNonAns(remark.ans_non_ans_default || actionRemarkAnsNonAns || 'Answered');
                                      }
                                    }}
                                  >
                                    + {remarkText}
                                  </button>
                                );
                            })}
                          </div>
                        </div>

                        {selectedAction.needsReason && (
                          <>
                            <label className="lead-actions-label">
                              Closure Reason
                              <select
                                value={actionForm.closureReasonId}
                                onChange={(e) => setActionForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                              >
                                <option value="">Select reason...</option>
                                {closureReasons.map((reason) => (
                                  <option key={reason.id} value={reason.id}>{reason.reason || reason.reason_text || reason.label || 'Reason'}</option>
                                ))}
                              </select>
                            </label>

                            <label className="lead-actions-label">
                              Reason Note
                              <textarea
                                rows={2}
                                value={actionForm.reason}
                                onChange={(e) => setActionForm((p) => ({ ...p, reason: e.target.value }))}
                                placeholder="Enter reason details..."
                              />
                            </label>
                          </>
                        )}

                        <label className="lead-actions-label">
                          Action Note
                          <textarea
                            rows={3}
                            value={actionForm.note}
                            onChange={(e) => setActionForm((p) => ({ ...p, note: e.target.value }))}
                            placeholder="Add remarks for this action..."
                          />
                        </label>

                        <div className="lead-actions-row">
                          <button
                            type="button"
                            className="lead-details-action-btn lead-details-action-btn--secondary"
                            onClick={() => {
                              setActionCode('');
                              setActionForm(actionInitialState);
                              setAssignableUsers([]);
                              setClosureReasons([]);
                            }}
                            disabled={actionSaving || isSmHandoffReadOnly}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            className="lead-details-action-btn lead-details-action-btn--primary"
                            onClick={handleRunAction}
                            disabled={
                              actionSaving 
                              || isMissedFirstBlocked
                              || isSmHandoffReadOnly 
                              || (selectedAction?.needsFollowUp && !actionForm.nextFollowUpAt)
                            }
                            title={isMissedFirstBlocked ? 'Complete missed follow-ups first to enable actions' : ''}
                          >
                            {actionSaving ? 'Processing...' : 'Run Action'}
                          </button>
                        </div>

                        {/* Call Result Selection for Tab Action */}
                        {selectedAction && selectedAction.code !== 'TC_SV_DONE' && selectedAction.code !== 'SM_SITE_VISIT' && selectedAction.code !== 'SH_BOOKING' && (
                          <div className="call-result-wrap" style={{ marginTop: 14 }}>
                            <div className="call-result-label">Call Result</div>
                            <div className="call-result-toggle">
                              <button
                                type="button"
                                className={`call-result-btn ${actionForm.callResult === 'Answered' ? 'active' : ''}`}
                                onClick={() => setActionForm(p => ({ ...p, callResult: 'Answered' }))}
                                disabled={selectedAction.code.includes('RNR') || isSmHandoffReadOnly}
                              >
                                Answered
                              </button>
                              <button
                                type="button"
                                className={`call-result-btn ${actionForm.callResult === 'Not Answered' ? 'active' : ''}`}
                                onClick={() => setActionForm(p => ({ ...p, callResult: 'Not Answered' }))}
                                disabled={selectedAction.code.includes('RNR') || isSmHandoffReadOnly}
                              >
                                Not Answered
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="lead-actions-hint">All required fields for selected action are shown here. No popup needed.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="lead-details-timeline">
                {visibleTimelineActivities.length === 0 ? (
                  <p className="lead-details-empty">No activity yet</p>
                ) : (
                  visibleTimelineActivities.map((evt) => (
                    <div key={evt.id} className="lead-details-timeline-item">
                      <div className="lead-details-timeline-icon">
                        {(() => {
                          const Icon = iconForTimeline(evt.type);
                          return Icon ? <Icon style={{ width: 14, height: 14 }} /> : <span style={{ fontSize: 10 }}>•</span>;
                        })()}
                      </div>
                      <div className="lead-details-timeline-content">
                        <div className="lead-details-timeline-header">
                          <span className="lead-details-timeline-title">{evt.title || evt.type.replace(/_/g, ' ')}</span>
                          <span className="lead-details-timeline-date">{formatDateTime(evt.at)}</span>
                        </div>
                        {evt.description && <p className="lead-details-timeline-desc">{formatActivityDescription(evt.description, evt)}</p>}
                        <span className="lead-details-timeline-by">By {evt.by || 'System'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="lead-details-comments">
                <div className="lead-details-comment-form">
                  <textarea placeholder="Add a comment..." value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} disabled={isSmHandoffReadOnly} />
                  <button onClick={handleAddNote} disabled={!noteDraft.trim() || isSmHandoffReadOnly}>Post Comment</button>
                </div>
                <div className="lead-details-note-list">
                  {(lead.notes || []).length === 0 ? (
                    <p className="lead-details-empty">No comments yet</p>
                  ) : (
                    lead.notes.map((note) => (
                      <div key={note.id} className="lead-details-note-item">
                        <div className="lead-details-note-text">{note.text}</div>
                        <div className="lead-details-note-meta">{note.by || 'System'} · {formatDateTime(note.at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'calls' && (
              <div className="lead-details-timeline">
                {!callLogs ? (
                  <p className="lead-details-empty">Loading call logs…</p>
                ) : callLogs.length === 0 ? (
                  <p className="lead-details-empty">No calls recorded for this lead yet.</p>
                ) : (
                  callLogs.map((call) => {
                    const answered = call.call_status === 'ANSWERED';
                    const agentName = call.agent
                      ? `${call.agent.first_name || ''} ${call.agent.last_name || ''}`.trim()
                      : (call.agent_name || call.agent_number || 'Unknown agent');
                    const secs = Number(call.duration) || 0;
                    const durTxt = call.duration !== null && call.duration !== undefined
                      ? (secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`)
                      : null;
                    return (
                      <div key={call.id} className="lead-details-timeline-item">
                        <div
                          className="lead-details-timeline-icon"
                          style={{ background: answered ? '#DCFCE7' : '#FEE2E2', color: answered ? '#166534' : '#991B1B' }}
                        >
                          <PhoneIcon style={{ width: 14, height: 14 }} />
                        </div>
                        <div className="lead-details-timeline-content">
                          <div className="lead-details-timeline-header">
                            <span className="lead-details-timeline-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <CallDirectionIcon direction={call.direction} status={call.call_status} />
                              {answered ? 'Call Answered' : 'Missed Call'}
                              {call.direction && (
                                <span style={{
                                  padding: '1px 6px', borderRadius: 9999, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                                  background: 'var(--bg-secondary, #F3F4F6)', border: '1px solid var(--border-primary, #E5E7EB)', color: 'var(--text-muted, #6B7280)',
                                }}>
                                  {call.direction}
                                </span>
                              )}
                            </span>
                            <span className="lead-details-timeline-date">{formatDateTime(call.start_stamp || call.received_at)}</span>
                          </div>
                          <p className="lead-details-timeline-desc">
                            {[durTxt && `Duration ${durTxt}`, call.customer_number].filter(Boolean).join(' · ') || '—'}
                          </p>
                          <span className="lead-details-timeline-by">By {agentName}</span>
                          <div style={{ marginTop: 6 }}>
                            <RecordingCell callId={call.id} hasRecording={Boolean(call.recording_url)} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'enquiries' && (
              <div className="lead-details-timeline">
                {!enquiries ? (
                  <p className="lead-details-empty">Loading enquiries…</p>
                ) : (
                  <>
                    {(enquiries.reEnquiries || []).map((enq) => (
                      <div key={enq.id} className="lead-details-timeline-item">
                        <div className="lead-details-timeline-icon" style={{ background: '#FFF7ED', color: '#C2410C' }}>
                          <span style={{ fontSize: 10 }}>↻</span>
                        </div>
                        <div className="lead-details-timeline-content">
                          <div className="lead-details-timeline-header">
                            <span className="lead-details-timeline-title">
                              Re-enquiry
                              <span style={{
                                marginLeft: 6, padding: '1px 6px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
                                background: '#FFF7ED', border: '1px solid #FDBA74', color: '#C2410C',
                              }}>
                                2nd+ enquiry
                              </span>
                            </span>
                            <span className="lead-details-timeline-date">{formatDateTime(enq.enquiredAt)}</span>
                          </div>
                          <p className="lead-details-timeline-desc">
                            Source: {enq.source || '—'}
                            {enq.subSource ? ` › ${enq.subSource}` : ''}
                            {enq.campaignName ? ` · Campaign: ${enq.campaignName}` : ''}
                          </p>
                          <span className="lead-details-timeline-by">Via marketing API</span>
                        </div>
                      </div>
                    ))}
                    {enquiries.firstEnquiry && (
                      <div className="lead-details-timeline-item">
                        <div className="lead-details-timeline-icon">
                          <span style={{ fontSize: 10 }}>★</span>
                        </div>
                        <div className="lead-details-timeline-content">
                          <div className="lead-details-timeline-header">
                            <span className="lead-details-timeline-title">First Enquiry</span>
                            <span className="lead-details-timeline-date">{formatDateTime(enquiries.firstEnquiry.enquiredAt)}</span>
                          </div>
                          <p className="lead-details-timeline-desc">
                            Source: {enquiries.firstEnquiry.source || '—'}
                            {enquiries.firstEnquiry.subSource ? ` › ${enquiries.firstEnquiry.subSource}` : ''}
                            {enquiries.firstEnquiry.campaignName ? ` · Campaign: ${enquiries.firstEnquiry.campaignName}` : ''}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'followups' && (
              <div className="lead-details-followups-new">
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Remarks</th>
                        <th>Action By</th>
                        <th>Call Status</th>
                        <th>Date & Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followupRemarkActivities.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-4 text-muted">No status or followup history yet.</td></tr>
                      ) : (
                        followupRemarkActivities.map((evt) => {
                          const statusLabel = getRemarkHistoryStatusLabel(evt, workflowConfig);
                          const remarkText = getUserRemarkText(evt);
                          const callStatus = evt.metadata?.statusRemarkResponseType
                            || evt.metadata?.callResult
                            || evt.metadata?.last_call_result
                            || '';
                          const closureReason = evt.metadata?.closureReasonName || evt.metadata?.closure_reason || '';
                          return (
                          <tr key={evt.id}>
                            <td>
                              <div className="status-cell">
                                {(() => {
                                  const Icon = iconForTimeline(evt.type);
                                  return Icon ? <Icon style={{ width: 14, height: 14, marginRight: 6, color: 'var(--accent-blue)' }} /> : null;
                                })()}
                                <strong>{statusLabel || '—'}</strong>
                              </div>
                            </td>
                            <td>
                              <div>{remarkText || '—'}</div>
                              {closureReason && <div className="qa-remark-closure">Reason: {closureReason}</div>}
                            </td>
                            <td>{evt.by || 'System'}</td>
                            <td>
                              {callStatus ? (
                                <span className={`call-status-badge ${callStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                                  {callStatus}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="text-nowrap">{formatDateTime(evt.at)}</td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {roleCode !== 'TC' && activeTab === 'sitevisits' && (
              <div className="lead-details-sitevisits">
                <div className="lead-details-sitevisits-list">
                  {siteVisits.length === 0 ? (
                    <p className="lead-details-empty">No site visit records found.</p>
                  ) : (
                    <div className="lead-sitevisits-table-wrap" style={{ marginTop: 10 }}>
                      <table className="lead-sitevisits-table-grid lead-sitevisits-table">
                        <thead>
                          <tr>
                            <th>Visit #</th>
                            <th>Project</th>
                            <th>Status</th>
                            <th>Scheduled</th>
                            <th>Visited</th>
                            <th>Time Slot</th>
                            <th>Time Spent (mins)</th>
                            <th>Attended By</th>
                            <th>Customer Type</th>
                            <th>Motivation</th>
                            <th>Requirement</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siteVisits.map((sv) => {
                            const visitDetails = parseVisitDetailsValue(
                              sv.visit_details || sv.visitDetails || sv.site_details || sv.siteDetails
                            );
                            const effectiveVisitDetails = hasVisitDetailsData(visitDetails)
                              ? visitDetails
                              : latestLeadVisitDetails;
                            const attendedBy = getUserDisplayName(sv.attendedBy)
                              || getUserDisplayName(sv.scheduledBy)
                              || lead?.assignedToUserName
                              || '-';
                            const timeSpent = sv.time_spent ?? sv.timeSpent ?? lead?.timeSpent;
                            const customerType = sv.customerType?.type_name || sv.customer_type_name || sv.customer_type || lead?.customerType || '-';
                            const motivation = sv.motivationType?.motivation_name || sv.motivation_type || lead?.motivationType || '-';
                            const requirement = sv.requirement_details || sv.customer_requirement || sv.primary_requirement || lead?.primaryRequirement || '-';
                            const remarks = sv.remarks_long || sv.feedback || sv.remarks || lead?.secondaryRequirement || '-';
                            const projectName = sv.project?.project_name
                              || projectOptions.find((project) => project.id === sv.project_id)?.project_name
                              || 'Unknown Project';

                            return (
                              <React.Fragment key={sv.id}>
                                <tr>
                                  <td>{sv.visit_number || '-'}</td>
                                  <td>{projectName}</td>
                                  <td>
                                    <span className="status-chip" style={badgeStyle(sv.statusColor)}>
                                      {sv.status || '-'}
                                    </span>
                                  </td>
                                  <td>{sv.scheduled_date ? formatDateTime(sv.scheduled_date) : '-'}</td>
                                  <td>{sv.actual_visit_date ? formatDateTime(sv.actual_visit_date) : '-'}</td>
                                  <td>{sv.scheduled_time_slot || '-'}</td>
                                  <td>{timeSpent ?? '-'}</td>
                                  <td>{attendedBy || '-'}</td>
                                  <td>{customerType}</td>
                                  <td>{motivation}</td>
                                  <td>{requirement}</td>
                                  <td>{remarks}</td>
                                </tr>
                                {effectiveVisitDetails && (
                                  <tr>
                                    <td colSpan={12} style={{ padding: '8px 14px 14px', background: 'var(--bg-tertiary)' }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Visit Details</div>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                                        {VISIT_DETAIL_KEYS.map((k) => (
                                          <div key={k}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{VISIT_DETAIL_LABELS[k]}</div>
                                            <div style={{ fontSize: 12, fontWeight: 600 }}>{displayVisitDetailValue(k, effectiveVisitDetails[k])}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {false && activeTab === 'documents' && (
              <div className="lead-details-documents">
                <p className="lead-details-empty">No documents uploaded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Action Modal */}
      {quickActionsOpen && (
        <div className="lead-quick-modal" onClick={closeQuickActionsModal}>
          <div className="qa-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="qa-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BoltIcon style={{ width: 22, height: 22, color: 'var(--text-secondary)' }} />
                  <h2>Quick Actions</h2>
                </div>
                <small style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{lead?.fullName || lead?.full_name} · {lead?.phone}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="qa-header-comms" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="qa-header-icon-btn"
                    title="Call Now (dial from this device)"
                    onClick={() => window.open(`tel:${lead.phone || lead.phone_number}`)}
                  >
                    <PhoneIcon style={{ width: 18, height: 18 }} />
                  </button>
                  <SmartfloCallButton leadId={lead.id} />
                  <button 
                    className="qa-header-icon-btn"
                    title="WhatsApp"
                    onClick={() => window.open(`https://wa.me/${(lead.whatsappNumber || lead.phone || '').replace(/\D/g, '')}`, '_blank')}
                  >
                    <ChatBubbleLeftIcon style={{ width: 18, height: 18 }} />
                  </button>
                </div>
                <button className="qa-header-close" onClick={closeQuickActionsModal}>×</button>
              </div>
            </div>

            {/* ── Scrollable Drawer Body ── */}
            <div className="qa-drawer-body">

              {/* ── Update Status (Status Grid) ── */}
              {!lead.isClosed && (
                <>
                  <div className="qa-drawer-section">Update status</div>
                  {isSmHandoffReadOnly && (
                    <p style={{ margin: '0 20px 8px', fontSize: 12, color: 'var(--text-muted)' }}>This lead is view-only for you after handoff to Sales Head.</p>
                  )}
                  {isSmShUnassignedReadOnly && (
                    <p style={{ margin: '0 20px 8px', fontSize: 12, color: 'var(--text-muted)' }}>This lead is unassigned. Actions are disabled for Sales Manager and Sales Head until assignment.</p>
                  )}
                  <div className="qa-drawer-status-grid">
                    {roleActions.filter((a) => {
                      const isNegotiation = a.code.includes('NEGOTIATION');
                      const isHotNegotiation = a.code.includes('NEGOTIATION_HOT') || a.targetStatusCode === 'NEGOTIATION_HOT';
                      const allowNegotiationAction = roleCode === 'SH' ? true : (!isNegotiation || isHotNegotiation);
                      return a.tone !== 'danger' && !a.code.includes('REASSIGN') && allowNegotiationAction;
                    }).map((action) => {
                      let icon = <ClipboardDocumentListIcon style={{ width: 18, height: 18 }} />;
                      let selClass = 'sel-default';
                      if (action.code.includes('RNR')) { icon = <ArrowPathIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-rnr'; }
                      else if (action.code.includes('SV_DONE') || action.code.includes('SITE_VISIT')) { icon = <CheckCircleIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-done'; }
                      else if (action.code.includes('SCHEDULE') || action.code.includes('REVISIT')) { icon = <CalendarDaysIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-sv-scheduled'; }
                      else if (action.code.includes('FOLLOW_UP')) { icon = <ArrowPathIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }
                      else if (action.code.includes('NEGOTIATION')) { icon = <HandRaisedIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-negotiation'; }
                      else if (action.code.includes('BOOKING')) { icon = <SparklesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                      else if (action.code.includes('PAYMENT')) { icon = <BanknotesIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-booking'; }
                      else if (action.code.includes('REASSIGN')) { icon = <UserIcon style={{ width: 18, height: 18 }} />; selClass = 'sel-follow-up'; }

                      return (
                        <button
                          key={action.code}
                          type="button"
                          className={`qa-drawer-st-btn ${quickSelectedAction?.code === action.code ? selClass : ''}`}
                          disabled={quickActionSaving || isSmHandoffReadOnly || isSmShUnassignedReadOnly || isMissedFirstBlocked}
                          onClick={() => handleQuickActionPick(action.code)}
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
                        className={`qa-drawer-st-btn ${quickSelectedAction?.code === action.code ? 'sel-junk' : ''}`}
                        disabled={quickActionSaving || isSmHandoffReadOnly || isSmShUnassignedReadOnly || isMissedFirstBlocked}
                        onClick={() => handleQuickActionPick(action.code)}
                      >
                        <div className="qa-drawer-st-icon">{action.code.includes('JUNK') ? <NoSymbolIcon style={{ width: 18, height: 18 }} /> : action.code.includes('SPAM') ? <TrashIcon style={{ width: 18, height: 18 }} /> : <ExclamationTriangleIcon style={{ width: 18, height: 18 }} />}</div>
                        <div className="qa-drawer-st-label">{action.label}</div>
                      </button>
                    ))}
                  </div>

                </>
              )}

              {/* ── Contextual: Missing Lead Details (Location/Project) ── */}
              {quickSelectedAction && (
                (() => {
                  const hasLoc = !!(lead?.interestedLocations?.length || lead?.locationId);
                  const hasProj = !!(lead?.interestedProjects?.length || lead?.projectId);
                  const isTerminal = ['TC_JUNK', 'TC_SPAM', 'TC_LOST', 'SM_LOST', 'COL_CANCELLED'].includes(quickSelectedAction.code);
                  const isRnrAction = quickSelectedAction?.targetStatusCode === 'RNR' || quickSelectedAction?.code?.includes('RNR');
                  const needsLocAndProj = !isTerminal && !isRnrAction && roleCode === 'TC';

                  if (needsLocAndProj) {
                    const filteredLocations = !quickLocationSearch.trim() ? locationOptions :
                      locationOptions.filter(l => (l.location_name || '').toLowerCase().includes(quickLocationSearch.toLowerCase()) || (l.city || '').toLowerCase().includes(quickLocationSearch.toLowerCase()));
                    
                    const filteredProjects = !quickProjectSearch.trim() ? (!quickMissingLocationId
                      ? projectOptions
                      : projectOptions.filter(p => {
                          const pLocId = p.location_id || p.locationId || '';
                          return String(pLocId) === String(quickMissingLocationId);
                        }))
                      : projectOptions.filter(p => {
                          const matchesSearch = (p.project_name || '').toLowerCase().includes(quickProjectSearch.toLowerCase()) || (p.project_code || '').toLowerCase().includes(quickProjectSearch.toLowerCase());
                          const matchesLocation = !quickMissingLocationId || String(p.location_id || p.locationId) === String(quickMissingLocationId);
                          return matchesSearch && matchesLocation;
                        });

                    const selectedLocName = locationOptions.find(l => String(l.id) === String(quickMissingLocationId))?.location_name || '';
                      const selectedProjNames = quickMissingProjectIds.map(pid => projectOptions.find(p => String(p.id) === String(pid))?.project_name).filter(Boolean);

                    return (
                      <div className="qa-drawer-ctx-block" style={{ border: '1px solid #fee2e2', background: '#fff1f1', margin: '0 20px 15px', padding: '15px', borderRadius: '12px' }}>
                        <div className="qa-drawer-section" style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 10px', margin: 0, fontSize: 13, fontWeight: 700 }}>
                          <ExclamationTriangleIcon style={{ width: 16, height: 16 }} />
                          Lead Details
                          {hasLoc && hasProj ? <CheckIcon style={{ width: 13, height: 13 }} /> : null}
                        </div>

                        {/* Location Dropdown */}
                        {!hasLoc && (
                          <div style={{ marginBottom: 12, position: 'relative' }}>
                            <label className="qa-drawer-field-label" style={{ color: '#7f1d1d' }}>Primary Location *</label>
                            <div
                              className="qa-drawer-field-select"
                              onClick={() => setQuickLocationDropdownOpen(p => !p)}
                              style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px', borderColor: '#fca5a5' }}
                            >
                              {!selectedLocName && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select location...</span>}
                              {selectedLocName && (
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {selectedLocName}
                                  <span onClick={(e) => { e.stopPropagation(); setQuickMissingLocationId(''); setQuickMissingProjectIds([]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                                </span>
                              )}
                            </div>
                            {quickLocationDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <input type="text" placeholder="Search locations..." value={quickLocationSearch} onChange={(e) => setQuickLocationSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                  {filteredLocations.map((loc) => (
                                    <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <input type="radio" checked={String(quickMissingLocationId) === String(loc.id)} onChange={() => { setQuickMissingLocationId(String(loc.id)); setQuickMissingProjectIds([]); setQuickLocationDropdownOpen(false); setQuickLocationSearch(''); }} />
                                      {loc.location_name}
                                    </label>
                                  ))}
                                  {filteredLocations.length === 0 && <div style={{ padding: '12px', color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center' }}>No locations found</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Project Dropdown */}
                        {!hasProj && (
                          <div style={{ position: 'relative' }}>
                            <label className="qa-drawer-field-label" style={{ color: '#7f1d1d' }}>Interested Project * {quickMissingProjectIds.length > 0 && `(${quickMissingProjectIds.length})`}</label>
                            <div
                              className="qa-drawer-field-select"
                              onClick={() => setQuickProjectDropdownOpen(p => !p)}
                              style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px', borderColor: '#fca5a5' }}
                            >
                              {selectedProjNames.length === 0 && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select projects...</span>}
                              {selectedProjNames.map((name, i) => (
                                <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {name}
                                  <span onClick={(e) => { e.stopPropagation(); setQuickMissingProjectIds(prev => prev.filter((_, idx) => idx !== i)); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                                </span>
                              ))}
                            </div>
                            {quickProjectDropdownOpen && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                                  <input type="text" placeholder="Search projects..." value={quickProjectSearch} onChange={(e) => setQuickProjectSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                  {filteredProjects.map((proj) => (
                                    <label key={proj.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <input type="checkbox" checked={quickMissingProjectIds.map(String).includes(String(proj.id))} onChange={() => { setQuickMissingProjectIds(prev => prev.map(String).includes(String(proj.id)) ? prev.filter((id) => String(id) !== String(proj.id)) : [...prev.map(String), String(proj.id)]); }} />
                                      {proj.project_name}{proj.project_code ? ` (${proj.project_code})` : ''}
                                    </label>
                                  ))}
                                  {filteredProjects.length === 0 && <div style={{ padding: '12px', color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center' }}>No projects found</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()
              )}

              {/* ── Dynamic Form: Shows only after selecting a status ── */}
              {quickSelectedAction && (
                <div style={{ animation: 'qa-fade-in 0.3s ease' }}>
                  {/* ── Contextual: Follow-up Date (when action needs follow-up) ── */}
                  {quickSelectedAction?.needsFollowUp && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Next follow-up date</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0) }))}>Today</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(1) }))}>Tmrw</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6) }))}>This Sat</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0) }))}>This Sun</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(2) }))}>In 2 days</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(7) }))}>Next week</button>
                      </div>
                      <CalendarPicker
                        type="date"
                        value={quickActionForm.nextFollowUpAt}
                        onChange={(val) => setQuickActionForm((p) => ({ ...p, nextFollowUpAt: val }))}
                        maxDate={followUpMaxDate(quickSelectedAction?.targetStatusCode || lead?.statusCode).toISOString()}
                        placeholder="Select follow-up date..."
                        minDate={new Date().toISOString()}
                      />
                    </div>
                  )}

                  {/* ── Contextual: Closure Reason (when action needs reason) ── */}
                  {quickSelectedAction?.needsReason && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Reason *</div>
                      <select
                        className="qa-drawer-field-select"
                        value={quickActionForm.closureReasonId}
                        onChange={(e) => setQuickActionForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                        style={{ width: '100%', marginBottom: 8 }}
                      >
                        <option value="">Select a reason...</option>
                        {quickClosureReasons.map(r => (
                          <option key={r.id} value={r.id}>{r.reason_name || r.reason_text || r.reason}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* ── Contextual: Assignee (when action needs assignee or SV details) ── */}
                  {(quickSelectedAction?.needsAssignee || quickSelectedAction?.needsSvDetails || quickSelectedAction?.code === 'TC_SV_DONE') && (
                    <div className="qa-drawer-ctx-block">
                      <label className="qa-drawer-field-label">
                        {getAssigneeRoleForAction(quickSelectedAction, roleCode) === 'SH' ? 'Select Sales Head (Negotiator) *' : 'Assign To *'}
                      </label>
                      <select
                        className="qa-drawer-field-select"
                        value={quickActionForm.assignToUserId}
                        onChange={(e) => setQuickActionForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                        style={{ width: '100%' }}
                      >
                        <option value="">
                          {getAssigneeRoleForAction(quickSelectedAction, roleCode) === 'SH' ? 'Select Sales Head...' :
                           getAssigneeRoleForAction(quickSelectedAction, roleCode) === 'COL' ? 'Select Collection Manager...' : 'Select user...'}
                        </option>
                        {(Array.isArray(quickAssignableUsers) ? quickAssignableUsers : [])
                          .filter((u) => {
                            if (quickSelectedAction?.code !== 'TC_REASSIGN') return true;
                            const currentAssigneeId = lead?.assignedToUserId || null;
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

                  {quickSelectedAction?.code === 'TC_SV_DONE' && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Visit details</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Site Visit Date *</label>
                          <input
                            type="date"
                            className="qa-drawer-field-input"
                            value={quickActionForm.svDate}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, svDate: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Project Visited *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.svProjectId}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, svProjectId: e.target.value }))}
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
                  {(quickSelectedAction?.needsSvDetails && quickSelectedAction?.code !== 'TC_SV_DONE') && (
                    <div className="qa-drawer-ctx-block">
                      {/* 📅 Visit Details */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>📅 Visit Details</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Visit Date *</label>
                          <input
                            type="date"
                            className="qa-drawer-field-input"
                            value={quickActionForm.svDate}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, svDate: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Project *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.svProjectId}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, svProjectId: e.target.value }))}
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
                          <label className="qa-drawer-field-label">Time Slot</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 10 AM - 12 PM"
                            value={quickActionForm.scheduledTimeSlot}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, scheduledTimeSlot: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Time Spent (mins) *</label>
                          <input
                            type="number"
                            min="0"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 30"
                            value={quickActionForm.timeSpent}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, timeSpent: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* 👤 Customer Profile */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>👤 Customer Profile</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Buyer Profile *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.customerTypeId}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, customerTypeId: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {customerTypeOptions.map((ct) => (
                              <option key={ct.id} value={ct.id}>{ct.type_name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Age Bracket *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.ageBracket}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, ageBracket: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {AGE_BRACKET_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Decision Maker Present *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.decisionMaker}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, decisionMaker: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {DECISION_MAKER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Secondary Contact *</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="Secondary phone"
                            value={quickActionForm.secondaryContact}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, secondaryContact: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* 🏠 Property Requirement */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>🏠 Property Requirement</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Customer Requirement *</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 2BHK near school"
                            value={quickActionForm.customerRequirement}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, customerRequirement: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Budget *</label>
                          <input
                            type="text"
                            className="qa-drawer-field-input"
                            placeholder="e.g. 60L"
                            value={quickActionForm.budget}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, budget: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Timeline to Buy *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.timelineToBuy}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, timelineToBuy: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {TIMELINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Preferred Facing *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.preferredFacing}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, preferredFacing: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {FACING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <label className="qa-drawer-field-label">Address *</label>
                        <textarea
                          className="qa-drawer-remark-ta"
                          rows={2}
                          placeholder="Customer address"
                          value={quickActionForm.address}
                          onChange={(e) => setQuickActionForm((p) => ({ ...p, address: e.target.value }))}
                        />
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <label className="qa-drawer-field-label">Specific Concerns *</label>
                        <textarea
                          className="qa-drawer-remark-ta"
                          rows={2}
                          placeholder="Customer concerns"
                          value={quickActionForm.specificConcerns}
                          onChange={(e) => setQuickActionForm((p) => ({ ...p, specificConcerns: e.target.value }))}
                        />
                      </div>

                      {/* 💰 Purchase Intent */}
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>💰 Purchase Intent</div>
                      <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Purpose Of Purchase *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.motivationType}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, motivationType: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {motivationOptions.map((m) => (
                              <option key={m.id} value={m.motivation_name}>{m.motivation_name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="qa-drawer-field-label">Payment Type *</label>
                          <select
                            className="qa-drawer-field-select"
                            value={quickActionForm.paymentType}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, paymentType: e.target.value }))}
                            style={{ width: '100%' }}
                          >
                            <option value="">Select...</option>
                            {PAYMENT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Contextual: Customer Profile ── */}
                  {(quickSelectedAction?.needsCustomerProfile || quickSelectedAction?.code === 'SH_BOOKING') && (
                    <div className="qa-drawer-profile-block">
                      {/* ── Buyer Name & Booking Date ── */}
                      <div className="qa-drawer-profile-section"><UserIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Buyer Name</div>
                      <div className="qa-drawer-profile-grid" style={{ marginBottom: 12 }}>
                        <div>
                          <label className="qa-drawer-field-label">Buyer Name</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} placeholder="Enter buyer name (if different from lead)" value={customerProfileForm.buyer_name} onChange={(e) => setCustomerProfileForm(p => ({ ...p, buyer_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Booking Date *</label>
                          <input type="date" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.bookingDate || ''} onChange={(e) => setCustomerProfileForm(p => ({ ...p, bookingDate: e.target.value }))} required />
                        </div>
                      </div>
                      {/* ── Project Selection for Booking ── */}
                      <div className="qa-drawer-profile-section"><MapPinIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Select Project for Booking</div>
                      <div className="qa-drawer-profile-grid">
                        <div>
                          <label className="qa-drawer-field-label">Location</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.bookingLocationId} onChange={(e) => { setCustomerProfileForm(p => ({ ...p, bookingLocationId: e.target.value, bookingProjectId: '', bookingPhaseId: '', inventoryUnitId: '' })); setBookingPhases([]); setAvailableUnits([]); }}>
                            <option value="">— Select Location —</option>
                            {locationOptions.filter(l => l.is_active !== false).map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Project</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.bookingProjectId} onChange={(e) => { const projId = e.target.value; setCustomerProfileForm(p => ({ ...p, bookingProjectId: projId, bookingPhaseId: '', inventoryUnitId: '' })); setBookingPhases([]); setAvailableUnits([]); if (projId) { projectPhaseApi.dropdown(projId).then(resp => { const phases = resp.data?.data || resp.data || []; setBookingPhases(phases); if (phases.length === 0) { inventoryUnitApi.getDropdown({ project_id: projId }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([])); } }).catch(() => { setBookingPhases([]); inventoryUnitApi.getDropdown({ project_id: projId }).then(r => setAvailableUnits(r.data || [])).catch(() => setAvailableUnits([])); }); } }}>
                            <option value="">— Select Project —</option>
                            {projectOptions.filter(p => p.is_active !== false && (!customerProfileForm.bookingLocationId || p.location_id === customerProfileForm.bookingLocationId)).map(proj => (
                              <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* ── Phase Selection ── */}
                      {bookingPhases.length > 0 && customerProfileForm.bookingProjectId && (
                        <>
                          <div className="qa-drawer-profile-section"><TableCellsIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Select Phase</div>
                          <div>
                            <label className="qa-drawer-field-label">Phase</label>
                            <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.bookingPhaseId} onChange={(e) => { const phaseId = e.target.value; setCustomerProfileForm(p => ({ ...p, bookingPhaseId: phaseId, inventoryUnitId: '' })); setAvailableUnits([]); if (phaseId) { inventoryUnitApi.getDropdown({ project_id: customerProfileForm.bookingProjectId, phase_id: phaseId }).then(resp => setAvailableUnits(resp.data || [])).catch(() => setAvailableUnits([])); } }}>
                              <option value="">— Select Phase —</option>
                              {bookingPhases.map(phase => (
                                <option key={phase.id} value={phase.id}>
                                  {phase.phase_name}{phase.phase_code ? ` (${phase.phase_code})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

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

                      {/* ── Payment Plan Selection ── */}
                      <div className="qa-drawer-profile-section"><BanknotesIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Payment Plan *</div>
                      <div>
                        <label className="qa-drawer-field-label">Select Payment Plan</label>
                        <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.paymentPlanId} onChange={(e) => setCustomerProfileForm(p => ({ ...p, paymentPlanId: e.target.value }))}>
                          <option value="">— Select Payment Plan —</option>
                          {paymentPlans.map(plan => (
                            <option key={plan.id} value={plan.id}>
                              {plan.plan_name}
                            </option>
                          ))}
                        </select>
                      </div>

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
                      <div>
                        <label className="qa-drawer-field-label">Area / Locality</label>
                        <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_area} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_area: e.target.value }))} placeholder="e.g. MG Road, Koramangala" />
                      </div>
                      <div className="qa-drawer-profile-grid-3">
                        <div>
                          <label className="qa-drawer-field-label">City</label>
                          <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} />
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">State</label>
                          <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))}>
                            <option value="">— Select State —</option>
                            {INDIAN_STATES_UTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="qa-drawer-field-label">Pincode</label>
                          <input type="text" className="qa-drawer-field-input" style={{ maxWidth: 120 }} maxLength={6} value={customerProfileForm.current_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_pincode: e.target.value.replace(/\D/g, '') }))} placeholder="6 digits" />
                        </div>
                      </div>

                      {quickSelectedAction?.code !== 'SH_BOOKING' && (
                        <>
                          <div className="qa-drawer-profile-section"><HomeIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Permanent Address</div>
                          <div>
                            <label className="qa-drawer-field-label">Address</label>
                            <textarea className="qa-drawer-remark-ta" rows={2} value={customerProfileForm.permanent_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_address: e.target.value }))} />
                          </div>
                          <div>
                            <label className="qa-drawer-field-label">Area / Locality</label>
                            <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.permanent_area} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_area: e.target.value }))} placeholder="e.g. MG Road, Koramangala" />
                          </div>
                          <div className="qa-drawer-profile-grid-3">
                            <div>
                              <label className="qa-drawer-field-label">City</label>
                              <input type="text" className="qa-drawer-field-input" style={{ width: '100%' }} value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} />
                            </div>
                            <div>
                              <label className="qa-drawer-field-label">State</label>
                              <select className="qa-drawer-field-select" style={{ width: '100%' }} value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))}>
                                <option value="">— Select State —</option>
                                {INDIAN_STATES_UTS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="qa-drawer-field-label">Pincode</label>
                              <input type="text" className="qa-drawer-field-input" style={{ maxWidth: 120 }} maxLength={6} value={customerProfileForm.permanent_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_pincode: e.target.value.replace(/\D/g, '') }))} placeholder="6 digits" />
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
                            className={`qa-drawer-rchip ${quickActionForm.statusRemarkText === remark.remark_text ? 'sel' : ''}`}
                            onClick={() => {
                              setQuickActionForm(p => ({ ...p, statusRemarkText: remark.remark_text, note: remark.remark_text }));
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
                      {quickSelectedAction?.code !== 'SH_BOOKING' && quickStatusRemarks.some(r => r.has_ans_non_ans) && (
                        <div style={{ margin: '10px 0', padding: '10px', background: 'var(--bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>call status</span>
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
                      value={quickActionForm.note}
                      onChange={(e) => setQuickActionForm((p) => ({ ...p, note: e.target.value }))}
                      placeholder="What was discussed? What's the next step?"
                    />
                    {/* Voice note (record + transcribe + translate).
                        Roles are controlled in utils/voiceNotes.js. */}
                    {canUseVoiceNotes(roleCode) && (
                      <VoiceNoteField
                        voice={quickVoice}
                        onVoiceChange={setQuickVoice}
                        transcribeApi={leadWorkflowApi.transcribeVoice}
                        onTranscribed={(text) => setQuickActionForm((p) => ({
                          ...p,
                          note: p.note?.trim() ? `${p.note.trim()}\n${text}` : text,
                        }))}
                      />
                    )}
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
                {quickActionActivities.filter((act) => !isWorkflowNoteActivity(act)).length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No history yet.</p>
                ) : (
                  quickActionActivities.filter((act) => !isWorkflowNoteActivity(act)).slice(0, 5).map((act, i) => {
                    const isStage = act.type === 'STAGE_CHANGE';
                    const isNote = act.type === 'NOTE_ADDED';
                    const dotColor = isStage ? '#5B3FA6' : isNote ? '#B45309' : '#1A5FA8';
                    const dotBg = isStage ? '#EEE9FC' : isNote ? '#FEF3C7' : '#E3EEFB';
                    return (
                      <div key={act.id} className="qa-drawer-hist-item">
                        <div className="qa-drawer-hist-col">
                          <div className="qa-drawer-hist-dot" style={{ background: dotBg, borderColor: dotColor }} />
                          {i < Math.min(quickActionActivities.filter((item) => !isWorkflowNoteActivity(item)).length, 5) - 1 && <div className="qa-drawer-hist-line" />}
                        </div>
                        <div className="qa-drawer-hist-right">
                          <div className="qa-drawer-hist-header">
                            <span className="qa-drawer-hist-status" style={{ color: dotColor }}>{act.title}</span>
                            <span className="qa-drawer-hist-date">{formatDateTime(act.at || act.created_at)}</span>
                          </div>
                          {act.description && <div className="qa-drawer-hist-remark">{formatActivityDescription(act.description, act)}</div>}
                          {act.metadata?.voice?.file_url && (
                            <AuthedAudio
                              src={act.metadata.voice.file_url}
                              controls
                              preload="none"
                              style={{ height: 34, width: '100%', maxWidth: 280, marginTop: 6 }}
                            />
                          )}
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
              {siteVisits.length > 0 && (
                <>
                  <div className="qa-drawer-divider" />
                  <div className="qa-drawer-section" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HomeModernIcon style={{ width: 16, height: 16 }} /> Recent site visits</div>
                  <div className="qa-remark-table-wrap" style={{ padding: '0 20px 10px' }}>
                    <table className="qa-remark-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Status</th>
                          <th>Scheduled / Visited</th>
                          <th>Time Spent (mins)</th>
                          <th>Attended By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {siteVisits.slice(0, 6).map((sv) => (
                          <tr key={sv.id}>
                            <td>{sv.project?.project_name || 'Unknown'}</td>
                            <td>
                              <span className="qa-remark-call-badge" style={{ background: sv.status === 'Completed' ? '#E0F4EE' : '#FEF3C7', color: sv.status === 'Completed' ? '#0F7B5C' : '#B45309', borderColor: sv.status === 'Completed' ? '#8FD3BA' : '#F6D37A' }}>
                                {sv.status || '-'}
                              </span>
                            </td>
                            <td>
                              {sv.actual_visit_date ? formatDateTime(sv.actual_visit_date) : formatDateTime(sv.scheduled_date)}
                            </td>
                            <td>{sv.time_spent ?? sv.timeSpent ?? '-'}</td>
                            <td>{sv.attendedBy ? `${sv.attendedBy.first_name || ''} ${sv.attendedBy.last_name || ''}`.trim() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {siteVisits.length > 6 && (
                    <div style={{ textAlign: 'center', paddingBottom: 10, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      +{siteVisits.length - 6} more
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
                  // Same-day updates collapse into a single entry; activities are newest-first
                  // so the first per local day is that day's latest. Lead Activity keeps all.
                  const seenDays = new Set();
                  const dailyRemarkActivities = remarkActivities.filter((act) => {
                    const d = new Date(act.at || act.created_at);
                    if (Number.isNaN(d.getTime())) return true;
                    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                    if (seenDays.has(dayKey)) return false;
                    seenDays.add(dayKey);
                    return true;
                  });
                  if (dailyRemarkActivities.length === 0) {
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
                          {dailyRemarkActivities.map((act) => {
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
                onClick={closeQuickActionsModal}
              >
               Close
              </button>
              <button
                className="qa-drawer-save-btn"
                disabled={
                  quickActionSaving
                  || isSmHandoffReadOnly
                  || isSmShUnassignedReadOnly
                  || isMissedFirstBlocked
                  || !quickSelectedAction
                  || (isRemarkMandatoryForAction(quickSelectedAction)
                    && !(quickActionForm.statusRemarkText || '').trim()
                    && !(quickActionForm.note || '').trim())
                  || ((quickSelectedAction?.needsAssignee
                    || quickSelectedAction?.code === 'TC_SV_DONE'
                    || quickSelectedAction?.code === 'TC_REASSIGN')
                    && !quickActionForm.assignToUserId)
                  || (quickSelectedAction?.needsFollowUp && !quickActionForm.nextFollowUpAt)
                  || (quickSelectedAction?.needsReason && !quickActionForm.closureReasonId)
                }
                onClick={handleQuickActionSubmit} style={{ backgroundColor: '#625afa' }}
              >
                {quickActionSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadDetailsPage;
