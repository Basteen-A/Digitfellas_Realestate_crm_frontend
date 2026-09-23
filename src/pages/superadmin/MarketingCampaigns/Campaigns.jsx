import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  MegaphoneIcon, PlusIcon, ArrowPathIcon, UsersIcon, ArrowLeftIcon,
  ExclamationTriangleIcon, ChatBubbleLeftRightIcon, ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import leadStatusApi from '../../../api/leadStatusApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadStageApi from '../../../api/leadStageApi';
import leadSourceApi from '../../../api/leadSourceApi';
import { getErrorMessage } from '../../../utils/helpers';
import HeaderMediaInput from './HeaderMediaInput';
import WhatsappPreview from './WhatsappPreview';
import { EMPTY_PARAMS } from './TemplateMessageFields';
// The automatic-follow-up form is shared verbatim with the campaign report's
// own scheduler, so the two can never ask for the rule differently.
import FollowupRuleFields, { EMPTY_RULE, followupRuleError, followupRulePayload } from './FollowupRuleFields';
import '../../portals/collection/CollectionWorkspace.css';

const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

// Canonical badge-system triples (badge-system.html / utils/badgeColors.js).
// Colour lives only inside badges, per the app-wide convention.
const STATUS_BADGE = {
  BUILDING: 'col-badge-new-status',
  QUEUED: 'col-badge-new-status',
  SENDING: 'col-badge-unverified',
  // Waiting for the next batch window or tomorrow's quota. Deliberately NOT
  // styled like PAUSED: PAUSED means a person has to do something, SCHEDULED
  // means the system will, and an admin who confuses the two waits forever.
  SCHEDULED: 'col-badge-unverified',
  PAUSED: 'col-badge-pending',
  COMPLETED: 'col-badge-verified',
  CANCELLED: 'col-badge-neutral',
  FAILED: 'col-badge-rejected',
};

// What the status actually means, in the tooltip - the words alone do not
// distinguish "waiting for quota" from "waiting for you".
const STATUS_HINT = {
  BUILDING: 'Working out who this campaign goes to. Sending starts automatically when it finishes.',
  QUEUED: 'Waiting for a sender to pick it up - usually seconds.',
  SENDING: 'Messages are going out right now.',
  SCHEDULED: 'Part-sent. The rest goes out automatically when the daily limit resets or the next batch is due.',
  PAUSED: 'Stopped by an administrator. It will not continue until somebody resumes it.',
  COMPLETED: 'Every recipient has been sent to.',
  CANCELLED: 'Stopped for good - unsent recipients were skipped.',
  FAILED: 'Could not be sent. Check the reason on the campaign.',
};
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
// Audiences are five and six figures now, so grouped digits are the difference
// between reading a number and counting its zeroes.
const fmtNum = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('en-IN'));

// Compact scrollable checkbox multi-select.
const MultiCheck = ({ label, options, selected, onToggle }) => (
  <div>
    <label style={labelStyle}>{label} {selected.length > 0 && <span style={{ color: 'var(--primary, #2563eb)' }}>({selected.length})</span>}</label>
    <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 8, background: 'var(--bg-primary)' }}>
      {options.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</div>}
      {options.map((o) => (
        <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '3px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  </div>
);

// Re-target an earlier campaign by how people reacted to it. Mirrors
// ENGAGEMENT_CLAUSES in server/src/utils/leadAudienceFilter.js - keep the
// values identical or the server silently ignores the filter.
const ENGAGEMENT_OPTIONS = [
  { value: '', label: 'No engagement filter' },
  { value: 'REPLIED', label: 'Replied to the campaign' },
  { value: 'NO_REPLY', label: 'Got it but never replied' },
  { value: 'READ', label: 'Read it' },
  { value: 'DELIVERED', label: 'Received it (delivered)' },
  { value: 'NOT_DELIVERED', label: 'Sent but never delivered' },
  { value: 'FAILED', label: 'Delivery failed' },
];

// The mirror image of the engagement filter: leave OUT the people an earlier
// campaign already reached. Mirrors EXCLUDE_CLAUSES in
// server/src/utils/leadAudienceFilter.js - keep the values identical or the
// server silently falls back to SENT.
const EXCLUDE_MODE_OPTIONS = [
  { value: 'SENT', label: 'Who actually received it', hint: 'Anyone WhatsApp accepted a message for. People whose message failed stay in - they never got anything.' },
  { value: 'TARGETED', label: 'Anyone it was aimed at', hint: 'Everyone on that campaign’s list, including messages that failed and any still queued.' },
];

const EMPTY_FILTERS = {
  statusIds: [], projectIds: [], locationIds: [], stageIds: [], sourceIds: [],
  dateFrom: '', dateTo: '', engagement: '', engagementCampaignId: '',
  // "Send to these leads EXCEPT the ones campaign X already reached."
  excludeCampaignIds: [], excludeMode: 'SENT',
};

const Campaigns = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'

  // Option lists
  const [statuses, setStatuses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leadFields, setLeadFields] = useState([]);

  // New-campaign form
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  // Per-campaign variable values - pre-filled from the selected template,
  // editable here without touching the template itself.
  const [paramValues, setParamValues] = useState({ header_params: [], body_params: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [preview, setPreview] = useState(null); // { total, sample }

  // The automatic second touch, set up in the same breath as the blast. Off by
  // default - it sends real messages a day later, so it is always a decision
  // somebody made, never one they inherited from a default.
  const [followupOn, setFollowupOn] = useState(false);
  const [followupRule, setFollowupRule] = useState(EMPTY_RULE);
  const [followupParams, setFollowupParams] = useState(EMPTY_PARAMS);
  const [followupMeta, setFollowupMeta] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  // Why Delivered / Read / Replied might be empty across every campaign. This
  // is provider configuration, not per-campaign data, so it is fetched once.
  const [health, setHealth] = useState(null);

  // Today's allowance against the configured daily limit. Shown BEFORE a blast
  // is launched: discovering half way through a 40,000-recipient send that the
  // day only had 12,000 left in it is a fact worth having up front.
  const [limits, setLimits] = useState(null);

  const pollRef = useRef(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const resp = await whatsappCampaignApi.getCampaigns({ limit: 100 });
      setCampaigns(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load campaigns'));
    }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [st, pr, lo, sg, so, tpl, mt] = await Promise.all([
        leadStatusApi.getAll({ limit: 100 }),
        projectApi.getAll({ limit: 100 }),
        locationApi.getAll({ limit: 100 }),
        leadStageApi.getAll({ limit: 100 }),
        leadSourceApi.getAll({ limit: 100 }),
        whatsappCampaignApi.getTemplates({ limit: 100, is_active: 'true' }),
        whatsappCampaignApi.getTemplateMeta(),
      ]);
      // The follow-up audience list is served by the engine that runs the rule -
      // never hardcoded here. A failure just leaves the picker on its defaults.
      whatsappCampaignApi.getFollowupMeta().then((r) => setFollowupMeta(r.data)).catch(() => {});
      setStatuses((st.data || []).map((x) => ({ value: x.id, label: x.status_name })));
      setProjects((pr.data || []).map((x) => ({ value: x.id, label: x.project_name })));
      setLocations((lo.data || []).map((x) => ({ value: x.id, label: x.location_name })));
      setStages((sg.data || []).map((x) => ({ value: x.id, label: x.stage_name })));
      setSources((so.data || []).map((x) => ({ value: x.id, label: x.source_name })));
      setTemplates(tpl.data || []);
      setLeadFields(mt.data?.lead_fields || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load filter options'));
    }
  }, []);

  useEffect(() => { loadCampaigns(); loadOptions(); }, [loadCampaigns, loadOptions]);

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

  const loadLimits = useCallback(async () => {
    try {
      const resp = await whatsappCampaignApi.getSendingLimits();
      setLimits(resp.data);
    } catch {
      /* the quota strip simply does not render */
    }
  }, []);
  useEffect(() => { loadLimits(); }, [loadLimits]);

  const copyCallbackUrl = () => {
    if (!health?.callback_url) return;
    navigator.clipboard?.writeText(health.callback_url)
      .then(() => toast.success('Callback URL copied'))
      .catch(() => toast.error('Could not copy - select and copy it manually'));
  };

  // Poll while any campaign is in flight.
  useEffect(() => {
    // SCHEDULED and BUILDING are in flight as far as the screen is concerned:
    // one is assembling its audience and the other is waiting on a clock, and
    // both change without anybody touching them.
    const inFlight = campaigns.some((c) => ['QUEUED', 'SENDING', 'BUILDING', 'SCHEDULED'].includes(c.status));
    if (inFlight && !pollRef.current) {
      pollRef.current = setInterval(() => { loadCampaigns(); loadLimits(); }, 4000);
    } else if (!inFlight && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current && !inFlight) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [campaigns, loadCampaigns, loadLimits]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const toggleFilter = (key) => (val) => setFilters((f) => ({
    ...f,
    [key]: f[key].includes(val) ? f[key].filter((v) => v !== val) : [...f[key], val],
  }));

  const openBuilder = () => {
    setName(''); setTemplateId(''); setHeaderImageUrl(''); setFilters(EMPTY_FILTERS); setPreview(null);
    setFollowupOn(false); setFollowupRule(EMPTY_RULE); setFollowupParams(EMPTY_PARAMS);
    setView('form');
  };
  const backToList = () => setView('list');

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId]);

  // Re-seed the editable variable values every time a template is picked.
  useEffect(() => {
    setParamValues({
      header_params: (selectedTemplate?.header_params || []).map((p) => ({ ...p })),
      body_params: (selectedTemplate?.body_params || []).map((p) => ({ ...p })),
    });
  }, [selectedTemplate]);

  const updateParamValue = (group, i, key, val) => setParamValues((pv) => ({
    ...pv,
    [group]: pv[group].map((p, idx) => (idx === i ? { ...p, [key]: val } : p)),
  }));

  // The preview substitutes the campaign's edited values, not the template's.
  const previewTemplate = useMemo(() => (selectedTemplate ? {
    ...selectedTemplate,
    header_params: paramValues.header_params.length ? paramValues.header_params : selectedTemplate.header_params,
    body_params: paramValues.body_params.length ? paramValues.body_params : selectedTemplate.body_params,
  } : null), [selectedTemplate, paramValues]);

  // True when the selected template has a media header and NO image URL is set anywhere.
  const needsHeaderMedia = selectedTemplate
    && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(selectedTemplate.header_type)
    && !headerImageUrl
    && !selectedTemplate.sample_header_url;

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const resp = await whatsappCampaignApi.previewRecipients(filters);
      setPreview(resp.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Preview failed'));
    } finally {
      setPreviewing(false);
    }
  };

  // Every variable must resolve - WhatsApp rejects messages with empty params.
  const paramError = () => {
    const bad = (p, label) => {
      if (p.source === 'lead_field' && !p.field) return `${label} is mapped to a lead field - select the field.`;
      if (p.source !== 'lead_field' && !String(p.value || '').trim()) return `${label} is set to custom text - enter a value.`;
      return null;
    };
    for (const p of paramValues.header_params) { const e = bad(p, 'Header variable {{1}}'); if (e) return e; }
    for (let i = 0; i < paramValues.body_params.length; i += 1) {
      const e = bad(paramValues.body_params[i], `Variable {{${paramValues.body_params[i].index || i + 1}}}`);
      if (e) return e;
    }
    return null;
  };

  const send = async () => {
    if (!name.trim()) { toast.error('Enter a campaign name'); return; }
    if (!templateId) { toast.error('Select a template'); return; }
    const pErr = paramError();
    if (pErr) { toast.error(pErr); return; }
    // The follow-up is refused on the same screen it was written on. The server
    // checks it again before queueing anyone, so a rule can never be half-saved
    // behind a blast that already went out.
    if (followupOn) {
      const fErr = followupRuleError(followupRule, templates, followupParams, { requireName: false });
      if (fErr) { toast.error(fErr); return; }
    }
    const count = preview?.total;
    const chase = followupOn ? ' A follow-up will be scheduled at the same time.' : '';
    // Spell out the multi-day plan in the confirmation. Somebody who thinks
    // they are sending one blast today should not discover on Thursday that it
    // is still going out.
    const plan = preview?.plan && preview.plan.batches > 1
      ? ` It will go out in ${preview.plan.batches} batches of up to ${fmtNum(preview.plan.batch_size)}`
        + (preview.plan.estimated_days > 1 ? ` over about ${preview.plan.estimated_days} days, continuing automatically.` : ', all today.')
      : '';
    if (!window.confirm(`Send this campaign${count != null ? ` to ${fmtNum(count)} matching lead(s)` : ''}? Real WhatsApp messages will be dispatched.${plan}${chase}`)) return;
    setSending(true);
    try {
      const resp = await whatsappCampaignApi.createCampaign({
        name: name.trim(),
        template_id: templateId,
        header_image_url: headerImageUrl || null,
        ...(paramValues.header_params.length ? { header_params: paramValues.header_params } : {}),
        ...(paramValues.body_params.length ? { body_params: paramValues.body_params } : {}),
        filters,
        ...(followupOn ? { followup: { enabled: true, ...followupRulePayload(followupRule, followupParams) } } : {}),
      });
      toast.success(resp.message || 'Campaign queued');
      backToList();
      loadCampaigns();
      loadLimits();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create campaign'));
    } finally {
      setSending(false);
    }
  };

  const pct = (c) => (c.total_recipients ? Math.round(((c.sent_count + c.failed_count) / c.total_recipients) * 100) : 0);

  // A campaign left on SENDING by a restart looks identical to one that is
  // actively working. The give-away is that the row has not been written to in
  // a while - the processor touches it every batch. Flagging it here is what
  // stopped a July blast from sitting half-sent for eight weeks unnoticed.
  //
  // SCHEDULED is deliberately absent: a campaign waiting for tomorrow's quota
  // has not been touched for hours BY DESIGN, and flagging that as stalled
  // would cry wolf on every multi-day campaign in the list.
  const STALE_MS = 15 * 60 * 1000;
  const looksStalled = (c) => ['QUEUED', 'SENDING'].includes(c.status)
    && c.updated_at
    && Date.now() - new Date(c.updated_at).getTime() > STALE_MS;

  // One editable variable row: {{n}} → lead field OR custom text for this campaign.
  const renderParamRow = (group, label, p, i) => (
    <div key={`${group}-${i}`} style={{ display: 'grid', gridTemplateColumns: '70px 130px 1fr', gap: 8, alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      <select style={selectStyle} value={p.source === 'lead_field' ? 'lead_field' : 'static'} onChange={(e) => updateParamValue(group, i, 'source', e.target.value)}>
        <option value="lead_field">Lead field</option>
        <option value="static">Custom text</option>
      </select>
      {p.source === 'lead_field' ? (
        <select style={selectStyle} value={p.field || ''} onChange={(e) => updateParamValue(group, i, 'field', e.target.value)}>
          <option value="">Select field…</option>
          {leadFields.map((lf) => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
        </select>
      ) : (
        <input style={inputStyle} value={p.value || ''} onChange={(e) => updateParamValue(group, i, 'value', e.target.value)} placeholder="Text sent to every recipient" />
      )}
    </div>
  );

  // ─────────────────────────── BUILDER (full page) ───────────────────────────
  if (view === 'form') {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={backToList}><ArrowLeftIcon style={{ width: 16, height: 16 }} /> Back</button>
            <div>
              <h1 style={{ margin: 0 }}>New Campaign</h1>
              <p className="hidden sm:block">Pick a template, target your audience and preview before sending</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="crm-btn crm-btn-ghost" onClick={backToList} disabled={sending}>Cancel</button>
            <button className="crm-btn crm-btn-primary" onClick={send} disabled={sending || !name.trim() || !templateId || needsHeaderMedia}>{sending ? 'Queuing…' : 'Send Campaign'}</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }} className="wa-builder-grid">
          {/* Form */}
          <div className="crm-card" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Campaign Name *</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. June Offer Blast" />
              </div>
              <div>
                <label style={labelStyle}>Template *</label>
                <select style={selectStyle} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Select a template…</option>
                  {templates.filter((t) => t.status === 'APPROVED').map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language_code}){t.header_type !== 'NONE' ? ` - ${t.header_type} header` : ''}
                    </option>
                  ))}
                </select>
                {templates.length > 0 && templates.filter((t) => t.status === 'APPROVED').length === 0 && (
                  <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>No approved templates available. Sync or create templates first.</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>
                Header {selectedTemplate?.header_type || 'Image'} {needsHeaderMedia
                  ? <span style={{ fontWeight: 500, color: '#dc2626' }}>* REQUIRED</span>
                  : <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional - overrides template/default)</span>}
              </label>
              <HeaderMediaInput value={headerImageUrl} onChange={setHeaderImageUrl} />
              {needsHeaderMedia && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span>
                    This template has a <strong>{selectedTemplate.header_type}</strong> header - you <strong>must upload a file</strong> above
                    before sending, otherwise WhatsApp will reject every message.
                  </span>
                </div>
              )}
              {/x-amz-(signature|expires|credential)/i.test(headerImageUrl || '') && !String(headerImageUrl || '').includes('sujatha-crm-uploads') && (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: '#B45309', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <ExclamationTriangleIcon style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                  This is a temporary presigned link that expires within days - use the Upload button for a permanent URL.
                </div>
              )}
            </div>

            {(paramValues.header_params.length > 0 || paramValues.body_params.length > 0) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Template Variables</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 4 }}>
                  Pre-filled from the template - change the values for this campaign only. The saved template is not modified.
                </div>
                {paramValues.header_params.map((p, i) => renderParamRow('header_params', 'Header {{1}}', p, i))}
                {paramValues.body_params.map((p, i) => renderParamRow('body_params', `{{${p.index || i + 1}}}`, p, i))}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Target Leads</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <MultiCheck label="Status" options={statuses} selected={filters.statusIds} onToggle={toggleFilter('statusIds')} />
                <MultiCheck label="Project" options={projects} selected={filters.projectIds} onToggle={toggleFilter('projectIds')} />
                <MultiCheck label="Location" options={locations} selected={filters.locationIds} onToggle={toggleFilter('locationIds')} />
                <MultiCheck label="Stage" options={stages} selected={filters.stageIds} onToggle={toggleFilter('stageIds')} />
                <MultiCheck label="Source" options={sources} selected={filters.sourceIds} onToggle={toggleFilter('sourceIds')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={labelStyle}>Created From</label>
                  <input type="date" style={inputStyle} value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Created To</label>
                  <input type="date" style={inputStyle} value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>No filter = all leads with a phone number. Leads with no valid phone are skipped automatically.</div>
            </div>

            {/* Follow-up targeting: re-run against how people reacted to an
                earlier blast. Reply data only exists once the provider webhook
                is configured, which is what the hint below is warning about. */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Follow-up Targeting <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Narrow the audience above to how leads reacted to an earlier WhatsApp campaign - e.g. chase everyone who
                received the last blast but never wrote back.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Reaction</label>
                  <select
                    style={selectStyle}
                    value={filters.engagement}
                    onChange={(e) => setFilters((f) => ({ ...f, engagement: e.target.value }))}
                  >
                    {ENGAGEMENT_OPTIONS.map((o) => <option key={o.value || 'none'} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>In campaign</label>
                  <select
                    style={selectStyle}
                    value={filters.engagementCampaignId}
                    onChange={(e) => setFilters((f) => ({ ...f, engagementCampaignId: e.target.value }))}
                    disabled={!filters.engagement}
                  >
                    <option value="">Any campaign</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              {filters.engagement === 'REPLIED' && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Tip: people who replied are inside the 24-hour window, so you can also just answer them directly from the WhatsApp Inbox.
                </div>
              )}
            </div>

            {/* ── Exclude an earlier campaign's audience ──
                The complement of the block above, and the one that makes
                repeat blasts safe: "everyone matching these filters EXCEPT the
                people the last campaign already reached". Without it the only
                way to avoid re-messaging somebody was to reconstruct a
                mutually-exclusive filter by hand and hope it was right. */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                Exclude People Already Messaged <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Leave out anyone an earlier campaign already reached, so a repeat blast only goes to people who have not had it.
                Opted-out numbers and duplicates are always removed, whether or not you pick anything here.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <MultiCheck
                  label="Don't send to people from"
                  options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
                  selected={filters.excludeCampaignIds}
                  onToggle={toggleFilter('excludeCampaignIds')}
                />
                <div>
                  <label style={labelStyle}>Count them as messaged if</label>
                  <select
                    style={selectStyle}
                    value={filters.excludeMode}
                    onChange={(e) => setFilters((f) => ({ ...f, excludeMode: e.target.value }))}
                    disabled={!filters.excludeCampaignIds.length}
                  >
                    {EXCLUDE_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    {EXCLUDE_MODE_OPTIONS.find((o) => o.value === filters.excludeMode)?.hint}
                  </div>
                </div>
              </div>
              {filters.excludeCampaignIds.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Excluding {filters.excludeCampaignIds.length} campaign{filters.excludeCampaignIds.length > 1 ? 's' : ''} -
                  press Preview to see what the audience comes to.
                </div>
              )}
            </div>

            {/* ── Automatic follow-up ──
                Deliberately sits right under Follow-up Targeting, because the
                two are opposite directions in time and are otherwise easy to
                confuse: the block above narrows THIS audience by how people
                reacted to an EARLIER blast; this one schedules the chase on
                THIS blast, before it has gone out. Setting it up here is the
                point - the moment an admin is actually thinking about the
                second touch is while they are writing the first. */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={followupOn}
                  onChange={(e) => setFollowupOn(e.target.checked)}
                  style={{ width: 15, height: 15, marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
                />
                <span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Schedule an automatic follow-up <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Chase the people this blast reaches but who never write back - automatically, a set time after they got it.
                    It runs by itself; you do not have to come back to the report.
                  </span>
                </span>
              </label>

              {followupOn && (
                <div style={{ marginTop: 14 }}>
                  <FollowupRuleFields
                    rule={followupRule}
                    onChange={setFollowupRule}
                    params={followupParams}
                    onParamsChange={setFollowupParams}
                    templates={templates}
                    audiences={followupMeta?.audiences || []}
                    anchors={followupMeta?.anchors || []}
                    showName={false}
                    stackMessage
                    subjectName={name.trim() || 'this campaign'}
                    countsHint="Group sizes appear on the campaign report once the blast has been sent."
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                    The follow-up waits for this campaign to finish sending before it counts anybody - it will never chase a
                    half-delivered blast. You can pause, re-run or delete it from this campaign's report at any time.
                  </div>
                </div>
              )}
            </div>

            {/* Audience count + how the send would be split.
                The batch arithmetic comes from the SERVER, not from a
                calculation here: it is the same arithmetic the sender uses, and
                a second copy in the UI would eventually disagree with the thing
                actually doing the work. */}
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}>
                  {preview ? (
                    <span><strong style={{ fontSize: 18 }}>{fmtNum(preview.total)}</strong> matching recipient(s)
                      {preview.sample?.length > 0 && <span style={{ color: 'var(--text-muted)' }}> - e.g. {preview.sample.slice(0, 3).map((s) => s.name || s.phone).join(', ')}…</span>}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>Preview the audience before sending.</span>}
                </div>
                <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={runPreview} disabled={previewing}>{previewing ? 'Counting…' : 'Preview Recipients'}</button>
              </div>

              {preview?.plan && preview.total > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-primary)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {preview.plan.batches > 1 ? (
                    <>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                        Goes out in {preview.plan.batches} batches of up to {fmtNum(preview.plan.batch_size)}.
                      </div>
                      <div>
                        {fmtNum(preview.plan.sends_today)} today ({fmtNum(preview.plan.remaining_today)} of the {fmtNum(preview.plan.daily_limit)} daily limit is still free),
                        {preview.plan.estimated_days > 1
                          ? ` the rest over the following ${preview.plan.estimated_days - 1} day(s) - automatically, with no action from you.`
                          : ' all of it today.'}
                      </div>
                    </>
                  ) : (
                    <div>Fits in a single batch. {fmtNum(preview.plan.remaining_today)} of today's {fmtNum(preview.plan.daily_limit)} limit is still free.</div>
                  )}
                  {!preview.plan.window_open && (
                    <div style={{ marginTop: 4, color: '#B45309' }}>
                      Sending is outside the configured hours right now - the first batch starts at {fmtDateTime(preview.plan.next_send_at)}.
                    </div>
                  )}
                  <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    The final count is usually a little lower: opted-out numbers, duplicates and unusable numbers are dropped while the audience is built.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="crm-card" style={{ padding: 0, position: 'sticky', top: 16, overflow: 'hidden' }}>
            <div style={{ background: '#075e54', color: '#fff', padding: '12px 16px', fontWeight: 500, fontSize: 14 }}>Message Preview</div>
            <div style={{ padding: 12 }}>
              {previewTemplate
                ? <WhatsappPreview template={previewTemplate} headerMediaUrl={headerImageUrl} />
                : <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 8px', textAlign: 'center' }}>Select a template to preview the message.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────── LIST ───────────────────────────
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><MegaphoneIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />WhatsApp Campaigns</h1>
          <p className="hidden sm:block">Send approved WhatsApp templates to filtered leads and track delivery</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadCampaigns}><ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh</button>
          <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => navigate('/super-admin/whatsapp-inbox')}>
            <ChatBubbleLeftRightIcon style={{ width: 15, height: 15 }} /> Inbox
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openBuilder}><PlusIcon style={{ width: 16, height: 16 }} /> New Campaign</button>
        </div>
      </div>

      {/* Delivered / Read / Replied come ONLY from the provider callback. When
          it is not wired up, every one of those columns reads zero - which is
          indistinguishable from "nobody opened it" unless we say so here. */}
      {health && health.verdict !== 'OK' && (
        <div className="col-card-new" style={{ marginBottom: 14, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 240, fontSize: 13 }}>
            <strong style={{ fontWeight: 500 }}>Delivered / Read / Replied cannot fill in.</strong>{' '}
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

      {/* ── Today's sending allowance ──
          WhatsApp caps how much can go out in a day, and that cap is shared by
          every campaign. Showing it here turns "why has my campaign stopped?"
          into something the screen already answered. */}
      {limits && (
        <div className="col-card-new" style={{ marginBottom: 14, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13 }}>
              <strong style={{ fontWeight: 500 }}>{fmtNum(limits.used)}</strong>
              <span style={{ color: 'var(--text-muted)' }}> of {fmtNum(limits.limit)} messages sent today</span>
              {limits.queued_messages > 0 && (
                <span style={{ color: 'var(--text-muted)' }}> · {fmtNum(limits.queued_messages)} still queued across live campaigns</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {limits.remaining <= 0
                ? `Daily limit reached - sending resumes ${fmtDateTime(limits.resets_at)}`
                : !limits.window_open
                  ? `Outside the ${String(limits.window_start).padStart(2, '0')}:00-${String(limits.window_end).padStart(2, '0')}:00 sending window - resumes ${fmtDateTime(limits.next_send_at)}`
                  : `${fmtNum(limits.remaining)} left · batches of up to ${fmtNum(limits.batch_size)}`}
            </div>
          </div>
          <div style={{ marginTop: 8, height: 6, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.round((limits.used / Math.max(1, limits.limit)) * 100))}%`,
                height: '100%',
                background: limits.remaining <= 0 ? '#B45309' : 'var(--text-primary, #111827)',
                borderRadius: 99,
                transition: 'width 0.4s',
              }}
            />
          </div>
        </div>
      )}

      <div className="col-card-new">
        <div style={{ overflowX: 'auto' }}>
          <table className="col-table-new" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Template</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th title="Confirmed on the phone (via provider webhook); read count in brackets">Delivered</th>
                <th title="Recipients who wrote back at least once (provider webhook)">Replied</th>
                <th>Failed</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr><td style={{ textAlign: 'center', color: 'var(--text-muted)' }} colSpan={11}>No campaigns yet. Create your first send-out.</td></tr>
              )}
              {campaigns.map((c) => {
                const badge = STATUS_BADGE[c.status] || 'col-badge-neutral';
                return (
                  <tr key={c.id}>
                    <td className="col-cell-primary">{c.name}</td>
                    <td>{c.template_name || c.template?.name || '-'}</td>
                    <td>
                      <UsersIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: 'var(--text-muted)' }} /> {fmtNum(c.total_recipients)}
                      {c.batch_count > 1 && (
                        <span className="col-cell-secondary" style={{ display: 'block' }}>
                          {c.batch_count} batches of {fmtNum(c.batch_size)}
                        </span>
                      )}
                    </td>
                    <td className="col-cell-primary">{fmtNum(c.sent_count)}</td>
                    <td className={c.delivered_count ? 'col-cell-primary' : undefined} style={c.delivered_count ? undefined : { color: 'var(--text-muted)' }}>
                      {c.delivered_count ?? 0}{c.read_count ? ` (${c.read_count} read)` : ''}
                    </td>
                    <td className={c.replied_count ? 'col-cell-primary' : undefined} style={c.replied_count ? undefined : { color: 'var(--text-muted)' }}>{c.replied_count ?? 0}</td>
                    <td className={c.failed_count ? 'col-cell-primary' : undefined} style={c.failed_count ? undefined : { color: 'var(--text-muted)' }}>{c.failed_count}</td>
                    <td>
                      <div style={{ width: 90, height: 6, background: 'var(--bg-secondary)', borderRadius: 99 }}>
                        <div style={{ width: `${pct(c)}%`, height: '100%', background: 'var(--text-primary, #111827)', borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                    </td>
                    <td style={td}>
                      <span className={`col-badge-new ${badge}`} title={STATUS_HINT[c.status] || ''}>{c.status}</span>
                      {/* A part-sent campaign has to say when it continues.
                          "SCHEDULED" with no time on it reads as broken, and
                          the first thing an admin does with a campaign that
                          looks broken is send it again. */}
                      {c.status === 'SCHEDULED' && (
                        <span className="col-cell-secondary" style={{ display: 'block', marginTop: 4 }} title={c.throttle_reason || ''}>
                          {c.next_batch_at ? `continues ${fmtDateTime(c.next_batch_at)}` : 'continues automatically'}
                        </span>
                      )}
                      {c.status === 'BUILDING' && (
                        <span className="col-cell-secondary" style={{ display: 'block', marginTop: 4 }}>
                          finding recipients…
                        </span>
                      )}
                      {looksStalled(c) && (
                        <span
                          className="col-cell-secondary"
                          title="Nothing has worked on this campaign for a while - open it to resume the remaining recipients."
                          style={{ display: 'block', marginTop: 4 }}
                        >
                          <ExclamationTriangleIcon style={{ width: 12, height: 12, verticalAlign: 'text-bottom' }} /> stalled
                        </span>
                      )}
                    </td>
                    <td>{fmtDateTime(c.created_at)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="view-link"
                        onClick={() => navigate(`/super-admin/marketing-campaigns/${c.id}`)}
                        title="Open the campaign report"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Campaigns;
