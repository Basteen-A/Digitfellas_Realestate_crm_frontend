// ============================================================
// AUTH API
// ============================================================

import api, { setAuth, clearAuth } from './axiosInstance';

const authApi = {
  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    if (data.success && data.data) {
      setAuth(data.data.accessToken, data.data.refreshToken, data.data.user);
    }
    return data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue logout even if API fails
    } finally {
      clearAuth();
    }
  },

  getProfile: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  changePassword: async (payload) => {
    const { data } = await api.put('/auth/change-password', payload);
    return data;
  },

  forgotPassword: async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  resetPassword: async (payload) => {
    const { data } = await api.post('/auth/reset-password', payload);
    return data;
  },

  refreshToken: async (refreshToken) => {
    const { data } = await api.post('/auth/refresh', { refreshToken });
    if (data.success && data.data) {
      setAuth(data.data.accessToken, data.data.refreshToken);
    }
    return data;
  },
};

export default authApi;