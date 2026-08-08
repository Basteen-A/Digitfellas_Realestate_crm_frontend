import api from './axiosInstance';

// WhatsApp Automations - standing rules that send an approved template a set
// number of days after a lead was created, or after it entered a given status.
// Shares the marketing-campaigns router (same provider, same templates) but is
// reachable with automation:write as well as marketing:write.
const BASE = '/marketing-campaigns/automations';

const whatsappAutomationApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get(BASE, { params: { ...params, _t: Date.now() } });
    return data;
  },
  getOne: async (id) => {
    const { data } = await api.get(`${BASE}/${id}`, { params: { _t: Date.now() } });
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post(BASE, payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`${BASE}/${id}`, payload);
    return data;
  },
  // Pause / resume without losing the rule or its history.
  toggle: async (id, isActive) => {
    const { data } = await api.patch(`${BASE}/${id}/toggle`, { is_active: isActive });
    return data;
  },
  remove: async (id) => {
    const { data } = await api.delete(`${BASE}/${id}`);
    return data;
  },

  // How many leads this rule reaches - works on an unsaved form too.
  preview: async (payload) => {
    const { data } = await api.post(`${BASE}/preview`, payload);
    return data;
  },
  // Fire one pass now instead of waiting for the daily send time.
  runNow: async (id) => {
    const { data } = await api.post(`${BASE}/${id}/run`);
    return data;
  },

  // History: one row per pass, and the per-lead delivery log behind it.
  getRuns: async (id, params = {}) => {
    const { data } = await api.get(`${BASE}/${id}/runs`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  getLogs: async (id, params = {}) => {
    const { data } = await api.get(`${BASE}/${id}/logs`, { params: { ...params, _t: Date.now() } });
    return data;
  },
};

export default whatsappAutomationApi;
