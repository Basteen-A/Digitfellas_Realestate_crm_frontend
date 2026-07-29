import api from './axiosInstance';

// Project-level document archive. The archive is a folder tree: a `folderId` of
// null/undefined addresses the project root, otherwise a folder id. `list`
// returns { folderId, breadcrumb, folders, documents } for one level.
const projectDocumentApi = {
  list: (projectId, folderId = null) => api.get(`/projects/${projectId}/documents`, {
    params: folderId ? { folderId } : undefined,
  }),
  upload: (projectId, formData) => api.post(`/projects/${projectId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  remove: (projectId, docId) => api.delete(`/projects/${projectId}/documents/${docId}`),

  // ── Folders ──
  createFolder: (projectId, { folderName, parentId = null }) =>
    api.post(`/projects/${projectId}/document-folders`, {
      folder_name: folderName,
      parent_id: parentId,
    }),
  renameFolder: (projectId, folderId, folderName) =>
    api.patch(`/projects/${projectId}/document-folders/${folderId}`, { folder_name: folderName }),
  removeFolder: (projectId, folderId) =>
    api.delete(`/projects/${projectId}/document-folders/${folderId}`),
};

export default projectDocumentApi;
