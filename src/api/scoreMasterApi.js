import createBaseApi from './_baseApi';
import api from './axiosInstance';

const scoreMasterApi = {
  ...createBaseApi('/score-masters'),

  getGrouped: async () => {
    const { data } = await api.get('/score-masters/grouped');
    return data;
  },
};

export default scoreMasterApi;