import api from './axiosInstance';

// Project-level document archive (Super Admin / Admin).
const projectDocumentApi = {
  list: (projectId) => api.get(`/projects/${projectId}/documents`),
  upload: (projectId, formData) => api.post(`/projects/${projectId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (projectId, docId) => api.delete(`/projects/${projectId}/documents/${docId}`),
};

export default projectDocumentApi;
