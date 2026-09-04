// ============================================================
// PAGE: WhatsApp Campaign Detail
//
// The full account of one send-out: who it went to, what happened to each
// message, what each person said back, and what happens next.
//
// Five things live here:
//   1. the counter strip (recounted server-side off the recipient rows, so it
//      is right even when a webhook was missed and the cached columns drifted)
//   2. send controls - pause / resume / cancel, and the resume that rescues a
//      campaign stranded on SENDING by a mid-blast restart
//   3. WHY messages failed, grouped - because "Delivered 0" on its own reads as
//      "nobody opened it" when the real cause is usually one fixable thing
//   4. the recipient table, with each person's reply and a chat drawer
//   5. scheduled follow-ups: the automatic second touch for whoever went quiet
//
// Styling follows the .col-stat-card-new / .col-table-new system the rest of
// the product uses: monochrome values, colour only inside badges.
//
// The recipient table is CURSOR paginated - a 10,000-recipient campaign is
// exactly the case where OFFSET starts re-walking the whole table per page.
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
import '../../portals/collection/CollectionWorkspace.css';

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

// Status is the one place colour is allowed: it is a badge, and these are the
// app-wide badge triples from badge-system.html.
const RECIPIENT_BADGE = {
  SENT: 'col-badge-new-status',
  DELIVERED: 'col-badge-verified',
  READ: 'col-badge-verified',
  FAILED: 'col-badge-rejected',
  PENDING: 'col-badge-pending',
  SKIPPED: 'col-badge-neutral',
};

const CAMPAIGN_BADGE = {
  QUEUED: 'col-badge-new-status',
  SENDING: 'col-badge-unverified',
  PAUSED: 'col-badge-pending',
  COMPLETED: 'col-badge-verified',
  CANCELLED: 'col-badge-neutral',
  FAILED: 'col-badge-rejected',
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
// second monitor should not be re-counting the recipients table every few
// seconds for the rest of the afternoon.
const POLL_ACTIVE_MS = 4000;
const POLL_IDLE_MS = 20000;

const fmtNumber = (n) => (n === null || n === undefined || n === '-' ? '-' : Number(n).toLocaleString('en-IN'));

// One counter in the header strip. Monochrome by design: no value anywhere else
// in the product is coloured, and a red "Failed" number here would be the only
// one that was.
const Stat = ({ label, value, sub, icon, onClick, active }) => (
  <div
    className="col-stat-card-new"
    onClick={onClick}
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    style={{
      minWidth: 132,
      flex: '1 1 132px',
      cursor: onClick ? 'pointer' : 'default',
      borderColor: active ? 'var(--text-primary, #111827)' : undefined,
    }}
  >
    <div className="col-stat-label-new" style={{ minHeight: 'auto', marginBottom: 6 }}>{label}</div>
    <div className="col-stat-value-new">{fmtNumber(value)}</div>
    {sub && <div className="col-stat-sub-new">{sub}</div>}
    {icon && <div className="col-stat-icon-new">{icon}</div>}
  </div>
);

const CampaignDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hasMore: false, nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [chatRecipient, setChatRecipient] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [health, setHealth] = useState(null);
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Keyset pagination. `cursor` is the row to start AFTER; `history` is the
  // stack of cursors already visited, which is what makes Previous work without
  // falling back to page numbers.
  const [cursor, setCursor] = useState(null);
  const [history, setHistory] = useState([]);

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
        mode: 'cursor',
        cursor: cursor || undefined,
        limit: PAGE_SIZE,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setRecipients(resp.data || []);
      setMeta({
        total: resp.meta?.total ?? 0,
        hasMore: Boolean(resp.meta?.has_more),
        nextCursor: resp.meta?.next_cursor || null,
      });
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load recipients'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, cursor, statusFilter, searchTerm]);

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

  // Any change to what is being listed restarts the cursor walk.
  const resetPaging = () => { setCursor(null); setHistory([]); };
  const applyFilter = (value) => { setStatusFilter(value); resetPaging(); };
  const applySearch = (e) => { e.preventDefault(); setSearchTerm(search.trim()); resetPaging(); };

  const goNext = () => {
    if (!meta.nextCursor) return;
    setHistory((h) => [...h, cursor]);
    setCursor(meta.nextCursor);
  };
  const goPrev = () => {
    setHistory((h) => {
      const next = [...h];
      const prev = next.pop() ?? null;
      setCursor(prev);
      return next;
    });
  };

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
        search: searchTerm || undefined,
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

  // A campaign sitting on SENDING that no worker is actually walking is the
  // failure mode this page previously had no way to show. Say it outright.
  const looksStalled = campaign?.status === 'SENDING'
    && !campaign?.is_sending_now
    && (campaign?.pending_count || 0) > 0;

  // How long it has been untouched. The background sweep auto-resumes anything
  // under a week and CLOSES OFF anything older rather than firing a stale
  // promotion at people; a human resuming an old one by hand is asked to
  // confirm, because the offer inside the message may have expired.
  const idleDays = campaign?.updated_at
    ? Math.floor((Date.now() - new Date(campaign.updated_at).getTime()) / 86400000)
    : 0;
  const isStaleSend = looksStalled && idleDays >= 7;

  const confirmResume = isStaleSend
    ? `This campaign has been untouched for ${idleDays} days. Resuming sends the original message to ${campaign?.pending_count} people now - check the offer inside it is still valid. Continue?`
    : null;

  const showWebhookWarning = health && health.verdict !== 'OK';
  // Memoised so the fallback array is not freshly allocated on every render.
  const failureReasons = useMemo(() => stats?.failure_reasons || [], [stats]);

  // When almost every failure shares one cause it is a campaign-level fault (a
  // dead header image, a blocked number) rather than bad luck spread across
  // recipients - and it deserves to be stated, not buried in a table column.
  const dominantFailure = useMemo(() => {
    if (!failureReasons.length || !stats?.failed) return null;
    const top = failureReasons[0];
    return top.count / stats.failed >= 0.6 ? top : null;
  }, [failureReasons, stats]);

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
                <span className={`col-badge-new ${CAMPAIGN_BADGE[campaign.status] || 'col-badge-neutral'}`} style={{ marginLeft: 10, verticalAlign: 'middle' }}>
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
                    className="col-viewall-link"
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
            <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => runAction(whatsappCampaignApi.resumeCampaign, confirmResume)} disabled={acting}>
              <PlayIcon style={{ width: 15, height: 15 }} /> Resume
            </button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(campaign?.status) && (
            <button
              className="crm-btn crm-btn-ghost crm-btn-sm"
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

      {/* ── One dominant failure cause ──
          The single most useful line on the page when a send goes wrong: it
          turns "Delivered 0, Failed 1,061" from a mystery into an instruction. */}
      {dominantFailure && (
        <div className="col-card-new" style={{ marginBottom: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 13 }}>
            <strong style={{ fontWeight: 500 }}>{fmtNumber(dominantFailure.count)} of {fmtNumber(stats.failed)} failures share one cause.</strong>
            <div style={{ color: 'var(--text-muted)', marginTop: 3 }}>{dominantFailure.reason}</div>
            {/^#131053|Media upload error/i.test(dominantFailure.reason) && (
              <div style={{ marginTop: 6 }}>
                WhatsApp could not download this campaign’s header image, so no message could be delivered.
                Re-upload the image (the Upload button now returns a permanent link, not one that expires) and
                send a fresh campaign to the people who failed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stalled-send banner ──
          The processor stops only from inside itself, so a deploy mid-blast
          leaves a campaign here with recipients still queued and no worker on
          it. The background sweep picks this up; the button is for people who
          would rather not wait. */}
      {looksStalled && (
        <div className="col-card-new" style={{ marginBottom: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0, color: 'var(--text-muted)' }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            This campaign says it is sending, but nothing is working on it right now -{' '}
            <strong style={{ fontWeight: 500 }}>{fmtNumber(campaign.pending_count)}</strong> recipient(s) have never been sent to.
            A restart during the send usually causes this.
            {isStaleSend
              ? ` It has been untouched for ${idleDays} days, so it will be closed off automatically rather than sending a stale message. Resume it only if the offer inside is still valid.`
              : ' It will be picked up automatically within 10 minutes.'}
          </div>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => runAction(whatsappCampaignApi.resumeCampaign, confirmResume)} disabled={acting}>
            <PlayIcon style={{ width: 15, height: 15 }} /> Resume now
          </button>
        </div>
      )}

      {/* ── Webhook health banner ──
          Delivered / Read / Replied come only from the provider callback. When
          it is not wired up, saying so is far more useful than a column of
          zeroes that looks like nobody opened the message. */}
      {showWebhookWarning && (
        <div className="col-card-new" style={{ marginBottom: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
          <div style={{ flex: 1, minWidth: 240, fontSize: 13 }}>
            <strong style={{ fontWeight: 500 }}>Delivery receipts are not arriving.</strong>{' '}
            <span style={{ color: 'var(--text-muted)' }}>{health.detail}</span>
            {health.callback_url && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <code style={{ fontSize: 12, background: 'var(--bg-secondary)', padding: '3px 7px', borderRadius: 6, wordBreak: 'break-all' }}>
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
        <Stat label="Recipients" value={stats?.total ?? campaign?.total_recipients ?? '-'} icon="👥" onClick={() => applyFilter('')} active={statusFilter === ''} />
        <Stat label="Sent" value={stats?.sent ?? '-'} sub="accepted by WhatsApp" icon="📤" onClick={() => applyFilter('SENT')} active={statusFilter === 'SENT'} />
        <Stat label="Delivered" value={stats?.delivered ?? '-'} icon="📬" onClick={() => applyFilter('DELIVERED')} active={statusFilter === 'DELIVERED'} />
        <Stat label="Read" value={stats?.read ?? '-'} icon="👀" onClick={() => applyFilter('READ')} active={statusFilter === 'READ'} />
        <Stat label="Replied" value={stats?.replied ?? '-'} sub={stats ? `${stats.reply_rate}% of sent` : ''} icon="💬" onClick={() => applyFilter('REPLIED')} active={statusFilter === 'REPLIED'} />
        <Stat label="No reply" value={stats?.no_reply ?? '-'} icon="🔕" onClick={() => applyFilter('NO_REPLY')} active={statusFilter === 'NO_REPLY'} />
        <Stat label="Failed" value={stats?.failed ?? '-'} icon="⚠️" onClick={() => applyFilter('FAILED')} active={statusFilter === 'FAILED'} />
        {(stats?.pending ?? 0) > 0 && (
          <Stat label="Pending" value={stats.pending} sub="not sent yet" icon="⏳" onClick={() => applyFilter('PENDING')} active={statusFilter === 'PENDING'} />
        )}
        {(stats?.skipped ?? 0) > 0 && (
          <Stat label="Skipped" value={stats.skipped} sub="stopped by cancel" icon="⏭️" onClick={() => applyFilter('SKIPPED')} active={statusFilter === 'SKIPPED'} />
        )}
      </div>

      {/* ── Failure breakdown ── */}
      {failureReasons.length > 0 && (
        <div className="col-card-new" style={{ marginBottom: 16 }}>
          <div className="col-card-header-new" style={{ fontSize: 13, fontWeight: 500 }}>Why messages failed</div>
          <div style={{ padding: '4px 0 8px' }}>
            {failureReasons.map((f) => (
              <div key={f.reason} style={{ display: 'flex', gap: 12, padding: '7px 16px', fontSize: 12, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 500, minWidth: 60 }}>{fmtNumber(f.count)}</span>
                <span style={{ color: 'var(--text-muted)' }}>{f.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="col-card-new">
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
          <table className="col-table-new" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Reply</th>
                <th>What they said</th>
                <th>Detail</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={{ textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>Loading…</td></tr>}
              {!loading && recipients.length === 0 && (
                <tr><td style={{ textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>No recipients match this filter.</td></tr>
              )}
              {!loading && recipients.map((r) => (
                <tr key={r.id}>
                  <td className="col-cell-primary">{r.lead_name || '-'}</td>
                  <td>{r.phone}</td>
                  <td>
                    <span className={`col-badge-new ${RECIPIENT_BADGE[r.status] || 'col-badge-neutral'}`}>{r.status}</span>
                  </td>
                  <td>
                    {r.replied_at ? (
                      <span>
                        {r.reply_count > 1 ? `${r.reply_count} replies` : 'Replied'}
                        <span className="col-cell-secondary" style={{ display: 'block' }}>{fmtDateTime(r.replied_at)}</span>
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  {/* The actual words. A "Replied" flag with no content is the
                      point at which people leave the report to go hunting. */}
                  <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>
                    {r.last_reply_text
                      ? <span style={{ fontStyle: 'italic' }}>“{r.last_reply_text}”</span>
                      : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                  </td>
                  <td className="col-cell-secondary" style={{ maxWidth: 260, whiteSpace: 'normal' }}>{detailFor(r)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="col-viewall-link" onClick={() => setChatRecipient(r)}>
                      Chat
                      {r.conversation_unread > 0 && (
                        <span className="col-badge-new col-badge-rejected" style={{ marginLeft: 5 }}>
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

        {/* Cursor paging: no page numbers, because with a keyset walk there is
            no cheap way to jump to "page 137" - and on a live campaign the row
            sitting at that offset shifts underneath you anyway. */}
        {(meta.hasMore || history.length > 0) && (
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fmtNumber(meta.total)} recipient(s)
              {recipients.length > 0 && ` · showing ${fmtNumber(history.length * PAGE_SIZE + 1)}-${fmtNumber(history.length * PAGE_SIZE + recipients.length)}`}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={history.length === 0} onClick={goPrev}>Previous</button>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" disabled={!meta.hasMore} onClick={goNext}>Next</button>
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
