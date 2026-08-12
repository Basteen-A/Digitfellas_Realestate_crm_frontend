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
  // Second signature on Other Registration Expenses (Admin / Super Admin).
  verifyPaymentAdmin: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/verify/admin`, data),
  // Super Admin - edit an existing payment
  updatePayment: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}`, data),

  // Scoped to current user (Collection Manager)
  getMyBookings: (params = {}) => api.get('/bookings/my', { params }),

  // Customer sub-resource
  getCustomers: () => api.get('/bookings/customers'),
  getCustomerById: (id) => api.get(`/bookings/customers/${id}`),
  updateCustomer: (id, data) => api.patch(`/bookings/customers/${id}`, data),

  // Development cost (Collection Manager)
  updateDevelopmentCost: (bookingId, data) => api.patch(`/bookings/${bookingId}/development-cost`, data),
  // Switch Registration Charges between 2% (default) and 1% - Collection Manager / Super Admin.
  updateRegistrationRate: (bookingId, registrationPercentage) =>
    api.patch(`/bookings/${bookingId}/registration-rate`, { registration_percentage: registrationPercentage }),

  // Payment status (Collection Manager)
  updatePaymentStatus: (bookingId, data) => api.patch(`/bookings/${bookingId}/payment-status`, data),

  // Activities
  getActivities: (bookingId) => api.get(`/bookings/${bookingId}/activities`),

  // Documents - flat list of EVERY document on the booking's lead, as an ARRAY.
  // Kept that shape on purpose; the folder view is getDocumentTree below.
  getDocuments: (bookingId) => api.get(`/bookings/${bookingId}/documents`),
  uploadDocuments: (bookingId, formData) => api.post(`/bookings/${bookingId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Document folders. The archive is a folder tree; `folderId` of null/undefined
  // addresses the root, otherwise a folder id. getDocumentTree returns ONE level
  // as { folderId, breadcrumb, folders, documents }. Folders are scoped to the
  // booking's LEAD - the same scope the documents already use.
  getDocumentTree: (bookingId, folderId = null) => api.get(`/bookings/${bookingId}/document-tree`, {
    params: folderId ? { folderId } : undefined,
  }),
  createDocumentFolder: (bookingId, { folderName, parentId = null }) =>
    api.post(`/bookings/${bookingId}/document-folders`, {
      folder_name: folderName,
      parent_id: parentId,
    }),
  renameDocumentFolder: (bookingId, folderId, folderName) =>
    api.patch(`/bookings/${bookingId}/document-folders/${folderId}`, { folder_name: folderName }),
  deleteDocumentFolder: (bookingId, folderId) =>
    api.delete(`/bookings/${bookingId}/document-folders/${folderId}`),
  // File an already-uploaded document into a folder (null = back to the root).
  moveDocument: (bookingId, documentId, folderId) =>
    api.patch(`/bookings/${bookingId}/documents/${documentId}/move`, { folder_id: folderId }),

  // Cancel reasons dropdown
  getCancelReasons: () => api.get('/bookings/cancel-reasons'),

  // Accounts - reject payment
  rejectPayment: (bookingId, paymentId, data) => api.patch(`/bookings/${bookingId}/payments/${paymentId}/reject`, data),

  // Accounts - all payments queue (filterable)
  getAllPayments: (params = {}) => api.get('/bookings/payments/all', { params }),

  // Payment form master data
  getPaymentFormMasters: () => api.get('/bookings/payments/form-masters'),

  // Approval gate - Booking Open → Pending → Approved/Rejected
  sendForApproval: (id) => api.patch(`/bookings/${id}/send-for-approval`),
  approveBooking: (id) => api.patch(`/bookings/${id}/approve`),
  rejectBooking: (id, data) => api.patch(`/bookings/${id}/reject`, data),

  // Collection workflow - booking status actions
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

  // Record Manager - record the registration details (Doc No / Doc Date / Seller)
  updateRegistrationDetails: (id, data) => api.patch(`/bookings/${id}/registration-details`, data),
  // Record Manager work status (OPEN | COMPLETED); Super Admin can re-open.
  updateRecordStatus: (id, data) => api.patch(`/bookings/${id}/record-status`, data),
  // Super Admin document archive (search-only, all registration records)
  getDocumentArchive: (params = {}) => api.get('/bookings/documents/archive', { params }),

  // Collection Executive assignment (Collection Manager)
  getCollectionExecutives: () => api.get('/bookings/collection-executives'),
  assignCollectionExecutive: (id, data) => api.patch(`/bookings/${id}/assign-collection-executive`, data),

  // Statement of Account (Super Admin / Admin). Rendered server-side and returned
  // as a PDF blob - it is never stored, so every open is freshly generated. The
  // caller opens it in a tab (see openBookingStatement in utils/bookingStatement.js).
  getStatementPdf: (id) => api.get(`/bookings/${id}/statement-pdf`, { responseType: 'blob' }),
};

export default bookingApi;
