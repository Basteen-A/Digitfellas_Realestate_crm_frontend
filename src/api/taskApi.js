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
  delete: async (id) => {
    const { data } = await api.delete(`${basePath}/${id}`);
    return data;
  },
};

export default taskApi;
