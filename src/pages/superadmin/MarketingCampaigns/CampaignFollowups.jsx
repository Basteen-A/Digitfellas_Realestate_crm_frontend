// ============================================================
// PANEL: Campaign follow-ups (the scheduled second touch)
//
// Lives on the campaign report. Lets an admin say, in one form:
//   "1 day after this campaign reached someone, if they still have not
//    replied, send them template X."
//
// The audience choices are not invented here - they come from the server
// (GET /campaigns/followups/meta), which derives them from the same SQL the
// scheduler runs. That is deliberate: a dropdown that drifts from the engine is
// how a marketing tool ends up messaging the wrong people.
//
// When a rule fires it materialises an ORDINARY campaign, so the "Sent so far"
// figures below link straight into a normal campaign report.
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ClockIcon, PlusIcon, PlayIcon, PauseIcon, TrashIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import whatsappCampaignApi from '../../../api/whatsappCampaignApi';
import { getErrorMessage } from '../../../utils/helpers';
import HeaderMediaInput from './HeaderMediaInput';
import '../../portals/collection/CollectionWorkspace.css';

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
// Colour lives only inside badges, per the app-wide convention - these are the
// badge-system classes the rest of the product uses.
const STATUS_BADGE = {
  SCHEDULED: 'col-badge-new-status',
  RUNNING: 'col-badge-unverified',
  SENT: 'col-badge-verified',
  CANCELLED: 'col-badge-neutral',
  FAILED: 'col-badge-rejected',
  PAUSED: 'col-badge-pending',
};

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

// "1 day" / "6 hours" / "45 minutes" - read back the stored minutes in the
// largest unit that divides cleanly, which is how the admin typed it.
const fmtDelay = (minutes) => {
  const m = Number(minutes) || 0;
  if (m === 0) return 'immediately';
  if (m % 1440 === 0) { const d = m / 1440; return `${d} day${d === 1 ? '' : 's'}`; }
  if (m % 60 === 0) { const h = m / 60; return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${m} minute${m === 1 ? '' : 's'}`;
};

// Quick picks for the delay. Hours and minutes were always accepted - they
// just sat inside a collapsed <select> that read "days", so the shorter delays
// were invisible unless you thought to open it. Chips put the whole range on
// screen; the Custom row underneath still takes any value.
const DELAY_PRESETS = [
  { label: '30 minutes', value: 30, unit: 'minutes' },
  { label: '1 hour', value: 1, unit: 'hours' },
  { label: '3 hours', value: 3, unit: 'hours' },
  { label: '6 hours', value: 6, unit: 'hours' },
  { label: '12 hours', value: 12, unit: 'hours' },
  { label: '1 day', value: 1, unit: 'days' },
  { label: '2 days', value: 2, unit: 'days' },
  { label: '3 days', value: 3, unit: 'days' },
  { label: '1 week', value: 7, unit: 'days' },
];

const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 };

// Whatever the form currently adds up to, in minutes - the one number the
// server actually stores, and what decides which chip is lit.
const formMinutes = (form) => (Number(form.delay_value) || 0) * (UNIT_MINUTES[form.delay_unit] || 1);

const EMPTY_FORM = {
  name: '',
  template_id: '',
  audience: 'DELIVERED_NO_REPLY',
  anchor: 'RECIPIENT',
  delay_value: 1,
  delay_unit: 'days',
  header_image_url: '',
};

const CampaignFollowups = ({ campaign, templates = [] }) => {
  const navigate = useNavigate();
  const campaignId = campaign?.id;

  const [followups, setFollowups] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!campaignId) return;
    if (!silent) setLoading(true);
    try {
      const resp = await whatsappCampaignApi.getFollowups(campaignId);
      setFollowups(resp.data || []);
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err, 'Failed to load follow-ups'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const resp = await whatsappCampaignApi.getFollowupMeta();
        setMeta(resp.data);
      } catch {
        /* the form falls back to its own defaults */
      }
    })();
  }, []);

  // Memoised so the `|| []` fallback does not mint a new array every render
  // and re-run everything downstream that depends on it.
  const audiences = useMemo(() => meta?.audiences || [], [meta]);
  const anchors = useMemo(() => meta?.anchors || [], [meta]);
  const anchorHint = useMemo(
    () => anchors.find((a) => a.value === form.anchor)?.hint || '',
    [anchors, form.anchor]
  );

  // Approved templates only: a pending or rejected one would be refused by
  // WhatsApp hours later, when nobody is watching the rule fire.
  const sendableTemplates = useMemo(
    () => templates.filter((t) => t.is_active !== false && (!t.status || t.status === 'APPROVED')),
    [templates]
  );

  // Refresh the audience count whenever the slice changes - "who is this
  // actually going to?" answered before the rule is saved, not after.
  useEffect(() => {
    if (!showForm || !campaignId || !form.audience) { setPreview(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await whatsappCampaignApi.previewFollowup(campaignId, { audience: form.audience });
        if (!cancelled) setPreview(resp.data);
      } catch {
        if (!cancelled) setPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [showForm, campaignId, form.audience]);

  // Drives both the lit chip and the plain-language read-back below the form.
  const currentMinutes = formMinutes(form);

  const openForm = () => {
    setForm({ ...EMPTY_FORM, name: `${campaign?.name || 'Campaign'} - follow-up` });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Give the follow-up a name.'); return; }
    if (!form.template_id) { toast.error('Pick the template to send.'); return; }

    setSaving(true);
    try {
      const resp = await whatsappCampaignApi.createFollowup(campaignId, {
        name: form.name.trim(),
        template_id: form.template_id,
        audience: form.audience,
        anchor: form.anchor,
        delay_value: Number(form.delay_value) || 0,
        delay_unit: form.delay_unit,
        header_image_url: form.header_image_url || null,
      });
      toast.success(resp.message || 'Follow-up scheduled');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not schedule the follow-up'));
    } finally {
      setSaving(false);
    }
  };

  const act = async (id, fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(id);
    try {
      const resp = await fn(id);
      toast.success(resp.message || 'Done');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="col-card-new" style={{ marginTop: 16 }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClockIcon style={{ width: 16, height: 16 }} /> Scheduled Follow-ups
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Chase the people this campaign reached but who never wrote back - automatically, a set time after they got it.
          </div>
        </div>
        <button className="crm-btn crm-btn-primary crm-btn-sm" onClick={openForm} disabled={showForm}>
          <PlusIcon style={{ width: 15, height: 15 }} /> Schedule Follow-up
        </button>
      </div>

      {/* ── Builder ── */}
      {showForm && (
        <form onSubmit={submit} style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Follow-up Name *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Silver Divyam - second touch"
              />
            </div>
            <div>
              <label style={labelStyle}>Template *</label>
              <select style={selectStyle} value={form.template_id} onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}>
                <option value="">Select a template…</option>
                {sendableTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Send it to</label>
              <select style={selectStyle} value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
                {audiences.length === 0 && <option value="DELIVERED_NO_REPLY">Delivered to the phone, but never replied</option>}
                {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, minHeight: 16 }}>
                {preview
                  ? <span><strong style={{ color: 'var(--text-primary)' }}>{preview.total}</strong> recipient(s) match right now</span>
                  : 'Counting…'}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Wait how long</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DELAY_PRESETS.map((d) => {
                  const active = currentMinutes === d.value * UNIT_MINUTES[d.unit];
                  return (
                    <button
                      key={d.label}
                      type="button"
                      className={`crm-btn crm-btn-sm ${active ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
                      onClick={() => setForm((f) => ({ ...f, delay_value: d.value, delay_unit: d.unit }))}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>or</span>
                <input
                  type="number"
                  min="0"
                  aria-label="Custom delay amount"
                  style={{ ...inputStyle, width: 80 }}
                  value={form.delay_value}
                  onChange={(e) => setForm((f) => ({ ...f, delay_value: e.target.value }))}
                />
                <select
                  aria-label="Custom delay unit"
                  style={{ ...selectStyle, width: 110 }}
                  value={form.delay_unit}
                  onChange={(e) => setForm((f) => ({ ...f, delay_unit: e.target.value }))}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>

              <label style={{ ...labelStyle, marginTop: 12 }}>Counted from</label>
              <select style={selectStyle} value={form.anchor} onChange={(e) => setForm((f) => ({ ...f, anchor: e.target.value }))}>
                {anchors.length === 0 && <option value="RECIPIENT">after each person receives it</option>}
                {anchors.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, minHeight: 16 }}>{anchorHint}</div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Header Image <span style={{ fontWeight: 400 }}>(optional - overrides the template default)</span></label>
            <HeaderMediaInput
              value={form.header_image_url}
              onChange={(url) => setForm((f) => ({ ...f, header_image_url: url }))}
            />
          </div>

          {/* Plain-language read-back of the rule. A scheduler people can't
              restate in a sentence is a scheduler they switch off. */}
          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', fontSize: 13 }}>
            <strong>{fmtDelay(currentMinutes)}</strong>
            {form.anchor === 'RECIPIENT' ? ' after each person receives ' : ' after '}
            <strong>{campaign?.name || 'this campaign'}</strong>
            {form.anchor === 'CAMPAIGN' ? ' finishes' : ''}, send{' '}
            <strong>{sendableTemplates.find((t) => t.id === form.template_id)?.name || 'the chosen template'}</strong> to everyone who{' '}
            <strong>{(audiences.find((a) => a.value === form.audience)?.label || form.audience).toLowerCase()}</strong>.
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button type="button" className="crm-btn crm-btn-ghost crm-btn-sm" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="crm-btn crm-btn-primary crm-btn-sm" disabled={saving}>
              {saving ? 'Scheduling…' : 'Schedule Follow-up'}
            </button>
          </div>
        </form>
      )}

      {/* ── Existing rules ── */}
      <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-primary)' }}>
        <table className="col-table-new" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Follow-up</th>
              <th>Audience</th>
              <th>Timing</th>
              <th>Waiting</th>
              <th>Sent so far</th>
              <th>Status</th>
              <th>Next / Last run</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td style={{ textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>Loading…</td></tr>}
            {!loading && followups.length === 0 && (
              <tr><td style={{ textAlign: 'center', color: 'var(--text-muted)' }} colSpan={8}>
                No follow-ups scheduled. Add one to chase the people who never replied.
              </td></tr>
            )}
            {!loading && followups.map((f) => {
              const child = f.childCampaign;
              const badge = f.is_active ? (STATUS_BADGE[f.status] || 'col-badge-neutral') : STATUS_BADGE.PAUSED;
              return (
                <tr key={f.id} style={{ opacity: f.is_active ? 1 : 0.6 }}>
                  <td>
                    <div className="col-cell-primary">{f.name}</div>
                    <div className="col-cell-secondary">{f.template_name || '-'}</div>
                  </td>
                  <td>{f.audience_label || f.audience}</td>
                  <td>
                    {fmtDelay(f.delay_minutes)}
                    <div className="col-cell-secondary">
                      {f.anchor === 'RECIPIENT' ? 'after each receipt' : 'after the blast'}
                    </div>
                  </td>
                  {/* Live audience size, not a snapshot: people move between
                      audiences as delivery and read receipts land. */}
                  <td>{f.audience_size ?? '-'}</td>
                  <td>
                    {child ? (
                      <span>
                        <span className="col-cell-primary">{child.sent_count}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / {child.total_recipients}</span>
                        {child.replied_count > 0 && (
                          <span className="col-cell-secondary" style={{ display: 'block' }}>{child.replied_count} replied</span>
                        )}
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>not yet</span>}
                  </td>
                  <td>
                    <span className={`col-badge-new ${badge}`}>{f.is_active ? f.status : 'PAUSED'}</span>
                    {f.last_error && <div className="col-cell-secondary" style={{ marginTop: 4, maxWidth: 220, whiteSpace: 'normal' }}>{f.last_error}</div>}
                  </td>
                  <td className="col-cell-secondary">
                    {f.last_run_at ? `ran ${fmtDateTime(f.last_run_at)}` : `due ${fmtDateTime(f.due_at)}`}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {child && (
                      <button
                        type="button"
                        className="col-viewall-link"
                        title="Open the campaign this follow-up created"
                        onClick={() => navigate(`/super-admin/marketing-campaigns/${child.id}`)}
                        style={{ marginRight: 10 }}
                      >
                        <ArrowTopRightOnSquareIcon style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} /> Report
                      </button>
                    )}
                    {!['SENT', 'CANCELLED'].includes(f.status) && (
                      <>
                        <button
                          type="button"
                          className="col-viewall-link"
                          disabled={busyId === f.id}
                          title={f.is_active ? 'Pause this rule' : 'Resume this rule'}
                          onClick={() => act(f.id, whatsappCampaignApi.toggleFollowup)}
                          style={{ marginRight: 10 }}
                        >
                          {f.is_active
                            ? <><PauseIcon style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} /> Pause</>
                            : <><PlayIcon style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} /> Resume</>}
                        </button>
                        <button
                          type="button"
                          className="col-viewall-link"
                          disabled={busyId === f.id}
                          title="Send it now, ignoring the delay"
                          onClick={() => act(
                            f.id,
                            whatsappCampaignApi.runFollowup,
                            'Send this follow-up now, without waiting for the delay?'
                          )}
                          style={{ marginRight: 10 }}
                        >
                          Run now
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="col-viewall-link"
                      disabled={busyId === f.id}
                      onClick={() => act(
                        f.id,
                        whatsappCampaignApi.cancelFollowup,
                        f.child_campaign_id
                          ? 'Cancel this follow-up? Messages already sent are unaffected.'
                          : 'Remove this follow-up?'
                      )}
                    >
                      <TrashIcon style={{ width: 14, height: 14, verticalAlign: 'text-bottom' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-primary)' }}>
        Follow-ups are checked every 5 minutes. "Delivered" and "Read" audiences depend on the provider webhook - without it,
        only "Reached them, but never replied" can ever match.
      </div>
    </div>
  );
};

export default CampaignFollowups;
