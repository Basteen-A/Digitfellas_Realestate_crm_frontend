import createBaseApi from './_baseApi';

const bankApi = {
  ...createBaseApi('/banks'),
};

export default bankApi;
