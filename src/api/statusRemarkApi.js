// ============================================================
// API: StatusRemark Management
// ============================================================

import axiosInstance from './axiosInstance';

const API_BASE_URL = '/status-remarks';

const statusRemarkApi = {
  // Get all remarks with pagination
  getAll: async (params = {}) => {
    const response = await axiosInstance.get(API_BASE_URL, { params });
    return response.data;
  },

  // Get remarks for a specific status by ID
  getByStatus: async (statusId) => {
    const response = await axiosInstance.get(`${API_BASE_URL}/status/${statusId}`);
    return response.data;
  },

  // Get remarks for a specific status by code
  getByStatusCode: async (statusCode) => {
    const response = await axiosInstance.get(`${API_BASE_URL}/status-code/${statusCode}`);
    return response.data;
  },

  // Create remark
  create: async (data) => {
    const response = await axiosInstance.post(API_BASE_URL, data);
    return response.data;
  },

  // Update remark
  update: async (id, data) => {
    const response = await axiosInstance.patch(`${API_BASE_URL}/${id}`, data);
    return response.data;
  },

  // Toggle active status (fallback used by generic master CRUD page)
  toggleStatus: async (id, currentValue) => {
    const response = await axiosInstance.patch(`${API_BASE_URL}/${id}`, {
      is_active: !Boolean(currentValue),
    });
    return response.data;
  },

  // Delete remark
  delete: async (id) => {
    const response = await axiosInstance.delete(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // Bulk reorder
  reorder: async (remarks) => {
    const response = await axiosInstance.post(`${API_BASE_URL}/reorder`, { remarks });
    return response.data;
  },
};

export default statusRemarkApi;
