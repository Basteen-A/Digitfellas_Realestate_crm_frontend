import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  MegaphoneIcon, PlusIcon, PencilSquareIcon, TrashIcon,
  MagnifyingGlassIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import marketingAllocationRuleApi from '../../../api/marketingAllocationRuleApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { getErrorMessage } from '../../../utils/helpers';

const th = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '12px', fontSize: 13, color: 'var(--text-primary)', borderTop: '1px solid var(--border-primary)', verticalAlign: 'top' };
const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

const userName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || '—' : '—');

const EMPTY_FORM = { id: null, rule_name: '', lead_source_id: '', lead_sub_source_id: '', assign_all_telecallers: false, telecaller_ids: [], is_active: true };

const MarketingAllocationRules = () => {
  const [rules, setRules] = useState([]);
  const [sources, setSources] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [tcSearch, setTcSearch] = useState('');
  // Sub-sources for the source currently selected in the form
  const [subSources, setSubSources] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await marketingAllocationRuleApi.getAll({ limit: 100 });
      setRules(resp.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load allocation rules'));
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

  const sourceById = useMemo(() => {
    const m = {};
    sources.forEach((s) => { m[s.id] = s; });
    return m;
  }, [sources]);
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

  // Load the sub-sources belonging to a source (for the optional sub-source picker).
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
      lead_source_id: rule.lead_source_id || '',
      lead_sub_source_id: rule.lead_sub_source_id || '',
      assign_all_telecallers: !!rule.assign_all_telecallers,
      telecaller_ids: Array.isArray(rule.telecaller_ids) ? rule.telecaller_ids.map(String) : [],
      is_active: rule.is_active !== false,
    });
    setTcSearch('');
    setModalOpen(true);
    loadSubSources(rule.lead_source_id);
  };
  const closeModal = () => { if (!saving) setModalOpen(false); };

  // When the source changes in the form, reset + reload its sub-sources.
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
    if (!form.lead_source_id) { toast.error('Select a lead source'); return; }
    if (!form.assign_all_telecallers && form.telecaller_ids.length === 0) {
      toast.error('Select at least one telecaller, or enable "All telecallers"');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        rule_name: form.rule_name.trim(),
        lead_source_id: form.lead_source_id,
        lead_sub_source_id: form.lead_sub_source_id || null,
        assign_all_telecallers: form.assign_all_telecallers,
        telecaller_ids: form.assign_all_telecallers ? [] : form.telecaller_ids,
        is_active: form.is_active,
      };
      if (form.id) {
        await marketingAllocationRuleApi.update(form.id, payload);
        toast.success('Rule updated');
      } else {
        await marketingAllocationRuleApi.create(payload);
        toast.success('Rule created');
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
      await marketingAllocationRuleApi.toggleStatus(rule.id);
      loadRules();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to toggle status'));
    }
  };

  const remove = async (rule) => {
    if (!window.confirm(`Delete allocation rule "${rule.rule_name}"? Incoming leads from this source will stop being auto-allocated.`)) return;
    try {
      await marketingAllocationRuleApi.delete(rule.id);
      toast.success('Rule deleted');
      loadRules();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete rule'));
    }
  };

  // Sub-source ids already taken (for the *current* source) so we don't offer a
  // duplicate target. The source-level slot (empty value) is taken when a
  // source-level rule already exists for this source.
  const takenForSource = useMemo(() => {
    const subs = new Set();
    let sourceLevelTaken = false;
    rules.forEach((r) => {
      if (form.id && r.id === form.id) return;
      if (String(r.lead_source_id) !== String(form.lead_source_id)) return;
      if (r.lead_sub_source_id) subs.add(String(r.lead_sub_source_id));
      else sourceLevelTaken = true;
    });
    return { subs, sourceLevelTaken };
  }, [rules, form.id, form.lead_source_id]);

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
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="page-header flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="page-header-left">
          <h1><MegaphoneIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />Marketing Lead Allocation</h1>
          <p className="hidden sm:block">Route inbound leads from Facebook, WhatsApp, Website &amp; other sources to telecallers in round-robin</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={loadRules} disabled={loading}>
            <ArrowPathIcon style={{ width: 15, height: 15 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openCreate}>
            <PlusIcon style={{ width: 16, height: 16 }} /> New Rule
          </button>
        </div>
      </div>

      {/* Ingestion endpoint hint */}
      <div className="crm-card" style={{ padding: 14, marginBottom: 14, borderLeft: '4px solid #2563eb' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Inbound Lead API</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          External sources push leads to{' '}
          <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>POST /api/v1/marketing/leads</code>{' '}
          with header{' '}
          <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>X-API-Key: &lt;MARKETING_INGEST_API_KEY&gt;</code>.
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Body: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{'{ "source": "Facebook", "sub_source": "Lead Form", "name": "...", "phone": "...", "email": "...", "campaign_name": "..." }'}</code>
            {' '}— the lead is created and auto-assigned to the next telecaller in the matching rule below (a sub-source rule wins over the whole-source rule).
          </div>
        </div>
      </div>

      <div className="crm-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={th}>Rule</th>
                <th style={th}>Source</th>
                <th style={th}>Telecallers (Round-robin)</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={5}>Loading…</td></tr>
              )}
              {!loading && rules.length === 0 && (
                <tr><td style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }} colSpan={5}>No allocation rules yet. Create one to start auto-assigning marketing leads.</td></tr>
              )}
              {!loading && rules.map((rule) => {
                const src = rule.leadSource || sourceById[rule.lead_source_id];
                return (
                  <tr key={rule.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{rule.rule_name}</div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: `${src?.color_code || '#6B7280'}22`, color: src?.color_code || '#6B7280' }}>
                        {src?.source_name || '—'}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="crm-card"
            style={{ width: '100%', maxWidth: 560, marginTop: 40, padding: 0, background: 'var(--bg-primary)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{form.id ? 'Edit Allocation Rule' : 'New Allocation Rule'}</h2>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={closeModal}>✕</button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Rule Name</label>
                <input
                  style={inputStyle}
                  value={form.rule_name}
                  placeholder="e.g. Facebook Campaign Leads"
                  onChange={(e) => setForm((f) => ({ ...f, rule_name: e.target.value }))}
                />
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
                <label style={labelStyle}>Sub-Source <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                <select
                  style={{ ...inputStyle, opacity: form.lead_source_id ? 1 : 0.6 }}
                  value={form.lead_sub_source_id}
                  disabled={!form.lead_source_id || loadingSubs}
                  onChange={(e) => setForm((f) => ({ ...f, lead_sub_source_id: e.target.value }))}
                >
                  <option value="" disabled={takenForSource.sourceLevelTaken}>
                    {loadingSubs ? 'Loading…' : `Whole source (any sub-source)${takenForSource.sourceLevelTaken ? ' — already configured' : ''}`}
                  </option>
                  {subSources.map((ss) => {
                    const taken = takenForSource.subs.has(String(ss.id));
                    return (
                      <option key={ss.id} value={ss.id} disabled={taken}>
                        {ss.sub_source_name}{taken ? ' — already configured' : ''}
                      </option>
                    );
                  })}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Leave as “Whole source” for a catch-all rule, or pick a sub-source for a more specific rule. A sub-source rule always wins over the whole-source rule.
                </div>
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

export default MarketingAllocationRules;
