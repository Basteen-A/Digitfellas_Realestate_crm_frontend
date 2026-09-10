import api from './axiosInstance';

const userActivityApi = {
  /**
   * GET /users/:id/activity
   * Pipeline load + sign-in / device history for one user. Super Admin / Admin only.
   * timezoneOffset is sent so the follow-up counts land on the SAME day boundary
   * the user's own workspace tabs use.
   */
  getActivity: async (userId, params = {}) => {
    const { data } = await api.get(`/users/${userId}/activity`, {
      params: { timezoneOffset: new Date().getTimezoneOffset(), ...params },
    });
    return data;
  },
};

export default userActivityApi;
