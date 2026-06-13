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
  getTelecallerStats: async (params = {}) => {
    const query = new URLSearchParams(params);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/telecaller${qs ? `?${qs}` : ''}`);
    return data;
  },
  getTelecallerDetailed: async (params = {}) => {
    const query = new URLSearchParams(params);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/telecaller-detailed${qs ? `?${qs}` : ''}`);
    return data;
  },

  getSalesManagerStats: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.dateFilter) query.set('dateFilter', params.dateFilter);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/sales-manager${qs ? `?${qs}` : ''}`);
    return data;
  },


  getSalesHeadStats: async () => {
    const { data } = await api.get('/dashboard/sales-head');
    return data;
  },

  getBookingSummary: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.dateFilter) query.set('dateFilter', params.dateFilter);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.projectId) query.set('projectId', params.projectId);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/sales-head/booking-summary${qs ? `?${qs}` : ''}`);
    return data;
  },

  getAdminStats: async () => {
    const { data } = await api.get('/dashboard/admin');
    return data;
  },

  getCollectionStats: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.dateFilter) query.set('dateFilter', params.dateFilter);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/collection${qs ? `?${qs}` : ''}`);
    return data;
  },

  getAccountsStats: async () => {
    const { data } = await api.get('/dashboard/accounts');
    return data;
  },

  // Leaderboard APIs
  getTelecallerLeaderboard: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.dateFilter) query.set('dateFilter', params.dateFilter);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/leaderboard/telecaller${qs ? `?${qs}` : ''}`);
    return data;
  },

  getSalesManagerLeaderboard: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.dateFilter) query.set('dateFilter', params.dateFilter);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/leaderboard/sales-manager${qs ? `?${qs}` : ''}`);
    return data;
  },

  getSalesHeadLeaderboard: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.dateFilter) query.set('dateFilter', params.dateFilter);
    const qs = query.toString();
    const { data } = await api.get(`/dashboard/leaderboard/sales-head${qs ? `?${qs}` : ''}`);
    return data;
  },
};

export default dashboardApi;