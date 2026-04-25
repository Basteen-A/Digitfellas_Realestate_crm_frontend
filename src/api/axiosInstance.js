// ============================================================
// AXIOS INSTANCE — Centralized HTTP client
// Auto token attach, refresh on 401, request/response interceptors
// ============================================================

import axios from 'axios';

// Build API URL dynamically so mobile devices (accessing via network IP) reach
// the backend on port 5000 of the same host, instead of failing on "localhost".
const API_URL =
  process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== 'http://localhost:5000/api/v1'
    ? process.env.REACT_APP_API_URL
    : `http://${window.location.hostname}:5000/api/v1`;
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || 'recrm_access_token';
const REFRESH_KEY = process.env.REACT_APP_REFRESH_KEY || 'recrm_refresh_token';

// ── Create instance ──
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// ── Track refresh state to prevent multiple refresh calls ──
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ── REQUEST INTERCEPTOR ──
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for performance tracking
    config.metadata = { startTime: Date.now() };

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ── RESPONSE INTERCEPTOR ──
api.interceptors.response.use(
  (response) => {
    // Log slow requests in development
    if (process.env.NODE_ENV === 'development' && response.config.metadata) {
      const duration = Date.now() - response.config.metadata.startTime;
      if (duration > 2000) {
        console.warn(`[SLOW API] ${response.config.method?.toUpperCase()} ${response.config.url} — ${duration}ms`);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // ── Handle 401 — Token expired → try refresh ──
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry refresh or login requests
      if (
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/login')
      ) {
        clearAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        }, { withCredentials: true });

        if (data.success && data.data?.accessToken) {
          const newToken = data.data.accessToken;
          localStorage.setItem(TOKEN_KEY, newToken);

          if (data.data.refreshToken) {
            localStorage.setItem(REFRESH_KEY, data.data.refreshToken);
          }

          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }

        throw new Error('Refresh failed');
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Handle 403 — Forbidden ──
    if (error.response?.status === 403) {
      // Could redirect to unauthorized page
    }

    // ── Handle 429 — Rate limited ──
    if (error.response?.status === 429) {
      console.warn('Rate limited. Please slow down.');
    }

    // ── Handle network errors ──
    if (!error.response) {
      error.message = 'Network error. Please check your connection.';
    }

    return Promise.reject(error);
  }
);

/**
 * Clear all auth data
 */
const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(process.env.REACT_APP_USER_KEY || 'recrm_user');
};

/**
 * Set auth tokens
 */
const setAuth = (accessToken, refreshToken = null, user = null) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) localStorage.setItem(process.env.REACT_APP_USER_KEY || 'recrm_user', JSON.stringify(user));
  api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
};

export { api as default, clearAuth, setAuth, API_URL };
