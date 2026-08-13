// ============================================================
// PAGE: WhatsApp Inbox (two-way chat)
// Customer replies arrive on the same provider webhook as the delivery
// receipts. This is where they land: a conversation list on the left, the
// thread on the right, and a composer that respects Meta's rule that
// free-form text is only legal for 24 hours after the customer's last
// message - outside that window the only thing WhatsApp accepts is an
// approved template, so the composer swaps itself for a template picker.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChatBubbleLeftRightIcon, ArrowPathIcon, PaperAirplaneIcon, MagnifyingGlassIcon,
  LockClosedIcon, ArrowLeftIcon, UserCircleIcon, DocumentIcon,
} from '@heroicons/react/24/outline';
import api from '../../../api/axiosInstance';
import whatsappInboxApi from '../../../api/whatsappInboxApi';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';

const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

const fmtTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// Relative age for the conversation list, so the newest threads read at a glance.
const fmtAgo = (d) => {
  if (!d) return '';
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  if (mins < 10080) return `${Math.floor(mins / 1440)}d`;
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const LIST_FILTERS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'replied', label: 'Replied' },
];

// Delivery ticks on our own bubbles, mirrored from the status webhook.
const TICKS = { SENT: '✓', DELIVERED: '✓✓', READ: '✓✓', FAILED: '!' };

// Inbound media streams through the authenticated API (no presigned URLs
// anywhere in this project), so it has to be fetched as a blob rather than
// dropped into an <img src>.
const MediaBubble = ({ message }) => {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get(whatsappInboxApi.mediaUrl(message.id), { responseType: 'blob' });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(resp.data);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message.id]);

  const isImage = (message.media_mime || '').startsWith('image/') || message.message_type === 'image' || message.message_type === 'sticker';

  if (failed) return <div style={{ fontSize: 12, fontStyle: 'italic', opacity: 0.7 }}>[{message.message_type}] attachment unavailable</div>;
  if (!url) return <div style={{ fontSize: 12, opacity: 0.7 }}>Loading attachment…</div>;
  if (isImage) return <img src={url} alt={message.caption || 'attachment'} style={{ maxWidth: 240, borderRadius: 8, display: 'block' }} />;

  return (
    <a href={url} download={message.media_filename || 'attachment'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'inherit' }}>
      <DocumentIcon style={{ width: 16, height: 16 }} />
      {message.media_filename || `Download ${message.message_type}`}
    </a>
  );
};

const Inbox = () => {
  const { id: routeConversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [listFilter, setListFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [listLoading, setListLoading] = useState(true);

  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');

  const scrollRef = useRef(null);
  const activeId = active?.id || null;

  // ── Conversation list ──
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setListLoading(true);
    try {
      const resp = await whatsappInboxApi.getConversations({
        limit: 100, filter: listFilter || undefined, search: searchTerm || undefined,
      });
      setConversations(resp.data || []);
      setUnreadTotal(resp.meta?.unread_total || 0);
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load conversations'));
    } finally {
      if (!silent) setListLoading(false);
    }
  }, [listFilter, searchTerm]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Approved templates - the only thing sendable once the 24h window shuts.
  useEffect(() => {
    (async () => {
      try {
        const resp = await whatsappCampaignApi.getTemplates({ limit: 100, is_active: 'true' });
        setTemplates((resp.data || []).filter((t) => t.status === 'APPROVED'));
      } catch { /* the composer falls back to text-only */ }
    })();
  }, []);

  // ── Thread ──
  const loadThread = useCallback(async (conversationId, silent = false) => {
    if (!conversationId) return;
    if (!silent) setThreadLoading(true);
    try {
      const [cResp, mResp] = await Promise.all([
        whatsappInboxApi.getConversation(conversationId),
        whatsappInboxApi.getMessages(conversationId, { limit: 200 }),
      ]);
      setActive(cResp.data);
      setMessages(mResp.data || []);
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load the conversation'));
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, []);

  // The URL is the source of truth for which thread is open, so a deep link
  // from a campaign recipient row lands on the right conversation.
  useEffect(() => {
    if (!routeConversationId) { setActive(null); setMessages([]); return; }
    loadThread(routeConversationId);
    whatsappInboxApi.markRead(routeConversationId)
      .then(() => loadConversations(true))
      .catch(() => { /* the badge just stays until the next load */ });
  }, [routeConversationId, loadThread, loadConversations]);

  // Replies land whenever the customer types - poll both panes quietly.
  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations(true);
      if (activeId) loadThread(activeId, true);
    }, 7000);
    return () => clearInterval(timer);
  }, [activeId, loadThread, loadConversations]);

  // Pin the thread to the newest message on load and after each send.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeId]);

  const openConversation = (c) => navigate(`/super-admin/whatsapp-inbox/${c.id}`);

  const applySearch = (e) => { e.preventDefault(); setSearchTerm(search.trim()); };

  const send = async () => {
    if (!active) return;
    const useTemplate = !active.window_open;
    if (useTemplate && !templateId) { toast.error('Pick an approved template'); return; }
    if (!useTemplate && !text.trim()) return;

    setSending(true);
    try {
      await whatsappInboxApi.sendMessage(active.id, useTemplate ? { template_id: templateId } : { text: text.trim() });
      setText('');
      await loadThread(active.id, true);
      await loadConversations(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send'));
    } finally {
      setSending(false);
    }
  };

  // Enter sends, Shift+Enter makes a new line - the convention every chat uses.
  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const titleOf = (c) => c?.contact_name
    || [c?.lead?.first_name, c?.lead?.last_name].filter(Boolean).join(' ')
    || c?.display_phone
    || c?.phone
    || 'Unknown';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1>
            <ChatBubbleLeftRightIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />
            WhatsApp Inbox
            {unreadTotal > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '3px 9px', verticalAlign: 'middle' }}>
                {unreadTotal} unread
              </span>
            )}
          </h1>
          <p className="hidden sm:block">Replies from customers, and the campaign message each one is answering</p>
        </div>
        <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => { loadConversations(); if (activeId) loadThread(activeId); }}>
          <ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="wa-inbox-grid">
        {/* ── Conversation list ── */}
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <form onSubmit={applySearch} style={{ padding: 12, display: 'flex', gap: 6, borderBottom: '1px solid var(--border-primary)' }}>
            <input style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number…" />
            <button type="submit" className="crm-btn crm-btn-secondary crm-btn-sm"><MagnifyingGlassIcon style={{ width: 15, height: 15 }} /></button>
          </form>
          <div style={{ padding: '8px 12px', display: 'flex', gap: 6, borderBottom: '1px solid var(--border-primary)' }}>
            {LIST_FILTERS.map((f) => (
              <button key={f.value || 'all'} className={`crm-btn crm-btn-sm ${listFilter === f.value ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => setListFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {listLoading && <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</div>}
            {!listLoading && conversations.length === 0 && (
              <div style={{ padding: 20, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                No conversations yet. They appear as soon as a customer replies to a campaign.
              </div>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 13px', border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-primary)',
                  background: c.id === activeId ? 'var(--bg-secondary)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: c.unread_count ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {titleOf(c)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtAgo(c.last_message_at)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.last_direction === 'OUT' ? 'You: ' : ''}{c.last_message_preview || c.phone}
                </div>
                {c.unread_count > 0 && (
                  <span style={{ display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700, color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '1px 7px' }}>
                    {c.unread_count} new
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Thread ── */}
        <div className="crm-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '65vh' }}>
          {!active && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 30, textAlign: 'center' }}>
              Pick a conversation to read the thread and reply.
            </div>
          )}

          {active && (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => navigate('/super-admin/whatsapp-inbox')} title="Back to list">
                  <ArrowLeftIcon style={{ width: 15, height: 15 }} />
                </button>
                <UserCircleIcon style={{ width: 30, height: 30, color: 'var(--text-muted)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{titleOf(active)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    +{active.phone}
                    {active.lead?.lead_number ? ` · ${active.lead.lead_number}` : ''}
                    {active.lead?.status?.status_name ? ` · ${active.lead.status.status_name}` : ''}
                  </div>
                </div>
                {active.lead?.id && (
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => navigate(`/super-admin/lead-management?leadId=${active.lead.id}`)}>
                    View lead
                  </button>
                )}
              </div>

              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--bg-secondary)', maxHeight: '52vh' }}>
                {threadLoading && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Loading…</div>}
                {!threadLoading && messages.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No messages in this thread yet.</div>
                )}
                {messages.map((m) => {
                  const mine = m.direction === 'OUT';
                  return (
                    <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                      <div style={{
                        maxWidth: '72%', padding: '8px 12px', borderRadius: 10,
                        background: mine ? '#DCF8C6' : 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        color: mine ? '#000' : 'var(--text-primary)',
                      }}>
                        {m.template_name && (
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6, marginBottom: 3 }}>
                            Template · {m.template_name}
                          </div>
                        )}
                        {m.media_id
                          ? <MediaBubble message={m} />
                          : <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body || `[${m.message_type}]`}</div>}
                        {m.error && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>{m.error}</div>}
                        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                          {fmtTime(m.message_at)}
                          {mine && m.status && (
                            <span style={{ marginLeft: 5, color: m.status === 'READ' ? '#2563eb' : (m.status === 'FAILED' ? '#991b1b' : 'inherit') }}>
                              {TICKS[m.status] || ''}
                            </span>
                          )}
                          {m.sender && <span style={{ marginLeft: 5 }}>· {m.sender.first_name}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer. WhatsApp only accepts free text for 24h after the
                  customer's last message; outside that the picker is the
                  ONLY legal way to reach them, so we swap rather than let
                  the provider reject the send. */}
              <div style={{ padding: 12, borderTop: '1px solid var(--border-primary)' }}>
                {active.window_open ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={onComposerKeyDown}
                        rows={2}
                        placeholder="Type a reply… (Enter to send, Shift+Enter for a new line)"
                        style={{ ...inputStyle, resize: 'vertical', minHeight: 44 }}
                      />
                      <button className="crm-btn crm-btn-primary" onClick={send} disabled={sending || !text.trim()}>
                        <PaperAirplaneIcon style={{ width: 16, height: 16 }} /> {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                      Free replies allowed until {fmtTime(active.window_expires_at)} (24h from their last message).
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#B45309', marginBottom: 8 }}>
                      <LockClosedIcon style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
                      <span>
                        {active.last_inbound_at
                          ? 'The 24-hour reply window has closed.'
                          : 'This customer has never messaged us.'}
                        {' '}WhatsApp only accepts an approved template until they message again.
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select style={{ ...inputStyle, cursor: 'pointer' }} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                        <option value="">Select an approved template…</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language_code})</option>)}
                      </select>
                      <button className="crm-btn crm-btn-primary" onClick={send} disabled={sending || !templateId}>
                        <PaperAirplaneIcon style={{ width: 16, height: 16 }} /> {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .wa-inbox-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
};

export default Inbox;
