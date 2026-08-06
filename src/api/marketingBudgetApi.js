import api from './axiosInstance';

// Campaigns › Budget Entry - the spend ledger behind every cost-per metric.
// One line = Budget + Campaign + Source + Sub Source(s) + Period; the server refuses a
// second live line whose period overlaps an existing one for the same sub-source, so a
// double entry can't silently halve the cost figures.
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

  // Campaign names the leads already carry for this source / sub-source set, so the
  // budget is booked against the name the lead API is actually sending. Sub-sources go
  // over the wire comma-joined rather than as a repeated key - axios would serialise an
  // array as `lead_sub_source_ids[]=`, which the query validator would then drop.
  getCampaignNames: async ({ leadSourceId, subSourceIds = [], search } = {}) => {
    const { data } = await api.get('/marketing-budgets/campaign-names', {
      params: {
        lead_source_id: leadSourceId || undefined,
        lead_sub_source_ids: subSourceIds.length ? subSourceIds.join(',') : undefined,
        search: search || undefined,
        _t: Date.now(),
      },
    });
    return data;
  },

  // What one budget line bought, over its own period - the ledger row drawer.
  getPerformance: async (id) => {
    const { data } = await api.get(`/marketing-budgets/${id}/performance`);
    return data;
  },
};

export default marketingBudgetApi;
