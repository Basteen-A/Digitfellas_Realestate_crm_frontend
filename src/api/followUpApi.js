import api from './axiosInstance';

const followUpApi = {
  getAll: (params = {}) => api.get('/follow-ups', { params }),
  getTodays: () => api.get('/follow-ups/today'),
  getOverdue: () => api.get('/follow-ups/overdue'),
  create: (data) => api.post('/follow-ups', data),
  complete: (id, data) => api.patch(`/follow-ups/${id}/complete`, data),
  remove: (id) => api.delete(`/follow-ups/${id}`),
};

export default followUpApi;
