import api from './axiosInstance';

const bookingApi = {
  getAll: (params = {}) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.patch(`/bookings/${id}`, data),
  cancel: (id, data) => api.patch(`/bookings/${id}/cancel`, data),
  remove: (id) => api.delete(`/bookings/${id}`),

  // Payment sub-resource
  getPayments: (bookingId) => api.get(`/bookings/${bookingId}/payments`),
  addPayment: (bookingId, data) => api.post(`/bookings/${bookingId}/payments`, data),

  // Scoped to current user (Collection Manager)
  getMyBookings: (params = {}) => api.get('/bookings/my', { params }),

  // Customer sub-resource
  getCustomers: () => api.get('/bookings/customers'),
  getCustomerById: (id) => api.get(`/bookings/customers/${id}`),
  updateCustomer: (id, data) => api.patch(`/bookings/customers/${id}`, data),
};

export default bookingApi;
