// ============================================================
// WORKSPACE ROLE CONFIG — Dynamic from API
// ============================================================

export const ROLE_LABELS = {
  SA: 'Super Admin',
  ADM: 'Admin',
  SH: 'Sales Head',
  SM: 'Sales Manager',
  TC: 'Telecaller',
  COL: 'Collection Manager',
  CRM: 'CRM Executive',
};

export const WORKSPACE_TITLES = {
  TC: { title: 'Telecaller Workspace', subtitle: 'Contact calling, follow-ups, and site-visit scheduling' },
  SM: { title: 'Sales Manager Workspace', subtitle: 'Site visits, team lead management, and negotiation handoff' },
  SH: { title: 'Sales Head Workspace', subtitle: 'Negotiation governance, deal approvals, and booking control' },
  COL: { title: 'Collection Workspace', subtitle: 'Payment milestones, booking status, and post-booking closure' },
};

export const getWorkspaceTitle = (roleCode) => WORKSPACE_TITLES[roleCode] || WORKSPACE_TITLES.TC;

/**
 * Build stage options from the workflow config API response
 */
export const buildStageOptions = (stages = [], roleCode = null) => {
  const ordered = [...stages].sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));
  if (!roleCode) {
    return ordered.map((s) => ({ value: s.stage_code, label: s.stage_name }));
  }

  // Filter stages for this role
  const roleStages = ordered.filter((s) => s.ownerRole === roleCode || s.is_terminal);
  return roleStages.map((s) => ({ value: s.stage_code, label: s.stage_name }));
};

/**
 * Build status options from the workflow config API response
 */
export const buildStatusOptions = (statuses = []) =>
  [...statuses]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((s) => ({
      value: s.status_code,
      label: s.status_name,
      category: s.status_category || 'ACTIVE',
      isTerminal: Boolean(s.is_terminal),
    }));

const FALLBACK_ACTIONS = {
  TC: [
    { code: 'TC_LEAD_QUALIFIED', label: 'Follow Up', tone: 'primary', targetStageCode: 'QUALIFIED', targetStatusCode: 'FOLLOW_UP', needsFollowUp: true },
    { code: 'TC_SV_SCHEDULED', label: 'SV Scheduled', tone: 'success', targetStageCode: 'QUALIFIED', targetStatusCode: 'SV_SCHEDULED', needsFollowUp: true },
    { code: 'TC_SV_DONE', label: 'SV Done', tone: 'success', targetStageCode: 'SITE_VISIT', targetStatusCode: 'SV_DONE', needsAssignee: true, assigneeRole: 'SM', needsSvDetails: true },
    { code: 'TC_REASSIGN', label: 'Reassign', tone: 'secondary', needsAssignee: true, assigneeRole: 'TC' },
    { code: 'TC_RNR', label: 'RnR', tone: 'secondary', targetStageCode: 'CONTACTED', targetStatusCode: 'RNR', needsFollowUp: true },
    { code: 'TC_SPAM', label: 'Mark as Spam', tone: 'danger', targetStatusCode: 'CLOSED_LOST', needsReason: true, reasonCategory: 'SPAM', needsFollowUp: false },
    { code: 'TC_JUNK', label: 'Junk', tone: 'danger', targetStatusCode: 'CLOSED_LOST', needsReason: true, reasonCategory: 'JUNK', needsFollowUp: false },
    { code: 'TC_LOST', label: 'Lost/Cold', tone: 'danger', targetStageCode: 'CLOSED_LOST', targetStatusCode: 'CLOSED_LOST', needsReason: true, reasonCategory: 'LOST', needsFollowUp: false },
  ],
  SM: [
    { code: 'SM_SITE_VISIT', label: 'Record Site Visit', tone: 'primary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'SV_DONE', needsSvDetails: true },
    { code: 'SM_SCHEDULE_REVISIT', label: 'Schedule a Revisit', tone: 'secondary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'REVISIT', needsFollowUp: true },
    { code: 'SM_FOLLOW_UP', label: 'Follow up', tone: 'secondary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'FOLLOW_UP', needsFollowUp: true },
    { code: 'SM_NEGOTIATION_HOT', label: 'Move to Negotiation (Hot)', tone: 'primary', targetStageCode: 'OPPORTUNITY', targetStatusCode: 'NEGOTIATION_HOT', needsAssignee: true, assigneeRole: 'SH' },
    { code: 'SM_NEGOTIATION_WARM', label: 'Move to Negotiation (Warm)', tone: 'success', targetStageCode: 'OPPORTUNITY', targetStatusCode: 'NEGOTIATION_WARM', needsAssignee: true, assigneeRole: 'SH' },
    { code: 'SM_NEGOTIATION_COLD', label: 'Negotiation Cold', tone: 'secondary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'NEGOTIATION_COLD' },
  ],
  SH: [
    { code: 'SH_FOLLOW_UP', label: 'Follow up', tone: 'secondary', targetStageCode: 'OPPORTUNITY', targetStatusCode: 'FOLLOW_UP', needsFollowUp: true },
    { code: 'SH_BOOKING', label: 'Booking (Token Received)', tone: 'success', targetStageCode: 'BOOKING', targetStatusCode: 'BOOKED', needsCustomerProfile: true, needsAssignee: true, assigneeRole: 'COL' },
  ],
  COL: [
    { code: 'COL_PAYMENT_UPDATE', label: 'Update Payment Milestone', tone: 'secondary', targetStatusCode: 'BOOKED' },
    { code: 'COL_BOOKING_STATUS_UPDATE', label: 'Update Booking Status', tone: 'primary', targetStatusCode: 'BOOKED' },
  ],
};

/**
 * Get role-specific actions from the workflow config
 */
export const getActionsForRole = (actions = {}, roleCode) => {
  const fromConfig = (actions[roleCode] || []).map((a) => {
    if (['TC_LEAD_QUALIFIED', 'TC_SV_SCHEDULED', 'TC_RNR', 'SM_FOLLOW_UP', 'SM_SCHEDULE_REVISIT', 'SH_FOLLOW_UP'].includes(a.code)) {
      return { ...a, needsFollowUp: true };
    }

    if (a.code === 'TC_SV_DONE') {
      return { ...a, needsAssignee: true, assigneeRole: 'SM', needsSvDetails: true };
    }

    if (['TC_SPAM', 'TC_JUNK'].includes(a.code)) {
      return { ...a, needsReason: true, reasonCategory: a.code === 'TC_SPAM' ? 'SPAM' : 'JUNK', needsFollowUp: false };
    }

    if (a.code === 'TC_LOST') {
      return { ...a, needsReason: true, reasonCategory: 'LOST', needsFollowUp: false };
    }

    if (a.code === 'SH_BOOKING') {
      return { ...a, needsCustomerProfile: true, needsAssignee: true, assigneeRole: 'COL' };
    }

    return a;
  });
  
  const fallbacks = FALLBACK_ACTIONS[roleCode] || [];

  if (fromConfig.length) {
    // Merge mandatory actions from fallback if they are missing from config
    const mandatoryCodes = ['TC_REASSIGN'];
    const existingCodes = new Set(fromConfig.map(a => a.code));
    const missingMandatory = fallbacks.filter(a => mandatoryCodes.includes(a.code) && !existingCodes.has(a.code));
    
    return [...fromConfig, ...missingMandatory];
  }

  return fallbacks;
};

/**
 * Action button tone → CSS class
 */
export const ACTION_TONE_CLASS = {
  primary: 'action-btn--primary',
  secondary: 'action-btn--secondary',
  success: 'action-btn--success',
  danger: 'action-btn--danger',
};
