// ============================================================
// MARKETING METRIX › BUDGET ENTRY
// The spend ledger every cost-per figure on this page divides by.
// One line = Budget + Source + Sub Source + Date — the four fields the brief asks for.
//
// Leaving Sub Source blank books the spend against the WHOLE source: it counts in the
// source totals and shows under "Not specified" on the sub-source view, which is the
// same bucket leads carrying no sub-source fall into — so spend and volume line up.
//
// The server refuses a second live line for the same source / sub-source / day, because
// a duplicate silently doubles the spend and halves every cost-per metric. The conflict
// comes back as a plain message, surfaced here as-is.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, BanknotesIcon,
} from '@heroicons/react/24/outline';
import marketingBudgetApi from '../../../api/marketingBudgetApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import { formatCurrencyExact } from '../../../utils/formatters';
import { getErrorMessage } from '../../../utils/helpers';
import { Card, Table, Tr, Td, TotalRow } from '../Reports/analytics/ui';

const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };

const money = (v) => formatCurrencyExact(Number(v) || 0);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// A DATEONLY column comes back as 'YYYY-MM-DD' — exactly what <input type="date"> wants,
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

const EMPTY_FORM = { id: null, lead_source_id: '', lead_sub_source_id: '', spend_date: '', amount: '', remarks: '' };

const BudgetEntry = ({ sources, from, to, sourceId, subSourceId, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formSubs, setFormSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

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

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, lead_source_id: sourceId || '', spend_date: todayInput() });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      id: row.id,
      lead_source_id: row.lead_source_id || '',
      lead_sub_source_id: row.lead_sub_source_id || '',
      spend_date: toInputDate(row.spend_date),
      amount: String(row.amount ?? ''),
      remarks: row.remarks || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => { if (!saving) { setModalOpen(false); setForm(EMPTY_FORM); } };

  const save = async () => {
    if (!form.lead_source_id) { toast.error('Pick a source'); return; }
    if (!form.spend_date) { toast.error('Pick a date'); return; }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) { toast.error('Enter a valid budget amount'); return; }

    setSaving(true);
    try {
      const payload = {
        lead_source_id: form.lead_source_id,
        lead_sub_source_id: form.lead_sub_source_id || null,
        spend_date: form.spend_date,
        amount,
        remarks: form.remarks || null,
      };
      if (form.id) await marketingBudgetApi.update(form.id, payload);
      else await marketingBudgetApi.create(payload);
      toast.success(form.id ? 'Budget updated' : 'Budget recorded');
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await load();
      // The cost-per reports divide by this ledger — refresh them too.
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save budget'));
    } finally { setSaving(false); }
  };

  const remove = async (row) => {
    const label = `${row.source_name || 'this source'}${row.sub_source_name ? ` › ${row.sub_source_name}` : ''} on ${fmtDate(row.spend_date)}`;
    if (!window.confirm(`Delete the ${money(row.amount)} budget for ${label}?`)) return;
    try {
      await marketingBudgetApi.delete(row.id);
      toast.success('Budget deleted');
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete budget'));
    }
  };

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
        sub="Spend recorded against a source / sub-source on a date"
        right={`Total ${money(total)}`}
      >
        <Table
          head={['Date', 'Source', 'Sub Source', 'Budget', 'Remarks', '']}
          colSpan={6}
          empty={!loading && rows.length === 0}
          emptyLabel="No budget recorded for this period. Add a line to start measuring cost per lead."
        >
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td bold>{fmtDate(r.spend_date)}</Td>
              <Td>{r.source_name || r.leadSource?.source_name || '—'}</Td>
              <Td className={r.lead_sub_source_id ? '' : 'opacity-60'}>
                {r.sub_source_name || r.leadSubSource?.sub_source_name || 'Whole source'}
              </Td>
              <Td bold>{money(r.amount)}</Td>
              <Td className="opacity-70">{r.remarks || '—'}</Td>
              <Td className="whitespace-nowrap text-right">
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => openEdit(r)} title="Edit">
                  <PencilSquareIcon style={{ width: 15, height: 15 }} />
                </button>
                <button className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => remove(r)} title="Delete" style={{ color: '#dc2626' }}>
                  <TrashIcon style={{ width: 15, height: 15 }} />
                </button>
              </Td>
            </Tr>
          ))}
          {rows.length > 0 && <TotalRow cells={['', '', money(total), '', '']} label="Total" />}
        </Table>
      </Card>

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

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
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
                <label style={labelStyle} htmlFor="bg-source">Source</label>
                <select
                  id="bg-source"
                  style={inputStyle}
                  value={form.lead_source_id}
                  onChange={(e) => setForm((f) => ({ ...f, lead_source_id: e.target.value, lead_sub_source_id: '' }))}
                >
                  <option value="">Select a source…</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="bg-subsource">
                  Sub Source <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <select
                  id="bg-subsource"
                  style={{ ...inputStyle, opacity: form.lead_source_id ? 1 : 0.6 }}
                  value={form.lead_sub_source_id}
                  disabled={!form.lead_source_id || loadingSubs}
                  onChange={(e) => setForm((f) => ({ ...f, lead_sub_source_id: e.target.value }))}
                >
                  <option value="">{loadingSubs ? 'Loading…' : 'Whole source (not split by sub-source)'}</option>
                  {formSubs.map((ss) => <option key={ss.id} value={ss.id}>{ss.sub_source_name}</option>)}
                </select>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>
                  Left blank, this spend counts in the source total and shows as
                  {' '}
                  <strong>Not specified</strong> on the sub-source report.
                </div>
              </div>

              <div>
                <label style={labelStyle} htmlFor="bg-date">Date</label>
                <input
                  id="bg-date"
                  style={inputStyle}
                  type="date"
                  value={form.spend_date}
                  onChange={(e) => setForm((f) => ({ ...f, spend_date: e.target.value }))}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="bg-remarks">
                  Remarks <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input
                  id="bg-remarks"
                  style={inputStyle}
                  maxLength={500}
                  placeholder="e.g. Diwali campaign — creative A"
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
