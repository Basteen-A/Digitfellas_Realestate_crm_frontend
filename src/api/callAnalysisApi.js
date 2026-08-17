import api from './axiosInstance';

// AI call-recording analysis - Super Admin provider config plus the per-call /
// per-lead analysis reads that feed the lead detail "AI Analysis" tab.
// Config endpoints are org_settings-only on the server; the read endpoints are
// scoped to whatever calls the signed-in user can already see.
const BASE = '/call-analysis';

const callAnalysisApi = {
  // ── Configuration (Super Admin) ──
  getConfig: async () => {
    const { data } = await api.get(`${BASE}/config`, { params: { _t: Date.now() } });
    return data;
  },
  updateConfig: async (payload) => {
    const { data } = await api.put(`${BASE}/config`, payload);
    return data;
  },
  getStats: async () => {
    const { data } = await api.get(`${BASE}/stats`, { params: { _t: Date.now() } });
    return data;
  },
  // Ask the provider which models the key can actually use. POST, because the
  // (possibly unsaved) API key travels in the body - never a query string.
  // Omit api_key to reuse the one already stored for that stage.
  listModels: async ({ stage = 'analysis', provider, api_key, base_url } = {}) => {
    const { data } = await api.post(`${BASE}/models`, { stage, provider, api_key, base_url });
    return data;
  },
  // Kick off a worker pass immediately instead of waiting for the next tick.
  runNow: async () => {
    const { data } = await api.post(`${BASE}/run`);
    return data;
  },

  // ── Reads ──
  getForCallLog: async (callLogId) => {
    const { data } = await api.get(`${BASE}/call-logs/${callLogId}`, { params: { _t: Date.now() } });
    return data;
  },
  getForLead: async (leadId) => {
    const { data } = await api.get(`${BASE}/leads/${leadId}`, { params: { _t: Date.now() } });
    return data;
  },

  // Analyse one recording on demand. Bypasses the duration threshold, so this
  // is how a short-but-important call gets analysed. `force` re-runs a call
  // that already has a completed analysis.
  analyzeNow: async (callLogId, { force = false } = {}) => {
    const { data } = await api.post(`${BASE}/call-logs/${callLogId}/analyze`, { force });
    return data;
  },
};

export default callAnalysisApi;
