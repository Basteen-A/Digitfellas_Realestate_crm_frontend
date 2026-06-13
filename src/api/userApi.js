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

  awardPoints: async (userId, points, reason, bookingId = null, leadId = null) => {
    const { data } = await api.post(`/users/${userId}/award-points`, {
      points,
      reason,
      booking_id: bookingId,
      lead_id: leadId,
    });
    return data;
  },

  updatePointsForBooking: async (userId, points, reason, bookingId = null, leadId = null) => {
    const { data } = await api.put(`/users/${userId}/points-for-booking`, {
      points,
      reason,
      booking_id: bookingId,
      lead_id: leadId,
    });
    return data;
  },

  getPointsHistory: async (userId) => {
    const { data } = await api.get(`/users/${userId}/points-history`);
    return data;
  },
};

export default userApi;