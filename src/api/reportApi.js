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
  // its own longer timeout - the shared one would abort a request the server is
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

  // Collection Report - item / project wise collection & outstanding.
  // period = today|wtd|mtd|all (collection blocks only; outstanding is always a live
  // snapshot), optional from/to (YYYY-MM-DD), projectId, collectionManagerId.
  // Server decides the scope: org-wide for SA/ADM/OH-with-reports, own book for
  // Collection Manager / Executive - `collectionManagerId` is ignored for the latter.
  // The All Time window walks every booking's full payment history, so this call gets
  // the same longer timeout as the analytics report.
  getCollectionReports: async ({ period = 'mtd', from, to, projectId, collectionManagerId } = {}) => {
    const { data } = await api.get(
      `/reports/collection${buildQuery({ period, from, to, projectId, collectionManagerId })}`,
      { timeout: 180000 }
    );
    return data;
  },

  // Marketing Metrix - budget vs lead / qualified / site-visit / booking volume,
  // attributed to each lead's LATEST marketing touch (creation or re-enquiry).
  // period = today|wtd|mtd|all, optional from/to (YYYY-MM-DD), sourceId, subSourceId.
  // The All Time window resolves the latest touch across the whole leads table, so this
  // call gets the same longer timeout as the analytics report.
  getMarketingMetrix: async ({ period = 'mtd', from, to, sourceId, subSourceId } = {}) => {
    const { data } = await api.get(
      `/reports/marketing-metrix${buildQuery({ period, from, to, sourceId, subSourceId })}`,
      { timeout: 180000 }
    );
    return data;
  },
};

export default reportApi;
