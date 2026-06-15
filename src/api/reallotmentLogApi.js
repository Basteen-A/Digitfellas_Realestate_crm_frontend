import api from './axiosInstance';

// Read-only API for the reallotment log screen. Supports date / user / status
// filters plus pagination via query params (dateFrom, dateTo, userId,
// leadStatusId, outcome, page, limit).
const reallotmentLogApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/reallotment-logs', { params: { ...params, _t: Date.now() } });
    return data;
  },
  getStats: async (params = {}) => {
    const { data } = await api.get('/reallotment-logs/stats', { params: { ...params, _t: Date.now() } });
    return data;
  },
  // Manually trigger a reallotment pass (admin only)
  runNow: async () => {
    const { data } = await api.post('/reallotment-logs/run');
    return data;
  },
};

export default reallotmentLogApi;
