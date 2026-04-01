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
  if (!roleCode) {
    return stages.map((s) => ({ value: s.stage_code, label: s.stage_name }));
  }

  // Filter stages for this role
  const roleStages = stages.filter((s) => s.ownerRole === roleCode || s.is_terminal);
  return roleStages.map((s) => ({ value: s.stage_code, label: s.stage_name }));
};

/**
 * Build status options from the workflow config API response
 */
export const buildStatusOptions = (statuses = []) =>
  statuses.map((s) => ({ value: s.status_code, label: s.status_name }));

/**
 * Get role-specific actions from the workflow config
 */
export const getActionsForRole = (actions = {}, roleCode) => actions[roleCode] || [];

/**
 * Action button tone → CSS class
 */
export const ACTION_TONE_CLASS = {
  primary: 'action-btn--primary',
  secondary: 'action-btn--secondary',
  success: 'action-btn--success',
  danger: 'action-btn--danger',
};
