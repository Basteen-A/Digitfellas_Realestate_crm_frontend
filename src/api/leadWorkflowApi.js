import api from './axiosInstance';

// ── Pure API calls — no hardcoded maps, no localStorage ──

const leadWorkflowApi = {
  /**
   * GET /leads/workflow-config
   * Fetches stages, statuses, actions from DB
   */
  getWorkflowConfig: async () => {
    const { data } = await api.get('/leads/workflow-config');
    return data;
  },

  /**
   * GET /leads/assignable-users?role=SM
   * Fetches users of a specific role for assignment dropdowns
   */
  getAssignableUsers: async (roleCode) => {
    const { data } = await api.get('/leads/assignable-users', { params: { role: roleCode } });
    return data;
  },

  /**
   * GET /leads
   */
  getLeads: async (params = {}) => {
    const { data } = await api.get('/leads', { params });
    return data;
  },

  /**
   * GET /leads/handoffs
   */
  getHandoffs: async (params = {}) => {
    const { data } = await api.get('/leads/handoffs', { params });
    return data;
  },

  /**
   * GET /leads/:id
   */
  getLeadById: async (leadId) => {
    const { data } = await api.get(`/leads/${leadId}`);
    return data;
  },

  /**
   * POST /leads
   */
  createLead: async (payload) => {
    const { data } = await api.post('/leads', payload);
    return data;
  },

  /**
   * PATCH /leads/:id/assign
   */
  assignLead: async (leadId, assignToUserId, note) => {
    const { data } = await api.patch(`/leads/${leadId}/assign`, { assignToUserId, note });
    return data;
  },

  /**
   * PATCH /leads/:id/transition
   */
  transitionLead: async (leadId, actionCode, payload = {}) => {
    const { data } = await api.patch(`/leads/${leadId}/transition`, { actionCode, ...payload });
    return data;
  },

  /**
   * PATCH /leads/:id/status
   */
  updateLeadStatus: async (leadId, statusCode, payload = {}) => {
    const { data } = await api.patch(`/leads/${leadId}/status`, { statusCode, ...payload });
    return data;
  },

  /**
   * POST /leads/:id/notes
   */
  addNote: async (leadId, note) => {
    const { data } = await api.post(`/leads/${leadId}/notes`, { note });
    return data;
  },

  /**
   * GET /closed-lost-reasons?category=COLD
   * Fetches closure reasons filtered by category
   */
  getClosureReasons: async (category) => {
    const { data } = await api.get('/closed-lost-reasons', { params: { search: '', category } });
    return data;
  },

  // ── Pull Request System ──

  searchLeadByPhone: async (phone) => {
    const { data } = await api.get('/leads/search-by-phone', { params: { phone } });
    return data;
  },

  createPullRequest: async (leadId, note) => {
    const { data } = await api.post('/leads/pull-request', { leadId, note });
    return data;
  },

  respondToPullRequest: async (pullRequestId, status, responseNote) => {
    const { data } = await api.patch(`/leads/pull-request/${pullRequestId}/respond`, { status, responseNote });
    return data;
  },

  getPullRequests: async (type = 'incoming', status = null) => {
    const params = { type };
    if (status) params.status = status;
    const { data } = await api.get('/leads/pull-requests', { params });
    return data;
  },

  // ── SH Team Management ──

  getMySMTeam: async () => {
    const { data } = await api.get('/leads/my-sm-team');
    return data;
  },

  getLeadsBySM: async (smId, params = {}) => {
    const { data } = await api.get(`/leads/by-sm/${smId}`, { params });
    return data;
  },

  reassignLeadToSM: async (leadId, newSMId, note) => {
    const { data } = await api.patch(`/leads/${leadId}/reassign-sm`, { newSMId, note });
    return data;
  },
};

export default leadWorkflowApi;
