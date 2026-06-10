import createBaseApi from './_baseApi';

const paymentStatusApi = {
  ...createBaseApi('/payment-statuses'),
};

export default paymentStatusApi;
