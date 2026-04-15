import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import siteVisitApi from '../../../api/siteVisitApi';

import { getErrorMessage } from '../../../utils/helpers';
import { formatCurrency, formatDateTime } from '../../../utils/formatters';
import { getRoleCode } from '../../../utils/permissions';
import { getActionsForRole } from './workflowConfig';
import './LeadDetailsPage.css';

const QUICK_REMARKS = [
  'Interested', 'Shared Details', 'Callback Later', 'Busy', 
  'Not Reachable', 'RNR', 'Wrong Number', 'Follow-up Scheduled'
];

const STAGE_FLOW = ['LEAD', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'OPPORTUNITY', 'BOOKING', 'CLOSED_WON', 'CLOSED_LOST'];
const STAGE_LABELS = {
  LEAD: 'Lead',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  SITE_VISIT: 'Site Visit',
  OPPORTUNITY: 'Opportunity',
  BOOKING: 'Booking',
  CLOSED_WON: 'Won',
  CLOSED_LOST: 'Lost',
};
const iconForTimeline = (type) => {
  if (type === 'NOTE_ADDED') return '📝';
  if (type === 'STAGE_CHANGED' || type === 'STAGE_CHANGE') return '📍';
  if (type === 'STATUS_CHANGED' || type === 'STATUS_CHANGE') return '🔁';
  if (type === 'REASSIGNMENT' || type === 'ASSIGNMENT') return '👤';
  if (type === 'FOLLOW_UP_SCHEDULED') return '📅';
  if (type === 'CREATED') return '✨';
  return '•';
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

const getQuickFollowUpDate = (dayOffset, hour, minute = 0) => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const actionInitialState = {
  nextFollowUpAt: '',
  assignToUserId: '',
  closureReasonId: '',
  reason: '',
  note: '',
  svDate: '',
  svProjectId: '',
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
  const [activeTab, setActiveTab] = useState('actions');
  const [siteVisits, setSiteVisits] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [assignedUser, setAssignedUser] = useState(null);
  const [userTotalScore, setUserTotalScore] = useState(0);

  const [actionCode, setActionCode] = useState('');
  const [actionForm, setActionForm] = useState(actionInitialState);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [closureReasons, setClosureReasons] = useState([]);
  const [actionSaving, setActionSaving] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState('contact');
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickActionCode, setQuickActionCode] = useState('');
  const [quickActionForm, setQuickActionForm] = useState(actionInitialState);
  const [quickAssignableUsers, setQuickAssignableUsers] = useState([]);
  const [quickClosureReasons, setQuickClosureReasons] = useState([]);
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
  const timeline = useMemo(() => lead?.timeline || [], [lead?.timeline]);

  const followUpEvents = useMemo(
    () => timeline.filter((evt) => {
      const type = String(evt.type || '').toUpperCase();
      const title = String(evt.title || '').toUpperCase();
      return type.includes('FOLLOW') || title.includes('FOLLOW-UP') || title.includes('FOLLOW UP');
    }),
    [timeline]
  );

  const statusStageRecords = useMemo(
    () => timeline.filter((evt) => {
      const type = String(evt.type || '').toUpperCase();
      return type.includes('STATUS') || type.includes('STAGE');
    }),
    [timeline]
  );

  const { pastFollowUps, futureFollowUps } = useMemo(() => {
    const now = Date.now();
    const past = [];
    const future = [];

    followUpEvents.forEach((evt) => {
      const time = new Date(evt.at).getTime();
      if (Number.isNaN(time)) return;
      if (time < now) past.push(evt);
      else future.push(evt);
    });

    return { pastFollowUps: past, futureFollowUps: future };
  }, [followUpEvents]);

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
  }, []);

  const handleActionPick = async (code) => {
    setActionCode(code);
    const action = roleActions.find((item) => item.code === code);
    setActionForm((p) => ({
      ...actionInitialState,
      callResult: action?.code.includes('RNR') ? 'Not Answered' : 'Answered',
    }));
    setAssignableUsers([]);
    setClosureReasons([]);

    if (!code) return;

    if (!action) return;

    await loadActionDependencies(action, setAssignableUsers, setClosureReasons);
  };

  const handleRunAction = async () => {
    if (!lead?.id || !selectedAction) return;

    if (selectedAction.needsCustomerProfile || selectedAction.code === 'SH_BOOKING') {
      toast.error('This action needs full customer profile. Use workspace booking flow.');
      return;
    }

    const payload = {
      note: actionForm.note.trim() || undefined,
      callResult: actionForm.callResult,
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
      if (!actionForm.svDate) {
        toast.error('Site visit date is required');
        return;
      }
      if (!actionForm.svProjectId) {
        toast.error('Project visited is required');
        return;
      }
      payload.assignToUserId = actionForm.assignToUserId || payload.assignToUserId;
      payload.svDate = new Date(actionForm.svDate).toISOString();
      payload.svProjectId = actionForm.svProjectId;
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

  const handleQuickFollowUp = async (dateValue, label) => {
    if (!lead?.id) return;
    const targetDate = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (!targetDate || Number.isNaN(targetDate.getTime())) {
      toast.error('Please select a valid follow-up date & time');
      return;
    }

    const followUpAction = roleActions.find((item) => item.needsFollowUp);
    if (!followUpAction) {
      toast.error('No follow-up action configured for your role.');
      return;
    }

    setQuickBusy(true);
    try {
      await leadWorkflowApi.transitionLead(lead.id, followUpAction.code, {
        nextFollowUpAt: targetDate.toISOString(),
        note: `Quick follow-up scheduled: ${label}`,
      });
      toast.success(`Follow-up set for ${label}`);
      closeQuickActionsModal();
      await loadLeadData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to schedule follow-up'));
    } finally {
      setQuickBusy(false);
    }
  };

  const handleQuickActionPick = async (code) => {
    const action = roleActions.find((item) => item.code === code);
    if (!action) return;

    setQuickActionForm((p) => ({
      ...actionInitialState,
      callResult: action.code.includes('RNR') ? 'Not Answered' : 'Answered',
    }));

    await loadActionDependencies(action, setQuickAssignableUsers, setQuickClosureReasons);
  };

  const handleQuickActionSubmit = async () => {
    if (!lead?.id || !quickSelectedAction) return;

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
      if (!quickActionForm.svDate) {
        toast.error('Site visit date is required');
        return;
      }
      if (!quickActionForm.svProjectId) {
        toast.error('Project visited is required');
        return;
      }
      payload.assignToUserId = quickActionForm.assignToUserId || payload.assignToUserId;
      payload.svDate = new Date(quickActionForm.svDate).toISOString();
      payload.svProjectId = quickActionForm.svProjectId;
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
          <button
            type="button"
            className="lead-details-quick-btn"
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
          <span className="lead-details-stage" style={{ backgroundColor: `${lead.stageColor}22`, color: lead.stageColor }}>
            {lead.stageLabel}
          </span>
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

      <div className="lead-details-pipeline">
        <div className="pipeline-stages">
          {STAGE_FLOW.map((stageCode, idx) => {
            const currentIndex = STAGE_FLOW.indexOf(lead.stageCode);
            const isActive = currentIndex === idx;
            const isPast = currentIndex > idx;
            const isTerminal = ['CLOSED_WON', 'CLOSED_LOST'].includes(stageCode);

            return (
              <div key={stageCode} className={`pipeline-stage ${isActive ? 'active' : ''} ${isPast ? 'completed' : ''} ${isTerminal ? 'terminal' : ''}`}>
                <div className="pipeline-dot" />
                {idx < STAGE_FLOW.length - 1 && <div className="pipeline-line" />}
                <div className="pipeline-label">{STAGE_LABELS[stageCode]}</div>
              </div>
            );
          })}
        </div>
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
                      <a
                        href={`https://www.google.com/maps?q=${lead.geoLat},${lead.geoLong}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        📍 View Location on Map
                      </a>
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="lead-details-card">
            <button type="button" className="lead-accordion-head" onClick={() => setAccordionOpen((prev) => (prev === 'assignment' ? '' : 'assignment'))}>
              <span className="lead-details-card-title">Assignment & Ownership</span>
              <span className="lead-accordion-icon">{accordionOpen === 'assignment' ? '−' : '+'}</span>
            </button>
            {accordionOpen === 'assignment' && (
              <div className="lead-details-info-grid">
                <div className="lead-details-info-item"><span className="lead-details-label">Assigned To</span><span className="lead-details-value lead-details-value--primary">{lead.assignedToUserName || 'Unassigned'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Assigned By</span><span className="lead-details-value">{lead.assignedByUserName || '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Assigned At</span><span className="lead-details-value">{lead.assignedAt ? formatDateTime(lead.assignedAt) : '-'}</span></div>
                <div className="lead-details-info-item"><span className="lead-details-label">Stage Owner</span><span className="lead-details-value">{lead.ownerRoleLabel || lead.ownerRole || '-'}</span></div>
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
            <button className={`lead-details-tab ${activeTab === 'actions' ? 'active' : ''}`} onClick={() => setActiveTab('actions')}>Actions</button>
            <button className={`lead-details-tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
            <button className={`lead-details-tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>Comments</button>
            <button className={`lead-details-tab ${activeTab === 'calls' ? 'active' : ''}`} onClick={() => setActiveTab('calls')}>Call Logs</button>
            <button className={`lead-details-tab ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveTab('followups')}>Followups & Status</button>
            <button className={`lead-details-tab ${activeTab === 'sitevisits' ? 'active' : ''}`} onClick={() => setActiveTab('sitevisits')}>Site Visits</button>
            <button className={`lead-details-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>Documents</button>
          </div>

          <div className="lead-details-tab-content">
            {activeTab === 'actions' && (
              <div className="lead-actions-panel">
                {roleActions.length === 0 ? (
                  <p className="lead-details-empty">No workflow actions configured for your role.</p>
                ) : (
                  <>
                    <label className="lead-actions-label">
                      Select Action
                      <select value={actionCode} onChange={(e) => handleActionPick(e.target.value)}>
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
                            Follow-Up Date & Time *
                            <input
                              type="datetime-local"
                              value={actionForm.nextFollowUpAt}
                              onChange={(e) => setActionForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                            <div className="qa-remarks-wrap" style={{ marginTop: 8 }}>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today 6PM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tomorrow 11AM</button>
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
                            disabled={actionSaving}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            className="lead-details-action-btn lead-details-action-btn--primary"
                            onClick={handleRunAction}
                            disabled={actionSaving}
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
                                disabled={selectedAction.code.includes('RNR')}
                              >
                                Answered
                              </button>
                              <button
                                type="button"
                                className={`call-result-btn ${actionForm.callResult === 'Not Answered' ? 'active' : ''}`}
                                onClick={() => setActionForm(p => ({ ...p, callResult: 'Not Answered' }))}
                                disabled={selectedAction.code.includes('RNR')}
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
                      <div className="lead-details-timeline-icon">{iconForTimeline(evt.type)}</div>
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
                  <textarea placeholder="Add a comment..." value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                  <button onClick={handleAddNote} disabled={!noteDraft.trim()}>Post Comment</button>
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
              <div className="lead-followups-tab">
                <div className="lead-followups-grid">
                  <div className="lead-followups-card">
                    <h4>Next Follow-Up</h4>
                    <p>{lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : 'Not scheduled'}</p>
                  </div>
                  <div className="lead-followups-card">
                    <h4>Follow-Up Status</h4>
                    <p>
                      {!lead.nextFollowUpAt
                        ? 'Not set'
                        : new Date(lead.nextFollowUpAt).getTime() < Date.now()
                          ? 'Overdue'
                          : 'Upcoming'}
                    </p>
                  </div>
                </div>

                <div className="lead-followups-records">
                  <div className="lead-followups-block">
                    <h5>Future Follow-Ups</h5>
                    {futureFollowUps.length === 0 ? (
                      <p className="lead-details-empty">No future follow-up record yet.</p>
                    ) : (
                      futureFollowUps.map((evt) => (
                        <div key={evt.id} className="lead-followups-item">
                          <strong>{evt.title || 'Follow-Up Scheduled'}</strong>
                          <span>{formatDateTime(evt.at)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="lead-followups-block">
                    <h5>Past Follow-Ups</h5>
                    {pastFollowUps.length === 0 ? (
                      <p className="lead-details-empty">No past follow-up record yet.</p>
                    ) : (
                      pastFollowUps.map((evt) => (
                        <div key={evt.id} className="lead-followups-item">
                          <strong>{evt.title || 'Follow-Up Completed'}</strong>
                          <span>{formatDateTime(evt.at)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="lead-followups-block">
                    <h5>Status & Stage Records</h5>
                    {statusStageRecords.length === 0 ? (
                      <p className="lead-details-empty">No status/stage record yet.</p>
                    ) : (
                      statusStageRecords.map((evt) => (
                        <div key={evt.id} className="lead-followups-item">
                          <strong>{evt.title || evt.type.replace(/_/g, ' ')}</strong>
                          <span>{formatDateTime(evt.at)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sitevisits' && (
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

            {activeTab === 'documents' && (
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
                <h2>⚡ Quick Actions</h2>
                <small style={{ color: '#94a3b8', fontSize: '12px' }}>{lead?.fullName || lead?.full_name} · {lead?.phone}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="qa-header-comms" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="qa-header-icon-btn"
                    title="Call Now"
                    onClick={() => window.open(`tel:${lead.phone || lead.phone_number}`)}
                  >
                    📞
                  </button>
                  <button 
                    className="qa-header-icon-btn"
                    title="WhatsApp"
                    onClick={() => window.open(`https://wa.me/${(lead.whatsappNumber || lead.phone || '').replace(/\D/g, '')}`, '_blank')}
                  >
                    💬
                  </button>
                </div>
                <button className="qa-header-close" onClick={closeQuickActionsModal}>×</button>
              </div>
            </div>

            <div className="qa-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 300px', gap: '24px' }}>
                {/* Left Column: Actions and Forms */}
                <div>
                  {/* Workflow Transitions */}
                  <div className="qa-section">
                    <div className="qa-section-title">🚀 Workflow Transitions</div>
                    <div className="qa-action-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                      {roleActions.filter(a => a.tone !== 'danger').map((action) => {
                        let icon = '📋';
                        if (action.code.includes('RNR')) icon = '🔄';
                        else if (action.code.includes('SV_DONE') || action.code.includes('SITE_VISIT')) icon = '✅';
                        else if (action.code.includes('SCHEDULE') || action.code.includes('REVISIT')) icon = '📅';
                        else if (action.code.includes('FOLLOW_UP')) icon = '📞';
                        else if (action.code.includes('NEGOTIATION')) icon = '🤝';
                        else if (action.code.includes('BOOKING')) icon = '🎉';
                        else if (action.code.includes('PAYMENT')) icon = '💸';
                        else if (action.code.includes('REASSIGN')) icon = '👤';

                        return (
                          <button
                            key={action.code}
                            type="button"
                            className={`qa-btn-card ${quickActionCode === action.code ? 'active' : ''}`}
                            disabled={quickBusy || quickActionSaving}
                            onClick={() => handleQuickActionPick(action.code)}
                          >
                            <span className="icon">{icon}</span>
                            <span className="label">{action.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Disqualification */}
                  <div className="qa-section">
                    <div className="qa-section-title" style={{ color: '#dc2626' }}>⚠️ Disqualification</div>
                    <div className="qa-disqual-row">
                      {roleActions.filter(a => a.tone === 'danger').map((action) => (
                        <button
                          key={action.code}
                          type="button"
                          className={`qa-btn-disqual ${quickActionCode === action.code ? 'active' : ''}`}
                          disabled={quickBusy || quickActionSaving}
                          onClick={() => handleQuickActionPick(action.code)}
                        >
                          {action.code.includes('JUNK') ? '🗑️' : action.code.includes('SPAM') ? '🚫' : '💔'} {action.label}
                        </button>
                      ))}
                      {roleActions.filter(a => a.tone === 'danger').length === 0 && (
                        <div style={{ padding: '8px', gridColumn: '1 / -1', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No disqualification actions available for your role.</div>
                      )}
                    </div>
                  </div>

                  {/* Dynamic Action Form */}
                  {quickSelectedAction && (
                    <div className="qa-section" style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-primary)', marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ width: '4px', height: '16px', background: 'var(--accent-blue)', borderRadius: '2px' }} />
                        <span style={{ fontSize: '13px', fontWeight: '800' }}>Configure: {quickSelectedAction.label}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {quickSelectedAction.needsFollowUp && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Next Follow-up *</label>
                            <input
                              type="datetime-local"
                              value={quickActionForm.nextFollowUpAt}
                              onChange={(e) => setQuickActionForm((p) => ({ ...p, nextFollowUpAt: e.target.value }))}
                              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                            <div className="qa-remarks-wrap" style={{ marginTop: 8 }}>
                              <button type="button" className="qa-remark-chip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(0, 18, 0) }))}>Today 6PM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpValue(1, 11, 0) }))}>Tomorrow 11AM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(6, 11, 0) }))}>This Sat 11AM</button>
                              <button type="button" className="qa-remark-chip" onClick={() => setQuickActionForm(p => ({ ...p, nextFollowUpAt: getQuickFollowUpForWeekday(0, 11, 0) }))}>This Sun 11AM</button>
                            </div>
                          </div>
                        )}

                        {(quickSelectedAction.needsAssignee || quickSelectedAction.needsSvDetails || quickSelectedAction.code === 'TC_SV_DONE' || quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>
                              {getAssigneeRoleForAction(quickSelectedAction, roleCode) === 'SH' ? 'Assign To Sales Head *' : 
                               (quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') ? 'Assign To Collection Manager *' : 'Assign To *'}
                            </label>
                            <select
                              value={quickActionForm.assignToUserId}
                              onChange={(e) => setQuickActionForm((p) => ({ ...p, assignToUserId: e.target.value }))}
                              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            >
                              <option value="">Select user...</option>
                              {quickAssignableUsers.map((item) => (
                                <option key={item.id} value={item.id}>{item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim()}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {(quickSelectedAction.needsSvDetails || quickSelectedAction.code === 'TC_SV_DONE') && (
                          <>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Visit Date *</label>
                              <input
                                type="date"
                                value={quickActionForm.svDate}
                                onChange={(e) => setQuickActionForm((p) => ({ ...p, svDate: e.target.value }))}
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Project *</label>
                              <select
                                value={quickActionForm.svProjectId}
                                onChange={(e) => setQuickActionForm((p) => ({ ...p, svProjectId: e.target.value }))}
                                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                              >
                                {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                              </select>
                            </div>
                          </>
                        )}

                        {(quickSelectedAction.needsCustomerProfile || quickSelectedAction.code === 'SH_BOOKING') && (
                          <div style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 Customer Profile Details</div>
                            
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6 }}>👤 Personal Details</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Date of Birth *
                                <input type="date" value={customerProfileForm.date_of_birth} onChange={(e) => setCustomerProfileForm(p => ({ ...p, date_of_birth: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Marital Status
                                <select value={customerProfileForm.marital_status} onChange={(e) => setCustomerProfileForm(p => ({ ...p, marital_status: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                  <option value="">Select...</option>
                                  <option value="Single">Single</option>
                                  <option value="Married">Married</option>
                                  <option value="Divorced">Divorced</option>
                                  <option value="Widowed">Widowed</option>
                                </select>
                              </label>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Purchase Type
                                <select value={customerProfileForm.purchase_type} onChange={(e) => setCustomerProfileForm(p => ({ ...p, purchase_type: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                                  <option value="">Select...</option>
                                  <option value="Investment">Investment</option>
                                  <option value="Self Use">Self Use</option>
                                  <option value="Rental">Rental</option>
                                  <option value="Gift">Gift</option>
                                </select>
                              </label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Occupation *
                                <input type="text" value={customerProfileForm.occupation} onChange={(e) => setCustomerProfileForm(p => ({ ...p, occupation: e.target.value }))} placeholder="e.g. Business, Salaried" style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Current Post
                                <input type="text" value={customerProfileForm.current_post} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_post: e.target.value }))} placeholder="e.g. Manager" style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                            </div>

                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6 }}>🪪 Identity Documents</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                PAN Number *
                                <input type="text" maxLength={10} value={customerProfileForm.pan_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, pan_number: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', textTransform: 'uppercase', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                Aadhar Number *
                                <input type="text" maxLength={12} value={customerProfileForm.aadhar_number} onChange={(e) => setCustomerProfileForm(p => ({ ...p, aadhar_number: e.target.value.replace(/\D/g, '') }))} placeholder="1234 5678 9012" style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                            </div>

                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6 }}>📍 Current Address *</div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Address
                              <textarea rows={2} value={customerProfileForm.current_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_address: e.target.value }))} placeholder="Street address..." style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>City
                                <input type="text" value={customerProfileForm.current_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_city: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>State
                                <input type="text" value={customerProfileForm.current_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_state: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Pincode
                                <input type="text" maxLength={6} value={customerProfileForm.current_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, current_pincode: e.target.value.replace(/\D/g, '') }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                              </label>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-primary)', paddingBottom: 6, flex: 1 }}>🏠 Permanent Address</div>
                              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 12 }}>
                                <input type="checkbox" checked={customerProfileForm.sameAsCurrent} onChange={(e) => setCustomerProfileForm(p => ({ ...p, sameAsCurrent: e.target.checked }))} /> Same as Current
                              </label>
                            </div>
                            
                            {!customerProfileForm.sameAsCurrent && (
                              <>
                                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  Address
                                  <textarea rows={2} value={customerProfileForm.permanent_address} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_address: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>City
                                    <input type="text" value={customerProfileForm.permanent_city} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_city: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                                  </label>
                                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>State
                                    <input type="text" value={customerProfileForm.permanent_state} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_state: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                                  </label>
                                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Pincode
                                    <input type="text" maxLength={6} value={customerProfileForm.permanent_pincode} onChange={(e) => setCustomerProfileForm(p => ({ ...p, permanent_pincode: e.target.value.replace(/\D/g, '') }))} style={{ width: '100%', marginTop: 4, padding: '8px', border: '1px solid var(--border-primary)', borderRadius: '8px', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        
                        {quickSelectedAction.needsReason && (
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase' }}>Closure Reason *</label>
                            <select
                              value={quickActionForm.closureReasonId}
                              onChange={(e) => setQuickActionForm((p) => ({ ...p, closureReasonId: e.target.value }))}
                              style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            >
                              <option value="">Select reason...</option>
                              {quickClosureReasons.map(r => <option key={r.id} value={r.id}>{r.reason || r.reason_text}</option>)}
                            </select>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Remarks</label>
                          <div className="qa-remarks-wrap" style={{ margin: 0 }}>
                            {QUICK_REMARKS.slice(0, 3).map(chip => (
                              <button key={chip} type="button" className="qa-remark-chip" onClick={() => setQuickActionForm(p => ({ ...p, note: p.note ? `${p.note}, ${chip}` : chip }))}>+ {chip}</button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={quickActionForm.note}
                          onChange={(e) => setQuickActionForm(p => ({ ...p, note: e.target.value }))}
                          style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Call Result Toggle */}
                      {quickSelectedAction.code !== 'TC_SV_DONE' && quickSelectedAction.code !== 'SM_SITE_VISIT' && (
                        <div className="call-result-wrap" style={{ marginTop: '16px' }}>
                          <div className="call-result-label">Call Result</div>
                          <div className="call-result-toggle">
                            <button
                              type="button"
                              className={`call-result-btn ${quickActionForm.callResult === 'Answered' ? 'active' : ''}`}
                              onClick={() => setQuickActionForm(p => ({ ...p, callResult: 'Answered' }))}
                              disabled={quickSelectedAction.code.includes('RNR')}
                            >
                              Answered
                            </button>
                            <button
                              type="button"
                              className={`call-result-btn ${quickActionForm.callResult === 'Not Answered' ? 'active' : ''}`}
                              onClick={() => setQuickActionForm(p => ({ ...p, callResult: 'Not Answered' }))}
                              disabled={quickSelectedAction.code.includes('RNR')}
                            >
                              Not Answered
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button
                          className="lead-details-action-btn lead-details-action-btn--primary"
                          style={{ flex: 1, padding: '12px', borderRadius: '10px', fontWeight: '800' }}
                          onClick={handleQuickActionSubmit}
                          disabled={quickActionSaving}
                        >
                          {quickActionSaving ? 'Saving...' : 'Submit Followup'}
                        </button>
                        <button
                          className="lead-details-action-btn lead-details-action-btn--secondary"
                          style={{ padding: '12px 20px', borderRadius: '10px' }}
                          onClick={() => { setQuickActionCode(''); setQuickActionForm(actionInitialState); }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Follow-ups & History */}
                <div style={{ borderLeft: '1px solid var(--border-primary)', paddingLeft: '24px' }}>
                  <div className="qa-section">
                    <div className="qa-section-title">📅 Quick Follow-up</div>
                    <div className="qa-remarks-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                      <button type="button" className="qa-remark-chip" onClick={() => handleQuickFollowUp(getQuickFollowUpDate(0, 14, 0), 'Today 2PM')}>Today 2PM</button>
                      <button type="button" className="qa-remark-chip" onClick={() => handleQuickFollowUp(getQuickFollowUpDate(0, 18, 0), 'Today 6PM')}>Today 6PM</button>
                      <button type="button" className="qa-remark-chip" onClick={() => handleQuickFollowUp(getQuickFollowUpDate(1, 11, 0), 'Tomorrow 11AM')}>Tomorrow 11AM</button>
                      <button type="button" className="qa-remark-chip" onClick={() => handleQuickFollowUp(getQuickFollowUpForWeekday(6, 11, 0), 'This Sat 11AM')}>This Sat 11AM</button>
                      <button type="button" className="qa-remark-chip" onClick={() => handleQuickFollowUp(getQuickFollowUpForWeekday(0, 11, 0), 'This Sun 11AM')}>This Sun 11AM</button>
                    </div>
                  </div>



                  <div className="qa-section" style={{ marginTop: '24px' }}>
                    <div className="qa-section-title">📝 Lead Activity</div>
                    <div className="qa-timeline">
                      {quickActionActivities.slice(0, 5).map((act) => (
                        <div key={act.id} className="qa-timeline-item" style={{ gap: '12px' }}>
                          <div className="qa-timeline-dot">
                            {act.type === 'NOTE_ADDED' ? '📝' : '🔄'}
                          </div>
                          <div className="qa-timeline-content">
                            <div className="qa-timeline-header">
                              <span className="qa-timeline-title">{act.title}</span>
                            </div>
                            <span className="qa-timeline-time">{formatDateTime(act.at || act.created_at)}</span>
                          </div>
                        </div>
                      ))}
                      {quickActionActivities.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No recent activity</span>}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default LeadDetailsPage;
