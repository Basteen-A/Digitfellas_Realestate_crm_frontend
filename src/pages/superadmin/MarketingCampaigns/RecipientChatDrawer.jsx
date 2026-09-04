// ============================================================
// DRAWER: One recipient's WhatsApp conversation, inside the campaign report
//
// The campaign report answers "what happened to the blast?"; the question that
// immediately follows is "so what did THIS person say?". Making that a page
// navigation loses the table position, the filter and the scroll, so the thread
// opens as a slide-over instead: the recipient row stays on screen behind it.
//
// It is the real conversation, not a preview - the same endpoints the WhatsApp
// Inbox uses, including the composer and Meta's 24-hour rule (free-form text is
// only legal for 24h after the customer's last message; outside that window the
// only thing WhatsApp accepts is an approved template).
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  XMarkIcon, PaperAirplaneIcon, LockClosedIcon, ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import whatsappInboxApi from '../../../api/whatsappInboxApi';
import { getErrorMessage } from '../../../utils/helpers';

const fmtTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// Delivery ticks on our own bubbles, mirrored from the status webhook - the
// same vocabulary as the campaign's Status column, so the two never disagree.
const TICKS = { SENT: '✓', DELIVERED: '✓✓', READ: '✓✓', FAILED: '!' };
const TICK_COLOR = { READ: '#53bdeb', FAILED: '#fca5a5' };

const MESSAGE_POLL_MS = 6000;

const RecipientChatDrawer = ({ recipient, templates = [], onClose, onOpenFullInbox }) => {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  // Open (or create) the thread for this number. A recipient who has never
  // exchanged a message has no conversation row yet, so the drawer creates one
  // rather than showing an empty state you cannot act on.
  const openThread = useCallback(async () => {
    if (!recipient) return;
    setLoading(true);
    try {
      const convoResp = recipient.conversation_id
        ? await whatsappInboxApi.getConversation(recipient.conversation_id)
        : await whatsappInboxApi.startConversation({ phone: recipient.phone, lead_id: recipient.lead_id || null });
      setConversation(convoResp.data);

      const msgResp = await whatsappInboxApi.getMessages(convoResp.data.id, { limit: 100 });
      setMessages(msgResp.data || []);
      // Opening the thread is reading it - clear the badge the way the inbox does.
      if (convoResp.data.unread_count > 0) whatsappInboxApi.markRead(convoResp.data.id).catch(() => {});
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not open the conversation'));
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [recipient]);

  useEffect(() => { openThread(); }, [openThread]);

  // Quiet refresh so a reply landing while the drawer is open just appears.
  const refreshMessages = useCallback(async () => {
    if (!conversation?.id) return;
    try {
      const [msgResp, convoResp] = await Promise.all([
        whatsappInboxApi.getMessages(conversation.id, { limit: 100 }),
        whatsappInboxApi.getConversation(conversation.id),
      ]);
      setMessages(msgResp.data || []);
      setConversation(convoResp.data);
    } catch {
      /* transient - the next tick tries again */
    }
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) return undefined;
    pollRef.current = setInterval(refreshMessages, MESSAGE_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [conversation?.id, refreshMessages]);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Escape closes, like every other overlay in the product.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const windowOpen = Boolean(conversation?.window_open);

  const send = async (e) => {
    e.preventDefault();
    if (!conversation?.id) return;
    const payload = windowOpen ? { text: text.trim() } : { template_id: templateId };
    if (windowOpen && !payload.text) { toast.error('Type a message first.'); return; }
    if (!windowOpen && !payload.template_id) { toast.error('Pick an approved template.'); return; }

    setSending(true);
    try {
      await whatsappInboxApi.sendMessage(conversation.id, payload);
      setText('');
      setTemplateId('');
      await refreshMessages();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not send the message'));
    } finally {
      setSending(false);
    }
  };

  if (!recipient) return null;

  const approvedTemplates = templates.filter((t) => !t.status || t.status === 'APPROVED');

  return (
    <>
      {/* Scrim. Clicking it closes, so the drawer never traps the user. */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1200, animation: 'fadeIn 0.15s ease-out' }}
      />
      <aside
        role="dialog"
        aria-label={`Conversation with ${recipient.lead_name || recipient.phone}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)',
          background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-primary)',
          zIndex: 1201, display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recipient.lead_name || conversation?.contact_name || 'Unknown lead'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {recipient.phone}
              {recipient.status && <span> · {recipient.status}</span>}
            </div>
          </div>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={refreshMessages} title="Refresh">
            <ArrowPathIcon style={{ width: 15, height: 15 }} />
          </button>
          {conversation?.id && (
            <button
              className="crm-btn crm-btn-ghost crm-btn-sm"
              onClick={() => onOpenFullInbox?.(conversation.id)}
              title="Open in the full inbox"
            >
              <ArrowTopRightOnSquareIcon style={{ width: 15, height: 15 }} />
            </button>
          )}
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={onClose} title="Close">
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* ── Thread ── */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, background: 'var(--bg-secondary)' }}>
          {loading && <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Loading conversation…</div>}
          {!loading && messages.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              No messages in this thread yet.
            </div>
          )}
          {messages.map((m) => {
            const mine = m.direction === 'OUT';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                <div style={{
                  maxWidth: '82%', padding: '8px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.45,
                  background: mine ? '#075e54' : 'var(--bg-primary)',
                  color: mine ? '#fff' : 'var(--text-primary)',
                  border: mine ? 'none' : '1px solid var(--border-primary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.template_name && (
                    <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Template · {m.template_name}
                    </div>
                  )}
                  {m.body || `[${m.message_type}]`}
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                    {fmtTime(m.message_at)}
                    {mine && m.status && (
                      <span style={{ marginLeft: 5, color: TICK_COLOR[m.status] || 'inherit' }}>{TICKS[m.status] || ''}</span>
                    )}
                  </div>
                  {m.error && <div style={{ fontSize: 11, color: mine ? '#fecaca' : '#991b1b', marginTop: 3 }}>{m.error}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Composer ──
            Outside Meta's 24-hour window the composer swaps itself for a
            template picker rather than letting the provider reject the send. */}
        <form onSubmit={send} style={{ padding: 12, borderTop: '1px solid var(--border-primary)' }}>
          {windowOpen ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a reply…"
                disabled={sending || !conversation}
                style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
              <button type="submit" className="crm-btn crm-btn-primary crm-btn-sm" disabled={sending || !conversation}>
                <PaperAirplaneIcon style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                <LockClosedIcon style={{ width: 13, height: 13 }} />
                {conversation?.last_inbound_at
                  ? 'The 24-hour reply window has closed - only an approved template can be sent until they message again.'
                  : 'This customer has never messaged us, so only an approved template can start the conversation.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={sending || !conversation}
                  style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                  <option value="">Select an approved template…</option>
                  {approvedTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="submit" className="crm-btn crm-btn-primary crm-btn-sm" disabled={sending || !conversation}>
                  <PaperAirplaneIcon style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>
          )}
        </form>
      </aside>
    </>
  );
};

export default RecipientChatDrawer;
