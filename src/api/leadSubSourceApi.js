import createBaseApi from './_baseApi';
import api from './axiosInstance';

const leadSubSourceApi = {
  ...createBaseApi('/lead-sub-sources'),

  getBySource: async (sourceId) => {
    const { data } = await api.get(`/lead-sub-sources/by-source/${sourceId}`);
    return data;
  },
};

export default leadSubSourceApi;