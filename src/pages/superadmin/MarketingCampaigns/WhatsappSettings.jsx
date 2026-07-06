import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Cog6ToothIcon, PaperAirplaneIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';
import HeaderMediaInput from './HeaderMediaInput';

const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const WhatsappSettings = () => {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone_id: '', api_key: '', base_url: '', waba_id: '', default_header_image_url: '' });

  // Test message state
  const [templates, setTemplates] = useState([]);
  const [testPhone, setTestPhone] = useState('');
  const [testTemplateId, setTestTemplateId] = useState('');
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgResp, tplResp] = await Promise.all([
        whatsappCampaignApi.getConfig(),
        whatsappCampaignApi.getTemplates({ limit: 100, is_active: 'true' }),
      ]);
      const c = cfgResp.data || {};
      setCfg(c);
      setForm({
        phone_id: c.phone_id || '',
        api_key: '', // never prefilled — leave blank to keep the stored key
        base_url: c.base_url || 'https://partnersv1.pinbot.ai/v3',
        waba_id: c.waba_id || '',
        default_header_image_url: c.default_header_image_url || '',
      });
      setTemplates(tplResp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load WhatsApp settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.api_key) delete payload.api_key; // keep existing secret
      const resp = await whatsappCampaignApi.updateConfig(payload);
      setCfg(resp.data);
      setForm((f) => ({ ...f, api_key: '' }));
      toast.success('WhatsApp settings saved');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) { toast.error('Enter a phone number to test'); return; }
    if (!testTemplateId) { toast.error('Select a template to test'); return; }
    setTesting(true);
    try {
      const resp = await whatsappCampaignApi.testConfig({ phone: testPhone.trim(), template_id: testTemplateId });
      toast.success(`Test sent (id: ${resp.data?.messageId || 'ok'})`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Test message failed'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1><Cog6ToothIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />WhatsApp Settings</h1>
          <p className="hidden sm:block">Provider credentials for outbound WhatsApp marketing (pinbot.ai)</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Provider config */}
        <div className="crm-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            Provider Credentials
            {cfg?.key_set && (
              <span style={{ fontSize: 11, color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
                <CheckCircleIcon style={{ width: 12, height: 12, verticalAlign: 'text-bottom' }} /> Configured
              </span>
            )}
          </h2>

          <label style={labelStyle}>Phone Number ID</label>
          <input style={inputStyle} value={form.phone_id} onChange={onChange('phone_id')} placeholder="e.g. 1066045729919705" />

          <label style={labelStyle}>API Key {cfg?.key_set && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(stored: {cfg.api_key_masked} — leave blank to keep)</span>}</label>
          <input style={inputStyle} type="password" value={form.api_key} onChange={onChange('api_key')} placeholder={cfg?.key_set ? '•••••••• (unchanged)' : 'Paste API key'} autoComplete="new-password" />

          <label style={labelStyle}>Base URL</label>
          <input style={inputStyle} value={form.base_url} onChange={onChange('base_url')} placeholder="https://partnersv1.pinbot.ai/v3" />

          <label style={labelStyle}>WABA ID <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — enables template sync)</span></label>
          <input style={inputStyle} value={form.waba_id} onChange={onChange('waba_id')} placeholder="WhatsApp Business Account ID" />

          <label style={labelStyle}>Default Header Image URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
          <HeaderMediaInput value={form.default_header_image_url} onChange={(url) => setForm((f) => ({ ...f, default_header_image_url: url }))} />

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="crm-btn crm-btn-primary" onClick={save} disabled={saving || loading}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Test message */}
        <div className="crm-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Send a Test Message</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Validates the credentials end-to-end against the provider. Body parameters use static / placeholder values for the test.
          </p>

          <label style={labelStyle}>Template</label>
          <select style={selectStyle} value={testTemplateId} onChange={(e) => setTestTemplateId(e.target.value)}>
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.language_code})</option>
            ))}
          </select>
          {templates.length === 0 && (
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>No templates yet — add one on the Templates page first.</div>
          )}

          <label style={labelStyle}>Test Phone Number</label>
          <input style={inputStyle} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="e.g. 9876543210 or +91 9876543210" />

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="crm-btn crm-btn-secondary" onClick={sendTest} disabled={testing}>
              <PaperAirplaneIcon style={{ width: 15, height: 15 }} /> {testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsappSettings;
