import api from './axiosInstance';

// Read-only API for the Marketing Allocation History screen. Supports date /
// source / telecaller / outcome filters plus pagination via query params
// (dateFrom, dateTo, leadSourceId, userId, outcome, search, page, limit).
const marketingAllocationLogApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get('/marketing-allocation-logs', { params: { ...params, _t: Date.now() } });
    return data;
  },
  getStats: async (params = {}) => {
    const { data } = await api.get('/marketing-allocation-logs/stats', { params: { ...params, _t: Date.now() } });
    return data;
  },
};

export default marketingAllocationLogApi;
