import createBaseApi from './_baseApi';
import api from './axiosInstance';

const projectApi = {
  ...createBaseApi('/projects'),

  /** Permanently delete a project (only when it has no units) */
  hardDelete: async (id) => {
    const { data } = await api.delete(`/projects/${id}/hard`);
    return data;
  },
};

export default projectApi;