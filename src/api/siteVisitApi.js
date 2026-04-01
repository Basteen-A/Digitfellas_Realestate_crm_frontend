import api from './axiosInstance';

const siteVisitApi = {
  getAll: (params = {}) => api.get('/site-visits', { params }),
  getUpcoming: () => api.get('/site-visits/upcoming'),
  getById: (id) => api.get(`/site-visits/${id}`),
  create: (data) => api.post('/site-visits', data),
  complete: (id, data) => api.patch(`/site-visits/${id}/complete`, data),
  cancel: (id, data) => api.patch(`/site-visits/${id}/cancel`, data),
  remove: (id) => api.delete(`/site-visits/${id}`),
};

export default siteVisitApi;
