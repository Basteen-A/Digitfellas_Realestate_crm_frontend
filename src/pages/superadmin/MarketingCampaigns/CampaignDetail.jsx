// ============================================================
// PAGE: WhatsApp Campaign Detail
// The recipient drill-down, promoted out of the cramped modal it used to live
// in and onto its own route (/super-admin/marketing-campaigns/:id) so a
// 10,000-recipient send is actually browsable: real pagination, search, a
// reply column, and a Chat action that opens the conversation.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, ArrowPathIcon, ChatBubbleLeftRightIcon, MagnifyingGlassIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import whatsappInboxApi from '../../../api/whatsappInboxApi';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

const RECIPIENT_STATUS_COLORS = {
  SENT: '#2563eb', DELIVERED: '#166534', READ: '#7c3aed', FAILED: '#991b1b', PENDING: '#a16207', SKIPPED: '#6b7280',
};

// Filter chips. The last two are NOT delivery statuses - they slice the same
// rows by whether the customer wrote back (server maps them onto replied_at).
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'READ', label: 'Read' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REPLIED', label: 'Replied' },
  { value: 'NO_REPLY', label: 'No reply' },
];

const PAGE_SIZE = 50;

// One counter in the header strip.
const Stat = ({ label, value, sub, tone }) => (
  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', minWidth: 110 }}>
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2, color: tone || 'var(--text-primary)' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
  </div>
);

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [opening, setOpening] = useState(null); // recipient id whose chat is being opened

  const pollRef = useRef(null);

  const loadHeader = useCallback(async () => {
    try {
      const [cResp, sResp] = await Promise.all([
        whatsappCampaignApi.getCampaign(id),
        whatsappCampaignApi.getCampaignStats(id),
      ]);
      setCampaign(cResp.data);
      setStats(sResp.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load campaign'));
    }
  }, [id]);

  const loadRecipients = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const resp = await whatsappCampaignApi.getRecipients(id, {
        page, limit: PAGE_SIZE, status: statusFilter || undefined, search: searchTerm || undefined,
      });
      setRecipients(resp.data || []);
      setMeta(resp.meta || { total: 0, page: 1, totalPages: 1 });
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load recipients'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, page, statusFilter, searchTerm]);

  useEffect(() => { loadHeader(); }, [loadHeader]);
  useEffect(() => { loadRecipients(); }, [loadRecipients]);

  // Delivery receipts and replies arrive asynchronously via the provider
  // webhook, so refresh quietly in place rather than making the user hit
  // Refresh to find out whether anyone answered.
  useEffect(() => {
    pollRef.current = setInterval(() => { loadHeader(); loadRecipients(true); }, 8000);
    return () => clearInterval(pollRef.current);
  }, [loadHeader, loadRecipients]);

  // Filter / search changes always restart at page 1.
  const applyFilter = (value) => { setStatusFilter(value); setPage(1); };
  const applySearch = (e) => { e.preventDefault(); setSearchTerm(search.trim()); setPage(1); };

  // Open (or create) the thread for this recipient and jump into the chat.
  const openChat = async (r) => {
    if (r.conversation_id) { navigate(`/super-admin/whatsapp-inbox/${r.conversation_id}`); return; }
    setOpening(r.id);
    try {
      const resp = await whatsappInboxApi.startConversation({ phone: r.phone, lead_id: r.lead_id || null });
      navigate(`/super-admin/whatsapp-inbox/${resp.data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not open the chat'));
    } finally {
      setOpening(null);
    }
  };

  const detailFor = (r) => {
    if (r.status === 'FAILED') return r.error || 'Delivery failed';
    if (r.status === 'READ') return `Read${r.read_at ? ` ${fmtDateTime(r.read_at)}` : ''}`;
    if (r.status === 'DELIVERED') return `Delivered${r.delivered_at ? ` ${fmtDateTime(r.delivered_at)}` : ''}`;
    if (r.status === 'SENT') return 'Accepted by WhatsApp - awaiting delivery receipt';
    return r.error || '-';
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => navigate('/super-admin/marketing-campaigns')}>
            <ArrowLeftIcon style={{ width: 16, height: 16 }} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0 }}>
              <MegaphoneIcon style={{ width: 20, height: 20, marginRight: 6, verticalAlign: 'text-bottom' }} />
              {campaign?.name || 'Campaign'}
            </h1>
            <p className="hidden sm:block">
              {campaign?.template_name || campaign?.template?.name || 'Template'}
              {campaign?.created_at ? ` · sent ${fmtDateTime(campaign.created_at)}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => { loadHeader(); loadRecipients(); }}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh
          </button>
          <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => navigate('/super-admin/whatsapp-inbox')}>
            <ChatBubbleLeftRightIcon style={{ width: 15, height: 15 }} /> Open Inbox
          </button>
        </div>
      </div>

      {/* Counters - recounted server-side off the recipient rows, so they stay
          right even if a webhook was missed and the cached columns drifted. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Recipients" value={stats?.total ?? campaign?.total_recipients ?? '-'} />
        <Stat label="Sent" value={stats?.sent ?? '-'} sub="accepted by WhatsApp" tone="#166534" />
        <Stat label="Delivered" value={stats?.delivered ?? '-'} tone="#166534" />
        <Stat label="Read" value={stats?.read ?? '-'} tone="#7c3aed" />
        <Stat label="Replied" value={stats?.replied ?? '-'} sub={stats ? `${stats.reply_rate}% of sent` : ''} tone="#0f766e" />
        <Stat label="No reply" value={stats?.no_reply ?? '-'} />
        <Stat label="Failed" value={stats?.failed ?? '-'} tone={stats?.failed ? '#991b1b' : undefined} />
      </div>

      <div className="crm-card">
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => (
              <button
                key={f.value || 'ALL'}
                className={`crm-btn crm-btn-sm ${statusFilter === f.value ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
                onClick={() => applyFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <form onSubmit={applySearch} style={{ display: 'flex', gap: 6 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              style={{ padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 200 }}
            />
            <button type="submit" className="crm-btn crm-btn-secondary crm-btn-sm">
              <MagnifyingGlassIcon style={{ width: 15, height: 15 }} />
            </button>
          </form>
        </div>

        <div style={{ padding: '0 16px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
          SENT = accepted by WhatsApp. Delivered / Read / Failed and customer replies all arrive on the same
          provider webhook - set the callback URL in the pinbot panel to keep these live.
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={th}>Lead</th>
                <th style={th}>Phone</th>
                <th style={th}>Status</th>
                <th style={th}>Reply</th>
                <th style={th}>Detail</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>Loading…</td></tr>}
              {!loading && recipients.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>No recipients match this filter.</td></tr>
              )}
              {!loading && recipients.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.lead_name || '-'}</td>
                  <td style={td}>{r.phone}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: RECIPIENT_STATUS_COLORS[r.status] || 'var(--text-muted)' }}>{r.status}</span>
                  </td>
                  <td style={td}>
                    {r.replied_at ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0f766e' }}>
                        {r.reply_count > 1 ? `${r.reply_count} replies` : 'Replied'}
                        <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)' }}>{fmtDateTime(r.replied_at)}</span>
                      </span>
                    ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text-muted)', fontSize: 12, maxWidth: 300, whiteSpace: 'normal' }}>{detailFor(r)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="view-link" onClick={() => openChat(r)} disabled={opening === r.id}>
                      {opening === r.id ? 'Opening…' : 'Chat'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {meta.totalPages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {meta.total} recipient(s) · page {meta.page} of {meta.totalPages}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignDetail;
