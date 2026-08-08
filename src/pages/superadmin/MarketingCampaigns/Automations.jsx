// ============================================================
// SCREEN: WA Automation (Super Admin → Automation)
//
// Standing rules instead of one-off blasts:
//   "<N> days after <a lead was created | a lead entered status X>,
//    send approved template T to that lead - once."
//
// The rule is evaluated once a day at its send time. Each lead is messaged
// exactly once per automation (enforced by a unique index server-side), and
// every message carries the full WhatsApp lifecycle - SENT (accepted by the
// provider) → DELIVERED → READ, or FAILED with the provider's reason - visible
// per lead in the History drawer.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  BoltIcon, PlusIcon, ArrowPathIcon, ArrowLeftIcon, PlayIcon, PauseIcon,
  ClockIcon, TrashIcon, PencilSquareIcon, ExclamationTriangleIcon,
  CheckCircleIcon, XCircleIcon, UsersIcon, ListBulletIcon,
} from '@heroicons/react/24/outline';
import whatsappAutomationApi from '../../../api/whatsappAutomationApi';
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
const hintStyle = { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 };
const sectionTitle = { fontSize: 13, fontWeight: 800, marginBottom: 10 };

// Canonical badge-system triples (badge-system.html / utils/badgeColors.js).
const LOG_COLORS = {
  PENDING: { bg: '#F8FAFC', fg: '#475569', border: '#E2E8F0' },
  SENT: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  DELIVERED: { bg: '#F0FDF4', fg: '#166534', border: '#BBF7D0' },
  READ: { bg: '#F5F3FF', fg: '#6D28D9', border: '#DDD6FE' },
  FAILED: { bg: '#FFF1F2', fg: '#9F1239', border: '#FECDD3' },
  SKIPPED: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
};
const RUN_COLORS = {
  RUNNING: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  COMPLETED: { bg: '#F0FDF4', fg: '#166534', border: '#BBF7D0' },
  FAILED: { bg: '#FFF1F2', fg: '#9F1239', border: '#FECDD3' },
};

const Badge = ({ value, palette }) => {
  const c = palette[value] || palette.PENDING || { bg: 'var(--bg-secondary)', fg: 'var(--text-muted)', border: 'var(--border-primary)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap' }}>{value}</span>
  );
};

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const todayISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

// The rule as one plain-English sentence - what the list column shows.
const triggerSentence = (a) => {
  const when = a.offset_days === 0 ? 'Same day as' : `${a.offset_days} day${a.offset_days === 1 ? '' : 's'} after`;
  if (a.trigger_type === 'STATUS_CHANGED') {
    const status = a.trigger_status_name || a.triggerStatus?.status_name || 'a status';
    const scope = a.require_current_status ? '' : ' (ever)';
    return `${when} moving to "${status}"${scope}`;
  }
  return `${when} lead creation`;
};

// Compact scrollable checkbox multi-select (same atom the campaign builder uses).
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

const EMPTY_FILTERS = { statusIds: [], projectIds: [], locationIds: [], stageIds: [], sourceIds: [] };
const blankForm = () => ({
  id: null,
  name: '',
  description: '',
  trigger_type: 'LEAD_CREATED',
  trigger_status_id: '',
  require_current_status: true,
  offset_days: 1,
  send_time: '10:00',
  start_from: todayISO(),
  max_per_run: 200,
  template_id: '',
  header_image_url: '',
  is_active: true,
  filters: { ...EMPTY_FILTERS },
});

const Automations = () => {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'form'

  // Option lists
  const [statuses, setStatuses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leadFields, setLeadFields] = useState([]);

  // Builder
  const [form, setForm] = useState(blankForm());
  const [paramValues, setParamValues] = useState({ header_params: [], body_params: [] });
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  // History drawer
  const [history, setHistory] = useState(null); // { automation, runs, logs, statusFilter }
  const [historyLoading, setHistoryLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const loadAutomations = useCallback(async () => {
    try {
      const resp = await whatsappAutomationApi.getAll({ limit: 100 });
      setAutomations(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load automations'));
    } finally {
      setLoading(false);
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
      setStatuses((st.data || []).map((x) => ({ value: x.id, label: x.status_name, code: x.status_code })));
      setProjects((pr.data || []).map((x) => ({ value: x.id, label: x.project_name })));
      setLocations((lo.data || []).map((x) => ({ value: x.id, label: x.location_name })));
      setStages((sg.data || []).map((x) => ({ value: x.id, label: x.stage_name })));
      setSources((so.data || []).map((x) => ({ value: x.id, label: x.source_name })));
      setTemplates(tpl.data || []);
      setLeadFields(mt.data?.lead_fields || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load options'));
    }
  }, []);

  useEffect(() => { loadAutomations(); loadOptions(); }, [loadAutomations, loadOptions]);

  // While a manual run is in flight the counters move - poll until it settles.
  const pollRef = useRef(null);
  useEffect(() => {
    if (!runningId) return undefined;
    pollRef.current = setInterval(loadAutomations, 4000);
    const stop = setTimeout(() => setRunningId(null), 120000);
    return () => { clearInterval(pollRef.current); clearTimeout(stop); };
  }, [runningId, loadAutomations]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === form.template_id) || null,
    [templates, form.template_id]
  );

  // Re-seed the editable variable values whenever a different template is picked.
  const seededFor = useRef(null);
  useEffect(() => {
    if (seededFor.current === form.template_id) return;
    seededFor.current = form.template_id;
    setParamValues({
      header_params: (selectedTemplate?.header_params || []).map((p) => ({ ...p })),
      body_params: (selectedTemplate?.body_params || []).map((p) => ({ ...p })),
    });
  }, [form.template_id, selectedTemplate]);

  const updateParamValue = (group, i, key, val) => setParamValues((pv) => ({
    ...pv,
    [group]: pv[group].map((p, idx) => (idx === i ? { ...p, [key]: val } : p)),
  }));

  const previewTemplate = useMemo(() => (selectedTemplate ? {
    ...selectedTemplate,
    header_params: paramValues.header_params.length ? paramValues.header_params : selectedTemplate.header_params,
    body_params: paramValues.body_params.length ? paramValues.body_params : selectedTemplate.body_params,
  } : null), [selectedTemplate, paramValues]);

  const needsHeaderMedia = selectedTemplate
    && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(selectedTemplate.header_type)
    && !form.header_image_url
    && !selectedTemplate.sample_header_url;

  const toggleFilter = (key) => (val) => setForm((f) => ({
    ...f,
    filters: {
      ...f.filters,
      [key]: f.filters[key].includes(val) ? f.filters[key].filter((v) => v !== val) : [...f.filters[key], val],
    },
  }));

  const openBuilder = (automation = null) => {
    setPreview(null);
    if (!automation) {
      seededFor.current = null;
      setForm(blankForm());
      setParamValues({ header_params: [], body_params: [] });
    } else {
      seededFor.current = automation.template_id;
      setForm({
        id: automation.id,
        name: automation.name || '',
        description: automation.description || '',
        trigger_type: automation.trigger_type,
        trigger_status_id: automation.trigger_status_id || '',
        require_current_status: automation.require_current_status !== false,
        offset_days: automation.offset_days ?? 1,
        send_time: automation.send_time || '10:00',
        start_from: automation.start_from || '',
        max_per_run: automation.max_per_run ?? 200,
        template_id: automation.template_id || '',
        header_image_url: automation.header_image_url || '',
        is_active: automation.is_active !== false,
        filters: { ...EMPTY_FILTERS, ...(automation.filters || {}) },
      });
      const tpl = templates.find((t) => t.id === automation.template_id);
      const ov = automation.param_overrides || {};
      setParamValues({
        header_params: (ov.header_params || tpl?.header_params || []).map((p) => ({ ...p })),
        body_params: (ov.body_params || tpl?.body_params || []).map((p) => ({ ...p })),
      });
    }
    setView('form');
  };

  const runPreview = async () => {
    if (form.trigger_type === 'STATUS_CHANGED' && !form.trigger_status_id) {
      toast.error('Select the lead status this automation triggers on');
      return;
    }
    setPreviewing(true);
    try {
      const resp = await whatsappAutomationApi.preview({
        id: form.id || undefined,
        trigger_type: form.trigger_type,
        trigger_status_id: form.trigger_status_id || null,
        require_current_status: form.require_current_status,
        offset_days: Number(form.offset_days),
        start_from: form.start_from || null,
        filters: form.filters,
      });
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

  const save = async () => {
    if (!form.name.trim()) { toast.error('Enter an automation name'); return; }
    if (!form.template_id) { toast.error('Select a template'); return; }
    if (form.trigger_type === 'STATUS_CHANGED' && !form.trigger_status_id) { toast.error('Select the trigger status'); return; }
    const pErr = paramError();
    if (pErr) { toast.error(pErr); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        trigger_type: form.trigger_type,
        trigger_status_id: form.trigger_type === 'STATUS_CHANGED' ? form.trigger_status_id : null,
        require_current_status: form.require_current_status,
        offset_days: Number(form.offset_days),
        send_time: form.send_time,
        start_from: form.start_from || null,
        max_per_run: Number(form.max_per_run),
        template_id: form.template_id,
        header_image_url: form.header_image_url || null,
        is_active: form.is_active,
        filters: form.filters,
        ...(paramValues.header_params.length ? { header_params: paramValues.header_params } : {}),
        ...(paramValues.body_params.length ? { body_params: paramValues.body_params } : {}),
      };
      const resp = form.id
        ? await whatsappAutomationApi.update(form.id, payload)
        : await whatsappAutomationApi.create(payload);
      toast.success(resp.message || 'Automation saved');
      setView('list');
      loadAutomations();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save automation'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a) => {
    try {
      const resp = await whatsappAutomationApi.toggle(a.id, !a.is_active);
      toast.success(resp.message || 'Updated');
      loadAutomations();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update'));
    }
  };

  const runNow = async (a) => {
    if (!window.confirm(`Run "${a.name}" now? Real WhatsApp messages will be sent to every lead that is due (up to ${a.max_per_run}).`)) return;
    try {
      const resp = await whatsappAutomationApi.runNow(a.id);
      toast.success(resp.message || 'Run started');
      setRunningId(a.id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start run'));
    }
  };

  const removeAutomation = async (a) => {
    if (!window.confirm(`Delete "${a.name}"? Its send history is deleted with it and leads already messaged could be messaged again by a new rule.`)) return;
    try {
      await whatsappAutomationApi.remove(a.id);
      toast.success('Automation deleted');
      loadAutomations();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete'));
    }
  };

  const openHistory = async (automation, statusFilter = '') => {
    setHistory({ automation, runs: [], logs: [], statusFilter });
    setHistoryLoading(true);
    try {
      const [runsResp, logsResp, fresh] = await Promise.all([
        whatsappAutomationApi.getRuns(automation.id, { limit: 20 }),
        whatsappAutomationApi.getLogs(automation.id, { limit: 100, status: statusFilter || undefined }),
        whatsappAutomationApi.getOne(automation.id),
      ]);
      setHistory({
        automation: fresh.data || automation,
        runs: runsResp.data || [],
        logs: logsResp.data || [],
        statusFilter,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load history'));
    } finally {
      setHistoryLoading(false);
    }
  };

  // One editable variable row: {{n}} → lead field OR custom text.
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

  // ─────────────────────────── BUILDER ───────────────────────────
  if (view === 'form') {
    const approved = templates.filter((t) => t.status === 'APPROVED');
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setView('list')}><ArrowLeftIcon style={{ width: 16, height: 16 }} /> Back</button>
            <div>
              <h1 style={{ margin: 0 }}>{form.id ? 'Edit Automation' : 'New Automation'}</h1>
              <p className="hidden sm:block">Pick a trigger date, a delay and a template - the rule then runs itself every day</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="crm-btn crm-btn-ghost" onClick={() => setView('list')} disabled={saving}>Cancel</button>
            <button className="crm-btn crm-btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.template_id || needsHeaderMedia}>
              {saving ? 'Saving…' : (form.id ? 'Save Changes' : 'Create Automation')}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }} className="wa-builder-grid">
          <div style={{ display: 'grid', gap: 16 }}>
            {/* ── 1. Identity ── */}
            <div className="crm-card" style={{ padding: 20 }}>
              <div style={sectionTitle}>1. Name this automation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Automation Name *</label>
                  <input style={inputStyle} value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Day-3 follow-up nudge" />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select style={selectStyle} value={form.is_active ? 'true' : 'false'} onChange={(e) => setField('is_active', e.target.value === 'true')}>
                    <option value="true">Active - runs every day</option>
                    <option value="false">Paused - saved but never fires</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Description</label>
                <input style={inputStyle} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="What is this rule for? (optional)" />
              </div>
            </div>

            {/* ── 2. Trigger ── */}
            <div className="crm-card" style={{ padding: 20 }}>
              <div style={sectionTitle}>2. When should it send?</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Count days from *</label>
                  <select style={selectStyle} value={form.trigger_type} onChange={(e) => setField('trigger_type', e.target.value)}>
                    <option value="LEAD_CREATED">Lead creation date</option>
                    <option value="STATUS_CHANGED">Lead status update date</option>
                  </select>
                  <div style={hintStyle}>
                    {form.trigger_type === 'LEAD_CREATED'
                      ? 'The date the lead was added to the CRM.'
                      : 'The date the lead moved into the status you pick below.'}
                  </div>
                </div>

                {form.trigger_type === 'STATUS_CHANGED' && (
                  <div>
                    <label style={labelStyle}>Lead status *</label>
                    <select style={selectStyle} value={form.trigger_status_id} onChange={(e) => setField('trigger_status_id', e.target.value)}>
                      <option value="">Select a status…</option>
                      {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {form.trigger_type === 'STATUS_CHANGED' && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Which leads count?</label>
                  <select style={selectStyle} value={form.require_current_status ? 'true' : 'false'} onChange={(e) => setField('require_current_status', e.target.value === 'true')}>
                    <option value="true">Only leads still in this status</option>
                    <option value="false">Any lead that ever entered this status, even if it moved on</option>
                  </select>
                  <div style={hintStyle}>
                    {form.require_current_status
                      ? 'A lead that moves on before the delay elapses is never messaged - use this for nudges that stop being relevant.'
                      : 'Counts from the FIRST time the lead entered the status. Use this for thank-you messages that stay relevant after the lead progresses.'}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={labelStyle}>Days after *</label>
                  <input type="number" min={0} max={365} style={inputStyle} value={form.offset_days} onChange={(e) => setField('offset_days', e.target.value)} />
                  <div style={hintStyle}>0 = the same day.</div>
                </div>
                <div>
                  <label style={labelStyle}>Send at *</label>
                  <input type="time" style={inputStyle} value={form.send_time} onChange={(e) => setField('send_time', e.target.value)} />
                  <div style={hintStyle}>Runs once a day at this time.</div>
                </div>
                <div>
                  <label style={labelStyle}>Ignore trigger dates before</label>
                  <input type="date" style={inputStyle} value={form.start_from || ''} onChange={(e) => setField('start_from', e.target.value)} />
                  <div style={hintStyle}>Stops the first run back-blasting old leads.</div>
                </div>
                <div>
                  <label style={labelStyle}>Max messages per run</label>
                  <input type="number" min={1} max={2000} style={inputStyle} value={form.max_per_run} onChange={(e) => setField('max_per_run', e.target.value)} />
                  <div style={hintStyle}>Leftovers roll into the next day.</div>
                </div>
              </div>

              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', fontSize: 13 }}>
                <strong>Rule:</strong>{' '}
                {triggerSentence({
                  offset_days: Number(form.offset_days) || 0,
                  trigger_type: form.trigger_type,
                  trigger_status_name: statuses.find((s) => s.value === form.trigger_status_id)?.label,
                  require_current_status: form.require_current_status,
                })}
                , send at {form.send_time}. Each lead receives this message once.
              </div>

              {!form.start_from && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: 12, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ExclamationTriangleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span>No start date set - the first run will reach every historical lead whose trigger date already qualifies. Preview the audience below before saving.</span>
                </div>
              )}
            </div>

            {/* ── 3. Message ── */}
            <div className="crm-card" style={{ padding: 20 }}>
              <div style={sectionTitle}>3. What should it send?</div>
              <div>
                <label style={labelStyle}>Approved Template *</label>
                <select style={selectStyle} value={form.template_id} onChange={(e) => setField('template_id', e.target.value)}>
                  <option value="">Select a template…</option>
                  {approved.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language_code}){t.header_type !== 'NONE' ? ` - ${t.header_type} header` : ''}
                    </option>
                  ))}
                </select>
                {templates.length > 0 && approved.length === 0 && (
                  <div style={{ fontSize: 11, color: '#991b1b', marginTop: 4 }}>
                    No approved templates available. Create or sync templates on the Templates screen first - only APPROVED templates can be automated.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>
                  Header {selectedTemplate?.header_type || 'Image'} {needsHeaderMedia
                    ? <span style={{ fontWeight: 800, color: '#dc2626' }}>* REQUIRED</span>
                    : <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional - overrides template/default)</span>}
                </label>
                <HeaderMediaInput value={form.header_image_url} onChange={(v) => setField('header_image_url', v)} />
                {needsHeaderMedia && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                    <span>
                      This template has a <strong>{selectedTemplate.header_type}</strong> header - you <strong>must upload a file</strong> above,
                      otherwise WhatsApp will reject every message this rule sends.
                    </span>
                  </div>
                )}
              </div>

              {(paramValues.header_params.length > 0 || paramValues.body_params.length > 0) && (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-primary)' }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Template Variables</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, marginBottom: 4 }}>
                    Pre-filled from the template - change the values for this automation only. The saved template is not modified.
                  </div>
                  {paramValues.header_params.map((p, i) => renderParamRow('header_params', 'Header {{1}}', p, i))}
                  {paramValues.body_params.map((p, i) => renderParamRow('body_params', `{{${p.index || i + 1}}}`, p, i))}
                </div>
              )}
            </div>

            {/* ── 4. Audience ── */}
            <div className="crm-card" style={{ padding: 20 }}>
              <div style={sectionTitle}>4. Narrow the audience (optional)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <MultiCheck label="Status" options={statuses} selected={form.filters.statusIds} onToggle={toggleFilter('statusIds')} />
                <MultiCheck label="Project" options={projects} selected={form.filters.projectIds} onToggle={toggleFilter('projectIds')} />
                <MultiCheck label="Location" options={locations} selected={form.filters.locationIds} onToggle={toggleFilter('locationIds')} />
                <MultiCheck label="Stage" options={stages} selected={form.filters.stageIds} onToggle={toggleFilter('stageIds')} />
                <MultiCheck label="Source" options={sources} selected={form.filters.sourceIds} onToggle={toggleFilter('sourceIds')} />
              </div>
              <div style={hintStyle}>
                No filter = every lead matching the trigger. Leads with no valid phone number are skipped automatically and never retried.
              </div>

              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13 }}>
                  {preview ? (
                    <span>
                      <strong style={{ fontSize: 18 }}>{preview.total}</strong> lead(s) already qualify
                      {preview.outstanding != null && (
                        <span style={{ color: 'var(--text-muted)' }}> · {preview.outstanding} not yet messaged</span>
                      )}
                      {preview.sample?.length > 0 && (
                        <span style={{ color: 'var(--text-muted)' }}> - e.g. {preview.sample.slice(0, 3).map((s) => s.name || s.phone).join(', ')}…</span>
                      )}
                    </span>
                  ) : <span style={{ color: 'var(--text-muted)' }}>Check how many leads this rule reaches before saving.</span>}
                </div>
                <button className="crm-btn crm-btn-secondary crm-btn-sm" onClick={runPreview} disabled={previewing}>
                  {previewing ? 'Counting…' : 'Preview Audience'}
                </button>
              </div>
              {preview?.sample?.length > 0 && (
                <div style={{ marginTop: 10, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Lead</th><th style={th}>Phone</th><th style={th}>Trigger date</th></tr></thead>
                    <tbody>
                      {preview.sample.map((s) => (
                        <tr key={s.id}>
                          <td style={td}>{s.name || '-'}</td>
                          <td style={td}>{s.phone}</td>
                          <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtDate(s.anchor_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="crm-card" style={{ padding: 0, position: 'sticky', top: 16, overflow: 'hidden' }}>
            <div style={{ background: '#075e54', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: 14 }}>Message Preview</div>
            <div style={{ padding: 12 }}>
              {previewTemplate
                ? <WhatsappPreview template={previewTemplate} headerMediaUrl={form.header_image_url} />
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
          <h1><BoltIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />WA Automation</h1>
          <p className="hidden sm:block">Send an approved WhatsApp template a set number of days after a lead is created or changes status</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadAutomations}><ArrowPathIcon style={{ width: 15, height: 15 }} /> Refresh</button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => openBuilder()}><PlusIcon style={{ width: 16, height: 16 }} /> New Automation</button>
        </div>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
            <thead>
              <tr>
                <th style={th}>Automation</th>
                <th style={th}>Trigger</th>
                <th style={th}>Template</th>
                <th style={th}>Sent</th>
                <th style={th} title="Confirmed on the phone (via provider webhook); read count in brackets">Delivered</th>
                <th style={th}>Failed</th>
                <th style={th}>Last run</th>
                <th style={th}>Next run</th>
                <th style={th}>State</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>Loading…</td></tr>}
              {!loading && automations.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>
                  No automations yet. Create one to start sending scheduled WhatsApp follow-ups.
                </td></tr>
              )}
              {!loading && automations.map((a) => (
                <tr key={a.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    {a.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.description}</div>}
                    {a.last_error && (
                      <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2, maxWidth: 260, whiteSpace: 'normal' }}>
                        <ExclamationTriangleIcon style={{ width: 12, height: 12, verticalAlign: 'text-bottom' }} /> {a.last_error}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, maxWidth: 220, whiteSpace: 'normal' }}>
                    {triggerSentence(a)}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>daily at {a.send_time}</div>
                  </td>
                  <td style={td}>{a.template_name || a.template?.name || '-'}</td>
                  <td style={{ ...td, color: a.sent_count ? '#166534' : 'var(--text-muted)', fontWeight: a.sent_count ? 700 : 400 }}>{a.sent_count}</td>
                  <td style={{ ...td, color: a.delivered_count ? '#166534' : 'var(--text-muted)', fontWeight: a.delivered_count ? 700 : 400 }}>
                    {a.delivered_count ?? 0}{a.read_count ? ` (${a.read_count} read)` : ''}
                  </td>
                  <td style={{ ...td, color: a.failed_count ? '#991b1b' : 'var(--text-muted)', fontWeight: a.failed_count ? 700 : 400 }}>{a.failed_count}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(a.last_run_at)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: a.is_active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {a.is_active ? <><ClockIcon style={{ width: 12, height: 12, verticalAlign: 'text-bottom' }} /> {fmtDateTime(a.next_run_at)}</> : 'Paused'}
                  </td>
                  <td style={td}>
                    <Badge value={a.is_active ? 'ACTIVE' : 'PAUSED'} palette={{ ACTIVE: LOG_COLORS.DELIVERED, PAUSED: LOG_COLORS.SKIPPED }} />
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" title="Send history" onClick={() => openHistory(a)}>
                      <ListBulletIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" title="Run now" onClick={() => runNow(a)}>
                      <PlayIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" title={a.is_active ? 'Pause' : 'Resume'} onClick={() => toggleActive(a)}>
                      {a.is_active ? <PauseIcon style={{ width: 14, height: 14 }} /> : <PlayIcon style={{ width: 14, height: 14, color: '#166534' }} />}
                    </button>
                    <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" title="Edit" onClick={() => openBuilder(a)}>
                      <PencilSquareIcon style={{ width: 14, height: 14 }} />
                    </button>
                    <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" title="Delete" onClick={() => removeAutomation(a)}>
                      <TrashIcon style={{ width: 14, height: 14, color: '#dc2626' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        Each lead is messaged only once per automation. <strong>Sent</strong> means the provider accepted the message;
        <strong> Delivered</strong>, <strong>Read</strong> and post-acceptance <strong>Failed</strong> arrive on the provider webhook -
        set the callback URL in the pinbot panel to keep these columns live.
      </div>

      {/* ── History drawer: runs + per-lead delivery log ── */}
      {history && (
        <div onClick={() => setHistory(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="crm-card" style={{ width: '100%', maxWidth: 900, marginTop: 30, marginBottom: 40, padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{history.automation.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {triggerSentence(history.automation)} · daily at {history.automation.send_time}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  <UsersIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom' }} /> {history.automation.total_matched} matched
                  &nbsp;·&nbsp; <CheckCircleIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: '#16A34A' }} /> {history.automation.sent_count} sent
                  &nbsp;·&nbsp; {history.automation.delivered_count ?? 0} delivered
                  &nbsp;·&nbsp; {history.automation.read_count ?? 0} read
                  &nbsp;·&nbsp; <XCircleIcon style={{ width: 13, height: 13, verticalAlign: 'text-bottom', color: '#dc2626' }} /> {history.automation.failed_count} failed
                </div>
              </div>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setHistory(null)}>Close</button>
            </div>

            {/* Runs */}
            <div style={{ padding: '14px 20px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Recent runs</div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Started</th>
                      <th style={th}>Source</th>
                      <th style={th}>Matched</th>
                      <th style={th}>Sent</th>
                      <th style={th}>Failed</th>
                      <th style={th}>Skipped</th>
                      <th style={th}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.runs.length === 0 && (
                      <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>No runs yet.</td></tr>
                    )}
                    {history.runs.map((r) => (
                      <tr key={r.id}>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(r.started_at || r.created_at)}</td>
                        <td style={td}>{r.triggered_by === 'MANUAL' ? 'Run now' : 'Schedule'}</td>
                        <td style={td}>{r.matched_count}</td>
                        <td style={{ ...td, color: '#166534' }}>{r.sent_count}</td>
                        <td style={{ ...td, color: r.failed_count ? '#991b1b' : 'var(--text-muted)' }}>{r.failed_count}</td>
                        <td style={{ ...td, color: 'var(--text-muted)' }}>{r.skipped_count}</td>
                        <td style={td}>
                          <Badge value={r.status} palette={RUN_COLORS} />
                          {r.error && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 3, whiteSpace: 'normal', maxWidth: 240 }}>{r.error}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per-lead delivery log */}
            <div style={{ padding: '16px 20px 4px', borderTop: '1px solid var(--border-primary)', marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Messages</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING', 'SKIPPED'].map((s) => (
                  <button
                    key={s || 'ALL'}
                    className={`crm-btn crm-btn-sm ${history.statusFilter === s ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
                    onClick={() => openHistory(history.automation, s)}
                  >
                    {s || 'All'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '0 20px 20px', maxHeight: '45vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Lead</th>
                    <th style={th}>Phone</th>
                    <th style={th}>Trigger date</th>
                    <th style={th}>Sent</th>
                    <th style={th}>Status</th>
                    <th style={th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>Loading…</td></tr>}
                  {!historyLoading && history.logs.length === 0 && (
                    <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>No messages.</td></tr>
                  )}
                  {!historyLoading && history.logs.map((l) => {
                    let detail = l.error || '-';
                    if (l.status === 'SENT') detail = 'Accepted by WhatsApp - awaiting delivery receipt';
                    else if (l.status === 'DELIVERED') detail = `Delivered${l.delivered_at ? ` ${fmtDateTime(l.delivered_at)}` : ''}`;
                    else if (l.status === 'READ') detail = `Read${l.read_at ? ` ${fmtDateTime(l.read_at)}` : ''}`;
                    else if (l.status === 'PENDING') detail = 'Queued - not yet dispatched';
                    return (
                      <tr key={l.id}>
                        <td style={td}>{l.lead_name || '-'}</td>
                        <td style={td}>{l.phone}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDate(l.anchor_at)}</td>
                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{fmtDateTime(l.sent_at)}</td>
                        <td style={td}><Badge value={l.status} palette={LOG_COLORS} /></td>
                        <td style={{ ...td, color: 'var(--text-muted)', fontSize: 12, maxWidth: 260, whiteSpace: 'normal' }}>{detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automations;
