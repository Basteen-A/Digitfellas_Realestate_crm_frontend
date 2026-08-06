import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon, PlusIcon, TrashIcon, PencilSquareIcon, ArrowPathIcon,
  ArrowLeftIcon, XMarkIcon, FunnelIcon, FaceSmileIcon, ExclamationTriangleIcon,
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
const LANGUAGES = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'zh_CN', name: 'Chinese (CHN)' },
  { code: 'zh_HK', name: 'Chinese (HKG)' },
  { code: 'zh_TW', name: 'Chinese (TAI)' },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'en_GB', name: 'English (UK)' },
  { code: 'en_US', name: 'English (US)' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt_BR', name: 'Portuguese (BR)' },
  { code: 'pt_PT', name: 'Portuguese (PT)' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'es', name: 'Spanish' },
  { code: 'es_LA', name: 'Spanish (LA)' },
  { code: 'sv', name: 'Swedish' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
];
const BUTTON_LABELS = { QUICK_REPLY: 'Quick reply', URL: 'Visit website (URL)', PHONE_NUMBER: 'Call phone number', COPY_CODE: 'Copy code (coupon)' };
const PLACEHOLDER_RE = /\{\{\s*\d+\s*\}\}/;

const EMPTY = {
  name: '', language_code: 'en', category: '', sub_category: 'custom', header_type: 'NONE', header_text: '',
  header_params: [], sample_header_url: '', body_text: '', body_params: [], footer_text: '', buttons: [], is_active: true,
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
    categories: ['MARKETING', 'UTILITY', 'AUTHENTICATION'], button_types: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'],
    max_buttons: 10,
  });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showEmojis, setShowEmojis] = useState(false);

  const insertFormatting = (before, after = '') => {
    const textarea = document.getElementById('template-body-textarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.body_text;
    const selected = text.slice(start, end);
    const replacement = before + selected + after;
    const newValue = text.slice(0, start) + replacement + text.slice(end);
    setForm((f) => ({ ...f, body_text: newValue }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

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
      header_type: t.header_type || 'NONE', header_text: t.header_text || '',
      header_params: Array.isArray(t.header_params) ? t.header_params : [],
      sample_header_url: t.sample_header_url || '',
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

  // ── header {{1}} mapping ──
  // Keep the single header param row in lock-step with a {{1}} in the header text.
  const setHeaderText = (e) => {
    const text = e.target.value;
    setForm((f) => ({
      ...f,
      header_text: text,
      header_params: PLACEHOLDER_RE.test(text)
        ? (f.header_params.length ? f.header_params : [{ index: 1, label: '{{1}}', source: 'lead_field', field: 'first_name', value: '' }])
        : [],
    }));
  };
  const updateHeaderParam = (key, val) => setForm((f) => ({
    ...f,
    header_params: f.header_params.map((p, idx) => (idx === 0 ? { ...p, [key]: val } : p)),
  }));

  // ── buttons editing ──
  const maxButtons = meta.max_buttons || 10;
  const addButton = () => setForm((f) => (f.buttons.length >= maxButtons ? f : { ...f, buttons: [...f.buttons, { type: 'QUICK_REPLY', text: '', url: '', phone_number: '', coupon_code: '' }] }));
  const removeButton = (i) => setForm((f) => ({ ...f, buttons: f.buttons.filter((_, idx) => idx !== i) }));
  const updateButton = (i, key, val) => setForm((f) => ({
    ...f,
    buttons: f.buttons.map((b, idx) => {
      if (idx !== i) return b;
      const next = { ...b, [key]: val };
      // A dynamic {{1}} URL needs a suffix mapping; drop it when the URL is static again.
      if (key === 'url') {
        if (PLACEHOLDER_RE.test(val) && !next.url_param) next.url_param = { source: 'lead_field', field: 'lead_number', value: '' };
        if (!PLACEHOLDER_RE.test(val)) delete next.url_param;
      }
      return next;
    }),
  }));
  const updateButtonUrlParam = (i, key, val) => setForm((f) => ({
    ...f,
    buttons: f.buttons.map((b, idx) => (idx === i ? { ...b, url_param: { ...(b.url_param || {}), [key]: val } } : b)),
  }));

  const nameInvalid = form.name.length > 0 && !TEMPLATE_NAME_RE.test(form.name);
  const canSave = form.name.trim() && !nameInvalid && form.category && !saving;

  const validateTemplateForm = (f) => {
    if (!f.name.trim()) return 'Template name is required';
    if (!TEMPLATE_NAME_RE.test(f.name.trim())) return TEMPLATE_NAME_MSG;
    if (f.name.trim().length > 512) return 'Template name cannot exceed 512 characters';
    
    if (!f.language_code.trim()) return 'Language code is required';
    if (!/^[a-zA-Z_]{2,10}$/.test(f.language_code.trim())) return 'Language code must contain only letters and underscores (e.g. en, en_US)';
    
    if (!f.category) return 'Template category is required';
    
    if (!f.body_text.trim()) return 'Template body text is required';
    if (f.body_text.length > 1024) return 'Template body text cannot exceed 1024 characters';

    // Validate body placeholders and mapping
    const matches = [...f.body_text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
    const indices = matches.map(m => parseInt(m[1], 10));
    const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b);
    const N = uniqueIndices.length;

    for (let i = 0; i < N; i++) {
      if (uniqueIndices[i] !== i + 1) {
        return `Placeholders in body text must be sequential starting from 1 (found {{${uniqueIndices[i]}}}, but expected {{${i + 1}}})`;
      }
    }

    const bodyParams = f.body_params || [];
    if (bodyParams.length !== N) {
      return `Template body has ${N} placeholder(s), but ${bodyParams.length} mapping(s) were configured`;
    }

    for (let i = 0; i < bodyParams.length; i++) {
      const p = bodyParams[i];
      const idx = i + 1;
      if (p.source === 'lead_field') {
        if (!p.field) return `Placeholder {{${idx}}} is mapped to lead field, but no field is selected`;
      } else if (p.source === 'static') {
        if (p.value === undefined || p.value === null || String(p.value).trim() === '') {
          return `Placeholder {{${idx}}} is mapped to static text, but the value is empty`;
        }
      } else {
        return `Placeholder {{${idx}}} mapping source is invalid`;
      }
    }

    // Header validation
    const headerType = f.header_type || 'NONE';
    if (headerType === 'TEXT') {
      if (!f.header_text.trim()) return 'Header text is required when template type is Text';
      if (f.header_text.length > 60) return 'Header text cannot exceed 60 characters';
      const headerVars = [...f.header_text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => m[1]);
      if (headerVars.length > 1) return 'Header text can contain at most one placeholder ({{1}})';
      if (headerVars.length === 1 && headerVars[0] !== '1') return 'The header placeholder must be {{1}}';
      if (headerVars.length === 1) {
        const hp = (f.header_params || [])[0];
        if (!hp) return 'Header has a {{1}} placeholder — configure its mapping';
        if (hp.source === 'lead_field' && !hp.field) return 'Header placeholder is mapped to lead field, but no field is selected';
        if (hp.source === 'static' && !String(hp.value || '').trim()) return 'Header placeholder is mapped to static text, but the value is empty';
      }
    } else if (['IMAGE', 'DOCUMENT', 'VIDEO', 'LOCATION', 'CAROUSEL'].includes(headerType)) {
      if (['LOCATION', 'CAROUSEL'].includes(headerType)) {
        return 'Location and Carousel media types are not supported yet';
      }
      if (!f.sample_header_url || !f.sample_header_url.trim()) {
        return `Sample header URL/media is required for media header type ${headerType.toLowerCase()}`;
      }
      if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(f.sample_header_url.trim())) {
        return 'Sample header media must be a valid http:// or https:// URL';
      }
    }

    // Footer validation
    if (f.footer_text && f.footer_text.trim().length > 60) {
      return 'Footer text cannot exceed 60 characters';
    }

    // Buttons validation (provider limits: 10 mixed; max 2 URL, 1 phone, 1 coupon)
    const buttons = f.buttons || [];
    const btnMax = meta.max_buttons || 10;
    if (buttons.length > btnMax) return `Templates cannot contain more than ${btnMax} buttons`;

    const seenTexts = new Set();
    const counts = { URL: 0, PHONE_NUMBER: 0, COPY_CODE: 0 };
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (b.type in counts) counts[b.type] += 1;
      if (!b.text.trim()) return `Button ${i + 1} text is required`;
      const cleanText = b.text.trim();
      if (cleanText.length > 25) return `Button ${i + 1} text cannot exceed 25 characters`;
      if (seenTexts.has(cleanText)) return `Duplicate button text detected: "${cleanText}"`;
      seenTexts.add(cleanText);

      if (b.type === 'URL') {
        if (!b.url || !b.url.trim()) return `URL is required for URL button "${cleanText}"`;
        if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(b.url.trim())) {
          return `URL for button "${cleanText}" must be a valid http:// or https:// URL`;
        }
        const urlVars = [...b.url.matchAll(/\{\{\s*(\d+)\s*\}\}/g)];
        if (urlVars.length > 1) return `URL for button "${cleanText}" can contain at most one {{1}} placeholder`;
        if (urlVars.length === 1) {
          if (urlVars[0][1] !== '1' || !/\{\{\s*1\s*\}\}\/?$/.test(b.url.trim())) {
            return `The dynamic placeholder in button "${cleanText}" must be {{1}} at the END of the URL`;
          }
          const up = b.url_param || {};
          if (up.source === 'static' && !String(up.value || '').trim()) return `Dynamic URL button "${cleanText}" needs a static value for {{1}}`;
          if (up.source !== 'static' && !up.field) return `Dynamic URL button "${cleanText}" needs a lead-field mapping for {{1}}`;
        }
      } else if (b.type === 'PHONE_NUMBER') {
        if (!b.phone_number || !b.phone_number.trim()) return `Phone number is required for phone button "${cleanText}"`;
        if (!/^\+?[0-9\s\-()]{7,20}$/.test(b.phone_number.trim())) {
          return `Phone number for button "${cleanText}" is invalid`;
        }
      } else if (b.type === 'COPY_CODE') {
        if (!b.coupon_code || !String(b.coupon_code).trim()) return `Coupon code is required for copy-code button "${cleanText}"`;
        if (String(b.coupon_code).trim().length > 15) return 'Coupon codes cannot exceed 15 characters';
      }
    }
    if (counts.URL > 2) return 'Templates can contain at most 2 URL buttons';
    if (counts.PHONE_NUMBER > 1) return 'Templates can contain at most 1 phone-number button';
    if (counts.COPY_CODE > 1) return 'Templates can contain at most 1 copy-code button';

    return null;
  };

  const save = async () => {
    const errorMsg = validateTemplateForm(form);
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      // Server returns a warning message when the provider push was skipped
      // (API key lacks template-management permission at pinbot).
      const resp = editing
        ? await whatsappCampaignApi.updateTemplate(editing, payload)
        : await whatsappCampaignApi.createTemplate(payload);
      if (resp?.message && /NOT (submitted|pushed)/i.test(resp.message)) {
        toast(resp.message, { icon: <ExclamationTriangleIcon style={{ width: 20, height: 20, color: '#B45309' }} />, duration: 12000 });
      } else {
        toast.success(editing ? 'Template updated' : 'Template created');
      }
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
      const resp = await whatsappCampaignApi.deleteTemplate(t.id);
      // Surface whether the provider copy was removed too (or why not).
      if (resp?.message && /not removed/i.test(resp.message)) {
        toast(resp.message, { icon: <ExclamationTriangleIcon style={{ width: 20, height: 20, color: '#B45309' }} />, duration: 9000 });
      } else {
        toast.success(resp?.message || 'Template deleted');
      }
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

  const isMediaHeader = ['IMAGE', 'DOCUMENT', 'VIDEO', 'LOCATION', 'CAROUSEL'].includes(form.header_type);

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
            <div>
              <label style={labelStyle}>Template name : *</label>
              <input
                style={{ ...inputStyle, borderColor: nameInvalid ? '#fca5a5' : undefined }}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase() }))}
                placeholder="enter_template_name"
              />
              {nameInvalid && <div style={{ color: '#dc2626', fontSize: 11.5, marginTop: 5, lineHeight: 1.4 }}>{TEMPLATE_NAME_MSG}</div>}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Category : *</label>
              <select style={{ ...selectStyle, borderColor: !form.category ? '#fca5a5' : undefined }} value={form.category} onChange={setField('category')}>
                <option value="">--Select--</option>
                {meta.categories.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
              </select>
            </div>

            {form.category === 'MARKETING' && (
              <div style={{ marginTop: 14, padding: '12px', border: '1px solid var(--border-primary)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                <label style={labelStyle}>Type of marketing template :</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {[
                    { value: 'custom', label: 'Custom', desc: 'Send promotional offers, announcements and more to increase awareness and engagement' },
                    { value: 'product_messages', label: 'Product Messages', desc: 'Send message about your entire catalogue or multiple product from it' },
                    { value: 'lto', label: 'LTO', desc: 'Limited time offer templates allow you to display expiration dates and running countdown timers for offer codes in template messages' },
                    { value: 'order_payment', label: 'Order Payment details message', desc: 'Send messages with order details and payment options.' },
                    { value: 'calling_permissions', label: 'Calling Permissions Request', desc: 'Ask customers if you can call them on WhatsApp' }
                  ].map((opt) => (
                    <div key={opt.value} style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                      <input
                        type="radio"
                        id={`marketing-type-${opt.value}`}
                        name="marketing_type"
                        value={opt.value}
                        checked={(form.sub_category || 'custom') === opt.value}
                        onChange={() => setForm((f) => ({ ...f, sub_category: opt.value }))}
                        style={{ marginTop: 3, cursor: 'pointer' }}
                      />
                      <label htmlFor={`marketing-type-${opt.value}`} style={{ cursor: 'pointer', flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.category === 'UTILITY' && (
              <div style={{ marginTop: 14, padding: '12px', border: '1px solid var(--border-primary)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                <label style={labelStyle}>Type of utility template :</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {[
                    { value: 'custom', label: 'Custom', desc: 'Send transactional updates related to a specific user action' },
                    { value: 'order_status', label: 'Order status message', desc: 'Send message with order status' },
                    { value: 'order_details', label: 'Order details message', desc: 'Send message with order details and payment options' },
                    { value: 'calling_permissions', label: 'Calling Permissions Request', desc: 'Ask customers if you can call them on WhatsApp' }
                  ].map((opt) => (
                    <div key={opt.value} style={{ display: 'flex', alignItems: 'start', gap: 10 }}>
                      <input
                        type="radio"
                        id={`utility-type-${opt.value}`}
                        name="utility_type"
                        value={opt.value}
                        checked={(form.sub_category || 'custom') === opt.value}
                        onChange={() => setForm((f) => ({ ...f, sub_category: opt.value }))}
                        style={{ marginTop: 3, cursor: 'pointer' }}
                      />
                      <label htmlFor={`utility-type-${opt.value}`} style={{ cursor: 'pointer', flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>Language : *</label>
              <select style={selectStyle} value={form.language_code} onChange={setField('language_code')}>
                <option value="">-- Select --</option>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </div>

            {/* Header */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Header optional</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Add a title or choose which type of media you'll use for this header.</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Your title can't include more than one variable.</div>
              
              <label style={labelStyle}>Template type:</label>
              <select
                style={selectStyle}
                value={form.header_type === 'NONE' || form.header_type === 'TEXT' ? form.header_type : 'MEDIA'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'NONE') setForm((f) => ({ ...f, header_type: 'NONE' }));
                  else if (val === 'TEXT') setForm((f) => ({ ...f, header_type: 'TEXT' }));
                  else setForm((f) => ({ ...f, header_type: 'IMAGE' })); // default media to Image
                }}
              >
                <option value="NONE">None</option>
                <option value="TEXT">Text</option>
                <option value="MEDIA">Media</option>
              </select>

              {form.header_type === 'TEXT' && (
                <div style={{ marginTop: 10 }}>
                  <label style={labelStyle}>Text : *</label>
                  <input style={inputStyle} value={form.header_text} onChange={setHeaderText} placeholder={'Enter text (optionally with {{1}})'} maxLength={60} />
                  <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{form.header_text.length}/60</div>
                  {form.header_params.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 4 }}>Header placeholder mapping</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '46px 110px 1fr', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{'{{1}}'}</span>
                        <select style={selectStyle} value={form.header_params[0].source} onChange={(e) => updateHeaderParam('source', e.target.value)}>
                          <option value="lead_field">Lead field</option>
                          <option value="static">Static text</option>
                        </select>
                        {form.header_params[0].source === 'lead_field' ? (
                          <select style={selectStyle} value={form.header_params[0].field} onChange={(e) => updateHeaderParam('field', e.target.value)}>
                            <option value="">Select field…</option>
                            {meta.lead_fields.map((lf) => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
                          </select>
                        ) : (
                          <input style={inputStyle} value={form.header_params[0].value} onChange={(e) => updateHeaderParam('value', e.target.value)} placeholder="Static value" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isMediaHeader && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Media type :</label>
                    {[
                      { value: 'DOCUMENT', label: 'Document' },
                      { value: 'IMAGE', label: 'Image' },
                      { value: 'VIDEO', label: 'Video' },
                      { value: 'LOCATION', label: 'Location' },
                      { value: 'CAROUSEL', label: 'Carousel' }
                    ].map((mt) => (
                      <label key={mt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="mediaType"
                          value={mt.value}
                          checked={form.header_type === mt.value}
                          onChange={() => setForm((f) => ({ ...f, header_type: mt.value }))}
                        />
                        {mt.label}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                    Image: jpeg, png; Video: mp4; Document: .pdf, Maximum file size should be 5MB
                  </div>

                  <label style={labelStyle}>Media URL :</label>
                  <HeaderMediaInput
                    value={form.sample_header_url}
                    onChange={(url) => setForm((f) => ({ ...f, sample_header_url: url }))}
                    placeholder="Image/Pdf and Video URL, it should be https URL for example: https://domainname/imagename"
                  />
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>Body</div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Placeholders :</span>
                <button
                  type="button"
                  className="crm-btn crm-btn-secondary crm-btn-sm"
                  onClick={addParam}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Add placeholder
                </button>
              </div>

              {/* Formatting Toolbar */}
              <div style={{ marginBottom: 6 }}>
                <label style={labelStyle}>Message : *</label>
                <div style={{ display: 'flex', gap: 4, marginBottom: 8, background: 'var(--bg-secondary)', padding: 4, borderRadius: 6, width: 'fit-content' }}>
                  <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ padding: '2px 8px' }} onClick={() => setShowEmojis(!showEmojis)} title="Add Emoji"><FaceSmileIcon style={{ width: 14, height: 14 }} /></button>
                  <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ padding: '2px 8px', fontWeight: 'bold' }} onClick={() => insertFormatting('*', '*')} title="Bold">B</button>
                  <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ padding: '2px 8px', fontStyle: 'italic' }} onClick={() => insertFormatting('_', '_')} title="Italic">I</button>
                  <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ padding: '2px 8px', textDecoration: 'line-through' }} onClick={() => insertFormatting('~', '~')} title="Strikethrough">S</button>
                  <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" style={{ padding: '2px 8px', fontFamily: 'monospace' }} onClick={() => insertFormatting('```', '```')} title="Monospace">M</button>
                </div>

                {showEmojis && (
                  <div style={{ display: 'flex', gap: 6, padding: 6, border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-primary)', marginBottom: 8, flexWrap: 'wrap', maxWidth: 280 }}>
                    {['😊', '👋', '👍', '🗓️', '📞', '📍', '🏠', '🚀', '✅', '❌', '🎁', '🔥'].map((emoji) => (
                      <button key={emoji} type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => { insertFormatting(emoji); setShowEmojis(false); }} style={{ padding: 4, fontSize: 16 }}>{emoji}</button>
                    ))}
                  </div>
                )}
              </div>

              <textarea
                id="template-body-textarea"
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                value={form.body_text}
                onChange={setField('body_text')}
                placeholder="Enter template message"
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
                <label style={{ ...labelStyle, marginBottom: 0 }}>Buttons <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>(optional, up to {maxButtons} — max 2 URL, 1 phone, 1 coupon)</span></label>
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={addButton} disabled={form.buttons.length >= maxButtons}><PlusIcon style={{ width: 14, height: 14 }} /> Add button</button>
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
                    <>
                      <input style={{ ...inputStyle, marginTop: 8 }} value={b.url} onChange={(e) => updateButton(i, 'url', e.target.value)} placeholder={'https://example.com/offer or https://example.com/{{1}}'} />
                      {PLACEHOLDER_RE.test(b.url || '') && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Dynamic URL — map the {'{{1}}'} suffix appended at send time:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, alignItems: 'center' }}>
                            <select style={selectStyle} value={b.url_param?.source || 'lead_field'} onChange={(e) => updateButtonUrlParam(i, 'source', e.target.value)}>
                              <option value="lead_field">Lead field</option>
                              <option value="static">Static text</option>
                            </select>
                            {(b.url_param?.source || 'lead_field') === 'lead_field' ? (
                              <select style={selectStyle} value={b.url_param?.field || ''} onChange={(e) => updateButtonUrlParam(i, 'field', e.target.value)}>
                                <option value="">Select field…</option>
                                {meta.lead_fields.map((lf) => <option key={lf.value} value={lf.value}>{lf.label}</option>)}
                              </select>
                            ) : (
                              <input style={inputStyle} value={b.url_param?.value || ''} onChange={(e) => updateButtonUrlParam(i, 'value', e.target.value)} placeholder="Static suffix value" />
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {b.type === 'PHONE_NUMBER' && (
                    <input style={{ ...inputStyle, marginTop: 8 }} value={b.phone_number} onChange={(e) => updateButton(i, 'phone_number', e.target.value)} placeholder="+91 98765 43210" />
                  )}
                  {b.type === 'COPY_CODE' && (
                    <input style={{ ...inputStyle, marginTop: 8 }} value={b.coupon_code || ''} onChange={(e) => updateButton(i, 'coupon_code', e.target.value)} placeholder="Coupon code (max 15 chars), e.g. SAVE25" maxLength={15} />
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
