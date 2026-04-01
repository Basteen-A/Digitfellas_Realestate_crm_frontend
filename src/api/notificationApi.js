import api from './axiosInstance';

const notificationApi = {
  getAll: (params = {}) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  archive: (id) => api.patch(`/notifications/${id}/archive`),
};

export default notificationApi;
