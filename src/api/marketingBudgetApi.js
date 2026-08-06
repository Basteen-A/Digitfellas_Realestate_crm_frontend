import api from './axiosInstance';

// Marketing Metrix › Budget Entry - the spend ledger behind every cost-per metric.
// One line = Budget + Source + Sub Source + Date; the server enforces one live line
// per source / sub-source / day so a double entry can't halve the cost figures.
const marketingBudgetApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/marketing-budgets', { params: { ...params, _t: Date.now() } });
    return data;
  },

  create: async (payload) => {
    const { data } = await api.post('/marketing-budgets', payload);
    return data;
  },

  update: async (id, payload) => {
    const { data } = await api.put(`/marketing-budgets/${id}`, payload);
    return data;
  },

  delete: async (id) => {
    const { data } = await api.delete(`/marketing-budgets/${id}`);
    return data;
  },
};

export default marketingBudgetApi;
