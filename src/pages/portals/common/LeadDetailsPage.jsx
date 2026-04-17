import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import siteVisitApi from '../../../api/siteVisitApi';
import statusRemarkApi from '../../../api/statusRemarkApi';

import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { getRoleCode } from '../../../utils/permissions';
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
  TrophyIcon,
  IdentificationIcon,
  HomeIcon,
  BoltIcon,
  TableCellsIcon,
  HomeModernIcon,
  ChatBubbleLeftIcon
} from '@heroicons/react/24/outline';
import CalendarPicker from '../../../components/common/CalendarPicker';
import './LeadDetailsPage.css';

const QUICK_REMARKS = [
  'Interested', 'Shared Details', 'Callback Later', 'Busy', 
  'Not Reachable', 'RNR', 'Wrong Number', 'Follow-up Scheduled'
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

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getQuickFollowUpDate = (dayOffset, hour, minute = 0) => {
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
  latitude: '',
  longitude: '',
  timeSpent: '',
  callResult: 'Answered',
};

const LeadDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);
  const roleCode = getRoleCode(authUser);

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState(null);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [workflowConfig, setWorkflowConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('activity');
  const [siteVisits, setSiteVisits] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [assignedUser, setAssignedUser] = useState(null);
  const [userTotalScore, setUserTotalScore] = useState(0);

  const [qaActiveTab, setQaActiveTab] = useState('activity');
  const [actionCode, setActionCode] = useState('');
  const [actionForm, setActionForm] = useState(actionInitialState);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [closureReasons, setClosureReasons] = useState([]);
  const [actionSaving, setActionSaving] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState('contact');
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
  const [customerProfileForm, setCustomerProfileForm] = useState({
    date_of_birth: '', marital_status: '', purchase_type: '',
    occupation: '', current_post: '',
    pan_number: '', aadhar_number: '',
    current_address: '', current_city: '', current_state: '', current_pincode: '',
    sameAsCurrent: true,
    permanent_address: '', permanent_city: '', permanent_state: '', permanent_pincode: ''
  });


  const roleActions = useMemo(() => getActionsForRole(workflowConfig?.actions || {}, roleCode), [workflowConfig, roleCode]);
  const selectedAction = useMemo(() => roleActions.find((a) => a.code === actionCode) || null, [roleActions, actionCode]);
  const quickSelectedAction = useMemo(() => roleActions.find((a) => a.code === quickActionCode) || null, [roleActions, quickActionCode]);
  const isSmHandoffReadOnly = useMemo(() => {
    if (roleCode !== 'SM' || !lead || !authUser?.id) return false;
    const assignedToOtherUser = lead.assignedToUserId && String(lead.assignedToUserId) !== String(authUser.id);
    return assignedToOtherUser
      && lead.assignedRole === 'SH'
      && lead.previousAssignedTo
      && String(lead.previousAssignedTo) === String(authUser.id);
  }, [authUser?.id, lead, roleCode]);


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
          return loc ? `${loc.location_name}${loc.city ? `, ${loc.city}` : ''}` : null;
        })
        .filter(Boolean);
    }
    return lead.location ? [lead.location] : [];
  }, [lead, locationOptions]);

  const loadLeadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    try {
      const [leadResp, projResp, locResp, wfResp, svResp] = await Promise.all([
        leadWorkflowApi.getLeadById(id),
        projectApi.getDropdown(),
        locationApi.getDropdown(),
        leadWorkflowApi.getWorkflowConfig().catch(() => ({ data: null })),
        siteVisitApi.getAll({ lead_id: id }).catch(() => ({ data: { rows: [] } })),
      ]);

      const leadData = leadResp.data;
      setLead(leadData);
      setProjectOptions(projResp.data || []);
      setLocationOptions(locResp.data || []);
      setWorkflowConfig(wfResp.data || null);
      setSiteVisits(Array.isArray(svResp.data?.rows) ? svResp.data.rows : Array.isArray(svResp.data) ? svResp.data : []);

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
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadLeadData();
  }, [loadLeadData]);

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
    } else {
      setUsers([]);
    }

    if (action.needsReason && action.reasonCategory) {
      try {
        const resp = await leadWorkflowApi.getClosureReasons(action.reasonCategory);
        setReasons(resp.data?.rows || resp.data || []);
      } catch {
        setReasons([]);
      }
    } else {
      setReasons([]);
    }
  }, [roleCode]);

  const closeQuickActionsModal = useCallback(() => {
    setQuickActionsOpen(false);
    setQuickActionCode('');
    setQuickActionForm(actionInitialState);
    setQuickAssignableUsers([]);
    setQuickClosureReasons([]);
    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);
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
    const needsInput = Boolean(
      action?.needsFollowUp
      || action?.needsAssignee
      || action?.needsReason
      || action?.needsSvDetails
      || action?.needsCustomerProfile
      || action?.code === 'TC_SV_DONE'
    );
    setActionForm((p) => ({
      ...actionInitialState,
      budgetMin: lead?.budgetMin ?? '',
      budgetMax: lead?.budgetMax ?? '',
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

    if (!needsInput) {
      setActionForm((p) => ({ ...p, note: `Quick action: ${action.label}` }));
    }
  };

  const handleRunAction = async () => {
    if (!lead?.id || !selectedAction) return;
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
      callResult: actionForm.callResult,
      statusRemarkText: actionForm.statusRemarkText.trim() || undefined,
      statusRemarkResponseType: actionRemarkAnsNonAns || undefined,
    };

    if (selectedAction.needsFollowUp) {
      if (!actionForm.nextFollowUpAt) {
        toast.error('Follow-up date & time is required');
        return;
      }
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
      if (!payload.note) payload.note = payload.reason;
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
      if (selectedAction.code !== 'TC_SV_DONE' && !actionForm.svDate) {
        toast.error('Site visit date is required');
        return;
      }
      if (!actionForm.svProjectId) {
        toast.error('Project visited is required');
        return;
      }
      if (selectedAction.needsSvDetails && selectedAction.code !== 'TC_SV_DONE') {
        if ((actionForm.budgetMin !== '' || actionForm.budgetMax !== '') && (actionForm.budgetMin === '' || actionForm.budgetMax === '')) {
          toast.error('Budget Min and Budget Max must both be provided when entering budget details');
          return;
        }
        if (actionForm.budgetMin !== '' && actionForm.budgetMax !== '' && Number(actionForm.budgetMax) < Number(actionForm.budgetMin)) {
          toast.error('Budget Max must be greater than or equal to Budget Min');
          return;
        }
      }
      payload.assignToUserId = actionForm.assignToUserId || payload.assignToUserId;
      if (actionForm.svDate) {
        payload.svDate = new Date(actionForm.svDate).toISOString();
      }
      payload.svProjectId = actionForm.svProjectId;
      payload.budgetMin = selectedAction.needsSvDetails && selectedAction.code !== 'TC_SV_DONE' && actionForm.budgetMin !== '' ? Number(actionForm.budgetMin) : undefined;
      payload.budgetMax = selectedAction.needsSvDetails && selectedAction.code !== 'TC_SV_DONE' && actionForm.budgetMax !== '' ? Number(actionForm.budgetMax) : undefined;
      payload.motivationType = actionForm.motivationType || undefined;
      payload.primaryRequirement = actionForm.primaryRequirement || undefined;
      payload.secondaryRequirement = actionForm.secondaryRequirement || undefined;
      payload.latitude = actionForm.latitude ? Number(actionForm.latitude) : undefined;
      payload.longitude = actionForm.longitude ? Number(actionForm.longitude) : undefined;
      payload.time_spent = actionForm.timeSpent ? Number(actionForm.timeSpent) : undefined;
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
      setActiveTab('activity');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update lead'));
    } finally {
      setActionSaving(false);
    }
  };



  const handleQuickActionPick = async (code) => {
    const action = roleActions.find((item) => item.code === code);
    if (!action) return;

    setQuickActionCode(code);

    setQuickActionForm((p) => ({
      ...actionInitialState,
      budgetMin: lead?.budgetMin ?? '',
      budgetMax: lead?.budgetMax ?? '',
      callResult: action.targetStatusCode === 'RNR' || action.code.includes('RNR') ? 'Not Answered' : 'Answered',
    }));

    setQuickStatusRemarks([]);
    setQuickRemarkAnsNonAns(null);

    await loadActionDependencies(action, setQuickAssignableUsers, setQuickClosureReasons);
    await loadStatusRemarks(action, setQuickStatusRemarks, setQuickRemarkAnsNonAns);
  };

  const handleQuickActionSubmit = async () => {
    if (!lead?.id || !quickSelectedAction) return;
    if (isSmHandoffReadOnly) {
      toast.error('This lead is view-only after handoff to Sales Head.');
      return;
    }

    if (quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') {
      const pF = customerProfileForm;
      if (!pF.date_of_birth || !pF.pan_number || !pF.aadhar_number || !pF.current_address || !pF.occupation) {
        toast.error('Please fill all mandatory (*) customer profile fields (DOB, PAN, Aadhar, Address, Occupation).');
        return;
      }
    }

    const needsInput = Boolean(
      quickSelectedAction.needsFollowUp
      || quickSelectedAction.needsAssignee
      || quickSelectedAction.needsReason
      || quickSelectedAction.needsSvDetails
      || quickSelectedAction.code === 'TC_SV_DONE'
    );

    const payload = {
      note: quickActionForm.note.trim() || undefined,
      callResult: quickActionForm.callResult,
      statusRemarkText: quickActionForm.statusRemarkText.trim() || undefined,
      statusRemarkResponseType: quickRemarkAnsNonAns || undefined,
    };

    if (quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') {
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
      };
    }

    if (quickSelectedAction.needsFollowUp) {
      if (!quickActionForm.nextFollowUpAt) {
        toast.error('Follow-up date & time is required');
        return;
      }
      payload.nextFollowUpAt = new Date(quickActionForm.nextFollowUpAt).toISOString();
    }

    if (quickSelectedAction.needsAssignee || quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') {
      if (!quickActionForm.assignToUserId) {
        toast.error(getAssigneeRoleForAction(quickSelectedAction, roleCode) === 'SH' ? 'Please select Sales Head negotiator' : 'Please select assignee');
        return;
      }
      payload.assignToUserId = quickActionForm.assignToUserId;
    }

    if (quickSelectedAction.needsReason) {
      if (!quickActionForm.closureReasonId && !quickActionForm.reason.trim()) {
        toast.error('Reason is required for this action');
        return;
      }
      // Ensure closure reason for Lost/Cold
      if (quickSelectedAction.code === 'TC_LOST' && !quickActionForm.closureReasonId) {
        toast.error('Please select a closure reason');
        return;
      }
      payload.closureReasonId = quickActionForm.closureReasonId || undefined;
      payload.reason = quickActionForm.reason.trim() || undefined;
      if (!payload.note) payload.note = payload.reason;
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
      if (quickSelectedAction.code !== 'TC_SV_DONE' && !quickActionForm.svDate) {
        toast.error('Site visit date is required');
        return;
      }
      if (!quickActionForm.svProjectId) {
        toast.error('Project visited is required');
        return;
      }
      if (quickSelectedAction.needsSvDetails && quickSelectedAction.code !== 'TC_SV_DONE') {
        if ((quickActionForm.budgetMin !== '' || quickActionForm.budgetMax !== '') && (quickActionForm.budgetMin === '' || quickActionForm.budgetMax === '')) {
          toast.error('Budget Min and Budget Max must both be provided when entering budget details');
          return;
        }
        if (quickActionForm.budgetMin !== '' && quickActionForm.budgetMax !== '' && Number(quickActionForm.budgetMax) < Number(quickActionForm.budgetMin)) {
          toast.error('Budget Max must be greater than or equal to Budget Min');
          return;
        }
      }
      payload.assignToUserId = quickActionForm.assignToUserId || payload.assignToUserId;
      if (quickActionForm.svDate) {
        payload.svDate = new Date(quickActionForm.svDate).toISOString();
      }
      payload.svProjectId = quickActionForm.svProjectId;
      payload.budgetMin = quickSelectedAction.needsSvDetails && quickSelectedAction.code !== 'TC_SV_DONE' && quickActionForm.budgetMin !== '' ? Number(quickActionForm.budgetMin) : undefined;
      payload.budgetMax = quickSelectedAction.needsSvDetails && quickSelectedAction.code !== 'TC_SV_DONE' && quickActionForm.budgetMax !== '' ? Number(quickActionForm.budgetMax) : undefined;
      payload.motivationType = quickActionForm.motivationType || undefined;
      payload.primaryRequirement = quickActionForm.primaryRequirement || undefined;
      payload.secondaryRequirement = quickActionForm.secondaryRequirement || undefined;
      payload.latitude = quickActionForm.latitude ? Number(quickActionForm.latitude) : undefined;
      payload.longitude = quickActionForm.longitude ? Number(quickActionForm.longitude) : undefined;
      payload.time_spent = quickActionForm.timeSpent ? Number(quickActionForm.timeSpent) : undefined;
    }

    if (['TC_SPAM', 'TC_JUNK'].includes(quickSelectedAction.code) && !quickActionForm.reason.trim() && !quickActionForm.note.trim()) {
      toast.error('Please enter a reason for ' + quickSelectedAction.label);
      return;
    }

    if (!needsInput && !payload.note) {
      payload.note = `Quick action: ${quickSelectedAction.label}`;
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
        await leadWorkflowApi.transitionLead(lead.id, quickSelectedAction.code, payload);
        toast.success(`${quickSelectedAction.label} completed`);
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
          <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lead-details-page">
      <header className="lead-details-header">
        <div className="lead-details-header-left">
          <button className="lead-details-back" onClick={() => navigate(-1)}>« Back</button>
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
          <button
            type="button"
            className="lead-details-quick-btn"
            disabled={isSmHandoffReadOnly}
            onClick={async () => {
              setQuickActionsOpen(true);
              try {
                const [actResp] = await Promise.all([
                  leadWorkflowApi.getLeadActivities(lead.id)
                ]);
                setQuickActionActivities(actResp.data || []);
              } catch {
                setQuickActionActivities([]);
              }
            }}
            title="Quick actions"
          >
            +
          </button>
          {roleCode !== 'TC' && (
            <span className="lead-details-stage" style={{ backgroundColor: `${lead.stageColor}22`, color: lead.stageColor }}>
              {lead.stageLabel}
            </span>
          )}
          <span className="lead-details-status" style={{ backgroundColor: `${lead.statusColor}22`, color: lead.statusColor }}>
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
          <strong>{lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : 'Not scheduled'}</strong>
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
                <div className="lead-details-info-item"><span className="lead-details-label">Full Name</span><span className="lead-details-value">{lead.fullName}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Phone</span><span className="lead-details-value">{lead.phone || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">WhatsApp</span><span className="lead-details-value">{lead.whatsappNumber || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Alternate Phone</span><span className="lead-details-value">{lead.alternatePhone || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Email</span><span className="lead-details-value">{lead.email || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Lead Number</span><span className="lead-details-value">{lead.leadNumber}</span></div>
              </div>
            )}
          </section>

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
                <div className="lead-details-info-item"><span className="lead-details-label">Source / Medium</span><span className="lead-details-value">{lead.source || '-'} / {lead.subSource || '-'}</span></div>
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
                {lead.geoLat && (
                  <div className="lead-details-info-item" style={{ gridColumn: 'span 2' }}>
                    <span className="lead-details-label">Creation Location</span>
                    <span className="lead-details-value">
                      <button className="crm-btn crm-btn-secondary" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.location?.location_name || '')}`, '_blank')} title="View Map">
                        <MapPinIcon style={{ width: 14, height: 14, marginRight: 5 }} /> View Location
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

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
                <div className="lead-details-info-item"><span className="lead-details-label">Current Assigned User</span><span className="lead-details-value">{lead.ownerRoleLabel || lead.ownerRole || '-'}</span></div>
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
                <div className="lead-details-info-item"><span className="lead-details-label">Created At</span><span className="lead-details-value">{lead.createdAt ? formatDateTime(lead.createdAt) : '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Updated At</span><span className="lead-details-value">{lead.updatedAt ? formatDateTime(lead.updatedAt) : '-'}</span></div>
              </div>
            )}
          </section>
        </div>

        <div className="lead-details-right">
          <div className="lead-details-tabs">
            <button className={`lead-details-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
            <button className={`lead-details-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>Notes</button>
            <button className={`lead-details-tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>Call Logs</button>
            <button className={`lead-details-tab ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveTab('followups')}>Followups & Status</button>
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
                            <ArrowPathIcon style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Follow up Date & Time *
                            <input
                              type="datetime-local"
                              value={actionForm.nextFollowUpAt}
                              onChange={(e) => setActionForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                            <div className="qa-remarks-wrap" style={{ marginTop: 8 }}>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0, 18, 0) }))}>Today 6PM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(1, 11, 0) }))}>Tomorrow 11AM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat 11AM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun 11AM</button>
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

                        {(selectedAction.needsSvDetails || selectedAction.code === 'TC_SV_DONE') && (
                          <div className="lead-actions-grid">
                            <label className="lead-actions-label">
                              Site Visit Date
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
                          <div className="lead-actions-grid">
                            <label className="lead-actions-label">
                              Budget Min *
                              <input
                                type="number"
                                min="0"
                                value={actionForm.budgetMin}
                                onChange={(e) => setActionForm((p) => ({ ...p, budgetMin: e.target.value }))}
                                placeholder="5000000"
                              />
                            </label>
                            <label className="lead-actions-label">
                              Budget Max *
                              <input
                                type="number"
                                min="0"
                                value={actionForm.budgetMax}
                                onChange={(e) => setActionForm((p) => ({ ...p, budgetMax: e.target.value }))}
                                placeholder="8000000"
                              />
                            </label>
                          </div>
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

                        {selectedAction.needsSvDetails && selectedAction.code !== 'TC_SV_DONE' && (
                          <div className="lead-actions-grid">
                            <label className="lead-actions-label">
                              Motivation
                              <input
                                value={actionForm.motivationType}
                                onChange={(e) => setActionForm((p) => ({ ...p, motivationType: e.target.value }))}
                                placeholder="Necessity / Comfort / Emotional"
                              />
                            </label>
                            <label className="lead-actions-label">
                              Time Spent (mins)
                              <input
                                type="number"
                                min="0"
                                value={actionForm.timeSpent}
                                onChange={(e) => setActionForm((p) => ({ ...p, timeSpent: e.target.value }))}
                                placeholder="30"
                              />
                            </label>
                            <label className="lead-actions-label">
                              Latitude
                              <input
                                value={actionForm.latitude}
                                onChange={(e) => setActionForm((p) => ({ ...p, latitude: e.target.value }))}
                                placeholder="17.3850"
                              />
                            </label>
                            <label className="lead-actions-label">
                              Longitude
                              <input
                                value={actionForm.longitude}
                                onChange={(e) => setActionForm((p) => ({ ...p, longitude: e.target.value }))}
                                placeholder="78.4867"
                              />
                            </label>
                          </div>
                        )}

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
                            disabled={actionSaving || isSmHandoffReadOnly}
                          >
                            {actionSaving ? 'Processing...' : 'Run Action'}
                          </button>
                        </div>

                        {/* Call Result Selection for Tab Action */}
                        {selectedAction && selectedAction.code !== 'TC_SV_DONE' && selectedAction.code !== 'SM_SITE_VISIT' && (
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
                {(lead.timeline || []).length === 0 ? (
                  <p className="lead-details-empty">No activity yet</p>
                ) : (
                  lead.timeline.map((evt) => (
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
                        {evt.description && <p className="lead-details-timeline-desc">{evt.description}</p>}
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
              <div className="lead-details-call-logs">
                <p className="lead-details-empty">Call logs will appear here when telephony integration is enabled.</p>
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
                      {(lead.timeline || []).filter(evt => 
                        ['STATUS_CHANGED', 'STATUS_CHANGE', 'STAGE_CHANGED', 'STAGE_CHANGE', 'FOLLOW_UP_SCHEDULED'].includes(evt.type)
                      ).length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-4 text-muted">No status or followup history yet.</td></tr>
                      ) : (
                        lead.timeline
                          .filter(evt => ['STATUS_CHANGED', 'STATUS_CHANGE', 'STAGE_CHANGED', 'STAGE_CHANGE', 'FOLLOW_UP_SCHEDULED'].includes(evt.type))
                          .sort((a, b) => new Date(b.at) - new Date(a.at))
                          .map((evt) => (
                          <tr key={evt.id}>
                            <td>
                              <div className="status-cell">
                                {(() => {
                                  const Icon = iconForTimeline(evt.type);
                                  return Icon ? <Icon style={{ width: 14, height: 14, marginRight: 6, color: 'var(--accent-blue)' }} /> : null;
                                })()}
                                <strong>{evt.title || evt.type.replace(/_/g, ' ')}</strong>
                              </div>
                            </td>
                            <td>{evt.description || '-'}</td>
                            <td>{evt.by || 'System'}</td>
                            <td>
                              {evt.metadata?.callResult ? (
                                <span className={`call-status-badge ${evt.metadata.callResult.toLowerCase()}`}>
                                  {evt.metadata.callResult}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="text-nowrap">{formatDateTime(evt.at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {roleCode !== 'TC' && activeTab === 'sitevisits' && (
              <div className="lead-details-sitevisits">
                <div className="lead-details-info-grid">
                  <div className="lead-details-info-item"><span className="lead-details-label">Total Site Visits</span><span className="lead-details-value">{lead.totalSiteVisits || 0}</span></div>
                  <div className="lead-details-info-item"><span className="lead-details-label">Last SV Done Date</span><span className="lead-details-value">{lead.svDoneDate ? formatDateTime(lead.svDoneDate) : '-'}</span></div>
                  <div className="lead-details-info-item"><span className="lead-details-label">Current Stage</span><span className="lead-details-value">{lead.stageLabel || '-'}</span></div>
                </div>
                <div className="lead-details-sitevisits-list">
                  <h4>Site Visit Records</h4>
                  {siteVisits.length === 0 ? (
                    <p className="lead-details-empty">No site visit records found.</p>
                  ) : (
                    siteVisits.map((sv) => (
                      <div key={sv.id} className="lead-details-sitevisit-item">
                        <div className="sitevisit-header">
                          <strong>{sv.project?.project_name || 'Unknown Project'}</strong>
                          <span className={`sitevisit-status ${sv.status?.toLowerCase()}`}>{sv.status}</span>
                        </div>
                        <div className="sitevisit-details">
                          <span>Scheduled: {sv.scheduled_date ? formatDateTime(sv.scheduled_date) : '-'}</span>
                          {sv.actual_visit_date && <span>Visited: {formatDateTime(sv.actual_visit_date)}</span>}
                          {sv.attendedBy && <span>Attended by: {sv.attendedBy.first_name} {sv.attendedBy.last_name}</span>}
                          {sv.feedback && <span className="sitevisit-feedback">Feedback: {sv.feedback}</span>}
                        </div>
                      </div>
                    ))
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
                  <BoltIcon style={{ width: 22, height: 22, color: '#f59e0b' }} />
                  <h2>Quick Actions</h2>
                </div>
                <small style={{ color: '#94a3b8', fontSize: '12px' }}>{lead?.fullName || lead?.full_name} · {lead?.phone}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="qa-header-comms" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="qa-header-icon-btn"
                    title="Call Now"
                    onClick={() => window.open(`tel:${lead.phone || lead.phone_number}`)}
                  >
                    <PhoneIcon style={{ width: 18, height: 18 }} />
                  </button>
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
                  <div className="qa-drawer-status-grid">
                    {roleActions.filter((a) => {
                      const isNegotiation = a.code.includes('NEGOTIATION');
                      const isHotNegotiation = a.code.includes('NEGOTIATION_HOT') || a.targetStatusCode === 'NEGOTIATION_HOT';
                      return a.tone !== 'danger' && !a.code.includes('REASSIGN') && (!isNegotiation || isHotNegotiation);
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
                          disabled={quickActionSaving || isSmHandoffReadOnly}
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
                        disabled={quickActionSaving || isSmHandoffReadOnly}
                        onClick={() => handleQuickActionPick(action.code)}
                      >
                        <div className="qa-drawer-st-icon">{action.code.includes('JUNK') ? <NoSymbolIcon style={{ width: 18, height: 18 }} /> : action.code.includes('SPAM') ? <TrashIcon style={{ width: 18, height: 18 }} /> : <ExclamationTriangleIcon style={{ width: 18, height: 18 }} />}</div>
                        <div className="qa-drawer-st-label">{action.label}</div>
                      </button>
                    ))}
                  </div>

                </>
              )}

              {/* ── Dynamic Form: Shows only after selecting a status ── */}
              {quickSelectedAction && (
                <div style={{ animation: 'qa-fade-in 0.3s ease' }}>
                  {/* ── Contextual: Follow-up Date (when action needs follow-up) ── */}
                  {quickSelectedAction?.needsFollowUp && (
                    <div className="qa-drawer-ctx-block">
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Next follow-up date</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0, 14, 0) }))}>Today 2PM</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(0, 18, 0) }))}>Today 6PM</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(1, 11, 0) }))}>Tmrw 11AM</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(2, 11, 0) }))}>In 2 days</button>
                        <button type="button" className="qa-drawer-rchip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpDate(7, 11, 0) }))}>Next week</button>
                      </div>
                      <CalendarPicker
                        type="datetime"
                        value={quickActionForm.nextFollowUpAt}
                        onChange={(val) => setQuickActionForm((p) => ({ ...p, nextFollowUpAt: val }))}
                        placeholder="Select follow-up date & time..."
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
                        {(quickAssignableUsers[getAssigneeRoleForAction(quickSelectedAction, roleCode)] || [])
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
                      <div className="qa-drawer-section" style={{ padding: '0 0 6px' }}>Visit details</div>
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
                          <label className="qa-drawer-field-label">Budget Min *</label>
                          <input
                            type="number"
                            min="0"
                            className="qa-drawer-field-input"
                            placeholder="Minimum budget"
                            value={quickActionForm.budgetMin}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, budgetMin: e.target.value }))}
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
                            value={quickActionForm.budgetMax}
                            onChange={(e) => setQuickActionForm((p) => ({ ...p, budgetMax: e.target.value }))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      {quickSelectedAction.needsSvDetails && quickSelectedAction.code !== 'TC_SV_DONE' && (
                        <>
                          <div className="qa-drawer-field-row" style={{ marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                              <label className="qa-drawer-field-label">Motivation</label>
                              <select
                                className="qa-drawer-field-select"
                                value={quickActionForm.motivationType}
                                onChange={(e) => setQuickActionForm((p) => ({ ...p, motivationType: e.target.value }))}
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
                                value={quickActionForm.timeSpent}
                                onChange={(e) => setQuickActionForm((p) => ({ ...p, timeSpent: e.target.value }))}
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
                              value={quickActionForm.primaryRequirement}
                              onChange={(e) => setQuickActionForm((p) => ({ ...p, primaryRequirement: e.target.value }))}
                              style={{ width: '100%' }}
                            />
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <label className="qa-drawer-field-label">Requirements / Remarks</label>
                            <textarea
                              className="qa-drawer-remark-ta"
                              rows={2}
                              placeholder="Specific preferences, configuration, budget notes..."
                              value={quickActionForm.secondaryRequirement}
                              onChange={(e) => setQuickActionForm((p) => ({ ...p, secondaryRequirement: e.target.value }))}
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
                                      setQuickActionForm(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
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
                                value={quickActionForm.latitude || ''}
                                onChange={(e) => setQuickActionForm(p => ({ ...p, latitude: e.target.value }))}
                              />
                              <input type="number" step="any" placeholder="Longitude" className="qa-drawer-field-input"
                                value={quickActionForm.longitude || ''}
                                onChange={(e) => setQuickActionForm(p => ({ ...p, longitude: e.target.value }))}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Contextual: Customer Profile ── */}
                  {(quickSelectedAction?.needsCustomerProfile || quickSelectedAction?.code === 'SH_BOOKING') && (
                    <div className="qa-drawer-profile-block">
                      <div className="qa-drawer-profile-section"><TrophyIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Customer Profile Details</div>

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
                  </div>
                </div>
              )}


              <div className="qa-drawer-divider" />

              {/* ── Tabbed: Lead Activity / Remark History ── */}
              <div className="qa-drawer-tabs">
                <button
                  type="button"
                  className={`qa-drawer-tab ${qaActiveTab === 'activity' ? 'qa-drawer-tab--active' : ''}`}
                  onClick={() => setQaActiveTab('activity')}
                >
                  <BoltIcon style={{ width: 15, height: 15 }} /> Lead Activity
                </button>
                <button
                  type="button"
                  className={`qa-drawer-tab ${qaActiveTab === 'history' ? 'qa-drawer-tab--active' : ''}`}
                  onClick={() => setQaActiveTab('history')}
                >
                  <TableCellsIcon style={{ width: 15, height: 15 }} /> Remark History
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
                            <span className="qa-drawer-hist-date">{formatDateTime(act.at || act.created_at)}</span>
                          </div>
                          {act.description && <div className="qa-drawer-hist-remark">{act.description}</div>}
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
                  <div style={{ padding: '0 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {siteVisits.slice(0, 4).map((sv) => (
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
                  {siteVisits.length > 4 && (
                    <div style={{ textAlign: 'center', paddingBottom: 10, fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      +{siteVisits.length - 4} more
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
                  const remarkActivities = quickActionActivities.filter(
                    (act) => act.description || act.metadata?.statusRemarkText || act.metadata?.closureReasonName
                  );
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
                                  <span className="qa-remark-status-badge">{act.title || '—'}</span>
                                </td>
                                <td>
                                  <div>{act.description || act.metadata?.statusRemarkText || '—'}</div>
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
                  || !quickSelectedAction
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
