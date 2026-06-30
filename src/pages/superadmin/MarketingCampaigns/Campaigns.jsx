import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  MegaphoneIcon, PlusIcon, ArrowPathIcon, UsersIcon, CheckCircleIcon, XCircleIcon, EyeIcon, ArrowLeftIcon,
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

const STATUS_COLORS = {
  QUEUED: { bg: '#eff6ff', fg: '#1d4ed8' },
  SENDING: { bg: '#fef9c3', fg: '#a16207' },
  COMPLETED: { bg: '#dcfce7', fg: '#166534' },
  FAILED: { bg: '#fee2e2', fg: '#991b1b' },
};
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

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

const EMPTY_FILTERS = { statusIds: [], projectIds: [], locationIds: [], stageIds: [], sourceIds: [], dateFrom: '', dateTo: '' };

const Campaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'

  // Option lists
  const [statuses, setStatuses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [templates, setTemplates] = useState([]);

  // New-campaign form
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [preview, setPreview] = useState(null); // { total, sample }
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  // Recipients drill-down
  const [drill, setDrill] = useState(null); // { campaign, recipients, statusFilter }
  const [drillLoading, setDrillLoading] = useState(false);

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
      const [st, pr, lo, sg, so, tpl] = await Promise.all([
        leadStatusApi.getAll({ limit: 100 }),
        projectApi.getAll({ limit: 100 }),
        locationApi.getAll({ limit: 100 }),
        leadStageApi.getAll({ limit: 100 }),
        leadSourceApi.getAll({ limit: 100 }),
        whatsappCampaignApi.getTemplates({ limit: 100, is_active: 'true' }),
      ]);
      setStatuses((st.data || []).map((x) => ({ value: x.id, label: x.status_name })));
      setProjects((pr.data || []).map((x) => ({ value: x.id, label: x.project_name })));
      setLocations((lo.data || []).map((x) => ({ value: x.id, label: x.location_name })));
      setStages((sg.data || []).map((x) => ({ value: x.id, label: x.stage_name })));
      setSources((so.data || []).map((x) => ({ value: x.id, label: x.source_name })));
      setTemplates(tpl.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load filter options'));
    }
  }, []);

  useEffect(() => { loadCampaigns(); loadOptions(); }, [loadCampaigns, loadOptions]);

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

  const send = async () => {
    if (!name.trim()) { toast.error('Enter a campaign name'); return; }
    if (!templateId) { toast.error('Select a template'); return; }
    const count = preview?.total;
    if (!window.confirm(`Send this campaign${count != null ? ` to ${count} matching lead(s)` : ''}? Real WhatsApp messages will be dispatched.`)) return;
    setSending(true);
    try {
      const resp = await whatsappCampaignApi.createCampaign({
        name: name.trim(), template_id: templateId, header_image_url: headerImageUrl || null, filters,
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

  const openDrill = async (campaign, statusFilter = '') => {
    setDrill({ campaign, recipients: [], statusFilter });
    setDrillLoading(true);
    try {
      const resp = await whatsappCampaignApi.getRecipients(campaign.id, { limit: 100, status: statusFilter || undefined });
      setDrill({ campaign, recipients: resp.data || [], statusFilter });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load recipients'));
    } finally {
      setDrillLoading(false);
    }
  };

  const pct = (c) => (c.total_recipients ? Math.round(((c.sent_count + c.failed_count) / c.total_recipients) * 100) : 0);

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
            <button className="crm-btn crm-btn-primary" onClick={send} disabled={sending || !name.trim() || !templateId}>{sending ? 'Queuing…' : 'Send Campaign'}</button>
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
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language_code})</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Header Image URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — overrides template/default)</span></label>
              <HeaderMediaInput value={headerImageUrl} onChange={setHeaderImageUrl} />
            </div>

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

            {/* Audience count */}
            <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13 }}>
                {preview ? (
                  <span><strong style={{ fontSize: 18 }}>{preview.total}</strong> matching recipient(s)
                    {preview.sample?.length > 0 && <span style={{ color: 'var(--text-muted)' }}> — e.g. {preview.sample.slice(0, 3).map((s) => s.name || s.phone).join(', ')}…</span>}
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
              {selectedTemplate
                ? <WhatsappPreview template={selectedTemplate} headerMediaUrl={headerImageUrl} />
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
          <h1><MegaphoneIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Marketing Campaigns</h1>
          <p className="hidden sm:block">Send approved WhatsApp templates to filtered leads and track delivery</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadCampaigns}><ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh</button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openBuilder}><PlusIcon style={{ width: 16, height: 16 }} /> New Campaign</button>
        </div>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Campaign</th>
                <th style={th}>Template</th>
                <th style={th}>Recipients</th>
                <th style={th}>Sent</th>
                <th style={th}>Failed</th>
                <th style={th}>Progress</th>
                <th style={th}>Status</th>
                <th style={th}>Created</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={9}>No campaigns yet. Create your first send-out.</td></tr>
              )}
              {campaigns.map((c) => {
                const sc = STATUS_COLORS[c.status] || STATUS_COLORS.QUEUED;
                return (
                  <tr key={c.id}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                    <td style={td}>{c.template_name || c.template?.name || '—'}</td>
                    <td style={td}><UsersIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: 'var(--text-muted)' }} /> {c.total_recipients}</td>
                    <td style={{ ...td, color: '#166534', fontWeight: 700 }}>{c.sent_count}</td>
                    <td style={{ ...td, color: c.failed_count ? '#991b1b' : 'var(--text-muted)', fontWeight: c.failed_count ? 700 : 400 }}>{c.failed_count}</td>
                    <td style={td}>
                      <div style={{ width: 90, height: 6, background: 'var(--bg-secondary)', borderRadius: 99 }}>
                        <div style={{ width: `${pct(c)}%`, height: '100%', background: '#16A34A', borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                    </td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: sc.fg, background: sc.bg, borderRadius: 999, padding: '3px 9px' }}>{c.status}</span></td>
                    <td style={td}>{fmtDateTime(c.created_at)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => openDrill(c)} title="View recipients"><EyeIcon style={{ width: 15, height: 15 }} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipients drill-down */}
      {drill && (
        <div onClick={() => setDrill(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="crm-card" style={{ width: '100%', maxWidth: 760, marginTop: 30, marginBottom: 40, padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{drill.campaign.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  <CheckCircleIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: '#16A34A' }} /> {drill.campaign.sent_count} sent
                  &nbsp;·&nbsp; <XCircleIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: '#dc2626' }} /> {drill.campaign.failed_count} failed
                  &nbsp;·&nbsp; {drill.campaign.total_recipients} total
                </div>
              </div>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setDrill(null)}>Close</button>
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
              {['', 'SENT', 'FAILED', 'PENDING'].map((s) => (
                <button key={s || 'ALL'} className={`crm-btn crm-btn-sm ${drill.statusFilter === s ? 'crm-btn-primary' : 'crm-btn-ghost'}`} onClick={() => openDrill(drill.campaign, s)}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div style={{ padding: '0 20px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Lead</th>
                    <th style={th}>Phone</th>
                    <th style={th}>Status</th>
                    <th style={th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {drillLoading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={4}>Loading…</td></tr>}
                  {!drillLoading && drill.recipients.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={4}>No recipients.</td></tr>}
                  {!drillLoading && drill.recipients.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{r.lead_name || '—'}</td>
                      <td style={td}>{r.phone}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.status === 'SENT' ? '#166534' : r.status === 'FAILED' ? '#991b1b' : '#a16207' }}>{r.status}</span>
                      </td>
                      <td style={{ ...td, color: 'var(--text-muted)', fontSize: 12, maxWidth: 280, whiteSpace: 'normal' }}>
                        {r.status === 'SENT' ? (r.provider_message_id || 'delivered to provider') : (r.error || '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Campaigns;
