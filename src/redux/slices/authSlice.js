import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import authApi from '../../api/authApi';
import { clearAuth } from '../../api/axiosInstance';

const TOKEN_KEY = process.env.REACT_APP_TOKEN_KEY || 'recrm_access_token';
const USER_KEY = process.env.REACT_APP_USER_KEY || 'recrm_user';

const normalizeUser = (rawUser) => {
  if (!rawUser) return null;

  const userTypeCode =
    rawUser.userTypeCode ||
    rawUser.user_type_code ||
    rawUser.userType?.short_code ||
    rawUser.userType?.shortCode ||
    null;

  const userType =
    rawUser.userType?.type_name ||
    rawUser.userType ||
    rawUser.user_type ||
    null;

  return {
    ...rawUser,
    userType,
    userTypeCode,
    firstName: rawUser.firstName || rawUser.first_name || '',
    lastName: rawUser.lastName || rawUser.last_name || '',
    fullName:
      rawUser.fullName ||
      rawUser.full_name ||
      `${rawUser.firstName || rawUser.first_name || ''} ${rawUser.lastName || rawUser.last_name || ''}`.trim(),
  };
};

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
};

const writeCachedUser = (user) => {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const cachedUser = readCachedUser();

  if (!token) {
    return { user: null, isAuthenticated: false };
  }

  try {
    const response = await authApi.getProfile();
    const user = normalizeUser(response.data);
    writeCachedUser(user);
    return { user, isAuthenticated: true, staleSession: false };
  } catch (error) {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isNetworkError = !error.response;
    const isUnauthorized = status === 401;

    if ((isNetworkError || status >= 500) && cachedUser) {
      return {
        user: cachedUser,
        isAuthenticated: true,
        staleSession: true,
      };
    }

    if (isUnauthorized || ['INVALID_TOKEN', 'TOKEN_EXPIRED', 'PASSWORD_CHANGED', 'NO_TOKEN'].includes(code)) {
      clearAuth();
      return rejectWithValue(error.response?.data?.message || 'Session expired. Please login again.');
    }

    if (cachedUser) {
      return {
        user: cachedUser,
        isAuthenticated: true,
        staleSession: true,
      };
    }

    clearAuth();
    return rejectWithValue(error.response?.data?.message || 'Unable to restore session');
  }
});

export const login = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await authApi.login(credentials);
    if (!response.success) {
      return rejectWithValue(response.message || 'Login failed');
    }

    const user = normalizeUser(response.data?.user);
    writeCachedUser(user);

    return {
      user,
      isAuthenticated: true,
      message: response.message || 'Login successful',
    };
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Invalid email or password');
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await authApi.logout();
  writeCachedUser(null);
  return true;
});

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await authApi.changePassword(payload);
      return response.message || 'Password updated successfully';
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Unable to update password');
    }
  }
);

const initialState = {
  user: readCachedUser(),
  isAuthenticated: Boolean(localStorage.getItem(TOKEN_KEY)),
  isInitialized: false,
  staleSession: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthState: (state) => {
      state.error = null;
      state.isLoading = false;
      state.staleSession = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.staleSession = Boolean(action.payload.staleSession);
        state.isInitialized = true;
        state.isLoading = false;
      })
      .addCase(loadUser.rejected, (state, action) => {
        state.user = null;
        state.isAuthenticated = false;
        state.staleSession = false;
        state.isInitialized = true;
        state.isLoading = false;
        state.error = action.payload || 'Authentication failed';
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.staleSession = false;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Login failed';
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.staleSession = false;
        state.error = null;
      })
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Password update failed';
      });
  },
});

export const { clearAuthState } = authSlice.actions;
export default authSlice.reducer;
