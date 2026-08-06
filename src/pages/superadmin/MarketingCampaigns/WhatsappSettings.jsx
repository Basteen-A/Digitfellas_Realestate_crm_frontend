import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Cog6ToothIcon, PaperAirplaneIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
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
  const [form, setForm] = useState({ phone_id: '', api_key: '', base_url: '', waba_id: '', default_header_image_url: '', otp_template_id: '' });

  // Test message state
  const [templates, setTemplates] = useState([]);
  const [testPhone, setTestPhone] = useState('');
  const [testTemplateId, setTestTemplateId] = useState('');
  const [testHeaderImageUrl, setTestHeaderImageUrl] = useState('');
  const [testing, setTesting] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === testTemplateId) || null;
  const needsHeaderMedia = selectedTemplate
    && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(selectedTemplate.header_type)
    && !testHeaderImageUrl
    && !selectedTemplate.sample_header_url
    && !cfg?.default_header_image_url;

  // Connection health state
  const [conn, setConn] = useState(null);
  const [checking, setChecking] = useState(false);

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
        api_key: '', // never prefilled - leave blank to keep the stored key
        base_url: c.base_url || 'https://partnersv1.pinbot.ai/v3',
        waba_id: c.waba_id || '',
        default_header_image_url: c.default_header_image_url || '',
        otp_template_id: c.otp_template_id || '',
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

  const checkConnection = async () => {
    setChecking(true);
    setConn(null);
    try {
      const resp = await whatsappCampaignApi.checkConnection();
      setConn(resp.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Connection check failed'));
    } finally {
      setChecking(false);
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) { toast.error('Enter a phone number to test'); return; }
    if (!testTemplateId) { toast.error('Select a template to test'); return; }
    if (needsHeaderMedia) { toast.error('Header file/image is required'); return; }
    setTesting(true);
    try {
      await whatsappCampaignApi.testConfig({
        phone: testPhone.trim(),
        template_id: testTemplateId,
        header_image_url: testHeaderImageUrl || undefined,
      });
      toast.success(`Test message sent to ${testPhone.trim()} - check WhatsApp on that number.`);
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

          <label style={labelStyle}>API Key {cfg?.key_set && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(stored: {cfg.api_key_masked} - leave blank to keep)</span>}</label>
          <input style={inputStyle} type="password" value={form.api_key} onChange={onChange('api_key')} placeholder={cfg?.key_set ? '•••••••• (unchanged)' : 'Paste API key'} autoComplete="new-password" />

          <label style={labelStyle}>Base URL</label>
          <input style={inputStyle} value={form.base_url} onChange={onChange('base_url')} placeholder="https://partnersv1.pinbot.ai/v3" />

          <label style={labelStyle}>WABA ID <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional - enables template sync)</span></label>
          <input style={inputStyle} value={form.waba_id} onChange={onChange('waba_id')} placeholder="WhatsApp Business Account ID" />

          <label style={labelStyle}>Default Header Image URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
          <HeaderMediaInput value={form.default_header_image_url} onChange={(url) => setForm((f) => ({ ...f, default_header_image_url: url }))} />

          <label style={labelStyle}>Login OTP Template <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(mobile app OTP login)</span></label>
          <select style={selectStyle} value={form.otp_template_id} onChange={onChange('otp_template_id')}>
            <option value="">Not configured - OTP login disabled</option>
            {templates.filter((t) => t.status === 'APPROVED').map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.language_code}){t.category ? ` - ${t.category}` : ''}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            The approved AUTHENTICATION-category template that delivers the 6-digit login code
            (create &amp; get it approved in the pinbot panel, then sync it on the Templates page).
          </div>

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
          <select style={selectStyle} value={testTemplateId} onChange={(e) => { setTestTemplateId(e.target.value); setTestHeaderImageUrl(''); }}>
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
          {templates.length === 0 && (
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>No templates yet - add one on the Templates page first.</div>
          )}

          {selectedTemplate && ['IMAGE', 'DOCUMENT', 'VIDEO'].includes(selectedTemplate.header_type) && (
            <div style={{ marginTop: 12 }}>
              <label style={labelStyle}>
                Header {selectedTemplate.header_type || 'Image'} {needsHeaderMedia
                  ? <span style={{ fontWeight: 800, color: '#dc2626' }}>* REQUIRED</span>
                  : <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional - overrides template/default)</span>}
              </label>
              <HeaderMediaInput value={testHeaderImageUrl} onChange={setTestHeaderImageUrl} />
              {needsHeaderMedia && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <ExclamationTriangleIcon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <span>
                    This template has a <strong>{selectedTemplate.header_type}</strong> header - you <strong>must upload a file</strong> above
                    before testing, otherwise the send will fail.
                  </span>
                </div>
              )}
            </div>
          )}

          <label style={labelStyle}>Test Phone Number</label>
          <input style={inputStyle} value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="e.g. 9876543210 or +91 9876543210" />

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="crm-btn crm-btn-secondary" onClick={sendTest} disabled={testing || needsHeaderMedia}>
              <PaperAirplaneIcon style={{ width: 15, height: 15 }} /> {testing ? 'Sending…' : 'Send Test'}
            </button>
          </div>
        </div>

        {/* Connection health */}
        <div className="crm-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Connection Health</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Verifies the API key against the provider: messaging identity, linked numbers, WABA details, and template-API access.
          </p>

          <div style={{ marginTop: 12 }}>
            <button className="crm-btn crm-btn-secondary" onClick={checkConnection} disabled={checking}>
              {checking ? 'Checking…' : 'Check Connection'}
            </button>
          </div>

          {conn && (
            <div style={{ marginTop: 14, fontSize: 13, display: 'grid', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700 }}>Messaging: </span>
                {conn.phone ? (
                  <span style={{ color: '#166534' }}>
                    ✓ {conn.phone.verified_name || '-'} ({conn.phone.display_phone_number || '-'})
                    {conn.phone.quality_rating ? ` · quality ${conn.phone.quality_rating}` : ''}
                  </span>
                ) : (
                  <span style={{ color: '#991b1b' }}>✗ not reachable</span>
                )}
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>WABA: </span>
                {conn.waba ? (
                  <span style={{ color: '#166534' }}>✓ {conn.waba.name || conn.waba.id}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>not available</span>
                )}
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>Template APIs: </span>
                {conn.templates_access ? (
                  <span style={{ color: '#166534' }}>✓ enabled (create / sync / edit / delete)</span>
                ) : (
                  <span style={{ color: '#991b1b' }}>✗ blocked - templates must be managed in the pinbot panel</span>
                )}
              </div>
              {Array.isArray(conn.numbers) && conn.numbers.length > 0 && (
                <div>
                  <span style={{ fontWeight: 700 }}>Linked numbers: </span>
                  {conn.numbers.map((n) => `${n.wanumber} (phone id ${n.phone_number_id})`).join(', ')}
                </div>
              )}
              {Array.isArray(conn.notes) && conn.notes.length > 0 && (
                <div style={{ color: '#a16207', fontSize: 12 }}>
                  {conn.notes.map((n, i) => <div key={i}>• {n}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsappSettings;
