import createBaseApi from './_baseApi';
import api from './axiosInstance';

const leadStageApi = {
  ...createBaseApi('/lead-stages'),

  getPipeline: async () => {
    const { data } = await api.get('/lead-stages/pipeline');
    return data;
  },

  getGrouped: async () => {
    const { data } = await api.get('/lead-stages/grouped');
    return data;
  },
};

export default leadStageApi;