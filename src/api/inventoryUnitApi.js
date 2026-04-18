import createBaseApi from './_baseApi';
import api from './axiosInstance';

const baseApi = createBaseApi('/inventory-units');

const inventoryUnitApi = {
  ...baseApi,

  /** Aggregated dashboard stats across all projects */
  getDashboard: async () => {
    const { data } = await api.get('/inventory-units/dashboard', { params: { _t: Date.now() } });
    return data;
  },

  /** Per-project inventory summary */
  getProjectSummary: async (projectId) => {
    const { data } = await api.get(`/inventory-units/project/${projectId}/summary`, { params: { _t: Date.now() } });
    return data;
  },
};

export default inventoryUnitApi;
