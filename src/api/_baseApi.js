// ============================================================
// BASE API FACTORY
// DRY pattern — generates standard CRUD API functions
// ============================================================

import api from './axiosInstance';

/**
 * Create standard CRUD API for an entity
 * @param {string} basePath - API path e.g. '/locations'
 * @returns {object} API methods
 */
const createBaseApi = (basePath) => {
  return {
    /**
     * Get all with pagination, search, filters
     * @param {object} params - { page, limit, search, sort, is_active, ...filters }
     */
    getAll: async (params = {}) => {
      const { data } = await api.get(basePath, { params });
      return data;
    },

    /**
     * Get active items for dropdown selects
     */
    getDropdown: async (params = {}) => {
      const { data } = await api.get(`${basePath}/dropdown`, { params });
      return data;
    },

    /**
     * Get single record by ID
     */
    getById: async (id) => {
      const { data } = await api.get(`${basePath}/${id}`);
      return data;
    },

    /**
     * Create new record
     */
    create: async (payload) => {
      const { data } = await api.post(basePath, payload);
      return data;
    },

    /**
     * Update existing record
     */
    update: async (id, payload) => {
      const { data } = await api.put(`${basePath}/${id}`, payload);
      return data;
    },

    /**
     * Soft delete record
     */
    delete: async (id) => {
      const { data } = await api.delete(`${basePath}/${id}`);
      return data;
    },

    /**
     * Toggle active status
     */
    toggleStatus: async (id) => {
      const { data } = await api.patch(`${basePath}/${id}/toggle-status`);
      return data;
    },
  };
};

export default createBaseApi;