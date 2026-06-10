import api from './axiosInstance';

// White-label branding. GET is public (login screen); PATCH is admin-only.
const siteSettingsApi = {
  get: async () => {
    const { data } = await api.get('/site-settings');
    return data;
  },
  update: async (payload) => {
    const { data } = await api.patch('/site-settings', payload);
    return data;
  },
};

export default siteSettingsApi;
