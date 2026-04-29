import createBaseApi from './_baseApi';

const paymentPlanApi = {
  ...createBaseApi('/payment-plans'),
};

export default paymentPlanApi;
