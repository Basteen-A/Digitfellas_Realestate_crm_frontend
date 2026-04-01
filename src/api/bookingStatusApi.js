import createBaseApi from './_baseApi';
import api from './axiosInstance';

const bookingStatusApi = {
  ...createBaseApi('/booking-statuses'),

  getPipeline: async () => {
    const { data } = await api.get('/booking-statuses/pipeline');
    return data;
  },
};

export default bookingStatusApi;