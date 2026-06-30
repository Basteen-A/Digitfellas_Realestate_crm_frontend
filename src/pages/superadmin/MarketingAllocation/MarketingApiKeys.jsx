import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  KeyIcon, PlusIcon, TrashIcon, ArrowPathIcon, ClipboardDocumentIcon, CheckIcon, PencilSquareIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import marketingApiKeyApi from '../../../api/marketingApiKeyApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'middle' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' };

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never');

const MarketingApiKeys = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAllowedIps, setNewAllowedIps] = useState('');
  const [newRateLimit, setNewRateLimit] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedSubSourceId, setSelectedSubSourceId] = useState('');
  const [sources, setSources] = useState([]);
  const [subSources, setSubSources] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  // Edit-key modal (name + IP whitelist, no secret rotation).
  const [editing, setEditing] = useState(null); // { id, name, allowed_ips }
  const [editName, setEditName] = useState('');
  const [editAllowedIps, setEditAllowedIps] = useState('');
  const [editRateLimit, setEditRateLimit] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  // The one-time plaintext reveal after create/regenerate.
  const [revealed, setRevealed] = useState(null); // { name, api_key }
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await marketingApiKeyApi.getAll({ limit: 100 });
      setKeys(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load API keys'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSources = useCallback(async () => {
    try {
      const resp = await leadSourceApi.getWithSubSources();
      setSources(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load lead sources'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { 
    if (showCreate) {
      loadSources();
    }
  }, [showCreate, loadSources]);

  // Load sub-sources when source changes
  useEffect(() => {
    const loadSubSources = async () => {
      if (!selectedSourceId) {
        setSubSources([]);
        setSelectedSubSourceId('');
        return;
      }
      try {
        const resp = await leadSubSourceApi.getBySource(selectedSourceId);
        setSubSources(resp.data || []);
        setSelectedSubSourceId('');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load sub-sources'));
      }
    };
    loadSubSources();
  }, [selectedSourceId]);

  const create = async () => {
    if (!newName.trim()) { toast.error('Enter a name for the integration'); return; }
    if (!selectedSourceId) { toast.error('Select a lead source'); return; }
    setCreating(true);
    try {
      const payload = {
        name: newName.trim(),
        lead_source_id: selectedSourceId || null,
        lead_sub_source_id: selectedSubSourceId || null,
        allowed_ips: newAllowedIps,
        rate_limit_per_min: newRateLimit === '' ? 0 : Number(newRateLimit),
      };
      const resp = await marketingApiKeyApi.create(payload);
      setRevealed({ name: resp.data.name, api_key: resp.data.api_key });
      setCopied(false);
      setNewName('');
      setNewAllowedIps('');
      setNewRateLimit('');
      setSelectedSourceId('');
      setSelectedSubSourceId('');
      setShowCreate(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create key'));
    } finally {
      setCreating(false);
    }
  };

  const regenerate = async (k) => {
    if (!window.confirm(`Regenerate the key for "${k.name}"? The current key will stop working immediately.`)) return;
    try {
      const resp = await marketingApiKeyApi.regenerate(k.id);
      setRevealed({ name: resp.data.name, api_key: resp.data.api_key });
      setCopied(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to regenerate key'));
    }
  };

  const toggle = async (k) => {
    try {
      await marketingApiKeyApi.toggleStatus(k.id);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update key'));
    }
  };

  const openEdit = (k) => {
    setEditing(k);
    setEditName(k.name || '');
    setEditAllowedIps(Array.isArray(k.allowed_ips) ? k.allowed_ips.join('\n') : '');
    setEditRateLimit(k.rate_limit_per_min ? String(k.rate_limit_per_min) : '');
  };

  const saveEdit = async () => {
    if (!editName.trim()) { toast.error('Enter a name for the integration'); return; }
    setSavingEdit(true);
    try {
      await marketingApiKeyApi.update(editing.id, {
        name: editName.trim(),
        allowed_ips: editAllowedIps,
        rate_limit_per_min: editRateLimit === '' ? 0 : Number(editRateLimit),
      });
      toast.success('API key updated');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update key'));
    } finally {
      setSavingEdit(false);
    }
  };

  const remove = async (k) => {
    if (!window.confirm(`Delete the key "${k.name}"? This integration will lose access permanently.`)) return;
    try {
      await marketingApiKeyApi.delete(k.id);
      toast.success('Key deleted');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete key'));
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(revealed.api_key);
      setCopied(true);
      toast.success('Key copied to clipboard');
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  const selectedSource = sources.find(s => s.id === selectedSourceId);
  const sourceLabel = selectedSource?.source_name || 'Any';
  const subSourceLabel = selectedSubSourceId 
    ? subSources.find(ss => ss.id === selectedSubSourceId)?.sub_source_name || 'Any'
    : (selectedSourceId ? 'All sub-sources' : 'Any');

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><KeyIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Marketing API Keys</h1>
          <p className="hidden sm:block">One key per website / application — revoke any integration without affecting the others</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={() => { setShowCreate(true); setNewName(''); setSelectedSourceId(''); setSelectedSubSourceId(''); }}>
            <PlusIcon style={{ width: 16, height: 16 }} /> New Key
          </button>
        </div>
      </div>

      {/* Usage hint */}
      <div className="crm-card" style={{ padding: 14, marginBottom: 14, borderLeft: '4px solid #2563eb' }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          Send each website's key in the <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>X-API-Key</code> header to{' '}
          <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>POST /api/v1/marketing/leads</code>.
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Body fields: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{'{ name, phone, email?, project?, location?, campaign_name? }'}</code>
          </div>
          <div style={{ fontSize: 12, color: '#2563eb', marginTop: 6, fontWeight: 600 }}>
            Source/sub-source are automatically set based on the API key configuration — no need to include them in the body.
          </div>
        </div>
      </div>

      {/* One-time reveal banner */}
      {revealed && (
        <div className="crm-card" style={{ padding: 16, marginBottom: 14, border: '1px solid #16A34A', background: '#f0fdf4' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
            Key for "{revealed.name}" — copy it now. It will not be shown again.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ flex: 1, minWidth: 280, background: '#fff', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 13, wordBreak: 'break-all', color: '#111' }}>
              {revealed.api_key}
            </code>
            <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={copyKey}>
              {copied ? <CheckIcon style={{ width: 15, height: 15 }} /> : <ClipboardDocumentIcon style={{ width: 15, height: 15 }} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setRevealed(null)}>Done</button>
          </div>
        </div>
      )}

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={th}>Integration</th>
                <th style={th}>Key</th>
                <th style={th}>Source</th>
                <th style={th}>Sub-Source</th>
                <th style={th}>Whitelist</th>
                <th style={th}>Rate Limit</th>
                <th style={th}>Last Used</th>
                <th style={th}>Requests</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>Loading…</td></tr>
              )}
              {!loading && keys.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={10}>No API keys yet. Create one per website / app.</td></tr>
              )}
              {!loading && keys.map((k) => (
                <tr key={k.id}>
                  <td style={td}><span style={{ fontWeight: 600 }}>{k.name}</span></td>
                  <td style={td}><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{k.key_prefix}…</code></td>
                  <td style={td}>
                    <span style={{ fontSize: 12, color: k.leadSource ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {k.leadSource?.source_name || 'Any'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 12, color: k.leadSubSource ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {k.leadSubSource?.sub_source_name || (k.leadSource ? 'All' : 'Any')}
                    </span>
                  </td>
                  <td style={td}>
                    {Array.isArray(k.allowed_ips) && k.allowed_ips.length > 0 ? (
                      <span title={k.allowed_ips.join(', ')} style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 999, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <ShieldCheckIcon style={{ width: 13, height: 13 }} /> {k.allowed_ips.length} {k.allowed_ips.length > 1 ? 'rules' : 'rule'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Any</span>
                    )}
                  </td>
                  <td style={td}>
                    {k.rate_limit_per_min > 0
                      ? <span style={{ fontSize: 12, fontWeight: 600 }}>{k.rate_limit_per_min}/min</span>
                      : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unlimited</span>}
                  </td>
                  <td style={td}>{fmtDateTime(k.last_used_at)}</td>
                  <td style={td}>{k.usage_count ?? 0}</td>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => toggle(k)}
                      className="crm-btn crm-btn-sm"
                      style={{
                        background: k.is_active ? '#dcfce7' : '#fee2e2',
                        color: k.is_active ? '#166534' : '#991b1b',
                        border: `1px solid ${k.is_active ? '#bbf7d0' : '#fecaca'}`,
                        fontWeight: 700,
                      }}
                      title="Click to toggle"
                    >
                      {k.is_active ? 'Active' : 'Revoked'}
                    </button>
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => openEdit(k)} title="Edit name / IP whitelist">
                      <PencilSquareIcon style={{ width: 15, height: 15 }} />
                    </button>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => regenerate(k)} title="Regenerate key">
                      <ArrowPathIcon style={{ width: 15, height: 15 }} />
                    </button>
                    <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => remove(k)} title="Delete" style={{ color: '#dc2626' }}>
                      <TrashIcon style={{ width: 15, height: 15 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div
          onClick={() => !creating && setShowCreate(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="crm-card" style={{ width: '100%', maxWidth: 640, margin: '20px auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>New API Key</h2>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Integration Name *</label>
              <input
                style={inputStyle}
                autoFocus
                placeholder="e.g. Company Website, Facebook Ads App"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' }}>Lead Source *</label>
              <select
                style={selectStyle}
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
              >
                <option value="">Select a source...</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>{source.source_name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Leads from this key must match this source
              </div>
              
              {selectedSourceId && (
                <>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' }}>Lead Sub-Source (Optional)</label>
                  <select
                    style={selectStyle}
                    value={selectedSubSourceId}
                    onChange={(e) => setSelectedSubSourceId(e.target.value)}
                    disabled={!selectedSourceId}
                  >
                    <option value="">All sub-sources</option>
                    {subSources.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.sub_source_name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Optionally restrict to a specific sub-source
                  </div>
                </>
              )}
              
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' }}>Allowed IPs / Domains (Optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                placeholder={'203.0.113.5\n10.0.0.0/24\nexample.com'}
                value={newAllowedIps}
                onChange={(e) => setNewAllowedIps(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                One IP, CIDR range, or domain per line. Leave empty to allow any. Domains match the request's Origin/Referer; IPs match the caller's address.
              </div>

              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' }}>Rate Limit (requests / minute)</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                placeholder="0 = unlimited"
                value={newRateLimit}
                onChange={(e) => setNewRateLimit(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Max requests this key may make per minute. Leave empty or 0 for unlimited.
              </div>

              <div style={{ marginTop: 20, padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>Key Configuration Summary</div>
                <div style={{ fontSize: 12, color: '#0c4a6e' }}>
                  Source: <strong>{sourceLabel}</strong><br/>
                  Sub-Source: <strong>{subSourceLabel}</strong>
                </div>
                <div style={{ fontSize: 11, color: '#0369a1', marginTop: 6 }}>
                  These values will be automatically applied to all leads posted with this key
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={create} disabled={creating || !newName.trim() || !selectedSourceId}>{creating ? 'Creating…' : 'Create Key'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit key (name + IP whitelist — does NOT rotate the secret) */}
      {editing && (
        <div
          onClick={() => !savingEdit && setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}
        >
          <div onClick={(e) => e.stopPropagation()} className="crm-card" style={{ width: '100%', maxWidth: 640, margin: '20px auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: 'var(--bg-primary)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Edit API Key</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Update the name and IP whitelist. The secret key is not changed.</div>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Integration Name *</label>
              <input style={inputStyle} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Company Website" />

              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' }}>Allowed IPs / Domains (Optional)</label>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                placeholder={'203.0.113.5\n10.0.0.0/24\nexample.com'}
                value={editAllowedIps}
                onChange={(e) => setEditAllowedIps(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                One IP, CIDR range, or domain per line. Leave empty to allow any. Domains match the request's Origin/Referer; IPs match the caller's address.
              </div>

              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, marginTop: 16, display: 'block' }}>Rate Limit (requests / minute)</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                placeholder="0 = unlimited"
                value={editRateLimit}
                onChange={(e) => setEditRateLimit(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Max requests this key may make per minute. Leave empty or 0 for unlimited.
              </div>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={saveEdit} disabled={savingEdit || !editName.trim()}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketingApiKeys;
