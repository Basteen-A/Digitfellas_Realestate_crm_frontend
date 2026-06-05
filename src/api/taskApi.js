import api from './axiosInstance';

const basePath = '/tasks';

const taskApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get(basePath, { params: { ...params, _t: Date.now() } });
    return data;
  },
  getStats: async () => {
    const { data } = await api.get(`${basePath}/stats`, { params: { _t: Date.now() } });
    return data;
  },
  getAssignableUsers: async () => {
    const { data } = await api.get(`${basePath}/assignable-users`, { params: { _t: Date.now() } });
    return data;
  },
  getLocations: async () => {
    const { data } = await api.get(`${basePath}/locations`, { params: { _t: Date.now() } });
    return data;
  },
  getProjects: async () => {
    const { data } = await api.get(`${basePath}/projects`, { params: { _t: Date.now() } });
    return data;
  },
  getPhases: async (projectId) => {
    const { data } = await api.get(`${basePath}/phases`, { params: { project_id: projectId || undefined, _t: Date.now() } });
    return data;
  },
  getById: async (id) => {
    const { data } = await api.get(`${basePath}/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post(basePath, payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`${basePath}/${id}`, payload);
    return data;
  },
  addRemark: async (id, payload) => {
    const { data } = await api.post(`${basePath}/${id}/remarks`, payload);
    return data;
  },
  // Upload photos / PDFs to a task. `files` is a FileList or File[].
  addAttachments: async (id, files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('documents', f));
    const { data } = await api.post(`${basePath}/${id}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  delete: async (id) => {
    const { data } = await api.delete(`${basePath}/${id}`);
    return data;
  },
};

export default taskApi;
