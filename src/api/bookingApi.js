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
  approvePaymentAccounts: (bookingId, paymentId) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/approve/accounts`),
  approvePaymentManagement: (bookingId, paymentId) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/approve/management`),
  verifyPayment: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/verify`, data),

  // Scoped to current user (Collection Manager)
  getMyBookings: (params = {}) => api.get('/bookings/my', { params }),

  // Customer sub-resource
  getCustomers: () => api.get('/bookings/customers'),
  getCustomerById: (id) => api.get(`/bookings/customers/${id}`),
  updateCustomer: (id, data) => api.patch(`/bookings/customers/${id}`, data),

  // Development cost (Collection Manager)
  updateDevelopmentCost: (bookingId, data) => api.patch(`/bookings/${bookingId}/development-cost`, data),

  // Payment status (Collection Manager)
  updatePaymentStatus: (bookingId, data) => api.patch(`/bookings/${bookingId}/payment-status`, data),

  // Activities
  getActivities: (bookingId) => api.get(`/bookings/${bookingId}/activities`),

  // Documents
  getDocuments: (bookingId) => api.get(`/bookings/${bookingId}/documents`),
  uploadDocuments: (bookingId, formData) => api.post(`/bookings/${bookingId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Cancel reasons dropdown
  getCancelReasons: () => api.get('/bookings/cancel-reasons'),

  // Accounts — reject payment
  rejectPayment: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/reject`, data),

  // Accounts — all payments queue (filterable)
  getAllPayments: (params = {}) => api.get('/bookings/payments/all', { params }),

  // Payment form master data
  getPaymentFormMasters: () => api.get('/bookings/payments/form-masters'),
};

export default bookingApi;
