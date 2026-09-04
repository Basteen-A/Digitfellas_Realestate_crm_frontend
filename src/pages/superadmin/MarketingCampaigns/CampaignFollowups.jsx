// ============================================================
// PANEL: Campaign follow-ups (the scheduled second touch)
//
// Lives on the campaign report. Lets an admin say, in one form:
//   "1 day after this campaign reached someone, if they still have not
//    replied, send them template X."
//
// The audience choices are not invented here - they come from the server
// (GET /campaigns/followups/meta), which derives them from the same SQL the
// scheduler runs. That is deliberate: a picker that drifts from the engine is
// how a marketing tool ends up messaging the wrong people.
//
// The audience is a MULTI-select, and that is not a convenience. The groups are
// mutually exclusive by construction - the instant someone replies they leave
// every "never replied" group permanently - so a rule pinned to one group is
// regularly aimed at nobody, and looks broken while behaving exactly as asked.
// Each row carries its own live size so an empty pick explains itself.
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
import { EMPTY_PARAMS } from './TemplateMessageFields';
// The rule form itself is shared with the campaign builder, which offers the
// same scheduler while the blast is still being written - see FollowupRuleFields.
import FollowupRuleFields, {
  EMPTY_RULE, FALLBACK_AUDIENCES, fmtDelay, followupRuleError, followupRulePayload,
} from './FollowupRuleFields';
import '../../portals/collection/CollectionWorkspace.css';

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

const CampaignFollowups = ({ campaign, templates = [] }) => {
  const navigate = useNavigate();
  const campaignId = campaign?.id;

  const [followups, setFollowups] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_RULE);
  // The template's {{n}} values for THIS follow-up only (param_overrides on the
  // server). Held beside the form because the shared fields component owns the
  // editing UI but not the submit.
  const [params, setParams] = useState(EMPTY_PARAMS);
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
  const audiences = useMemo(() => (meta?.audiences?.length ? meta.audiences : FALLBACK_AUDIENCES), [meta]);
  const anchors = useMemo(() => meta?.anchors || [], [meta]);
  // The selection as a stable dependency - an array literal would re-fire this
  // on every render.
  const audienceKey = form.audiences.join(',');

  // Refresh the counts whenever the selection changes - "who is this actually
  // going to?" answered before the rule is saved, not after. The response also
  // carries the size of EVERY slice (by_audience), which is what lets each row
  // below show its own number: when the slice you picked is empty, the next
  // question is always where those people went instead.
  useEffect(() => {
    if (!showForm || !campaignId || !form.audiences.length) { setPreview(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await whatsappCampaignApi.previewFollowup(campaignId, { audiences: form.audiences });
        if (!cancelled) setPreview(resp.data);
      } catch {
        if (!cancelled) setPreview(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, campaignId, audienceKey]);

  const openForm = () => {
    setForm({ ...EMPTY_RULE, name: `${campaign?.name || 'Campaign'} - follow-up` });
    setParams(EMPTY_PARAMS);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    // Name, audience and everything the message itself needs - a template, its
    // header media, a resolved value for every {{n}}. Shared with the campaign
    // builder so both screens refuse exactly the same rules, and caught here so
    // the problem is a sentence on screen now rather than a provider rejection a
    // day from now when the rule fires and nobody is watching.
    const err = followupRuleError(form, templates, params);
    if (err) { toast.error(err); return; }

    setSaving(true);
    try {
      const resp = await whatsappCampaignApi.createFollowup(campaignId, followupRulePayload(form, params));
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
          <FollowupRuleFields
            rule={form}
            onChange={setForm}
            params={params}
            onParamsChange={setParams}
            templates={templates}
            audiences={audiences}
            anchors={anchors}
            counts={preview?.by_audience}
            matchCount={preview ? preview.total : null}
            countsHint="Counting…"
            subjectName={campaign?.name || 'this campaign'}
          />

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
                  {/* Several ticked groups read as "A or B or C", so this cell
                      has to wrap rather than stretch the table. */}
                  <td style={{ whiteSpace: 'normal', maxWidth: 260 }}>{f.audience_label || f.audience}</td>
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
        Follow-ups are checked every 5 minutes. The groups are exclusive - the moment someone writes back they leave every
        "never replied" group for good, which is why a rule can sit at 0 waiting: tick more than one group to widen it.
        "Delivered" and "Read" also depend on the provider webhook - without it, only "Reached them, but never replied" can ever match.
      </div>
    </div>
  );
};

export default CampaignFollowups;
