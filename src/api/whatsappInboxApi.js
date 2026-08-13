import api from './axiosInstance';

// WhatsApp Inbox - the two-way chat fed by the `messages` half of the provider
// webhook. Same base path as campaigns; admin-only on the server.
const BASE = '/marketing-campaigns/inbox';

const whatsappInboxApi = {
  // params: { page, limit, search, filter: 'unread' | 'replied', archived }
  getConversations: async (params = {}) => {
    const { data } = await api.get(`${BASE}/conversations`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  getConversation: async (id) => {
    const { data } = await api.get(`${BASE}/conversations/${id}`, { params: { _t: Date.now() } });
    return data;
  },
  getMessages: async (id, params = {}) => {
    const { data } = await api.get(`${BASE}/conversations/${id}/messages`, { params: { ...params, _t: Date.now() } });
    return data;
  },
  // payload: { text } inside the 24h window, or { template_id } any time.
  sendMessage: async (id, payload) => {
    const { data } = await api.post(`${BASE}/conversations/${id}/messages`, payload);
    return data;
  },
  markRead: async (id) => {
    const { data } = await api.post(`${BASE}/conversations/${id}/read`);
    return data;
  },
  // Opens (or reuses) the thread for a phone - how a campaign recipient row
  // jumps straight into the chat.
  startConversation: async (payload) => {
    const { data } = await api.post(`${BASE}/conversations/start`, payload);
    return data;
  },
  // Inbound attachments stream through the authenticated API, never a
  // presigned URL (project-wide file rule).
  mediaUrl: (messageId) => `${BASE}/messages/${messageId}/media`,
};

export default whatsappInboxApi;
