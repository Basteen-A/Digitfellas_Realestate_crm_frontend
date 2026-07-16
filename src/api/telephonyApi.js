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
};

export default telephonyApi;
