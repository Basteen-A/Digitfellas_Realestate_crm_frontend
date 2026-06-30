import api from './axiosInstance';

// WhatsApp Marketing Campaigns — provider config, approved templates and
// outbound campaigns with live delivery stats. Admin-only on the server.
const BASE = '/marketing-campaigns';

const whatsappCampaignApi = {
  // ── Provider configuration ──
  getConfig: async () => {
    const { data } = await api.get(`${BASE}/config`, { params: { _t: Date.now() } });
    return data;
  },
  updateConfig: async (payload) => {
    const { data } = await api.put(`${BASE}/config`, payload);
    return data;
  },
  testConfig: async (payload) => {
    const { data } = await api.post(`${BASE}/config/test`, payload);
    return data;
  },

  // ── Templates ──
  getTemplateMeta: async () => {
    const { data } = await api.get(`${BASE}/templates/meta`, { params: { _t: Date.now() } });
    return data;
  },
  getTemplates: async (params = {}) => {
    const { data } = await api.get(`${BASE}/templates`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  createTemplate: async (payload) => {
    const { data } = await api.post(`${BASE}/templates`, payload);
    return data;
  },
  updateTemplate: async (id, payload) => {
    const { data } = await api.put(`${BASE}/templates/${id}`, payload);
    return data;
  },
  deleteTemplate: async (id) => {
    const { data } = await api.delete(`${BASE}/templates/${id}`);
    return data;
  },
  syncTemplates: async () => {
    const { data } = await api.post(`${BASE}/templates/sync`);
    return data;
  },

  // ── Campaigns ──
  previewRecipients: async (filters) => {
    const { data } = await api.post(`${BASE}/campaigns/preview`, { filters });
    return data;
  },
  getCampaigns: async (params = {}) => {
    const { data } = await api.get(`${BASE}/campaigns`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  createCampaign: async (payload) => {
    const { data } = await api.post(`${BASE}/campaigns`, payload);
    return data;
  },
  getCampaign: async (id) => {
    const { data } = await api.get(`${BASE}/campaigns/${id}`, { params: { _t: Date.now() } });
    return data;
  },
  getRecipients: async (id, params = {}) => {
    const { data } = await api.get(`${BASE}/campaigns/${id}/recipients`, { params: { ...params, _t: Date.now() } });
    return data;
  },
};

export default whatsappCampaignApi;
