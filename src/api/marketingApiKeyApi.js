import api from './axiosInstance';

// Per-integration ingestion API keys. The plaintext key is only returned by
// create() and regenerate() - shown once, never retrievable again.
const marketingApiKeyApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/marketing-api-keys', { params: { ...params, _t: Date.now() } });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post('/marketing-api-keys', payload);
    return data;
  },
  // Edit name / IP whitelist / source mapping without rotating the secret.
  update: async (id, payload) => {
    const { data } = await api.patch(`/marketing-api-keys/${id}`, payload);
    return data;
  },
  regenerate: async (id) => {
    const { data } = await api.post(`/marketing-api-keys/${id}/regenerate`);
    return data;
  },
  toggleStatus: async (id) => {
    const { data } = await api.patch(`/marketing-api-keys/${id}/toggle-status`);
    return data;
  },
  delete: async (id) => {
    const { data } = await api.delete(`/marketing-api-keys/${id}`);
    return data;
  },
};

export default marketingApiKeyApi;
