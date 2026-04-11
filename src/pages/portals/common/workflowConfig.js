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
    { code: 'TC_RNR', label: 'RnR', tone: 'secondary', targetStageCode: 'CONTACTED', targetStatusCode: 'RNR', needsFollowUp: true },
    { code: 'TC_LEAD_QUALIFIED', label: 'Lead Qualified', tone: 'primary', targetStageCode: 'QUALIFIED', targetStatusCode: 'FOLLOW_UP', needsFollowUp: true },
    { code: 'TC_SV_SCHEDULED', label: 'SV Scheduled', tone: 'success', targetStageCode: 'QUALIFIED', targetStatusCode: 'SV_SCHEDULED', needsFollowUp: true },
    { code: 'TC_SV_DONE', label: 'SV Done', tone: 'success', targetStageCode: 'SITE_VISIT', targetStatusCode: 'SV_DONE', needsAssignee: true, assigneeRole: 'SM', needsSvDetails: true },
  ],
  SM: [
    { code: 'SM_SITE_VISIT', label: 'Record Site Visit', tone: 'primary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'SV_DONE', needsAssignee: true, assigneeRole: 'SH', needsSvDetails: true },
    { code: 'SM_SCHEDULE_REVISIT', label: 'Schedule a Revisit', tone: 'secondary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'REVISIT', needsFollowUp: true },
    { code: 'SM_FOLLOW_UP', label: 'Follow up', tone: 'secondary', targetStageCode: 'SITE_VISIT', targetStatusCode: 'FOLLOW_UP', needsFollowUp: true },
    { code: 'SM_MOVE_TO_NEGOTIATION', label: 'Move to Negotiation', tone: 'primary', targetStageCode: 'OPPORTUNITY', targetStatusCode: 'NEGOTIATION_HOT' },
    { code: 'SM_DEAL_ESCALATED', label: 'Deal Escalated', tone: 'success', targetStageCode: 'OPPORTUNITY', targetStatusCode: 'NEGOTIATION_WARM', needsAssignee: true, assigneeRole: 'SH' },
  ],
  SH: [
    { code: 'SH_FOLLOW_UP', label: 'Follow up', tone: 'secondary', targetStageCode: 'OPPORTUNITY', targetStatusCode: 'FOLLOW_UP', needsFollowUp: true },
    { code: 'SH_BOOKING', label: 'Booking (Token Received)', tone: 'success', targetStageCode: 'BOOKING', targetStatusCode: 'BOOKED', needsCustomerProfile: true },
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
  const fromConfig = actions[roleCode] || [];
  return fromConfig.length ? fromConfig : (FALLBACK_ACTIONS[roleCode] || []);
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
