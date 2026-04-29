import createBaseApi from './_baseApi';

const paymentTypeApi = {
  ...createBaseApi('/payment-types'),
};

export default paymentTypeApi;
