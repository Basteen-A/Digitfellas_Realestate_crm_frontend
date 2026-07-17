import api from './axiosInstance';

// Telephony (Tata Smartflo) — provider webhook config + role-scoped call logs
// with recording playback. Config endpoints are admin-only on the server; the
// call-logs endpoints are role-scoped (a telecaller sees only their own calls).
const BASE = '/telephony';

const telephonyApi = {
  // ── Provider configuration (Super Admin) ──
  getConfig: async () => {
    const { data } = await api.get(`${BASE}/config`, { params: { _t: Date.now() } });
    return data;
  },
  updateConfig: async (payload) => {
    const { data } = await api.put(`${BASE}/config`, payload);
    return data;
  },

  // ── DID (ad-number) allocation rules (Super Admin) ──
  getDidRules: async () => {
    const { data } = await api.get(`${BASE}/did-rules`, { params: { _t: Date.now() } });
    return data;
  },
  createDidRule: async (payload) => {
    const { data } = await api.post(`${BASE}/did-rules`, payload);
    return data;
  },
  updateDidRule: async (id, payload) => {
    const { data } = await api.put(`${BASE}/did-rules/${id}`, payload);
    return data;
  },
  deleteDidRule: async (id) => {
    const { data } = await api.delete(`${BASE}/did-rules/${id}`);
    return data;
  },

  // ── Call logs ──
  getCallLogs: async (params = {}) => {
    const { data } = await api.get(`${BASE}/call-logs`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  getCallLog: async (id) => {
    const { data } = await api.get(`${BASE}/call-logs/${id}`, { params: { _t: Date.now() } });
    return data;
  },

  // API-relative recording path for <AuthedAudio src> (axios adds the /api/v1
  // base + the Bearer token; the raw provider URL never reaches the browser).
  recordingSrc: (id) => `${BASE}/call-logs/${id}/recording`,

  // Outbound Click-to-Call — Smartflo rings the logged-in agent's phone, then
  // the customer. Pass { lead_id } (customer = lead's phone) or { destination_number }.
  clickToCall: async (payload) => {
    const { data } = await api.post(`${BASE}/click-to-call`, payload);
    return data;
  },
};

export default telephonyApi;
