import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon, PlusIcon, TrashIcon, PencilSquareIcon, ArrowPathIcon,
  ArrowLeftIcon, XMarkIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';
import HeaderMediaInput from './HeaderMediaInput';
import WhatsappPreview from './WhatsappPreview';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const TEMPLATE_NAME_RE = /^[a-z0-9_]+$/;
const TEMPLATE_NAME_MSG = 'Template name can only contain lowercase alphanumeric characters and underscores ( _ ). No other characters or white space are allowed.';
const STATUS_OPTIONS = ['APPROVED', 'PENDING', 'REJECTED'];
const BUTTON_LABELS = { QUICK_REPLY: 'Quick reply', URL: 'Visit website (URL)', PHONE_NUMBER: 'Call phone number' };

const EMPTY = {
  name: '', language_code: 'en', category: '', header_type: 'NONE', header_text: '',
  sample_header_url: '', body_text: '', body_params: [], footer_text: '', buttons: [], is_active: true,
};
const EMPTY_FILTERS = { search: '', category: '', header_type: '', language_code: '', status: '' };

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const statusBadge = (status) => {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED') return { bg: '#dcfce7', fg: '#166534', label: 'Approved' };
  if (s === 'PENDING') return { bg: '#fef9c3', fg: '#a16207', label: 'Pending' };
  if (s === 'REJECTED') return { bg: '#fee2e2', fg: '#991b1b', label: 'Rejected' };
  return { bg: 'var(--bg-secondary)', fg: 'var(--text-muted)', label: s || '—' };
};
const qualityColor = (q) => {
  const s = String(q || '').toUpperCase();
  if (s === 'GREEN' || s === 'HIGH') return { bg: '#dcfce7', fg: '#166534' };
  if (s === 'YELLOW' || s === 'MEDIUM') return { bg: '#fef9c3', fg: '#a16207' };
  if (s === 'RED' || s === 'LOW') return { bg: '#fee2e2', fg: '#991b1b' };
  return { bg: '#eff6ff', fg: '#1d4ed8' };
};
const placeholdersLabel = (t) => {
  const list = Array.isArray(t.body_params) ? t.body_params.map((p) => p.index) : [];
  return list.length ? list.join(', ') : '';
};

const Templates = () => {
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({
    lead_fields: [], header_types: ['NONE', 'IMAGE', 'TEXT', 'DOCUMENT', 'VIDEO'],
    categories: ['MARKETING', 'UTILITY', 'AUTHENTICATION'], button_types: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'],
  });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const load = useCallback(async (f = EMPTY_FILTERS) => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (f.search) params.search = f.search;
      if (f.category) params.category = f.category;
      if (f.header_type) params.header_type = f.header_type;
      if (f.language_code) params.language_code = f.language_code;
      if (f.status) params.status = f.status;
      const resp = await whatsappCampaignApi.getTemplates(params);
      setTemplates(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load templates'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const resp = await whatsappCampaignApi.getTemplateMeta();
      if (resp.data) setMeta((m) => ({ ...m, ...resp.data }));
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);

  // Distinct languages present, for the filter dropdown.
  const languageOptions = useMemo(
    () => Array.from(new Set(templates.map((t) => t.language_code).filter(Boolean))).sort(),
    [templates]
  );

  const openCreate = () => { setEditing(null); setForm(EMPTY); setView('form'); };
  const openEdit = (t) => {
    setEditing(t.id);
    setForm({
      name: t.name || '', language_code: t.language_code || 'en', category: (t.category || '').toUpperCase(),
      header_type: t.header_type || 'NONE', header_text: t.header_text || '', sample_header_url: t.sample_header_url || '',
      body_text: t.body_text || '', body_params: Array.isArray(t.body_params) ? t.body_params : [],
      footer_text: t.footer_text || '', buttons: Array.isArray(t.buttons) ? t.buttons : [], is_active: t.is_active !== false,
    });
    setView('form');
  };
  const backToList = () => { setView('list'); setEditing(null); setForm(EMPTY); };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── body_params editing ──
  const addParam = () => setForm((f) => ({
    ...f,
    body_params: [...f.body_params, { index: f.body_params.length + 1, label: `{{${f.body_params.length + 1}}}`, source: 'lead_field', field: 'first_name', value: '' }],
  }));
  const removeParam = (i) => setForm((f) => ({
    ...f,
    body_params: f.body_params.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, index: idx + 1, label: `{{${idx + 1}}}` })),
  }));
  const updateParam = (i, key, val) => setForm((f) => ({
    ...f,
    body_params: f.body_params.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)),
  }));

  // ── buttons editing ──
  const addButton = () => setForm((f) => (f.buttons.length >= 3 ? f : { ...f, buttons: [...f.buttons, { type: 'QUICK_REPLY', text: '', url: '', phone_number: '' }] }));
  const removeButton = (i) => setForm((f) => ({ ...f, buttons: f.buttons.filter((_, idx) => idx !== i) }));
  const updateButton = (i, key, val) => setForm((f) => ({ ...f, buttons: f.buttons.map((b, idx) => (idx === i ? { ...b, [key]: val } : b)) }));

  const nameInvalid = form.name.length > 0 && !TEMPLATE_NAME_RE.test(form.name);
  const canSave = form.name.trim() && !nameInvalid && form.category && !saving;

  const save = async () => {
    if (!form.name.trim()) { toast.error('Template name is required'); return; }
    if (nameInvalid) { toast.error(TEMPLATE_NAME_MSG); return; }
    if (!form.category) { toast.error('Select a category'); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) await whatsappCampaignApi.updateTemplate(editing, payload);
      else await whatsappCampaignApi.createTemplate(payload);
      toast.success(editing ? 'Template updated' : 'Template created');
      backToList();
      load(filters);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save template'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await whatsappCampaignApi.deleteTemplate(t.id);
      toast.success('Template deleted');
      load(filters);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete template'));
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const resp = await whatsappCampaignApi.syncTemplates();
      toast.success(resp.message || 'Synced from provider');
      load(filters);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Provider sync not available'));
    } finally {
      setSyncing(false);
    }
  };

  const isMediaHeader = ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(form.header_type);

  // ─────────────────────────── BUILDER (full page) ───────────────────────────
  if (view === 'form') {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
        <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="page-header-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={backToList}><ArrowLeftIcon style={{ width: 16, height: 16 }} /> Back</button>
            <div>
              <h1 style={{ margin: 0 }}>{editing ? 'Edit WhatsApp Template' : 'WhatsApp Template Form'}</h1>
              <p className="hidden sm:block">Build the template exactly as approved on the provider, then map placeholders to lead fields</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="crm-btn crm-btn-ghost" onClick={backToList} disabled={saving}>Cancel</button>
            <button className="crm-btn crm-btn-primary" onClick={save} disabled={!canSave}>{saving ? 'Saving…' : (editing ? 'Update Template' : 'Save Template')}</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16, alignItems: 'start' }} className="wa-builder-grid">
          {/* Form */}
          <div className="crm-card" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Template name *</label>
                <input
                  style={{ ...inputStyle, borderColor: nameInvalid ? '#fca5a5' : undefined }}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase() }))}
                  placeholder="enter_template_name"
                />
                {nameInvalid && <div style={{ color: '#dc2626', fontSize: 11.5, marginTop: 5, lineHeight: 1.4 }}>{TEMPLATE_NAME_MSG}</div>}
              </div>
              <div>
                <label style={labelStyle}>Language *</label>
                <input style={inputStyle} value={form.language_code} onChange={setField('language_code')} placeholder="en" />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Category *</label>
              <select style={{ ...selectStyle, borderColor: !form.category ? '#fca5a5' : undefined }} value={form.category} onChange={setField('category')}>
                <option value="">-- Select --</option>
                {meta.categories.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>

            {/* Header */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Header <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>optional</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Add a title or choose which type of media you'll use for this header.</div>
              <label style={labelStyle}>Template type</label>
              <select style={selectStyle} value={form.header_type} onChange={setField('header_type')}>
                {meta.header_types.map((h) => <option key={h} value={h}>{h === 'NONE' ? 'None' : h.charAt(0) + h.slice(1).toLowerCase()}</option>)}
              </select>
              {form.header_type === 'TEXT' && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Header Text</label>
                  <input style={inputStyle} value={form.header_text} onChange={setField('header_text')} placeholder="Header text" maxLength={60} />
                </div>
              )}
              {isMediaHeader && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Default Header Media URL</label>
                  <HeaderMediaInput value={form.sample_header_url} onChange={(url) => setForm((f) => ({ ...f, sample_header_url: url }))} />
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Body *</div>
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={addParam}><PlusIcon style={{ width: 14, height: 14 }} /> Add placeholder</button>
              </div>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                value={form.body_text}
                onChange={setField('body_text')}
                placeholder="Hi {{1}}, your update for {{2}} is ready."
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Formatting: *bold*, _italic_, ~strikethrough~. Use {'{{1}}'}, {'{{2}}'} … for placeholders.</div>

              {form.body_params.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ ...labelStyle, marginBottom: 4 }}>Placeholder mapping</label>
                  {form.body_params.map((p, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '46px 110px 1fr 32px', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{`{{${p.index}}}`}</span>
                      <select style={selectStyle} value={p.source} onChange={(e) => updateParam(i, 'source', e.target.value)}>
                        <option value="lead_field">Lead field</option>
                        <option value="static">Static text</option>
                      </select>
                      {p.source === 'lead_field' ? (
                        <select style={selectStyle} value={p.field} onChange={(e) => updateParam(i, 'field', e.target.value)}>
                          <option value="">Select field…</option>
                          {meta.lead_fields.map((lf) => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
                        </select>
                      ) : (
                        <input style={inputStyle} value={p.value} onChange={(e) => updateParam(i, 'value', e.target.value)} placeholder="Static value" />
                      )}
                      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => removeParam(i)} style={{ color: '#dc2626' }}><TrashIcon style={{ width: 14, height: 14 }} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
              <label style={labelStyle}>Footer <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(optional)</span></label>
              <input style={inputStyle} value={form.footer_text} onChange={setField('footer_text')} placeholder="e.g. Reply STOP to opt out" maxLength={60} />
            </div>

            {/* Buttons */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Buttons <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(optional, up to 3)</span></label>
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={addButton} disabled={form.buttons.length >= 3}><PlusIcon style={{ width: 14, height: 14 }} /> Add button</button>
              </div>
              {form.buttons.map((b, i) => (
                <div key={i} style={{ marginTop: 10, padding: 10, border: '1px solid var(--border-primary)', borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
                    <select style={selectStyle} value={b.type} onChange={(e) => updateButton(i, 'type', e.target.value)}>
                      {meta.button_types.map((bt) => <option key={bt} value={bt}>{BUTTON_LABELS[bt] || bt}</option>)}
                    </select>
                    <input style={inputStyle} value={b.text} onChange={(e) => updateButton(i, 'text', e.target.value)} placeholder="Button text" maxLength={25} />
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => removeButton(i)} style={{ color: '#dc2626' }}><TrashIcon style={{ width: 14, height: 14 }} /></button>
                  </div>
                  {b.type === 'URL' && (
                    <input style={{ ...inputStyle, marginTop: 8 }} value={b.url} onChange={(e) => updateButton(i, 'url', e.target.value)} placeholder="https://example.com/offer" />
                  )}
                  {b.type === 'PHONE_NUMBER' && (
                    <input style={{ ...inputStyle, marginTop: 8 }} value={b.phone_number} onChange={(e) => updateButton(i, 'phone_number', e.target.value)} placeholder="+91 98765 43210" />
                  )}
                </div>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Active (available for campaigns)
            </label>
          </div>

          {/* Live preview */}
          <div className="crm-card" style={{ padding: 0, position: 'sticky', top: 16, overflow: 'hidden' }}>
            <div style={{ background: '#075e54', color: '#fff', padding: '12px 16px', fontWeight: 800, fontSize: 14 }}>Message Preview</div>
            <div style={{ padding: 12 }}>
              <WhatsappPreview template={form} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────── LIST + FILTERS + REPORT ───────────────────────────
  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><DocumentTextIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />WhatsApp Templates</h1>
          <p className="hidden sm:block">Register your approved templates and map their placeholders to lead fields</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={sync} disabled={syncing}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {syncing ? 'Syncing…' : 'Sync Templates'}
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openCreate}>
            <PlusIcon style={{ width: 16, height: 16 }} /> Add new WhatsApp template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="crm-card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--primary, #2563eb)', fontWeight: 800, fontSize: 14 }}>
          <FunnelIcon style={{ width: 16, height: 16 }} /> Filters
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle}>Template name</label>
            <input style={inputStyle} value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Enter template name" onKeyDown={(e) => e.key === 'Enter' && load(filters)} />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={selectStyle} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
              <option value="">All</option>
              {meta.categories.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={selectStyle} value={filters.header_type} onChange={(e) => setFilters((f) => ({ ...f, header_type: e.target.value }))}>
              <option value="">All</option>
              {meta.header_types.map((h) => <option key={h} value={h}>{h === 'NONE' ? 'None' : h.charAt(0) + h.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Language</label>
            <select style={selectStyle} value={filters.language_code} onChange={(e) => setFilters((f) => ({ ...f, language_code: e.target.value }))}>
              <option value="">All</option>
              {languageOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={selectStyle} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusBadge(s).label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => load(filters)}>Search</button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => { setFilters(EMPTY_FILTERS); load(EMPTY_FILTERS); }}>Reset</button>
        </div>
      </div>

      {/* Report */}
      <div className="crm-card">
        <div style={{ padding: '14px 16px', fontWeight: 800, fontSize: 15, color: 'var(--primary, #2563eb)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border-primary)' }}>
          <DocumentTextIcon style={{ width: 18, height: 18 }} /> WhatsApp Template Report
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                <th style={th}>Sr.No</th>
                <th style={th}>Template ID</th>
                <th style={th}>Template name</th>
                <th style={th}>Quality score</th>
                <th style={th}>Preview</th>
                <th style={th}>Category</th>
                <th style={th}>Language</th>
                <th style={th}>Date/Time</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>Loading…</td></tr>}
              {!loading && templates.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>No templates yet. Add your approved templates here.</td></tr>
              )}
              {!loading && templates.map((t, i) => {
                const sb = statusBadge(t.status);
                const qc = qualityColor(t.quality_rating);
                const ph = placeholdersLabel(t);
                return (
                  <tr key={t.id}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.provider_template_id || '—'}</code></td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      {ph && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Placeholders: {ph}</div>}
                    </td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: qc.fg, background: qc.bg, borderRadius: 6, padding: '3px 9px' }}>{(t.quality_rating || 'NA').toUpperCase()}</span></td>
                    <td style={td}>
                      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setPreviewTemplate(t)} style={{ color: 'var(--primary, #2563eb)' }}>Preview</button>
                    </td>
                    <td style={td}>{t.category ? (t.category.charAt(0) + t.category.slice(1).toLowerCase()) : '—'}</td>
                    <td style={td}>{t.language_code}</td>
                    <td style={td}>{fmtDateTime(t.created_at)}</td>
                    <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: sb.fg, background: sb.bg, borderRadius: 999, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{sb.label}</span></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => openEdit(t)} title="Edit"><PencilSquareIcon style={{ width: 15, height: 15 }} /></button>
                      <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => remove(t)} title="Delete" style={{ color: '#dc2626' }}><TrashIcon style={{ width: 15, height: 15 }} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <div onClick={() => setPreviewTemplate(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="crm-card" style={{ width: '100%', maxWidth: 420, margin: '20px auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{previewTemplate.name}</h2>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setPreviewTemplate(null)}><XMarkIcon style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: 14, overflowY: 'auto' }}>
              <WhatsappPreview template={previewTemplate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
