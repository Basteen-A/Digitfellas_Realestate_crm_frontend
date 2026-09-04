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

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

// Canonical badge-system triples (badge-system.html / utils/badgeColors.js).
const STATUS_COLORS = {
  QUEUED: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  SENDING: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  PAUSED: { bg: '#FEFCE8', fg: '#854D0E', border: '#FEF08A' },
  COMPLETED: { bg: '#F0FDF4', fg: '#166534', border: '#BBF7D0' },
  CANCELLED: { bg: '#F3F4F6', fg: '#4B5563', border: '#E5E7EB' },
  FAILED: { bg: '#FFF1F2', fg: '#9F1239', border: '#FECDD3' },
};
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

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

const EMPTY_FILTERS = {
  statusIds: [], projectIds: [], locationIds: [], stageIds: [], sourceIds: [],
  dateFrom: '', dateTo: '', engagement: '', engagementCampaignId: '',
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
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  // Why Delivered / Read / Replied might be empty across every campaign. This
  // is provider configuration, not per-campaign data, so it is fetched once.
  const [health, setHealth] = useState(null);

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

  const copyCallbackUrl = () => {
    if (!health?.callback_url) return;
    navigator.clipboard?.writeText(health.callback_url)
      .then(() => toast.success('Callback URL copied'))
      .catch(() => toast.error('Could not copy - select and copy it manually'));
  };

  // Poll while any campaign is in flight.
  useEffect(() => {
    const inFlight = campaigns.some((c) => c.status === 'QUEUED' || c.status === 'SENDING');
    if (inFlight && !pollRef.current) {
      pollRef.current = setInterval(loadCampaigns, 4000);
    } else if (!inFlight && pollRef.current) {
      clearInterval(pollRef.current); pollRef.current = null;
    }
    return () => { if (pollRef.current && !inFlight) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [campaigns, loadCampaigns]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const toggleFilter = (key) => (val) => setFilters((f) => ({
    ...f,
    [key]: f[key].includes(val) ? f[key].filter((v) => v !== val) : [...f[key], val],
  }));

  const openBuilder = () => {
    setName(''); setTemplateId(''); setHeaderImageUrl(''); setFilters(EMPTY_FILTERS); setPreview(null);
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
    const count = preview?.total;
    if (!window.confirm(`Send this campaign${count != null ? ` to ${count} matching lead(s)` : ''}? Real WhatsApp messages will be dispatched.`)) return;
    setSending(true);
    try {
      const resp = await whatsappCampaignApi.createCampaign({
        name: name.trim(),
        template_id: templateId,
        header_image_url: headerImageUrl || null,
        ...(paramValues.header_params.length ? { header_params: paramValues.header_params } : {}),
        ...(paramValues.body_params.length ? { body_params: paramValues.body_params } : {}),
        filters,
      });
      toast.success(resp.message || 'Campaign queued');
      backToList();
      loadCampaigns();
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
  const STALE_MS = 15 * 60 * 1000;
  const looksStalled = (c) => ['QUEUED', 'SENDING'].includes(c.status)
    && c.updated_at
    && Date.now() - new Date(c.updated_at).getTime() > STALE_MS;

  // One editable variable row: {{n}} → lead field OR custom text for this campaign.
  const renderParamRow = (group, label, p, i) => (
    <div key={`${group}-${i}`} style={{ display: 'grid', gridTemplateColumns: '70px 130px 1fr', gap: 8, alignItems: 'center', marginTop: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{label}</span>
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
                  ? <span style={{ fontWeight: 800, color: '#dc2626' }}>* REQUIRED</span>
                  : <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional - overrides template/default)</span>}
              </label>
              <HeaderMediaInput value={headerImageUrl} onChange={setHeaderImageUrl} />
              {needsHeaderMedia && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span>
                    This template has a <strong>{selectedTemplate.header_type}</strong> header - you <strong>must upload a file</strong> above
                    before sending, otherwise WhatsApp will reject every message.
                  </span>
                </div>
              )}
              {/x-amz-(signature|expires|credential)/i.test(headerImageUrl || '') && !String(headerImageUrl || '').includes('sujatha-crm-uploads') && (
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#B45309', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <ExclamationTriangleIcon style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                  This is a temporary presigned link that expires within days - use the Upload button for a permanent URL.
                </div>
              )}
            </div>

            {(paramValues.header_params.length > 0 || paramValues.body_params.length > 0) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Template Variables</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 4 }}>
                  Pre-filled from the template - change the values for this campaign only. The saved template is not modified.
                </div>
                {paramValues.header_params.map((p, i) => renderParamRow('header_params', 'Header {{1}}', p, i))}
                {paramValues.body_params.map((p, i) => renderParamRow('body_params', `{{${p.index || i + 1}}}`, p, i))}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Target Leads</div>
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
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Follow-up Targeting <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></div>
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

            {/* Audience count */}
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13 }}>
                {preview ? (
                  <span><strong style={{ fontSize: 18 }}>{preview.total}</strong> matching recipient(s)
                    {preview.sample?.length > 0 && <span style={{ color: 'var(--text-muted)' }}> - e.g. {preview.sample.slice(0, 3).map((s) => s.name || s.phone).join(', ')}…</span>}
                  </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>Preview the audience before sending.</span>}
              </div>
              <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={runPreview} disabled={previewing}>{previewing ? 'Counting…' : 'Preview Recipients'}</button>
            </div>
          </div>

          {/* Live preview */}
          <div className="crm-card" style={{ padding: 0, position: 'sticky', top: 16, overflow: 'hidden' }}>
            <div style={{ background: '#075e54', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: 14 }}>Message Preview</div>
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
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: '#FEFCE8', border: '1px solid #FEF08A', display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <ExclamationTriangleIcon style={{ width: 18, height: 18, color: '#854D0E', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: '#713F12' }}>
            <strong>Delivered / Read / Replied cannot fill in.</strong> {health.detail}
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

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Campaign</th>
                <th style={th}>Template</th>
                <th style={th}>Recipients</th>
                <th style={th}>Sent</th>
                <th style={th} title="Confirmed on the phone (via provider webhook); read count in brackets">Delivered</th>
                <th style={th} title="Recipients who wrote back at least once (provider webhook)">Replied</th>
                <th style={th}>Failed</th>
                <th style={th}>Progress</th>
                <th style={th}>Status</th>
                <th style={th}>Created</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={11}>No campaigns yet. Create your first send-out.</td></tr>
              )}
              {campaigns.map((c) => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.QUEUED;
                return (
                  <tr key={c.id}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                    <td style={td}>{c.template_name || c.template?.name || '-'}</td>
                    <td style={td}><UsersIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: 'var(--text-muted)' }} /> {c.total_recipients}</td>
                    <td style={{ ...td, color: '#166534', fontWeight: 700 }}>{c.sent_count}</td>
                    <td style={{ ...td, color: c.delivered_count ? '#166534' : 'var(--text-muted)', fontWeight: c.delivered_count ? 700 : 400 }}>
                      {c.delivered_count ?? 0}{c.read_count ? ` (${c.read_count} read)` : ''}
                    </td>
                    <td style={{ ...td, color: c.replied_count ? '#0f766e' : 'var(--text-muted)', fontWeight: c.replied_count ? 700 : 400 }}>{c.replied_count ?? 0}</td>
                    <td style={{ ...td, color: c.failed_count ? '#991b1b' : 'var(--text-muted)', fontWeight: c.failed_count ? 700 : 400 }}>{c.failed_count}</td>
                    <td style={td}>
                      <div style={{ width: 90, height: 6, background: 'var(--bg-secondary)', borderRadius: 99 }}>
                        <div style={{ width: `${pct(c)}%`, height: '100%', background: '#16A34A', borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sc.fg, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 999, padding: '3px 9px' }}>{c.status}</span>
                      {looksStalled(c) && (
                        <span
                          title="Nothing has worked on this campaign for a while - open it to resume the remaining recipients."
                          style={{ display: 'block', fontSize: 11, color: '#C2410C', marginTop: 4 }}
                        >
                          <ExclamationTriangleIcon style={{ width: 12, height: 12, verticalAlign: 'text-bottom' }} /> stalled
                        </span>
                      )}
                    </td>
                    <td style={td}>{fmtDateTime(c.created_at)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
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
