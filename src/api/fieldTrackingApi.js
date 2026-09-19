import api from './axiosInstance';

// Field Tracking (punch in/out, GPS route timeline, halts, reports).
//
// Distinct from attendanceApi.js - that one drives the telecaller check-in gate
// that controls lead allocation. This module records where field staff went and
// how long they worked. They share no endpoints.
const BASE = '/field-tracking';

// Cache-buster on every GET: these screens are read after a punch or a worker
// pass, and a 304 from the browser cache reads as "nothing happened".
const noCache = (params = {}) => ({ params: { ...params, _t: Date.now() } });

const fieldTrackingApi = {
  // ── Self (the mobile app and the logged-in user's own history) ──
  getStatus: async () => {
    const { data } = await api.get(`${BASE}/status`, noCache());
    return data;
  },
  punchIn: async (payload) => {
    const { data } = await api.post(`${BASE}/punch-in`, payload);
    return data;
  },
  punchOut: async (payload) => {
    const { data } = await api.post(`${BASE}/punch-out`, payload);
    return data;
  },
  getMyHistory: async (params = {}) => {
    const { data } = await api.get(`${BASE}/my-history`, noCache(params));
    return data;
  },

  // ── Self: customer visits ──
  // Distinct from the sales pipeline's scheduled site visits (/site-visits).
  listMyVisits: async (params = {}) => {
    const { data } = await api.get(`${BASE}/visits/mine`, noCache(params));
    return data;
  },
  startVisit: async (payload) => {
    const { data } = await api.post(`${BASE}/visits`, payload);
    return data;
  },
  endVisit: async (id, payload = {}) => {
    const { data } = await api.post(`${BASE}/visits/${id}/end`, payload);
    return data;
  },
  updateVisit: async (id, payload) => {
    const { data } = await api.put(`${BASE}/visits/${id}`, payload);
    return data;
  },
  cancelVisit: async (id) => {
    const { data } = await api.delete(`${BASE}/visits/${id}`);
    return data;
  },

  // ── Admin: dashboard, grid, analytics, beat plan ──
  getDashboard: async (params = {}) => {
    const { data } = await api.get(`${BASE}/dashboard`, noCache(params));
    return data;
  },
  getAttendanceGrid: async (params = {}) => {
    const { data } = await api.get(`${BASE}/attendance-grid`, noCache(params));
    return data;
  },
  getVisitAnalytics: async (params = {}) => {
    const { data } = await api.get(`${BASE}/reports/analytics`, noCache(params));
    return data;
  },
  // The sales pipeline's scheduled site visits, read as a field beat plan.
  getPlans: async (params = {}) => {
    const { data } = await api.get(`${BASE}/plans`, noCache(params));
    return data;
  },

  // ── Admin: monitoring ──
  getConfig: async () => {
    const { data } = await api.get(`${BASE}/config`, noCache());
    return data;
  },
  // Candidate users for the config screen. Gated on field_tracking, not on the
  // `users` module - configuring tracking must not require user-admin rights.
  listUsers: async (params = {}) => {
    const { data } = await api.get(`${BASE}/users`, noCache(params));
    return data;
  },
  getDayView: async (params = {}) => {
    const { data } = await api.get(`${BASE}/day`, noCache(params));
    return data;
  },
  getLiveBoard: async (params = {}) => {
    const { data } = await api.get(`${BASE}/live`, noCache(params));
    return data;
  },
  getTimeline: async (userId, params = {}) => {
    const { data } = await api.get(`${BASE}/users/${userId}/timeline`, noCache(params));
    return data;
  },
  getUserHistory: async (userId, params = {}) => {
    const { data } = await api.get(`${BASE}/users/${userId}/history`, noCache(params));
    return data;
  },
  getResolvedConfig: async (userId) => {
    const { data } = await api.get(`${BASE}/users/${userId}/resolved-config`, noCache());
    return data;
  },

  // ── Admin: reports ──
  getSummaryReport: async (params = {}) => {
    const { data } = await api.get(`${BASE}/reports/summary`, noCache(params));
    return data;
  },
  getHaltReport: async (params = {}) => {
    const { data } = await api.get(`${BASE}/reports/halts`, noCache(params));
    return data;
  },
  getVisitReport: async (params = {}) => {
    const { data } = await api.get(`${BASE}/reports/visits`, noCache(params));
    return data;
  },

  // ── Admin: punch locations ──
  listLocations: async (params = {}) => {
    const { data } = await api.get(`${BASE}/locations`, noCache(params));
    return data;
  },
  createLocation: async (payload) => {
    const { data } = await api.post(`${BASE}/locations`, payload);
    return data;
  },
  updateLocation: async (id, payload) => {
    const { data } = await api.put(`${BASE}/locations/${id}`, payload);
    return data;
  },
  deleteLocation: async (id) => {
    const { data } = await api.delete(`${BASE}/locations/${id}`);
    return data;
  },

  // ── Admin: shift policies ──
  listPolicies: async () => {
    const { data } = await api.get(`${BASE}/policies`, noCache());
    return data;
  },
  createPolicy: async (payload) => {
    const { data } = await api.post(`${BASE}/policies`, payload);
    return data;
  },
  updatePolicy: async (id, payload) => {
    const { data } = await api.put(`${BASE}/policies/${id}`, payload);
    return data;
  },
  deletePolicy: async (id) => {
    const { data } = await api.delete(`${BASE}/policies/${id}`);
    return data;
  },

  // ── Admin: per-role / per-user configuration ──
  listAssignments: async (params = {}) => {
    const { data } = await api.get(`${BASE}/assignments`, noCache(params));
    return data;
  },
  // Upsert: the screen does not track whether a row already exists.
  // `location_ids`, when sent, REPLACES the permitted set outright.
  saveAssignment: async (payload) => {
    const { data } = await api.put(`${BASE}/assignments`, payload);
    return data;
  },
  deleteAssignment: async (id) => {
    const { data } = await api.delete(`${BASE}/assignments/${id}`);
    return data;
  },

  // ── Admin: holidays ──
  listHolidays: async (params = {}) => {
    const { data } = await api.get(`${BASE}/holidays`, noCache(params));
    return data;
  },
  createHoliday: async (payload) => {
    const { data } = await api.post(`${BASE}/holidays`, payload);
    return data;
  },
  updateHoliday: async (id, payload) => {
    const { data } = await api.put(`${BASE}/holidays/${id}`, payload);
    return data;
  },
  deleteHoliday: async (id) => {
    const { data } = await api.delete(`${BASE}/holidays/${id}`);
    return data;
  },

  // ── Admin: module settings ──
  getSettings: async () => {
    const { data } = await api.get(`${BASE}/settings`, noCache());
    return data;
  },
  updateSettings: async (payload) => {
    const { data } = await api.put(`${BASE}/settings`, payload);
    return data;
  },

  // ── Admin: manual corrections ──
  adminPunchIn: async (userId, payload = {}) => {
    const { data } = await api.post(`${BASE}/users/${userId}/punch-in`, payload);
    return data;
  },
  adminPunchOut: async (userId, payload = {}) => {
    const { data } = await api.post(`${BASE}/users/${userId}/punch-out`, payload);
    return data;
  },
  setDayStatus: async (userId, payload) => {
    const { data } = await api.put(`${BASE}/users/${userId}/day-status`, payload);
    return data;
  },
  recalculate: async (userId, date) => {
    const { data } = await api.post(`${BASE}/users/${userId}/recalculate`, null, { params: { date } });
    return data;
  },
};

export default fieldTrackingApi;
