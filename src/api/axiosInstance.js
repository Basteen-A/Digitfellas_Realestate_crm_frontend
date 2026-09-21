// ============================================================
// AXIOS INSTANCE - Centralized HTTP client
// Auto token attach, refresh on 401, request/response interceptors
// ============================================================

import axios from 'axios';
import { getViewAs, isSessionPath, READ_METHODS } from '../utils/viewAs';

// Build API URL dynamically so mobile devices (accessing via network IP) reach
// the backend on port 5000 of the same host, instead of failing on "localhost".
const API_URL =
  process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== 'http://localhost:5000/api/v1'
    ? process.env.REACT_APP_API_URL
    : `http://${window.location.hostname}:5000/api/v1`;
const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || 'recrm_access_token';
const REFRESH_KEY = process.env.REACT_APP_REFRESH_KEY || 'recrm_refresh_token';

// Uploads get their own, far longer budget than ordinary JSON calls (see the
// request interceptor, which applies this to any FormData body).
const UPLOAD_TIMEOUT = 10 * 60 * 1000;

// ── Create instance ──
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // Identifies the caller as this web app. The server uses it to apply rules that
    // only newer clients can satisfy - currently the mandatory Sales Manager on an
    // SH booking - without breaking mobile builds already in people's hands.
    'X-Client': 'web',
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

    // File uploads are not 30-second requests. A multi-MB document on a normal
    // office connection routinely exceeds the default timeout, and an aborted
    // upload surfaces with NO response - which used to be reported to the user
    // as "Network error", hiding the fact that it was simply still uploading.
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      config.timeout = UPLOAD_TIMEOUT;
    }

    // ── Role Workspaces "view as" ──
    // Tell the server whose workspace to render. The server is what actually
    // enforces read-only; failing the write here as well just saves a pointless
    // round-trip and gives the calling screen the same message the server would
    // have returned.
    const viewAs = getViewAs();
    const url = config.url || '';
    if (viewAs?.id && !isSessionPath(url)) {
      const method = (config.method || 'get').toUpperCase();
      if (!READ_METHODS.includes(method)) {
        const message = `Read-only view of ${viewAs.name || 'this workspace'}. Exit to make changes.`;
        // Deliberately NOT toasted from here. Pages fire background writes on
        // mount (notification housekeeping and the like) and swallow their
        // failures on purpose - toasting globally turned those into a spurious
        // "error" the moment a workspace opened. Rejecting with a normal-shaped
        // axios error is enough: screens that report errors already surface
        // this message, and the ones that stay quiet were meant to.
        console.warn('[view-as] blocked write', method, url);
        const blocked = new Error('Read-only view');
        blocked.isViewAsBlocked = true;
        blocked.config = config;
        blocked.response = {
          status: 403,
          data: { success: false, message, code: 'VIEW_AS_READ_ONLY' },
        };
        return Promise.reject(blocked);
      }
      config.headers['X-View-As-User'] = viewAs.id;
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // ── Handle 401 - Token expired → try refresh ──
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

    // ── Handle 403 - Forbidden ──
    if (error.response?.status === 403) {
      // Could redirect to unauthorized page
    }

    // ── Handle 429 - Rate limited ──
    if (error.response?.status === 429) {
      console.warn('Rate limited. Please slow down.');
    }

    // ── Handle "no response came back" ──
    // These three cases used to collapse into one useless "Network error", which
    // made an upload that timed out, one the server cut off, and a genuinely
    // offline browser indistinguishable. Keep them apart.
    if (!error.response) {
      const isUpload = typeof FormData !== 'undefined' && originalRequest.data instanceof FormData;
      if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
        error.message = isUpload
          ? 'Upload timed out. The file may be too large or the connection too slow.'
          : 'The server took too long to respond. Please try again.';
      } else if (isUpload) {
        // The browser was still sending the body when the connection dropped -
        // typically the server (or a proxy in front of it) rejected the request
        // early, e.g. on size or permissions, and closed the socket.
        error.message = 'Upload failed - the connection was closed before the file finished sending. '
          + 'The file may exceed the maximum allowed size.';
      } else {
        error.message = 'Network error. Please check your connection.';
      }
      // Keep the real cause in the console for diagnosis.
      console.error('[api] no response', {
        url: originalRequest.url, method: originalRequest.method, code: error.code, message: error.message,
      });
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
