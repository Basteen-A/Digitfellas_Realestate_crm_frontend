import createBaseApi from './_baseApi';
import api from './axiosInstance';

// Source → telecaller round-robin rules for inbound marketing leads.
const marketingAllocationRuleApi = {
  ...createBaseApi('/marketing-allocation-rules'),

  // Active telecallers for the rule editor's multi-select / "select all" UI.
  getTelecallers: async () => {
    const { data } = await api.get('/marketing-allocation-rules/telecallers', { params: { _t: Date.now() } });
    return data;
  },
};

export default marketingAllocationRuleApi;
