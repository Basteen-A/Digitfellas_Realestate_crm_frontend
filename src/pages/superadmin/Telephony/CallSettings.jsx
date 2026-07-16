import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PhoneIcon, ClipboardDocumentIcon, ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import telephonyApi from '../../../api/telephonyApi';
import userApi from '../../../api/userApi';
import { API_URL } from '../../../api/axiosInstance';
import { getErrorMessage } from '../../../utils/helpers';

const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const th = { padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left' };
const td = { padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)' };

const AGENT_ROLES = ['TC', 'SM', 'SH'];
const userName = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim();

const Toggle = ({ label, hint, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 14 }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
    <span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
      {hint && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
    </span>
  </label>
);

// Super Admin → Telephony → Call Settings. Configures the Tata Smartflo webhook
// integration and shows the webhook URL to paste into the Smartflo panel.
const CallSettings = () => {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({
    api_base_url: '', default_country: 'IN', api_key: '', default_caller_id: '',
    is_active: true, log_to_lead_activity: true, match_by_agent_number: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgResp, userResp] = await Promise.all([
        telephonyApi.getConfig(),
        userApi.getAll({ limit: 500, is_active: 'true' }).catch(() => ({ data: [] })),
      ]);
      const c = cfgResp.data || {};
      setCfg(c);
      setForm({
        api_base_url: c.api_base_url || '',
        default_country: c.default_country || 'IN',
        api_key: '', // never prefilled — leave blank to keep the stored key
        default_caller_id: c.default_caller_id || '',
        is_active: c.is_active !== false,
        log_to_lead_activity: c.log_to_lead_activity !== false,
        match_by_agent_number: c.match_by_agent_number !== false,
      });
      const users = userResp.data || [];
      setAgents(users.filter((u) => AGENT_ROLES.includes(u.userType?.short_code)));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load telephony settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const webhookUrl = cfg?.webhook_token
    ? `${API_URL}/telephony/webhook/${cfg.webhook_token}`
    : `${API_URL}/telephony/webhook/<token — save settings to generate>`;

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const payload = { ...form, ...extra };
      if (!payload.api_key) delete payload.api_key; // keep existing secret
      const resp = await telephonyApi.updateConfig(payload);
      setCfg(resp.data);
      setForm((f) => ({ ...f, api_key: '' }));
      toast.success('Telephony settings saved');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  const regenerateToken = async () => {
    if (!window.confirm('Regenerate the webhook token? The old webhook URL will stop working until you update it in the Smartflo panel.')) return;
    await save({ regenerate_token: true });
  };

  const copyUrl = () => {
    if (!cfg?.webhook_token) { toast.error('Save settings first to generate a token.'); return; }
    navigator.clipboard?.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: 900 }}>
      <div className="page-header">
        <div className="page-header-left">
          <h1><PhoneIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Call Settings</h1>
          <p className="hidden sm:block">Tata Smartflo call-webhook integration — answered &amp; missed calls with recordings</p>
        </div>
      </div>

      {/* Webhook URL card */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Webhook URL</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
          Paste this into the Smartflo panel (Settings → Webhook) for the <strong>Call Answered</strong>,
          <strong> Call Missed</strong> and <strong>Hangup</strong> events. GET or POST, JSON or form —
          all are accepted. The token in the URL is what secures the endpoint.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <code style={{ flex: 1, minWidth: 260, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', fontSize: 12, wordBreak: 'break-all' }}>
            {webhookUrl}
          </code>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={copyUrl}>
            <ClipboardDocumentIcon style={{ width: 15, height: 15 }} /> Copy
          </button>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={regenerateToken} disabled={saving}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> Regenerate token
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: cfg?.is_active === false ? '#b45309' : '#16a34a', fontWeight: 600 }}>
          {cfg?.is_active === false ? '● Integration is paused — incoming calls are acknowledged but not stored.' : '● Integration active.'}
        </div>
      </div>

      {/* Config form */}
      <div className="crm-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Configuration</div>

        <label style={labelStyle}>Provider API base URL</label>
        <input style={inputStyle} value={form.api_base_url} onChange={(e) => setForm((f) => ({ ...f, api_base_url: e.target.value }))} placeholder="https://api-smartflo.tatateleservices.com" />

        <label style={labelStyle}>Default country (for matching bare numbers)</label>
        <input style={{ ...inputStyle, maxWidth: 120 }} value={form.default_country} onChange={(e) => setForm((f) => ({ ...f, default_country: e.target.value.toUpperCase() }))} placeholder="IN" maxLength={4} />

        <label style={labelStyle}>
          Click-to-Call API token <span style={{ fontWeight: 400 }}>(Authorization header — from your Smartflo panel; also used for protected recordings)</span>
        </label>
        <input
          style={inputStyle}
          type="password"
          value={form.api_key}
          onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
          placeholder={cfg?.key_set ? `Saved (${cfg.api_key_masked}). Leave blank to keep.` : 'Not set — required for outbound Click-to-Call'}
          autoComplete="new-password"
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          Paste the token exactly as your Smartflo account needs it (some require a leading <code>Bearer </code>).
        </div>

        <label style={labelStyle}>
          Default Caller ID (DID) <span style={{ fontWeight: 400 }}>(shown to the customer on outbound Click-to-Call)</span>
        </label>
        <input
          style={{ ...inputStyle, maxWidth: 260 }}
          value={form.default_caller_id}
          onChange={(e) => setForm((f) => ({ ...f, default_caller_id: e.target.value }))}
          placeholder="e.g. 918069235400"
        />

        <Toggle
          label="Store incoming calls (integration active)"
          hint="When off, webhooks are acknowledged but not saved."
          checked={form.is_active}
          onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
        />
        <Toggle
          label="Match calls to the telecaller by agent number"
          hint="Uses each user's phone (or their Tata agent-number override in Users)."
          checked={form.match_by_agent_number}
          onChange={(v) => setForm((f) => ({ ...f, match_by_agent_number: v }))}
        />
        <Toggle
          label="Log matched calls to the lead's activity timeline"
          hint="Adds a CALL_LOGGED entry (answered / missed) on the matched lead."
          checked={form.log_to_lead_activity}
          onChange={(v) => setForm((f) => ({ ...f, log_to_lead_activity: v }))}
        />

        <div style={{ marginTop: 20 }}>
          <button className="crm-btn crm-btn-primary" onClick={() => save()} disabled={saving || loading}>
            <CheckCircleIcon style={{ width: 16, height: 16 }} /> {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>

      {/* Agent-number mapping helper */}
      <div className="crm-card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontWeight: 700 }}>Agent-number mapping</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Calls are matched to a telecaller by their phone number. If a user's Tata agent number
            differs, set a <strong>Tata Agent Number</strong> override on their profile in
            <strong> Users</strong>. Read-only view below.
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th}>Telecaller</th>
                <th style={th}>Role</th>
                <th style={th}>CRM Phone</th>
                <th style={th}>Tata Agent Number (override)</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={4}>No telecallers found</td></tr>
              )}
              {agents.map((u) => (
                <tr key={u.id}>
                  <td style={td}>{userName(u)}</td>
                  <td style={td}>{u.userType?.short_code || '—'}</td>
                  <td style={td}>{u.phone || '—'}</td>
                  <td style={{ ...td, color: u.telephony_agent_number ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {u.telephony_agent_number || '(uses CRM phone)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CallSettings;
