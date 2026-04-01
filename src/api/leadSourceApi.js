import createBaseApi from './_baseApi';
import api from './axiosInstance';

const leadSourceApi = {
  ...createBaseApi('/lead-sources'),

  getWithSubSources: async () => {
    const { data } = await api.get('/lead-sources/with-sub-sources');
    return data;
  },
};

export default leadSourceApi;