// ============================================================
// CAMPAIGNS › BUDGET ENTRY
// The spend ledger every cost-per figure on this page divides by.
// One line = Budget + Campaign + Source + Sub Source(s) + a FROM/TO date range. The
// range is what the leads and conversions are counted over, and the reports pro-rate the
// amount by day, so a line that only partly overlaps the report window contributes only
// its share.
//
// ── The form follows the way the spend is described ─────────────────────────
// Source → Sub Source(s) → Campaign → Period → Amount. Each step narrows the next: the
// sub-source list comes from the chosen source, and the campaign list comes from the
// campaigns the LEADS of that source / sub-source already carry (the marketing lead API
// sends campaign_name with every lead). Picking from that list is what makes a budget
// line and its leads meet; the same field also takes a name typed by hand, for a campaign
// that has not produced a lead yet.
//
// ── One line, several sub-sources ───────────────────────────────────────────
// A campaign usually runs across more than one sub-source on a single budget, so Sub
// Source is a multi-select. The source total is always the amount recorded; the
// sub-source report splits it evenly across the sub-sources listed, which is stated on
// the form so nobody reads that split as a measurement.
//
// Leaving Sub Source empty books the spend against the WHOLE source: it counts in the
// source totals and shows under "Not specified" on the sub-source view, which is the
// same bucket leads carrying no sub-source fall into - so spend and volume line up.
//
// The server refuses a second live line whose period OVERLAPS an existing one for the
// same sub-source, because overlapping spend is counted twice and skews every cost-per
// metric while looking perfectly legitimate on screen. The conflict comes back as a plain
// message naming the clashing period, surfaced here as-is.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, BanknotesIcon,
  ChevronDownIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import marketingBudgetApi from '../../../api/marketingBudgetApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { formatCurrencyExact } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { Card, Table, Tr, Td, TotalRow } from '../Reports/analytics/ui';
import BudgetDrawer from './BudgetDrawer';

const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const hintStyle = { fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 };

const money = (v) => formatCurrencyExact(Number(v) || 0);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

// A DATEONLY column comes back as 'YYYY-MM-DD' - exactly what <input type="date"> wants,
// so it is used verbatim rather than round-tripped through a Date (which would shift the
// day for anyone east of UTC).
const toInputDate = (v) => {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const todayInput = () => toInputDate(new Date());

const EMPTY_FORM = {
  id: null, lead_source_id: '', lead_sub_source_ids: [], campaign_name: '',
  start_date: '', end_date: '', amount: '', remarks: '',
};

// Inclusive day count - the divisor the server pro-rates by, echoed in the form so the
// per-day figure is visible before saving.
const dayCount = (a, b) => {
  if (!a || !b) return 0;
  const days = Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) + 1;
  return days > 0 ? days : 0;
};

// "01 Sep 2026 – 30 Sep 2026", or just the one date when the period is a single day.
const fmtPeriod = (a, b) => {
  if (!a) return '-';
  if (!b || a === b) return fmtDate(a);
  return `${fmtDate(a)} – ${fmtDate(b)}`;
};

// A row's sub-source targets, whatever shape the server sent them in.
const rowSubSourceNames = (r) => {
  if (r.sub_source_names?.length) return r.sub_source_names;
  const single = r.sub_source_name || r.leadSubSource?.sub_source_name;
  return single ? [single] : [];
};

// ── Sub-source multi-select ──────────────────────────────────────────────────
// Rolled by hand rather than pulled in from a library: the page has no combobox
// dependency and the rest of the form is native controls, so a bespoke <select multiple>
// replacement would look like a different app. Closes on outside click and on Escape.
const SubSourceMultiSelect = ({ options, value, onChange, disabled, loading }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const selectedNames = options.filter((o) => value.includes(o.id)).map((o) => o.sub_source_name);
  const summary = loading
    ? 'Loading…'
    : (selectedNames.length ? selectedNames.join(', ') : 'Whole source (not split by sub-source)');

  return (
    <div className="mm-multi" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        style={{
          ...inputStyle,
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
        aria-expanded={open}
      >
        <span style={{
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: selectedNames.length ? 'var(--text-primary)' : 'var(--text-muted)',
        }}
        >
          {summary}
        </span>
        {value.length > 1 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{value.length} selected</span>
        )}
        <ChevronDownIcon style={{ width: 15, height: 15, flexShrink: 0, opacity: 0.6 }} />
      </button>

      {open && !disabled && (
        <div className="mm-multi__panel">
          {options.length === 0 && (
            <div style={{ padding: '10px 9px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              This source has no sub-sources.
            </div>
          )}
          {options.length > 0 && (
            <button type="button" className="mm-multi__opt" onClick={() => onChange([])}>
              <span style={{ width: 15, flexShrink: 0 }}>{value.length === 0 ? <CheckIcon style={{ width: 15, height: 15 }} /> : null}</span>
              <span style={{ color: 'var(--text-muted)' }}>Whole source</span>
            </button>
          )}
          {options.map((o) => (
            <button type="button" key={o.id} className="mm-multi__opt" onClick={() => toggle(o.id)}>
              <span style={{ width: 15, flexShrink: 0 }}>
                {value.includes(o.id) ? <CheckIcon style={{ width: 15, height: 15 }} /> : null}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.sub_source_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const BudgetEntry = ({ sources, from, to, sourceId, subSourceId, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSubs, setFormSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [drawerId, setDrawerId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketingBudgetApi.getAll({
        limit: 100,
        from: from || undefined,
        to: to || undefined,
        lead_source_id: sourceId || undefined,
        lead_sub_source_id: subSourceId || undefined,
      });
      setRows(res.data || []);
      setTotal(Number(res.meta?.totalAmount) || 0);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load budgets'));
      setRows([]);
      setTotal(0);
    } finally { setLoading(false); }
  }, [from, to, sourceId, subSourceId]);

  useEffect(() => { load(); }, [load]);

  // Sub-source list follows the source picked IN THE FORM (not the page filter).
  useEffect(() => {
    if (!form.lead_source_id) { setFormSubs([]); return; }
    setLoadingSubs(true);
    leadSubSourceApi.getBySource(form.lead_source_id)
      .then((r) => setFormSubs(r.data || []))
      .catch(() => setFormSubs([]))
      .finally(() => setLoadingSubs(false));
  }, [form.lead_source_id]);

  // Campaign suggestions follow the source AND the chosen sub-sources: the point is to
  // offer the names the leads that this budget will be measured against actually carry.
  const subKey = form.lead_sub_source_ids.join(',');
  useEffect(() => {
    if (!modalOpen || !form.lead_source_id) { setCampaigns([]); return; }
    let alive = true;
    setLoadingCampaigns(true);
    marketingBudgetApi.getCampaignNames({
      leadSourceId: form.lead_source_id,
      subSourceIds: subKey ? subKey.split(',') : [],
    })
      .then((r) => { if (alive) setCampaigns(r.data || []); })
      .catch(() => { if (alive) setCampaigns([]); })
      .finally(() => { if (alive) setLoadingCampaigns(false); });
    return () => { alive = false; };
  }, [modalOpen, form.lead_source_id, subKey]);

  const openCreate = () => {
    // Default to the report's own window when one is set - that is almost always the
    // period the spend being entered belongs to.
    setForm({
      ...EMPTY_FORM,
      lead_source_id: sourceId || '',
      lead_sub_source_ids: sourceId && subSourceId ? [subSourceId] : [],
      start_date: toInputDate(from) || todayInput(),
      end_date: toInputDate(to) || todayInput(),
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      lead_source_id: row.lead_source_id || '',
      lead_sub_source_ids: row.sub_source_ids?.length
        ? row.sub_source_ids
        : (row.lead_sub_source_id ? [row.lead_sub_source_id] : []),
      campaign_name: row.campaign_name || '',
      start_date: toInputDate(row.start_date),
      end_date: toInputDate(row.end_date),
      amount: String(row.amount ?? ''),
      remarks: row.remarks || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { if (!saving) { setModalOpen(false); setForm(EMPTY_FORM); } };

  const save = async () => {
    if (!form.lead_source_id) { toast.error('Pick a source'); return; }
    if (!form.start_date) { toast.error('Pick a From date'); return; }
    if (!form.end_date) { toast.error('Pick a To date'); return; }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast.error('To date cannot be before the From date'); return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) { toast.error('Enter a valid budget amount'); return; }

    setSaving(true);
    try {
      const payload = {
        lead_source_id: form.lead_source_id,
        lead_sub_source_ids: form.lead_sub_source_ids,
        campaign_name: form.campaign_name.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date,
        amount,
        remarks: form.remarks || null,
      };
      if (form.id) await marketingBudgetApi.update(form.id, payload);
      else await marketingBudgetApi.create(payload);
      toast.success(form.id ? 'Budget updated' : 'Budget recorded');
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await load();
      // The cost-per reports divide by this ledger - refresh them too.
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save budget'));
    } finally { setSaving(false); }
  };

  const remove = async (row) => {
    const names = rowSubSourceNames(row);
    const label = `${row.source_name || 'this source'}${names.length ? ` › ${names.join(', ')}` : ''} for ${fmtPeriod(row.start_date, row.end_date)}`;
    if (!window.confirm(`Delete the ${money(row.amount)} budget for ${label}?`)) return;
    try {
      await marketingBudgetApi.delete(row.id);
      toast.success('Budget deleted');
      if (drawerId === row.id) setDrawerId(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete budget'));
    }
  };

  // A campaign the leads already know about, matched case-insensitively - the same rule
  // the server matches on, so what the hint says is what the report will find.
  const typedCampaign = form.campaign_name.trim().toLowerCase();
  const knownCampaign = campaigns.find((c) => String(c.campaign_name).trim().toLowerCase() === typedCampaign);

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${rows.length} line${rows.length === 1 ? '' : 's'} in this period`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={load} disabled={loading}>
            <ArrowPathIcon style={{ width: 14, height: 14 }} /> Refresh
          </button>
          <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openCreate}>
            <PlusIcon style={{ width: 14, height: 14 }} /> Add Budget
          </button>
        </div>
      </div>

      <Card
        title="Budget Ledger"
        sub="Spend recorded against a campaign, source and sub-source over a date range - open a row for what it returned"
        right={`Total ${money(total)}`}
      >
        <Table
          head={['Period', 'Days', 'Campaign', 'Source', 'Sub Source', 'Budget', 'Per day', 'Remarks', '']}
          colSpan={9}
          empty={!loading && rows.length === 0}
          emptyLabel="No budget recorded for this period. Add a line to start measuring cost per lead."
        >
          {rows.map((r) => {
            const names = rowSubSourceNames(r);
            return (
              <Tr key={r.id} onClick={() => setDrawerId(r.id)}>
                <Td bold>{fmtPeriod(r.start_date, r.end_date)}</Td>
                <Td className="opacity-70">{r.day_count || dayCount(r.start_date, r.end_date) || '-'}</Td>
                <Td className={r.campaign_name ? '' : 'opacity-60'}>{r.campaign_name || 'Not tied to a campaign'}</Td>
                <Td>{r.source_name || r.leadSource?.source_name || '-'}</Td>
                <Td className={names.length ? '' : 'opacity-60'}>
                  {names.length ? names.join(', ') : 'Whole source'}
                </Td>
                <Td bold>{money(r.amount)}</Td>
                <Td className="opacity-70">
                  {(() => {
                    const d = r.day_count || dayCount(r.start_date, r.end_date);
                    return d > 0 ? money((Number(r.amount) || 0) / d) : '-';
                  })()}
                </Td>
                <Td className="opacity-70">{r.remarks || '-'}</Td>
                <Td className="whitespace-nowrap text-right">
                  <button
                    className="crm-btn crm-btn-ghost crm-btn-sm"
                    onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                    title="Edit"
                  >
                    <PencilSquareIcon style={{ width: 15, height: 15 }} />
                  </button>
                  <button
                    className="crm-btn crm-btn-ghost crm-btn-sm"
                    onClick={(e) => { e.stopPropagation(); remove(r); }}
                    title="Delete"
                    style={{ color: '#dc2626' }}
                  >
                    <TrashIcon style={{ width: 15, height: 15 }} />
                  </button>
                </Td>
              </Tr>
            );
          })}
          {rows.length > 0 && <TotalRow cells={['', '', '', '', money(total), '', '', '']} label="Total" />}
        </Table>
      </Card>

      {drawerId && <BudgetDrawer budgetId={drawerId} onClose={() => setDrawerId(null)} />}

      {modalOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="crm-card"
            style={{ width: '100%', maxWidth: 520, margin: '20px auto', maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, background: 'var(--bg-primary)' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BanknotesIcon style={{ width: 18, height: 18 }} />
                {form.id ? 'Edit Budget' : 'Add Budget'}
              </h2>
              <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={closeModal}>✕</button>
            </div>

            {/* Source → Sub Source → Campaign → Period → Amount: each step narrows
                the next, so the campaign list is already scoped by the time it is read. */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
              <div>
                <label style={labelStyle} htmlFor="bg-source">Source</label>
                <select
                  id="bg-source"
                  style={inputStyle}
                  value={form.lead_source_id}
                  onChange={(e) => setForm((f) => ({
                    ...f, lead_source_id: e.target.value, lead_sub_source_ids: [], campaign_name: '',
                  }))}
                >
                  <option value="">Select a source…</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Sub Source <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional, pick any number)</span>
                </label>
                <SubSourceMultiSelect
                  options={formSubs}
                  value={form.lead_sub_source_ids}
                  disabled={!form.lead_source_id}
                  loading={loadingSubs}
                  onChange={(ids) => setForm((f) => ({ ...f, lead_sub_source_ids: ids }))}
                />
                <div style={hintStyle}>
                  {form.lead_sub_source_ids.length > 1
                    ? `This budget covers ${form.lead_sub_source_ids.length} sub-sources. The source total stays ${money(form.amount)} - the sub-source report divides it evenly between them.`
                    : 'Left empty, this spend counts in the source total and shows as Not specified on the sub-source report.'}
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="bg-campaign">
                  Campaign Name <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input
                  id="bg-campaign"
                  list="bg-campaign-options"
                  style={inputStyle}
                  maxLength={200}
                  autoComplete="off"
                  placeholder={form.lead_source_id ? 'Pick a campaign the leads already carry, or type a new one' : 'Pick a source first'}
                  disabled={!form.lead_source_id}
                  value={form.campaign_name}
                  onChange={(e) => setForm((f) => ({ ...f, campaign_name: e.target.value }))}
                />
                <datalist id="bg-campaign-options">
                  {campaigns.map((c) => (
                    <option key={c.campaign_name} value={c.campaign_name}>
                      {c.lead_count > 0 ? `${c.lead_count} lead${c.lead_count === 1 ? '' : 's'}` : 'From an earlier budget'}
                    </option>
                  ))}
                </datalist>
                <div style={hintStyle}>
                  {(() => {
                    if (!form.lead_source_id) return 'The campaigns your lead API is sending appear here once a source is selected.';
                    if (loadingCampaigns) return 'Loading campaigns…';
                    if (knownCampaign) {
                      return knownCampaign.lead_count > 0
                        ? `Matched — ${knownCampaign.lead_count} lead${knownCampaign.lead_count === 1 ? '' : 's'} already carry this campaign for this source.`
                        : 'Matched a campaign from an earlier budget line. No leads carry it yet.';
                    }
                    if (typedCampaign) return 'New campaign name. It will only report leads whose campaign matches it exactly (case and spacing are ignored).';
                    if (campaigns.length) return `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} known for this selection. Leave blank to budget the source as a whole.`;
                    return 'No campaigns recorded for this selection yet. Leave blank to budget the source as a whole.';
                  })()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle} htmlFor="bg-from">From date</label>
                  <input
                    id="bg-from"
                    style={inputStyle}
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      start_date: e.target.value,
                      // Keep the range valid as you type rather than erroring on save.
                      end_date: f.end_date && f.end_date < e.target.value ? e.target.value : f.end_date,
                    }))}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="bg-to">To date</label>
                  <input
                    id="bg-to"
                    style={inputStyle}
                    type="date"
                    min={form.start_date || undefined}
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1', ...hintStyle, marginTop: -4 }}>
                  {(() => {
                    const d = dayCount(form.start_date, form.end_date);
                    const amt = Number(form.amount) || 0;
                    if (!d) return 'Leads and conversions are counted over this period.';
                    const per = amt > 0 ? ` · ${money(amt / d)} per day` : '';
                    return `${d} day${d === 1 ? '' : 's'}${per} - leads and conversions in this window are what the cost-per figures divide by.`;
                  })()}
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="bg-amount">Budget</label>
                <input
                  id="bg-amount"
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 50000"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
                {Number(form.amount) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>{money(form.amount)}</div>
                )}
              </div>

              <div>
                <label style={labelStyle} htmlFor="bg-remarks">
                  Remarks <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input
                  id="bg-remarks"
                  style={inputStyle}
                  maxLength={500}
                  placeholder="e.g. Diwali campaign - creative A"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="crm-btn crm-btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="crm-btn crm-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : (form.id ? 'Save Changes' : 'Add Budget')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BudgetEntry;
