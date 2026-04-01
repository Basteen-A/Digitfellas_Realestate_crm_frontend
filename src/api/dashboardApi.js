import api from './axiosInstance';

const dashboardApi = {
  getStats: async () => {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },

  getMasterSummary: async () => {
    const { data } = await api.get('/dashboard/master-summary');
    return data;
  },

  // Role-specific dashboards
  getTelecallerStats: async () => {
    const { data } = await api.get('/dashboard/telecaller');
    return data;
  },

  getSalesManagerStats: async () => {
    const { data } = await api.get('/dashboard/sales-manager');
    return data;
  },

  getSalesHeadStats: async () => {
    const { data } = await api.get('/dashboard/sales-head');
    return data;
  },

  getAdminStats: async () => {
    const { data } = await api.get('/dashboard/admin');
    return data;
  },
};

export default dashboardApi;