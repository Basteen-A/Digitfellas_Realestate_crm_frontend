import api from './axiosInstance';

// WhatsApp Marketing Campaigns - provider config, approved templates and
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
  checkConnection: async () => {
    const { data } = await api.get(`${BASE}/config/connection`, { params: { _t: Date.now() } });
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

  // ── Header media upload (returns a stable public URL pinbot can fetch) ──
  uploadHeaderMedia: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await api.post(`${BASE}/media`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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
  // params: { page, limit, search, status } - status also accepts the two
  // reply pseudo-filters REPLIED / NO_REPLY.
  getRecipients: async (id, params = {}) => {
    const { data } = await api.get(`${BASE}/campaigns/${id}/recipients`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  // Live counters recounted off the recipient rows (incl. replies).
  getCampaignStats: async (id) => {
    const { data } = await api.get(`${BASE}/campaigns/${id}/stats`, { params: { _t: Date.now() } });
    return data;
  },
  // The whole audience as a CSV, streamed server-side. Returned as a blob so
  // the caller can save it without leaving the authenticated axios instance -
  // a plain <a href> would drop the Authorization header.
  exportRecipients: async (id, params = {}) => {
    const { data } = await api.get(`${BASE}/campaigns/${id}/recipients/export`, {
      params, responseType: 'blob',
    });
    return data;
  },

  // ── Send controls ──
  // The server re-reads the campaign row every batch, so each of these takes
  // effect within one batch rather than at the end of the send.
  pauseCampaign: async (id) => {
    const { data } = await api.post(`${BASE}/campaigns/${id}/pause`);
    return data;
  },
  resumeCampaign: async (id) => {
    const { data } = await api.post(`${BASE}/campaigns/${id}/resume`);
    return data;
  },
  cancelCampaign: async (id) => {
    const { data } = await api.post(`${BASE}/campaigns/${id}/cancel`);
    return data;
  },
  // Re-derives the cached counters on the LIST screen from the recipient rows.
  recalculateCampaign: async (id) => {
    const { data } = await api.post(`${BASE}/campaigns/${id}/recalculate`);
    return data;
  },

  // ── Webhook health ──
  // Why Delivered / Read / Replied might be empty: no callback configured, a
  // payload shape we cannot parse, or receipts for somebody else's messages.
  getWebhookHealth: async (params = {}) => {
    const { data } = await api.get(`${BASE}/campaigns/webhook-health`, { params: { ...params, _t: Date.now() } });
    return data;
  },

  // ── Follow-ups (the scheduled second touch) ──
  getFollowupMeta: async () => {
    const { data } = await api.get(`${BASE}/campaigns/followups/meta`, { params: { _t: Date.now() } });
    return data;
  },
  getFollowups: async (campaignId) => {
    const { data } = await api.get(`${BASE}/campaigns/${campaignId}/followups`, { params: { _t: Date.now() } });
    return data;
  },
  // "Who would this reach?" before the rule is saved.
  previewFollowup: async (campaignId, payload) => {
    const { data } = await api.post(`${BASE}/campaigns/${campaignId}/followups/preview`, payload);
    return data;
  },
  createFollowup: async (campaignId, payload) => {
    const { data } = await api.post(`${BASE}/campaigns/${campaignId}/followups`, payload);
    return data;
  },
  updateFollowup: async (followupId, payload) => {
    const { data } = await api.put(`${BASE}/campaigns/followups/${followupId}`, payload);
    return data;
  },
  toggleFollowup: async (followupId) => {
    const { data } = await api.patch(`${BASE}/campaigns/followups/${followupId}/toggle`);
    return data;
  },
  cancelFollowup: async (followupId) => {
    const { data } = await api.delete(`${BASE}/campaigns/followups/${followupId}`);
    return data;
  },
  // Fire it now, ignoring the delay.
  runFollowup: async (followupId) => {
    const { data } = await api.post(`${BASE}/campaigns/followups/${followupId}/run`);
    return data;
  },
};

export default whatsappCampaignApi;
