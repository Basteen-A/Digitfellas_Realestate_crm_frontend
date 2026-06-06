import api from './axiosInstance';

const basePath = '/tasks';

const taskApi = {
  getAll: async (params = {}) => {
    const { data } = await api.get(basePath, { params: { ...params, _t: Date.now() } });
    return data;
  },
  getStats: async () => {
    const { data } = await api.get(`${basePath}/stats`, { params: { _t: Date.now() } });
    return data;
  },
  getAssignableUsers: async () => {
    const { data } = await api.get(`${basePath}/assignable-users`, { params: { _t: Date.now() } });
    return data;
  },
  getLocations: async () => {
    const { data } = await api.get(`${basePath}/locations`, { params: { _t: Date.now() } });
    return data;
  },
  getProjects: async () => {
    const { data } = await api.get(`${basePath}/projects`, { params: { _t: Date.now() } });
    return data;
  },
  getPhases: async (projectId) => {
    const { data } = await api.get(`${basePath}/phases`, { params: { project_id: projectId || undefined, _t: Date.now() } });
    return data;
  },
  getById: async (id) => {
    const { data } = await api.get(`${basePath}/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post(basePath, payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`${basePath}/${id}`, payload);
    return data;
  },
  // When a voice note is recorded, send multipart/form-data so the audio blob
  // rides along with the status/remark fields; otherwise send plain JSON.
  addRemark: async (id, payload) => {
    if (payload && payload.voiceBlob) {
      const fd = new FormData();
      if (payload.content != null) fd.append('content', payload.content);
      if (payload.new_status) fd.append('new_status', payload.new_status);
      if (payload.follow_up_date) fd.append('follow_up_date', payload.follow_up_date);
      if (payload.cancellation_reason) fd.append('cancellation_reason', payload.cancellation_reason);
      if (payload.voice_duration != null) fd.append('voice_duration', String(payload.voice_duration));
      fd.append('voice', payload.voiceBlob, payload.voiceName || 'voice-note.webm');
      const { data } = await api.post(`${basePath}/${id}/remarks`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    }
    const { data } = await api.post(`${basePath}/${id}/remarks`, payload);
    return data;
  },
  // Transcribe + translate a recorded voice clip via the backend (Gemini).
  // `language` is 'tamil' | 'english' (the output language). Returns { text }.
  transcribeVoice: async (blob, language = 'english') => {
    const fd = new FormData();
    fd.append('voice', blob, 'voice-note.webm');
    fd.append('language', language);
    const { data } = await api.post(`${basePath}/transcribe`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  // Upload photos / PDFs to a task. `files` is a FileList or File[].
  addAttachments: async (id, files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('documents', f));
    const { data } = await api.post(`${basePath}/${id}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  delete: async (id) => {
    const { data } = await api.delete(`${basePath}/${id}`);
    return data;
  },
};

export default taskApi;
