import api from './axiosInstance';

const projectPhaseApi = {
  list: (params = {}) => api.get('/project-phases', { params }),
  dropdown: (projectId) => api.get('/project-phases/dropdown', { params: projectId ? { project_id: projectId } : {} }),
  getById: (id) => api.get(`/project-phases/${id}`),
  create: (payload) => api.post('/project-phases', payload),
  update: (id, payload) => api.patch(`/project-phases/${id}`, payload),
  remove: (id) => api.delete(`/project-phases/${id}`),
};

export default projectPhaseApi;
