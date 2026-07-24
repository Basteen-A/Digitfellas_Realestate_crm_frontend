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
  // optional from/to (YYYY-MM-DD), sourceId, projectId. Pass userId to scope the
  // whole report to a single user (User Activity detail view).
  // The All Time window aggregates the full ~1.8M-row activity history and can
  // legitimately run past the instance's default 30 s ceiling, so this call gets
  // its own longer timeout — the shared one would abort a request the server is
  // still happily working on and leave the page stuck on its spinner.
  getRoleAnalytics: async ({ role, period = 'mtd', from, to, sourceId, projectId, userId } = {}) => {
    const { data } = await api.get(
      `/reports/analytics${buildQuery({ role, period, from, to, sourceId, projectId, userId })}`,
      { timeout: 180000 }
    );
    return data;
  },

  // Marketing reports (source / sub-source acquisition, quality, SV ratio,
  // project-wise leads, source-wise site visits). period = today|wtd|mtd|all,
  // optional from/to (YYYY-MM-DD), sourceId, subSourceId, projectId.
  getMarketingReports: async ({ period = 'mtd', from, to, sourceId, subSourceId, projectId } = {}) => {
    const { data } = await api.get(`/reports/marketing${buildQuery({ period, from, to, sourceId, subSourceId, projectId })}`);
    return data;
  },
};

export default reportApi;
