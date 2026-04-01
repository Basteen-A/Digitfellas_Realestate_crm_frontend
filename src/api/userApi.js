import createBaseApi from './_baseApi';
import api from './axiosInstance';

const userApi = {
  ...createBaseApi('/users'),

  getTeam: async (userId) => {
    const { data } = await api.get(`/users/${userId}/team`);
    return data;
  },

  adminResetPassword: async (userId, newPassword) => {
    const { data } = await api.put(`/users/${userId}/reset-password`, { newPassword });
    return data;
  },
};

export default userApi;