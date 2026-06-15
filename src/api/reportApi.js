import api from './axiosInstance';

const buildQuery = (params = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

const reportApi = {
  // role = TC|SM|SH|COL, period = today|wtd|mtd, optional userId for drill-down
  getUserActivity: async ({ role, period = 'today', userId } = {}) => {
    const { data } = await api.get(`/reports/user-activity${buildQuery({ role, period, userId })}`);
    return data;
  },

  // period = today|wtd|mtd, optional projectId / locationId
  getInventory: async ({ period = 'mtd', projectId, locationId } = {}) => {
    const { data } = await api.get(`/reports/inventory${buildQuery({ period, projectId, locationId })}`);
    return data;
  },

  // Role analytics dashboard. role = TC|SM|SH, period = today|wtd|mtd|all,
  // optional from/to (YYYY-MM-DD), sourceId, projectId.
  getRoleAnalytics: async ({ role, period = 'mtd', from, to, sourceId, projectId } = {}) => {
    const { data } = await api.get(`/reports/analytics${buildQuery({ role, period, from, to, sourceId, projectId })}`);
    return data;
  },
};

export default reportApi;
