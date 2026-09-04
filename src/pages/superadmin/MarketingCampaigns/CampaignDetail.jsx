// ============================================================
// PAGE: WhatsApp Campaign Detail
//
// The full account of one send-out: who it went to, what happened to each
// message, what each person said back, and what happens next.
//
// Four things live here:
//   1. the counter strip (recounted server-side off the recipient rows, so it
//      is right even when a webhook was missed and the cached columns drifted)
//   2. send controls - pause / resume / cancel, and the resume that rescues a
//      campaign stranded on SENDING by a mid-blast restart
//   3. the recipient table, with each person's reply and a chat drawer
//   4. scheduled follow-ups: the automatic second touch for whoever went quiet
//
// Delivered / Read / Replied can ONLY come from the provider webhook, so when
// those columns are empty the banner at the top says which of the three
// possible causes it is rather than leaving the reader to guess.
// ============================================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon, ArrowPathIcon, ChatBubbleLeftRightIcon, MagnifyingGlassIcon,
  MegaphoneIcon, ArrowDownTrayIcon, PauseIcon, PlayIcon, XCircleIcon,
  ExclamationTriangleIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';
import CampaignFollowups from './CampaignFollowups';
import RecipientChatDrawer from './RecipientChatDrawer';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

const RECIPIENT_STATUS_COLORS = {
  SENT: '#2563eb', DELIVERED: '#166534', READ: '#7c3aed', FAILED: '#991b1b', PENDING: '#a16207', SKIPPED: '#6b7280',
};

const CAMPAIGN_STATUS_COLORS = {
  QUEUED: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  SENDING: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  PAUSED: { bg: '#FEFCE8', fg: '#854D0E', border: '#FEF08A' },
  COMPLETED: { bg: '#F0FDF4', fg: '#166534', border: '#BBF7D0' },
  CANCELLED: { bg: '#F3F4F6', fg: '#4B5563', border: '#E5E7EB' },
  FAILED: { bg: '#FFF1F2', fg: '#9F1239', border: '#FECDD3' },
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
  { value: 'SKIPPED', label: 'Skipped' },
  { value: 'REPLIED', label: 'Replied' },
  { value: 'NO_REPLY', label: 'No reply' },
];

const PAGE_SIZE = 50;

// Poll fast while the blast is moving, slowly once it has settled, and not at
// all while the tab is hidden. A 10,000-row campaign report left open on a
// second monitor should not be re-counting the recipients table every 8
// seconds for the rest of the afternoon.
const POLL_ACTIVE_MS = 4000;
const POLL_IDLE_MS = 20000;

// One counter in the header strip.
const Stat = ({ label, value, sub, tone, onClick, active }) => (
  <div
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    style={{
      padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)',
      border: `1px solid ${active ? 'var(--primary, #2563eb)' : 'var(--border-primary)'}`,
      minWidth: 110, cursor: onClick ? 'pointer' : 'default',
    }}
  >
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
  const [chatRecipient, setChatRecipient] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [health, setHealth] = useState(null);
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  // Templates power both the follow-up builder and the chat drawer's
  // out-of-window composer; fetched once here rather than twice below.
  useEffect(() => {
    (async () => {
      try {
        const resp = await whatsappCampaignApi.getTemplates({ limit: 200 });
        setTemplates(resp.data || []);
      } catch {
        /* both consumers degrade to an empty picker */
      }
    })();
  }, []);

  // Why Delivered / Read / Replied might be empty. Fetched once per visit -
  // this is provider configuration, not live data.
  useEffect(() => {
    (async () => {
      try {
        const resp = await whatsappCampaignApi.getWebhookHealth();
        setHealth(resp.data);
      } catch {
        /* the banner simply does not render */
      }
    })();
  }, []);

  // A campaign that is still moving needs a fast refresh; a finished one does
  // not, and a hidden tab needs none at all.
  const isLive = campaign && ['QUEUED', 'SENDING'].includes(campaign.status);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      loadHeader();
      loadRecipients(true);
    };
    pollRef.current = setInterval(tick, isLive ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    return () => clearInterval(pollRef.current);
  }, [loadHeader, loadRecipients, isLive]);

  // Filter / search changes always restart at page 1.
  const applyFilter = (value) => { setStatusFilter(value); setPage(1); };
  const applySearch = (e) => { e.preventDefault(); setSearchTerm(search.trim()); setPage(1); };

  // ── Send controls ──
  const runAction = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setActing(true);
    try {
      const resp = await fn(id);
      toast.success(resp.message || 'Done');
      await loadHeader();
      await loadRecipients(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setActing(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await whatsappCampaignApi.exportRecipients(id, {
        status: statusFilter || undefined,
      });
      // The export streams through the authenticated axios instance, so it
      // arrives as a blob and is saved client-side - a plain link would lose
      // the Authorization header and 401.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(campaign?.name || 'campaign').replace(/[^a-z0-9]+/gi, '-')}-recipients.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const copyCallbackUrl = () => {
    if (!health?.callback_url) return;
    navigator.clipboard?.writeText(health.callback_url)
      .then(() => toast.success('Callback URL copied'))
      .catch(() => toast.error('Could not copy - select and copy it manually'));
  };

  const detailFor = (r) => {
    if (r.status === 'FAILED') return r.error || 'Delivery failed';
    if (r.status === 'SKIPPED') return r.error || 'Skipped';
    if (r.status === 'READ') return `Read${r.read_at ? ` ${fmtDateTime(r.read_at)}` : ''}`;
    if (r.status === 'DELIVERED') return `Delivered${r.delivered_at ? ` ${fmtDateTime(r.delivered_at)}` : ''}`;
    if (r.status === 'SENT') return 'Accepted by WhatsApp - awaiting delivery receipt';
    if (r.status === 'PENDING') return 'Queued - not sent yet';
    return r.error || '-';
  };

  const statusChip = CAMPAIGN_STATUS_COLORS[campaign?.status] || CAMPAIGN_STATUS_COLORS.QUEUED;

  // A campaign sitting on SENDING that no worker is actually walking is the
  // failure mode this page previously had no way to show. Say it outright.
  const looksStalled = campaign?.status === 'SENDING'
    && !campaign?.is_sending_now
    && (campaign?.pending_count || 0) > 0;

  const showWebhookWarning = health && health.verdict !== 'OK';

  const filterChips = useMemo(() => FILTERS, []);

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
              {campaign?.status && (
                <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 10, color: statusChip.fg, background: statusChip.bg, border: `1px solid ${statusChip.border}`, borderRadius: 999, padding: '3px 9px', verticalAlign: 'middle' }}>
                  {campaign.status}
                </span>
              )}
            </h1>
            <p className="hidden sm:block">
              {campaign?.template_name || campaign?.template?.name || 'Template'}
              {campaign?.created_at ? ` · sent ${fmtDateTime(campaign.created_at)}` : ''}
              {/* A campaign a follow-up rule created explains its own audience. */}
              {campaign?.parent && (
                <>
                  {' · follow-up of '}
                  <button
                    type="button"
                    className="view-link"
                    onClick={() => navigate(`/super-admin/marketing-campaigns/${campaign.parent.id}`)}
                  >
                    {campaign.parent.name}
                  </button>
                  {campaign.filters?.audience_label ? ` (${campaign.filters.audience_label})` : ''}
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => { loadHeader(); loadRecipients(); }}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={exportCsv} disabled={exporting}>
            <ArrowDownTrayIcon style={{ width: 15, height: 15 }} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {['QUEUED', 'SENDING'].includes(campaign?.status) && (
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => runAction(whatsappCampaignApi.pauseCampaign)} disabled={acting}>
              <PauseIcon style={{ width: 15, height: 15 }} /> Pause
            </button>
          )}
          {['PAUSED', 'SENDING', 'QUEUED', 'FAILED'].includes(campaign?.status) && (campaign?.pending_count || 0) > 0 && (
            <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => runAction(whatsappCampaignApi.resumeCampaign)} disabled={acting}>
              <PlayIcon style={{ width: 15, height: 15 }} /> Resume
            </button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(campaign?.status) && (
            <button
              className="crm-btn crm-btn-ghost crm-btn-sm"
              style={{ color: '#991b1b' }}
              onClick={() => runAction(whatsappCampaignApi.cancelCampaign, 'Cancel this campaign? Messages already sent cannot be recalled.')}
              disabled={acting}
            >
              <XCircleIcon style={{ width: 15, height: 15 }} /> Cancel
            </button>
          )}
          <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => navigate('/super-admin/whatsapp-inbox')}>
            <ChatBubbleLeftRightIcon style={{ width: 15, height: 15 }} /> Open Inbox
          </button>
        </div>
      </div>

      {/* ── Stalled-send banner ──
          The processor stops only from inside itself, so a deploy mid-blast
          leaves a campaign here with recipients still queued and no worker on
          it. The background sweep picks this up within 10 minutes; the button
          is for people who would rather not wait. */}
      {looksStalled && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#C2410C', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: '#7C2D12' }}>
            This campaign says it is sending, but nothing is working on it right now -{' '}
            <strong>{campaign.pending_count}</strong> recipient(s) have never been sent to. A restart during the
            send usually causes this. It will be picked up automatically within 10 minutes.
          </div>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => runAction(whatsappCampaignApi.resumeCampaign)} disabled={acting}>
            <PlayIcon style={{ width: 15, height: 15 }} /> Resume now
          </button>
        </div>
      )}

      {/* ── Webhook health banner ──
          Delivered / Read / Replied come only from the provider callback. When
          it is not wired up, saying so is far more useful than a column of
          zeroes that looks like nobody opened the message. */}
      {showWebhookWarning && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: '#FEFCE8', border: '1px solid #FEF08A', display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#854D0E', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: '#713F12' }}>
            <strong>Delivery receipts are not arriving.</strong> {health.detail}
            {health.callback_url && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 12, background: 'rgba(0,0,0,0.05)', padding: '3px 7px', borderRadius: 6, wordBreak: 'break-all' }}>
                  {health.callback_url}
                </code>
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={copyCallbackUrl}>
                  <ClipboardDocumentIcon style={{ width: 14, height: 14 }} /> Copy
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Counters - recounted server-side off the recipient rows, so they stay
          right even if a webhook was missed and the cached columns drifted.
          Each one is also a filter: the number and the list behind it agree. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="Recipients" value={stats?.total ?? campaign?.total_recipients ?? '-'} onClick={() => applyFilter('')} active={statusFilter === ''} />
        <Stat label="Sent" value={stats?.sent ?? '-'} sub="accepted by WhatsApp" tone="#166534" onClick={() => applyFilter('SENT')} active={statusFilter === 'SENT'} />
        <Stat label="Delivered" value={stats?.delivered ?? '-'} tone="#166534" onClick={() => applyFilter('DELIVERED')} active={statusFilter === 'DELIVERED'} />
        <Stat label="Read" value={stats?.read ?? '-'} tone="#7c3aed" onClick={() => applyFilter('READ')} active={statusFilter === 'READ'} />
        <Stat label="Replied" value={stats?.replied ?? '-'} sub={stats ? `${stats.reply_rate}% of sent` : ''} tone="#0f766e" onClick={() => applyFilter('REPLIED')} active={statusFilter === 'REPLIED'} />
        <Stat label="No reply" value={stats?.no_reply ?? '-'} onClick={() => applyFilter('NO_REPLY')} active={statusFilter === 'NO_REPLY'} />
        <Stat label="Failed" value={stats?.failed ?? '-'} tone={stats?.failed ? '#991b1b' : undefined} onClick={() => applyFilter('FAILED')} active={statusFilter === 'FAILED'} />
        {(stats?.pending ?? 0) > 0 && (
          <Stat label="Pending" value={stats.pending} sub="not sent yet" tone="#a16207" onClick={() => applyFilter('PENDING')} active={statusFilter === 'PENDING'} />
        )}
      </div>

      <div className="crm-card">
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filterChips.map((f) => (
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                <th style={th}>Lead</th>
                <th style={th}>Phone</th>
                <th style={th}>Status</th>
                <th style={th}>Reply</th>
                <th style={th}>What they said</th>
                <th style={th}>Detail</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>Loading…</td></tr>}
              {!loading && recipients.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>No recipients match this filter.</td></tr>
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
                  {/* The actual words. A "Replied" flag with no content is the
                      point at which people leave the report to go hunting. */}
                  <td style={{ ...td, fontSize: 12, maxWidth: 260, whiteSpace: 'normal' }}>
                    {r.last_reply_text
                      ? <span style={{ fontStyle: 'italic' }}>“{r.last_reply_text}”</span>
                      : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td style={{ ...td, color: 'var(--text-muted)', fontSize: 12, maxWidth: 260, whiteSpace: 'normal' }}>{detailFor(r)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="view-link" onClick={() => setChatRecipient(r)}>
                      Chat
                      {r.conversation_unread > 0 && (
                        <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, background: '#dc2626', color: '#fff', borderRadius: 999, padding: '1px 6px' }}>
                          {r.conversation_unread}
                        </span>
                      )}
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

      {/* ── Scheduled follow-ups ── */}
      <CampaignFollowups campaign={campaign} templates={templates} />

      {/* ── Per-recipient conversation ── */}
      {chatRecipient && (
        <RecipientChatDrawer
          recipient={chatRecipient}
          templates={templates}
          onClose={() => { setChatRecipient(null); loadRecipients(true); }}
          onOpenFullInbox={(conversationId) => navigate(`/super-admin/whatsapp-inbox/${conversationId}`)}
        />
      )}
    </div>
  );
};

export default CampaignDetail;
