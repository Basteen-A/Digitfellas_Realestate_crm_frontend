import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon, PlusIcon, TrashIcon, PencilSquareIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const EMPTY = { name: '', language_code: 'en', category: '', header_type: 'NONE', header_text: '', sample_header_url: '', body_text: '', body_params: [], is_active: true };

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ lead_fields: [], header_types: ['NONE', 'IMAGE', 'TEXT', 'DOCUMENT', 'VIDEO'] });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // template id or null
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await whatsappCampaignApi.getTemplates({ limit: 100 });
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
      if (resp.data) setMeta(resp.data);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { load(); loadMeta(); }, [load, loadMeta]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (t) => {
    setEditing(t.id);
    setForm({
      name: t.name || '', language_code: t.language_code || 'en', category: t.category || '',
      header_type: t.header_type || 'NONE', header_text: t.header_text || '', sample_header_url: t.sample_header_url || '',
      body_text: t.body_text || '', body_params: Array.isArray(t.body_params) ? t.body_params : [], is_active: t.is_active !== false,
    });
    setShowModal(true);
  };

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

  const save = async () => {
    if (!form.name.trim()) { toast.error('Template name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, body_params: form.body_params };
      if (editing) await whatsappCampaignApi.updateTemplate(editing, payload);
      else await whatsappCampaignApi.createTemplate(payload);
      toast.success(editing ? 'Template updated' : 'Template created');
      setShowModal(false);
      load();
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
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete template'));
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const resp = await whatsappCampaignApi.syncTemplates();
      toast.success(resp.message || 'Synced from provider');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Provider sync not available'));
    } finally {
      setSyncing(false);
    }
  };

  const isMediaHeader = ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(form.header_type);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><DocumentTextIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />WhatsApp Templates</h1>
          <p className="hidden sm:block">Register your approved templates and map their placeholders to lead fields</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={sync} disabled={syncing}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {syncing ? 'Syncing…' : 'Sync from provider'}
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openCreate}>
            <PlusIcon style={{ width: 16, height: 16 }} /> New Template
          </button>
        </div>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Language</th>
                <th style={th}>Category</th>
                <th style={th}>Header</th>
                <th style={th}>Params</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>Loading…</td></tr>}
              {!loading && templates.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={7}>No templates yet. Add your approved templates here.</td></tr>
              )}
              {!loading && templates.map((t) => (
                <tr key={t.id}>
                  <td style={td}><span style={{ fontWeight: 600 }}>{t.name}</span></td>
                  <td style={td}>{t.language_code}</td>
                  <td style={td}>{t.category || '—'}</td>
                  <td style={td}>{t.header_type}</td>
                  <td style={td}>{Array.isArray(t.body_params) ? t.body_params.length : 0}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.is_active ? '#166534' : '#991b1b' }}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => openEdit(t)} title="Edit"><PencilSquareIcon style={{ width: 15, height: 15 }} /></button>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => remove(t)} title="Delete" style={{ color: '#dc2626' }}><TrashIcon style={{ width: 15, height: 15 }} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div onClick={() => !saving && setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <div onClick={(e) => e.stopPropagation()} className="crm-card" style={{ width: '100%', maxWidth: 640, margin: '20px auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{editing ? 'Edit Template' : 'New Template'}</h2>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Template Name *</label>
                  <input style={inputStyle} value={form.name} onChange={setField('name')} placeholder="e.g. sjsmstemp1" />
                </div>
                <div>
                  <label style={labelStyle}>Language</label>
                  <input style={inputStyle} value={form.language_code} onChange={setField('language_code')} placeholder="en" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <input style={inputStyle} value={form.category} onChange={setField('category')} placeholder="MARKETING / UTILITY" />
                </div>
                <div>
                  <label style={labelStyle}>Header Type</label>
                  <select style={selectStyle} value={form.header_type} onChange={setField('header_type')}>
                    {meta.header_types.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {form.header_type === 'TEXT' && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Header Text</label>
                  <input style={inputStyle} value={form.header_text} onChange={setField('header_text')} placeholder="Header text" />
                </div>
              )}
              {isMediaHeader && (
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>Default Header Media URL</label>
                  <input style={inputStyle} value={form.sample_header_url} onChange={setField('sample_header_url')} placeholder="https://yourdomain.com/image.jpg" />
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label style={labelStyle}>Body Text (preview, use {'{{1}}'}, {'{{2}}'} …)</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.body_text} onChange={setField('body_text')} placeholder="Hi {{1}}, your document {{2}} is ready. Call {{3}}." />
              </div>

              {/* Body params mapping */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Body Parameters</label>
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={addParam}><PlusIcon style={{ width: 14, height: 14 }} /> Add</button>
                </div>
                {form.body_params.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>No parameters. Add one per {'{{n}}'} placeholder in the body.</div>}
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
                        {meta.lead_fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    ) : (
                      <input style={inputStyle} value={p.value} onChange={(e) => updateParam(i, 'value', e.target.value)} placeholder="Static value" />
                    )}
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => removeParam(i)} style={{ color: '#dc2626' }}><TrashIcon style={{ width: 14, height: 14 }} /></button>
                  </div>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                Active (available for campaigns)
              </label>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Template'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
