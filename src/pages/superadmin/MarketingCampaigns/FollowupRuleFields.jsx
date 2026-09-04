// ============================================================
// SHARED FIELDS: one automatic follow-up rule
//
//   "1 day after this campaign reached someone, if they still have not replied,
//    send them template X."
//
// Two screens ask for exactly this and must ask for it identically:
//   - Campaigns.jsx        while the blast is being written, so the chase is set
//                          up before a single message goes out
//   - CampaignFollowups.jsx  on the report afterwards, to add another one
//
// They were always going to drift if written twice - and a follow-up builder
// that drifts is one that quietly messages the wrong slice of people. So the
// fields, the validation and the payload shape all live here, once.
//
// The audience choices themselves are NOT defined here either: they come from
// the server (GET /campaigns/followups/meta), which derives them from the same
// SQL the scheduler runs.
// ============================================================

import React from 'react';
import TemplateMessageFields, { templateMessageError } from './TemplateMessageFields';
import WhatsappPreview from './WhatsappPreview';

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, display: 'block' };
const inputStyle = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: 14, background: 'var(--bg-primary)', color: 'var(--text-primary)' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
// The audience picker is a checkbox list rather than a <select multiple>: the
// native control hides every unselected option behind a scroll and needs
// ctrl-click to add a second one, which is the interaction nobody discovers.
// Every group on screen, with its live size, is the whole point.
const audienceBoxStyle = { border: '1px solid var(--border-primary)', borderRadius: 8, background: 'var(--bg-primary)', padding: 4, maxHeight: 186, overflowY: 'auto' };
const audienceRowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer' };

// Quick picks for the delay. Hours and minutes were always accepted - they just
// sat inside a collapsed <select> that read "days", so the shorter delays were
// invisible unless you thought to open it. Chips put the whole range on screen;
// the Custom row underneath still takes any value.
export const DELAY_PRESETS = [
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

export const UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440 };

// Shown only until GET /followups/meta answers; the server's list is the truth.
export const FALLBACK_AUDIENCES = [{ value: 'DELIVERED_NO_REPLY', label: 'Delivered to the phone, but never replied' }];

export const EMPTY_RULE = {
  name: '',
  template_id: '',
  // A LIST, because the groups exclude one another: someone who reads the blast
  // and then writes back leaves "read but never replied" permanently, so a rule
  // pinned to one group is regularly aimed at nobody. Ticking three of them is
  // how you say "chase anyone who got it and went quiet, however far they got".
  audiences: ['DELIVERED_NO_REPLY'],
  anchor: 'RECIPIENT',
  delay_value: 1,
  delay_unit: 'days',
  header_image_url: '',
};

// Whatever the form currently adds up to, in minutes - the one number the server
// actually stores, and what decides which chip is lit.
export const ruleMinutes = (rule) => (Number(rule.delay_value) || 0) * (UNIT_MINUTES[rule.delay_unit] || 1);

// "1 day" / "6 hours" / "45 minutes" - read back stored minutes in the largest
// unit that divides cleanly, which is how the admin typed it.
export const fmtDelay = (minutes) => {
  const m = Number(minutes) || 0;
  if (m === 0) return 'immediately';
  if (m % 1440 === 0) { const d = m / 1440; return `${d} day${d === 1 ? '' : 's'}`; }
  if (m % 60 === 0) { const h = m / 60; return `${h} hour${h === 1 ? '' : 's'}`; }
  return `${m} minute${m === 1 ? '' : 's'}`;
};

// Approved and active only: a pending or rejected template would be refused by
// WhatsApp hours later, when nobody is watching the rule fire.
export const sendableTemplates = (templates = []) => templates.filter((t) => t.is_active !== false && t.status === 'APPROVED');

/**
 * Everything wrong with the rule as a sentence, or null.
 * Caught here so the problem is on screen now rather than a provider rejection a
 * day from now, when the rule fires and nobody is watching.
 * @param {object} rule
 * @param {object[]} templates     the full list; the rule's own is resolved here
 * @param {object} params          { header_params, body_params }
 * @param {boolean} requireName    the campaign builder derives the name instead
 */
export const followupRuleError = (rule, templates, params, { requireName = true } = {}) => {
  if (requireName && !String(rule.name || '').trim()) return 'Give the follow-up a name.';
  if (!rule.audiences?.length) return 'Pick at least one group for the follow-up to chase.';
  const template = sendableTemplates(templates).find((t) => t.id === rule.template_id) || null;
  return templateMessageError(template, rule.header_image_url, params);
};

/** The rule as the API wants it - shared by both callers so the shapes match. */
export const followupRulePayload = (rule, params) => ({
  ...(String(rule.name || '').trim() ? { name: rule.name.trim() } : {}),
  template_id: rule.template_id,
  audiences: rule.audiences,
  // The legacy single field, kept in the payload so a rule still saves correctly
  // against a server that predates the multi-select.
  audience: rule.audiences[0],
  anchor: rule.anchor,
  delay_value: Number(rule.delay_value) || 0,
  delay_unit: rule.delay_unit,
  header_image_url: rule.header_image_url || null,
  ...(params?.header_params?.length ? { header_params: params.header_params } : {}),
  ...(params?.body_params?.length ? { body_params: params.body_params } : {}),
});

/**
 * @param {object}   rule           the current rule
 * @param {Function} onChange       (updaterFn) => void
 * @param {object[]} audiences      meta.audiences, the server's own list
 * @param {object[]} anchors        meta.anchors
 * @param {object}   [counts]       per-audience live sizes, when they exist
 * @param {number}   [matchCount]   how many the current selection matches
 * @param {string}   [countsHint]   shown instead of a count when there is none
 *                                  (the campaign builder has no recipients yet)
 * @param {boolean}  [showName]     the campaign builder derives the name
 * @param {string}   [subjectName]  what the read-back sentence calls the blast
 * @param {boolean}  [stackMessage] put the message preview UNDER the fields
 *                                  instead of beside them - the campaign
 *                                  builder nests this inside a column that
 *                                  already has its own preview pane, and two
 *                                  side-by-side splits leave neither usable
 */
const FollowupRuleFields = ({
  rule,
  onChange,
  params,
  onParamsChange,
  templates = [],
  audiences = [],
  anchors = [],
  counts = null,
  matchCount = null,
  countsHint = '',
  showName = true,
  subjectName = 'this campaign',
  stackMessage = false,
}) => {
  const options = audiences.length ? audiences : FALLBACK_AUDIENCES;
  const currentMinutes = ruleMinutes(rule);
  const anchorHint = anchors.find((a) => a.value === rule.anchor)?.hint || '';

  const sendable = sendableTemplates(templates);
  const selectedTemplate = sendable.find((t) => t.id === rule.template_id) || null;

  // Tick / untick one group. The selection is kept in the server's own order so
  // a rule's anchor precedence (which receipt starts the clock for someone who
  // lands in two groups at once) never depends on the order the boxes happened
  // to be clicked.
  const toggleAudience = (value) => onChange((r) => {
    const next = r.audiences.includes(value)
      ? r.audiences.filter((v) => v !== value)
      : [...r.audiences, value];
    const order = options.map((a) => a.value);
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return { ...r, audiences: next };
  });

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: showName ? '1fr 1fr' : '1fr', gap: 12 }}>
        {showName && (
          <div>
            <label style={labelStyle}>Follow-up Name *</label>
            <input
              style={inputStyle}
              value={rule.name}
              onChange={(e) => onChange((r) => ({ ...r, name: e.target.value }))}
              placeholder="e.g. Silver Divyam - second touch"
            />
          </div>
        )}
        <div>
          <label style={labelStyle}>Send it to <span style={{ fontWeight: 400 }}>(tick as many as you need)</span></label>
          <div style={audienceBoxStyle}>
            {options.map((a) => {
              const size = counts?.[a.value];
              return (
                <label key={a.value} style={audienceRowStyle}>
                  <input
                    type="checkbox"
                    checked={rule.audiences.includes(a.value)}
                    onChange={() => toggleAudience(a.value)}
                    style={{ width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1 }}>{a.label}</span>
                  {/* Each group's live size. This is the whole diagnosis when a
                      chase "does nothing": the readers all replied, so the
                      Read-no-reply row says 0 and Replied says 1. */}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {size === undefined || size === null ? '' : size}
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, minHeight: 16 }}>
            {!rule.audiences.length && 'Pick at least one group to chase.'}
            {rule.audiences.length > 0 && (matchCount !== null && matchCount !== undefined
              ? <span><strong style={{ color: 'var(--text-primary)' }}>{matchCount}</strong> recipient(s) match right now{rule.audiences.length > 1 ? ', across the ticked groups' : ''}</span>
              : countsHint)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Wait how long</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DELAY_PRESETS.map((d) => {
            const active = currentMinutes === d.value * UNIT_MINUTES[d.unit];
            return (
              <button
                key={d.label}
                type="button"
                className={`crm-btn crm-btn-sm ${active ? 'crm-btn-primary' : 'crm-btn-ghost'}`}
                onClick={() => onChange((r) => ({ ...r, delay_value: d.value, delay_unit: d.unit }))}
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
            value={rule.delay_value}
            onChange={(e) => onChange((r) => ({ ...r, delay_value: e.target.value }))}
          />
          <select
            aria-label="Custom delay unit"
            style={{ ...selectStyle, width: 110 }}
            value={rule.delay_unit}
            onChange={(e) => onChange((r) => ({ ...r, delay_unit: e.target.value }))}
          >
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </div>

        <label style={{ ...labelStyle, marginTop: 12 }}>Counted from</label>
        <select
          style={{ ...selectStyle, maxWidth: 420 }}
          value={rule.anchor}
          onChange={(e) => onChange((r) => ({ ...r, anchor: e.target.value }))}
        >
          {anchors.length === 0 && <option value="RECIPIENT">After each person receives it</option>}
          {anchors.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, minHeight: 16 }}>{anchorHint}</div>
      </div>

      {/* ── The message itself ──
          Picking a template by name is not enough to know what a recipient gets:
          the header media, the {{n}} values and the buttons all decide whether
          Meta accepts the send. This section is that, beside a live preview. */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-primary)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>The follow-up message</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          What this follow-up actually sends. Variables are filled per lead at send time.
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: stackMessage ? '1fr' : 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}
          className={stackMessage ? undefined : 'wa-builder-grid'}
        >
          <div>
            <TemplateMessageFields
              templates={sendable}
              templateId={rule.template_id}
              onTemplateChange={(id) => onChange((r) => ({ ...r, template_id: id }))}
              headerImageUrl={rule.header_image_url}
              onHeaderImageChange={(url) => onChange((r) => ({ ...r, header_image_url: url }))}
              params={params}
              onParamsChange={onParamsChange}
              showPreview={false}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Message Preview</div>
            {selectedTemplate ? (
              <>
                <WhatsappPreview
                  template={{
                    ...selectedTemplate,
                    header_params: params?.header_params?.length ? params.header_params : selectedTemplate.header_params,
                    body_params: params?.body_params?.length ? params.body_params : selectedTemplate.body_params,
                  }}
                  headerMediaUrl={rule.header_image_url}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  {Array.isArray(selectedTemplate.buttons) && selectedTemplate.buttons.length > 0
                    ? 'The buttons above are part of the approved template - WhatsApp bakes them in at approval time, so they cannot be added or changed per follow-up. Edit them on the template in WA Templates.'
                    : 'This template has no buttons. Buttons are approved as part of a template, so add them in WA Templates rather than here.'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 8px', textAlign: 'center', border: '1px dashed var(--border-primary)', borderRadius: 10 }}>
                Select a template to see the message.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plain-language read-back of the rule. A scheduler people can't restate
          in a sentence is a scheduler they switch off. */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', fontSize: 13 }}>
        <strong>{fmtDelay(currentMinutes)}</strong>
        {rule.anchor === 'RECIPIENT' ? ' after each person receives ' : ' after '}
        <strong>{subjectName}</strong>
        {rule.anchor === 'CAMPAIGN' ? ' finishes' : ''}, send{' '}
        <strong>{selectedTemplate?.name || 'the chosen template'}</strong> to everyone who{' '}
        <strong>
          {rule.audiences.length
            ? rule.audiences
              .map((v) => (options.find((a) => a.value === v)?.label || v).toLowerCase())
              .join(' — or — ')
            : 'matches the groups you tick above'}
        </strong>.
      </div>
    </>
  );
};

export default FollowupRuleFields;
