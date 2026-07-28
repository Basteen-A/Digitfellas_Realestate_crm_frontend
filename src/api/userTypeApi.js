import createBaseApi from './_baseApi';
import api from './axiosInstance';

const userTypeApi = {
  ...createBaseApi('/user-types'),

  /**
   * The module catalogue the permission matrix is drawn from. Fetched rather
   * than read from the bundle so the screen always reflects what the server
   * actually enforces — config/modules.js is only the offline fallback.
   */
  getModuleCatalogue: async () => {
    const { data } = await api.get('/user-types/modules');
    return data;
  },
};

export default userTypeApi;
