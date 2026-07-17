import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon, ArrowPathIcon, HashtagIcon,
} from '@heroicons/react/24/outline';
import telephonyApi from '../../../api/telephonyApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import marketingAllocationRuleApi from '../../../api/marketingAllocationRuleApi';
import { getErrorMessage } from '../../../utils/helpers';
import { badgeStyle } from '../../../utils/badgeColors';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'top' };
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

const userName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || '—' : '—');

const EMPTY_FORM = {
  id: null, rule_name: '', did_number: '', lead_source_id: '', lead_sub_source_id: '',
  campaign_name: '', assign_all_telecallers: false, telecaller_ids: [], is_active: true,
};

// Super Admin → Telephony → Call Settings: "Ad Number Allocation" card.
// Each rule maps one advertised Tata DID number to a Lead Source / Sub-Source
// (the medium) + campaign, and a telecaller round-robin pool. Inbound calls to
// that number auto-assign the lead from the pool and tag it with the ad's
// source, so ad attribution is traceable on the lead itself.
const DidNumberRules = () => {
  const [rules, setRules] = useState([]);
  const [sources, setSources] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tcSearch, setTcSearch] = useState('');
  const [subSources, setSubSources] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await telephonyApi.getDidRules();
      setRules(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load ad-number rules'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [srcResp, tcResp] = await Promise.all([
          leadSourceApi.getDropdown(),
          marketingAllocationRuleApi.getTelecallers(),
        ]);
        setSources(srcResp.data || []);
        setTelecallers(tcResp.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to load sources / telecallers'));
      }
    })();
    loadRules();
  }, [loadRules]);

  const tcById = useMemo(() => {
    const m = {};
    telecallers.forEach((t) => { m[t.id] = t; });
    return m;
  }, [telecallers]);

  const filteredTelecallers = useMemo(() => {
    const q = tcSearch.trim().toLowerCase();
    if (!q) return telecallers;
    return telecallers.filter((t) => `${userName(t)} ${t.email || ''} ${t.phone || ''}`.toLowerCase().includes(q));
  }, [telecallers, tcSearch]);

  const loadSubSources = useCallback(async (sourceId) => {
    if (!sourceId) { setSubSources([]); return; }
    setLoadingSubs(true);
    try {
      const resp = await leadSubSourceApi.getBySource(sourceId);
      setSubSources(resp.data || []);
    } catch (err) {
      setSubSources([]);
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setSubSources([]); setTcSearch(''); setModalOpen(true); };
  const openEdit = (rule) => {
    setForm({
      id: rule.id,
      rule_name: rule.rule_name || '',
      did_number: rule.did_number || '',
      lead_source_id: rule.lead_source_id || '',
      lead_sub_source_id: rule.lead_sub_source_id || '',
      campaign_name: rule.campaign_name || '',
      assign_all_telecallers: !!rule.assign_all_telecallers,
      telecaller_ids: Array.isArray(rule.telecaller_ids) ? rule.telecaller_ids.map(String) : [],
      is_active: rule.is_active !== false,
    });
    setTcSearch('');
    setModalOpen(true);
    loadSubSources(rule.lead_source_id);
  };
  const closeModal = () => { if (!saving) setModalOpen(false); };

  const onSourceChange = (sourceId) => {
    setForm((f) => ({ ...f, lead_source_id: sourceId, lead_sub_source_id: '' }));
    loadSubSources(sourceId);
  };

  const toggleTc = (id) => {
    setForm((f) => {
      const set = new Set(f.telecaller_ids.map(String));
      if (set.has(String(id))) set.delete(String(id)); else set.add(String(id));
      return { ...f, telecaller_ids: [...set] };
    });
  };

  const allFilteredSelected = filteredTelecallers.length > 0
    && filteredTelecallers.every((t) => form.telecaller_ids.map(String).includes(String(t.id)));

  const toggleSelectAllFiltered = () => {
    setForm((f) => {
      const set = new Set(f.telecaller_ids.map(String));
      if (allFilteredSelected) {
        filteredTelecallers.forEach((t) => set.delete(String(t.id)));
      } else {
        filteredTelecallers.forEach((t) => set.add(String(t.id)));
      }
      return { ...f, telecaller_ids: [...set] };
    });
  };

  const save = async () => {
    if (!form.rule_name.trim()) { toast.error('Rule name is required'); return; }
    if (!form.did_number.trim()) { toast.error('Enter the advertised DID number'); return; }
    if (!form.lead_source_id) { toast.error('Select a lead source for this ad number'); return; }
    if (!form.assign_all_telecallers && form.telecaller_ids.length === 0) {
      toast.error('Select at least one telecaller, or enable "All telecallers"');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        rule_name: form.rule_name.trim(),
        did_number: form.did_number.trim(),
        lead_source_id: form.lead_source_id,
        lead_sub_source_id: form.lead_sub_source_id || null,
        campaign_name: form.campaign_name.trim() || null,
        assign_all_telecallers: form.assign_all_telecallers,
        telecaller_ids: form.assign_all_telecallers ? [] : form.telecaller_ids,
        is_active: form.is_active,
      };
      if (form.id) {
        await telephonyApi.updateDidRule(form.id, payload);
        toast.success('Ad-number rule updated');
      } else {
        await telephonyApi.createDidRule(payload);
        toast.success('Ad-number rule created');
      }
      setModalOpen(false);
      loadRules();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save rule'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      await telephonyApi.updateDidRule(rule.id, { is_active: !rule.is_active });
      loadRules();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to toggle status'));
    }
  };

  const remove = async (rule) => {
    if (!window.confirm(`Delete ad-number rule "${rule.rule_name}"? Calls to ${rule.did_number} will fall back to the general incoming-call allocation.`)) return;
    try {
      await telephonyApi.deleteDidRule(rule.id);
      toast.success('Rule deleted');
      loadRules();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete rule'));
    }
  };

  const renderTelecallerSummary = (rule) => {
    if (rule.assign_all_telecallers) {
      return <span style={{ fontWeight: 600, color: '#16A34A' }}>All telecallers</span>;
    }
    const ids = Array.isArray(rule.telecaller_ids) ? rule.telecaller_ids : [];
    if (ids.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const names = ids.map((id) => userName(tcById[id]) || 'Unknown');
    const shown = names.slice(0, 3).join(', ');
    return (
      <span>
        <span style={{ fontWeight: 600 }}>{ids.length}</span> selected
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shown}{names.length > 3 ? `, +${names.length - 3} more` : ''}</div>
      </span>
    );
  };

  return (
    <div className="crm-card" style={{ marginBottom: 16 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700 }}>
            <HashtagIcon style={{ width: 16, height: 16, marginRight: 5, verticalAlign: 'text-bottom' }} />
            Ad Number Allocation
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, maxWidth: 620 }}>
            Advertise a different Tata number in each ad. When a customer calls one, the lead is
            round-robin assigned to that number's telecallers and tagged with the ad's
            <strong> source / sub-source / campaign</strong> — numbers without a rule use the
            general incoming-call allocation.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadRules} disabled={loading}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openCreate}>
            <PlusIcon style={{ width: 16, height: 16 }} /> New Rule
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <th style={th}>Rule</th>
              <th style={th}>Ad (DID) Number</th>
              <th style={th}>Source / Medium</th>
              <th style={th}>Telecallers (Round-robin)</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>Loading…</td></tr>
            )}
            {!loading && rules.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={6}>No ad-number rules yet. Create one per advertised Tata number.</td></tr>
            )}
            {!loading && rules.map((rule) => (
              <tr key={rule.id}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{rule.rule_name}</div>
                  {rule.campaign_name && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Campaign: {rule.campaign_name}</div>
                  )}
                </td>
                <td style={td}>
                  <code style={{ fontSize: 13, fontWeight: 600 }}>{rule.did_number}</code>
                </td>
                <td style={td}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, ...badgeStyle(rule.leadSource?.color_code) }}>
                    {rule.leadSource?.source_name || '—'}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {rule.leadSubSource ? `› ${rule.leadSubSource.sub_source_name}` : 'Whole source'}
                  </div>
                </td>
                <td style={td}>{renderTelecallerSummary(rule)}</td>
                <td style={td}>
                  <button
                    type="button"
                    onClick={() => toggleActive(rule)}
                    className="crm-btn crm-btn-sm"
                    style={{
                      background: rule.is_active ? '#dcfce7' : '#f3f4f6',
                      color: rule.is_active ? '#166534' : '#6b7280',
                      border: `1px solid ${rule.is_active ? '#bbf7d0' : '#e5e7eb'}`,
                      fontWeight: 700,
                    }}
                    title="Click to toggle"
                  >
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => openEdit(rule)} title="Edit">
                    <PencilSquareIcon style={{ width: 15, height: 15 }} />
                  </button>
                  <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => remove(rule)} title="Delete" style={{ color: '#dc2626' }}>
                    <TrashIcon style={{ width: 15, height: 15 }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="crm-card"
            style={{ width: '100%', maxWidth: 640, margin: '20px auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: 'var(--bg-primary)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{form.id ? 'Edit Ad-Number Rule' : 'New Ad-Number Rule'}</h2>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={closeModal}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div>
                <label style={labelStyle}>Rule Name</label>
                <input
                  style={inputStyle}
                  value={form.rule_name}
                  placeholder="e.g. Newspaper Ad — July"
                  onChange={(e) => setForm((f) => ({ ...f, rule_name: e.target.value }))}
                />
              </div>

              <div>
                <label style={labelStyle}>Advertised Tata (DID) Number</label>
                <input
                  style={inputStyle}
                  value={form.did_number}
                  placeholder="e.g. 918069235400"
                  onChange={(e) => setForm((f) => ({ ...f, did_number: e.target.value }))}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  The number printed in the ad — calls landing on it are matched by the last 10 digits.
                </div>
              </div>

              <div>
                <label style={labelStyle}>Lead Source</label>
                <select
                  style={inputStyle}
                  value={form.lead_source_id}
                  onChange={(e) => onSourceChange(e.target.value)}
                >
                  <option value="">Select a source…</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.source_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Sub-Source / Medium <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <select
                  style={{ ...inputStyle, opacity: form.lead_source_id ? 1 : 0.6 }}
                  value={form.lead_sub_source_id}
                  disabled={!form.lead_source_id || loadingSubs}
                  onChange={(e) => setForm((f) => ({ ...f, lead_sub_source_id: e.target.value }))}
                >
                  <option value="">{loadingSubs ? 'Loading…' : 'Whole source (no specific medium)'}</option>
                  {subSources.map((ss) => (
                    <option key={ss.id} value={ss.id}>{ss.sub_source_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Campaign Name <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional — stamped on the lead)</span></label>
                <input
                  style={inputStyle}
                  value={form.campaign_name}
                  placeholder="e.g. Vinayagar Chaturthi Offer"
                  onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))}
                />
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', border: '1px solid var(--border-primary)', borderRadius: 8, background: form.assign_all_telecallers ? '#f0fdf4' : 'var(--bg-primary)' }}>
                  <input
                    type="checkbox"
                    checked={form.assign_all_telecallers}
                    onChange={(e) => setForm((f) => ({ ...f, assign_all_telecallers: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Assign to all telecallers</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(round-robin across everyone)</span>
                </label>
              </div>

              {!form.assign_all_telecallers && (
                <div>
                  <label style={labelStyle}>Select Telecallers</label>
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    <MagnifyingGlassIcon style={{ width: 15, height: 15, position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                    <input
                      style={{ ...inputStyle, paddingLeft: 32 }}
                      placeholder="Search telecallers…"
                      value={tcSearch}
                      onChange={(e) => setTcSearch(e.target.value)}
                    />
                  </div>

                  <div style={{ border: '1px solid var(--border-primary)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border-primary)', cursor: 'pointer', background: 'var(--bg-secondary)', position: 'sticky', top: 0 }}>
                      <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} style={{ width: 16, height: 16 }} />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        Select all{tcSearch ? ' (filtered)' : ''} · {form.telecaller_ids.length} selected
                      </span>
                    </label>
                    {filteredTelecallers.length === 0 && (
                      <div style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>No telecallers found.</div>
                    )}
                    {filteredTelecallers.map((t) => {
                      const checked = form.telecaller_ids.map(String).includes(String(t.id));
                      return (
                        <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--border-primary)', cursor: 'pointer', background: checked ? '#eff6ff' : 'transparent' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleTc(t.id)} style={{ width: 16, height: 16 }} />
                          <span style={{ fontSize: 13 }}>
                            <span style={{ fontWeight: 600 }}>{userName(t)}</span>
                            {t.email && <span style={{ color: 'var(--text-muted)' }}> · {t.email}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Active</span>
                </label>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : (form.id ? 'Update Rule' : 'Create Rule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DidNumberRules;
