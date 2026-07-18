import api from './axiosInstance';

// Attendance (telecaller check-in / check-out). /status + /check-in are for the
// logged-in user (the portal gate); the rest are Super-Admin only.
const BASE = '/attendance';

const attendanceApi = {
  getStatus: async () => {
    const { data } = await api.get(`${BASE}/status`, { params: { _t: Date.now() } });
    return data;
  },
  checkIn: async (payload) => {
    const { data } = await api.post(`${BASE}/check-in`, payload);
    return data;
  },

  // ── Super Admin ──
  getDayView: async (date = null) => {
    const { data } = await api.get(BASE, { params: { ...(date ? { date } : {}), _t: Date.now() } });
    return data;
  },
  getSettings: async () => {
    const { data } = await api.get(`${BASE}/settings`, { params: { _t: Date.now() } });
    return data;
  },
  updateSettings: async (payload) => {
    const { data } = await api.put(`${BASE}/settings`, payload);
    return data;
  },
  adminCheckIn: async (userId) => {
    const { data } = await api.post(`${BASE}/${userId}/check-in`);
    return data;
  },
  adminCheckOut: async (userId) => {
    const { data } = await api.post(`${BASE}/${userId}/check-out`);
    return data;
  },
};

export default attendanceApi;
