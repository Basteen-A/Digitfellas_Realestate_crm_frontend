import createBaseApi from './_baseApi';

const paymentModeApi = {
  ...createBaseApi('/payment-modes'),
};

export default paymentModeApi;
