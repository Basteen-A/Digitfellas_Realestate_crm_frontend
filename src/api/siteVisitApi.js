import api from './axiosInstance';

const siteVisitApi = {
  getAll: (params = {}) => api.get('/site-visits', { params }),
  getUpcoming: () => api.get('/site-visits/upcoming'),
  getById: (id) => api.get(`/site-visits/${id}`),
  create: (data) => api.post('/site-visits', data),
  complete: (id, data) => api.patch(`/site-visits/${id}/complete`, data),
  cancel: (id, data) => api.patch(`/site-visits/${id}/cancel`, data),
  remove: (id) => api.delete(`/site-visits/${id}`),

  // SM's own lead visits
  getMyLeadVisits: (params = {}) => api.get('/site-visits/my-lead-visits', { params }),

  // SH oversight: get visits for a specific SM's leads
  getBySM: (smId, params = {}) => api.get(`/site-visits/by-sm/${smId}`, { params }),
};

export default siteVisitApi;
