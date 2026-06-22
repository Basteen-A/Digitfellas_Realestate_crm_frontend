import api from './axiosInstance';

const bookingApi = {
  getAll: (params = {}) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  create: (data) => api.post('/bookings', data),
  update: (id, data) => api.patch(`/bookings/${id}`, data),
  cancel: (id, data) => api.patch(`/bookings/${id}/cancel`, data),
  remove: (id) => api.delete(`/bookings/${id}`),
  // Permanently delete a booking + child records (Super Admin / Admin only)
  hardDelete: (id) => api.delete(`/bookings/${id}/hard`),

  // Payment sub-resource
  getPayments: (bookingId) => api.get(`/bookings/${bookingId}/payments`),
  addPayment: (bookingId, data) => api.post(`/bookings/${bookingId}/payments`, data),
  approvePaymentAccounts: (bookingId, paymentId) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/approve/accounts`),
  approvePaymentManagement: (bookingId, paymentId) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/approve/management`),
  verifyPayment: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/verify`, data),
  // Super Admin — edit an existing payment
  updatePayment: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}`, data),

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

  // Approval gate — Booking Open → Pending → Approved/Rejected
  sendForApproval: (id) => api.patch(`/bookings/${id}/send-for-approval`),
  approveBooking: (id) => api.patch(`/bookings/${id}/approve`),
  rejectBooking: (id, data) => api.patch(`/bookings/${id}/reject`, data),

  // Collection workflow — booking status actions
  registerBooking: (id, formData) => api.patch(`/bookings/${id}/register`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateToEMI: (id, data) => api.patch(`/bookings/${id}/emi`, data),
  requestToCancel: (id, data) => api.patch(`/bookings/${id}/request-cancel`, data),
  approveCancellation: (id, data) => api.patch(`/bookings/${id}/approve-cancel`, data),
  rejectCancellation: (id, data) => api.patch(`/bookings/${id}/reject-cancel`, data),
  revertCancellation: (id, data) => api.patch(`/bookings/${id}/revert-cancel`, data),
  confirmCancel: (id, data) => api.patch(`/bookings/${id}/confirm-cancel`, data || {}),
  processRefund: (id, data) => api.post(`/bookings/${id}/refunds`, data),
  getCancellationRequests: (params) => api.get('/bookings/cancellation-requests', { params }),
};

export default bookingApi;
